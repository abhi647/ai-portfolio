/** Pivot engine over the semantic layer. Every cell re-aggregates raw rows, so ratios (%, ₹/km) stay correct at every level. */
import { dataset, type Dataset, type Measure, type Row } from "./catalog";
import { applyFilters, orderValues, type Filter } from "./engine";

export interface PivotConfig {
  dataset: string;
  rows: string[];
  cols: string | null;
  measures: string[];
  filters: Filter[];
  heatmap: boolean;
  /** Show additive measures as a share of the column, row or grand total. */
  pct: "none" | "col" | "row" | "total";
  sort: "label" | "desc" | "asc";
  totals: boolean;
}

export const TOTAL = "__total";

export interface PivotNode {
  id: string;
  label: string;
  depth: number;
  path: string[];
  children: PivotNode[];
  /** colKey → measureKey → value. Includes TOTAL. */
  cells: Record<string, Record<string, number | null>>;
  count: number;
}

export interface PivotResult {
  cfg: PivotConfig;
  ds: Dataset;
  measures: Measure[];
  colKeys: string[];
  droppedCols: number;
  root: PivotNode;
  matched: number;
  /** measureKey → [min, max] across leaf cells (excluding totals), for heat shading. */
  range: Record<string, [number, number]>;
}

const MAX_COLS = 40;
const keyOf = (v: unknown) => (v == null ? null : String(v));
export const isAdditive = (m: Measure) => ["number", "inr", "km"].includes(m.format);

export function pivot(cfg: PivotConfig): PivotResult | { error: string } {
  const ds = dataset(cfg.dataset);
  if (!ds) return { error: `Unknown dataset ${cfg.dataset}` };
  const measures = cfg.measures.map((k) => ds.measures.find((m) => m.key === k)).filter((m): m is Measure => !!m);
  if (!measures.length) return { error: "Add at least one value to the pivot." };
  const rows = applyFilters(ds.rows(), cfg.filters);

  let colKeys: string[] = [];
  let droppedCols = 0;
  if (cfg.cols) {
    const seen = new Set<string>();
    for (const r of rows) { const k = keyOf(r[cfg.cols]); if (k != null) seen.add(k); }
    colKeys = orderValues(ds, cfg.cols, [...seen], rows);
    if (colKeys.length > MAX_COLS) { droppedCols = colKeys.length - MAX_COLS; colKeys = colKeys.slice(-MAX_COLS); }
  }
  const colSet = new Set(colKeys);
  const range: Record<string, [number, number]> = Object.fromEntries(measures.map((m) => [m.key, [Infinity, -Infinity]]));

  const cellsFor = (rs: Row[], leaf: boolean) => {
    const out: Record<string, Record<string, number | null>> = { [TOTAL]: Object.fromEntries(measures.map((m) => [m.key, m.agg(rs)])) };
    if (cfg.cols) {
      const by = new Map<string, Row[]>();
      for (const r of rs) { const k = keyOf(r[cfg.cols]); if (k == null || !colSet.has(k)) continue; (by.get(k) ?? by.set(k, []).get(k)!).push(r); }
      for (const c of colKeys) {
        const sub = by.get(c);
        out[c] = Object.fromEntries(measures.map((m) => [m.key, sub?.length ? m.agg(sub) : null]));
        if (leaf) for (const m of measures) { const v = out[c][m.key]; if (v != null) { range[m.key][0] = Math.min(range[m.key][0], v); range[m.key][1] = Math.max(range[m.key][1], v); } }
      }
    } else if (leaf) {
      for (const m of measures) { const v = out[TOTAL][m.key]; if (v != null) { range[m.key][0] = Math.min(range[m.key][0], v); range[m.key][1] = Math.max(range[m.key][1], v); } }
    }
    return out;
  };

  const build = (rs: Row[], depth: number, path: string[]): PivotNode[] => {
    const dim = cfg.rows[depth];
    const groups = new Map<string, Row[]>();
    for (const r of rs) { const k = keyOf(r[dim]); if (k == null) continue; (groups.get(k) ?? groups.set(k, []).get(k)!).push(r); }
    const leaf = depth === cfg.rows.length - 1;
    let nodes = orderValues(ds, dim, [...groups.keys()], rs).map((label) => {
      const sub = groups.get(label)!;
      const p = [...path, label];
      return { id: p.join("\u0001"), label, depth, path: p, children: leaf ? [] : build(sub, depth + 1, p), cells: cellsFor(sub, leaf), count: sub.length };
    });
    if (cfg.sort !== "label") {
      const m0 = measures[0].key;
      nodes = nodes.sort((a, b) => ((a.cells[TOTAL][m0] ?? -Infinity) - (b.cells[TOTAL][m0] ?? -Infinity)) * (cfg.sort === "desc" ? -1 : 1));
    }
    return nodes;
  };

  const root: PivotNode = {
    id: "__root", label: "Grand total", depth: -1, path: [], count: rows.length,
    children: cfg.rows.length ? build(rows, 0, []) : [],
    cells: cellsFor(rows, !cfg.rows.length),
  };
  return { cfg, ds, measures, colKeys, droppedCols, root, matched: rows.length, range };
}

/** Value to display after the "% of" option. Only additive measures are converted. */
export function shown(r: PivotResult, node: PivotNode, col: string, m: Measure): number | null {
  const v = node.cells[col]?.[m.key] ?? null;
  if (v == null || r.cfg.pct === "none" || !isAdditive(m)) return v;
  const denom = r.cfg.pct === "row" ? node.cells[TOTAL][m.key] : r.cfg.pct === "col" ? r.root.cells[col]?.[m.key] : r.root.cells[TOTAL][m.key];
  return denom ? (v / denom) * 100 : null;
}

export const asPct = (r: PivotResult, m: Measure) => r.cfg.pct !== "none" && isAdditive(m);

export function flatten(n: PivotNode, expanded?: (id: string) => boolean): PivotNode[] {
  const out: PivotNode[] = [];
  const walk = (x: PivotNode) => { for (const c of x.children) { out.push(c); if (c.children.length && (!expanded || expanded(c.id))) walk(c); } };
  walk(n);
  return out;
}

export const defaultPivot = (ds = "trips"): PivotConfig => {
  const d = dataset(ds)!;
  const firstDim = d.dims.find((x) => !x.time)?.key ?? d.dims[0].key;
  const month = d.dims.find((x) => x.key === "month") ? "month" : null;
  return { dataset: ds, rows: [firstDim], cols: month, measures: [d.measures[0].key], filters: [], heatmap: true, pct: "none", sort: "label", totals: true };
};
