/**
 * The "semantic layer" Ask AI queries against. It is shared by the browser (to render
 * charts) and the server (so Claude can run queries) — so it must stay free of DOM/React.
 */
import {
  ACCOUNTS, ASMS, BRANDS, CFAS, CHANNELS, MONTHS, NOW, cfaQty, monthLabel, orders, pnl, tStage, oStage, today0, trips, asmDay, asmTarget,
} from "../data/data";
import { DAY, H, dayKey, fdDay, monthKey } from "../data/format";
import { mixFactor } from "../data/sales";

export type Row = Record<string, string | number | null>;
export interface Dim { key: string; label: string; time?: "month" | "day" | "weekday" | "hour"; order?: string[] }
export interface Measure { key: string; label: string; agg: (rows: Row[]) => number | null; format: "number" | "inr" | "pct" | "hours" | "km" | "inr_per_km"; higherIsBetter?: boolean }
export interface Dataset { key: string; label: string; description: string; dims: Dim[]; measures: Measure[]; rows: () => Row[] }

const sum = (rs: Row[], k: string) => rs.reduce((a, r) => a + (Number(r[k]) || 0), 0);
const cnt = (rs: Row[], pred: (r: Row) => boolean) => rs.filter(pred).length;
const ratio = (a: number, b: number) => (b ? a / b : null);
const avgOf = (rs: Row[], k: string) => { const v = rs.map((r) => r[k]).filter((x): x is number => typeof x === "number"); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const wd = (d: Date) => WEEKDAYS[(d.getDay() + 6) % 7];
const MONTH_ORDER = MONTHS.map((m) => m.label);
/** Month label, or null for dates outside the 6-month window (those rows drop out of month breakdowns). */
const ml = (key: string) => (MONTHS.some((m) => m.key === key) ? monthLabel(key) : null);
const slab = (km: number) => (km <= 50 ? "0–50 km" : km <= 100 ? "51–100 km" : km <= 300 ? "101–300 km" : ">300 km");
const recentDays = (d: Date) => (+today0 - +new Date(d.getFullYear(), d.getMonth(), d.getDate())) / DAY;

let tripRows: Row[] | null = null;
const TRIPS: Dataset = {
  key: "trips", label: "Trips (Traqo TMS)",
  description: "One row per truck trip from DFM plants to customers/CFAs over the last 6 months: freight, distance, stage, transporter, detention, tracking, payment.",
  dims: [
    { key: "month", label: "Month", time: "month", order: MONTH_ORDER }, { key: "day", label: "Day (last 30 days)", time: "day" }, { key: "weekday", label: "Weekday", time: "weekday", order: WEEKDAYS },
    { key: "plant", label: "Plant" }, { key: "destination", label: "Destination" }, { key: "transporter", label: "Transporter" }, { key: "fleet", label: "Fleet (contracted / market)" },
    { key: "stage", label: "Trip stage" }, { key: "order_type", label: "Order type" }, { key: "vehicle_length", label: "Vehicle length" }, { key: "distance_slab", label: "Distance slab", order: ["0–50 km", "51–100 km", "101–300 km", ">300 km"] },
    { key: "tracking", label: "GPS tracking" }, { key: "payment_status", label: "Payment status" }, { key: "customer", label: "Customer" },
  ],
  measures: [
    { key: "trips", label: "Trips", agg: (r) => r.length, format: "number" },
    { key: "freight", label: "Freight ₹", agg: (r) => sum(r, "freight"), format: "inr", higherIsBetter: false },
    { key: "km", label: "Distance km", agg: (r) => sum(r, "km"), format: "km" },
    { key: "cost_per_km", label: "Cost per km ₹", agg: (r) => ratio(sum(r, "freight"), sum(r, "km")), format: "inr_per_km", higherIsBetter: false },
    { key: "cases", label: "Cases shipped", agg: (r) => sum(r, "cases"), format: "number" },
    { key: "detention_cost", label: "Detention ₹", agg: (r) => sum(r, "detention"), format: "inr", higherIsBetter: false },
    { key: "detention_rate", label: "Detention rate %", agg: (r) => { const e = r.filter((x) => x.epod_done === 1); return e.length ? (cnt(e, (x) => Number(x.sys_detention) > 0) / e.length) * 100 : null; }, format: "pct", higherIsBetter: false },
    { key: "tracking_rate", label: "Tracking adherence %", agg: (r) => (r.length ? (cnt(r, (x) => x.tracking === "Tracked") / r.length) * 100 : null), format: "pct", higherIsBetter: true },
    { key: "avg_transit_h", label: "Avg transit hours", agg: (r) => avgOf(r, "transit_h"), format: "hours", higherIsBetter: false },
    { key: "avg_plant_tat_h", label: "Avg plant TAT hours", agg: (r) => avgOf(r, "plant_h"), format: "hours", higherIsBetter: false },
    { key: "shortage_rate", label: "Shortage rate %", agg: (r) => { const d = r.filter((x) => x.delivered === 1); return d.length ? (cnt(d, (x) => Number(x.short_qty) > 0) / d.length) * 100 : null; }, format: "pct", higherIsBetter: false },
    { key: "active_trips", label: "Active trips (not ePOD-closed)", agg: (r) => cnt(r, (x) => x.stage !== "ePOD Done"), format: "number" },
  ],
  rows: () => (tripRows ??= trips.map((t) => ({
    id: t.id, month: ml(t.mk), day: recentDays(t.created) < 30 ? fdDay(t.created) : null, day_ts: +new Date(t.created.getFullYear(), t.created.getMonth(), t.created.getDate()), weekday: wd(t.created),
    plant: t.loc, destination: t.dest, transporter: t.transporter, fleet: t.own, stage: tStage(t.stage).label, order_type: t.otype, vehicle_length: t.len + " ft",
    distance_slab: slab(t.km), tracking: t.consent === "ALLOWED" ? "Tracked" : "Not tracked", payment_status: t.payStatus || "Not due", customer: t.customer,
    freight: t.total, km: t.km, cases: t.invQty, detention: t.actDet, sys_detention: t.sysDet, epod_done: t.epodDone ? 1 : 0, delivered: t.stageIdx >= 6 ? 1 : 0,
    short_qty: t.shortQty, transit_h: t.tTransit, plant_h: t.tPlant,
  }))),
};

let orderRows: Row[] | null = null;
const ORDERS: Dataset = {
  key: "orders", label: "Orders (Traqo TMS / ERP)",
  description: "One row per sales order approved over the last 6 months: quantity, stage, OTIF outcome, planning lead times.",
  dims: [
    { key: "month", label: "Month", time: "month", order: MONTH_ORDER }, { key: "day", label: "Day (last 30 days)", time: "day" }, { key: "weekday", label: "Weekday", time: "weekday", order: WEEKDAYS },
    { key: "plant", label: "Plant" }, { key: "order_type", label: "Order type" }, { key: "destination", label: "Destination" }, { key: "stage", label: "Order stage" },
    { key: "product_type", label: "Product type" }, { key: "otif_status", label: "OTIF status" }, { key: "source", label: "Indent or auction" }, { key: "customer", label: "Customer" },
  ],
  measures: [
    { key: "orders", label: "Orders", agg: (r) => r.length, format: "number" },
    { key: "qty", label: "Order qty (cases)", agg: (r) => sum(r, "qty"), format: "number" },
    { key: "dispatched_qty", label: "Dispatched qty (cases)", agg: (r) => sum(r, "disp_qty"), format: "number" },
    { key: "otif_pct", label: "OTIF %", agg: (r) => { const e = r.filter((x) => x.otif != null); return e.length ? (sum(e, "otif_qty") / sum(e, "qty")) * 100 : null; }, format: "pct", higherIsBetter: true },
    { key: "open_orders", label: "Open orders", agg: (r) => cnt(r, (x) => x.stage !== "Dispatched"), format: "number" },
    { key: "avg_approval_to_dispatch_h", label: "Avg approval → dispatch hours", agg: (r) => avgOf(r, "cycle_h"), format: "hours", higherIsBetter: false },
    { key: "avg_approval_to_indent_h", label: "Avg approval → indent hours", agg: (r) => avgOf(r, "indent_h"), format: "hours", higherIsBetter: false },
  ],
  rows: () => (orderRows ??= orders.map((o) => ({
    id: o.no, month: ml(o.mk), day: recentDays(o.approved) < 30 ? fdDay(o.approved) : null, day_ts: +new Date(o.approved.getFullYear(), o.approved.getMonth(), o.approved.getDate()), weekday: wd(o.approved),
    plant: o.location, order_type: o.type, destination: o.dest, stage: oStage(o.stage).label, product_type: o.productType,
    otif_status: { met: "Met", missed: "Missed", risk: "At risk", na: "Not due" }[o.otifStatus], source: o.src, customer: o.customer,
    qty: o.qty, disp_qty: o.dispQty, otif: o.otif, otif_qty: o.otif == null ? 0 : o.otif * o.qty,
    cycle_h: o.m.dispatch ? (+o.m.dispatch - +o.approved) / H : null, indent_h: o.m.indent ? (+o.m.indent - +o.approved) / H : null,
  }))),
};

let salesRows: Row[] | null = null;
const SALES: Dataset = {
  key: "sales", label: "Secondary sales (DMS)",
  description: "Secondary sales vs target by month for every ASM, with zone and region. Brand and channel splits are allocated from mix shares.",
  dims: [
    { key: "month", label: "Month", time: "month", order: MONTH_ORDER }, { key: "zone", label: "Zone" }, { key: "region", label: "Region" }, { key: "asm", label: "Area sales manager" },
    { key: "brand", label: "Brand" }, { key: "channel", label: "Channel" },
  ],
  measures: [
    { key: "sales", label: "Sales ₹", agg: (r) => sum(r, "sales"), format: "inr", higherIsBetter: true },
    { key: "target", label: "Target ₹", agg: (r) => sum(r, "target"), format: "inr" },
    { key: "achievement_pct", label: "Achievement %", agg: (r) => { const t = sum(r, "target"); return t ? (sum(r, "sales") / t) * 100 : null; }, format: "pct", higherIsBetter: true },
    { key: "gap_to_target", label: "Gap to target ₹", agg: (r) => Math.max(0, sum(r, "target") - sum(r, "sales")), format: "inr", higherIsBetter: false },
  ],
  rows: () => {
    if (salesRows) return salesRows;
    const out: Row[] = [];
    MONTHS.forEach((m) => {
      const end = new Date(Math.min(+new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0), +today0));
      const dim = new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0).getDate();
      ASMS.forEach((a) => {
        let s = 0; for (let d = new Date(m.date); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) s += asmDay(a, d);
        const t = (asmTarget(a, m.date.getFullYear(), m.date.getMonth()) * end.getDate()) / dim;
        BRANDS.forEach(([b, bs], bi) => CHANNELS.forEach(([c, cs], ci) => {
          const f = bs * cs * mixFactor(bi, 0, [m.date, end]) * mixFactor(ci, 9, [m.date, end]);
          out.push({ month: m.label, zone: a.zone, region: a.region, asm: a.name, brand: b, channel: c, sales: s * f, target: t * bs * cs });
        }));
      });
    });
    return (salesRows = out);
  },
};

let cfaRows: Row[] | null = null;
const CFA: Dataset = {
  key: "cfa", label: "CFA throughput",
  description: "Cases dispatched per day from each of 10 CFAs (carrying & forwarding agents) to distributors, last 90 days.",
  dims: [{ key: "cfa", label: "CFA" }, { key: "day", label: "Day (last 30 days)", time: "day" }, { key: "month", label: "Month", time: "month", order: MONTH_ORDER }, { key: "weekday", label: "Weekday", time: "weekday", order: WEEKDAYS }],
  measures: [
    { key: "cases", label: "Cases dispatched", agg: (r) => sum(r, "cases"), format: "number" },
    { key: "avg_cases_per_day", label: "Avg cases per working day", agg: (r) => { const w = r.filter((x) => Number(x.cases) > 0); const days = new Set(w.map((x) => x.day_ts)).size; return days ? sum(w, "cases") / days : null; }, format: "number" },
  ],
  rows: () => {
    if (cfaRows) return cfaRows;
    const out: Row[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(+today0 - i * DAY);
      CFAS.forEach((c, ci) => out.push({ cfa: c.replace("CFA ", ""), day: i < 30 ? fdDay(d) : null, day_ts: +d, month: ml(monthKey(d)), weekday: wd(d), cases: cfaQty(ci, d) }));
    }
    return (cfaRows = out);
  },
};

let pnlRows: Row[] | null = null;
const PNL: Dataset = {
  key: "pnl", label: "E-com P&L",
  description: "Monthly e-commerce P&L per marketplace/quick-commerce account: gross revenue, claims, net sales, cost of sales, material margin.",
  dims: [{ key: "month", label: "Month", time: "month", order: MONTH_ORDER }, { key: "account", label: "Account" }],
  measures: [
    { key: "gross_revenue", label: "Gross revenue ₹", agg: (r) => sum(r, "grossRevenue"), format: "inr" },
    { key: "claims", label: "Claims & schemes ₹", agg: (r) => sum(r, "productClaims"), format: "inr", higherIsBetter: false },
    { key: "net_sales", label: "Net sales ₹", agg: (r) => sum(r, "netSales"), format: "inr", higherIsBetter: true },
    { key: "cost_of_sales", label: "Cost of sales ₹", agg: (r) => sum(r, "costOfSales"), format: "inr", higherIsBetter: false },
    { key: "material_margin", label: "Material margin ₹", agg: (r) => sum(r, "materialMargin"), format: "inr", higherIsBetter: true },
    { key: "margin_pct", label: "Material margin %", agg: (r) => { const n = sum(r, "netSales"); return n ? (sum(r, "materialMargin") / n) * 100 : null; }, format: "pct", higherIsBetter: true },
    { key: "claims_pct", label: "Claims % of gross", agg: (r) => { const g = sum(r, "grossRevenue"); return g ? (sum(r, "productClaims") / g) * 100 : null; }, format: "pct", higherIsBetter: false },
  ],
  rows: () => (pnlRows ??= MONTHS.flatMap((m) => ACCOUNTS.map(([a]) => ({ month: m.label, account: a, ...pnl(a, m.key) })))),
};

export const DATASETS: Dataset[] = [TRIPS, ORDERS, SALES, CFA, PNL];
export const dataset = (k: string) => DATASETS.find((d) => d.key === k);

/** Distinct values per dimension (capped), so the model can write exact filter values. */
export function dimValues(ds: Dataset, dim: string, cap = 40): string[] {
  const seen = new Set<string>();
  for (const r of ds.rows()) { const v = r[dim]; if (v != null) seen.add(String(v)); if (seen.size >= cap) break; }
  const d = ds.dims.find((x) => x.key === dim);
  return d?.order ? d.order.filter((x) => seen.has(x)) : [...seen].sort();
}

/** Compact text description of the semantic layer for the model's system prompt. */
export function catalogText() {
  return DATASETS.map((ds) => [
    `## dataset "${ds.key}" — ${ds.label}`,
    ds.description,
    `dimensions: ${ds.dims.map((d) => { const vals = d.time ? "" : ` (values: ${dimValues(ds, d.key, 12).join(" | ")}${dimValues(ds, d.key, 13).length > 12 ? " | …" : ""})`; return `${d.key} = ${d.label}${vals}`; }).join("; ")}`,
    `measures: ${ds.measures.map((m) => `${m.key} = ${m.label}`).join("; ")}`,
  ].join("\n")).join("\n\n") + `\n\nToday is ${NOW.toDateString()}. Month labels look like "${MONTHS[5].label}" (current month, month-to-date). Currency is INR.`;
}

export { dayKey };
