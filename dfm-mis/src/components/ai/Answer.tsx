/* Perplexity-style Ask AI: a big composer with modes and focus, and answer pages with sources, citations, steps and related questions. */
import * as React from "react";
import {
  IconArrowUp, IconArrowsLeftRight, IconBolt, IconCheck, IconChevronDown, IconCopy, IconDatabase, IconListDetails, IconMicrophone,
  IconPlayerStopFilled, IconPlus, IconRefresh, IconShare2, IconSparkles, IconTelescope, IconAlertTriangle, IconLoader2, IconCircleCheck, IconHistory, IconTrash,
  IconTruck, IconClipboardList, IconChartBar, IconBuildingWarehouse, IconReportMoney,
} from "@tabler/icons-react";
import { parseInsight } from "@/components/overtrue/insight-card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GenChart } from "./GenChart";
import { useAI, type AIMessage, type Thread } from "@/state/ai";
import { FOCUS, MODES, type AskFocus, type AskMode, type AskSource } from "@/ai/modes";
import { dataset } from "@/ai/catalog";
import { cn } from "@/lib/utils";

export const MODE_ICON: Record<AskMode, typeof IconBolt> = { quick: IconBolt, research: IconTelescope, brief: IconListDetails, compare: IconArrowsLeftRight };
const DS_ICON: Record<string, typeof IconTruck> = { trips: IconTruck, orders: IconClipboardList, sales: IconChartBar, cfa: IconBuildingWarehouse, pnl: IconReportMoney };
const dsLabel = (k: string) => dataset(k)?.label.split(" (")[0] ?? k;

/* ------------------------------- voice input -------------------------------- */
type Recognition = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void };
export function useSpeech(onText: (t: string) => void) {
  const w = (typeof window === "undefined" ? {} : window) as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  const [listening, setListening] = React.useState(false);
  const rec = React.useRef<Recognition | null>(null);
  const start = () => {
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-IN"; r.interimResults = true; r.continuous = false;
    r.onresult = (e) => onText(Array.from(e.results).map((x) => x[0].transcript).join(" "));
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r; r.start(); setListening(true);
    navigator.vibrate?.(10);
  };
  return { supported: !!Ctor, listening, start, stop: () => rec.current?.stop() };
}

/* -------------------------------- composer --------------------------------- */
export function ModePicker({ value, onChange, size = "md" }: { value: AskMode; onChange: (m: AskMode) => void; size?: "sm" | "md" }) {
  return (
    <div role="radiogroup" aria-label="Answer mode" className="flex items-center gap-0.5 rounded-full bg-muted p-0.5">
      {MODES.map((m) => {
        const I = MODE_ICON[m.key];
        const on = value === m.key;
        return (
          <button key={m.key} type="button" role="radio" aria-checked={on} title={`${m.label} — ${m.short}`} onClick={() => onChange(m.key)}
            className={cn("inline-flex items-center gap-1 rounded-full font-medium transition-all", size === "sm" ? "h-7 px-2 text-[12px]" : "h-8 px-2.5 text-[13px]",
              on ? "bg-background text-primary shadow-xs ring-1 ring-black/5 dark:ring-white/10" : "text-muted-foreground hover:text-foreground")}>
            <I className={size === "sm" ? "size-3.5" : "size-4"} stroke={2} />
            <span className={cn(!on && "sr-only")}>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function FocusPicker({ value, onChange }: { value: AskFocus; onChange: (f: AskFocus) => void }) {
  const cur = FOCUS.find((f) => f.key === value)!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Focus: ${cur.label}`} className={cn("inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium transition-colors hover:bg-muted", value !== "all" ? "text-primary" : "text-muted-foreground")}>
          <IconDatabase className="size-4" stroke={1.9} /><span className={cn(value === "all" && "sr-only sm:not-sr-only")}>{value === "all" ? "Focus" : cur.label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Focus — which data to search</DropdownMenuLabel>
        {FOCUS.map((f) => {
          const I = f.key === "all" ? IconDatabase : DS_ICON[f.key];
          return (
            <DropdownMenuItem key={f.key} onSelect={() => onChange(f.key)} className="items-start gap-2.5 py-2">
              <I className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium">{f.label}</span><span className="block text-xs text-muted-foreground">{f.description}</span></span>
              {value === f.key ? <IconCheck className="mt-0.5 size-4 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Composer({ variant, autoFocus, onSent }: { variant: "home" | "followup"; autoFocus?: boolean; onSent?: () => void }) {
  const ai = useAI()!;
  const [draft, setDraft] = React.useState("");
  const speech = useSpeech(setDraft);
  const ta = React.useRef<HTMLTextAreaElement>(null);
  const busy = ai.status === "streaming";
  React.useLayoutEffect(() => { const el = ta.current; if (!el) return; el.style.height = "0px"; el.style.height = Math.min(variant === "home" ? 168 : 120, el.scrollHeight) + "px"; }, [draft, variant]);
  const submit = () => { const t = draft.trim(); if (!t || busy) return; ai.send(t); setDraft(""); ta.current?.blur(); onSent?.(); };
  const home = variant === "home";
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }}
      className={cn("rounded-[22px] border border-border/80 bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-16px_rgb(0_0_0/0.18)] transition-shadow focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10", home ? "p-3" : "p-2 pl-3")}>
      <textarea ref={ta} value={draft} rows={1} autoFocus={autoFocus} aria-label={home ? "Ask anything" : "Ask a follow-up"}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
        placeholder={speech.listening ? "Listening…" : home ? "Ask anything about trips, orders, sales, CFA or P&L…" : "Ask a follow-up…"}
        className={cn("block w-full resize-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground", home ? "min-h-[52px] px-1 pt-1 text-[16px] leading-6" : "min-h-[28px] px-0.5 pt-1 text-[16px] leading-6")} />
      <div className={cn("flex items-center gap-1", home ? "mt-2" : "mt-1")}>
        <ModePicker value={ai.askMode} onChange={ai.setAskMode} size={home ? "md" : "sm"} />
        <FocusPicker value={ai.focus} onChange={ai.setFocus} />
        <span className="flex-1" />
        {speech.supported && !draft.trim() && !busy ? (
          <button type="button" aria-label={speech.listening ? "Stop listening" : "Ask by voice"} onClick={speech.listening ? speech.stop : speech.start}
            className={cn("flex size-9 items-center justify-center rounded-full transition-colors", speech.listening ? "mic-live bg-destructive text-white" : "text-muted-foreground hover:bg-muted")}>
            {speech.listening ? <IconPlayerStopFilled className="size-4" /> : <IconMicrophone className="size-5" stroke={1.8} />}
          </button>
        ) : null}
        {busy ? (
          <button type="button" aria-label="Stop answering" onClick={ai.stop} className="flex size-9 items-center justify-center rounded-full bg-foreground text-background"><IconPlayerStopFilled className="size-4" /></button>
        ) : (
          <button type="submit" aria-label="Ask" disabled={!draft.trim()} className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-30"><IconArrowUp className="size-5" stroke={2.4} /></button>
        )}
      </div>
    </form>
  );
}

/* ------------------------------ rich answer -------------------------------- */
function Inline({ text, onCite, k }: { text: string; onCite?: (n: number) => void; k: string }) {
  return (
    <>
      {parseInsight(text).map((seg, i) => {
        if (typeof seg !== "string") {
          return (
            <span key={k + i} className="whitespace-nowrap">
              {seg.label && seg.label !== "change" ? <strong className="font-semibold">{seg.label}</strong> : null}
              {seg.value ? <span className={cn("ml-1 rounded-md px-1.5 py-px text-[0.92em] font-semibold tabular-nums", seg.tone === "positive" ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400" : seg.tone === "negative" ? "bg-rose-500/12 text-rose-700 dark:text-rose-400" : "bg-muted text-foreground")}>{seg.value}</span> : null}
            </span>
          );
        }
        return seg.split(/(\*\*[^*]+\*\*|_[^_]+_|\[\d{1,2}\])/g).map((part, j) => {
          const key = `${k}${i}-${j}`;
          const cite = part.match(/^\[(\d{1,2})\]$/);
          if (cite) return <button key={key} type="button" onClick={() => onCite?.(Number(cite[1]))} aria-label={`Source ${cite[1]}`} className="mx-0.5 inline-flex h-[18px] min-w-[18px] -translate-y-px items-center justify-center rounded-full bg-muted px-1 align-middle text-[11px] font-medium text-muted-foreground tabular-nums hover:bg-primary hover:text-primary-foreground">{cite[1]}</button>;
          if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={key} className="font-semibold">{part.slice(2, -2)}</strong>;
          if (part.startsWith("_") && part.endsWith("_") && part.length > 2) return <em key={key} className="text-muted-foreground">{part.slice(1, -1)}</em>;
          return <React.Fragment key={key}>{part}</React.Fragment>;
        });
      })}
    </>
  );
}

/** Markdown-lite: "## " headings, "- " bullets, paragraphs, metric tokens and [n] citations. */
export function RichAnswer({ text, onCite, className }: { text: string; onCite?: (n: number) => void; className?: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (key: string) => { if (list.length) { blocks.push(<ul key={key} className="m-0 flex list-none flex-col gap-1.5 p-0">{list.map((l, i) => <li key={i} className="relative pl-4 before:absolute before:top-[0.6em] before:left-1 before:size-1.5 before:rounded-full before:bg-primary/60"><Inline text={l} onCite={onCite} k={`${key}-${i}-`} /></li>)}</ul>); list = []; } };
  text.split("\n").forEach((raw, i) => {
    const line = raw.trimEnd();
    if (/^\s*[-•*] /.test(line)) { list.push(line.replace(/^\s*[-•*] /, "")); return; }
    flush("l" + i);
    if (!line.trim()) return;
    if (/^#{1,3} /.test(line)) blocks.push(<h3 key={i} className="m-0 mt-2 text-[15px] font-semibold tracking-tight">{line.replace(/^#{1,3} /, "")}</h3>);
    else blocks.push(<p key={i} className="m-0"><Inline text={line} onCite={onCite} k={`p${i}-`} /></p>);
  });
  flush("end");
  return <div className={cn("flex flex-col gap-2.5 text-[15.5px] leading-[1.6] text-foreground", className)}>{blocks}</div>;
}

/* --------------------------------- sources --------------------------------- */
function SourceCard({ s, active, onClick, wide }: { s: AskSource; active?: boolean; onClick?: () => void; wide?: boolean }) {
  const I = DS_ICON[s.dataset] ?? IconDatabase;
  return (
    <button type="button" onClick={onClick} id={undefined}
      className={cn("flex shrink-0 flex-col gap-1 rounded-xl bg-muted/60 p-2.5 text-left transition-colors hover:bg-muted", wide ? "w-full" : "w-[168px]", active && "ring-2 ring-primary")}>
      <span className="line-clamp-2 text-[12.5px] leading-[1.3] font-medium text-foreground">{s.title}</span>
      <span className="mt-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <I className="size-3.5 shrink-0" /><span className="truncate">{dsLabel(s.dataset)}</span>
        <span className="ml-auto flex size-4 shrink-0 items-center justify-center rounded-full bg-background text-[10px] font-medium tabular-nums">{s.id}</span>
      </span>
    </button>
  );
}

/* ---------------------------------- turn ----------------------------------- */
type Tab = "answer" | "sources" | "steps";

const WORKING: Record<AskMode, string[]> = {
  quick: ["Reading the question", "Querying live MIS data", "Writing the answer"],
  research: ["Planning the analysis", "Querying the headline number", "Checking the trend by month", "Breaking it down to find the drivers", "Cross-checking outliers", "Writing the report"],
  brief: ["Reading the question", "Pulling the key figures", "Writing the brief"],
  compare: ["Reading the question", "Querying both periods", "Finding the biggest movers", "Writing the comparison"],
};

function Working({ mode }: { mode: AskMode }) {
  const steps = WORKING[mode];
  const [i, setI] = React.useState(0);
  React.useEffect(() => { const t = window.setInterval(() => setI((x) => Math.min(steps.length - 1, x + 1)), mode === "research" ? 1600 : 900); return () => window.clearInterval(t); }, [steps.length, mode]);
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13.5px]">
        {steps.slice(0, i + 1).map((s, j) => (
          <li key={s} className={cn("flex items-center gap-2", j < i ? "text-muted-foreground" : "text-foreground")}>
            {j < i ? <IconCircleCheck className="size-4 text-emerald-500" /> : <IconLoader2 className="size-4 animate-spin text-primary" />}{s}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2" aria-hidden>
        {[92, 100, 76].map((w, j) => <div key={j} className="h-3 animate-pulse rounded-full bg-muted" style={{ width: `${w}%`, animationDelay: `${j * 120}ms` }} />)}
      </div>
    </div>
  );
}

export function Turn({ q, a, last, compact, onAsk }: { q: AIMessage; a?: AIMessage; last: boolean; compact?: boolean; onAsk: (text: string) => void }) {
  const ai = useAI()!;
  const [tab, setTab] = React.useState<Tab>("answer");
  const [hl, setHl] = React.useState<number | null>(null);
  const [copied, setCopied] = React.useState(false);
  const mode = (a?.askMode ?? q.askMode ?? "quick") as AskMode;
  const focus = (a?.focus ?? q.focus ?? "all") as AskFocus;
  const ModeI = MODE_ICON[mode];
  const sources = a?.sources ?? [];
  const steps = (a?.steps ?? []).filter((s) => s.kind === "query");
  const streaming = a?.status === "streaming";
  const cite = (n: number) => { setHl(n); setTab("sources"); window.setTimeout(() => document.getElementById(`${q.id}-src-${n}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 60); };
  const plainText = (a?.content ?? "").replace(/\{\{metric:([^|}]*)\|?([^|}]*)\|?[^}]*\}\}/g, (_m, x, y) => [x === "change" ? "" : x, y].filter(Boolean).join(" ")).replace(/\*\*/g, "");
  const copy = async () => { try { await navigator.clipboard.writeText(`${q.content}\n\n${plainText}`); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } };
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <article className="flex flex-col gap-3" aria-label={q.content}>
      <h2 className={cn("m-0 font-semibold tracking-[-0.02em] text-foreground", compact ? "text-[21px] leading-7" : "text-[26px] leading-8")}>{q.content}</h2>
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/8 px-2 py-0.5 font-medium text-primary"><ModeI className="size-3.5" />{MODES.find((m) => m.key === mode)?.label}</span>
        {focus !== "all" ? <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5"><IconDatabase className="size-3.5" />{FOCUS.find((f) => f.key === focus)?.label}</span> : null}
        {a?.mode === "offline" ? <span>· offline</span> : null}
      </div>

      <div role="tablist" aria-label="Answer views" className="sticky top-0 z-10 -mx-1 flex gap-1 border-b border-border/70 bg-background/95 px-1 backdrop-blur">
        {([["answer", "Answer", IconSparkles], ["sources", `Sources${sources.length ? ` · ${sources.length}` : ""}`, IconDatabase], ["steps", `Steps${steps.length ? ` · ${steps.length}` : ""}`, IconListDetails]] as const).map(([k, label, I]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn("-mb-px inline-flex h-10 items-center gap-1.5 border-b-2 px-2 text-[13.5px] font-medium transition-colors", tab === k ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <I className="size-4" />{label}
          </button>
        ))}
      </div>

      {!a || streaming ? <Working mode={mode} /> : a.status === "error" ? (
        <div className="flex items-start gap-2 rounded-xl bg-rose-500/8 p-3 text-[14px] text-rose-700 dark:text-rose-400">
          <IconAlertTriangle className="mt-0.5 size-4" /><span className="flex-1">I couldn’t answer that just now.</span>
          <button type="button" onClick={() => ai.regenerate(a.id)} className="font-medium underline-offset-4 hover:underline">Try again</button>
        </div>
      ) : tab === "answer" ? (
        <div className="flex flex-col gap-4">
          {sources.length ? (
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              {sources.slice(0, 4).map((s) => <SourceCard key={s.id} s={s} onClick={() => cite(s.id)} />)}
              {sources.length > 4 ? <button type="button" onClick={() => setTab("sources")} className="flex w-[110px] shrink-0 flex-col justify-center rounded-xl bg-muted/60 p-2.5 text-left text-[12px] text-muted-foreground hover:bg-muted"><span className="text-[13px] font-medium text-foreground">+{sources.length - 4} more</span>View all sources</button> : null}
            </div>
          ) : null}
          <RichAnswer text={a.content} onCite={cite} />
          {a.charts?.map((c, i) => <GenChart key={`${a.id}-${i}`} spec={c} compact={compact} pinned={ai.isPinned(c)} onPin={() => ai.togglePin(c)} className="rounded-2xl" />)}
          <div className="flex flex-wrap items-center gap-1 border-t border-border/60 pt-2 text-[13px] text-muted-foreground">
            {canShare ? <button type="button" onClick={() => navigator.share({ title: q.content, text: plainText }).catch(() => undefined)} className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 hover:bg-muted hover:text-foreground"><IconShare2 className="size-4" />Share</button> : null}
            <button type="button" onClick={copy} className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 hover:bg-muted hover:text-foreground">{copied ? <IconCheck className="size-4 text-emerald-500" /> : <IconCopy className="size-4" />}{copied ? "Copied" : "Copy"}</button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 hover:bg-muted hover:text-foreground" disabled={ai.status === "streaming"}><IconRefresh className="size-4" />Rewrite<IconChevronDown className="size-3.5" /></button></DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Answer again as…</DropdownMenuLabel>
                {MODES.map((m) => { const I = MODE_ICON[m.key]; return <DropdownMenuItem key={m.key} onSelect={() => ai.regenerate(a.id, { mode: m.key })} className="gap-2"><I className="size-4" /><span className="flex-1">{m.label}</span><span className="text-xs text-muted-foreground">{m.short}</span></DropdownMenuItem>; })}
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="ml-auto text-[12px]">{steps.length} {steps.length === 1 ? "query" : "queries"} on live data</span>
          </div>
          {last && a.followUps?.length ? (
            <section aria-label="Related questions" className="flex flex-col">
              <h3 className="m-0 mb-1 flex items-center gap-1.5 text-[15px] font-semibold"><IconListDetails className="size-4" />Related</h3>
              <ul className="m-0 list-none divide-y divide-border/70 p-0">
                {a.followUps.map((f) => (
                  <li key={f}><button type="button" onClick={() => onAsk(f)} disabled={ai.status === "streaming"} className="group flex w-full items-center gap-3 py-3 text-left text-[15px] text-foreground disabled:opacity-50">
                    <span className="flex-1">{f}</span><IconPlus className="size-4 shrink-0 text-primary transition-transform group-hover:rotate-90" />
                  </button></li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : tab === "sources" ? (
        sources.length ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {sources.map((s) => (
              <li key={s.id} id={`${q.id}-src-${s.id}`} className={cn("rounded-xl border border-border/70 p-3 transition-shadow", hl === s.id && "ring-2 ring-primary")}>
                <div className="flex items-start gap-2.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-medium tabular-nums">{s.id}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium">{s.title}</div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">{dsLabel(s.dataset)} · {s.detail} · {s.rows.toLocaleString("en-IN")} records</div>
                  </div>
                </div>
                {hl === s.id ? <GenChart spec={s.spec} compact className="mt-3 rounded-xl shadow-none" /> : <button type="button" onClick={() => setHl(s.id)} className="mt-2 text-[12px] font-medium text-primary">Show the data</button>}
              </li>
            ))}
          </ul>
        ) : <p className="m-0 text-[14px] text-muted-foreground">No data was queried for this answer.</p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-0 p-0">
          {(a.steps ?? []).map((s, i) => (
            <li key={s.id} className="relative flex gap-3 pb-3 pl-0">
              <span className="relative flex flex-col items-center">
                {s.status === "error" ? <IconAlertTriangle className="size-5 text-amber-500" /> : <IconCircleCheck className="size-5 text-emerald-500" />}
                {i < (a.steps?.length ?? 0) - 1 ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
              </span>
              <span className="min-w-0 flex-1 pb-1"><span className="block text-[14px]">{s.label}</span>{s.detail ? <span className="block font-mono text-[11.5px] text-muted-foreground">{s.detail}</span> : null}</span>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

/** All turns of the current thread. */
export function ThreadView({ compact, onAsk }: { compact?: boolean; onAsk?: (t: string) => void }) {
  const ai = useAI()!;
  const pairs: { q: AIMessage; a?: AIMessage }[] = [];
  ai.messages.forEach((m) => {
    if (m.role === "user") pairs.push({ q: m as AIMessage });
    else if (pairs.length && !pairs[pairs.length - 1].a) pairs[pairs.length - 1].a = m as AIMessage;
  });
  const ask = onAsk ?? ((t: string) => ai.send(t));
  return (
    <div className="flex flex-col gap-10">
      {pairs.map((p, i) => <div key={p.q.id} className={cn(i > 0 && "border-t border-border/70 pt-8")}><Turn q={p.q} a={p.a} last={i === pairs.length - 1} compact={compact} onAsk={ask} /></div>)}
    </div>
  );
}

/* --------------------------------- library --------------------------------- */
export function LibraryList({ threads, onOpen, onDelete, limit }: { threads: Thread[]; onOpen: (id: string) => void; onDelete?: (id: string) => void; limit?: number }) {
  const list = limit ? threads.slice(0, limit) : threads;
  if (!list.length) return <p className="m-0 text-[13px] text-muted-foreground">Your past threads will appear here.</p>;
  return (
    <ul className="m-0 list-none divide-y divide-border/60 p-0">
      {list.map((t) => {
        const a = t.messages.find((m) => m.role === "assistant") as AIMessage | undefined;
        const mode = (t.messages[0] as AIMessage)?.askMode ?? "quick";
        const I = MODE_ICON[mode as AskMode];
        const preview = (a?.content ?? "").replace(/\{\{metric:([^|}]*)\|?([^|}]*)\|?[^}]*\}\}/g, "$1 $2").replace(/\[\d+\]|\*\*|##|^- /gm, "").trim();
        return (
          <li key={t.id} className="group flex items-start gap-2">
            <button type="button" onClick={() => onOpen(t.id)} className="min-w-0 flex-1 py-2.5 text-left">
              <span className="flex items-center gap-1.5 text-[14px] font-medium"><I className="size-3.5 shrink-0 text-primary" /><span className="truncate">{t.title}</span></span>
              {preview ? <span className="mt-0.5 line-clamp-1 text-[12.5px] text-muted-foreground">{preview}</span> : null}
              <span className="mt-0.5 block text-[11px] text-muted-foreground">{new Date(t.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {(() => { const n = t.messages.filter((m) => m.role === "user").length; return `${n} ${n === 1 ? "question" : "questions"}`; })()}</span>
            </button>
            {onDelete ? <button type="button" aria-label={`Delete thread ${t.title}`} onClick={() => onDelete(t.id)} className="mt-2.5 rounded-md p-1 text-muted-foreground opacity-60 hover:bg-muted hover:opacity-100"><IconTrash className="size-4" /></button> : null}
          </li>
        );
      })}
    </ul>
  );
}

export { IconHistory };
