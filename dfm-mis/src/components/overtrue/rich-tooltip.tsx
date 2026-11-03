"use client";

/**
 * Comprehensive chart tooltip: the point's label, every series with its value, its share of the total
 * (for stacked/additive series) and the change from the previous point, plus a total row.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface RichTooltipRow {
  key: string;
  label: string;
  color: string;
  /** Formatted value. */
  value: string;
  raw: number;
  /** Raw value at the previous point, for the change column. */
  prev?: number | null;
  /** Swatch node; defaults to a dot. */
  swatch?: React.ReactNode;
  /** Include in share and total maths (stacked / additive series). */
  additive?: boolean;
}

const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;

export function RichTooltip({
  label, prevLabel, rows, format, showShare, showTotal, note,
}: {
  label: React.ReactNode;
  prevLabel?: React.ReactNode;
  rows: RichTooltipRow[];
  /** Formats a raw number for the total row. */
  format: (v: number) => string;
  showShare?: boolean;
  showTotal?: boolean;
  note?: React.ReactNode;
}) {
  const add = rows.filter((r) => r.additive !== false);
  const total = add.reduce((s, r) => s + r.raw, 0);
  const prevTotal = add.every((r) => r.prev != null) ? add.reduce((s, r) => s + (r.prev ?? 0), 0) : null;
  const share = showShare && add.length > 1 && total > 0;
  const hasPrev = prevLabel != null && rows.some((r) => r.prev != null);
  // Percentage metrics move in points; amounts move in relative %.
  const change = (cur: number, prev: number | null | undefined, isPct = false) =>
    prev == null || (prev === 0 && !isPct) ? <span className="text-muted-foreground">–</span> : (
      <span className={cn("tabular-nums", cur > prev ? "text-emerald-600 dark:text-emerald-400" : cur < prev ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>
        {cur > prev ? "▲" : cur < prev ? "▼" : ""} {isPct ? `${cur >= prev ? "+" : "−"}${Math.abs(cur - prev).toFixed(1)} pts` : pct(((cur - prev) / Math.abs(prev)) * 100)}
      </span>
    );
  return (
    <div data-slot="rich-tooltip" className="min-w-52 rounded-md border border-border bg-popover px-3 py-2.5 text-xs text-popover-foreground shadow-lg">
      <p className="m-0 mb-2 font-semibold text-foreground">{label}</p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[10.5px] text-muted-foreground">
            <th className="pb-1 text-left font-medium">Series</th>
            <th className="pb-1 pl-3 text-right font-medium">Value</th>
            {share ? <th className="pb-1 pl-3 text-right font-medium">Share</th> : null}
            {hasPrev ? <th className="pb-1 pl-3 text-right font-medium">vs {prevLabel}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="py-0.5 pr-2">
                <span className="flex items-center gap-1.5">
                  {r.swatch ?? <span aria-hidden className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: r.color }} />}
                  <span className="text-muted-foreground">{r.label}</span>
                </span>
              </td>
              <td className="py-0.5 pl-3 text-right font-medium text-foreground tabular-nums">{r.value}</td>
              {share ? <td className="py-0.5 pl-3 text-right text-muted-foreground tabular-nums">{r.additive !== false ? ((r.raw / total) * 100).toFixed(1) + "%" : ""}</td> : null}
              {hasPrev ? <td className="py-0.5 pl-3 text-right">{change(r.raw, r.prev, /%\s*$/.test(r.value))}</td> : null}
            </tr>
          ))}
        </tbody>
        {showTotal && add.length > 1 ? (
          <tfoot>
            <tr className="border-t border-border">
              <td className="pt-1.5 font-medium text-foreground">Total</td>
              <td className="pt-1.5 pl-3 text-right font-semibold text-foreground tabular-nums">{format(total)}</td>
              {share ? <td className="pt-1.5 pl-3 text-right text-muted-foreground">100%</td> : null}
              {hasPrev ? <td className="pt-1.5 pl-3 text-right">{change(total, prevTotal, /%\s*$/.test(format(total)))}</td> : null}
            </tr>
          </tfoot>
        ) : null}
      </table>
      {note ? <p className="m-0 mt-2 border-t border-border pt-1.5 text-[10.5px] text-muted-foreground">{note}</p> : null}
    </div>
  );
}
