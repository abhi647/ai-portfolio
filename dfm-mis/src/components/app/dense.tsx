/* Data-dense scorecard table: sortable, sticky header, inline bars, best/worst cues and a totals row. */
import * as React from "react";
import { IconArrowDown, IconArrowUp } from "@tabler/icons-react";
import { fmt } from "@/ai/engine";
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
  const [sort, setSort] = React.useState<{ key: string; dir: "asc" | "desc" } | null>(initialSort ?? null);
  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const out = [...rows];
    if (sort.key === "__label") out.sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }) * (sort.dir === "asc" ? 1 : -1));
    else out.sort((a, b) => ((a.values[sort.key] ?? -Infinity) - (b.values[sort.key] ?? -Infinity)) * (sort.dir === "asc" ? 1 : -1));
    return out;
  }, [rows, sort]);
  const stats = React.useMemo(() => Object.fromEntries(cols.map((c) => {
    const vs = rows.map((r) => r.values[c.key]).filter((v): v is number => v != null).sort((a, b) => a - b);
    return [c.key, { max: Math.max(0, ...vs.map(Math.abs)), q1: vs[Math.floor(vs.length * 0.25)], q3: vs[Math.min(vs.length - 1, Math.ceil(vs.length * 0.75) - 1)], n: vs.length }];
  })), [rows, cols]);
  const toggle = (key: string) => setSort((s) => (s?.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "__label" ? "asc" : "desc" }));
  const head = (key: string, label: string, right: boolean) => (
    <th key={key} scope="col" aria-sort={sort?.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("sticky top-0 z-10 border-b border-border bg-muted/95 px-2.5 font-medium whitespace-nowrap text-muted-foreground backdrop-blur", right ? "text-right" : "text-left", key === "__label" && "left-0 z-20")}>
      <button type="button" onClick={() => toggle(key)} className={cn("inline-flex items-center gap-1 hover:text-foreground", right && "flex-row-reverse")}>
        {label}
        {sort?.key === key ? (sort.dir === "asc" ? <IconArrowUp className="size-3" /> : <IconArrowDown className="size-3" />) : null}
      </button>
    </th>
  );
  return (
    <div className={cn("overflow-auto scrollbar-thin", className)} style={{ maxHeight }} data-slot="dense-table">
      <table className="w-full border-separate border-spacing-0 text-[12px] [&_td]:h-[30px] [&_th]:h-8">
        <thead>
          <tr>
            {rank ? <th className="sticky top-0 z-10 w-8 border-b border-border bg-muted/95 px-2 text-right font-medium text-muted-foreground">#</th> : null}
            {head("__label", dimLabel, false)}
            {cols.map((c) => head(c.key, c.label, true))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.id ?? r.label} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn("group", onRowClick && "cursor-pointer")}>
              {rank ? <td className="border-b border-border/50 px-2 text-right text-muted-foreground tabular-nums group-hover:bg-muted/60">{i + 1}</td> : null}
              <th scope="row" className="sticky left-0 border-b border-border/50 bg-card px-2.5 text-left font-medium whitespace-nowrap group-hover:bg-muted/60">
                <span className="flex max-w-[280px] items-baseline gap-1.5"><span className="truncate">{r.label}</span>{r.sub ? <span className="truncate text-[11px] font-normal text-muted-foreground">{r.sub}</span> : null}</span>
              </th>
              {cols.map((c) => {
                const v = r.values[c.key];
                const st = stats[c.key];
                const good = c.higherIsBetter !== undefined && v != null && st.n >= 4 && (c.higherIsBetter ? v >= st.q3 : v <= st.q1);
                const bad = c.higherIsBetter !== undefined && v != null && st.n >= 4 && (c.higherIsBetter ? v <= st.q1 : v >= st.q3);
                return (
                  <td key={c.key} className="border-b border-border/50 px-2.5 text-right tabular-nums whitespace-nowrap group-hover:bg-muted/60" style={c.width ? { width: c.width } : undefined}>
                    {c.bar && v != null && st.max ? (
                      <span className="inline-flex w-full items-center justify-end gap-2">
                        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary/70" style={{ width: `${(Math.abs(v) / st.max) * 100}%` }} /></span>
                        <span className="min-w-[60px]">{fmt(v, c.format, true)}</span>
                      </span>
                    ) : (
                      <span className={cn(good && "rounded px-1 py-px bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", bad && "rounded px-1 py-px bg-rose-500/10 text-rose-700 dark:text-rose-400")}>{fmt(v, c.format, true)}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {total ? (
          <tfoot>
            <tr className="font-semibold">
              {rank ? <td className="sticky bottom-0 border-t border-border bg-muted" /> : null}
              <th scope="row" className="sticky bottom-0 left-0 z-10 border-t border-border bg-muted px-2.5 text-left">Total</th>
              {cols.map((c) => <td key={c.key} className="sticky bottom-0 border-t border-border bg-muted px-2.5 text-right tabular-nums">{fmt(total[c.key], c.format, true)}</td>)}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
