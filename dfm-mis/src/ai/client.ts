import type { QuerySpec } from "./engine";
import { answerLocally } from "./local";

export interface AskStep { label: string; detail?: string; ok: boolean }
export interface AskResult { answer: string; charts: QuerySpec[]; followUps: string[]; steps: AskStep[]; mode: "claude" | "offline"; model?: string; notice?: string }
export interface AskTurn { role: "user" | "assistant"; content: string }

let status: Promise<{ configured: boolean; model?: string }> | null = null;
export function aiStatus() {
  return (status ??= fetch("/api/ask/status").then((r) => (r.ok ? r.json() : { configured: false })).catch(() => ({ configured: false })));
}

/** Ask Claude via the server; fall back to the offline parser when the server has no credentials or is unreachable. */
export async function askAI(history: AskTurn[], signal?: AbortSignal): Promise<AskResult> {
  const question = history[history.length - 1]?.content ?? "";
  const { configured } = await aiStatus();
  if (configured) {
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history }), signal });
      if (res.ok) { const body = await res.json(); return { ...body, mode: "claude" }; }
      const err = await res.json().catch(() => ({}));
      if (res.status !== 503) return { ...answerLocally(question), mode: "offline", notice: `${err.message ?? "Claude is unavailable"} — answered offline instead.` };
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
    }
  }
  await new Promise((r) => setTimeout(r, 450));
  return { ...answerLocally(question), mode: "offline" };
}
