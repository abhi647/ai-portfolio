/** Ready-made pivots and dashboard templates, built on the real MIS datasets so nothing starts blank. */
import { MONTHS } from "./data";
import type { ChartType, Filter, QuerySpec } from "../ai/engine";
import type { PivotConfig } from "../ai/pivot";

export const CUR = MONTHS[5].label;
export const PREV = MONTHS[4].label;
const mtd: Filter[] = [{ field: "month", op: "in", values: [CUR] }];

const pv = (p: Partial<PivotConfig> & Pick<PivotConfig, "dataset" | "rows" | "measures">): PivotConfig => ({ cols: null, filters: [], heatmap: true, pct: "none", sort: "label", totals: true, ...p });

export const PIVOT_PRESETS: { id: string; label: string; cfg: PivotConfig }[] = [
  { id: "tr-cpk", label: "Transporter ₹/km × month", cfg: pv({ dataset: "trips", rows: ["transporter"], cols: "month", measures: ["cost_per_km"], sort: "desc" }) },
  { id: "plant-lane", label: "Plant › destination freight", cfg: pv({ dataset: "trips", rows: ["plant", "destination"], cols: "month", measures: ["freight", "trips"], heatmap: false }) },
  { id: "otif", label: "OTIF by plant × order type", cfg: pv({ dataset: "orders", rows: ["plant"], cols: "order_type", measures: ["otif_pct"] }) },
  { id: "sales", label: "Zone › region achievement × month", cfg: pv({ dataset: "sales", rows: ["zone", "region"], cols: "month", measures: ["achievement_pct"] }) },
  { id: "brand", label: "Brand × channel mix", cfg: pv({ dataset: "sales", rows: ["brand"], cols: "channel", measures: ["sales"], pct: "row", filters: mtd }) },
  { id: "cfa", label: "CFA cases × weekday", cfg: pv({ dataset: "cfa", rows: ["cfa"], cols: "weekday", measures: ["avg_cases_per_day"] }) },
  { id: "pnl", label: "P&L margin by account × month", cfg: pv({ dataset: "pnl", rows: ["account"], cols: "month", measures: ["margin_pct"] }) },
];

/* ------------------------------- Dashboards -------------------------------- */
export type WidgetKind = "kpi" | "chart" | "table" | "pivot" | "note";
export interface Widget {
  id: string;
  kind: WidgetKind;
  title: string;
  /** Width in 12ths of the grid, height in grid rows (~80px each). */
  w: number;
  h: number;
  spec?: QuerySpec;
  pivot?: PivotConfig;
  text?: string;
}
export interface DashboardDef {
  id: string;
  name: string;
  description?: string;
  widgets: Widget[];
  /** Dashboard-wide filters. They replace a widget's own filter on the same field. */
  filters: Filter[];
  createdAt: number;
  updatedAt: number;
  template?: string;
}

let n = 0;
export const wid = () => `w${Date.now().toString(36)}${(n++).toString(36)}`;

const q = (dataset: string, measures: string[], dimension: string | null, chart: ChartType, title: string, extra: Partial<QuerySpec> = {}): QuerySpec =>
  ({ dataset, measures, dimension, series: null, filters: [], sort: "natural", limit: null, chart, title, ...extra });
const kpi = (title: string, dataset: string, measure: string, filters: Filter[] = []): Omit<Widget, "id"> =>
  ({ kind: "kpi", title, w: 2, h: 2, spec: q(dataset, [measure], null, "kpi", title, { filters }) });
const chart = (w: number, h: number, spec: QuerySpec): Omit<Widget, "id"> => ({ kind: "chart", title: spec.title, w, h, spec });
const table = (w: number, h: number, spec: QuerySpec): Omit<Widget, "id"> => ({ kind: "table", title: spec.title, w, h, spec: { ...spec, chart: "table" } });
const pivotW = (w: number, h: number, title: string, cfg: PivotConfig): Omit<Widget, "id"> => ({ kind: "pivot", title, w, h, pivot: cfg });

export interface Template { id: string; name: string; description: string; icon: string; widgets: Omit<Widget, "id">[]; filters?: Filter[] }

export const TEMPLATES: Template[] = [
  {
    id: "control-tower", name: "Logistics control tower", icon: "truck",
    description: "Trips, freight, service and transporters on one screen — the daily supply review.",
    widgets: [
      kpi("Active trips", "trips", "active_trips"),
      kpi(`Freight · ${CUR}`, "trips", "freight", mtd),
      kpi(`Cost per km · ${CUR}`, "trips", "cost_per_km", mtd),
      kpi(`OTIF · ${CUR}`, "orders", "otif_pct", mtd),
      kpi("Detention rate", "trips", "detention_rate"),
      kpi("GPS tracking", "trips", "tracking_rate"),
      chart(8, 4, q("trips", ["freight", "cost_per_km"], "month", "combo", "Freight and cost per km by month")),
      chart(4, 4, q("trips", ["active_trips"], "stage", "bar_list", "Trips by stage", { sort: "desc", filters: [{ field: "stage", op: "not_in", values: ["ePOD Done"] }] })),
      pivotW(12, 5, "Transporter cost per km by month", pv({ dataset: "trips", rows: ["transporter"], cols: "month", measures: ["cost_per_km"], sort: "desc" })),
      table(6, 5, q("trips", ["trips", "freight", "cost_per_km", "avg_transit_h"], "destination", "table", "Destination lanes", { sort: "desc", limit: 15 })),
      chart(6, 5, q("orders", ["otif_pct"], "plant", "horizontal_bar", "OTIF by plant", { sort: "desc" })),
      chart(6, 4, q("trips", ["trips"], "month", "stacked_bar", "Trips by fleet type", { series: "fleet" })),
      chart(6, 4, q("trips", ["detention_cost", "detention_rate"], "transporter", "combo", "Detention by transporter", { sort: "desc", limit: 8 })),
    ],
  },
  {
    id: "sales-review", name: "Sales review", icon: "chart",
    description: "Secondary sales against target by zone, region, ASM, brand and channel.",
    widgets: [
      kpi(`Sales · ${CUR}`, "sales", "sales", mtd),
      kpi(`Target · ${CUR}`, "sales", "target", mtd),
      kpi(`Achievement · ${CUR}`, "sales", "achievement_pct", mtd),
      kpi(`Gap to target · ${CUR}`, "sales", "gap_to_target", mtd),
      kpi("6-month sales", "sales", "sales"),
      kpi("6-month achievement", "sales", "achievement_pct"),
      chart(8, 4, q("sales", ["sales", "achievement_pct"], "month", "combo", "Sales and achievement by month")),
      chart(4, 4, q("sales", ["sales"], "channel", "donut", `Channel mix · ${CUR}`, { filters: mtd, sort: "desc" })),
      pivotW(7, 6, "Achievement % by zone › region × month", pv({ dataset: "sales", rows: ["zone", "region"], cols: "month", measures: ["achievement_pct"] })),
      table(5, 6, q("sales", ["achievement_pct", "sales", "gap_to_target"], "asm", "table", `ASMs furthest from target · ${CUR}`, { filters: mtd, sort: "asc", limit: 12 })),
      chart(12, 4, q("sales", ["sales"], "month", "stacked_bar", "Sales by brand", { series: "brand" })),
    ],
  },
  {
    id: "finance", name: "E-com P&L and CFA", icon: "money",
    description: "Marketplace profitability and CFA throughput for the finance and secondary-supply review.",
    widgets: [
      kpi(`Net sales · ${CUR}`, "pnl", "net_sales", mtd),
      kpi(`Material margin · ${CUR}`, "pnl", "margin_pct", mtd),
      kpi(`Claims % · ${CUR}`, "pnl", "claims_pct", mtd),
      kpi("CFA cases · 90 days", "cfa", "cases"),
      kpi("Avg cases / day", "cfa", "avg_cases_per_day"),
      kpi(`Gross revenue · ${CUR}`, "pnl", "gross_revenue", mtd),
      chart(7, 4, q("pnl", ["net_sales", "margin_pct"], "month", "combo", "Net sales and margin by month")),
      chart(5, 4, q("pnl", ["net_sales"], "account", "horizontal_bar", `Net sales by account · ${CUR}`, { filters: mtd, sort: "desc" })),
      pivotW(6, 4, "Margin % by account × month", pv({ dataset: "pnl", rows: ["account"], cols: "month", measures: ["margin_pct"] })),
      chart(6, 4, q("cfa", ["cases"], "cfa", "heatmap", "CFA cases by weekday", { series: "weekday" })),
      chart(12, 4, q("cfa", ["cases"], "day", "line", "CFA dispatch · last 30 days")),
    ],
  },
];

export const fromTemplate = (t: Template, name?: string): DashboardDef => ({
  id: `d${Date.now().toString(36)}${(n++).toString(36)}`,
  name: name || t.name, description: t.description, template: t.id,
  widgets: t.widgets.map((w) => ({ ...w, id: wid() })), filters: t.filters ?? [], createdAt: Date.now(), updatedAt: Date.now(),
});

/** One-click widgets offered on an empty or new dashboard. */
export const SUGGESTED: Omit<Widget, "id">[] = [
  kpi(`Freight · ${CUR}`, "trips", "freight", mtd),
  kpi(`OTIF · ${CUR}`, "orders", "otif_pct", mtd),
  kpi(`Sales achievement · ${CUR}`, "sales", "achievement_pct", mtd),
  kpi(`Material margin · ${CUR}`, "pnl", "margin_pct", mtd),
  chart(6, 4, q("trips", ["cost_per_km"], "transporter", "horizontal_bar", "Cost per km by transporter", { sort: "desc", limit: 10 })),
  chart(6, 4, q("orders", ["orders", "otif_pct"], "month", "combo", "Orders and OTIF by month")),
  table(6, 5, q("sales", ["sales", "target", "achievement_pct"], "zone", "table", `Zone scorecard · ${CUR}`, { filters: mtd, sort: "desc" })),
  pivotW(6, 5, "CFA avg cases by weekday", pv({ dataset: "cfa", rows: ["cfa"], cols: "weekday", measures: ["avg_cases_per_day"] })),
];
