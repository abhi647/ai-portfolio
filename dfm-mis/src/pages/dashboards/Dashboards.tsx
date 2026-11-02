import * as React from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { IconChartBar, IconCopy, IconDots, IconLayoutGrid, IconPlus, IconReportMoney, IconRestore, IconTrash, IconTruck } from "@tabler/icons-react";
import { PageHeader } from "@/components/overtrue/page-header";
import { StatusBadge } from "@/components/overtrue/status-badge";
import { SectionCard } from "@/components/overtrue/section-card";
import { DataTable, type Col } from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { widgetDataset } from "@/components/dash/WidgetView";
import { dataset } from "@/ai/catalog";
import { useDashboards } from "@/state/dashboards";
import { TEMPLATES, fromTemplate, type DashboardDef, type Widget } from "@/data/presets";
import { fdt } from "@/data/format";
import { cn } from "@/lib/utils";

const ICON: Record<string, typeof IconTruck> = { truck: IconTruck, chart: IconChartBar, money: IconReportMoney };
const KIND_COLOR: Record<Widget["kind"], string> = { kpi: "bg-primary/70", chart: "bg-chart-2/70", table: "bg-chart-3/70", pivot: "bg-chart-4/70", note: "bg-muted-foreground/40" };

export default function Dashboards() {
  const db = useDashboards();
  const nav = useNavigate();
  const [creating, setCreating] = React.useState(false);
  const sorted = [...db.dashboards].sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow="Workspace" title="My dashboards" description="Build your own views from KPIs, charts, tables and pivots on live MIS data. Arrange them by dragging, resize from the corner, filter the whole board, and share a link."
        actions={<div className="flex gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => db.resetTemplates()} title="Re-add the starter dashboards"><IconRestore className="size-4" /> Restore templates</Button>
          <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}><IconPlus className="size-4" /> New dashboard</Button>
        </div>} />

      <DataTable rows={sorted} pageSize={0} showPagination={false} getRowId={(d) => d.id} onRowClick={(d) => nav(`/dashboards/${d.id}`)}
        initialSorting={[{ id: "updated", desc: true }]} emptyTitle="No dashboards yet — create one from a template."
        cols={[
          { id: "name", header: "Dashboard", value: (d) => d.name, cell: (d) => <div className="min-w-0 whitespace-normal"><Link to={`/dashboards/${d.id}`} className="font-medium hover:text-primary" onClick={(e) => e.stopPropagation()}>{d.name}</Link>{d.description ? <div className="max-w-xl truncate text-xs text-muted-foreground">{d.description}</div> : null}</div> },
          { id: "layout", header: "Layout", cell: (d) => <MiniLayout d={d} /> },
          { id: "src", header: "Data sources", value: (d) => sources(d).join(", "), cell: (d) => <div className="flex flex-wrap gap-1">{sources(d).map((x) => <StatusBadge key={x} variant="neutral">{x}</StatusBadge>)}</div> },
          { id: "widgets", header: "Widgets", align: "right", value: (d) => d.widgets.length },
          { id: "updated", header: "Updated", value: (d) => d.updatedAt, cell: (d) => <span className="text-xs text-muted-foreground">{fdt(new Date(d.updatedAt))}</span> },
          { id: "act", header: "", cell: (d) => (
            <span onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`${d.name} actions`}><IconDots className="size-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => nav(`/dashboards/${d.id}`)}><IconLayoutGrid className="size-4" /> Open</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => { const id = db.duplicate(d.id); if (id) nav(`/dashboards/${id}`); }}><IconCopy className="size-4" /> Duplicate</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => { if (window.confirm(`Delete “${d.name}”?`)) db.remove(d.id); }}><IconTrash className="size-4" /> Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          ) },
        ] as Col<DashboardDef>[]} />

      <section className="flex flex-col gap-2.5">
        <h2 className="m-0 text-[13px] font-semibold tracking-tight">Start from a template</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {TEMPLATES.map((t) => {
            const I = ICON[t.icon] ?? IconLayoutGrid;
            return (
              <SectionCard key={t.id} contentClassName="p-0"><button type="button" onClick={() => { const id = db.create(fromTemplate(t)); nav(`/dashboards/${id}`); }}
                className="group flex w-full flex-col gap-2 p-4 text-left transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none">
                <div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><I className="size-4" /></span><span className="font-semibold text-[13px]">{t.name}</span><span className="ml-auto text-xs text-muted-foreground">{t.widgets.length} widgets</span></div>
                <p className="m-0 text-xs leading-5 text-muted-foreground">{t.description}</p>
                <MiniLayout d={{ widgets: t.widgets as Widget[] }} wide />
              </button></SectionCard>
            );
          })}
        </div>
      </section>
      <NewDashboard open={creating} onOpenChange={setCreating} />
    </div>
  );
}

const sources = (d: DashboardDef) => [...new Set(d.widgets.map(widgetDataset).filter(Boolean) as string[])].map((k) => dataset(k)?.label.split(" (")[0] ?? k);

/** Thumbnail of the grid layout: one block per widget, coloured by type. */
function MiniLayout({ d, wide }: { d: Pick<DashboardDef, "widgets">; wide?: boolean }) {
  return (
    <div className={cn("grid grid-cols-12 gap-[2px] rounded-md bg-muted/50 p-1", wide ? "w-full" : "w-40")} style={{ gridAutoRows: wide ? 5 : 3 }} aria-hidden>
      {d.widgets.slice(0, 18).map((w, i) => <span key={i} className={cn("rounded-[2px]", KIND_COLOR[w.kind])} style={{ gridColumn: `span ${w.w}`, gridRow: `span ${w.h}` }} />)}
    </div>
  );
}

function NewDashboard({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const db = useDashboards();
  const nav = useNavigate();
  const [name, setName] = React.useState("");
  const [tpl, setTpl] = React.useState<string>(TEMPLATES[0].id);
  React.useEffect(() => { if (open) { setName(""); setTpl(TEMPLATES[0].id); } }, [open]);
  const create = () => {
    const t = TEMPLATES.find((x) => x.id === tpl);
    const d: DashboardDef = t ? fromTemplate(t, name.trim() || undefined) : { id: `d${Date.now().toString(36)}`, name: name.trim() || "Untitled dashboard", widgets: [], filters: [], createdAt: Date.now(), updatedAt: Date.now() };
    if (!t) d.description = "";
    onOpenChange(false);
    nav(`/dashboards/${db.create(d)}`);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New dashboard</DialogTitle>
          <DialogDescription>Start from a template filled with live data, then change anything.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); create(); }}>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">Name
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={TEMPLATES.find((t) => t.id === tpl)?.name ?? "Untitled dashboard"} className="h-9 text-sm text-foreground" />
          </label>
          <div role="radiogroup" aria-label="Start from" className="flex flex-col gap-1.5">
            {[...TEMPLATES.map((t) => ({ id: t.id, name: t.name, d: `${t.widgets.length} widgets · ${t.description}` })), { id: "blank", name: "Blank with suggestions", d: "An empty grid with one-click suggested widgets" }].map((o) => (
              <button key={o.id} type="button" role="radio" aria-checked={tpl === o.id} onClick={() => setTpl(o.id)}
                className={cn("rounded-lg border px-3 py-2 text-left transition-colors", tpl === o.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/60")}>
                <div className="text-[13px] font-medium">{o.name}</div><div className="line-clamp-1 text-xs text-muted-foreground">{o.d}</div>
              </button>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm">Create dashboard</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** /dashboards/import#<base64> — opens a shared dashboard as a copy. */
export function ImportDashboard() {
  const db = useDashboards();
  const [target, setTarget] = React.useState<string | null>(null);
  React.useEffect(() => {
    try {
      const raw = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(1))))) as Partial<DashboardDef>;
      if (!Array.isArray(raw.widgets)) throw new Error("bad");
      const id = db.create({ id: `d${Date.now().toString(36)}`, name: `${raw.name ?? "Shared dashboard"} (shared)`, description: raw.description, widgets: raw.widgets.map((w, i) => ({ ...w, id: `w${Date.now().toString(36)}${i}` })), filters: raw.filters ?? [], createdAt: Date.now(), updatedAt: Date.now() });
      setTarget(`/dashboards/${id}`);
    } catch { setTarget("/dashboards"); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return target ? <Navigate to={target} replace /> : null;
}

