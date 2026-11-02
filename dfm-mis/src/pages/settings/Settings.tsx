import * as React from "react";
import { useParams } from "react-router-dom";
import { IconPlus } from "@tabler/icons-react";
import { SettingsSection } from "@/components/overtrue/settings-section";
import { UptimeHistory } from "@/components/overtrue/uptime-history";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ModulePage } from "@/components/app/module";
import { DataTable, KpiRow, Num, Panel, Pill, Stat, type Col } from "@/components/app/kit";
import { useApp } from "@/state/app";
import { ACCESS, NOW, syncRuns, type SyncRun, type User } from "@/data/data";
import { DAY, fdt, fmtN, initials, pct } from "@/data/format";

export default function Settings() {
  const { tab = "users" } = useParams();
  return (
    <ModulePage moduleId="settings" tab={tab}>
      {tab === "users" && <Users />}
      {tab === "config" && <Config />}
      {tab === "sync" && <Sync />}
      {tab === "logic" && <Logic />}
    </ModulePage>
  );
}

function lastSeen(d: Date) {
  const m = (+NOW - +d) / 60e3;
  return m < 30 ? <Pill tone="success" live>Online</Pill> : m < 1440 ? <span className="text-muted-foreground">{Math.round(m / 60)} h ago</span> : <span className="text-muted-foreground">{Math.round(m / 1440)} days ago</span>;
}

function Users() {
  const { users, setUsers, toast } = useApp();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", email: "", role: "Viewer" as "Viewer" | "Admin" });
  const [err, setErr] = React.useState("");
  const toggle = (email: string, k: string) => {
    setUsers((us) => us.map((u) => (u.email === email ? { ...u, access: { ...u.access, [k]: !u.access[k] } } : u)));
    const u = users.find((x) => x.email === email)!;
    toast(`${u.name}: ${ACCESS.find((a) => a[0] === k)![1]} access ${u.access[k] ? "revoked" : "granted"}`, u.access[k] ? "warning" : "success");
  };
  const cols: Col<User>[] = [
    { id: "n", header: "Name", value: (u) => u.name, cell: (u) => (
      <span className="flex items-center gap-2.5"><span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{initials(u.name)}</span><span><span className="block font-medium">{u.name}</span><span className="block text-xs text-muted-foreground">{u.email}</span></span></span>
    ) },
    { id: "r", header: "Role", value: (u) => u.role, cell: (u) => <Pill tone={u.role === "Admin" ? "warning" : "neutral"}>{u.role}</Pill> },
    ...ACCESS.map(([k, l]) => ({ id: k, header: l, value: (u: User) => (u.access[k] ? 1 : 0), cell: (u: User) => <Switch checked={u.access[k]} onCheckedChange={() => toggle(u.email, k)} aria-label={`${l} access for ${u.name}`} onClick={(e) => e.stopPropagation()} />, csv: (u: User) => (u.access[k] ? "Yes" : "No") })),
    { id: "a", header: "Last active", value: (u) => +u.lastActive, cell: (u) => lastSeen(u.lastActive), csv: (u) => fdt(u.lastActive) },
  ];
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setErr("Enter a name and a valid email"); return; }
    if (users.some((u) => u.email === form.email.trim().toLowerCase())) { setErr("A user with this email already exists"); return; }
    setUsers((us) => [...us, { name: form.name.trim(), email: form.email.trim().toLowerCase(), role: form.role, access: Object.fromEntries(ACCESS.map(([k]) => [k, k === "trip" || k === "order"])), lastActive: new Date(+NOW - 1e10) }]);
    toast(`Invite prepared for ${form.email} (demo — no email sent)`);
    setOpen(false); setForm({ name: "", email: "", role: "Viewer" }); setErr("");
  };
  return (
    <>
      <KpiRow className="xl:grid-cols-4">
        <Stat label="Total users" value={users.length} />
        <Stat label="Admins" value={users.filter((u) => u.role === "Admin").length} />
        <Stat label="Active now" value={users.filter((u) => +NOW - +u.lastActive < 30 * 60e3).length} hint="Heartbeat in last 30 min" />
        <Stat label="Active this week" value={users.filter((u) => +NOW - +u.lastActive < 7 * DAY).length} />
      </KpiRow>
      <Panel title="Users and dashboard access" description="Toggle a switch to grant or revoke a dashboard — revoked dashboards disappear from that user’s navigation.">
        <DataTable rows={users} cols={cols} search={(u) => u.name + " " + u.email} searchPlaceholder="Search name or email" getRowId={(u) => u.email} exportName="users" density="default"
          toolbar={<Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}><IconPlus className="size-4" /> Add user</Button>} />
      </Panel>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader><DialogTitle>Add user</DialogTitle><DialogDescription>New users get Trip and Order access by default. You can change it after.</DialogDescription></DialogHeader>
            <div className="space-y-1.5"><Label htmlFor="nu-n">Full name</Label><Input id="nu-n" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Rohan Mehta" autoFocus /></div>
            <div className="space-y-1.5"><Label htmlFor="nu-e">Work email</Label><Input id="nu-e" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="rohan.mehta@company.in" /></div>
            <div className="space-y-1.5"><Label htmlFor="nu-r">Role</Label><FormSelect id="nu-r" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "Viewer" | "Admin" })}><option>Viewer</option><option>Admin</option></FormSelect></div>
            {err ? <p className="m-0 text-xs text-destructive">{err}</p> : null}
            <DialogFooter><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Create user</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Config() {
  const { refresh, setRefresh, otif, setOtif, toast } = useApp();
  const [g, setG] = React.useState(otif.green), [a, setA] = React.useState(otif.amber);
  const secs: [string, string, string][] = [["sales", "Sales analytics", "Team-wise sales"], ["trip", "Trip analytics", "All 11 trip views"], ["order", "Order analytics", "All 7 order views"]];
  const [yields, setYields] = React.useState([["Extruded", "3.2", "2.0"], ["Namkeen", "4.1", "2.4"], ["Chips", "5.6", "2.8"]]);
  return (
    <div className="surface-card p-6">
      <SettingsSection title="Auto-refresh schedule" description="How often each section pulls from its source system. Shorter intervals cost more database load.">
        {secs.map(([k, l, d]) => (
          <div key={k} className="flex flex-wrap items-center justify-between gap-3">
            <div><div className="text-sm font-medium">{l}</div><div className="text-xs text-muted-foreground">{d} · next run {fdt(new Date(+NOW + (refresh[k] - (NOW.getMinutes() % refresh[k])) * 60e3))}</div></div>
            <FormSelect value={refresh[k]} onChange={(e) => { setRefresh({ ...refresh, [k]: +e.target.value }); toast(`${l} will refresh every ${e.target.value} min`); }} className="h-9 w-32" aria-label={`${l} refresh interval`}>
              {[5, 10, 15, 30, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
            </FormSelect>
          </div>
        ))}
      </SettingsSection>
      <SettingsSection title="OTIF colour thresholds" description="Applied to every OTIF number, gauge and table across Order Analytics." footer={<Button size="sm" onClick={() => { if (a >= g) { toast("Amber must be below green", "error"); return; } setOtif({ green: g, amber: a }); toast("OTIF thresholds saved"); }}>Save thresholds</Button>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="og">Green if OTIF ≥ (%)</Label><Input id="og" type="number" min={0} max={100} value={g} onChange={(e) => setG(+e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="oa">Amber if OTIF ≥ (%)</Label><Input id="oa" type="number" min={0} max={100} value={a} onChange={(e) => setA(+e.target.value)} /></div>
        </div>
        <p className="m-0 text-xs text-muted-foreground">Red below amber. Currently <Num tone="good">≥ {otif.green}%</Num> · <Num tone="warn">≥ {otif.amber}%</Num> · <Num tone="bad">below</Num>.</p>
      </SettingsSection>
      <SettingsSection title="Product type classification" description="MRP-based rules used by the Product Type filter.">
        {[["SP — Small pack", "MRP ≤ ₹20"], ["LP — Large pack", "MRP > ₹20"], ["MT / E-comm", "Customer channel = MT or E-comm"]].map(([n, r]) => (
          <div key={n} className="inset-panel flex items-center justify-between px-4 py-3 text-sm"><span className="font-medium">{n}</span><span className="text-muted-foreground">{r}</span></div>
        ))}
      </SettingsSection>
      <SettingsSection title="Standard costing · category yields" description="Yield-loss percentages applied to RM and PM in the E-com P&L." footer={<Button size="sm" onClick={() => toast("Costing configuration saved")}>Save costing</Button>}>
        {yields.map((y, i) => (
          <div key={y[0]} className="grid grid-cols-[1fr_auto_auto] items-end gap-3">
            <span className="pb-2.5 text-sm font-medium">{y[0]}</span>
            <div className="space-y-1"><Label className="text-xs" htmlFor={"rm" + i}>RM yield loss %</Label><Input id={"rm" + i} className="w-28" value={y[1]} onChange={(e) => setYields(yields.map((x, j) => (j === i ? [x[0], e.target.value, x[2]] : x)))} /></div>
            <div className="space-y-1"><Label className="text-xs" htmlFor={"pm" + i}>PM yield loss %</Label><Input id={"pm" + i} className="w-28" value={y[2]} onChange={(e) => setYields(yields.map((x, j) => (j === i ? [x[0], x[1], e.target.value] : x)))} /></div>
          </div>
        ))}
      </SettingsSection>
    </div>
  );
}

function Sync() {
  const cols: Col<SyncRun>[] = [
    { id: "t", header: "Source table", value: (r) => r.table, cell: (r) => <code className="font-mono text-xs text-primary">{r.table}</code> },
    { id: "a", header: "Feeds", value: (r) => r.area },
    { id: "s", header: "Started", value: (r) => +r.start, cell: (r) => fdt(r.start) },
    { id: "d", header: "Duration", align: "right", value: (r) => r.secs, cell: (r) => (r.status === "in_process" ? <span className="text-muted-foreground">Running…</span> : r.status === "failed" ? "300 s (timeout)" : r.secs + " s") },
    { id: "r", header: "Rows synced", align: "right", value: (r) => r.rows, cell: (r) => (r.status === "completed" ? fmtN(r.rows) : r.status === "in_process" ? <span className="text-muted-foreground">{fmtN(r.rows)} so far</span> : <span className="text-muted-foreground">0 · will retry</span>) },
    { id: "st", header: "Status", value: (r) => r.status, cell: (r) => <Pill tone={r.status === "completed" ? "success" : r.status === "failed" ? "error" : "info"} live={r.status === "in_process"}>{r.status === "completed" ? "Completed" : r.status === "failed" ? "Failed" : "In process"}</Pill> },
    { id: "e", header: "Error", value: (r) => r.err, cell: (r) => <span className="text-rose-600 dark:text-rose-400">{r.err}</span> },
  ];
  const tables = [...new Set(syncRuns.map((r) => r.table))];
  return (
    <>
      <KpiRow className="xl:grid-cols-4">
        <Stat label="Runs (last 6 per table)" value={syncRuns.length} />
        <Stat label="Completed" value={syncRuns.filter((r) => r.status === "completed").length} />
        <Stat label="In process" value={syncRuns.filter((r) => r.status === "in_process").length} />
        <Stat label="Failed" value={syncRuns.filter((r) => r.status === "failed").length} hint="Auto-retried next cycle" />
      </KpiRow>
      <Panel title="Sync health by table" description="Last 6 runs, oldest → newest"
        insight={`{{metric:${pct(syncRuns.filter((r) => r.status === "completed").length, syncRuns.length, 0)}|success rate|positive}} across ${tables.length} tables. The one failure was a 300 s timeout on fact_SecondarySales_DMS — the largest table (${fmtN(412300)} rows), so consider incremental sync for it.`}>
        <div className="grid gap-4 md:grid-cols-2">
          {tables.map((t) => {
            const rs = syncRuns.filter((r) => r.table === t).slice().reverse();
            return (
              <div key={t} className="inset-panel p-3">
                <div className="mb-2 flex items-center justify-between gap-2"><code className="truncate font-mono text-xs">{t}</code><span className="text-xs text-muted-foreground">{rs[0].area}</span></div>
                <UptimeHistory label={`${t} sync history`} startLabel={fdt(rs[0].start)} endLabel="Latest" samples={rs.map((r) => ({ id: r.id, label: `${fdt(r.start)} · ${r.status}`, status: r.status === "completed" ? "operational" as const : r.status === "failed" ? "outage" as const : "degraded" as const }))} />
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel title="Sync job tracker"><DataTable rows={syncRuns} cols={cols} getRowId={(r) => r.id} pageSize={12} exportName="sync-jobs" /></Panel>
    </>
  );
}

const DOCS: [string, string][] = [
  ["Trip stages (Live trips)", "Each trip’s latest Traqo status maps to one stage: Trip Created → Reporting Pending; Origin Gate Entry Done → Vehicle Reported; Loading Started/Completed → Loading; Invoice Completed → Invoiced; Origin Gate Out Done → In Transit; Destination Vehicle Reported → At Destination; Destination Gate Out Done → Unloaded; ePOD Done → ePOD Done. Inter-transfer and garbage trips are excluded everywhere."],
  ["Cycle time T1–T4", "T1 plant TAT = origin reporting → origin gate-out. T2 transit = gate-out → destination reporting. T3 destination TAT = destination reporting → destination gate-out. T4 = unload → ePOD closure."],
  ["Freight build-up", "Total freight = base freight + detention + additional charges − shortage penalty − damage penalty. Avg cost per km = total freight ÷ total distance. L1 benchmark is the lowest contracted rate for the lane; a market trip with no L1 is an undefined route."],
  ["OTIF %", "OTIF target = order approval + 48 h (direct) or + 72 h (stock transfer). OTIF % = Σ dispatch qty shipped on or before target ÷ Σ order qty. Orders whose target hasn’t passed and aren’t dispatched are NA; within 8 h of target they’re At risk."],
  ["Order stages (Live orders)", "Draft → Indent Pending; Indent/Auction Created → Acceptance Pending; Indent/Auction Accepted → Reporting Pending; Vehicle Reported/Gate Entry → Vehicle Reported; Loading/Dispatch in progress → Under Process; everything after → Dispatched. Order / dispatch qty shows dispatched qty once any dispatch exists, else original order qty."],
  ["Sales achievement", "Period target = monthly target pro-rated by calendar days in the period. Required run-rate = (month target − MTD sales) ÷ remaining days. LYSM = same dates last year."],
  ["Cash discount", "A 2% cash discount on base freight is available when a trip is paid within 7 days of its PI. Capture rate = availed ÷ eligible."],
];
function Logic() {
  return (
    <div className="surface-card p-2 sm:p-4">
      <Accordion type="multiple" defaultValue={["0"]}>
        {DOCS.map(([h, b], i) => (
          <AccordionItem key={h} value={String(i)}>
            <AccordionTrigger value={String(i)}>{h}</AccordionTrigger>
            <AccordionContent value={String(i)}><p className="m-0 max-w-3xl text-sm leading-6 text-muted-foreground">{b}</p></AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
