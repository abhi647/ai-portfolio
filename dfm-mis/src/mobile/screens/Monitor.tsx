import * as React from "react";
import { IconAlertOctagon, IconAlertTriangle, IconArrowDown, IconChevronRight, IconInfoCircle, IconLoader2, IconSparkles } from "@tabler/icons-react";
import { Sparkline } from "@/components/overtrue/trend-sparkline";
import { SegmentedMeter } from "@/components/overtrue/segmented-meter";
import { BulletChart } from "@/components/overtrue/bullet-chart";
import { StatusBadge } from "@/components/overtrue/status-badge";
import { useApp } from "@/state/app";
import { useAI } from "@/state/ai";
import { computeAlerts } from "@/data/insights";
import { ASMS, CUR_MONTH, MONTHS, NOW, TSTAGES, ZONES, asmDay, orders, today0, trips, type Order, type Trip } from "@/data/data";
import { C } from "@/data/colors";
import { DAY, H, cr, fdt, fmtN, sum } from "@/data/format";
import { asmPeriod, asmPeriodTarget, monthContext, periodRange } from "@/data/sales";
import { tripEta } from "@/pages/trips/timeline";
import { ListProvider, ScreenHeader, Section, useList } from "./parts";
import { cn } from "@/lib/utils";

const ALERTS = computeAlerts();

function alertRows(id: string): { kind: "trips"; rows: Trip[] } | { kind: "orders"; rows: Order[] } | null {
  if (id === "inside") return { kind: "trips", rows: trips.filter((t) => ["vehicle_reported", "loading", "invoiced"].includes(t.stage) && (+NOW - +t.ms.reported!) / H > 8) };
  if (id === "transit") return { kind: "trips", rows: trips.filter((t) => t.stage === "in_transit" && (+NOW - +t.ms.gateOut!) / H > 36) };
  if (id === "risk") return { kind: "orders", rows: orders.filter((o) => o.otifStatus === "risk") };
  if (id === "stuck") return { kind: "orders", rows: orders.filter((o) => o.stage !== "dispatched" && (+NOW - +o.approved) / H > 48 && (+NOW - +o.approved) / H < 30 * 24) };
  return null;
}

function MonitorBody() {
  const { lastSync, doSync, sync } = useApp();
  const ai = useAI()!;
  const openList = useList();
  const scroller = React.useRef<HTMLDivElement>(null);
  const [pull, setPull] = React.useState(0);
  const startY = React.useRef<number | null>(null);

  const days14 = Array.from({ length: 14 }, (_, i) => new Date(+today0 - (13 - i) * DAY));
  const disp = days14.map((d) => trips.filter((t) => t.ms.gateOut && t.ms.gateOut >= d && +t.ms.gateOut < +d + DAY));
  const active = trips.filter((t) => t.stage !== "epod_done");
  const late = active.map((t) => ({ t, eta: tripEta(t) })).filter((x) => x.eta?.late).sort((a, b) => b.eta!.lateBy - a.eta!.lateBy);
  const mc = monthContext();
  const monthly = MONTHS.map((m) => { const os = orders.filter((o) => o.mk === m.key && o.otif != null); return (sum(os, (o) => o.otif! * o.qty) / (sum(os, "qty") || 1)) * 100; });
  const perKm = MONTHS.map((m) => { const ts = trips.filter((t) => t.mk === m.key && t.ms.gateOut); return sum(ts, "total") / (sum(ts, "km") || 1); });
  const mtdOtif = monthly[5];
  const range = periodRange("month");
  const zones = ZONES.map(([z]) => { const l = ASMS.filter((a) => a.zone === z); const s = sum(l, (a) => asmPeriod(a, range)), t = sum(l, (a) => asmPeriodTarget(a, range)); return { id: z, label: z.split(" – ")[0], value: s / t, target: 1, ranges: [0.85, 0.95, 1.1] as [number, number, number], max: 1.2 }; });

  const kpis = [
    { l: "Dispatched today", v: fmtN(disp[13].length), s: `${fmtN(sum(disp[13], "invQty"))} cases so far`, spark: disp.map((d) => d.length), onClick: () => openList({ title: "Dispatched today", kind: "trips", rows: disp[13] }) },
    { l: "MTD sales", v: cr(mc.mtd.sales), s: `${Math.round((mc.mtd.sales / mc.mTarget) * 100)}% of month target`, spark: days14.map((d) => sum(ASMS, (a) => asmDay(a, d))) },
    { l: "MTD OTIF", v: mtdOtif.toFixed(1) + "%", s: `${orders.filter((o) => o.mk === CUR_MONTH && o.otif != null).length} eligible orders`, spark: monthly },
    { l: "Freight ₹/km", v: "₹" + perKm[5].toFixed(1), s: "month to date", spark: perKm },
  ];

  const onTouchStart = (e: React.TouchEvent) => { if ((scroller.current?.scrollTop ?? 0) <= 0) startY.current = e.touches[0].clientY; };
  const onTouchMove = (e: React.TouchEvent) => { if (startY.current != null) setPull(Math.max(0, Math.min(90, (e.touches[0].clientY - startY.current) * 0.5))); };
  const onTouchEnd = () => { if (pull > 60) { doSync(); navigator.vibrate?.(12); } setPull(0); startY.current = null; };

  return (
    <div ref={scroller} className="absolute inset-0 overflow-y-auto overscroll-contain" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <ScreenHeader title="Live monitor" subtitle={<>{sync === "syncing" ? "Syncing…" : `Synced ${fdt(lastSync)}`} · pull to refresh</>}
        right={<StatusBadge variant={sync === "syncing" ? "info" : "success"} live>{sync === "syncing" ? "Sync" : "Live"}</StatusBadge>} />
      <div aria-hidden className="flex items-center justify-center overflow-hidden text-xs text-muted-foreground transition-[height]" style={{ height: sync === "syncing" ? 36 : pull }}>
        {sync === "syncing" ? <IconLoader2 className="size-4 animate-spin" /> : <span className="inline-flex items-center gap-1"><IconArrowDown className={cn("size-4 transition-transform", pull > 60 && "rotate-180")} />{pull > 60 ? "Release to sync" : "Pull to sync"}</span>}
      </div>

      <div className="flex flex-col gap-6 px-4 pt-3 pb-8">
        <Section title="Needs attention" action={<span className="text-xs text-muted-foreground">{ALERTS.length + (late.length ? 1 : 0)} items</span>}>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {late.length ? (
              <li>
                <button type="button" onClick={() => openList({ title: "Trips behind plan", kind: "trips", rows: late.map((x) => x.t) })} className="surface-card flex w-full items-start gap-3 p-3 text-left active:scale-[0.99]">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400"><IconAlertTriangle className="size-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{late.length} trips behind plan</span><span className="block text-xs text-muted-foreground">Worst: {late[0].t.id} · {late[0].eta!.leg} · {Math.round(late[0].eta!.lateBy)} h late</span></span>
                  <IconChevronRight className="mt-2 size-4 text-muted-foreground" />
                </button>
              </li>
            ) : null}
            {ALERTS.map((a) => {
              const Icon = a.severity === "error" ? IconAlertOctagon : a.severity === "warning" ? IconAlertTriangle : IconInfoCircle;
              const rows = alertRows(a.id);
              return (
                <li key={a.id} className="surface-card flex items-start gap-3 p-3">
                  <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", a.severity === "error" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : a.severity === "warning" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-primary/10 text-primary")}><Icon className="size-4" /></span>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => rows && openList({ title: a.title, ...rows } as never)}>
                    <span className="block text-sm font-medium">{a.title}</span>
                    <span className="block text-xs text-muted-foreground">{a.body}</span>
                  </button>
                  <button type="button" aria-label={`Ask AI about: ${a.title}`} onClick={() => ai.ask(`${a.title} — why, and what should I do?`)} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-primary hover:bg-primary/10"><IconSparkles className="size-4" /></button>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section title="Key numbers">
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
            {kpis.map((k) => (
              <button key={k.l} type="button" onClick={k.onClick} className="surface-card w-[72%] max-w-[280px] shrink-0 snap-start p-4 text-left">
                <div className="text-xs text-muted-foreground">{k.l}</div>
                <div className="mt-1 truncate text-[22px] leading-none font-semibold tracking-[-0.035em] tabular-nums">{k.v}</div>
                <Sparkline data={k.spark} className="mt-3 h-10" />
                <div className="mt-2 text-xs text-muted-foreground">{k.s}</div>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Trip pipeline" action={<span className="text-xs text-muted-foreground">{fmtN(active.length)} active</span>}>
          <ul className="surface-card m-0 list-none divide-y divide-border/60 p-0">
            {TSTAGES.slice(0, 7).map((s) => {
              const rs = active.filter((t) => t.stage === s.key);
              return (
                <li key={s.key}>
                  <button type="button" onClick={() => openList({ title: s.label, kind: "trips", rows: rs })} className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="flex-1 text-sm">{s.label}</span>
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${(rs.length / Math.max(1, active.length)) * 100}%`, background: s.color }} /></span>
                    <span className="w-8 text-right text-sm font-semibold tabular-nums">{rs.length}</span>
                    <IconChevronRight className="size-4 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>

        {late.length ? (
          <Section title="Behind plan" action={<button type="button" className="text-xs font-medium text-primary" onClick={() => openList({ title: "Trips behind plan", kind: "trips", rows: late.map((x) => x.t) })}>See all</button>}>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {late.slice(0, 4).map(({ t, eta }) => (
                <li key={t.id} className="surface-card p-3">
                  <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs font-medium">{t.id}</span><span className="rounded-md bg-rose-500/10 px-1.5 py-0.5 text-xs font-semibold text-rose-700 tabular-nums dark:text-rose-400">+{Math.round(eta!.lateBy)} h</span></div>
                  <div className="mt-1 text-sm font-medium">{t.loc} → {t.dest}</div>
                  <div className="text-xs text-muted-foreground">{eta!.leg} · {t.transporter}</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(t.stageIdx / 7) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section title="Sales pace">
          <div className="surface-card flex flex-col gap-4 p-4">
            <div className="text-sm"><b className="tabular-nums">{cr(mc.mtd.sales)}</b> <span className="text-muted-foreground">of {cr(mc.mTarget)} · need {cr(mc.required)}/day for {mc.daysLeft} days</span></div>
            <SegmentedMeter value={(mc.mtd.sales / mc.mTarget) * 100} zones={[{ label: "Behind", from: 0, to: 70, color: C.bad }, { label: "Close", from: 70, to: 90, color: C.warn }, { label: "On pace", from: 90, to: 100, color: C.good }]} showMarker tickFormatter={(v) => v + "%"} />
            <BulletChart items={zones} valueFormatter={(v) => (v * 100).toFixed(0) + "%"} tone="status" size="compact" showLegend={false} />
          </div>
        </Section>

        <a href="/" className="text-center text-xs text-muted-foreground underline-offset-4 hover:underline">Open the full desktop dashboard</a>
      </div>
    </div>
  );
}

export default function MonitorScreen() {
  return <ListProvider><MonitorBody /></ListProvider>;
}
