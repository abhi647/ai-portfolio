/**
 * Ask AI — server side. Claude answers data questions by calling a strict `run_query` tool
 * against the MIS semantic layer (as many times as it needs), then finishes with a strict
 * `present_answer` tool carrying the narrative and the chart specs to render.
 *
 * The API key never reaches the browser: this runs in the Vite dev/preview server.
 * `handleAsk` is framework-agnostic, so it can be moved into any serverless function.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { catalogText } from "../src/ai/catalog";
import { QUERY_SPEC_SCHEMA, execute, insightsFor, normalize, resultForModel, type QuerySpec } from "../src/ai/engine";

const MODEL = process.env.DFM_AI_MODEL || "claude-opus-5-5";
const MAX_TURNS = 8;

export interface AskTurn { role: "user" | "assistant"; content: string }
export interface AskStep { label: string; detail?: string; ok: boolean }
export interface AskResponse { answer: string; charts: QuerySpec[]; followUps: string[]; steps: AskStep[]; model: string }

const SYSTEM = `You are the analytics copilot inside the DFM Foods MIS (makers of CRAX snacks). Users are supply-chain, sales and finance managers asking about their own operational data.

How to work:
- Answer only from data you retrieve with run_query. Never invent numbers. If the data cannot answer the question, say so and suggest the closest question it can answer.
- Call run_query as many times as you need (in parallel when independent) to explore, compare, and check before answering. Prefer a few well-aimed queries over many.
- Finish every turn by calling present_answer exactly once. Do not write the final answer as plain text.

The answer (present_answer.answer):
- 2–5 short sentences of plain business language, leading with the direct answer, then the most useful "why" or "so what", then a concrete next action when there is one.
- Highlight key figures with inline tokens: {{metric:Label|value|tone}} where tone is positive, negative or neutral (e.g. {{metric:Shree Ganesh Roadlines|₹52.6/km|negative}}). Use the exact formatted values the query returned.
- No headings, no bullet lists, no markdown tables — the charts carry the detail.

Charts (present_answer.charts): 0–3 QuerySpecs the app will execute and render. Pick the chart that answers the question best: line/area for trends over time, horizontal_bar or bar_list for rankings, stacked_bar for composition, donut only for ≤6 parts of a whole, heatmap for two dimensions, combo for a volume plus a rate (2 measures), kpi for single numbers, table for detail lists. Reuse specs you already ran so the user sees what you saw. Give each a clear title.

follow_ups: 3 short, specific next questions the user is likely to ask, phrased in their voice.

Data catalog (datasets, dimensions with sample values, measures):
${catalogText()}`;

const PRESENT_ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "charts", "follow_ups"],
  properties: {
    answer: { type: "string", description: "The narrative answer with {{metric:Label|value|tone}} tokens." },
    charts: { type: "array", items: QUERY_SPEC_SCHEMA, description: "0–3 chart specs to render." },
    follow_ups: { type: "array", items: { type: "string" }, description: "3 suggested follow-up questions." },
  },
} as const;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "run_query",
    description: "Run an aggregation over one dataset of the DFM MIS semantic layer. Returns totals and per-group values (formatted), plus computed takeaways. Use exact dimension values from the catalog in filters.",
    strict: true,
    input_schema: QUERY_SPEC_SCHEMA as unknown as Anthropic.Beta.BetaTool.InputSchema,
  },
  {
    name: "present_answer",
    description: "Deliver the final answer to the user: narrative, charts to render, and follow-up questions. Call exactly once, at the end.",
    strict: true,
    input_schema: PRESENT_ANSWER_SCHEMA as unknown as Anthropic.Beta.BetaTool.InputSchema,
  },
];

export class NotConfiguredError extends Error {}

export async function handleAsk(history: AskTurn[]): Promise<AskResponse> {
  let client: Anthropic;
  try {
    client = new Anthropic();
  } catch {
    throw new NotConfiguredError("No Anthropic credentials found on the server.");
  }

  const messages: Anthropic.Beta.BetaMessageParam[] = history.slice(-12).map((t) => ({ role: t.role, content: t.content }));
  const steps: AskStep[] = [];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        // System prompt + tools are stable, so they are cached across turns and users.
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        tools: TOOLS,
        tool_choice: { type: "auto" },
        messages,
      });
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) throw new NotConfiguredError(err.message);
      // No credentials: the SDK throws before sending anything (not an APIError).
      if (!(err instanceof Anthropic.APIError) && err instanceof Error && /authentication method|api ?key|credentials/i.test(err.message)) throw new NotConfiguredError(err.message);
      throw err;
    }

    if (response.stop_reason === "refusal") {
      return { answer: "I can’t help with that request. Try asking about trips, orders, sales, CFA throughput or the e-com P&L.", charts: [], followUps: [], steps, model: response.model };
    }

    // Keep the full assistant content (including thinking blocks) so the next turn stays valid.
    messages.push({ role: "assistant", content: response.content });

    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    const present = toolUses.find((t) => t.name === "present_answer");
    if (present) {
      const input = present.input as { answer?: string; charts?: QuerySpec[]; follow_ups?: string[] };
      return {
        answer: String(input.answer ?? ""),
        charts: (input.charts ?? []).slice(0, 3).map(normalize),
        followUps: (input.follow_ups ?? []).slice(0, 3),
        steps,
        model: response.model,
      };
    }

    if (!toolUses.length) {
      // The model answered in plain text instead of calling present_answer — accept it.
      const text = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
      return { answer: text || "I couldn’t find an answer to that.", charts: [], followUps: [], steps, model: response.model };
    }

    // Run every query in this turn and return all results in one user message.
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((t) => {
      if (t.name !== "run_query") return { type: "tool_result", tool_use_id: t.id, is_error: true, content: `Unknown tool ${t.name}` };
      const spec = normalize(t.input as QuerySpec);
      const r = execute(spec);
      steps.push({ label: spec.title || `Query ${spec.dataset}`, detail: r.error ?? `${spec.dataset} · ${spec.measures.join(", ")}${spec.dimension ? ` by ${spec.dimension}` : ""}${spec.filters.length ? ` · ${spec.filters.length} filter(s)` : ""} → ${r.rows.length} rows`, ok: !r.error });
      if (r.error) return { type: "tool_result", tool_use_id: t.id, is_error: true, content: r.error };
      const takeaways = insightsFor(r).map((s) => s.replace(/\{\{metric:([^|}]*)\|?([^|}]*)\|?[^}]*\}\}/g, (_m, a, b) => [a, b].filter(Boolean).join(" ")));
      return { type: "tool_result", tool_use_id: t.id, content: resultForModel(r) + (takeaways.length ? `\nComputed takeaways: ${takeaways.join(" ")}` : "") };
    });
    messages.push({ role: "user", content: results });
  }
  return { answer: "That took more analysis steps than I allow per question. Try narrowing it down (a dataset, a period or a measure).", charts: [], followUps: [], steps, model: MODEL };
}

function readJson(req: IncomingMessage): Promise<unknown> {
  const pre = (req as IncomingMessage & { body?: unknown }).body; // Vercel parses JSON bodies for us
  if (pre !== undefined) return Promise.resolve(typeof pre === "string" ? JSON.parse(pre || "{}") : pre);
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => { raw += c; if (raw.length > 200_000) reject(new Error("Body too large")); });
    req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

/** Env vars, or a profile saved by `ant auth login` (the SDK reads ~/.config/anthropic automatically). */
const configured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE || existsSync(join(homedir(), ".config", "anthropic")));

/** GET /api/ask/status */
export function handleStatus(_req: IncomingMessage, res: ServerResponse) {
  send(res, 200, { configured: configured(), model: MODEL });
}

/** POST /api/ask — plain Node (req, res), so it runs in Vite and as a Vercel function. */
export async function handleHttp(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") return send(res, 405, { error: "method_not_allowed" });
  try {
    const body = (await readJson(req)) as { messages?: AskTurn[] };
    const history = (body.messages ?? []).filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim());
    if (!history.length || history[history.length - 1].role !== "user") return send(res, 400, { error: "bad_request" });
    send(res, 200, await handleAsk(history));
  } catch (err) {
    if (err instanceof NotConfiguredError) return send(res, 503, { error: "not_configured", message: err.message });
    if (err instanceof Anthropic.RateLimitError) return send(res, 429, { error: "rate_limited", message: "Claude is busy — try again in a moment." });
    if (err instanceof Anthropic.APIError) return send(res, 502, { error: "upstream", message: `Claude API error ${err.status}` });
    console.error("[ask]", err);
    send(res, 500, { error: "internal", message: "Something went wrong answering that." });
  }
}

function middleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  if (!req.url?.startsWith("/api/ask")) return next();
  if (req.method === "GET" && req.url.startsWith("/api/ask/status")) return handleStatus(req, res);
  void handleHttp(req, res);
}

/** Mounts POST /api/ask (and GET /api/ask/status) on the dev and preview servers. */
export function askPlugin(): Plugin {
  return {
    name: "dfm-ask-ai",
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}
