/* Alerts & subscriptions: threshold rules on governed KPIs (evaluated live) and scheduled report delivery. */
import * as React from "react";
import { IconPlus } from "@tabler/icons-react";
import { ModulePage } from "@/components/app/module";
import { DataTable, Pill, type Col } from "@/components/app/kit";
import { MetricGroup, MetricGroupItem } from "@/components/overtrue/metric-group";
import { SectionCard } from "@/components/overtrue/section-card";
import { StatusBadge } from "@/components/overtrue/status-badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtUnit } from "@/components/app/ExecScorecard";
import { KPIS, evaluate, period } from "@/data/kpis";
import { NOW } from "@/data/data";
import { useApp, usePersistentState } from "@/state/app";

interface Rule { id: string; kpi: string; op: "<" | ">"; threshold: number; channel: string; recipients: string; frequency: string; enabled: boolean }
interface Sub { id: string; report: string; schedule: string; format: string; recipients: string; enabled: boolean }

const SEED_RULES: Rule[] = [
  { id: "r1", kpi: "otif", op: "<", threshold: 95, channel: "Email + Slack #supply-chain", recipients: "Head – Supply Chain", frequency: "Every refresh", enabled: true },
  { id: "r2", kpi: "cpk", op: ">", threshold: 53, channel: "Email", recipients: "Head – Logistics, CFO", frequency: "Daily 09:00", enabled: true },
  { id: "r3", kpi: "ach", op: "<", threshold: 92, channel: "Email + WhatsApp", recipients: "VP Sales, Zonal heads", frequency: "Daily 18:00", enabled: true },
  { id: "r4", kpi: "det", op: ">", threshold: 15, channel: "Slack #logistics", recipients: "Logistics control tower", frequency: "Every refresh", enabled: true },
  { id: "r5", kpi: "margin", op: "<", threshold: 50.5, channel: "Email", recipients: "Head – E-commerce, CFO", frequency: "Weekly Mon 09:00", enabled: true },
  { id: "r6", kpi: "track", op: "<", threshold: 55, channel: "Email", recipients: "Head – Logistics", frequency: "Daily 09:00", enabled: false },
];
const SEED_SUBS: Sub[] = [
  { id: "s1", report: "Executive KPI scorecard", schedule: "Daily · 08:30 IST", format: "Email (inline) + PDF", recipients: "MD, CFO, Function heads (9)", enabled: true },
  { id: "s2", report: "Monthly MIS pack", schedule: "Monthly · 3rd working day · 10:00", format: "PDF", recipients: "Board pack distribution (6)", enabled: true },
  { id: "s3", report: "Logistics control tower", schedule: "Weekly · Mon 08:00", format: "PDF + CSV", recipients: "Logistics team (14)", enabled: true },
  { id: "s4", report: "Sales review", schedule: "Daily · 19:00", format: "Email (inline)", recipients: "Zonal & regional heads (12)", enabled: true },
  { id: "s5", report: "Data health digest", schedule: "Daily · 07:00", format: "Email", recipients: "Data platform team (4)", enabled: true },
];

function nextRun(schedule: string) {
  const d = new Date(NOW);
  const m = schedule.match(/(\d{2}):(\d{2})/);
  if (m) { d.setHours(+m[1], +m[2], 0, 0); if (d <= NOW) d.setDate(d.getDate() + 1); }
  if (/Weekly/.test(schedule)) { while (d.getDay() !== 1) d.setDate(d.getDate() + 1); }
  if (/Monthly/.test(schedule)) { d.setMonth(d.getMonth() + 1, 4); }
  return d.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function Alerts() {
  const { toast } = useApp();
  const [rules, setRules] = usePersistentState<Rule[]>("alerts.rules.v1", SEED_RULES);
  const [subs, setSubs] = usePersistentState<Sub[]>("alerts.subs.v1", SEED_SUBS);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<Rule>({ id: "", kpi: "otif", op: "<", threshold: 95, channel: "Email", recipients: "", frequency: "Every refresh", enabled: true });
  const live = React.useMemo(() => Object.fromEntries(evaluate(period("mtd"), "target").map((r) => [r.def.key, r])), []);
  const state = (r: Rule) => { const v = live[r.kpi]?.actual; if (v == null) return "unknown"; return (r.op === "<" ? v < r.threshold : v > r.threshold) ? "triggered" : "ok"; };

  const rCols: Col<Rule>[] = [
    { id: "k", header: "Rule", value: (r) => KPIS.find((k) => k.key === r.kpi)?.label ?? r.kpi, cell: (r) => { const k = KPIS.find((x) => x.key === r.kpi)!; return <span className="flex flex-col"><span className="font-medium">{k.label} {r.op === "<" ? "falls below" : "rises above"} {fmtUnit(r.threshold, k.unit)}</span><span className="text-[11px] text-muted-foreground">Owner {k.owner}</span></span>; } },
    { id: "now", header: "Now (MTD)", align: "right", value: (r) => live[r.kpi]?.actual ?? 0, cell: (r) => <span className="tabular-nums">{fmtUnit(live[r.kpi]?.actual ?? null, KPIS.find((x) => x.key === r.kpi)!.unit)}</span> },
    { id: "st", header: "State", value: (r) => state(r), cell: (r) => (!r.enabled ? <Pill tone="neutral">Paused</Pill> : state(r) === "triggered" ? <Pill tone="error" live>Triggered</Pill> : <Pill tone="success">OK</Pill>) },
    { id: "f", header: "Checked", value: (r) => r.frequency },
    { id: "c", header: "Channel", value: (r) => r.channel },
    { id: "to", header: "Recipients", value: (r) => r.recipients },
    { id: "on", header: "Active", value: (r) => (r.enabled ? 1 : 0), cell: (r) => <Switch checked={r.enabled} aria-label="Toggle rule" onClick={(e) => e.stopPropagation()} onCheckedChange={(v) => { setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, enabled: v } : x))); toast(v ? "Alert rule resumed" : "Alert rule paused", v ? "success" : "warning"); }} /> },
  ];
  const sCols: Col<Sub>[] = [
    { id: "r", header: "Report", value: (s) => s.report, cell: (s) => <span className="font-medium">{s.report}</span> },
    { id: "sc", header: "Schedule", value: (s) => s.schedule },
    { id: "n", header: "Next run", value: (s) => s.schedule, cell: (s) => (s.enabled ? <span className="tabular-nums">{nextRun(s.schedule)}</span> : <span className="text-muted-foreground">Paused</span>) },
    { id: "f", header: "Format", value: (s) => s.format },
    { id: "to", header: "Recipients", value: (s) => s.recipients },
    { id: "on", header: "Active", value: (s) => (s.enabled ? 1 : 0), cell: (s) => <Switch checked={s.enabled} aria-label="Toggle subscription" onClick={(e) => e.stopPropagation()} onCheckedChange={(v) => setSubs((xs) => xs.map((x) => (x.id === s.id ? { ...x, enabled: v } : x)))} /> },
  ];
  const triggered = rules.filter((r) => r.enabled && state(r) === "triggered");

  return (
    <ModulePage moduleId="alerts">
      <MetricGroup className="grid grid-cols-2 lg:grid-cols-4">
        <MetricGroupItem label="Active alert rules" value={rules.filter((r) => r.enabled).length} context={`${rules.length} defined`} />
        <MetricGroupItem label="Triggered now" value={triggered.length} context={triggered.map((r) => KPIS.find((k) => k.key === r.kpi)?.label).join(", ") || "None"} />
        <MetricGroupItem label="Report subscriptions" value={subs.filter((s) => s.enabled).length} context="scheduled deliveries" />
        <MetricGroupItem label="Next delivery" value={nextRun("Daily · 07:00").split(",")[0]} context={`Data health digest · ${nextRun("Daily · 07:00")}`} />
      </MetricGroup>

      <SectionCard title="Alert rules" description="Thresholds on governed KPIs, checked against live data · demo — notifications are not sent" contentClassName="p-0"
        actions={<Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}><IconPlus className="size-4" />New rule</Button>}>
        <DataTable rows={rules} cols={rCols} pageSize={0} showPagination={false} getRowId={(r) => r.id} />
      </SectionCard>
      <SectionCard title="Report subscriptions" description="Scheduled delivery of dashboards and the MIS pack" contentClassName="p-0"
        actions={<StatusBadge variant="neutral">Times in IST</StatusBadge>}>
        <DataTable rows={subs} cols={sCols} pageSize={0} showPagination={false} getRowId={(s) => s.id} />
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New alert rule</DialogTitle><DialogDescription>Notify owners when a governed KPI crosses a threshold.</DialogDescription></DialogHeader>
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); setRules((rs) => [...rs, { ...form, id: `r${Date.now()}`, recipients: form.recipients || KPIS.find((k) => k.key === form.kpi)!.owner }]); setOpen(false); toast("Alert rule created"); }}>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">KPI
              <FormSelect value={form.kpi} onChange={(e) => { const k = KPIS.find((x) => x.key === e.target.value)!; setForm({ ...form, kpi: k.key, op: k.better === "up" ? "<" : ">", threshold: +(k.target(NOW, NOW) ?? 0).toFixed(2) }); }} className="h-9 text-sm text-foreground">
                {KPIS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </FormSelect>
            </label>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">Condition
                <FormSelect value={form.op} onChange={(e) => setForm({ ...form, op: e.target.value as "<" | ">" })} className="h-9 text-sm text-foreground"><option value="<">Below</option><option value=">">Above</option></FormSelect>
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">Threshold
                <Input type="number" step="0.1" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })} className="h-9 text-sm" />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">Check
              <FormSelect value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="h-9 text-sm text-foreground">{["Every refresh", "Daily 09:00", "Daily 18:00", "Weekly Mon 09:00"].map((f) => <option key={f}>{f}</option>)}</FormSelect>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">Channel
              <FormSelect value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className="h-9 text-sm text-foreground">{["Email", "Email + Slack", "Email + WhatsApp", "Slack"].map((f) => <option key={f}>{f}</option>)}</FormSelect>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">Recipients
              <Input value={form.recipients} placeholder={KPIS.find((k) => k.key === form.kpi)!.owner} onChange={(e) => setForm({ ...form, recipients: e.target.value })} className="h-9 text-sm" />
            </label>
            <DialogFooter className="gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" size="sm">Create rule</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ModulePage>
  );
}
