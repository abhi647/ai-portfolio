import * as React from "react";
import type { AssistantMessage } from "@/components/overtrue/assistant-panel";
import { askAI, aiStatus, type AskTurn } from "@/ai/client";
import type { QuerySpec } from "@/ai/engine";
import type { AskFocus, AskMode, AskSource } from "@/ai/modes";
import { answerLocally } from "@/ai/local";
import { MONTHS } from "@/data/data";

export interface AIMessage extends AssistantMessage {
  charts?: QuerySpec[]; followUps?: string[]; mode?: "claude" | "offline";
  /** Answer mode and data focus the question was asked with. */
  askMode?: AskMode; focus?: AskFocus;
  sources?: AskSource[];
}
export interface Pin { id: string; spec: QuerySpec; at: number }
export interface Thread { id: string; title: string; at: number; messages: AIMessage[] }

interface AIState {
  messages: AIMessage[];
  status: "idle" | "streaming";
  send: (text: string, opts?: { mode?: AskMode; focus?: AskFocus }) => void;
  stop: () => void;
  regenerate: (id: string, opts?: { mode?: AskMode }) => void;
  newChat: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  /** Open the assistant and ask straight away — used by "Ask AI" buttons across the app. */
  ask: (text: string, opts?: { mode?: AskMode; focus?: AskFocus }) => void;
  pins: Pin[];
  togglePin: (spec: QuerySpec) => void;
  movePin: (id: string, dir: -1 | 1) => void;
  isPinned: (spec: QuerySpec) => boolean;
  configured: boolean | null;
  model?: string;
  /** Default answer mode and focus for new questions. */
  askMode: AskMode; setAskMode: (m: AskMode) => void;
  focus: AskFocus; setFocus: (f: AskFocus) => void;
  /** Library of earlier threads (newest first). */
  threads: Thread[];
  openThread: (id: string) => void;
  deleteThread: (id: string) => void;
}

const Ctx = React.createContext<AIState | null>(null);
export const useAI = () => React.useContext(Ctx);

const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };
const specKey = (s: QuerySpec) => JSON.stringify({ ...s, title: "" });
let seq = 0;
const id = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;
/* First-run demo content, answered from the live demo data, so the Library and pinned board are never empty. */
function demoThreads(): Thread[] {
  const qs: [string, AskMode, number][] = [
    ["Why is freight cost per km rising, and what should we do?", "research", 3],
    ["OTIF this month vs last month by plant", "compare", 20],
    ["Brief me on sales vs target this month", "brief", 27],
    ["Which transporters cost the most per km?", "quick", 46],
  ];
  return qs.map(([q, mode, hoursAgo], i) => {
    const at = Date.now() - hoursAgo * 3600e3;
    const r = answerLocally(q, mode, "all");
    const user: AIMessage = { id: `demo-q${i}`, role: "user", content: q, createdAt: new Date(at), askMode: mode, focus: "all" };
    const answer: AIMessage = {
      id: `demo-a${i}`, role: "assistant", content: r.answer, status: "done", createdAt: new Date(at + 4000), askMode: mode, focus: "all", mode: "offline",
      charts: r.charts, followUps: r.followUps, sources: r.sources,
      steps: [{ id: "plan", label: "Read the question and picked the data", kind: "think", status: "done", duration: 300 }, ...r.steps.map((s, j) => ({ id: "q" + j, label: s.label, detail: s.detail, kind: "query" as const, status: "done" as const, duration: 200 }))],
    };
    return { id: `demo-t${i}`, title: q, at, messages: [user, answer] };
  });
}
function demoPins(): Pin[] {
  const cur = MONTHS[5].label;
  const specs: QuerySpec[] = [
    { dataset: "trips", measures: ["cost_per_km"], dimension: "transporter", series: null, filters: [{ field: "month", op: "in", values: [cur] }], sort: "desc", limit: 8, chart: "horizontal_bar", title: `Cost per km by transporter · ${cur}` },
    { dataset: "orders", measures: ["orders", "otif_pct"], dimension: "month", series: null, filters: [], sort: "natural", limit: null, chart: "combo", title: "Orders and OTIF by month" },
    { dataset: "sales", measures: ["achievement_pct"], dimension: "zone", series: null, filters: [{ field: "month", op: "in", values: [cur] }], sort: "asc", limit: null, chart: "horizontal_bar", title: `Sales achievement by zone · ${cur}` },
    { dataset: "cfa", measures: ["cases"], dimension: "day", series: null, filters: [], sort: "natural", limit: null, chart: "area", title: "CFA dispatch · last 30 days" },
  ];
  return specs.map((spec, i) => ({ id: `demo-pin${i}`, spec, at: Date.now() - i * 3600e3 }));
}

const fix = (ms: AIMessage[]) => ms.map((m) => (m.status === "streaming" ? { ...m, status: "error" as const } : m));

export function AIProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = React.useState<AIMessage[]>(() => fix(read("dfm.ai.chat", [])));
  const [status, setStatus] = React.useState<"idle" | "streaming">("idle");
  const [open, setOpen] = React.useState(false);
  const [pins, setPins] = React.useState<Pin[]>(() => read<Pin[] | null>("dfm.ai.pins", null) ?? demoPins());
  const [threads, setThreads] = React.useState<Thread[]>(() => read<Thread[] | null>("dfm.ai.threads", null) ?? demoThreads());
  const [askMode, setAskModeState] = React.useState<AskMode>(() => read("dfm.ai.mode", "quick" as AskMode));
  const [focus, setFocusState] = React.useState<AskFocus>(() => read("dfm.ai.focus", "all" as AskFocus));
  const [cfg, setCfg] = React.useState<{ configured: boolean | null; model?: string }>({ configured: null });
  const abort = React.useRef<AbortController | null>(null);
  const latest = React.useRef(messages);
  latest.current = messages;
  const prefs = React.useRef({ askMode, focus });
  prefs.current = { askMode, focus };

  React.useEffect(() => { aiStatus().then((s) => setCfg(s)); }, []);
  React.useEffect(() => { write("dfm.ai.chat", messages.slice(-40)); }, [messages]);
  React.useEffect(() => { write("dfm.ai.pins", pins); }, [pins]);
  React.useEffect(() => { write("dfm.ai.threads", threads.slice(0, 30)); }, [threads]);

  const run = React.useCallback(async (history: AIMessage[], mode: AskMode, f: AskFocus) => {
    const turns: AskTurn[] = history.filter((m) => m.status !== "error" && m.content.trim()).map((m) => ({ role: m.role, content: m.content }));
    const aid = id();
    setMessages([...history, {
      id: aid, role: "assistant", content: "", status: "streaming", createdAt: new Date(), askMode: mode, focus: f,
      steps: [{ id: "plan", label: "Reading the question and picking the data", kind: "think", status: "running" }],
    }]);
    setStatus("streaming");
    const ctrl = new AbortController();
    abort.current = ctrl;
    const started = Date.now();
    try {
      const res = await askAI(turns, ctrl.signal, { mode, focus: f });
      const elapsed = Date.now() - started;
      setMessages((ms) => ms.map((m) => (m.id !== aid ? m : {
        ...m,
        status: "done",
        content: (res.notice ? `_${res.notice}_\n\n` : "") + res.answer,
        charts: res.charts,
        followUps: res.followUps,
        sources: res.sources,
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

  const send = React.useCallback((text: string, opts?: { mode?: AskMode; focus?: AskFocus }) => {
    const t = text.trim();
    if (!t || status === "streaming") return;
    const mode = opts?.mode ?? prefs.current.askMode, f = opts?.focus ?? prefs.current.focus;
    // Side effects stay out of state updaters (StrictMode runs updaters twice).
    void run([...latest.current, { id: id(), role: "user" as const, content: t, createdAt: new Date(), askMode: mode, focus: f }], mode, f);
  }, [run, status]);

  const archive = React.useCallback(() => {
    const ms = latest.current.filter((m) => m.status !== "streaming");
    const first = ms.find((m) => m.role === "user");
    if (!first) return;
    setThreads((ts) => [{ id: id(), title: first.content.slice(0, 120), at: Date.now(), messages: ms }, ...ts.filter((t) => t.messages[0]?.id !== ms[0]?.id)].slice(0, 30));
  }, []);

  const value: AIState = {
    messages, status, send,
    stop: () => abort.current?.abort(),
    regenerate: (mid, opts) => {
      const i = messages.findIndex((m) => m.id === mid);
      if (i > 0) {
        const q = messages[i - 1];
        const mode = opts?.mode ?? messages[i].askMode ?? q.askMode ?? askMode;
        void run(messages.slice(0, i).map((m, j) => (j === i - 1 ? { ...m, askMode: mode } : m)), mode, messages[i].focus ?? q.focus ?? focus);
      }
    },
    newChat: () => { abort.current?.abort(); archive(); setMessages([]); },
    open, setOpen,
    ask: (text, opts) => { setOpen(true); window.setTimeout(() => send(text, opts), 60); },
    pins,
    togglePin: (spec) => setPins((ps) => (ps.some((p) => specKey(p.spec) === specKey(spec)) ? ps.filter((p) => specKey(p.spec) !== specKey(spec)) : [{ id: id(), spec, at: Date.now() }, ...ps])),
    movePin: (pid, dir) => setPins((ps) => {
      const i = ps.findIndex((p) => p.id === pid), j = i + dir;
      if (i < 0 || j < 0 || j >= ps.length) return ps;
      const next = [...ps]; [next[i], next[j]] = [next[j], next[i]]; return next;
    }),
    isPinned: (spec) => pins.some((p) => specKey(p.spec) === specKey(spec)),
    configured: cfg.configured, model: cfg.model,
    askMode, setAskMode: (m) => { setAskModeState(m); write("dfm.ai.mode", m); },
    focus, setFocus: (f) => { setFocusState(f); write("dfm.ai.focus", f); },
    threads,
    openThread: (tid) => {
      const t = threads.find((x) => x.id === tid); if (!t) return;
      abort.current?.abort(); archive();
      setThreads((ts) => ts.filter((x) => x.id !== tid));
      setMessages(fix(t.messages));
    },
    deleteThread: (tid) => setThreads((ts) => ts.filter((x) => x.id !== tid)),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
