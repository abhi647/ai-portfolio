/**
 * Offline mode: a keyword parser that turns a question into a QuerySpec when no Claude
 * credentials are configured on the server. Good for common questions, not open-ended ones.
 */
import { DATASETS, dataset, dimValues, type Dataset } from "./catalog";
import { execute, fmt, insightsFor, normalize, type ChartType, type Filter, type QuerySpec, type QueryResult } from "./engine";
import type { AskFocus, AskMode, AskSource } from "./modes";

const has = (q: string, ...words: string[]) => words.some((w) => new RegExp(`\\b${w}`, "i").test(q));

function pickDataset(q: string, focus: AskFocus = "all"): Dataset {
  if (focus !== "all" && dataset(focus)) return dataset(focus)!;
  if (has(q, "margin", "p&l", "pnl", "net sales", "claims", "gross revenue", "cost of sales", "account", "blinkit", "zepto", "amazon", "flipkart", "instamart", "bigbasket", "e-?com")) return dataset("pnl")!;
  if (has(q, "cfa", "throughput")) return dataset("cfa")!;
  if (has(q, "sales", "target", "achievement", "asm", "zone", "region", "brand", "channel", "secondary")) return dataset("sales")!;
  if (has(q, "otif", "order", "indent", "auction", "approval", "backlog")) return dataset("orders")!;
  return dataset("trips")!;
}

const MEASURE_WORDS: Record<string, [string, string[]][]> = {
  trips: [
    ["cost_per_km", ["per km", "cost/km", "₹/km", "rate per", "cost per"]], ["detention_cost", ["detention cost", "detention ₹", "detention charges", "detention spend"]],
    ["detention_rate", ["detention rate", "detention %", "detained", "detention"]], ["tracking_rate", ["tracking", "gps", "tracked", "consent"]],
    ["avg_transit_h", ["transit time", "transit", "travel time"]], ["avg_plant_tat_h", ["plant tat", "turnaround", "inside plant", "loading time"]],
    ["shortage_rate", ["shortage", "short", "accuracy"]], ["freight", ["freight", "spend", "cost", "₹", "rupee", "expensive"]],
    ["cases", ["cases", "volume", "quantity", "qty"]], ["km", ["distance", "km", "kilomet"]], ["active_trips", ["active", "open trips", "in progress"]], ["trips", ["trips", "dispatch", "how many"]],
  ],
  orders: [
    ["otif_pct", ["otif", "on time", "in full", "service level"]], ["avg_approval_to_dispatch_h", ["cycle time", "lead time", "approval to dispatch", "how long"]],
    ["avg_approval_to_indent_h", ["indent time", "approval to indent"]], ["open_orders", ["open", "pending", "backlog"]],
    ["dispatched_qty", ["dispatched qty", "dispatched"]], ["qty", ["qty", "quantity", "cases", "volume"]], ["orders", ["orders", "how many"]],
  ],
  sales: [["achievement_pct", ["achievement", "% of target", "vs target", "against target", "on track", "behind"]], ["gap_to_target", ["gap", "shortfall"]], ["target", ["target"]], ["sales", ["sales", "revenue", "sold"]]],
  cfa: [["avg_cases_per_day", ["per day", "average", "avg", "daily"]], ["cases", ["cases", "throughput", "dispatch", "volume"]]],
  pnl: [["margin_pct", ["margin %", "margin percent", "margin rate", "profitab", "margin"]], ["claims_pct", ["claims %", "scheme rate"]], ["claims", ["claims", "schemes"]], ["net_sales", ["net sales", "net"]], ["cost_of_sales", ["cost of sales", "cogs", "material cost"]], ["gross_revenue", ["gross", "revenue"]], ["material_margin", ["material margin"]]],
};

const DIM_WORDS: Record<string, [string, string[]][]> = {
  trips: [["transporter", ["transporter", "carrier", "vendor"]], ["destination", ["destination", "city", "lane", "route", "where"]], ["plant", ["plant", "origin", "warehouse", "location"]], ["fleet", ["fleet", "contracted vs market", "market vs contracted", "own"]], ["stage", ["stage", "status"]], ["order_type", ["order type", "direct", "indent"]], ["vehicle_length", ["vehicle length", "truck size", "ft"]], ["distance_slab", ["distance slab", "distance band", "slab"]], ["payment_status", ["payment"]], ["customer", ["customer"]], ["weekday", ["weekday", "day of week"]], ["day", ["daily", "per day", "by day", "each day", "day-wise", "date", "last 30 days"]], ["month", ["month", "trend", "over time", "monthly"]]],
  orders: [["destination", ["destination", "city", "where"]], ["plant", ["plant", "location"]], ["order_type", ["order type", "stock transfer", "direct"]], ["stage", ["stage", "status"]], ["product_type", ["product type", "pack"]], ["otif_status", ["otif status", "met", "missed"]], ["source", ["indent vs auction", "source", "auction"]], ["customer", ["customer"]], ["weekday", ["weekday"]], ["day", ["daily", "per day", "by day", "each day", "day-wise", "date"]], ["month", ["month", "trend", "over time", "monthly"]]],
  sales: [["asm", ["asm", "sales manager", "salesperson", "who"]], ["region", ["region"]], ["zone", ["zone"]], ["brand", ["brand", "product"]], ["channel", ["channel"]], ["month", ["month", "trend", "over time", "monthly"]]],
  cfa: [["cfa", ["cfa", "which"]], ["weekday", ["weekday", "day of week"]], ["day", ["daily", "per day", "by day", "each day", "day-wise", "date"]], ["month", ["month", "monthly", "trend"]]],
  pnl: [["account", ["account", "platform", "marketplace", "which"]], ["month", ["month", "trend", "over time", "monthly"]]],
};

function pickMeasure(ds: Dataset, q: string): string[] {
  const found: string[] = [];
  for (const [k, words] of MEASURE_WORDS[ds.key] ?? []) if (words.some((w) => q.toLowerCase().includes(w))) found.push(k);
  const uniq = [...new Set(found)];
  return uniq.length ? uniq.slice(0, 2) : [ds.measures[0].key];
}

function pickDims(ds: Dataset, q: string): string[] {
  const ql = q.toLowerCase();
  // Words after the last " by " / " per " name the breakdown, so they win over earlier mentions.
  const cut = Math.max(ql.lastIndexOf(" by "), ql.lastIndexOf(" per "), ql.lastIndexOf(" for each "));
  const hits: { k: string; i: number }[] = [];
  for (const [k, words] of DIM_WORDS[ds.key] ?? []) {
    const idx = words.map((w) => ql.indexOf(w)).filter((i) => i >= 0);
    if (idx.length) { const i = Math.min(...idx); hits.push({ k, i: cut >= 0 && i > cut ? i - 1e6 : i }); }
  }
  return [...new Set(hits.sort((a, b) => a.i - b.i).map((h) => h.k))];
}

function pickFilters(ds: Dataset, q: string, used: string[]): Filter[] {
  const out: Filter[] = [];
  const ql = ` ${q.toLowerCase()} `;
  for (const d of ds.dims) {
    if (d.time === "day") continue;
    const vals = dimValues(ds, d.key, 400).filter((v) => v.length > 2 && new RegExp(`(^|[^a-z0-9])${v.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(ql));
    // Several values of a dimension we're already grouping by ("market vs contracted") is a comparison, not a filter.
    if (vals.length && !(used.includes(d.key) && vals.length > 1)) out.push({ field: d.key, op: "in", values: vals });
  }
  // "this month" / "last month"
  const months = dimValues(ds, "month", 12);
  if (months.length && !out.some((f) => f.field === "month")) {
    if (/\bthis month|mtd\b/i.test(q)) out.push({ field: "month", op: "in", values: [months[months.length - 1]] });
    else if (/\blast month\b/i.test(q)) out.push({ field: "month", op: "in", values: [months[months.length - 2]] });
  }
  return out;
}

export function parseQuestion(q: string, focus: AskFocus = "all"): QuerySpec {
  const ds = pickDataset(q, focus);
  const measures = pickMeasure(ds, q);
  const dims = pickDims(ds, q);
  const filters = pickFilters(ds, q, dims);
  const filteredDims = new Set(filters.filter((f) => f.values.length === 1).map((f) => f.field));
  const usable = dims.filter((d) => !filteredDims.has(d));
  let dimension: string | null = usable[0] ?? null;
  let series: string | null = usable[1] ?? null;
  const timeDims = ["month", "day", "weekday"];
  if (series && timeDims.includes(series) && dimension && !timeDims.includes(dimension)) [dimension, series] = [series, dimension];
  if (!dimension && /\b(which|top|best|worst|rank|most|least|compare|breakdown|split)\b/i.test(q)) dimension = ds.dims.find((d) => !d.time)?.key ?? null;
  const topN = q.match(/\b(?:top|bottom|best|worst)\s+(\d{1,2})\b/i);
  const m0Def = ds.measures.find((m) => m.key === measures[0])!;
  const worstWord = /\b(worst|bottom|least|slowest|lowest)\b/i.test(q);
  // "Worst" means highest for cost-like measures (lower is better) and lowest otherwise; "lowest" is always literal.
  const worst = /\blowest|least\b/i.test(q) || (worstWord && m0Def.higherIsBetter !== false);
  const isTime = !!dimension && timeDims.includes(dimension);
  let chart: ChartType = "horizontal_bar";
  if (!dimension) chart = "kpi";
  else if (series) chart = isTime ? (dimension === "day" || /\bheat ?map|matrix\b/i.test(q) ? "heatmap" : "line") : /\bheat ?map|matrix\b/i.test(q) ? "heatmap" : "stacked_bar";
  else if (isTime) chart = measures.length === 2 ? "combo" : dimension === "weekday" ? "bar" : "line";
  else if (/\b(share|mix|split|composition|proportion)\b/i.test(q)) chart = "donut";
  else if (/\btable|list\b/i.test(q)) chart = "table";
  const m0 = ds.measures.find((m) => m.key === measures[0])!;
  const dimLabel = ds.dims.find((d) => d.key === dimension)?.label.toLowerCase();
  const seriesLabel = ds.dims.find((d) => d.key === series)?.label.toLowerCase();
  return normalize({
    dataset: ds.key, measures: chart === "combo" ? measures : measures.slice(0, 1), dimension, series, filters,
    sort: isTime ? "natural" : worst ? "asc" : "desc", limit: topN ? Number(topN[1]) : isTime ? null : 12, chart,
    title: `${m0.label}${dimLabel ? ` by ${dimLabel}` : ""}${seriesLabel ? ` and ${seriesLabel}` : ""}${filters.length ? ` · ${filters.map((f) => f.values.join(", ")).join(" · ")}` : ""}`,
  });
}

const plain = (t: string) => t.replace(/\{\{metric:([^|}]*)\|?([^|}]*)\|?[^}]*\}\}/g, (_m, a, b) => [a, b].filter(Boolean).join(" "));
const stepOf = (spec: QuerySpec, r: QueryResult) => ({ label: spec.title, detail: `${spec.dataset} · ${spec.measures.join(", ")}${spec.dimension ? ` by ${spec.dimension}` : ""} → ${r.rows.length} rows`, ok: !r.error });

export interface LocalAnswer { answer: string; charts: QuerySpec[]; followUps: string[]; steps: { label: string; detail?: string; ok: boolean }[]; sources: AskSource[] }

/** Offline answers for every mode: the same parser, plus extra queries for Research and Compare. */
export function answerLocally(q: string, mode: AskMode = "quick", focus: AskFocus = "all"): LocalAnswer {
  const spec = parseQuestion(q, focus);
  const ds = dataset(spec.dataset)!;
  const m0 = ds.measures.find((m) => m.key === spec.measures[0])!;
  const sources: AskSource[] = [];
  const steps: LocalAnswer["steps"] = [];
  const run = (s: QuerySpec) => {
    const r = execute(s);
    steps.push(stepOf(s, r));
    if (!r.error) sources.push({ id: sources.length + 1, dataset: s.dataset, title: s.title, detail: `${s.measures.join(", ")}${s.dimension ? ` by ${s.dimension}` : ""}${s.filters.length ? ` · ${s.filters.map((f) => f.values.join(", ")).join(" · ")}` : ""}`, rows: r.matched, spec: s });
    return { r, n: sources.length };
  };
  const main = run(spec);
  const followUps = suggest(spec, ds);
  if (main.r.error) return { answer: `I couldn’t map that to the data (${main.r.error}). Try naming a measure and a breakdown, e.g. “freight by transporter this month”.`, charts: [], followUps, steps, sources };
  if (!main.r.rows.length) return { answer: "No records match that question — try removing a filter or widening the period.", charts: [], followUps, steps, sources };
  const ins = insightsFor(main.r);
  const months = dimValues(ds, "month", 12);
  const hasMonth = ds.dims.some((d) => d.key === "month");
  const breakdownDim = ds.dims.find((d) => !d.time && d.key !== spec.dimension && !spec.filters.some((f) => f.field === d.key))?.key;

  if (mode === "brief") {
    const total = main.r.totals[m0.key];
    const bullets = [
      `- **${m0.label}**: ${fmt(total, m0.format)} across ${main.r.matched.toLocaleString("en-IN")} records [1]`,
      ...(spec.dimension ? ins.map((x) => `- ${x} [1]`) : []),
    ];
    if (!spec.dimension && breakdownDim) {
      const bd = run({ ...spec, dimension: breakdownDim, series: null, chart: "horizontal_bar", sort: "desc", limit: 8, title: `${m0.label} by ${ds.dims.find((d) => d.key === breakdownDim)!.label.toLowerCase()}` });
      insightsFor(bd.r).slice(0, 2).forEach((x) => bullets.push(`- ${x} [${bd.n}]`));
    }
    if (hasMonth && spec.dimension !== "month") {
      const t = run({ ...spec, dimension: "month", series: null, chart: "line", sort: "natural", limit: null, filters: spec.filters.filter((f) => f.field !== "month"), title: `${m0.label} by month` });
      const ti = insightsFor(t.r)[0];
      if (ti) bullets.push(`- ${ti} [${t.n}]`);
    }
    return { answer: bullets.slice(0, 5).join("\n"), charts: [spec.dimension ? { ...spec, limit: Math.min(spec.limit ?? 8, 8) } : spec], followUps, steps, sources };
  }

  if (mode === "compare" && hasMonth && months.length >= 2) {
    const [prev, cur] = months.slice(-2);
    const dim = spec.dimension && spec.dimension !== "month" ? spec.dimension : breakdownDim ?? null;
    const base = { ...spec, filters: spec.filters.filter((f) => f.field !== "month") };
    const tot = run({ ...base, dimension: "month", series: null, chart: "bar", sort: "natural", limit: null, filters: [...base.filters, { field: "month", op: "in", values: [prev, cur] }], title: `${m0.label}: ${prev} vs ${cur}` });
    const a = tot.r.rows.find((x) => x.label === prev)?.values[m0.key] ?? null, b = tot.r.rows.find((x) => x.label === cur)?.values[m0.key] ?? null;
    const change = a != null && b != null ? (m0.format === "pct" ? `${b - a >= 0 ? "+" : ""}${(b - a).toFixed(1)} pts` : a ? `${b >= a ? "+" : ""}${(((b - a) / Math.abs(a)) * 100).toFixed(1)}%` : "–") : "–";
    const tone = a == null || b == null || m0.higherIsBetter === undefined ? "neutral" : (b >= a) === m0.higherIsBetter ? "positive" : "negative";
    const parts = [`${m0.label} is {{metric:${cur}|${fmt(b, m0.format)}|neutral}} against {{metric:${prev}|${fmt(a, m0.format)}|neutral}} — {{metric:change|${change}|${tone}}} [${tot.n}]. ${cur} is month-to-date, so additive totals are partial.`];
    const charts: QuerySpec[] = [];
    if (dim) {
      const cmp = run({ ...base, dimension: dim, series: "month", chart: "bar", sort: "desc", limit: 8, filters: [...base.filters, { field: "month", op: "in", values: [prev, cur] }], title: `${m0.label} by ${ds.dims.find((d) => d.key === dim)!.label.toLowerCase()} · ${prev} vs ${cur}` });
      const by = new Map<string, { a: number | null; b: number | null }>();
      for (const row of cmp.r.rows) { const e = by.get(row.label) ?? { a: null, b: null }; if (row.series === prev) e.a = row.values[m0.key]; else e.b = row.values[m0.key]; by.set(row.label, e); }
      const movers = [...by.entries()].filter(([, v]) => v.a != null && v.b != null).map(([k, v]) => ({ k, d: (v.b as number) - (v.a as number) })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 3);
      if (movers.length) parts.push(`Biggest movers: ${movers.map((mv) => `{{metric:${mv.k}|${mv.d >= 0 ? "+" : "−"}${fmt(Math.abs(mv.d), m0.format)}|${m0.higherIsBetter === undefined ? "neutral" : (mv.d >= 0) === m0.higherIsBetter ? "positive" : "negative"}}}`).join(", ")} [${cmp.n}].`);
      charts.push(cmp.r.spec);
    }
    charts.push(tot.r.spec);
    return { answer: parts.join(" "), charts, followUps, steps, sources };
  }

  if (mode === "research") {
    const charts: QuerySpec[] = spec.dimension ? [spec] : [];
    const why: string[] = [];
    let lead = spec.dimension ? `${ins.join(" ")} [1]` : `${m0.label} is ${fmt(main.r.totals[m0.key], m0.format)} across ${main.r.matched.toLocaleString("en-IN")} records [1].`;
    if (hasMonth && spec.dimension !== "month") {
      const t = run({ ...spec, dimension: "month", series: null, chart: "line", sort: "natural", limit: null, filters: spec.filters.filter((f) => f.field !== "month"), title: `${m0.label} by month` });
      const ti = insightsFor(t.r);
      if (!spec.dimension && ti[0]) lead = `${ti[0]} [${t.n}]`;
      ti.slice(spec.dimension ? 0 : 1).forEach((x) => why.push(`- ${x} [${t.n}]`));
      charts.push(t.r.spec);
    }
    let driver: { label: string; n: number } | null = spec.dimension && main.r.rows[0] ? { label: main.r.rows[0].label, n: 1 } : null;
    const extraDims = ds.dims.filter((d) => !d.time && d.key !== spec.dimension && !spec.filters.some((f) => f.field === d.key)).slice(0, spec.dimension ? 1 : 2);
    for (const d of extraDims) {
      const b = run({ ...spec, dimension: d.key, series: null, chart: "horizontal_bar", sort: m0.higherIsBetter === false ? "desc" : "asc", limit: 8, title: `${m0.label} by ${d.label.toLowerCase()}` });
      insightsFor(b.r).forEach((x) => why.push(`- ${x} [${b.n}]`));
      if (!driver && b.r.rows[0]) driver = { label: `${b.r.rows[0].label} (${d.label.toLowerCase()})`, n: b.n };
      charts.push(b.r.spec);
    }
    const sections: string[] = [lead];
    if (why.length) sections.push("## What’s behind it\n" + why.slice(0, 5).join("\n"));
    const worstWord = m0.higherIsBetter === false ? "highest" : m0.higherIsBetter ? "lowest" : "largest";
    sections.push("## What to do\n" + [
      driver ? `- Start with **${driver.label}** — the ${worstWord} on ${m0.label.toLowerCase()}; review it with the owner this week [${driver.n}].` : null,
      `- Set a weekly check on ${m0.label.toLowerCase()} in **My dashboards** so a shift shows up before month-end.`,
    ].filter(Boolean).join("\n"));
    return { answer: sections.join("\n\n"), charts: charts.slice(0, 4), followUps, steps, sources };
  }

  return { answer: `${ins.join(" ")} [1] I read this as **${spec.title.toLowerCase()}** from ${ds.label}.`, charts: [spec], followUps, steps, sources };
}

function suggest(spec: QuerySpec, ds: Dataset) {
  const others = DATASETS.filter((d) => d.key !== ds.key).slice(0, 1);
  return [
    spec.dimension !== "month" && ds.dims.some((d) => d.key === "month") ? `Show ${ds.measures.find((m) => m.key === spec.measures[0])!.label.toLowerCase()} by month` : null,
    spec.dimension ? `Which ${ds.dims.find((d) => d.key === spec.dimension)!.label.toLowerCase()} is worst on ${ds.measures[Math.min(1, ds.measures.length - 1)].label.toLowerCase()}?` : null,
    `Compare ${ds.measures.find((m) => m.key === spec.measures[0])!.label.toLowerCase()} this month vs last month`,
    others[0] ? `What does ${others[0].label.split(" (")[0].toLowerCase()} look like this month?` : null,
  ].filter((x): x is string => !!x);
}

export { plain };
