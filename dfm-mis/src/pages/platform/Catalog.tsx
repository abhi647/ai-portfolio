/* Metric catalog: every governed metric with definition, formula, owner, sources, lineage and usage. */
import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { IconCertificate, IconDatabase, IconLayoutDashboard, IconMathFunction, IconTable } from "@tabler/icons-react";
import { ModulePage } from "@/components/app/module";
import { DataTable, type Col } from "@/components/app/kit";
import { MetricGroup, MetricGroupItem } from "@/components/overtrue/metric-group";
import { StatusBadge } from "@/components/overtrue/status-badge";
import { DetailList } from "@/components/overtrue/detail-list";
import { TreeView, type TreeNode } from "@/components/overtrue/tree-view";
import { JsonViewer } from "@/components/overtrue/json-viewer";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fmt } from "@/ai/engine";
import { dataset } from "@/ai/catalog";
import { metricCatalog, type MetricEntry } from "@/data/governance";
import { CUR_MONTH, MONTHS } from "@/data/data";

const curLabel = MONTHS.find((m) => m.key === CUR_MONTH)!.label;

function currentValue(m: MetricEntry) {
  const ds = dataset(m.dataset)!;
  const meas = ds.measures.find((x) => x.key === m.key)!;
  const rows = ds.rows().filter((r) => r.month === curLabel);
  return fmt(meas.agg(rows), meas.format);
}

export default function Catalog() {
  const all = React.useMemo(() => metricCatalog(), []);
  const [params, setParams] = useSearchParams();
  const sel = all.find((m) => m.id === params.get("m")) ?? null;
  const cols: Col<MetricEntry>[] = [
    { id: "label", header: "Metric", value: (m) => m.label, cell: (m) => <span className="flex flex-col"><span className="font-medium">{m.label}</span><span className="font-mono text-[11px] text-muted-foreground">{m.id}</span></span> },
    { id: "cert", header: "Status", value: (m) => (m.certified ? 1 : 0), cell: (m) => <StatusBadge variant={m.certified ? "success" : "neutral"}>{m.certified ? "Certified" : "Draft"}</StatusBadge>, csv: (m) => (m.certified ? "Certified" : "Draft") },
    { id: "domain", header: "Domain", value: (m) => m.datasetLabel },
    { id: "formula", header: "Formula", value: (m) => m.formula, cell: (m) => <span className="block max-w-[360px] truncate font-mono text-[11.5px]" title={m.formula}>{m.formula}</span> },
    { id: "owner", header: "Owner", value: (m) => m.owner },
    { id: "refresh", header: "Refresh", value: (m) => m.refresh },
    { id: "used", header: "Used in", align: "right", value: (m) => m.usedIn.length },
    { id: "rev", header: "Last reviewed", value: (m) => +m.reviewed, cell: (m) => m.reviewed.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }), csv: (m) => m.reviewed.toISOString().slice(0, 10) },
  ];
  const lineage = (m: MetricEntry): TreeNode[] => [{
    id: "metric", label: `${m.label} (${m.id})`, icon: <IconMathFunction className="size-4" />,
    children: [
      { id: "model", label: `Semantic model · ${m.datasetLabel} · ${m.grain}`, icon: <IconTable className="size-4" />, children: m.sources.map((s, i) => ({ id: `src${i}`, label: s, icon: <IconDatabase className="size-4" /> })) },
      { id: "used", label: `Used in ${m.usedIn.length} places`, icon: <IconLayoutDashboard className="size-4" />, children: m.usedIn.map((u, i) => ({ id: `u${i}`, label: u })) },
    ],
  }];

  return (
    <ModulePage moduleId="catalog">
      <MetricGroup className="grid grid-cols-2 lg:grid-cols-5">
        <MetricGroupItem label="Metrics" value={all.length} context="across 5 governed datasets" />
        <MetricGroupItem label="Certified" value={all.filter((m) => m.certified).length} context="reviewed and owned" />
        <MetricGroupItem label="Draft" value={all.filter((m) => !m.certified).length} context="available in Explorer and Ask AI" />
        <MetricGroupItem label="Owners" value={new Set(all.map((m) => m.owner)).size} context="named business owners" />
        <MetricGroupItem label="Source tables" value={new Set(all.flatMap((m) => m.sources)).size} context="feeding the semantic layer" />
      </MetricGroup>
      <DataTable rows={all} cols={cols} search={(m) => `${m.label} ${m.id} ${m.owner} ${m.formula} ${m.datasetLabel}`} searchPlaceholder="Search metrics, formulas, owners…" pageSize={15}
        exportName="metric_catalog" getRowId={(m) => m.id} onRowClick={(m) => setParams({ m: m.id })} initialSorting={[{ id: "cert", desc: true }]} />

      <Sheet open={!!sel} onOpenChange={(o) => !o && setParams({})}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[560px]">
          {sel ? (
            <>
              <SheetHeader className="border-b border-border px-5 py-4">
                <SheetTitle className="flex items-center gap-2">{sel.label}{sel.certified ? <StatusBadge variant="success"><IconCertificate className="size-3.5" />Certified</StatusBadge> : <StatusBadge variant="neutral">Draft</StatusBadge>}</SheetTitle>
                <SheetDescription className="font-mono text-xs">{sel.id}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-5 px-5 py-4">
                <DetailList divided items={[
                  { id: "v", label: `Value · ${curLabel} (MTD)`, value: <b className="tabular-nums">{currentValue(sel)}</b> },
                  { id: "f", label: "Formula", value: <code className="text-[12px]">{sel.formula}</code> },
                  { id: "o", label: "Business owner", value: sel.owner },
                  { id: "g", label: "Grain", value: sel.grain },
                  { id: "r", label: "Refresh", value: sel.refresh },
                  { id: "s", label: "Sources", value: sel.sources.join(" · ") },
                  { id: "d", label: "Dataset", value: dataset(sel.dataset)!.description },
                  { id: "rv", label: "Last reviewed", value: sel.reviewed.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) },
                ]} />
                <div><div className="eyebrow mb-2">Lineage</div><TreeView nodes={lineage(sel)} defaultExpanded={["metric", "model", "used"]} /></div>
                <JsonViewer title="Semantic-layer definition" data={{ id: sel.id, dataset: sel.dataset, measure: sel.key, format: sel.format, formula: sel.formula, owner: sel.owner, certified: sel.certified, sources: sel.sources }} defaultExpandDepth={1} />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </ModulePage>
  );
}
