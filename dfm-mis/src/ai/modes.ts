/** Ask AI answer modes and data focus — shared by the browser, the offline parser and the server. */
import type { QuerySpec } from "./engine";

export type AskMode = "quick" | "research" | "brief" | "compare";
export type AskFocus = "all" | "trips" | "orders" | "sales" | "cfa" | "pnl";

export interface AskSource { id: number; dataset: string; title: string; detail: string; rows: number; spec: QuerySpec }

export const MODES: { key: AskMode; label: string; short: string; description: string }[] = [
  { key: "quick", label: "Quick", short: "Fast answer with one chart", description: "A direct answer in a few sentences, backed by one or two queries." },
  { key: "research", label: "Research", short: "Multi-step analysis", description: "Explores the trend, the breakdown and the drivers, then recommends what to do. Slower, more charts." },
  { key: "brief", label: "Brief", short: "Executive bullets", description: "Three to five bullet points with the numbers that matter — ready to paste into a message." },
  { key: "compare", label: "Compare", short: "This month vs last", description: "Puts two periods or two groups side by side and calls out the biggest movers." },
];

export const FOCUS: { key: AskFocus; label: string; description: string }[] = [
  { key: "all", label: "All data", description: "Trips, orders, sales, CFA and P&L" },
  { key: "trips", label: "Trips", description: "Traqo TMS — freight, transporters, detention" },
  { key: "orders", label: "Orders", description: "OTIF, open orders, lead times" },
  { key: "sales", label: "Sales", description: "Secondary sales vs target" },
  { key: "cfa", label: "CFA", description: "CFA dispatch throughput" },
  { key: "pnl", label: "E-com P&L", description: "Marketplace profitability" },
];

/** Extra system instructions per mode (appended after the cached base prompt). */
export function modeInstructions(mode: AskMode, focus: AskFocus): string {
  const cite = "Every run_query result is numbered as a source [n]. Cite the sources that back each figure or claim with [n] right after it, e.g. \"OTIF fell to 91% [2]\".";
  const focusLine = focus === "all" ? "" : `\nFocus: answer using only the "${focus}" dataset. Do not query other datasets.`;
  const body: Record<AskMode, string> = {
    quick: `Mode: QUICK. Use 1–2 queries. Answer in 2–4 short sentences. 1 chart. ${cite}`,
    research: `Mode: RESEARCH. Investigate properly: run 4–8 queries covering the headline number, the trend over months, the breakdown that explains it, and the outliers. Then answer with:
- a 1–2 sentence direct answer first (no heading),
- then 2–4 sections, each starting with a "## " heading (e.g. "## What changed", "## Why", "## What to do"), with 2–4 short "- " bullets each.
Up to 4 charts. ${cite}`,
    brief: `Mode: BRIEF. An executive summary: 3–5 "- " bullets, each leading with a key figure, no headings and no preamble. At most 1 chart (prefer kpi or a small ranking). ${cite}`,
    compare: `Mode: COMPARE. Put two periods or two groups side by side. Default to the current month vs the previous month when the user names no comparison. Lead with the overall change, then the 2–3 biggest movers with their change. Include a chart that shows both sides together — a bar chart with series set to the compared dimension (e.g. series "month" filtered to the two months). ${cite}`,
  };
  return body[mode] + focusLine;
}

export const MODE_EFFORT: Record<AskMode, "low" | "medium" | "high"> = { quick: "low", research: "high", brief: "medium", compare: "medium" };
export const MODE_MAX_CHARTS: Record<AskMode, number> = { quick: 2, research: 4, brief: 1, compare: 2 };
