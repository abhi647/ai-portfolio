/* Pivot table + field builder over the semantic layer (rows × columns × values, with filters). */
import * as React from "react";
import {
  IconArrowsExchange, IconCategory, IconChevronDown, IconChevronRight, IconDownload, IconGripVertical, IconHash, IconLayoutRows, IconLayoutColumns,
  IconMathFunction, IconPlus, IconX, IconArrowsMaximize, IconArrowsMinimize,
} from "@tabler/icons-react";
import { DATASETS, dataset, type Dataset } from "@/ai/catalog";
import { fmt } from "@/ai/engine";
import { TOTAL, asPct, flatten, pivot, shown, type PivotConfig, type PivotNode, type PivotResult } from "@/ai/pivot";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FormSelect } from "@/components/ui/select";
import { EmptyState } from "@/components/overtrue/empty-state";
import { DatasetFilterBar } from "./filters";
import { cn } from "@/lib/utils";

/* ---------------------------------- Table ---------------------------------- */
export function PivotTable({ result, maxHeight = 560, className, onRowClick }: {
  result: PivotResult; maxHeight?: number | string; className?: string; onRowClick?: (n: PivotNode) => void;
}) {
  const r = result;
  const { cfg, measures, colKeys } = r;
  const all = React.useMemo(() => flatten(r.root), [r]);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => initialCollapse(all, cfg));
  const sig = cfg.dataset + cfg.rows.join("|");
  const prevSig = React.useRef(sig);
  React.useEffect(() => { if (prevSig.current !== sig) { prevSig.current = sig; setCollapsed(initialCollapse(all, cfg)); } }, [sig, all, cfg]);
  const visible = React.useMemo(() => flatten(r.root, (id) => !collapsed.has(id)), [r, collapsed]);
  const cols = cfg.cols ? [...colKeys, ...(cfg.totals ? [TOTAL] : [])] : [TOTAL];
  const multiM = measures.length > 1;
  const dimLabel = (k: string) => r.ds.dims.find((d) => d.key === k)?.label ?? k;
  const parents = all.filter((n) => n.children.length);

  const cell = (n: PivotNode, c: string, mi: number, total = false) => {
    const m = measures[mi];
    const v = shown(r, n, c, m);
    const pctMode = asPct(r, m);
    const text = v == null ? "" : pctMode ? v.toFixed(1) + "%" : fmt(v, m.format, true);
    let bg: string | undefined;
    if (cfg.heatmap && !total && !n.children.length && c !== TOTAL && v != null && !pctMode) {
      const [lo, hi] = r.range[m.key] ?? [0, 0];
      const t = hi > lo ? (v - lo) / (hi - lo) : 0.5;
      const hue = m.higherIsBetter === false ? "var(--color-chart-5, #e11d48)" : "var(--color-primary)";
      bg = `color-mix(in oklab, ${hue} ${Math.round(4 + t * 38)}%, transparent)`;
    }
    return (
      <td key={c + m.key} title={v == null ? "No records" : undefined}
        className={cn("border-b border-l border-border/50 px-2.5 text-right tabular-nums whitespace-nowrap", c === TOTAL && "bg-muted/40 font-medium", total && "font-semibold", mi === 0 && "border-l-border")}
        style={bg ? { background: bg } : undefined}>{text}</td>
    );
  };

  if (!r.root.children.length && cfg.rows.length) {
    return <EmptyState title="No records match" description="Remove a filter or pick different fields." />;
  }

  return (
    <div className={cn("relative overflow-auto rounded-lg border border-border/70 bg-card scrollbar-thin", className)} style={{ maxHeight }} data-slot="pivot-table">
      <table className="w-max min-w-full border-separate border-spacing-0 text-[12px] leading-none [&_td]:h-7 [&_th]:h-7">
        <thead className="sticky top-0 z-20 bg-muted/90 backdrop-blur [&_th]:font-medium [&_th]:text-muted-foreground">
          <tr>
            <th rowSpan={cfg.cols && multiM ? 2 : 1} className="sticky left-0 z-30 border-b border-border bg-muted px-2.5 text-left">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-foreground">{cfg.rows.length ? cfg.rows.map(dimLabel).join(" › ") : "Total"}</span>
                {parents.length ? (
                  <span className="ml-auto flex">
                    <button type="button" className="rounded p-0.5 hover:bg-background" aria-label="Expand all" title="Expand all" onClick={() => setCollapsed(new Set())}><IconArrowsMaximize className="size-3.5" /></button>
                    <button type="button" className="rounded p-0.5 hover:bg-background" aria-label="Collapse all" title="Collapse all" onClick={() => setCollapsed(new Set(parents.map((p) => p.id)))}><IconArrowsMinimize className="size-3.5" /></button>
                  </span>
                ) : null}
              </div>
            </th>
            {cfg.cols
              ? cols.map((c) => <th key={c} colSpan={measures.length} className={cn("border-b border-l border-border px-2.5 text-right whitespace-nowrap", c === TOTAL && "text-foreground")}>{c === TOTAL ? "Total" : c}</th>)
              : measures.map((m) => <th key={m.key} className="border-b border-l border-border px-2.5 text-right whitespace-nowrap">{m.label}{asPct(r, m) ? " (%)" : ""}</th>)}
          </tr>
          {cfg.cols && multiM ? (
            <tr>{cols.flatMap((c) => measures.map((m, i) => <th key={c + m.key} className={cn("border-b border-l border-border/60 px-2.5 text-right font-normal whitespace-nowrap", i === 0 && "border-l-border")}>{m.label}{asPct(r, m) ? " %" : ""}</th>))}</tr>
          ) : null}
        </thead>
        <tbody>
          {visible.map((n) => {
            const parent = n.children.length > 0;
            const open = !collapsed.has(n.id);
            return (
              <tr key={n.id} className={cn("group", parent && "bg-muted/25 font-medium", onRowClick && "cursor-pointer")} onClick={onRowClick ? () => onRowClick(n) : undefined}>
                <th scope="row" className={cn("sticky left-0 z-10 border-b border-border/50 bg-card px-2.5 text-left font-[inherit] whitespace-nowrap group-hover:bg-muted", parent && "bg-[color-mix(in_oklab,var(--color-muted)_45%,var(--color-card))]")}>
                  <div className="flex max-w-[340px] items-center gap-1" style={{ paddingLeft: n.depth * 14 }}>
                    {parent ? (
                      <button type="button" aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} ${n.label}`} className="-ml-1 rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); setCollapsed((s) => { const x = new Set(s); if (x.has(n.id)) x.delete(n.id); else x.add(n.id); return x; }); }}>
                        {open ? <IconChevronDown className="size-3.5" /> : <IconChevronRight className="size-3.5" />}
                      </button>
                    ) : <span className="w-3" />}
                    <span className="truncate text-foreground">{n.label}</span>
                    {parent ? <span className="ml-1 text-[10px] font-normal text-muted-foreground">{n.children.length}</span> : null}
                  </div>
                </th>
                {cols.flatMap((c) => measures.map((_, mi) => cell(n, c, mi)))}
              </tr>
            );
          })}
        </tbody>
        {cfg.totals && cfg.rows.length ? (
          <tfoot className="sticky bottom-0 z-20">
            <tr className="bg-muted">
              <th scope="row" className="sticky left-0 z-30 border-t border-border bg-muted px-2.5 text-left font-semibold">Grand total</th>
              {cols.flatMap((c) => measures.map((_, mi) => <React.Fragment key={c + mi}>{cell(r.root, c, mi, true)}</React.Fragment>))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

function initialCollapse(all: PivotNode[], cfg: PivotConfig) {
  if (cfg.rows.length < 2 || all.length <= 120) return new Set<string>();
  return new Set(all.filter((n) => n.children.length && n.depth >= 0).map((n) => n.id));
}

export function pivotCsv(r: PivotResult) {
  const { cfg, measures, colKeys } = r;
  const cols = cfg.cols ? [...colKeys, TOTAL] : [TOTAL];
  const head = [...cfg.rows.map((k) => r.ds.dims.find((d) => d.key === k)?.label ?? k), ...cols.flatMap((c) => measures.map((m) => `${c === TOTAL ? "Total" : c} · ${m.label}${asPct(r, m) ? " %" : ""}`))];
  const lines = [head];
  for (const n of [...flatten(r.root), r.root]) {
    const path = cfg.rows.map((_, i) => (n === r.root ? (i === 0 ? "Grand total" : "") : n.path[i] ?? ""));
    lines.push([...path, ...cols.flatMap((c) => measures.map((m) => { const v = shown(r, n, c, m); return v == null ? "" : String(+v.toFixed(4)); }))]);
  }
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + lines.map((l) => l.map(esc).join(",")).join("\n")], { type: "text/csv" }));
  a.download = `pivot_${cfg.dataset}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* --------------------------------- Builder --------------------------------- */
type Zone = "rows" | "cols" | "values";
interface Drag { kind: "dim" | "measure"; key: string; from: Zone | "fields" }
const DRAG_MIME = "application/x-dfm-field";

function move(cfg: PivotConfig, d: Drag, to: Zone, index?: number): PivotConfig {
  const next = { ...cfg, rows: [...cfg.rows], measures: [...cfg.measures] };
  if (d.kind === "measure") {
    if (to !== "values") return cfg;
    next.measures = next.measures.filter((k) => k !== d.key);
    next.measures.splice(index ?? next.measures.length, 0, d.key);
    next.measures = next.measures.slice(0, 4);
    return next;
  }
  if (to === "values") return cfg;
  const oldCol = next.cols;
  next.rows = next.rows.filter((k) => k !== d.key);
  if (next.cols === d.key) next.cols = null;
  if (to === "rows") {
    next.rows.splice(index ?? next.rows.length, 0, d.key);
    next.rows = next.rows.slice(0, 3);
  } else {
    next.cols = d.key;
    if (oldCol && oldCol !== d.key && d.from === "rows") next.rows.splice(index ?? next.rows.length, 0, oldCol);
  }
  return next;
}

export function PivotBuilder({ cfg, onChange, compact, showDataset = true }: { cfg: PivotConfig; onChange: (c: PivotConfig) => void; compact?: boolean; showDataset?: boolean }) {
  const ds = dataset(cfg.dataset)!;
  const [over, setOver] = React.useState<Zone | null>(null);
  const used = new Set([...cfg.rows, cfg.cols ?? "", ...cfg.measures]);
  const dims = ds.dims, ms = ds.measures;
  const label = (k: string) => dims.find((d) => d.key === k)?.label ?? ms.find((m) => m.key === k)?.label ?? k;

  const onDrop = (to: Zone, index?: number) => (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setOver(null);
    try { const d = JSON.parse(e.dataTransfer.getData(DRAG_MIME)) as Drag; onChange(move(cfg, d, to, index)); } catch { /* not a field */ }
  };
  const dragProps = (d: Drag) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { e.dataTransfer.setData(DRAG_MIME, JSON.stringify(d)); e.dataTransfer.effectAllowed = "move"; },
  });
  const remove = (z: Zone, k: string) => onChange(z === "rows" ? { ...cfg, rows: cfg.rows.filter((x) => x !== k) } : z === "cols" ? { ...cfg, cols: null } : { ...cfg, measures: cfg.measures.length > 1 ? cfg.measures.filter((x) => x !== k) : cfg.measures });

  const zone = (z: Zone, title: string, Icon: typeof IconLayoutRows, keys: string[], addOptions: { key: string; label: string }[], hint: string) => (
    <div
      onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_MIME)) { e.preventDefault(); setOver(z); } }}
      onDragLeave={() => setOver((o) => (o === z ? null : o))}
      onDrop={onDrop(z)}
      className={cn("flex min-w-0 flex-col gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 p-2 transition-colors", over === z && "border-primary bg-primary/5")}
      aria-label={`${title} drop zone`}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        <Icon className="size-3.5" /> {title}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={`Add to ${title}`} className="ml-auto inline-flex h-6 items-center gap-0.5 rounded-md px-1.5 text-[11px] font-medium normal-case text-primary hover:bg-primary/10"><IconPlus className="size-3" />Add</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
            {addOptions.map((o) => (
              <DropdownMenuItem key={o.key} className="text-[13px]" onSelect={() => onChange(move(cfg, { kind: z === "values" ? "measure" : "dim", key: o.key, from: cfg.rows.includes(o.key) ? "rows" : cfg.cols === o.key ? "cols" : "fields" }, z))}>{o.label}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex min-h-7 flex-wrap gap-1">
        {keys.length ? keys.map((k, i) => (
          <span key={k} {...dragProps({ kind: z === "values" ? "measure" : "dim", key: k, from: z })}
            onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_MIME)) e.preventDefault(); }}
            onDrop={onDrop(z, i)}
            className="inline-flex max-w-full cursor-grab items-center gap-1 rounded-md bg-background py-1 pr-1 pl-1.5 text-xs shadow-xs ring-1 ring-border active:cursor-grabbing">
            <IconGripVertical className="size-3 shrink-0 text-muted-foreground" />
            <span className="truncate">{label(k)}</span>
            <button type="button" aria-label={`Remove ${label(k)}`} onClick={() => remove(z, k)} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"><IconX className="size-3" /></button>
          </span>
        )) : <span className="self-center text-[11px] text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2.5">
      <div className={cn("grid gap-2", compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))]")}>
        <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border/70 p-2">
          <div className="flex items-center gap-2">
            {showDataset ? (
              <FormSelect aria-label="Dataset" value={cfg.dataset} onChange={(e) => onChange(defaultFor(e.target.value))} className="h-7 flex-1 rounded-md px-2 text-xs">
                {DATASETS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </FormSelect>
            ) : <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Fields</span>}
          </div>
          <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto scrollbar-thin" aria-label="Available fields — drag into Rows, Columns or Values">
            {dims.filter((d) => !used.has(d.key)).map((d) => (
              <span key={d.key} {...dragProps({ kind: "dim", key: d.key, from: "fields" })} className="inline-flex cursor-grab items-center gap-1 rounded-md bg-muted px-1.5 py-1 text-[11px] active:cursor-grabbing" title="Drag to Rows or Columns">
                <IconCategory className="size-3 text-muted-foreground" />{d.label}
              </span>
            ))}
            {ms.filter((m) => !used.has(m.key)).map((m) => (
              <span key={m.key} {...dragProps({ kind: "measure", key: m.key, from: "fields" })} className="inline-flex cursor-grab items-center gap-1 rounded-md bg-primary/8 px-1.5 py-1 text-[11px] text-primary active:cursor-grabbing" title="Drag to Values">
                <IconHash className="size-3" />{m.label}
              </span>
            ))}
          </div>
        </div>
        {zone("rows", "Rows", IconLayoutRows, cfg.rows, dims.filter((d) => !cfg.rows.includes(d.key)).map((d) => ({ key: d.key, label: d.label })), "Drop a field to group rows")}
        {zone("cols", "Columns", IconLayoutColumns, cfg.cols ? [cfg.cols] : [], dims.filter((d) => d.key !== cfg.cols).map((d) => ({ key: d.key, label: d.label })), "Optional · e.g. Month")}
        {zone("values", "Values", IconMathFunction, cfg.measures, ms.filter((m) => !cfg.measures.includes(m.key)).map((m) => ({ key: m.key, label: m.label })), "Drop a measure")}
      </div>
    </div>
  );
}

const defaultFor = (k: string): PivotConfig => {
  const d = dataset(k)!;
  const firstDim = d.dims.find((x) => !x.time)?.key ?? d.dims[0].key;
  return { dataset: k, rows: [firstDim], cols: d.dims.some((x) => x.key === "month") ? "month" : null, measures: [d.measures[0].key], filters: [], heatmap: true, pct: "none", sort: "label", totals: true };
};

export function PivotOptions({ cfg, onChange, result }: { cfg: PivotConfig; onChange: (c: PivotConfig) => void; result?: PivotResult }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
      <label className="inline-flex items-center gap-1.5"><Switch className="origin-left scale-90" checked={cfg.heatmap} onCheckedChange={(v: boolean) => onChange({ ...cfg, heatmap: v })} /> Heatmap</label>
      <label className="inline-flex items-center gap-1.5"><Switch className="origin-left scale-90" checked={cfg.totals} onCheckedChange={(v: boolean) => onChange({ ...cfg, totals: v })} /> Totals</label>
      <label className="inline-flex items-center gap-1.5 text-muted-foreground">Show as
        <FormSelect aria-label="Show values as" value={cfg.pct} onChange={(e) => onChange({ ...cfg, pct: e.target.value as PivotConfig["pct"] })} className="h-7 w-32 rounded-md px-2 text-xs text-foreground">
          <option value="none">Values</option><option value="col">% of column</option><option value="row">% of row</option><option value="total">% of grand total</option>
        </FormSelect>
      </label>
      <label className="inline-flex items-center gap-1.5 text-muted-foreground">Sort
        <FormSelect aria-label="Sort rows" value={cfg.sort} onChange={(e) => onChange({ ...cfg, sort: e.target.value as PivotConfig["sort"] })} className="h-7 w-36 rounded-md px-2 text-xs text-foreground">
          <option value="label">Natural order</option><option value="desc">First value ↓</option><option value="asc">First value ↑</option>
        </FormSelect>
      </label>
      <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" disabled={!cfg.cols || cfg.rows.length !== 1}
        onClick={() => onChange({ ...cfg, rows: [cfg.cols!], cols: cfg.rows[0] })}><IconArrowsExchange className="size-3.5" /> Swap rows & columns</Button>
      {result ? <Button variant="outline" size="sm" className="ml-auto h-7 gap-1 px-2 text-xs" onClick={() => pivotCsv(result)}><IconDownload className="size-3.5" /> CSV</Button> : null}
    </div>
  );
}

/** Builder + filters + options + table, for the Explorer page. */
export function PivotWorkbench({ cfg, onChange, maxHeight }: { cfg: PivotConfig; onChange: (c: PivotConfig) => void; maxHeight?: number | string }) {
  const result = React.useMemo(() => pivot(cfg), [cfg]);
  const ds = dataset(cfg.dataset) as Dataset;
  return (
    <div className="flex flex-col gap-3">
      <PivotBuilder cfg={cfg} onChange={onChange} />
      <DatasetFilterBar ds={ds} filters={cfg.filters} onChange={(f) => onChange({ ...cfg, filters: f })}
        count={"error" in result ? null : <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">{result.matched.toLocaleString("en-IN")} records</span>} />
      <PivotOptions cfg={cfg} onChange={onChange} result={"error" in result ? undefined : result} />
      {"error" in result ? <EmptyState title="Nothing to pivot yet" description={result.error} icon={<IconPlus className="size-5" />} /> : (
        <>
          <PivotTable result={result} maxHeight={maxHeight} />
          {result.droppedCols ? <p className="m-0 text-xs text-muted-foreground">Showing the last 40 columns — {result.droppedCols} more hidden. Filter or pick a coarser column field.</p> : null}
        </>
      )}
    </div>
  );
}
