import * as React from "react";
import { IconArrowRight, IconChartBar, IconClipboardList, IconPlus, IconReportMoney, IconTruck, IconBuildingWarehouse, IconHistory } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Composer, LibraryList, MODE_ICON, ThreadView } from "@/components/ai/Answer";
import { useAI } from "@/state/ai";
import { MODES, type AskMode } from "@/ai/modes";
import { cn } from "@/lib/utils";

const TRY: { q: string; icon: typeof IconTruck; mode?: AskMode }[] = [
  { q: "Why is freight cost per km rising, and what should we do?", icon: IconTruck, mode: "research" },
  { q: "OTIF this month vs last month by plant", icon: IconClipboardList, mode: "compare" },
  { q: "Brief me on sales vs target this month", icon: IconChartBar, mode: "brief" },
  { q: "Which transporters cost the most per km?", icon: IconTruck },
  { q: "CFA throughput by day", icon: IconBuildingWarehouse },
  { q: "Material margin % by account", icon: IconReportMoney },
];

/** Perplexity-style Ask AI page: library on the left, a centred thread with a sticky follow-up composer. */
export default function Ask() {
  const ai = useAI()!;
  React.useEffect(() => { ai.setOpen(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const chatting = ai.messages.length > 0;
  const qCount = ai.messages.filter((m) => m.role === "user").length;
  React.useEffect(() => {
    if (!qCount) return;
    const arts = document.querySelectorAll("[data-slot=ask-thread] article");
    (arts[arts.length - 1] as HTMLElement | undefined)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [qCount]);
  const mode = MODES.find((m) => m.key === ai.askMode)!;

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden xl:block">
        <div className="sticky top-20 flex flex-col gap-3">
          <Button variant="outline" className="justify-start gap-2 rounded-full" onClick={() => ai.newChat()}><IconPlus className="size-4" /> New thread <kbd className="ml-auto rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">⌘J</kbd></Button>
          <div className="flex items-center gap-1.5 px-1 pt-2 text-[12px] font-semibold tracking-wide text-muted-foreground uppercase"><IconHistory className="size-3.5" />Library</div>
          <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-1 scrollbar-thin"><LibraryList threads={ai.threads} onOpen={ai.openThread} onDelete={ai.deleteThread} /></div>
        </div>
      </aside>

      <div className="mx-auto w-full max-w-3xl min-w-0">
        {chatting ? (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between xl:hidden">
              <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={() => ai.newChat()}><IconPlus className="size-4" /> New thread</Button>
            </div>
            <div data-slot="ask-thread"><ThreadView /></div>
            <div className="sticky bottom-4 z-20 rounded-[24px] bg-background/80 backdrop-blur"><Composer variant="followup" /></div>
          </div>
        ) : (
          <div className="flex flex-col pt-[8vh]">
            <h1 className="m-0 text-center text-[38px] leading-[1.15] font-semibold tracking-[-0.035em]">Where knowledge of your supply chain begins</h1>
            <p className="m-0 mt-2 mb-7 text-center text-[14px] text-muted-foreground">Ask about trips, orders, sales, CFA throughput or the e-com P&amp;L — every answer cites the live queries behind it.</p>
            <Composer variant="home" autoFocus />
            <p className="m-0 mt-2.5 text-center text-[12.5px] text-muted-foreground">
              <span className="inline-flex items-center gap-1 align-[-2px] font-medium text-foreground">{React.createElement(MODE_ICON[ai.askMode], { className: "size-3.5 text-primary" })}{mode.label}</span> — {mode.description}
            </p>
            <div className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TRY.map(({ q, icon: I, mode: m }) => {
                const MI = m ? MODE_ICON[m] : null;
                return (
                  <button key={q} type="button" onClick={() => ai.send(q, m ? { mode: m } : undefined)} disabled={ai.status === "streaming"}
                    className={cn("group flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-3 text-left text-[14px] transition-colors hover:border-primary/40 hover:bg-primary/[0.03]")}>
                    <I className="size-[18px] shrink-0 text-muted-foreground" stroke={1.8} />
                    <span className="flex-1">{q}</span>
                    {MI ? <span className="inline-flex items-center gap-1 rounded-full bg-primary/8 px-2 py-0.5 text-[11px] font-medium text-primary"><MI className="size-3" />{MODES.find((x) => x.key === m)?.label}</span> : <IconArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
                  </button>
                );
              })}
            </div>
            {ai.threads.length ? (
              <section className="mt-8 xl:hidden">
                <h2 className="m-0 mb-1 text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">Recent</h2>
                <LibraryList threads={ai.threads} onOpen={ai.openThread} limit={4} />
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
