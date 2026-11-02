/** Executes a declarative QuerySpec against the semantic layer. Pure TS: runs in the browser and on the server. */
import { DATASETS, dataset, type Dataset, type Row } from "./catalog";

export type ChartType = "bar" | "horizontal_bar" | "stacked_bar" | "line" | "area" | "combo" | "donut" | "bar_list" | "heatmap" | "kpi" | "table";
export interface Filter { field: string; op: "in" | "not_in"; values: string[] }
export interface QuerySpec {
  dataset: string;
  measures: string[];
  dimension: string | null;
  series: string | null;
  filters: Filter[];
  sort: "desc" | "asc" | "natural";
  limit: number | null;
  chart: ChartType;
  title: string;
}

export interface ResultRow { label: string; series?: string; values: Record<string, number | null> }
export interface QueryResult {
  spec: QuerySpec;
  ds: Dataset;
  rows: ResultRow[];
  seriesKeys: string[];
  totals: Record<string, number | null>;
  matched: number;
  error?: string;
}

/** JSON schema for QuerySpec — used for strict tool use, so Claude's specs always validate. */
export const QUERY_SPEC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["dataset", "measures", "dimension", "series", "filters", "sort", "limit", "chart", "title"],
  properties: {
    dataset: { type: "string", enum: DATASETS.map((d) => d.key), description: "Which dataset to query." },
    measures: { type: "array", items: { type: "string" }, description: "1–3 measure keys from the chosen dataset. For combo charts give exactly 2 (bars, then line)." },
    dimension: { type: ["string", "null"], description: "Dimension key to group by (x-axis / categories), or null for a single total." },
    series: { type: ["string", "null"], description: "Optional second dimension to split each group by (stacked bars, multi-line, heatmap columns). Null for none." },
    filters: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["field", "op", "values"],
        properties: { field: { type: "string" }, op: { type: "string", enum: ["in", "not_in"] }, values: { type: "array", items: { type: "string" } } },
      },
      description: "Row filters on dimension values. Use exact values from the catalog.",
    },
    sort: { type: "string", enum: ["desc", "asc", "natural"], description: "Sort groups by the first measure, or keep natural/time order." },
    limit: { type: ["integer", "null"], description: "Keep only the top N groups after sorting, or null for all." },
    chart: { type: "string", enum: ["bar", "horizontal_bar", "stacked_bar", "line", "area", "combo", "donut", "bar_list", "heatmap", "kpi", "table"], description: "Best chart for the question: line/area for trends over time, horizontal_bar or bar_list for rankings, stacked_bar for composition, donut only for ≤6 parts of a whole, heatmap for two dimensions, combo for a volume measure plus a rate, kpi for single numbers, table for detail." },
    title: { type: "string", description: "Short chart title in sentence case." },
  },
} as const;

const keyOf = (v: unknown) => (v == null ? null : String(v));

/** Rows of a dataset that pass every filter (case-insensitive exact match on dimension values). */
export function applyFilters(rows: Row[], filters: Filter[]): Row[] {
  if (!filters.length) return rows;
  return rows.filter((r) => filters.every((f) => {
    if (!f.values.length) return true;
    const v = keyOf(r[f.field]);
    const hit = v != null && f.values.some((x) => x.toLowerCase() === v.toLowerCase());
    return f.op === "in" ? hit : !hit;
  }));
}

/** Natural order of a dimension's values: explicit order, chronological for days, else alphabetical. */
export function orderValues(ds: Dataset, dim: string, values: string[], rows?: Row[]): string[] {
  const def = ds.dims.find((d) => d.key === dim);
  const out = [...values];
  if (def?.order) return out.sort((a, b) => def.order!.indexOf(a) - def.order!.indexOf(b));
  if (def?.time === "day") {
    const ts = new Map<string, number>();
    for (const r of rows ?? ds.rows()) { const k = keyOf(r[dim]); if (k != null && !ts.has(k)) ts.set(k, Number(r.day_ts)); }
    return out.sort((a, b) => (ts.get(a) ?? 0) - (ts.get(b) ?? 0));
  }
  return out.sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

export function execute(spec: QuerySpec): QueryResult {
  const ds = dataset(spec.dataset) ?? DATASETS[0];
  const fail = (error: string): QueryResult => ({ spec, ds, rows: [], seriesKeys: [], totals: {}, matched: 0, error });
  if (!dataset(spec.dataset)) return fail(`Unknown dataset "${spec.dataset}". Use one of: ${DATASETS.map((d) => d.key).join(", ")}.`);
  const measures = spec.measures.map((k) => ds.measures.find((m) => m.key === k));
  const bad = spec.measures.filter((_, i) => !measures[i]);
  if (!spec.measures.length || bad.length) return fail(`Unknown measure(s) ${bad.join(", ") || "(none given)"} for "${ds.key}". Valid: ${ds.measures.map((m) => m.key).join(", ")}.`);
  for (const d of [spec.dimension, spec.series, ...spec.filters.map((f) => f.field)]) {
    if (d && !ds.dims.find((x) => x.key === d)) return fail(`Unknown dimension "${d}" for "${ds.key}". Valid: ${ds.dims.map((x) => x.key).join(", ")}.`);
  }
  const ms = measures as NonNullable<(typeof measures)[number]>[];
  const rows = ds.rows().filter((r) => spec.filters.every((f) => {
    const v = keyOf(r[f.field]);
    const hit = v != null && f.values.some((x) => x.toLowerCase() === v.toLowerCase());
    return f.op === "in" ? hit : !hit;
  }));
  const totals = Object.fromEntries(ms.map((m) => [m.key, m.agg(rows)]));
  if (!spec.dimension) return { spec, ds, rows: [{ label: "Total", values: totals }], seriesKeys: [], totals, matched: rows.length };

  const dimDef = ds.dims.find((d) => d.key === spec.dimension)!;
  const groups = new Map<string, Map<string, Row[]>>();
  const seriesSet = new Set<string>();
  for (const r of rows) {
    const g = keyOf(r[spec.dimension]); if (g == null) continue;
    const s = spec.series ? keyOf(r[spec.series]) : "__all"; if (s == null) continue;
    seriesSet.add(s);
    if (!groups.has(g)) groups.set(g, new Map());
    const m = groups.get(g)!; if (!m.has(s)) m.set(s, []); m.get(s)!.push(r);
  }
  let labels = [...groups.keys()];
  // Natural order: explicit dim order, else chronological for days, else alphabetical.
  if (dimDef.order) labels.sort((a, b) => dimDef.order!.indexOf(a) - dimDef.order!.indexOf(b));
  else if (dimDef.time === "day") {
    const ts = (l: string) => Math.min(...[...groups.get(l)!.values()].flat().map((r) => Number(r.day_ts)));
    labels.sort((a, b) => ts(a) - ts(b));
  } else labels.sort();
  const first = ms[0];
  const groupTotal = (l: string) => first.agg([...groups.get(l)!.values()].flat()) ?? 0;
  if (spec.sort !== "natural" && !(dimDef.time && spec.sort === "desc" && ["line", "area", "combo"].includes(spec.chart))) {
    labels.sort((a, b) => (spec.sort === "desc" ? groupTotal(b) - groupTotal(a) : groupTotal(a) - groupTotal(b)));
  }
  if (spec.limit && spec.limit > 0) labels = labels.slice(0, spec.limit);

  const seriesDef = spec.series ? ds.dims.find((d) => d.key === spec.series) : undefined;
  let seriesKeys = spec.series ? [...seriesSet] : [];
  if (seriesDef?.order) seriesKeys.sort((a, b) => seriesDef.order!.indexOf(a) - seriesDef.order!.indexOf(b));
  else seriesKeys.sort((a, b) => {
    const t = (s: string) => first.agg(labels.flatMap((l) => groups.get(l)!.get(s) ?? [])) ?? 0;
    return t(b) - t(a);
  });
  if (seriesKeys.length > 8) seriesKeys = seriesKeys.slice(0, 8);

  const out: ResultRow[] = [];
  for (const l of labels) {
    const m = groups.get(l)!;
    if (spec.series) for (const s of seriesKeys) out.push({ label: l, series: s, values: Object.fromEntries(ms.map((x) => [x.key, m.has(s) ? x.agg(m.get(s)!) : null])) });
    else out.push({ label: l, values: Object.fromEntries(ms.map((x) => [x.key, x.agg([...m.values()].flat())])) });
  }
  return { spec, ds, rows: out, seriesKeys, totals, matched: rows.length };
}

/* ------------------------------- formatting -------------------------------- */
export function fmt(v: number | null | undefined, format: string, compact = false) {
  if (v == null || Number.isNaN(v)) return "–";
  if (format === "pct") return v.toFixed(1) + "%";
  if (format === "hours") return v.toFixed(1) + " h";
  if (format === "inr_per_km") return "₹" + v.toFixed(1);
  if (format === "km") return Math.round(v).toLocaleString("en-IN") + " km";
  if (format === "inr") {
    const a = Math.abs(v);
    if (a >= 1e7) return "₹" + (v / 1e7).toFixed(compact ? 1 : 2) + (compact ? "Cr" : " Cr");
    if (a >= 1e5) return "₹" + (v / 1e5).toFixed(compact ? 1 : 2) + (compact ? "L" : " L");
    if (compact && a >= 1e3) return "₹" + (v / 1e3).toFixed(1) + "k";
    return "₹" + Math.round(v).toLocaleString("en-IN");
  }
  if (compact && Math.abs(v) >= 1e5) return (v / 1e5).toFixed(1) + "L";
  if (compact && Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + "k";
  return Math.round(v).toLocaleString("en-IN");
}

/** Compact, model-friendly rendering of a result (sent back to Claude as the tool result). */
export function resultForModel(r: QueryResult) {
  if (r.error) return JSON.stringify({ error: r.error });
  const ms = r.spec.measures.map((k) => r.ds.measures.find((m) => m.key === k)!);
  return JSON.stringify({
    matched_rows: r.matched,
    totals: Object.fromEntries(ms.map((m) => [m.key, fmt(r.totals[m.key], m.format)])),
    groups: r.rows.slice(0, 60).map((x) => ({ [r.spec.dimension ?? "group"]: x.label, ...(x.series ? { [r.spec.series!]: x.series } : {}), ...Object.fromEntries(ms.map((m) => [m.key, fmt(x.values[m.key], m.format)])) })),
    truncated: r.rows.length > 60,
  });
}

/* -------------------------------- insights --------------------------------- */
/** Deterministic takeaways computed from the result — numbers are always real. */
export function insightsFor(r: QueryResult): string[] {
  if (r.error || !r.rows.length) return [];
  const m = r.ds.measures.find((x) => x.key === r.spec.measures[0])!;
  const f = (v: number | null) => fmt(v, m.format);
  const out: string[] = [];
  const additive = ["number", "inr", "km"].includes(m.format);
  // Collapse series for single-dimension takeaways.
  const byLabel = new Map<string, number>();
  if (r.spec.series) {
    const raw = r.ds.rows();
    for (const l of new Set(r.rows.map((x) => x.label))) {
      const rs = raw.filter((row) => String(row[r.spec.dimension!]) === l && r.spec.filters.every((fl) => { const v = row[fl.field]; const hit = v != null && fl.values.some((x) => x.toLowerCase() === String(v).toLowerCase()); return fl.op === "in" ? hit : !hit; }));
      byLabel.set(l, m.agg(rs) ?? 0);
    }
  } else r.rows.forEach((x) => byLabel.set(x.label, x.values[m.key] ?? 0));
  const entries = [...byLabel.entries()].filter(([, v]) => v != null);
  if (!r.spec.dimension) {
    out.push(`{{metric:${m.label}|${f(r.totals[m.key])}|neutral}} across ${r.matched.toLocaleString("en-IN")} records.`);
    return out;
  }
  const dimDef = r.ds.dims.find((d) => d.key === r.spec.dimension)!;
  if (dimDef.time && entries.length >= 3) {
    const ordered = dimDef.order ? entries.sort((a, b) => dimDef.order!.indexOf(a[0]) - dimDef.order!.indexOf(b[0])) : entries;
    const firstV = ordered[0][1], last = ordered[ordered.length - 1], prev = ordered[ordered.length - 2];
    const up = last[1] >= prev[1];
    const good = m.higherIsBetter === undefined ? "neutral" : up === m.higherIsBetter ? "positive" : "negative";
    const delta = m.format === "pct" ? `${(last[1] - prev[1] >= 0 ? "+" : "")}${(last[1] - prev[1]).toFixed(1)} pts` : prev[1] ? `${last[1] >= prev[1] ? "+" : ""}${(((last[1] - prev[1]) / prev[1]) * 100).toFixed(1)}%` : "–";
    out.push(`${m.label} is {{metric:${last[0]}|${f(last[1])}|neutral}}, {{metric:|${delta}|${good}}} vs ${prev[0]}${dimDef.key === "month" ? " (current month is month-to-date)" : ""}.`);
    const peak = ordered.reduce((a, b) => (b[1] > a[1] ? b : a));
    const low = ordered.reduce((a, b) => (b[1] < a[1] ? b : a));
    out.push(`Peak {{metric:${peak[0]}|${f(peak[1])}|neutral}}, low {{metric:${low[0]}|${f(low[1])}|neutral}}${firstV ? ` · ${(((last[1] - firstV) / Math.abs(firstV)) * 100).toFixed(0)}% change since ${ordered[0][0]}` : ""}.`);
  } else {
    const sorted = [...entries].sort((a, b) => b[1] - a[1]);
    const top = sorted[0], bottom = sorted[sorted.length - 1];
    const totalV = additive ? sorted.reduce((a, b) => a + b[1], 0) : null;
    const topGood = m.higherIsBetter === undefined ? "neutral" : m.higherIsBetter ? "positive" : "negative";
    const botGood = m.higherIsBetter === undefined ? "neutral" : m.higherIsBetter ? "negative" : "positive";
    out.push(`{{metric:${top[0]}|${f(top[1])}|${topGood}}} is highest${totalV ? ` with ${((top[1] / totalV) * 100).toFixed(0)}% of the total` : ""}; {{metric:${bottom[0]}|${f(bottom[1])}|${botGood}}} is lowest.`);
    if (additive && totalV && sorted.length >= 5) {
      const top3 = sorted.slice(0, 3).reduce((a, b) => a + b[1], 0);
      out.push(`Top 3 of ${sorted.length} make up {{metric:|${((top3 / totalV) * 100).toFixed(0)}%|neutral}} — ${top3 / totalV > 0.6 ? "a concentrated mix" : "a fairly spread mix"}.`);
    } else if (!additive && sorted.length >= 3) {
      const mean = sorted.reduce((a, b) => a + b[1], 0) / sorted.length;
      out.push(`Spread is ${f(top[1] - bottom[1])} between best and worst; average ${f(mean)}.`);
    }
  }
  return out;
}

/** Make a model-written spec safe to render (clamp chart choices that don't fit the data). */
export function normalize(spec: QuerySpec): QuerySpec {
  const s: QuerySpec = { ...spec, filters: spec.filters ?? [], measures: (spec.measures ?? []).slice(0, 3) };
  if (!s.dimension && s.chart !== "table") s.chart = "kpi";
  if (s.chart === "heatmap" && !s.series) s.chart = "bar";
  if (s.chart === "stacked_bar" && !s.series) s.chart = "bar";
  if (s.chart === "combo" && s.measures.length < 2) s.chart = "bar";
  if (s.chart === "donut" && s.series) s.chart = "stacked_bar";
  return s;
}
