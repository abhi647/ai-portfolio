/* Scorecard table on the overtrue/ui DataTable: sortable, sticky header, inline bars, best/worst cues and a totals bar. */
import * as React from "react";
import { fmt } from "@/ai/engine";
import { DataTable, type Col } from "./kit";
import { cn } from "@/lib/utils";

export interface DenseCol {
  key: string;
  label: string;
  format: string;
  /** Draw an inline bar proportional to the column max. */
  bar?: boolean;
  /** Colour the best and worst quartile. */
  higherIsBetter?: boolean;
  width?: number;
}
export interface DenseRow { id?: string; label: string; sub?: string; values: Record<string, number | null> }

export function DenseTable({
  rows, cols, dimLabel, total, maxHeight, onRowClick, initialSort, className, rank,
}: {
  rows: DenseRow[]; cols: DenseCol[]; dimLabel: string; total?: Record<string, number | null>; maxHeight?: number | string;
  onRowClick?: (r: DenseRow) => void; initialSort?: { key: string; dir: "asc" | "desc" }; className?: string; rank?: boolean;
}) {
  const stats = React.useMemo(() => Object.fromEntries(cols.map((c) => {
    const vs = rows.map((r) => r.values[c.key]).filter((v): v is number => v != null).sort((a, b) => a - b);
    return [c.key, { max: Math.max(0, ...vs.map(Math.abs)), q1: vs[Math.floor(vs.length * 0.25)], q3: vs[Math.min(vs.length - 1, Math.ceil(vs.length * 0.75) - 1)], n: vs.length }];
  })), [rows, cols]);
  const order = React.useMemo(() => {
    if (!initialSort) return new Map(rows.map((r, i) => [r, i + 1]));
    const s = [...rows].sort((a, b) => ((a.values[initialSort.key] ?? -Infinity) - (b.values[initialSort.key] ?? -Infinity)) * (initialSort.dir === "asc" ? 1 : -1));
    return new Map(s.map((r, i) => [r, i + 1]));
  }, [rows, initialSort]);

  const tcols = React.useMemo<Col<DenseRow>[]>(() => [
    ...(rank ? [{ id: "__rank", header: "#", align: "right" as const, value: (r: DenseRow) => order.get(r) ?? 0, cell: (r: DenseRow) => <span className="text-muted-foreground tabular-nums">{order.get(r)}</span> }] : []),
    {
      id: "__label", header: dimLabel, value: (r) => r.label,
      cell: (r) => <span className="flex max-w-[260px] items-baseline gap-1.5"><span className="truncate font-medium">{r.label}</span>{r.sub ? <span className="truncate text-[11px] text-muted-foreground">{r.sub}</span> : null}</span>,
    },
    ...cols.map((c): Col<DenseRow> => ({
      id: c.key, header: c.label, align: "right",
      value: (r) => r.values[c.key] ?? -Infinity,
      csv: (r) => r.values[c.key] ?? "",
      cell: (r) => {
        const v = r.values[c.key];
        const st = stats[c.key];
        const good = c.higherIsBetter !== undefined && v != null && st.n >= 4 && (c.higherIsBetter ? v >= st.q3 : v <= st.q1);
        const bad = c.higherIsBetter !== undefined && v != null && st.n >= 4 && (c.higherIsBetter ? v <= st.q1 : v >= st.q3);
        if (c.bar && v != null && st.max) {
          return (
            <span className="inline-flex items-center justify-end gap-2">
              <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary/70" style={{ width: `${(Math.abs(v) / st.max) * 100}%` }} /></span>
              <span className="min-w-[56px]">{fmt(v, c.format, true)}</span>
            </span>
          );
        }
        return <span className={cn(good && "rounded bg-emerald-500/10 px-1 py-px text-emerald-700 dark:text-emerald-400", bad && "rounded bg-rose-500/10 px-1 py-px text-rose-700 dark:text-rose-400")}>{fmt(v, c.format, true)}</span>;
      },
    })),
  ], [cols, dimLabel, rank, order, stats]);

  const footer = total ? (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-muted/60 px-3 py-2 text-[12px]" aria-label="Totals">
      <span className="font-semibold">Total</span>
      {cols.map((c) => <span key={c.key} className="text-muted-foreground">{c.label} <b className="font-semibold text-foreground tabular-nums">{fmt(total[c.key], c.format, true)}</b></span>)}
    </div>
  ) : null;

  return (
    <DataTable rows={rows} cols={tcols} pageSize={0} showPagination={false} maxHeight={maxHeight} density="compact" className={className}
      getRowId={(r, i) => r.id ?? `${r.label}-${i}`} onRowClick={onRowClick}
      initialSorting={initialSort ? [{ id: initialSort.key, desc: initialSort.dir === "desc" }] : undefined} footer={footer} />
  );
}
