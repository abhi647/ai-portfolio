/** Governance metadata for the demo platform: metric catalog, data sources, quality checks, audit events. */
import { DATASETS, dataset } from "../ai/catalog";
import { NOW, orders, syncRuns, trips } from "./data";
import { DAY, H } from "./format";

/* ---------------------------------- sources ---------------------------------- */
export interface Source { id: string; system: string; table: string; domain: string; cadenceMin: number; slaMin: number; owner: string }
export const SOURCES: Source[] = [
  { id: "fact_TripDetentionReport", system: "Traqo TMS", table: "fact_TripDetentionReport", domain: "trips", cadenceMin: 15, slaMin: 45, owner: "Logistics IT" },
  { id: "fact_Traqo_SalesOrder", system: "Traqo TMS", table: "fact_Traqo_SalesOrder", domain: "orders", cadenceMin: 15, slaMin: 45, owner: "Logistics IT" },
  { id: "fact_Indent_Auction_Details", system: "Traqo TMS", table: "fact_Indent_Auction_Details", domain: "orders", cadenceMin: 15, slaMin: 45, owner: "Logistics IT" },
  { id: "dim_Item_ERP", system: "SAP ERP", table: "dim_Item_ERP", domain: "orders", cadenceMin: 60, slaMin: 180, owner: "ERP team" },
  { id: "fact_OrderFulfillment_ERP", system: "SAP ERP", table: "fact_OrderFulfillment_ERP", domain: "orders", cadenceMin: 15, slaMin: 45, owner: "ERP team" },
  { id: "fact_SecondarySales_DMS", system: "DMS", table: "fact_SecondarySales_DMS", domain: "sales", cadenceMin: 30, slaMin: 90, owner: "Sales ops" },
  { id: "fact_CFA_Dispatch", system: "CFA WMS", table: "fact_CFA_Dispatch", domain: "cfa", cadenceMin: 60, slaMin: 180, owner: "Secondary supply" },
  { id: "fact_Ecom_PnL", system: "Marketplaces · ERP", table: "fact_Ecom_PnL", domain: "pnl", cadenceMin: 1440, slaMin: 2880, owner: "Finance" },
];

export function sourceHealth(s: Source) {
  const runs = syncRuns.filter((r) => r.table === s.table).sort((a, b) => +b.start - +a.start);
  const lastOk = runs.find((r) => r.status === "completed");
  const lagMin = lastOk ? (+NOW - +lastOk.start) / 60e3 : Infinity;
  const failedRecent = runs.slice(0, 3).some((r) => r.status === "failed");
  const running = runs[0]?.status === "in_process";
  const status: "operational" | "degraded" | "outage" = lagMin > s.slaMin ? "outage" : failedRecent ? "degraded" : "operational";
  return { runs, lastOk, lagMin, failedRecent, running, status, rows: lastOk?.rows ?? 0 };
}

/** 30 daily availability samples per source (deterministic). */
export function sourceSamples(s: Source, i: number) {
  return Array.from({ length: 30 }, (_, k) => {
    const d = new Date(+NOW - (29 - k) * DAY);
    const h = (Math.sin((k + 1) * (i + 3) * 12.9898) * 43758.5453) % 1;
    const r = Math.abs(h);
    const status = k === 29 && s.id === "fact_SecondarySales_DMS" ? "degraded" : r > 0.992 ? "outage" : r > 0.955 ? "degraded" : "operational";
    return { id: `${s.id}-${k}`, label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), status: status as "operational" | "degraded" | "outage" };
  });
}

/* ------------------------------ quality checks ------------------------------ */
export interface QualityCheck { id: string; rule: string; dataset: string; kind: "Completeness" | "Validity" | "Uniqueness" | "Reconciliation" | "Timeliness"; result: "pass" | "warn" | "fail"; failing: number; scanned: number; detail: string }
export function qualityChecks(): QualityCheck[] {
  const tripIds = new Set<string>(); let dupTrips = 0; trips.forEach((t) => { if (tripIds.has(t.id)) dupTrips++; tripIds.add(t.id); });
  const noKm = trips.filter((t) => !t.km).length;
  const noConsent = trips.filter((t) => t.consent !== "ALLOWED" && t.stage !== "epod_done").length;
  const active = trips.filter((t) => t.stage !== "epod_done").length;
  const staleTrips = trips.filter((t) => t.stage !== "epod_done" && (+NOW - +t.lastUpdated) / H > 72).length;
  const unassigned = orders.filter((o) => o.stage !== "dispatched" && o.transporter === "Not assigned yet" && (+NOW - +o.approved) / H > 24).length;
  const negFreight = trips.filter((t) => t.total < 0).length;
  const pnl = dataset("pnl")!.rows();
  const pnlBad = pnl.filter((r) => Math.abs(Number(r.grossRevenue) - Number(r.productClaims) - Number(r.netSales)) > 1 || Math.abs(Number(r.productClaims) - Number(r.primarySchemes) - Number(r.secondaryScheme) - Number(r.tradeExpiry) - Number(r.ssCommission)) > 1).length;
  const sales = dataset("sales")!.rows();
  const res = (fail: number, warnAt = 1, failAt = Infinity): QualityCheck["result"] => (fail >= failAt ? "fail" : fail >= warnAt ? "warn" : "pass");
  return [
    { id: "q1", rule: "Trip ID is unique", dataset: "trips", kind: "Uniqueness", failing: dupTrips, scanned: trips.length, result: res(dupTrips, 1, 1), detail: "fact_TripDetentionReport.trip_id has no duplicates" },
    { id: "q2", rule: "Trip distance is populated", dataset: "trips", kind: "Completeness", failing: noKm, scanned: trips.length, result: res(noKm, 1, 10), detail: "km > 0 for every trip" },
    { id: "q3", rule: "Freight amount is non-negative", dataset: "trips", kind: "Validity", failing: negFreight, scanned: trips.length, result: res(negFreight, 1, 1), detail: "total freight after deductions ≥ 0" },
    { id: "q4", rule: "Active trips have GPS consent", dataset: "trips", kind: "Completeness", failing: noConsent, scanned: active, result: res(noConsent, 1, Math.ceil(active * 0.5)), detail: "Driver consent recorded for live tracking" },
    { id: "q5", rule: "Active trips updated in the last 72 h", dataset: "trips", kind: "Timeliness", failing: staleTrips, scanned: active, result: res(staleTrips, 1, 10), detail: "Milestone timestamps keep moving" },
    { id: "q6", rule: "Orders older than 24 h have a transporter", dataset: "orders", kind: "Completeness", failing: unassigned, scanned: orders.length, result: res(unassigned, 1, 5), detail: "Indent placed within a day of approval" },
    { id: "q7", rule: "P&L: gross − claims & schemes = net sales", dataset: "pnl", kind: "Reconciliation", failing: pnlBad, scanned: pnl.length, result: res(pnlBad, 1, 1), detail: "Every account-month balances to the rupee, and claims equal the sum of their components" },
    { id: "q8", rule: "DMS secondary sales vs ERP primary within 2%", dataset: "sales", kind: "Reconciliation", failing: 0, scanned: sales.length, result: "pass", detail: "Monthly secondary sales reconcile to primary invoicing net of distributor stock movement (variance 0.6%)" },
    { id: "q9", rule: "DMS feed arrives within SLA", dataset: "sales", kind: "Timeliness", failing: 1, scanned: 6, result: "warn", detail: "One run timed out today (300 s); retried automatically on the next cycle" },
    { id: "q10", rule: "Month has a sales target for every ASM", dataset: "sales", kind: "Completeness", failing: 0, scanned: sales.length, result: "pass", detail: "AOP targets loaded for all 32 ASMs, all months" },
  ];
}

/* ------------------------------- metric catalog ------------------------------- */
export interface MetricEntry {
  id: string; dataset: string; datasetLabel: string; key: string; label: string; format: string; formula: string; owner: string;
  certified: boolean; sources: string[]; grain: string; refresh: string; usedIn: string[]; reviewed: Date;
}
const OWNER: Record<string, string> = { trips: "Head – Logistics", orders: "Head – Supply Chain", sales: "VP Sales", cfa: "Head – Secondary Supply", pnl: "Head – E-commerce" };
const GRAIN: Record<string, string> = { trips: "One row per trip", orders: "One row per sales order", sales: "ASM × brand × channel × month", cfa: "CFA × day", pnl: "Account × month" };
const FORMULA: Record<string, string> = {
  "trips.trips": "COUNT(trip_id)", "trips.freight": "SUM(freight + detention + additional − shortage − damage)", "trips.km": "SUM(distance_km)",
  "trips.cost_per_km": "SUM(total_freight) ÷ SUM(distance_km)", "trips.cases": "SUM(invoiced_qty)", "trips.detention_cost": "SUM(actual_detention_paid)",
  "trips.detention_rate": "COUNT(ePOD trips with system detention > 0) ÷ COUNT(ePOD trips)", "trips.tracking_rate": "COUNT(trips with consent = ALLOWED) ÷ COUNT(trips)",
  "trips.avg_transit_h": "AVG(dest_reported − gate_out) in hours", "trips.avg_plant_tat_h": "AVG(gate_out − reported) in hours",
  "trips.shortage_rate": "COUNT(delivered trips with short_qty > 0) ÷ COUNT(delivered trips)", "trips.active_trips": "COUNT(trips WHERE stage ≠ ePOD Done)",
  "orders.orders": "COUNT(order_no)", "orders.qty": "SUM(order_qty)", "orders.dispatched_qty": "SUM(dispatched_qty)",
  "orders.otif_pct": "SUM(qty delivered on time and in full) ÷ SUM(qty due), orders with a closed OTIF window", "orders.open_orders": "COUNT(orders WHERE stage ≠ Dispatched)",
  "orders.avg_approval_to_dispatch_h": "AVG(dispatched_at − approved_at) in hours", "orders.avg_approval_to_indent_h": "AVG(indent_at − approved_at) in hours",
  "sales.sales": "SUM(secondary_sales_value)", "sales.target": "SUM(AOP target, pro-rated by day)", "sales.achievement_pct": "SUM(sales) ÷ SUM(target)", "sales.gap_to_target": "MAX(0, SUM(target) − SUM(sales))",
  "cfa.cases": "SUM(cases_dispatched)", "cfa.avg_cases_per_day": "SUM(cases) ÷ COUNT(DISTINCT working days)",
  "pnl.gross_revenue": "SUM(gross_revenue)", "pnl.claims": "SUM(product_claims)", "pnl.net_sales": "Gross − claims − schemes − expiry − SS commission", "pnl.cost_of_sales": "RM cost + PM cost",
  "pnl.material_margin": "Net sales − cost of sales", "pnl.margin_pct": "Material margin ÷ net sales", "pnl.claims_pct": "Product claims ÷ gross revenue",
};
const USED: Record<string, string[]> = {
  "trips.cost_per_km": ["Executive scorecard", "MIS pack", "Trip Analytics › Costing", "Forecasts"], "orders.otif_pct": ["Executive scorecard", "MIS pack", "Order Analytics › OTIF", "Forecasts"],
  "sales.sales": ["Executive scorecard", "MIS pack", "Sales › Team", "Forecasts"], "sales.achievement_pct": ["Executive scorecard", "MIS pack", "Sales"],
  "trips.detention_rate": ["Executive scorecard", "MIS pack", "Trip Analytics › Detention"], "trips.tracking_rate": ["Executive scorecard", "MIS pack", "Trip Analytics › Hygiene"],
  "pnl.net_sales": ["Executive scorecard", "MIS pack", "E-com P&L"], "pnl.margin_pct": ["Executive scorecard", "MIS pack", "E-com P&L", "Forecasts"], "cfa.cases": ["Executive scorecard", "MIS pack", "CFA Throughput"],
};
export function metricCatalog(): MetricEntry[] {
  return DATASETS.flatMap((ds) => ds.measures.map((m, i) => {
    const id = `${ds.key}.${m.key}`;
    const src = SOURCES.filter((s) => s.domain === ds.key);
    return {
      id, dataset: ds.key, datasetLabel: ds.label, key: m.key, label: m.label, format: m.format, formula: FORMULA[id] ?? m.label, owner: OWNER[ds.key],
      certified: !!USED[id] || i < 3, sources: src.map((s) => `${s.system} · ${s.table}`), grain: GRAIN[ds.key],
      refresh: src.length ? `Every ${Math.min(...src.map((s) => s.cadenceMin)) >= 1440 ? "day" : `${Math.min(...src.map((s) => s.cadenceMin))} min`}` : "—",
      usedIn: USED[id] ?? ["Data explorer", "Ask AI"], reviewed: new Date(+NOW - ((i * 7 + ds.key.length * 3) % 60) * DAY),
    };
  }));
}

/* --------------------------------- audit log --------------------------------- */
export function auditEvents() {
  const t = (h: number) => new Date(+NOW - h * H).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return [
    { id: "a1", actor: "Priya Verma", action: "exported", target: "Trip Analytics › Costing (CSV, 492 rows)", time: t(0.4), outcome: "neutral" as const },
    { id: "a2", actor: "MIS bot", action: "flagged a failed sync on", target: "fact_SecondarySales_DMS", time: t(1.2), outcome: "warning" as const },
    { id: "a3", actor: "Rohit Malhotra", action: "changed OTIF thresholds in", target: "Settings › Configuration", time: t(5), outcome: "success" as const, changes: [{ field: "Green", before: "96%", after: "95%" }] },
    { id: "a4", actor: "Anjali Singh", action: "granted Financial access to", target: "Karan Mehta", time: t(26), outcome: "success" as const, changes: [{ field: "Financial", before: "No", after: "Yes" }] },
    { id: "a5", actor: "Priya Verma", action: "published", target: "Monthly MIS pack · Sept 26 (v2)", time: t(30), outcome: "success" as const },
    { id: "a6", actor: "Vikram Rao", action: "signed in from", target: "Gurugram · Chrome on macOS", time: t(31), outcome: "neutral" as const },
    { id: "a7", actor: "Karan Mehta", action: "subscribed to", target: "Daily executive scorecard (email, 08:30)", time: t(52), outcome: "success" as const },
    { id: "a8", actor: "Anjali Singh", action: "revoked Sales access for", target: "Temp contractor", time: t(75), outcome: "warning" as const, changes: [{ field: "Sales", before: "Yes", after: "No" }] },
  ];
}
