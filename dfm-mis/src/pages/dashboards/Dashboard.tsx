import * as React from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  IconArrowLeft, IconCheck, IconCopy, IconDots, IconDownload, IconEdit, IconGripVertical, IconLayoutGridAdd, IconLink, IconPin, IconPlus,
  IconTrash, IconArrowsDiagonal, IconChevronLeft, IconChevronRight, IconSparkles,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/overtrue/status-badge";
import { EmptyState } from "@/components/overtrue/empty-state";
import { FilterBar, fromBar, opts, toBar, type FilterField } from "@/components/app/filters";
import { WidgetBody, widgetCsv, widgetDataset } from "@/components/dash/WidgetView";
import { WidgetEditor, autoTitle } from "@/components/dash/WidgetEditor";
import { dataset, dimValues } from "@/ai/catalog";
import { useDashboards } from "@/state/dashboards";
import { useAI } from "@/state/ai";
import { useApp } from "@/state/app";
import { SUGGESTED, wid, type DashboardDef, type Widget } from "@/data/presets";
import { fdt } from "@/data/format";
import { cn } from "@/lib/utils";

const ROW_H = 80;
const GAP = 12;

export default function DashboardPage() {
  const { id = "" } = useParams();
  const db = useDashboards();
  const d = db.get(id);
  if (!d) return <Navigate to="/dashboards" replace />;
  return <DashboardView key={d.id} d={d} />;
}

function DashboardView({ d }: { d: DashboardDef }) {
  const db = useDashboards();
  const ai = useAI();
  const { toast } = useApp();
  const nav = useNavigate();
  const [editing, setEditing] = React.useState(false);
  const [editor, setEditor] = React.useState<{ open: boolean; widget: Widget | null }>({ open: false, widget: null });
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);
  const grid = React.useRef<HTMLDivElement>(null);
  const update = (fn: (x: DashboardDef) => DashboardDef) => db.update(d.id, fn);
  const setWidget = (wid_: string, patch: Partial<Widget>) => update((x) => ({ ...x, widgets: x.widgets.map((w) => (w.id === wid_ ? { ...w, ...patch } : w)) }));
  const moveWidget = (from: string, to: string) => update((x) => {
    const ws = [...x.widgets]; const i = ws.findIndex((w) => w.id === from), j = ws.findIndex((w) => w.id === to);
    if (i < 0 || j < 0 || i === j) return x;
    const [m] = ws.splice(i, 1); ws.splice(j, 0, m); return { ...x, widgets: ws };
  });
  const shift = (wId: string, dir: -1 | 1) => { const i = d.widgets.findIndex((w) => w.id === wId); const t = d.widgets[i + dir]; if (t) moveWidget(wId, t.id); };

  // Dashboard filter fields: dimensions shared by the datasets on this dashboard.
  const fields = React.useMemo<FilterField[]>(() => {
    const dsKeys = [...new Set(d.widgets.map(widgetDataset).filter(Boolean) as string[])];
    const byKey = new Map<string, { label: string; values: Set<string>; count: number }>();
    for (const k of dsKeys) {
      const ds = dataset(k); if (!ds) continue;
      for (const dim of ds.dims) {
        if (dim.time === "day") continue;
        const e = byKey.get(dim.key) ?? { label: dim.label, values: new Set<string>(), count: 0 };
        dimValues(ds, dim.key, 400).forEach((v) => e.values.add(v)); e.count++;
        byKey.set(dim.key, e);
      }
    }
    const order = ["month", "plant", "zone", "region", "transporter", "destination", "brand", "channel", "account", "cfa"];
    return [...byKey.entries()].sort((a, b) => (b[1].count - a[1].count) || ((order.indexOf(a[0]) + 99) % 99) - ((order.indexOf(b[0]) + 99) % 99))
      .map(([key, e]) => ({ key, label: e.label, options: key === "month" ? opts(dataset("sales")!.dims.find((x) => x.key === "month")!.order!.filter((m) => e.values.has(m))) : opts([...e.values].sort()) }));
  }, [d.widgets]);

  const startResize = (w: Widget) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const el = grid.current; if (!el) return;
    const unit = (el.clientWidth + GAP) / 12;
    const x0 = e.clientX, y0 = e.clientY, w0 = w.w, h0 = w.h;
    const onMove = (ev: PointerEvent) => {
      const nw = Math.max(2, Math.min(12, Math.round(w0 + (ev.clientX - x0) / unit)));
      const nh = Math.max(2, Math.min(10, Math.round(h0 + (ev.clientY - y0) / (ROW_H + GAP))));
      if (nw !== w.w || nh !== w.h) setWidget(w.id, { w: nw, h: nh });
    };
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
  };

  const share = async () => {
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify({ name: d.name, description: d.description, widgets: d.widgets, filters: d.filters }))));
    const url = `${location.origin}/dashboards/import#${payload}`;
    try { await navigator.clipboard.writeText(url); toast("Share link copied — anyone with access to the MIS can open it"); } catch { window.prompt("Copy this link", url); }
  };

  const addWidget = (w: Omit<Widget, "id">) => update((x) => ({ ...x, widgets: [...x.widgets, { ...w, id: wid() }] }));
  const datasets = [...new Set(d.widgets.map(widgetDataset).filter(Boolean) as string[])].map((k) => dataset(k)?.label.split(" (")[0]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="ghost" size="icon-sm" asChild aria-label="All dashboards"><Link to="/dashboards"><IconArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-col gap-1.5">
              <Input value={d.name} aria-label="Dashboard name" onChange={(e) => update((x) => ({ ...x, name: e.target.value }))} className="h-8 max-w-md text-[15px] font-semibold" />
              <Input value={d.description ?? ""} aria-label="Description" placeholder="What is this dashboard for?" onChange={(e) => update((x) => ({ ...x, description: e.target.value }))} className="h-7 max-w-2xl text-xs" />
            </div>
          ) : (
            <>
              <h1 className="m-0 truncate text-lg font-semibold tracking-tight">{d.name}</h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                {d.description ? <span className="max-w-2xl truncate">{d.description}</span> : null}
                <span>· {d.widgets.length} widgets · {datasets.join(", ")} · updated {fdt(new Date(d.updatedAt))}</span>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {editing ? (
            <>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditor({ open: true, widget: null })}><IconPlus className="size-4" /> Add widget</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="gap-1.5"><IconLayoutGridAdd className="size-4" /> Quick add</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Suggested from live data</DropdownMenuLabel>
                  {SUGGESTED.map((s, i) => <DropdownMenuItem key={i} onSelect={() => addWidget(s)} className="text-[13px]">{s.title}</DropdownMenuItem>)}
                  {ai?.pins.length ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground">Pinned from Ask AI</DropdownMenuLabel>
                      {ai.pins.map((p) => (
                        <DropdownMenuItem key={p.id} className="text-[13px]" onSelect={() => addWidget({ kind: p.spec.chart === "kpi" ? "kpi" : p.spec.chart === "table" ? "table" : "chart", title: p.spec.title, w: p.spec.chart === "kpi" ? 3 : 6, h: p.spec.chart === "kpi" ? 2 : 4, spec: p.spec })}>
                          <IconPin className="size-3.5" /> {p.spec.title}
                        </DropdownMenuItem>
                      ))}
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" className="gap-1.5" onClick={() => setEditing(false)}><IconCheck className="size-4" /> Done</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(true)}><IconEdit className="size-4" /> Edit</Button>
              <Button size="sm" variant="ghost" className="gap-1.5" onClick={share}><IconLink className="size-4" /> Share</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label="More dashboard actions"><IconDots className="size-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => { const nid = db.duplicate(d.id); if (nid) nav(`/dashboards/${nid}`); }}><IconCopy className="size-4" /> Duplicate</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => ai?.ask(`Review the "${d.name}" dashboard: ${d.widgets.map((w) => w.title).join("; ")}. What stands out and what should I act on?`)}><IconSparkles className="size-4" /> Ask AI to review</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => { if (window.confirm(`Delete “${d.name}”?`)) { db.remove(d.id); nav("/dashboards"); } }}><IconTrash className="size-4" /> Delete dashboard</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {fields.length ? (
        <div className="sticky top-14 z-20 -mx-4 border-b border-border/60 bg-background/85 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <FilterBar fields={fields} values={toBar(d.filters)} onChange={(v) => update((x) => ({ ...x, filters: fromBar(v) }))}
            count={<span className="hidden text-[11px] whitespace-nowrap text-muted-foreground xl:inline">Dashboard filters apply to every widget with that field</span>} />
        </div>
      ) : null}

      {d.widgets.length ? (
        <div ref={grid} className="grid grid-cols-12" style={{ gap: GAP, gridAutoRows: ROW_H }} data-slot="dashboard-grid">
          {d.widgets.map((w, i) => (
            <section key={w.id} aria-label={w.title}
              className={cn("surface-card relative flex min-w-0 flex-col overflow-hidden rounded-xl! [grid-column:span_var(--ws)] md:[grid-column:span_var(--wm)] xl:[grid-column:span_var(--w)] [grid-row:span_var(--h)]",
                editing && "ring-1 ring-primary/25", dragId === w.id && "opacity-40", overId === w.id && dragId !== w.id && "ring-2 ring-primary")}
              style={{ "--w": w.w, "--ws": w.kind === "kpi" ? 6 : 12, "--wm": w.w <= 3 ? 6 : w.w <= 6 ? 6 : 12, "--h": w.h } as React.CSSProperties}
              onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverId(w.id); } }}
              onDragLeave={() => setOverId((o) => (o === w.id ? null : o))}
              onDrop={(e) => { e.preventDefault(); if (dragId) moveWidget(dragId, w.id); setDragId(null); setOverId(null); }}>
              <header className={cn("flex h-9 shrink-0 items-center gap-1.5 px-3", w.kind !== "kpi" && "border-b border-border/50")}
                draggable={editing} onDragStart={(e) => { setDragId(w.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", w.id); }} onDragEnd={() => { setDragId(null); setOverId(null); }}>
                {editing ? <IconGripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground" aria-hidden /> : null}
                <h2 className={cn("m-0 min-w-0 flex-1 truncate font-medium", w.kind === "kpi" ? "text-xs text-muted-foreground" : "text-[13px]")} title={w.title}>{w.title || autoTitle(w)}</h2>
                {editing ? (
                  <span className="flex shrink-0 items-center">
                    <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => shift(w.id, -1)} className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"><IconChevronLeft className="size-3.5" /></button>
                    <button type="button" aria-label="Move later" disabled={i === d.widgets.length - 1} onClick={() => shift(w.id, 1)} className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"><IconChevronRight className="size-3.5" /></button>
                    <button type="button" aria-label={`Edit ${w.title}`} onClick={() => setEditor({ open: true, widget: w })} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"><IconEdit className="size-3.5" /></button>
                    <button type="button" aria-label={`Remove ${w.title}`} onClick={() => update((x) => ({ ...x, widgets: x.widgets.filter((y) => y.id !== w.id) }))} className="rounded p-0.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"><IconTrash className="size-3.5" /></button>
                  </span>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><button type="button" aria-label={`${w.title} actions`} className="-mr-1 rounded p-0.5 text-muted-foreground opacity-60 hover:bg-muted hover:opacity-100"><IconDots className="size-4" /></button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditor({ open: true, widget: w })}><IconEdit className="size-4" /> Edit</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => addWidget({ ...w, title: `${w.title} (copy)` })}><IconCopy className="size-4" /> Duplicate</DropdownMenuItem>
                      {w.kind !== "note" ? <DropdownMenuItem onSelect={() => widgetCsv(w, d.filters)}><IconDownload className="size-4" /> Export CSV</DropdownMenuItem> : null}
                      {w.kind !== "note" && ai ? <DropdownMenuItem onSelect={() => ai.ask(`${w.title} — what stands out, why, and what should I do?`)}><IconSparkles className="size-4" /> Ask AI</DropdownMenuItem> : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => update((x) => ({ ...x, widgets: x.widgets.filter((y) => y.id !== w.id) }))}><IconTrash className="size-4" /> Remove</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </header>
              <div className={cn("min-h-0 flex-1", w.kind === "kpi" ? "px-3 pb-2.5" : w.kind === "pivot" || w.kind === "table" ? "p-0" : "p-3")}>
                <WidgetBody widget={w} filters={d.filters} />
              </div>
              {editing ? (
                <button type="button" aria-label={`Resize ${w.title} (${w.w}×${w.h})`} title="Drag to resize" onPointerDown={startResize(w)}
                  className="absolute right-0.5 bottom-0.5 z-10 flex size-5 cursor-se-resize items-center justify-center rounded bg-background/90 text-muted-foreground shadow-xs ring-1 ring-border hover:text-primary">
                  <IconArrowsDiagonal className="size-3" />
                </button>
              ) : null}
              {editing ? <span className="pointer-events-none absolute right-7 bottom-1 rounded bg-background/80 px-1 font-mono text-[10px] text-muted-foreground">{w.w}×{w.h}</span> : null}
            </section>
          ))}
          {editing ? (
            <button type="button" onClick={() => setEditor({ open: true, widget: null })}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-[13px] text-muted-foreground transition-colors [grid-column:span_12] hover:border-primary hover:text-primary md:[grid-column:span_6] xl:[grid-column:span_4] [grid-row:span_2]">
              <IconPlus className="size-5" /> Add widget
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <EmptyState title="Start with live data" description="Pick suggested widgets below, or add your own KPI, chart, table or pivot." />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {SUGGESTED.map((s, i) => (
              <button key={i} type="button" onClick={() => addWidget(s)} className="surface-card flex items-center gap-2 p-3 text-left text-[13px] hover:ring-2 hover:ring-primary/30">
                <IconPlus className="size-4 text-primary" /><span className="min-w-0 flex-1 truncate">{s.title}</span><StatusBadge variant="neutral">{s.kind}</StatusBadge>
              </button>
            ))}
          </div>
          <div><Button size="sm" onClick={() => { setEditing(true); setEditor({ open: true, widget: null }); }} className="gap-1.5"><IconPlus className="size-4" /> Build a widget</Button></div>
        </div>
      )}

      <WidgetEditor open={editor.open} initial={editor.widget} dashFilters={d.filters} onOpenChange={(v) => setEditor((e) => ({ ...e, open: v }))}
        onSave={(w) => {
          if (w.id) setWidget(w.id, w); else addWidget(w);
          setEditor({ open: false, widget: null });
        }} />
    </div>
  );
}
