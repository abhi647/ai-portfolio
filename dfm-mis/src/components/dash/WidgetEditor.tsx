/* Side sheet to create or edit a dashboard widget, with a live preview on real data. */
import * as React from "react";
import { IconChartBar, IconNote, IconNumber, IconTable, IconTablePlus } from "@tabler/icons-react";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/select";
import { MultiSelect } from "@/components/overtrue/multi-select";
import { DATASETS, dataset } from "@/ai/catalog";
import { execute, normalize, type ChartType, type QuerySpec } from "@/ai/engine";
import { defaultPivot } from "@/ai/pivot";
import { compatibleCharts } from "@/components/ai/GenChart";
import { DatasetFilterBar } from "@/components/app/filters";
import { PivotBuilder, PivotOptions } from "@/components/app/pivot";
import { pivotTitle } from "@/pages/Explore";
import type { Widget, WidgetKind } from "@/data/presets";
import type { Filter } from "@/ai/engine";
import { WidgetBody } from "./WidgetView";
import { cn } from "@/lib/utils";

const KINDS: { k: WidgetKind; label: string; icon: typeof IconNumber }[] = [
  { k: "kpi", label: "KPI", icon: IconNumber }, { k: "chart", label: "Chart", icon: IconChartBar }, { k: "table", label: "Table", icon: IconTable },
  { k: "pivot", label: "Pivot", icon: IconTablePlus }, { k: "note", label: "Note", icon: IconNote },
];
const CHART_LABEL: Record<ChartType, string> = {
  bar: "Column", horizontal_bar: "Ranked bars", stacked_bar: "Stacked columns", line: "Line", area: "Area", combo: "Combo (bars + line)", donut: "Donut", bar_list: "Bar list", heatmap: "Heatmap", kpi: "KPI", table: "Table",
};
const SIZE: Record<WidgetKind, [number, number]> = { kpi: [2, 2], chart: [6, 4], table: [6, 5], pivot: [12, 5], note: [4, 2] };

const blankSpec = (ds = "trips"): QuerySpec => {
  const d = dataset(ds)!;
  return { dataset: ds, measures: [d.measures[0].key], dimension: d.dims.find((x) => x.key === "month") ? "month" : d.dims[0].key, series: null, filters: [], sort: "natural", limit: null, chart: "bar", title: "" };
};

export function newWidget(kind: WidgetKind = "chart"): Widget {
  const [w, h] = SIZE[kind];
  return { id: "", kind, title: "", w, h, spec: kind === "pivot" || kind === "note" ? undefined : { ...blankSpec(), chart: kind === "kpi" ? "kpi" : kind === "table" ? "table" : "bar", dimension: kind === "kpi" ? null : "month" }, pivot: kind === "pivot" ? defaultPivot() : undefined, text: kind === "note" ? "" : undefined };
}

export function autoTitle(w: Widget) {
  if (w.kind === "note") return "Note";
  if (w.kind === "pivot" && w.pivot) return pivotTitle(w.pivot);
  const s = w.spec; if (!s) return "Widget";
  const ds = dataset(s.dataset)!;
  const m = s.measures.map((k) => ds.measures.find((x) => x.key === k)?.label).filter(Boolean).join(" and ");
  if (!s.dimension) return m;
  return `${m} by ${ds.dims.find((d) => d.key === s.dimension)?.label.toLowerCase()}${s.series ? ` and ${ds.dims.find((d) => d.key === s.series)?.label.toLowerCase()}` : ""}`;
}

export function WidgetEditor({ open, initial, onOpenChange, onSave, dashFilters }: {
  open: boolean; initial: Widget | null; onOpenChange: (v: boolean) => void; onSave: (w: Widget) => void; dashFilters: Filter[];
}) {
  const [w, setW] = React.useState<Widget>(() => initial ?? newWidget());
  React.useEffect(() => { if (open) setW(initial ?? newWidget()); }, [open, initial]);
  const setKind = (k: WidgetKind) => setW((x) => {
    const [ww, hh] = SIZE[k];
    const spec = x.spec ?? blankSpec(x.pivot?.dataset);
    return {
      ...x, kind: k, w: x.kind === k ? x.w : ww, h: x.kind === k ? x.h : hh,
      spec: k === "pivot" || k === "note" ? x.spec : { ...spec, chart: k === "kpi" ? "kpi" : k === "table" ? "table" : spec.chart === "kpi" || spec.chart === "table" ? "bar" : spec.chart, dimension: k === "kpi" ? null : spec.dimension ?? spec.series ?? "month", measures: k === "kpi" ? spec.measures.slice(0, 1) : spec.measures },
      pivot: k === "pivot" ? x.pivot ?? defaultPivot(spec.dataset) : x.pivot,
    };
  });
  const s = w.spec;
  const ds = s ? dataset(s.dataset)! : undefined;
  const setSpec = (patch: Partial<QuerySpec>) => setW((x) => ({ ...x, spec: { ...x.spec!, ...patch } }));
  const charts = React.useMemo(() => (s && w.kind === "chart" ? compatibleCharts(execute(normalize(s))).filter((c) => c !== "table") : []), [s, w.kind]);
  React.useEffect(() => { if (w.kind === "chart" && s && charts.length && !(charts as ChartType[]).includes(s.chart)) setSpec({ chart: charts[0] }); }, [charts, s, w.kind]);
  const preview: Widget = { ...w, title: w.title || autoTitle(w) };
  const label = "text-[11px] font-medium tracking-wide text-muted-foreground uppercase";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[620px]">
        <SheetHeader className="border-b border-border/60 px-5 py-4">
          <SheetTitle>{initial?.id ? "Edit widget" : "Add widget"}</SheetTitle>
          <SheetDescription className="text-xs">Pick the data and the view — the preview below uses live MIS data and this dashboard’s filters.</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 scrollbar-thin">
          <div role="radiogroup" aria-label="Widget type" className="grid grid-cols-5 gap-1.5">
            {KINDS.map(({ k, label: l, icon: I }) => (
              <button key={k} type="button" role="radio" aria-checked={w.kind === k} onClick={() => setKind(k)}
                className={cn("flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs transition-colors", w.kind === k ? "border-primary bg-primary/8 text-primary" : "border-border hover:bg-muted")}>
                <I className="size-4" />{l}
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1.5"><span className={label}>Title</span>
            <Input value={w.title} placeholder={autoTitle(w)} onChange={(e) => setW({ ...w, title: e.target.value })} className="h-8 text-[13px]" />
          </label>

          {w.kind === "note" ? (
            <label className="flex flex-col gap-1.5"><span className={label}>Text</span>
              <Textarea rows={6} value={w.text ?? ""} placeholder="Context for readers — e.g. targets, owners, what changed. **bold** works." onChange={(e) => setW({ ...w, text: e.target.value })} className="text-[13px]" />
            </label>
          ) : w.kind === "pivot" && w.pivot ? (
            <div className="flex flex-col gap-2.5">
              <PivotBuilder compact cfg={w.pivot} onChange={(p) => setW({ ...w, pivot: p })} />
              <DatasetFilterBar ds={dataset(w.pivot.dataset)!} filters={w.pivot.filters} onChange={(f) => setW({ ...w, pivot: { ...w.pivot!, filters: f } })} />
              <PivotOptions cfg={w.pivot} onChange={(p) => setW({ ...w, pivot: p })} />
            </div>
          ) : s && ds ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 flex flex-col gap-1.5 sm:col-span-1"><span className={label}>Dataset</span>
                <FormSelect value={s.dataset} onChange={(e) => { const b = blankSpec(e.target.value); setSpec({ dataset: b.dataset, measures: b.measures, dimension: w.kind === "kpi" ? null : b.dimension, series: null, filters: [] }); }} className="h-8 rounded-md px-2.5 text-[13px]">
                  {DATASETS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                </FormSelect>
              </label>
              <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1"><span className={label}>{w.kind === "kpi" ? "Measure" : "Measures"}</span>
                {w.kind === "kpi" ? (
                  <FormSelect value={s.measures[0]} onChange={(e) => setSpec({ measures: [e.target.value] })} className="h-8 rounded-md px-2.5 text-[13px]">
                    {ds.measures.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </FormSelect>
                ) : (
                  <MultiSelect options={ds.measures.map((m) => ({ value: m.key, label: m.label }))} value={s.measures} maxSelected={w.kind === "table" ? 5 : 3} collapse={2} aria-label="Measures"
                    onValueChange={(v) => setSpec({ measures: v.length ? v : s.measures })} />
                )}
              </div>
              {w.kind !== "kpi" ? (
                <>
                  <label className="flex flex-col gap-1.5"><span className={label}>Group by</span>
                    <FormSelect value={s.dimension ?? ""} onChange={(e) => setSpec({ dimension: e.target.value || null, series: s.series === e.target.value ? null : s.series })} className="h-8 rounded-md px-2.5 text-[13px]">
                      {ds.dims.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                    </FormSelect>
                  </label>
                  <label className="flex flex-col gap-1.5"><span className={label}>Split by</span>
                    <FormSelect value={s.series ?? ""} onChange={(e) => setSpec({ series: e.target.value || null })} className="h-8 rounded-md px-2.5 text-[13px]">
                      <option value="">None</option>
                      {ds.dims.filter((d) => d.key !== s.dimension).map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                    </FormSelect>
                  </label>
                  {w.kind === "chart" ? (
                    <label className="flex flex-col gap-1.5"><span className={label}>Chart</span>
                      <FormSelect value={s.chart} onChange={(e) => setSpec({ chart: e.target.value as ChartType })} className="h-8 rounded-md px-2.5 text-[13px]">
                        {charts.map((c) => <option key={c} value={c}>{CHART_LABEL[c]}</option>)}
                      </FormSelect>
                    </label>
                  ) : null}
                  <label className="flex flex-col gap-1.5"><span className={label}>Sort</span>
                    <FormSelect value={s.sort} onChange={(e) => setSpec({ sort: e.target.value as QuerySpec["sort"] })} className="h-8 rounded-md px-2.5 text-[13px]">
                      <option value="natural">Natural order</option><option value="desc">Highest first</option><option value="asc">Lowest first</option>
                    </FormSelect>
                  </label>
                  <label className="flex flex-col gap-1.5"><span className={label}>Show</span>
                    <FormSelect value={String(s.limit ?? "")} onChange={(e) => setSpec({ limit: e.target.value ? Number(e.target.value) : null })} className="h-8 rounded-md px-2.5 text-[13px]">
                      <option value="">All groups</option>{[5, 8, 10, 15, 20].map((n) => <option key={n} value={n}>Top {n}</option>)}
                    </FormSelect>
                  </label>
                </>
              ) : null}
              <div className="col-span-2 flex flex-col gap-1.5"><span className={label}>Filters</span>
                <DatasetFilterBar ds={ds} filters={s.filters} onChange={(f) => setSpec({ filters: f })} />
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5"><span className={label}>Width</span>
              <FormSelect value={w.w} onChange={(e) => setW({ ...w, w: Number(e.target.value) })} className="h-8 rounded-md px-2.5 text-[13px]">
                {[[2, "1/6"], [3, "1/4"], [4, "1/3"], [6, "1/2"], [8, "2/3"], [9, "3/4"], [12, "Full width"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </FormSelect>
            </label>
            <label className="flex flex-col gap-1.5"><span className={label}>Height</span>
              <FormSelect value={w.h} onChange={(e) => setW({ ...w, h: Number(e.target.value) })} className="h-8 rounded-md px-2.5 text-[13px]">
                {[2, 3, 4, 5, 6, 7, 8].map((v) => <option key={v} value={v}>{v} rows</option>)}
              </FormSelect>
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={label}>Preview</span>
            <div className="flex h-[300px] flex-col rounded-xl border border-border/70 bg-card p-3">
              <div className="mb-2 truncate text-[13px] font-semibold">{preview.title}</div>
              <div className="min-h-0 flex-1"><WidgetBody widget={preview} filters={dashFilters} /></div>
            </div>
          </div>
        </div>
        <SheetFooter className="flex-row justify-end gap-2 border-t border-border/60 px-5 py-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={() => onSave(preview)}>{initial?.id ? "Save widget" : "Add to dashboard"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
