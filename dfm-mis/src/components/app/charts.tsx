/* Thin data adapters that feed overtrue/ui charts. */
import { TrendChart } from "@/components/overtrue/trend-chart";
import { ComposedChart } from "@/components/overtrue/composed-chart";
import { MONTHS } from "@/data/data";
import { fmtN } from "@/data/format";
import { cn } from "@/lib/utils";

export interface Cat<T> { label: string; color: string; pred: (r: T) => boolean }

/** Monthly breakdown: one row per month, one key per category, with the source rows kept for drill-down. */
export function monthly<T extends { mk: string }>(rows: T[], cats: Cat<T>[], agg: (rs: T[]) => number = (rs) => rs.length) {
  const groups = MONTHS.map((m) => cats.map((c) => rows.filter((r) => r.mk === m.key && c.pred(r))));
  const data = MONTHS.map((m, i) => {
    const row: Record<string, unknown> = { month: m.label, __i: i };
    cats.forEach((c, j) => { row["s" + j] = agg(groups[i][j]); });
    return row;
  });
  const series = cats.map((c, j) => ({ key: "s" + j, label: c.label, color: c.color }));
  return { data, series, rowsAt: (i: number, key: string) => groups[i]?.[+key.slice(1)] ?? [] };
}

export function MonthlyStack<T extends { mk: string }>({
  rows, cats, agg, fmt = fmtN, axis, onDrill, height = "h-72", stacked = true, type = "bar",
}: {
  rows: T[]; cats: Cat<T>[]; agg?: (rs: T[]) => number; fmt?: (v: number) => string; axis?: (v: number) => string;
  onDrill?: (label: string, rows: T[]) => void; height?: string; stacked?: boolean; type?: "bar" | "line" | "area";
}) {
  const m = monthly(rows, cats, agg);
  return (
    <TrendChart
      data={m.data}
      xKey="month"
      series={m.series}
      type={type}
      stacked={stacked}
      showLegend
      showYAxis
      yFormatter={axis ?? fmt}
      className={height}
      onBarClick={onDrill ? (row, key) => {
        const i = Number(row.__i);
        const c = cats[+key.slice(1)];
        onDrill(`${c.label} · ${MONTHS[i].label}`, m.rowsAt(i, key));
      } : undefined}
    />
  );
}

/** Stacked monthly bars with a percentage line on the right axis. */
export function MonthlyWithRate<T extends { mk: string }>({
  rows, cats, rate, rateLabel, onDrill, height = "h-72", fmt = fmtN,
}: {
  rows: T[]; cats: Cat<T>[]; rate: (rs: T[]) => number | null; rateLabel: string; onDrill?: (label: string, rows: T[]) => void; height?: string; fmt?: (v: number) => string;
}) {
  const m = monthly(rows, cats);
  const data = m.data.map((d, i) => ({ ...d, rate: rate(rows.filter((r) => r.mk === MONTHS[i].key)) }));
  return (
    <ComposedChart
      data={data}
      xKey="month"
      series={[
        ...m.series.map((s) => ({ ...s, type: "bar" as const, stackId: "a" })),
        { key: "rate", label: rateLabel, type: "line" as const, axis: "right" as const, color: "var(--color-foreground)", dots: true },
      ]}
      showYAxis
      showLegend
      yFormatter={fmt}
      rightYFormatter={(v) => v.toFixed(0) + "%"}
      className={cn(height)}
      onBarClick={onDrill ? (row, key) => {
        const i = Number(row.__i);
        onDrill(`${cats[+key.slice(1)].label} · ${MONTHS[i].label}`, m.rowsAt(i, key));
      } : undefined}
    />
  );
}
