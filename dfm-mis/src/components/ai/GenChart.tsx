/* Generative UI: renders any QuerySpec with the overtrue/ui chart that fits it. */
import * as React from "react";
import { IconCode, IconDownload, IconLayoutGridAdd, IconPin, IconPinFilled, IconShare } from "@tabler/icons-react";
import { useDashboardsOptional } from "@/state/dashboards";
import { TrendChart } from "@/components/overtrue/trend-chart";
import { ComposedChart } from "@/components/overtrue/composed-chart";
import { DonutChart } from "@/components/overtrue/donut-chart";
import { BarList } from "@/components/overtrue/bar-list";
import { HeatmapChart } from "@/components/overtrue/heatmap-chart";
import { StatusBadge } from "@/components/overtrue/status-badge";
import { Button } from "@/components/ui/button";
import { AxisFrame, DataTable, InsightLine, Toggle, type Col } from "@/components/app/kit";
import { DenseTable } from "@/components/app/dense";
import { execute, fmt, insightsFor, type ChartType, type QueryResult, type QuerySpec } from "@/ai/engine";
import { PALETTE } from "@/data/colors";
import { cn } from "@/lib/utils";

const LABEL: Record<ChartType, string> = {
  bar: "Columns", horizontal_bar: "Ranked", stacked_bar: "Stacked", line: "Line", area: "Area", combo: "Combo", donut: "Donut", bar_list: "List", heatmap: "Heatmap", kpi: "KPI", table: "Table",
};

export function compatibleCharts(r: QueryResult): ChartType[] {
  const s = r.spec;
  if (!s.dimension) return ["kpi", "table"];
  const dim = r.ds.dims.find((d) => d.key === s.dimension);
  const m = r.ds.measures.find((x) => x.key === s.measures[0]);
  const additive = !!m && ["number", "inr", "km"].includes(m.format);
  const n = new Set(r.rows.map((x) => x.label)).size;
  const out: ChartType[] = [];
  if (s.series) out.push(...((s.chart === "bar" ? ["bar"] : []) as ChartType[]), dim?.time ? "line" : "stacked_bar", "heatmap", dim?.time ? "stacked_bar" : "line");
  else if (dim?.time) out.push("line", "area", "bar");
  else out.push("horizontal_bar", "bar", "bar_list", ...(additive && n <= 8 ? (["donut"] as ChartType[]) : []));
  if (s.measures.length >= 2 && !s.series) out.push("combo");
  out.push("table");
  return [...new Set(out)];
}

export function GenChart({ spec, pinned, onPin, compact, className }: { spec: QuerySpec; pinned?: boolean; onPin?: () => void; compact?: boolean; className?: string }) {
  const [chart, setChart] = React.useState<ChartType>(spec.chart);
  const [showSpec, setShowSpec] = React.useState(false);
  const live = React.useMemo(() => ({ ...spec, chart }), [spec, chart]);
  const r = React.useMemo(() => execute(live), [live]);
  const insights = React.useMemo(() => insightsFor(r), [r]);
  const options = compatibleCharts(r);
  const exportCsv = () => {
    const ms = r.spec.measures.map((k) => r.ds.measures.find((m) => m.key === k)!);
    const head = [r.spec.dimension ?? "group", ...(r.spec.series ? [r.spec.series] : []), ...ms.map((m) => m.label)];
    const lines = [head, ...r.rows.map((x) => [x.label, ...(x.series ? [x.series] : []), ...ms.map((m) => String(x.values[m.key] ?? ""))])].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv" }));
    a.download = (spec.title || "ask-ai").replace(/[^\w]+/g, "_").slice(0, 60) + ".csv";
    a.click();
  };

  const db = useDashboardsOptional();
  const [added, setAdded] = React.useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const share = () => {
    const plain = insights.join(" ").replace(/\{\{metric:([^|}]*)\|?([^|}]*)\|?[^}]*\}\}/g, (_m, a, b) => [a, b].filter(Boolean).join(" "));
    navigator.share({ title: spec.title, text: `${spec.title}\n${plain}` }).catch(() => undefined);
  };
  return (
    <div data-slot="gen-chart" className={cn("surface-card flex min-w-0 flex-col gap-3 p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight">{spec.title || "Untitled"}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <StatusBadge variant="neutral">{r.ds.label}</StatusBadge>
            <span>{r.matched.toLocaleString("en-IN")} records</span>
            {spec.filters.map((f) => <span key={f.field} className="rounded-md bg-muted px-1.5 py-0.5">{f.op === "not_in" ? "not " : ""}{f.values.join(", ")}</span>)}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onPin ? <Button variant="ghost" size="icon-sm" aria-label={pinned ? "Unpin from My board" : "Pin to My board"} onClick={onPin}>{pinned ? <IconPinFilled className="size-4 text-primary" /> : <IconPin className="size-4" />}</Button> : null}
          {db ? <Button variant="ghost" size="icon-sm" aria-label={added ? "Added to dashboard" : "Add to my dashboard"} title={added ? "Added to your latest dashboard" : "Add to my dashboard"} disabled={added}
            onClick={() => { db.addWidgetToDashboard(null, { kind: chart === "kpi" ? "kpi" : chart === "table" ? "table" : "chart", title: spec.title, w: chart === "kpi" ? 3 : 6, h: chart === "kpi" ? 2 : 4, spec: { ...spec, chart } }); setAdded(true); }}>
            <IconLayoutGridAdd className={cn("size-4", added && "text-primary")} /></Button> : null}
          {canShare ? <Button variant="ghost" size="icon-sm" aria-label="Share" onClick={share}><IconShare className="size-4" /></Button> : null}
          <Button variant="ghost" size="icon-sm" aria-label="Export CSV" onClick={exportCsv}><IconDownload className="size-4" /></Button>
          <Button variant="ghost" size="icon-sm" aria-label="Show query" aria-pressed={showSpec} onClick={() => setShowSpec((v) => !v)}><IconCode className="size-4" /></Button>
        </div>
      </div>
      {options.length > 2 && !compact ? (
        <div className="-mx-1 overflow-x-auto px-1"><Toggle label="Chart type" value={options.includes(chart) ? chart : options[0]} onChange={setChart} options={options.map((o) => [o, LABEL[o]])} /></div>
      ) : null}
      {r.error ? <p className="m-0 text-sm text-destructive">{r.error}</p> : r.rows.length ? <ChartBody r={r} compact={compact} /> : <p className="m-0 text-sm text-muted-foreground">No records match these filters.</p>}
      {insights.length ? <InsightLine className="mt-0" text={insights.join(" ")} /> : null}
      {showSpec ? <pre className="m-0 max-h-48 overflow-auto rounded-lg bg-muted p-3 font-mono text-[11px] leading-4">{JSON.stringify({ ...spec, chart }, null, 2)}</pre> : null}
    </div>
  );
}

/** Axis titles derived from the query: the grouping on one axis, the measure (with its unit) on the other. */
export function ChartBody({ r, compact, fill }: { r: QueryResult; compact?: boolean; fill?: boolean }) {
  const s = r.spec;
  const body = <ChartBodyInner r={r} compact={compact} fill={fill} />;
  if (!s.dimension || ["kpi", "table", "donut", "bar_list"].includes(s.chart)) return body;
  const dimL = r.ds.dims.find((d) => d.key === s.dimension)?.label ?? "Group";
  const serL = s.series ? r.ds.dims.find((d) => d.key === s.series)?.label : undefined;
  const ms = s.measures.map((k) => r.ds.measures.find((m) => m.key === k)!).filter(Boolean);
  if (s.chart === "heatmap") {
    const time = !!r.ds.dims.find((d) => d.key === s.dimension)?.time;
    return <AxisFrame fill={fill} y={time ? serL : dimL} x={`${time ? dimL : serL} · cells: ${ms[0]?.label}`}>{body}</AxisFrame>;
  }
  if (s.chart === "horizontal_bar" && !s.series) return <AxisFrame fill={fill} y={dimL} x={ms.map((m) => m.label).join(" · ")}>{body}</AxisFrame>;
  if (s.chart === "combo" && ms[1]) return <AxisFrame fill={fill} y={`${ms[0].label} (bars)`} y2={`${ms[1].label} (line)`} x={dimL}>{body}</AxisFrame>;
  return <AxisFrame fill={fill} y={ms.length > 1 && !s.series ? ms.map((m) => m.label).join(" · ") : ms[0]?.label} x={serL ? `${dimL} · colour = ${serL}` : dimL}>{body}</AxisFrame>;
}

function ChartBodyInner({ r, compact, fill }: { r: QueryResult; compact?: boolean; fill?: boolean }) {
  const s = r.spec;
  const ms = s.measures.map((k) => r.ds.measures.find((m) => m.key === k)!);
  const m0 = ms[0];
  const f0 = (v: number) => fmt(v, m0.format, true);
  const labels = [...new Set(r.rows.map((x) => x.label))];
  const h = fill ? "h-full min-h-0" : compact ? "h-56" : "h-72";

  if (s.chart === "kpi" || !s.dimension) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ms.map((m) => (
          <div key={m.key} className="inset-panel p-3">
            <div className="text-xs text-muted-foreground">{m.label}</div>
            <div className="mt-1 text-2xl font-semibold tracking-[-0.03em] tabular-nums">{fmt(r.totals[m.key], m.format)}</div>
          </div>
        ))}
      </div>
    );
  }

  if (s.chart === "table" && fill) {
    const dimL = r.ds.dims.find((d) => d.key === s.dimension)?.label ?? "Group";
    return <DenseTable className="h-full" dimLabel={s.series ? `${dimL} · ${r.ds.dims.find((d) => d.key === s.series)?.label}` : dimL} rank={s.sort !== "natural"}
      rows={r.rows.map((x, i) => ({ id: `${x.label}-${x.series ?? ""}-${i}`, label: s.series ? `${x.label} · ${x.series}` : x.label, values: x.values }))}
      cols={ms.map((m, i) => ({ key: m.key, label: m.label, format: m.format, bar: i === 0 && ["number", "inr", "km"].includes(m.format), higherIsBetter: ["number", "inr", "km"].includes(m.format) ? undefined : m.higherIsBetter }))}
      total={s.series ? undefined : r.totals} />;
  }
  if (s.chart === "table") {
    const cols: Col<(typeof r.rows)[number]>[] = [
      { id: "l", header: r.ds.dims.find((d) => d.key === s.dimension)?.label ?? "Group", value: (x) => x.label, cell: (x) => <span className="font-medium">{x.label}</span> },
      ...(s.series ? [{ id: "s", header: r.ds.dims.find((d) => d.key === s.series)?.label ?? "Series", value: (x: (typeof r.rows)[number]) => x.series ?? "" }] : []),
      ...ms.map((m) => ({ id: m.key, header: m.label, align: "right" as const, value: (x: (typeof r.rows)[number]) => x.values[m.key] ?? -Infinity, cell: (x: (typeof r.rows)[number]) => fmt(x.values[m.key], m.format) })),
    ];
    return <DataTable rows={r.rows} cols={cols} pageSize={compact ? 6 : 10} getRowId={(x, i) => `${x.label}-${x.series ?? ""}-${i}`} />;
  }

  if (s.series) {
    const keys = r.seriesKeys;
    if (s.chart === "heatmap") {
      const time = !!r.ds.dims.find((d) => d.key === s.dimension)?.time;
      const rowsOf = time ? keys : labels, colsOf = time ? labels : keys;
      const val = (row: string, col: string) => r.rows.find((x) => (time ? x.series === row && x.label === col : x.label === row && x.series === col))?.values[m0.key] ?? 0;
      return <HeatmapChart rows={rowsOf.map((row) => ({ label: row, values: colsOf.map((c) => val(row, c) ?? 0) }))} columns={colsOf} valueFormatter={(v) => fmt(v, m0.format)} maxCellHeight={28} columnLabelEvery={colsOf.length > 16 ? 3 : 1} />;
    }
    const data = labels.map((l) => ({ label: l, ...Object.fromEntries(keys.map((k, i) => ["s" + i, r.rows.find((x) => x.label === l && x.series === k)?.values[m0.key] ?? null])) }));
    const series = keys.map((k, i) => ({ key: "s" + i, label: k, color: PALETTE[i % PALETTE.length] }));
    const type = s.chart === "line" || s.chart === "area" ? s.chart : "bar";
    return <TrendChart data={data} xKey="label" type={type} stacked={s.chart === "stacked_bar"} series={series} showLegend showYAxis yFormatter={f0} className={h} />;
  }

  const data = r.rows.map((x) => ({ label: x.label, ...Object.fromEntries(ms.map((m) => [m.key, x.values[m.key]])) }));
  if (s.chart === "donut") return <DonutChart data={r.rows.map((x, i) => ({ name: x.label, value: x.values[m0.key] ?? 0, color: PALETTE[i % PALETTE.length] }))} valueFormatter={(v) => fmt(v, m0.format)} legendPosition="right" className={h} />;
  if (s.chart === "bar_list") return <BarList data={r.rows.map((x) => ({ name: x.label, value: x.values[m0.key] ?? 0 }))} valueFormatter={(v) => fmt(v, m0.format)} sortOrder="none" />;
  if (s.chart === "combo" && ms[1]) {
    return <ComposedChart data={data} xKey="label" showYAxis showLegend yFormatter={f0} rightYFormatter={(v) => fmt(v, ms[1].format, true)} className={h}
      series={[{ key: ms[0].key, label: ms[0].label, type: "bar" }, { key: ms[1].key, label: ms[1].label, type: "line", axis: "right", color: "var(--color-chart-3)", dots: true }]} />;
  }
  const horizontal = s.chart === "horizontal_bar";
  const type = s.chart === "line" || s.chart === "area" ? s.chart : "bar";
  return (
    <TrendChart data={data} xKey="label" type={type} layout={horizontal ? "horizontal" : "vertical"} showYAxis showLegend={ms.length > 1}
      series={ms.map((m, i) => ({ key: m.key, label: m.label, color: PALETTE[i] }))} yFormatter={f0}
      className={horizontal ? (fill && labels.length <= 12 ? "h-full min-h-0" : undefined) : h} style={horizontal && !(fill && labels.length <= 12) ? { height: Math.max(180, labels.length * (compact || fill ? 26 : 32) + 40) } : undefined} />
  );
}
