/**
 * Phone chat (Ask tab). iOS-style messaging layout:
 * grey canvas · centred title bar · "Today" divider · bubbles · pill question chips · pill composer.
 * Sizes follow iOS proportions: 16px side margins, 17px body, 15px chips, 13px captions, 44px tap targets.
 */
import * as React from "react";
import {
  IconArrowBackUp, IconArrowUp, IconChevronDown, IconChevronRight, IconMicrophone, IconPlayerStopFilled, IconPlus, IconX,
} from "@tabler/icons-react";
import { parseInsight } from "@/components/overtrue/insight-card";
import { GenChart } from "@/components/ai/GenChart";
import { useAI, type AIMessage } from "@/state/ai";
import { useApp } from "@/state/app";
import { CUR_MONTH, orders, trips } from "@/data/data";
import { sum } from "@/data/format";
import { monthContext } from "@/data/sales";
import { tripEta } from "@/pages/trips/timeline";
import { isIOS, isStandalone } from "../install";
import { cn } from "@/lib/utils";

const COMMON = [
  "Which transporters cost the most per km?",
  "OTIF by destination this month",
  "Top 5 ASMs by achievement",
];
const MORE: { group: string; qs: string[] }[] = [
  { group: "Trips", qs: ["Detention rate by month", "Tracking adherence by transporter", "Freight by destination and fleet"] },
  { group: "Orders", qs: ["Open orders by stage", "Approval to dispatch hours by month"] },
  { group: "Sales", qs: ["Sales by brand and channel", "Achievement by zone this month"] },
  { group: "Supply & finance", qs: ["CFA throughput by day", "Material margin % by account"] },
];

/* ------------------------------- voice input -------------------------------- */
type Recognition = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void };
function useSpeech(onText: (t: string) => void) {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
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

/* ------------------------------ rich text --------------------------------- */
/** Renders {{metric:…}} tokens as highlighted figures plus **bold** / _italic_ markdown. */
function Rich({ text }: { text: string }) {
  const inline = (s: string, key: string) =>
    s.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((part, i) =>
      part.startsWith("**") ? <strong key={key + i} className="font-semibold">{part.slice(2, -2)}</strong>
        : part.startsWith("_") && part.endsWith("_") && part.length > 2 ? <em key={key + i} className="text-muted-foreground">{part.slice(1, -1)}</em>
          : <React.Fragment key={key + i}>{part}</React.Fragment>);
  return (
    <>
      {text.split(/\n{2,}/).map((para, pi) => (
        <p key={pi} className="m-0 [&+&]:mt-2.5">
          {parseInsight(para).map((seg, i) => typeof seg === "string" ? inline(seg, `${pi}-${i}-`) : (
            <span key={`${pi}-${i}`} className="whitespace-nowrap">
              {seg.label ? <strong className="font-semibold">{seg.label}</strong> : null}
              {seg.value ? (
                <span className={cn("ml-1 rounded-md px-1.5 py-px text-[15px] font-semibold tabular-nums",
                  seg.tone === "positive" ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400" : seg.tone === "negative" ? "bg-rose-500/12 text-rose-700 dark:text-rose-400" : "bg-muted text-foreground")}>{seg.value}</span>
              ) : null}
            </span>
          ))}
        </p>
      ))}
    </>
  );
}

/* -------------------------------- pieces ---------------------------------- */
function Chip({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="chat-bubble inline-flex min-h-11 max-w-full items-center gap-3 rounded-full py-2.5 pr-4 pl-5 text-left text-[15px] leading-snug text-foreground ring-1 ring-black/[0.06] transition-transform active:scale-[0.98] disabled:opacity-50 dark:ring-white/10">
      <span className="min-w-0">{children}</span>
      <IconChevronRight className="size-4 shrink-0" stroke={2.5} />
    </button>
  );
}

function AssistantBubble({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("chat-bubble max-w-[88%] self-start rounded-[18px] rounded-bl-md px-4 py-3 text-[17px] leading-[1.4] text-foreground", className)}>{children}</div>;
}

function Typing() {
  return (
    <div className="chat-bubble flex h-11 items-center gap-1 self-start rounded-[18px] rounded-bl-md px-4" role="status" aria-label="Assistant is answering">
      {[0, 1, 2].map((i) => <span key={i} className="size-2 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${i * 140}ms`, animationDuration: "900ms" }} />)}
    </div>
  );
}

/* --------------------------------- screen ---------------------------------- */
export default function AskScreen() {
  const ai = useAI()!;
  const { user } = useApp();
  const [draft, setDraft] = React.useState("");
  const [showMore, setShowMore] = React.useState(false);
  const speech = useSpeech(setDraft);
  const scroller = React.useRef<HTMLDivElement>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const [iosHint, setIosHint] = React.useState(() => { try { return isIOS() && !isStandalone() && !localStorage.getItem("dfm.iosHint"); } catch { return false; } });

  const busy = ai.status === "streaming";
  const chatting = ai.messages.length > 0;

  // Keep the newest message in view.
  // Start screen opens at the top; in a conversation, follow the newest message (again once charts have laid out).
  React.useEffect(() => {
    const el = scroller.current; if (!el) return;
    if (!ai.messages.length) { el.scrollTop = 0; return; }
    const go = () => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    go();
    const t = window.setTimeout(go, 450);
    return () => window.clearTimeout(t);
  }, [ai.messages, busy]);
  const prev = React.useRef(ai.messages.length);
  React.useEffect(() => { if (ai.messages.length > prev.current) navigator.vibrate?.(8); prev.current = ai.messages.length; }, [ai.messages.length]);

  const send = (q: string) => { const t = q.trim(); if (!t || busy) return; ai.send(t); setDraft(""); setShowMore(false); input.current?.blur(); };

  const active = trips.filter((t) => t.stage !== "epod_done");
  const late = active.filter((t) => tripEta(t)?.late).length;
  const mtd = orders.filter((o) => o.mk === CUR_MONTH && o.otif != null);
  const otif = (sum(mtd, (o) => o.otif! * o.qty) / (sum(mtd, "qty") || 1)) * 100;
  const mc = monthContext();
  const first = user?.name.split(" ")[0] ?? "there";
  const last = [...ai.messages].reverse().find((m) => m.role === "assistant") as AIMessage | undefined;

  return (
    <div className="chat-canvas absolute inset-0 flex flex-col">
      {/* Title bar: 44px nav row, centred title, 44px side buttons */}
      <header className="pt-safe chat-canvas shrink-0">
        <div className="grid h-14 grid-cols-[44px_1fr_44px] items-center px-2">
          {chatting ? (
            <button type="button" aria-label="Back to start (new chat)" onClick={() => { ai.newChat(); setDraft(""); }} className="flex size-11 items-center justify-center rounded-full text-foreground active:bg-black/5 dark:active:bg-white/10">
              <IconArrowBackUp className="size-6" stroke={1.8} />
            </button>
          ) : (
            <img src="/brand/crax-logo.png" alt="CRAX" className="mx-auto h-8 w-auto" />
          )}
          <div className="text-center">
            <h1 className="m-0 text-[17px] leading-tight font-semibold tracking-tight">Ask DFM</h1>
            <p className="m-0 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
              <span className={cn("size-1.5 rounded-full", ai.configured ? "bg-emerald-500" : "bg-amber-500")} />
              {ai.configured ? "AI assistant · live data" : "Offline mode · live data"}
            </p>
          </div>
          <span aria-hidden />
        </div>
      </header>

      {/* Conversation */}
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
        <p className="m-0 pt-3 pb-4 text-center text-[15px] text-muted-foreground">Today</p>

        <div className="flex flex-col gap-3">
          <AssistantBubble>
            <p className="m-0">Hi {first}, ask me anything about trips, orders, sales, CFAs or the P&amp;L — I’ll answer with a chart. How can I help?</p>
            <p className="m-0 mt-2 text-[15px] leading-snug text-muted-foreground">
              Right now: <span className={cn("font-semibold", late ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>{late} trips behind plan</span> · OTIF <span className="font-semibold text-foreground">{otif.toFixed(1)}%</span> · sales at <span className="font-semibold text-foreground">{Math.round((mc.mtd.sales / mc.mTarget) * 100)}%</span> of target
            </p>
          </AssistantBubble>

          {!chatting ? (
            <div className="flex flex-col items-start gap-2.5 pt-1">
              <p className="m-0 px-5 pt-1 text-[13px] text-foreground/80">Common questions:</p>
              {COMMON.map((q) => <Chip key={q} onClick={() => send(q)}>{q}</Chip>)}
              <button type="button" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore}
                className="inline-flex min-h-11 items-center gap-1 px-5 text-[15px] font-medium text-primary">
                {showMore ? <>Fewer questions <IconChevronDown className="size-4 rotate-180" /></> : <>Explore more questions <IconPlus className="size-4" stroke={2.2} /></>}
              </button>
              {showMore ? (
                <div className="flex w-full flex-col gap-4 pb-2">
                  {MORE.map((g) => (
                    <div key={g.group} className="flex flex-col items-start gap-2.5">
                      <p className="m-0 px-5 text-[13px] text-muted-foreground">{g.group}</p>
                      {g.qs.map((q) => <Chip key={q} onClick={() => send(q)}>{q}</Chip>)}
                    </div>
                  ))}
                </div>
              ) : null}
              {iosHint ? (
                <div className="chat-bubble mt-2 flex w-full items-start gap-3 rounded-[18px] px-4 py-3 text-[15px] leading-snug">
                  <span className="flex-1">Install the app: tap <b>Share</b> in Safari, then <b>Add to Home Screen</b>.</span>
                  <button type="button" aria-label="Dismiss" onClick={() => { setIosHint(false); try { localStorage.setItem("dfm.iosHint", "1"); } catch { /* ignore */ } }} className="-m-1 p-1"><IconX className="size-4 text-muted-foreground" /></button>
                </div>
              ) : null}
            </div>
          ) : null}

          {ai.messages.map((m) => {
            const msg = m as AIMessage;
            if (msg.role === "user") {
              return <div key={msg.id} className="max-w-[80%] self-end rounded-[18px] rounded-br-md bg-primary px-4 py-2.5 text-[17px] leading-[1.35] text-primary-foreground">{msg.content}</div>;
            }
            if (msg.status === "streaming") return <Typing key={msg.id} />;
            if (msg.status === "error") {
              return (
                <AssistantBubble key={msg.id}>
                  <p className="m-0">I couldn’t answer that just now.</p>
                  <button type="button" onClick={() => ai.regenerate(msg.id)} className="mt-1 text-[15px] font-medium text-primary">Try again</button>
                </AssistantBubble>
              );
            }
            const queries = (msg.steps ?? []).filter((s) => s.kind === "query").length;
            return (
              <div key={msg.id} className="flex flex-col gap-2">
                <AssistantBubble><Rich text={msg.content} /></AssistantBubble>
                {queries ? <p className="m-0 px-1 text-[12px] text-muted-foreground">Checked {queries} {queries === 1 ? "query" : "queries"} on live MIS data{msg.mode === "offline" ? " · offline mode" : ""}</p> : null}
                {msg.charts?.map((c, i) => (
                  <GenChart key={i} spec={c} compact className="chat-bubble rounded-[18px] border-0 shadow-none ring-1 ring-black/[0.04] dark:ring-white/10" pinned={ai.isPinned(c)} onPin={() => ai.togglePin(c)} />
                ))}
                {msg.id === last?.id && msg.followUps?.length ? (
                  <div className="flex flex-col items-start gap-2.5 pt-1">
                    <p className="m-0 px-5 text-[13px] text-foreground/80">You could also ask:</p>
                    {msg.followUps.map((f) => <Chip key={f} onClick={() => send(f)} disabled={busy}>{f}</Chip>)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Composer: 44px pill, mic when empty, send when typing */}
      <form className="chat-canvas shrink-0 px-4 pt-2 pb-3" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
        <div className="chat-bubble flex h-11 items-center gap-1 rounded-full pr-1 pl-5 ring-1 ring-black/[0.05] focus-within:ring-2 focus-within:ring-primary/30 dark:ring-white/10">
          <input ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={speech.listening ? "Listening…" : "Type a message"}
            enterKeyHint="send" autoComplete="off" aria-label="Message"
            className="h-full min-w-0 flex-1 bg-transparent text-[17px] text-foreground outline-none placeholder:text-muted-foreground" />
          {draft.trim() ? (
            <button type="submit" aria-label="Send" disabled={busy} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40">
              <IconArrowUp className="size-5" stroke={2.4} />
            </button>
          ) : speech.supported ? (
            <button type="button" aria-label={speech.listening ? "Stop listening" : "Ask by voice"} onClick={speech.listening ? speech.stop : speech.start}
              className={cn("flex size-9 shrink-0 items-center justify-center rounded-full transition-colors", speech.listening ? "mic-live bg-destructive text-white" : "text-muted-foreground")}>
              {speech.listening ? <IconPlayerStopFilled className="size-4" /> : <IconMicrophone className="size-[22px]" stroke={1.8} />}
            </button>
          ) : null}
          {busy ? (
            <button type="button" aria-label="Stop answering" onClick={ai.stop} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground/80 text-background">
              <IconPlayerStopFilled className="size-4" />
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
