/* App-level compositions built only from overtrue/ui components and its visual language. */
import * as React from "react";
import { IconDownload, IconInfoCircle, IconSparkles } from "@tabler/icons-react";
import { useAI } from "@/state/ai";
import { parseInsight } from "@/components/overtrue/insight-card";
import { cn } from "@/lib/utils";
import { SectionCard } from "@/components/overtrue/section-card";
import { KpiCard } from "@/components/overtrue/kpi-card";
import { PeriodTabs } from "@/components/overtrue/period-tabs";
import { StatusBadge } from "@/components/overtrue/status-badge";
import { EmptyState } from "@/components/overtrue/empty-state";
import {
  DataTable as OtDataTable,
  DataTableColumnHeader,
  type DataTableColumnDef,
  type DataTableRow,
} from "@/components/overtrue/advanced-data-table";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/* ---------------------------------- Panel --------------------------------- */
const SPAN: Record<number, string> = {
  3: "lg:col-span-3", 4: "lg:col-span-4", 5: "lg:col-span-5", 6: "lg:col-span-6", 7: "lg:col-span-7",
  8: "lg:col-span-8", 9: "lg:col-span-9", 12: "lg:col-span-12",
};

/** Charts inside a Panel can publish an auto-generated insight; an explicit `insight` prop wins. */
const InsightCtx = React.createContext<((text: string | null) => void) | null>(null);
export function useAutoInsight(text: string | null) {
  const set = React.useContext(InsightCtx);
  React.useEffect(() => { set?.(text); }, [set, text]);
}

export function Panel({
  title, description, actions, children, className, contentClassName, wide, info, span = 6, insight,
}: {
  title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode;
  className?: string; contentClassName?: string; wide?: boolean; info?: string; span?: 3 | 4 | 5 | 6 | 7 | 8 | 9 | 12;
  /** One-line takeaway. Supports {{metric:Label|+4.2%|positive}} tokens. */
  insight?: string | null;
}) {
  const [auto, setAuto] = React.useState<string | null>(null);
  const text = insight === undefined ? auto : insight;
  const ai = useAI();
  const askLabel = typeof title === "string" ? title : null;
  const askBtn = ai && askLabel ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Ask AI about ${askLabel}`} className="text-muted-foreground hover:text-primary"
          onClick={() => ai.ask(`${askLabel} — what stands out, why, and what should I do?`)}>
          <IconSparkles className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="text-xs">Ask AI about this chart</TooltipContent>
    </Tooltip>
  ) : null;
  return (
    <InsightCtx.Provider value={setAuto}>
      <SectionCard
        title={title ? (
          <span className="inline-flex items-center gap-1.5">
            {title}
            {info ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="How this is calculated" className="text-muted-foreground hover:text-foreground">
                    <IconInfoCircle className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs leading-5">{info}</TooltipContent>
              </Tooltip>
            ) : null}
          </span>
        ) : undefined}
        description={description}
        actions={askBtn ? <>{actions}{askBtn}</> : actions}
        className={cn(SPAN[wide ? 12 : span], "flex flex-col animate-rise", className)}
        contentClassName={cn("flex flex-1 flex-col p-5", contentClassName)}
      >
        <div className="min-w-0 flex-1">{children}</div>
        {text ? <InsightLine text={text} /> : null}
      </SectionCard>
    </InsightCtx.Provider>
  );
}

/** Renders an insight sentence with metric tokens, using the overtrue/ui InsightCard token grammar. */
export function InsightLine({ text, className }: { text: string; className?: string }) {
  return (
    <div data-slot="panel-insight" className={cn("mt-4 flex items-start gap-2.5 rounded-xl bg-[color-mix(in_oklab,var(--color-primary)_6%,transparent)] px-3.5 py-2.5 text-[13px] leading-5 ring-1 ring-inset ring-[color-mix(in_oklab,var(--color-primary)_14%,transparent)]", className)}>
      <IconSparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <p className="m-0 min-w-0"><span className="sr-only">Insight: </span>{renderInsight(text)}</p>
    </div>
  );
}

export function renderInsight(text: string) {
  return parseInsight(text).map((seg, i) => {
    if (typeof seg === "string") return <React.Fragment key={i}>{seg}</React.Fragment>;
    const tone = seg.tone;
    return (
      <span key={i} className="whitespace-nowrap">
        <span className="font-semibold text-foreground">{seg.label}</span>
        {seg.value ? (
          <span className={cn("ml-1 rounded-md px-1.5 py-px text-xs font-semibold tabular-nums",
            tone === "positive" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : tone === "negative" ? "bg-rose-500/10 text-rose-700 dark:text-rose-400" : "bg-muted text-foreground")}>{seg.value}</span>
        ) : null}
      </span>
    );
  });
}

export function Grid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-[var(--grid-gap)] lg:grid-cols-12", className)}>{children}</div>;
}

export function KpiRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-[var(--grid-gap)] md:grid-cols-3 xl:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]", className)}>{children}</div>;
}

export function SectionHeading({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="m-0 text-[15px] font-semibold tracking-tight">{title}</h2>
        {description ? <p className="m-0 mt-0.5 text-[13px] text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

/* -------------------------------- Stat tile ------------------------------- */
/** A KpiCard that can act as a filter: selectable, keyboard accessible, with a color cue. */
export function Stat({
  label, value, hint, delta, invertDelta, sparkline, color, selected, onClick, icon, format,
}: {
  label: string; value: number | string; hint?: React.ReactNode; delta?: number; invertDelta?: boolean; sparkline?: number[];
  color?: string; selected?: boolean; onClick?: () => void; icon?: React.ReactNode; format?: "number" | "percent" | "compact";
}) {
  const interactive = !!onClick;
  return (
    <KpiCard
      label={label}
      value={value}
      delta={delta}
      invertDelta={invertDelta}
      sparkline={sparkline}
      format={format}
      icon={color ? <span aria-hidden className="size-2 rounded-full" style={{ background: color }} /> : icon}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? !!selected : undefined}
      onClick={onClick}
      onKeyDown={interactive ? (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick!(); } } : undefined}
      className={cn(
        "gap-2 py-4 [&_[data-slot=card-header]]:px-4 [&_[data-slot=card-content]]:px-4 [&_[data-slot=card-title]]:text-[1.5rem]",
        interactive && "cursor-pointer transition-[box-shadow,transform] duration-150 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        selected && "ring-2 ring-primary/40 dark:shadow-[0_0_24px_-8px_var(--color-primary)]",
      )}
    >
      {hint ? <span className="truncate">{hint}</span> : null}
    </KpiCard>
  );
}

/* ---------------------------------- Toggle -------------------------------- */
export function Toggle<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; label: string }) {
  return (
    <PeriodTabs
      size="sm"
      aria-label={label}
      options={options.map(([v, l]) => ({ value: v, label: l }))}
      value={value}
      onValueChange={(v: string) => onChange(v as T)}
    />
  );
}

/* --------------------------------- Badges --------------------------------- */
export type Tone = "success" | "warning" | "error" | "info" | "neutral";
export function Pill({ tone = "neutral", children, live }: { tone?: Tone; children: React.ReactNode; live?: boolean }) {
  return <StatusBadge variant={tone} live={live}>{children}</StatusBadge>;
}
export function StagePill({ s }: { s: { label: string; color: string } }) {
  const { label, color } = s;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
      style={{ background: `color-mix(in oklab, ${color} 12%, transparent)`, color: `color-mix(in oklab, ${color} 80%, var(--color-foreground))`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 25%, transparent)` }}>
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

/* ---------------------------------- Table --------------------------------- */
export interface Col<T> {
  id: string;
  header: string;
  cell?: (r: T) => React.ReactNode;
  value?: (r: T) => string | number | null | undefined;
  align?: "left" | "right";
  sortable?: boolean;
  csv?: (r: T) => string | number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DataTable<T extends Record<string, any>>({
  rows, cols, search, searchPlaceholder, pageSize = 10, onRowClick, getRowId, maxHeight, toolbar, exportName, density = "compact", emptyTitle,
  initialSorting, showPagination, footer, className,
}: {
  rows: T[]; cols: Col<T>[]; search?: (r: T) => string; searchPlaceholder?: string; pageSize?: number; onRowClick?: (r: T) => void;
  getRowId?: (r: T, i: number) => string; maxHeight?: number | string; toolbar?: React.ReactNode; exportName?: string;
  density?: "compact" | "default"; emptyTitle?: string;
  initialSorting?: { id: string; desc: boolean }[]; showPagination?: boolean;
  /** Rendered under the table, e.g. a totals row. */
  footer?: React.ReactNode; className?: string;
}) {
  const columns = React.useMemo<DataTableColumnDef<T>[]>(() => {
    const defs: DataTableColumnDef<T>[] = cols.map((c) => ({
      id: c.id,
      accessorFn: (r: T) => (c.value ? c.value(r) : ""),
      enableSorting: c.sortable !== false && !!c.value,
      header: ({ column }) => <DataTableColumnHeader column={column} title={c.header} align={c.align} />,
      cell: ({ row }: { row: DataTableRow<T> }) => (
        <div className={cn("whitespace-nowrap", c.align === "right" && "text-right tabular-nums")}>
          {c.cell ? c.cell(row.original) : String(c.value?.(row.original) ?? "—")}
        </div>
      ),
    }));
    if (search) defs.push({ id: "__q", accessorFn: (r: T) => search(r), enableHiding: false, header: () => null, cell: () => null, filterFn: "includesString" });
    return defs;
  }, [cols, search]);

  const exportCsv = () => downloadCsv(exportName || "export", cols, rows);

  const table = (
    <OtDataTable
      columns={columns}
      data={rows}
      pageSize={pageSize}
      initialSorting={initialSorting}
      showPagination={showPagination ?? (pageSize > 0 && rows.length > pageSize)}
      density={density}
      stickyHeader={!!maxHeight}
      maxHeight={maxHeight}
      getRowId={getRowId}
      searchKey={search ? "__q" : undefined}
      searchPlaceholder={searchPlaceholder ?? "Search…"}
      searchLabel="Search rows"
      initialColumnVisibility={search ? { __q: false } : undefined}
      onRowClick={onRowClick ? (row) => onRowClick(row.original) : undefined}
      rowClassName={onRowClick ? () => "cursor-pointer" : undefined}
      showViewOptions={cols.length > 6}
      emptyMessage={<EmptyState title={emptyTitle ?? "No rows match"} description="Try widening the filters or clearing the search." />}
      toolbar={toolbar || exportName ? (
        <>
          {toolbar}
          {exportName ? (
            <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
              <IconDownload className="size-4" /> Export CSV
            </Button>
          ) : null}
        </>
      ) : undefined}
    />
  );
  return footer || className ? <div className={cn("flex min-w-0 flex-col", className)}>{table}{footer}</div> : table;
}

export function downloadCsv<T>(name: string, cols: Col<T>[], rows: T[]) {
  const esc = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const lines = [cols.map((c) => esc(c.header)).join(","), ...rows.map((r) => cols.map((c) => esc(c.csv ? c.csv(r) : c.value ? c.value(r) : "")).join(","))];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv" }));
  a.download = name.replace(/[^\w]+/g, "_").slice(0, 60) + ".csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------------------------------- Misc ---------------------------------- */
export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function Foot({ children }: { children: React.ReactNode }) {
  return <p className="m-0 mt-4 text-xs leading-5 text-muted-foreground">{children}</p>;
}

export function Num({ children, tone }: { children: React.ReactNode; tone?: "good" | "warn" | "bad" | "muted" }) {
  return (
    <span className={cn("tabular-nums",
      tone === "good" && "text-emerald-700 dark:text-emerald-400",
      tone === "warn" && "text-amber-700 dark:text-amber-400",
      tone === "bad" && "text-rose-700 dark:text-rose-400",
      tone === "muted" && "text-muted-foreground")}>{children}</span>
  );
}

export function LinkCell({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} className="font-medium tabular-nums text-primary underline-offset-4 hover:underline">
      {children}
    </button>
  );
}
