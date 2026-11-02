/* Renders one dashboard widget (KPI, chart, table, pivot or note) with dashboard filters applied. */
import * as React from "react";
import { dataset, type Dataset } from "@/ai/catalog";
import { execute, fmt, insightsFor, normalize, type Filter, type QuerySpec } from "@/ai/engine";
import { pivot, type PivotConfig } from "@/ai/pivot";
import { ChartBody } from "@/components/ai/GenChart";
import { PivotTable, pivotCsv } from "@/components/app/pivot";
import { renderInsight } from "@/components/app/kit";
import { Sparkline } from "@/components/overtrue/trend-sparkline";
import type { Widget } from "@/data/presets";
import { cn } from "@/lib/utils";

/** Dashboard filters replace a widget's own filter on the same field; fields the dataset lacks are ignored. */
export function mergeFilters(own: Filter[], dash: Filter[], ds: Dataset | undefined): Filter[] {
  const dims = new Set(ds?.dims.map((d) => d.key) ?? []);
  const active = dash.filter((f) => f.values.length && dims.has(f.field));
  const fields = new Set(active.map((f) => f.field));
  return [...own.filter((f) => !fields.has(f.field)), ...active];
}
export const widgetDataset = (w: Widget) => (w.kind === "pivot" ? w.pivot?.dataset : w.spec?.dataset);
export const effSpec = (s: QuerySpec, dash: Filter[]): QuerySpec => normalize({ ...s, filters: mergeFilters(s.filters, dash, dataset(s.dataset)) });
export const effPivot = (p: PivotConfig, dash: Filter[]): PivotConfig => ({ ...p, filters: mergeFilters(p.filters, dash, dataset(p.dataset)) });

export function WidgetBody({ widget, filters }: { widget: Widget; filters: Filter[] }) {
  if (widget.kind === "note") return <NoteBody text={widget.text ?? ""} />;
  if (widget.kind === "pivot" && widget.pivot) return <PivotBody cfg={effPivot(widget.pivot, filters)} />;
  if (!widget.spec) return null;
  const spec = effSpec(widget.kind === "table" ? { ...widget.spec, chart: "table" } : widget.spec, filters);
  if (widget.kind === "kpi") return <KpiBody spec={spec} />;
  return <ChartWidgetBody spec={spec} />;
}

function ChartWidgetBody({ spec }: { spec: QuerySpec }) {
  const r = React.useMemo(() => execute(spec), [spec]);
  const insight = React.useMemo(() => insightsFor(r)[0], [r]);
  if (r.error) return <p className="m-0 text-xs text-destructive">{r.error}</p>;
  if (!r.rows.length) return <p className="m-0 text-xs text-muted-foreground">No records match these filters.</p>;
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className={cn("min-h-0 flex-1", spec.chart === "table" || spec.chart === "bar_list" || spec.chart === "horizontal_bar" || spec.chart === "heatmap" ? "overflow-auto scrollbar-thin" : "")}>
        <ChartBody r={r} fill compact />
      </div>
      {insight && spec.chart !== "table" ? <p className="m-0 line-clamp-1 shrink-0 text-[11px] leading-4 text-muted-foreground" title={insight.replace(/\{\{metric:([^|}]*)\|?([^|}]*)\|?[^}]*\}\}/g, "$1 $2")}>{renderInsight(insight)}</p> : null}
    </div>
  );
}

function PivotBody({ cfg }: { cfg: PivotConfig }) {
  const r = React.useMemo(() => pivot(cfg), [cfg]);
  if ("error" in r) return <p className="m-0 text-xs text-destructive">{r.error}</p>;
  return <PivotTable result={r} maxHeight="100%" className="h-full rounded-md" />;
}

function KpiBody({ spec }: { spec: QuerySpec }) {
  const ds = dataset(spec.dataset)!;
  const m = ds.measures.find((x) => x.key === spec.measures[0]);
  const r = React.useMemo(() => execute({ ...spec, dimension: null, series: null, chart: "kpi" }), [spec]);
  const trend = React.useMemo(() => {
    if (!ds.dims.some((d) => d.key === "month")) return null;
    const t = execute({ ...spec, dimension: "month", series: null, chart: "line", sort: "natural", limit: null, filters: spec.filters.filter((f) => f.field !== "month") });
    return t.rows.map((x) => ({ label: x.label, v: x.values[spec.measures[0]] ?? 0 }));
  }, [spec, ds]);
  if (!m) return <p className="m-0 text-xs text-destructive">Unknown measure</p>;
  const v = r.totals[m.key];
  const additive = ["number", "inr", "km"].includes(m.format);
  let delta: { text: string; tone: "good" | "bad" | "flat" } | null = null;
  if (trend && trend.length >= 3 && !additive) {
    const monthF = spec.filters.find((f) => f.field === "month" && f.op === "in" && f.values.length === 1);
    const i = monthF ? trend.findIndex((t) => t.label === monthF.values[0]) : -1;
    if (i > 0) {
      const d = trend[i].v - trend[i - 1].v;
      const up = d >= 0;
      delta = { text: `${up ? "▲" : "▼"} ${m.format === "pct" ? Math.abs(d).toFixed(1) + " pts" : fmt(Math.abs(d), m.format)} vs ${trend[i - 1].label}`, tone: Math.abs(d) < 1e-9 || m.higherIsBetter === undefined ? "flat" : up === m.higherIsBetter ? "good" : "bad" };
    }
  }
  return (
    <div className="flex h-full min-h-0 flex-col gap-1">
      <div>
        <div className="text-[22px] leading-7 font-semibold tracking-[-0.03em] tabular-nums">{fmt(v, m.format)}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {delta ? <span className={cn("font-medium tabular-nums", delta.tone === "good" && "text-emerald-600 dark:text-emerald-400", delta.tone === "bad" && "text-rose-600 dark:text-rose-400")}>{delta.text}</span> : <span className="tabular-nums">{r.matched.toLocaleString("en-IN")} records</span>}
        </div>
      </div>
      {trend && trend.length > 2 ? (
        <div className="relative mt-auto min-h-7 flex-1" title={`${trend[0].label} – ${trend[trend.length - 1].label}`}>
          <Sparkline data={trend.map((t) => t.v)} className="absolute inset-0 h-full w-full" color={delta?.tone === "bad" ? "var(--color-chart-5)" : undefined} />
        </div>
      ) : null}
    </div>
  );
}

function NoteBody({ text }: { text: string }) {
  return (
    <div className="h-full overflow-auto text-[13px] leading-5 text-muted-foreground scrollbar-thin">
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="m-0 mb-2 last:mb-0">
          {p.split(/(\*\*[^*]+\*\*)/).map((s, j) => (s.startsWith("**") ? <strong key={j} className="text-foreground">{s.slice(2, -2)}</strong> : <React.Fragment key={j}>{s}</React.Fragment>))}
        </p>
      ))}
    </div>
  );
}

/** CSV of what a widget shows. */
export function widgetCsv(widget: Widget, filters: Filter[]) {
  let lines: string[][] = [];
  if (widget.kind === "pivot" && widget.pivot) {
    const r = pivot(effPivot(widget.pivot, filters));
    if (!("error" in r)) pivotCsv(r);
    return;
  }
  if (!widget.spec) return;
  const r = execute(effSpec(widget.spec, filters));
  const ms = r.spec.measures.map((k) => r.ds.measures.find((m) => m.key === k)!);
  lines = [[r.spec.dimension ?? "group", ...(r.spec.series ? [r.spec.series] : []), ...ms.map((m) => m.label)], ...r.rows.map((x) => [x.label, ...(x.series ? [x.series] : []), ...ms.map((m) => String(x.values[m.key] ?? ""))])];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + lines.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" }));
  a.download = widget.title.replace(/[^\w]+/g, "_").slice(0, 60) + ".csv";
  a.click();
}
