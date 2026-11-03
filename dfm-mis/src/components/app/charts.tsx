/* Thin data adapters that feed overtrue/ui charts. */
import { TrendChart } from "@/components/overtrue/trend-chart";
import { ComposedChart } from "@/components/overtrue/composed-chart";
import { MONTHS } from "@/data/data";
import { fmtN } from "@/data/format";
import { cn } from "@/lib/utils";
import { AxisFrame, useAutoInsight } from "./kit";

const X_MONTH = `Month (${MONTHS[MONTHS.length - 1].label} is month to date)`;

const pts = (v: number) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1) + " pts";

/** Biggest share shift between the last two months, phrased as a one-line takeaway. */
function stackInsight(data: Record<string, unknown>[], series: { key: string; label: string }[], good?: string[], bad?: string[]) {
  if (series.length < 2 || data.length < 2) return null;
  const tot = (r: Record<string, unknown>) => series.reduce((a, s) => a + (Number(r[s.key]) || 0), 0);
  const cur = data[data.length - 1], prev = data[data.length - 2];
  const tc = tot(cur), tp = tot(prev);
  if (!tc || !tp) return null;
  let best = series[0], delta = 0;
  for (const s of series) {
    const d = (Number(cur[s.key]) / tc - Number(prev[s.key]) / tp) * 100;
    if (Math.abs(d) > Math.abs(delta)) { delta = d; best = s; }
  }
  const share = (Number(cur[best.key]) / tc) * 100;
  const tone = good?.includes(best.label) ? (delta >= 0 ? "positive" : "negative") : bad?.includes(best.label) ? (delta >= 0 ? "negative" : "positive") : "neutral";
  const totals = data.map(tot);
  const peak = totals.indexOf(Math.max(...totals.slice(0, -1)));
  return `{{metric:${best.label}|${share.toFixed(1)}%|neutral}} of ${MONTHS[MONTHS.length - 1].label} (MTD), the biggest mix shift at {{metric:|${pts(delta)}|${tone}}} vs ${MONTHS[MONTHS.length - 2].label}. Highest full month: ${MONTHS[peak].label}.`;
}

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
  rows, cats, agg, fmt = fmtN, axis, onDrill, height = "h-72", stacked = true, type = "bar", good, bad, yLabel = "Number of trips",
}: {
  yLabel?: string;
  rows: T[]; cats: Cat<T>[]; agg?: (rs: T[]) => number; fmt?: (v: number) => string; axis?: (v: number) => string;
  onDrill?: (label: string, rows: T[]) => void; height?: string; stacked?: boolean; type?: "bar" | "line" | "area"; good?: string[]; bad?: string[];
}) {
  const m = monthly(rows, cats, agg);
  useAutoInsight(stackInsight(m.data, m.series, good, bad));
  return (
    <AxisFrame y={yLabel} x={X_MONTH}>
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
    </AxisFrame>
  );
}

/** Stacked monthly bars with a percentage line on the right axis. */
export function MonthlyWithRate<T extends { mk: string }>({
  rows, cats, rate, rateLabel, onDrill, height = "h-72", fmt = fmtN, higherIsBetter = true, yLabel = "Number of trips",
}: {
  yLabel?: string;
  rows: T[]; cats: Cat<T>[]; rate: (rs: T[]) => number | null; rateLabel: string; onDrill?: (label: string, rows: T[]) => void; height?: string; fmt?: (v: number) => string; higherIsBetter?: boolean;
}) {
  const m = monthly(rows, cats);
  const data = m.data.map((d, i) => ({ ...d, rate: rate(rows.filter((r) => r.mk === MONTHS[i].key)) }));
  const pairs = data.map((d, i) => ({ v: d.rate, m: MONTHS[i].label })).filter((x): x is { v: number; m: string } => x.v != null);
  const rates = pairs.map((x) => x.v);
  let text: string | null = null;
  if (rates.length >= 3) {
    const last = rates[rates.length - 1];
    const base = rates.slice(0, -1).reduce((a, b) => a + b, 0) / (rates.length - 1);
    const d = last - base;
    const best = rates.indexOf(higherIsBetter ? Math.max(...rates) : Math.min(...rates));
    const tone = Math.abs(d) < 0.3 ? "neutral" : (d > 0) === higherIsBetter ? "positive" : "negative";
    text = `${rateLabel} is {{metric:${MONTHS[MONTHS.length - 1].label}|${last.toFixed(1)}%|neutral}}, {{metric:|${pts(d)}|${tone}}} against the prior 5-month average. Best month: ${pairs[best]?.m}.`;
  }
  useAutoInsight(text);
  return (
    <AxisFrame y={`${yLabel} (bars)`} y2={`${rateLabel} (line)`} x={X_MONTH}>
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
    </AxisFrame>
  );
}
