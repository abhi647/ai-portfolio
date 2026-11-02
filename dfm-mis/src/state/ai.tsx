import * as React from "react";
import type { AssistantMessage } from "@/components/overtrue/assistant-panel";
import { askAI, aiStatus, type AskTurn } from "@/ai/client";
import type { QuerySpec } from "@/ai/engine";

export interface AIMessage extends AssistantMessage { charts?: QuerySpec[]; followUps?: string[]; mode?: "claude" | "offline" }
export interface Pin { id: string; spec: QuerySpec; at: number }

interface AIState {
  messages: AIMessage[];
  status: "idle" | "streaming";
  send: (text: string) => void;
  stop: () => void;
  regenerate: (id: string) => void;
  newChat: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  /** Open the assistant and ask straight away — used by "Ask AI" buttons across the app. */
  ask: (text: string) => void;
  pins: Pin[];
  togglePin: (spec: QuerySpec) => void;
  isPinned: (spec: QuerySpec) => boolean;
  configured: boolean | null;
  model?: string;
}

const Ctx = React.createContext<AIState | null>(null);
export const useAI = () => React.useContext(Ctx);

const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };
const specKey = (s: QuerySpec) => JSON.stringify({ ...s, title: "" });
let seq = 0;
const id = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;

export function AIProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = React.useState<AIMessage[]>(() => read("dfm.ai.chat", []).map((m: AIMessage) => (m.status === "streaming" ? { ...m, status: "error" as const } : m)));
  const [status, setStatus] = React.useState<"idle" | "streaming">("idle");
  const [open, setOpen] = React.useState(false);
  const [pins, setPins] = React.useState<Pin[]>(() => read("dfm.ai.pins", []));
  const [cfg, setCfg] = React.useState<{ configured: boolean | null; model?: string }>({ configured: null });
  const abort = React.useRef<AbortController | null>(null);
  const latest = React.useRef(messages);
  latest.current = messages;

  React.useEffect(() => { aiStatus().then((s) => setCfg(s)); }, []);
  React.useEffect(() => { write("dfm.ai.chat", messages.slice(-40)); }, [messages]);
  React.useEffect(() => { write("dfm.ai.pins", pins); }, [pins]);

  const run = React.useCallback(async (history: AIMessage[]) => {
    const turns: AskTurn[] = history.filter((m) => m.status !== "error" && m.content.trim()).map((m) => ({ role: m.role, content: m.content }));
    const aid = id();
    setMessages([...history, {
      id: aid, role: "assistant", content: "", status: "streaming", createdAt: new Date(),
      steps: [{ id: "plan", label: "Reading the question and picking the data", kind: "think", status: "running" }],
    }]);
    setStatus("streaming");
    const ctrl = new AbortController();
    abort.current = ctrl;
    const started = Date.now();
    try {
      const res = await askAI(turns, ctrl.signal);
      const elapsed = Date.now() - started;
      setMessages((ms) => ms.map((m) => (m.id !== aid ? m : {
        ...m,
        status: "done",
        content: (res.notice ? `_${res.notice}_\n\n` : "") + res.answer,
        charts: res.charts,
        followUps: res.followUps,
        mode: res.mode,
        steps: [
          { id: "plan", label: "Read the question and picked the data", kind: "think" as const, status: "done" as const, duration: Math.min(800, elapsed / 3) },
          ...res.steps.map((s, i) => ({ id: "q" + i, label: s.label, detail: s.detail, kind: "query" as const, status: s.ok ? ("done" as const) : ("error" as const), duration: Math.round(elapsed / Math.max(1, res.steps.length) / 2) })),
        ],
      })));
    } catch (e) {
      const aborted = (e as Error).name === "AbortError";
      setMessages((ms) => ms.map((m) => (m.id !== aid ? m : { ...m, status: aborted ? "done" : "error", content: aborted ? "_Stopped._" : "", steps: [] })));
    } finally {
      setStatus("idle");
      abort.current = null;
    }
  }, []);

  const send = React.useCallback((text: string) => {
    const t = text.trim();
    if (!t || status === "streaming") return;
    // Side effects stay out of state updaters (StrictMode runs updaters twice).
    void run([...latest.current, { id: id(), role: "user" as const, content: t, createdAt: new Date() }]);
  }, [run, status]);

  const value: AIState = {
    messages, status, send,
    stop: () => abort.current?.abort(),
    regenerate: (mid) => {
      const i = messages.findIndex((m) => m.id === mid);
      if (i > 0) void run(messages.slice(0, i));
    },
    newChat: () => { abort.current?.abort(); setMessages([]); },
    open, setOpen,
    ask: (text) => { setOpen(true); window.setTimeout(() => send(text), 60); },
    pins,
    togglePin: (spec) => setPins((ps) => (ps.some((p) => specKey(p.spec) === specKey(spec)) ? ps.filter((p) => specKey(p.spec) !== specKey(spec)) : [{ id: id(), spec, at: Date.now() }, ...ps])),
    isPinned: (spec) => pins.some((p) => specKey(p.spec) === specKey(spec)),
    configured: cfg.configured, model: cfg.model,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
