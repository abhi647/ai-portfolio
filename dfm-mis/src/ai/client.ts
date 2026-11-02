import type { QuerySpec } from "./engine";
import { answerLocally } from "./local";
import type { AskFocus, AskMode, AskSource } from "./modes";

export interface AskStep { label: string; detail?: string; ok: boolean }
export interface AskResult { answer: string; charts: QuerySpec[]; followUps: string[]; steps: AskStep[]; sources: AskSource[]; mode: "claude" | "offline"; model?: string; notice?: string }
export interface AskOptions { mode?: AskMode; focus?: AskFocus }
export interface AskTurn { role: "user" | "assistant"; content: string }

let status: Promise<{ configured: boolean; model?: string }> | null = null;
export function aiStatus() {
  return (status ??= fetch("/api/ask/status").then((r) => (r.ok ? r.json() : { configured: false })).catch(() => ({ configured: false })));
}

/** Ask Claude via the server; fall back to the offline parser when the server has no credentials or is unreachable. */
export async function askAI(history: AskTurn[], signal?: AbortSignal, opts: AskOptions = {}): Promise<AskResult> {
  const mode = opts.mode ?? "quick", focus = opts.focus ?? "all";
  const question = history[history.length - 1]?.content ?? "";
  const { configured } = await aiStatus();
  if (configured) {
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history, mode, focus }), signal });
      if (res.ok) { const body = await res.json(); return { sources: [], ...body, mode: "claude" }; }
      const err = await res.json().catch(() => ({}));
      if (res.status !== 503) return { ...answerLocally(question, mode, focus), mode: "offline", notice: `${err.message ?? "Claude is unavailable"} — answered offline instead.` };
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
    }
  }
  await new Promise((r) => setTimeout(r, mode === "research" ? 1400 : 450));
  return { ...answerLocally(question, mode, focus), mode: "offline" };
}
