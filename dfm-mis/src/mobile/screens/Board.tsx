/* Phone "Dashboards" tab: the dashboards built on desktop, laid out densely for a phone, plus charts pinned from Ask. */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { IconArrowDown, IconArrowUp, IconDots, IconPin, IconSparkles } from "@tabler/icons-react";
import { EmptyState } from "@/components/overtrue/empty-state";
import { SectionCard } from "@/components/overtrue/section-card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GenChart } from "@/components/ai/GenChart";
import { WidgetBody, widgetCsv } from "@/components/dash/WidgetView";
import { autoTitle } from "@/components/dash/WidgetEditor";
import { useAI } from "@/state/ai";
import { useDashboards } from "@/state/dashboards";
import { usePersistentState } from "@/state/app";
import type { Widget } from "@/data/presets";
import { ScreenHeader } from "./parts";
import { cn } from "@/lib/utils";

/** Phone heights per widget type: dense, but tall enough to read. */
const height = (w: Widget) => (w.kind === "kpi" ? 104 : w.kind === "note" ? undefined : w.kind === "pivot" ? Math.min(380, 90 + w.h * 44) : w.kind === "table" ? Math.min(360, 80 + w.h * 46) : 236);

export default function BoardScreen() {
  const ai = useAI()!;
  const db = useDashboards();
  const nav = useNavigate();
  const sorted = [...db.dashboards].sort((a, b) => b.updatedAt - a.updatedAt);
  const [sel, setSel] = usePersistentState<string>("m.board.sel", sorted[0]?.id ?? "pins");
  const current = sel === "pins" ? null : db.get(sel) ?? sorted[0] ?? null;
  const tab = current ? current.id : "pins";

  return (
    <div className="absolute inset-0 overflow-y-auto overscroll-contain">
      <ScreenHeader title={current ? current.name : "Pinned from Ask"} subtitle={current ? `${current.widgets.length} widgets · live data · edit on desktop` : `${ai.pins.length} pinned chart${ai.pins.length === 1 ? "" : "s"} · live data`} />
      <div className="sticky top-[calc(env(safe-area-inset-top)+56px)] z-10 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div role="tablist" aria-label="Dashboards" className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 py-2">
          {sorted.map((d) => (
            <button key={d.id} type="button" role="tab" aria-selected={tab === d.id} onClick={() => setSel(d.id)}
              className={cn("shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-medium whitespace-nowrap transition-colors", tab === d.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>{d.name}</button>
          ))}
          <button type="button" role="tab" aria-selected={tab === "pins"} onClick={() => setSel("pins")}
            className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[12.5px] font-medium whitespace-nowrap", tab === "pins" ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}><IconPin className="size-3.5" />Pinned · {ai.pins.length}</button>
        </div>
      </div>

      {current ? (
        <div className="grid grid-cols-2 gap-2 px-3 pt-3 pb-8">
          {current.widgets.map((w) => (
            <SectionCard key={w.id} aria-label={w.title} className={cn("flex min-w-0 flex-col overflow-hidden rounded-xl [&>.card-header]:flex-nowrap [&>.card-header]:px-2.5 [&>.card-header]:py-1.5", w.kind === "kpi" ? "col-span-1" : "col-span-2")} style={{ height: height(w) }}
              title={<span className={cn("block truncate", w.kind === "kpi" ? "text-[11px] font-medium text-muted-foreground" : "text-[12.5px]")}>{w.title || autoTitle(w)}</span>}
              actions={w.kind !== "kpi" ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" className="-mr-1 size-7" aria-label={`${w.title} actions`}><IconDots className="size-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {w.kind !== "note" ? <DropdownMenuItem onSelect={() => { ai.send(`${w.title} — what stands out, why, and what should I do?`, { mode: "research" }); nav("/"); }}><IconSparkles className="size-4" /> Research with AI</DropdownMenuItem> : null}
                      {w.kind !== "note" ? <DropdownMenuItem onSelect={() => widgetCsv(w, current.filters)}>Export CSV</DropdownMenuItem> : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : undefined}
              contentClassName={cn("min-h-0 flex-1", w.kind === "kpi" ? "px-2.5 pb-2" : w.kind === "pivot" || w.kind === "table" ? "p-0" : "p-2")}>
                <WidgetBody widget={w} filters={current.filters} />
            </SectionCard>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-3 pt-3 pb-8">
          {ai.pins.length ? ai.pins.map((p, i) => (
            <div key={p.id} className="flex flex-col gap-1">
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => ai.movePin(p.id, -1)}><IconArrowUp className="size-4" /></Button>
                <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === ai.pins.length - 1} onClick={() => ai.movePin(p.id, 1)}><IconArrowDown className="size-4" /></Button>
              </div>
              <GenChart spec={p.spec} compact pinned onPin={() => ai.togglePin(p.spec)} className="rounded-xl" />
            </div>
          )) : (
            <div className="mt-4 rounded-xl border border-border/70 bg-card p-6">
              <EmptyState icon={<IconPin className="size-6" />} title="Nothing pinned yet" description="Ask a question, then tap the pin on any chart to keep it here."
                action={<Button onClick={() => nav("/")} className="gap-1.5"><IconSparkles className="size-4" /> Ask a question</Button>} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
