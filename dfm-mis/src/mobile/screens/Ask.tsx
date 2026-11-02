/**
 * Phone Ask tab, Perplexity-style: a home screen with one big composer (modes + focus), and threads where each
 * question is a heading with Answer / Sources / Steps tabs, inline citations and related questions.
 */
import * as React from "react";
import { IconArrowRight, IconChartBar, IconClipboardList, IconHistory, IconPlus, IconReportMoney, IconTruck, IconBuildingWarehouse, IconX } from "@tabler/icons-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Composer, LibraryList, MODE_ICON, ThreadView } from "@/components/ai/Answer";
import { useAI } from "@/state/ai";
import { useApp } from "@/state/app";
import { MODES, type AskMode } from "@/ai/modes";
import { CUR_MONTH, orders, trips } from "@/data/data";
import { sum } from "@/data/format";
import { monthContext } from "@/data/sales";
import { tripEta } from "@/pages/trips/timeline";
import { isIOS, isStandalone } from "../install";
import { cn } from "@/lib/utils";

const TRY: { q: string; icon: typeof IconTruck }[] = [
  { q: "Which transporters cost the most per km?", icon: IconTruck },
  { q: "OTIF by destination this month", icon: IconClipboardList },
  { q: "Top 5 ASMs by achievement", icon: IconChartBar },
  { q: "CFA throughput by day", icon: IconBuildingWarehouse },
  { q: "Material margin % by account", icon: IconReportMoney },
];

export default function AskScreen() {
  const ai = useAI()!;
  const { user } = useApp();
  const [library, setLibrary] = React.useState(false);
  const scroller = React.useRef<HTMLDivElement>(null);
  const [iosHint, setIosHint] = React.useState(() => { try { return isIOS() && !isStandalone() && !localStorage.getItem("dfm.iosHint"); } catch { return false; } });
  const chatting = ai.messages.length > 0;
  const busy = ai.status === "streaming";

  // New question → bring its heading to the top of the screen (like Perplexity); otherwise stay put.
  const qCount = ai.messages.filter((m) => m.role === "user").length;
  React.useEffect(() => {
    const el = scroller.current; if (!el) return;
    if (!qCount) { el.scrollTop = 0; return; }
    const arts = el.querySelectorAll("article");
    const lastArt = arts[arts.length - 1] as HTMLElement | undefined;
    const go = () => lastArt?.scrollIntoView({ block: "start", behavior: "smooth" });
    const t1 = window.setTimeout(go, 40), t2 = window.setTimeout(go, 400);
    navigator.vibrate?.(8);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [qCount]);

  const ask = (q: string, mode?: AskMode) => { if (!busy) ai.send(q, mode ? { mode } : undefined); };
  const active = trips.filter((t) => t.stage !== "epod_done");
  const late = active.filter((t) => tripEta(t)?.late).length;
  const mtd = orders.filter((o) => o.mk === CUR_MONTH && o.otif != null);
  const otif = (sum(mtd, (o) => o.otif! * o.qty) / (sum(mtd, "qty") || 1)) * 100;
  const mc = monthContext();
  const first = user?.name.split(" ")[0] ?? "there";
  const modeInfo = MODES.find((m) => m.key === ai.askMode)!;
  const title = ai.messages.find((m) => m.role === "user")?.content;

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <header className="pt-safe shrink-0 border-b border-transparent bg-background/90 backdrop-blur-md data-[chat=true]:border-border/60" data-chat={chatting}>
        <div className="grid h-12 grid-cols-[44px_1fr_44px] items-center px-1.5">
          {chatting ? (
            <button type="button" aria-label="New thread" onClick={() => ai.newChat()} className="flex size-10 items-center justify-center rounded-full text-foreground active:bg-muted"><IconPlus className="size-[22px]" stroke={1.9} /></button>
          ) : <img src="/brand/crax-logo.png" alt="CRAX" className="mx-auto h-7 w-auto" />}
          <div className="min-w-0 text-center">
            {chatting ? <p className="m-0 truncate text-[15px] font-semibold">{title}</p> : (
              <p className="m-0 flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground">
                <span className={cn("size-1.5 rounded-full", ai.configured ? "bg-emerald-500" : "bg-amber-500")} />{ai.configured ? "Claude · live MIS data" : "Offline mode · live MIS data"}
              </p>
            )}
          </div>
          <button type="button" aria-label={`Library (${ai.threads.length} threads)`} onClick={() => setLibrary(true)} className="relative flex size-10 items-center justify-center rounded-full text-foreground active:bg-muted">
            <IconHistory className="size-[22px]" stroke={1.8} />
          </button>
        </div>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {chatting ? (
          <div className="px-4 pt-4 pb-6"><ThreadView compact onAsk={(t) => ask(t)} /></div>
        ) : (
          <div className="flex min-h-full flex-col px-4 pt-[6vh] pb-6">
            <div className="mb-5 text-center">
              <h1 className="m-0 text-[30px] leading-9 font-semibold tracking-[-0.03em]">Ask DFM</h1>
              <p className="m-0 mt-1 text-[14px] text-muted-foreground">Hi {first} — where knowledge of your supply chain begins.</p>
            </div>
            <Composer variant="home" />
            <p className="m-0 mt-2 px-2 text-center text-[12px] leading-[1.45] text-muted-foreground">
              <span className="inline-flex items-center gap-1 align-[-2px] font-medium text-foreground">{React.createElement(MODE_ICON[ai.askMode], { className: "size-3.5 text-primary" })}{modeInfo.label}</span> — {modeInfo.description}
            </p>

            <section className="mt-6" aria-label="Today’s highlights">
              <h2 className="m-0 mb-2 text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">Today</h2>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { k: `${late}`, l: "trips behind plan", tone: late ? "text-rose-600 dark:text-rose-400" : "", q: "Which trips are behind plan and why?", m: "research" as AskMode },
                  { k: `${otif.toFixed(1)}%`, l: "OTIF this month", tone: "", q: "OTIF this month vs last month", m: "compare" as AskMode },
                  { k: `${Math.round((mc.mtd.sales / mc.mTarget) * 100)}%`, l: "of sales target", tone: "", q: "Brief me on sales vs target this month", m: "brief" as AskMode },
                ].map((c) => {
                  const I = MODE_ICON[c.m];
                  return (
                    <button key={c.l} type="button" onClick={() => ask(c.q, c.m)} className="flex flex-col items-start gap-0.5 rounded-xl bg-muted/60 p-2.5 text-left active:scale-[0.98]">
                      <span className={cn("text-[19px] leading-6 font-semibold tracking-tight tabular-nums", c.tone)}>{c.k}</span>
                      <span className="text-[11.5px] leading-tight text-muted-foreground">{c.l}</span>
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary"><I className="size-3" />{MODES.find((m) => m.key === c.m)?.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-6" aria-label="Try asking">
              <h2 className="m-0 mb-1 text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">Try asking</h2>
              <ul className="m-0 list-none divide-y divide-border/60 p-0">
                {TRY.map(({ q, icon: I }) => (
                  <li key={q}><button type="button" onClick={() => ask(q)} className="flex w-full items-center gap-3 py-3 text-left text-[15px] active:opacity-70">
                    <I className="size-[18px] shrink-0 text-muted-foreground" stroke={1.8} /><span className="flex-1">{q}</span><IconArrowRight className="size-4 text-muted-foreground" />
                  </button></li>
                ))}
              </ul>
            </section>

            {ai.threads.length ? (
              <section className="mt-6" aria-label="Recent threads">
                <div className="mb-1 flex items-center justify-between"><h2 className="m-0 text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">Recent</h2><button type="button" onClick={() => setLibrary(true)} className="text-[13px] font-medium text-primary">Library</button></div>
                <LibraryList threads={ai.threads} onOpen={ai.openThread} limit={3} />
              </section>
            ) : null}

            {iosHint ? (
              <div className="mt-6 flex items-start gap-3 rounded-xl bg-muted/60 px-3.5 py-3 text-[14px] leading-snug">
                <span className="flex-1">Install the app: tap <b>Share</b> in Safari, then <b>Add to Home Screen</b>.</span>
                <button type="button" aria-label="Dismiss" onClick={() => { setIosHint(false); try { localStorage.setItem("dfm.iosHint", "1"); } catch { /* ignore */ } }} className="-m-1 p-1"><IconX className="size-4 text-muted-foreground" /></button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {chatting ? <div className="shrink-0 bg-gradient-to-t from-background via-background to-background/0 px-3 pt-2 pb-2.5"><Composer variant="followup" /></div> : null}

      <Sheet open={library} onOpenChange={setLibrary}>
        <SheetContent side="bottom" className="pb-safe max-h-[85dvh] gap-0 rounded-t-2xl p-0">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden />
          <SheetHeader className="px-4 pt-3 pb-1"><SheetTitle className="text-base">Library</SheetTitle><SheetDescription>{ai.threads.length} earlier threads on this device</SheetDescription></SheetHeader>
          <div className="overflow-y-auto px-4 pb-4"><LibraryList threads={ai.threads} onOpen={(id) => { ai.openThread(id); setLibrary(false); }} onDelete={ai.deleteThread} /></div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
