import * as React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { IconLayoutGridAdd, IconSparkles } from "@tabler/icons-react";
import { ModulePage } from "@/components/app/module";
import { DataTable, type Col } from "@/components/app/kit";
import { DatasetFilterBar } from "@/components/app/filters";
import { PivotWorkbench } from "@/components/app/pivot";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/select";
import { DATASETS, dataset, type Row } from "@/ai/catalog";
import { applyFilters, fmt, type Filter } from "@/ai/engine";
import type { PivotConfig } from "@/ai/pivot";
import { usePersistentState } from "@/state/app";
import { useDashboards } from "@/state/dashboards";
import { useAI } from "@/state/ai";
import { PIVOT_PRESETS } from "@/data/presets";
import { cn } from "@/lib/utils";

export default function Explore() {
  const { tab = "pivot" } = useParams();
  return (
    <ModulePage moduleId="explore" tab={tab}>
      {tab === "table" ? <RawRecords /> : <PivotTab />}
    </ModulePage>
  );
}

function PivotTab() {
  const [cfg, setCfg] = usePersistentState<PivotConfig>("explore.pivot.v1", PIVOT_PRESETS[0].cfg);
  const db = useDashboards();
  const nav = useNavigate();
  const active = PIVOT_PRESETS.find((p) => JSON.stringify(p.cfg) === JSON.stringify(cfg))?.id;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-muted-foreground">Start from:</span>
        {PIVOT_PRESETS.map((p) => (
          <button key={p.id} type="button" onClick={() => setCfg(p.cfg)} aria-pressed={active === p.id}
            className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", active === p.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-muted")}>{p.label}</button>
        ))}
        <Button size="sm" variant="outline" className="ml-auto h-7 gap-1.5 text-xs" onClick={() => {
          const id = db.addWidgetToDashboard(null, { kind: "pivot", title: pivotTitle(cfg), w: 12, h: 5, pivot: cfg });
          nav(`/dashboards/${id}`);
        }}><IconLayoutGridAdd className="size-4" /> Add to dashboard</Button>
      </div>
      <PivotWorkbench cfg={cfg} onChange={setCfg} maxHeight="calc(100vh - 360px)" />
    </div>
  );
}

export function pivotTitle(cfg: PivotConfig) {
  const ds = dataset(cfg.dataset)!;
  const m = cfg.measures.map((k) => ds.measures.find((x) => x.key === k)?.label).filter(Boolean).join(", ");
  const by = [...cfg.rows, ...(cfg.cols ? [cfg.cols] : [])].map((k) => ds.dims.find((d) => d.key === k)?.label).join(" × ");
  return `${m} by ${by}`;
}

/* ------------------------------- Raw records ------------------------------- */
const HIDDEN = new Set(["day_ts", "epod_done", "delivered", "sys_detention", "otif_qty"]);
const LABELS: Record<string, string> = {
  id: "ID", freight: "Freight ₹", km: "Distance km", cases: "Cases", detention: "Detention ₹", short_qty: "Shortage qty", transit_h: "Transit h", plant_h: "Plant TAT h",
  qty: "Order qty", disp_qty: "Dispatched qty", otif: "OTIF %", cycle_h: "Approval → dispatch h", indent_h: "Approval → indent h", sales: "Sales ₹", target: "Target ₹",
};
const human = (k: string) => LABELS[k] ?? k.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
const formatOf = (k: string) => (k === "otif" ? "pct100" : /_h$/.test(k) ? "hours" : /freight|detention|sales|target|revenue|claims|scheme|expiry|commission|cost|margin|bom/i.test(k) ? "inr" : /yield/i.test(k) ? "ratio" : "number");

function RawRecords() {
  const [params, setParams] = useSearchParams();
  const dsKey = params.get("ds") && dataset(params.get("ds")!) ? params.get("ds")! : "trips";
  const ds = dataset(dsKey)!;
  const [filters, setFilters] = usePersistentState<Record<string, Filter[]>>("explore.raw.filters.v1", {});
  const f = filters[dsKey] ?? [];
  // Newest records first.
  const rows = React.useMemo(() => applyFilters(ds.rows(), f).slice().reverse(), [ds, f]);
  const keys = React.useMemo(() => Object.keys(ds.rows()[0] ?? {}).filter((k) => !HIDDEN.has(k)), [ds]);
  const dimKeys = new Set(ds.dims.map((d) => d.key));
  const cols = React.useMemo<Col<Row>[]>(() => keys.map((k) => {
    if (dimKeys.has(k) || typeof ds.rows()[0][k] === "string") {
      return { id: k, header: ds.dims.find((d) => d.key === k)?.label ?? human(k), value: (r: Row) => (r[k] == null ? "" : String(r[k])), cell: (r: Row) => (r[k] == null ? <span className="text-muted-foreground">—</span> : String(r[k])) };
    }
    const fm = formatOf(k);
    return {
      id: k, header: human(k), align: "right" as const, value: (r: Row) => (r[k] == null ? null : Number(r[k])),
      cell: (r: Row) => { const v = r[k] as number | null; return v == null ? <span className="text-muted-foreground">—</span> : fm === "pct100" ? (v * 100).toFixed(1) + "%" : fm === "ratio" ? v.toFixed(3) : fmt(v, fm); },
      csv: (r: Row) => (r[k] == null ? "" : Number(r[k])),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [keys, ds]);
  const ai = useAI();
  const search = React.useCallback((r: Row) => keys.filter((k) => typeof r[k] === "string").map((k) => r[k]).join(" "), [keys]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FormSelect aria-label="Dataset" value={dsKey} onChange={(e) => setParams({ ds: e.target.value })} className="h-8 w-60 rounded-md px-2.5 text-[13px]">
          {DATASETS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
        </FormSelect>
        <p className="m-0 max-w-2xl text-xs text-muted-foreground">{ds.description}</p>
      </div>
      <DatasetFilterBar ds={ds} filters={f} onChange={(x) => setFilters((all) => ({ ...all, [dsKey]: x }))}
        count={<span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">{rows.length.toLocaleString("en-IN")} of {ds.rows().length.toLocaleString("en-IN")} records</span>} />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border/70 bg-border/70 sm:grid-cols-3 lg:grid-cols-6" aria-label="Totals for the filtered records">
        {ds.measures.slice(0, 6).map((m) => (
          <div key={m.key} className="bg-card px-3 py-2">
            <div className="truncate text-[11px] text-muted-foreground">{m.label}</div>
            <div className="text-[15px] font-semibold tracking-tight tabular-nums">{fmt(m.agg(rows), m.format)}</div>
          </div>
        ))}
      </div>
      <DataTable rows={rows} cols={cols} search={search} searchPlaceholder={`Search ${ds.label.toLowerCase()}…`} pageSize={25} maxHeight="calc(100vh - 380px)"
        exportName={`${ds.key}_records`} getRowId={(r, i) => String(r.id ?? i)}
        toolbar={<Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => ai?.ask(`Summarise ${ds.label} — what stands out?`)}><IconSparkles className="size-4" /> Ask AI</Button>} />
    </div>
  );
}
