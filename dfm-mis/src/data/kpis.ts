/**
 * Executive KPI layer: governed KPI definitions (owner, target, tolerance, direction) evaluated for a
 * reporting period and compared with target or the prior period. Values come from the semantic layer.
 */
import { dataset, type Row } from "../ai/catalog";
import { ACCOUNTS, MONTHS, NOW, plSum, today0 } from "./data";
import { DAY } from "./format";
import { salesTotal } from "./sales";

export type PeriodKey = "mtd" | "lm" | "l7d" | "r90";
export type CompareKey = "target" | "prior";
export interface Period { key: PeriodKey; label: string; start: Date; end: Date; prior: { start: Date; end: Date }; long: string }

const d0 = (y: number, m: number, d: number) => new Date(y, m, d);
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "mtd", label: "MTD" }, { key: "lm", label: "Last month" }, { key: "l7d", label: "Last 7 days" }, { key: "r90", label: "Rolling 90 days" },
];

export function period(key: PeriodKey): Period {
  const y = today0.getFullYear(), m = today0.getMonth(), day = today0.getDate();
  let start: Date, end: Date, ps: Date, pe: Date;
  if (key === "mtd") { start = d0(y, m, 1); end = today0; ps = d0(y, m - 1, 1); pe = d0(y, m - 1, Math.min(day, new Date(y, m, 0).getDate())); }
  else if (key === "lm") { start = d0(y, m - 1, 1); end = d0(y, m, 0); ps = d0(y, m - 2, 1); pe = d0(y, m - 1, 0); }
  else if (key === "l7d") { start = new Date(+today0 - 6 * DAY); end = today0; ps = new Date(+today0 - 13 * DAY); pe = new Date(+today0 - 7 * DAY); }
  else { start = new Date(+today0 - 89 * DAY); end = today0; ps = new Date(+today0 - 179 * DAY); pe = new Date(+today0 - 90 * DAY); }
  const label = PERIODS.find((p) => p.key === key)!.label;
  return { key, label, start, end, prior: { start: ps, end: pe }, long: `${label} · ${fmt(start)} – ${fmt(end)}` };
}

/* ------------------------------ evaluation helpers ------------------------------ */
const rowsIn = (ds: string, a: Date, b: Date) => dataset(ds)!.rows().filter((r: Row) => { const t = Number(r.day_ts); return t >= +a && t <= +endOfDay(b); });
const measure = (ds: string, key: string, a: Date, b: Date) => { const rs = rowsIn(ds, a, b); return rs.length ? dataset(ds)!.measures.find((m) => m.key === key)!.agg(rs) : null; };
/** P&L is monthly: use every month that overlaps the range (MTD for the current month). */
function pnlIn(a: Date, b: Date): { net: number; mm: number; months: number } {
  const keys = MONTHS.filter((m) => { const ms = m.date, me = new Date(ms.getFullYear(), ms.getMonth() + 1, 0); return ms <= b && me >= a; }).map((m) => m.key);
  const accs = ACCOUNTS.map((x) => x[0]);
  const tot = keys.map((k) => plSum(accs, k)).reduce((s, p) => ({ net: s.net + p.netSales, mm: s.mm + p.materialMargin }), { net: 0, mm: 0 });
  return { ...tot, months: keys.length };
}
const pnlVal = (a: Date, b: Date, f: (p: { net: number; mm: number }) => number | null) => { const p = pnlIn(a, b); return p.months ? f(p) : null;
}
const daysIn = (a: Date, b: Date) => Math.round((+b - +a) / DAY) + 1;

export type Unit = "inr" | "pct" | "inr_per_km" | "hours" | "number";
export interface KpiDef {
  key: string; fn: "Commercial" | "Supply chain" | "Secondary supply" | "E-commerce";
  label: string; unit: Unit; owner: string; better: "up" | "down";
  /** Amber band: relative for amounts (0.05 = 5%), absolute points for percentages. */
  tolerance: number;
  definition: string; source: string; metricId?: string;
  value: (a: Date, b: Date) => number | null;
  target: (a: Date, b: Date) => number | null;
}

const ECOM_BUDGET_PER_MONTH = 6.0e7; // ₹6.0 Cr net sales / month (FY27 AOP)

export const KPIS: KpiDef[] = [
  { key: "sales", fn: "Commercial", label: "Secondary sales", unit: "inr", owner: "VP Sales", better: "up", tolerance: 0.05, source: "DMS", metricId: "sales.sales",
    definition: "Distributor-to-retailer billing value, net of returns, from the DMS.", value: (a, b) => salesTotal([a, b]).sales, target: (a, b) => salesTotal([a, b]).target },
  { key: "ach", fn: "Commercial", label: "Sales achievement", unit: "pct", owner: "VP Sales", better: "up", tolerance: 5, source: "DMS", metricId: "sales.achievement_pct",
    definition: "Secondary sales ÷ pro-rated AOP target for the same days.", value: (a, b) => { const t = salesTotal([a, b]); return t.target ? (t.sales / t.target) * 100 : null; }, target: () => 100 },
  { key: "ecom", fn: "E-commerce", label: "E-com net sales", unit: "inr", owner: "Head – E-commerce", better: "up", tolerance: 0.05, source: "Marketplaces · ERP", metricId: "pnl.net_sales",
    definition: "Gross marketplace revenue less claims, schemes, expiry and SS commission.", value: (a, b) => pnlVal(a, b, (p) => p.net), target: (a, b) => { const p = pnlIn(a, b); return p.months * ECOM_BUDGET_PER_MONTH; } },
  { key: "margin", fn: "E-commerce", label: "E-com material margin", unit: "pct", owner: "Head – E-commerce", better: "up", tolerance: 1.5, source: "Marketplaces · ERP", metricId: "pnl.margin_pct",
    definition: "Material margin ÷ net sales across all marketplace accounts.", value: (a, b) => pnlVal(a, b, (p) => (p.net ? (p.mm / p.net) * 100 : null)), target: () => 52 },
  { key: "otif", fn: "Supply chain", label: "OTIF", unit: "pct", owner: "Head – Supply Chain", better: "up", tolerance: 3, source: "Traqo TMS · ERP", metricId: "orders.otif_pct",
    definition: "Quantity delivered on time and in full ÷ quantity due, for orders whose OTIF window has closed.", value: (a, b) => measure("orders", "otif_pct", a, b), target: () => 95 },
  { key: "cpk", fn: "Supply chain", label: "Freight cost per km", unit: "inr_per_km", owner: "Head – Logistics", better: "down", tolerance: 0.03, source: "Traqo TMS", metricId: "trips.cost_per_km",
    definition: "Total freight incl. detention and deductions ÷ total trip distance.", value: (a, b) => measure("trips", "cost_per_km", a, b), target: () => 51.5 },
  { key: "fpct", fn: "Supply chain", label: "Freight as % of sales", unit: "pct", owner: "Head – Logistics", better: "down", tolerance: 0.1, source: "Traqo TMS · DMS",
    definition: "Primary freight spend ÷ secondary sales for the same days.", value: (a, b) => { const s = salesTotal([a, b]).sales; const f = measure("trips", "freight", a, b); return s && f != null ? (f / s) * 100 : null; }, target: () => 1.1 },
  { key: "det", fn: "Supply chain", label: "Detention rate", unit: "pct", owner: "Head – Logistics", better: "down", tolerance: 3, source: "Traqo TMS", metricId: "trips.detention_rate",
    definition: "Share of ePOD-closed trips with system-calculated detention at destination.", value: (a, b) => measure("trips", "detention_rate", a, b), target: () => 12 },
  { key: "track", fn: "Supply chain", label: "GPS tracking adherence", unit: "pct", owner: "Head – Logistics", better: "up", tolerance: 5, source: "Traqo TMS", metricId: "trips.tracking_rate",
    definition: "Share of trips with driver consent for live GPS tracking.", value: (a, b) => measure("trips", "tracking_rate", a, b), target: () => 70 },
  { key: "short", fn: "Supply chain", label: "Shortage rate at ePOD", unit: "pct", owner: "Head – Supply Chain", better: "down", tolerance: 2, source: "Traqo TMS", metricId: "trips.shortage_rate",
    definition: "Share of delivered trips with a short-supply quantity recorded at ePOD.", value: (a, b) => measure("trips", "shortage_rate", a, b), target: () => 6 },
  { key: "transit", fn: "Supply chain", label: "Average transit time", unit: "hours", owner: "Head – Logistics", better: "down", tolerance: 0.08, source: "Traqo TMS", metricId: "trips.avg_transit_h",
    definition: "Gate-out at plant to reporting at destination, averaged over trips.", value: (a, b) => measure("trips", "avg_transit_h", a, b), target: () => 8.5 },
  { key: "cfa", fn: "Secondary supply", label: "CFA cases dispatched", unit: "number", owner: "Head – Secondary Supply", better: "up", tolerance: 0.05, source: "CFA WMS", metricId: "cfa.cases",
    definition: "Cases dispatched from all 10 CFAs to distributors.", value: (a, b) => measure("cfa", "cases", a, b),
    target: (a, b) => 14300 * daysIn(a, b) * (6 / 7) },
];

export type Rag = "green" | "amber" | "red";
export interface KpiResult { def: KpiDef; actual: number | null; target: number | null; prior: number | null; comparator: number | null; variance: number | null; variancePct: number | null; rag: Rag; trend: number[] }

/** Status is always judged against target, whatever the comparison column shows. */
export function ragFor(def: KpiDef, actual: number | null, target: number | null): Rag {
  if (actual == null || target == null) return "amber";
  const gap = def.better === "up" ? actual - target : target - actual;
  if (gap >= 0) return "green";
  const tol = def.unit === "pct" ? def.tolerance : Math.abs(target) * def.tolerance;
  return -gap <= tol ? "amber" : "red";
}

export function evaluate(p: Period, compare: CompareKey): KpiResult[] {
  return KPIS.map((def) => {
    const actual = def.value(p.start, p.end);
    const target = def.target(p.start, p.end);
    const prior = def.value(p.prior.start, p.prior.end);
    const comparator = compare === "target" ? target : prior;
    const variance = actual != null && comparator != null ? actual - comparator : null;
    const variancePct = variance != null && comparator ? (variance / Math.abs(comparator)) * 100 : null;
    const trend = MONTHS.map((m) => { const a = m.date, b = new Date(Math.min(+new Date(a.getFullYear(), a.getMonth() + 1, 0), +today0)); return def.value(a, b) ?? 0; });
    return { def, actual, target, prior, comparator, variance, variancePct, rag: ragFor(def, actual, target), trend };
  });
}

export const asOf = NOW;
