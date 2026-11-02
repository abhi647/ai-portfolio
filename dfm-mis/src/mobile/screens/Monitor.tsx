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
import { DenseTable } from "@/components/app/dense";
import { execute, type QuerySpec } from "@/ai/engine";
import { cfaQty, CFAS } from "@/data/data";
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
  void ZONES; void BulletChart;
  const zones = ZONES.map(([z]) => { const l = ASMS.filter((a) => a.zone === z); const s = sum(l, (a) => asmPeriod(a, range)), t = sum(l, (a) => asmPeriodTarget(a, range)); return { id: z, label: z.split(" – ")[0], value: s / t, target: 1, ranges: [0.85, 0.95, 1.1] as [number, number, number], max: 1.2 }; });

  const cur = MONTHS[5].label;
  const q = (dataset: string, measures: string[], dimension: string | null, extra: Partial<QuerySpec> = {}) =>
    execute({ dataset, measures, dimension, series: null, filters: [{ field: "month", op: "in", values: [cur] }], sort: "desc", limit: null, chart: "table", title: "", ...extra });
  const tr = q("trips", ["trips", "freight", "cost_per_km", "detention_rate", "tracking_rate"], "transporter");
  const zoneT = q("sales", ["sales", "achievement_pct", "gap_to_target"], "zone", { sort: "asc" });
  const det = q("trips", ["detention_rate"], null).totals.detention_rate;
  const openOrders = orders.filter((o) => o.stage !== "dispatched" && (+NOW - +o.approved) / DAY <= 30);
  const cfaToday = CFAS.reduce((a, _, i) => a + cfaQty(i, today0), 0);
  const kpis: { l: string; v: string; s: string; tone?: "bad" | "good"; spark?: number[]; onClick?: () => void }[] = [
    { l: "Dispatched today", v: fmtN(disp[13].length), s: `${fmtN(sum(disp[13], "invQty"))} cases`, spark: disp.map((d) => d.length), onClick: () => openList({ title: "Dispatched today", kind: "trips", rows: disp[13] }) },
    { l: "Active trips", v: fmtN(active.length), s: `${late.length} behind plan`, tone: late.length ? "bad" : undefined, onClick: () => openList({ title: "Active trips", kind: "trips", rows: active }) },
    { l: "MTD sales", v: cr(mc.mtd.sales), s: `${Math.round((mc.mtd.sales / mc.mTarget) * 100)}% of target`, spark: days14.map((d) => sum(ASMS, (a) => asmDay(a, d))) },
    { l: "MTD OTIF", v: mtdOtif.toFixed(1) + "%", s: `${monthly[5] >= monthly[4] ? "▲" : "▼"} ${Math.abs(monthly[5] - monthly[4]).toFixed(1)} pts vs ${MONTHS[4].label}`, tone: monthly[5] >= monthly[4] ? "good" : "bad", spark: monthly },
    { l: "Freight ₹/km", v: "₹" + perKm[5].toFixed(1), s: `${perKm[5] <= perKm[4] ? "▼" : "▲"} ₹${Math.abs(perKm[5] - perKm[4]).toFixed(1)} vs ${MONTHS[4].label}`, tone: perKm[5] <= perKm[4] ? "good" : "bad", spark: perKm },
    { l: "Detention rate", v: (det ?? 0).toFixed(1) + "%", s: "of ePOD-closed trips, MTD", tone: (det ?? 0) > 15 ? "bad" : undefined },
    { l: "Open orders", v: fmtN(openOrders.length), s: "approved, last 30 days", onClick: () => openList({ title: "Open orders", kind: "orders", rows: openOrders }) },
    { l: "CFA cases today", v: fmtN(cfaToday), s: `${CFAS.length} CFAs` },
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

      <div className="flex flex-col gap-4 px-3 pt-2 pb-8">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/70 bg-border/70" aria-label="Key numbers">
          {kpis.map((k) => (
            <button key={k.l} type="button" onClick={k.onClick} disabled={!k.onClick} className="flex min-w-0 flex-col bg-card px-3 py-2 text-left disabled:cursor-default active:bg-muted">
              <span className="truncate text-[11px] text-muted-foreground">{k.l}</span>
              <span className="flex items-end justify-between gap-2">
                <span className="truncate text-[18px] leading-6 font-semibold tracking-[-0.03em] tabular-nums">{k.v}</span>
                {k.spark ? <Sparkline data={k.spark} className="h-5 w-14 shrink-0" /> : null}
              </span>
              <span className={cn("truncate text-[11px] tabular-nums", k.tone === "bad" ? "text-rose-600 dark:text-rose-400" : k.tone === "good" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>{k.s}</span>
            </button>
          ))}
        </div>

        <Section title="Needs attention" action={<span className="text-xs text-muted-foreground">{ALERTS.length + (late.length ? 1 : 0)} items</span>}>
          <ul className="m-0 list-none divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-card p-0">
            {late.length ? (
              <li>
                <button type="button" onClick={() => openList({ title: "Trips behind plan", kind: "trips", rows: late.map((x) => x.t) })} className="flex w-full items-center gap-2.5 px-3 py-2 text-left active:bg-muted">
                  <IconAlertTriangle className="size-4 shrink-0 text-amber-500" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{late.length} trips behind plan</span><span className="block truncate text-[11.5px] text-muted-foreground">Worst {late[0].t.id} · {late[0].eta!.leg} · +{Math.round(late[0].eta!.lateBy)} h</span></span>
                  <IconChevronRight className="size-4 text-muted-foreground" />
                </button>
              </li>
            ) : null}
            {ALERTS.map((a) => {
              const Icon = a.severity === "error" ? IconAlertOctagon : a.severity === "warning" ? IconAlertTriangle : IconInfoCircle;
              const rows = alertRows(a.id);
              return (
                <li key={a.id} className="flex items-center gap-2.5 px-3 py-2">
                  <Icon className={cn("size-4 shrink-0", a.severity === "error" ? "text-rose-500" : a.severity === "warning" ? "text-amber-500" : "text-primary")} />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => rows && openList({ title: a.title, ...rows } as never)}>
                    <span className="block truncate text-[13px] font-medium">{a.title}</span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">{a.body}</span>
                  </button>
                  <button type="button" aria-label={`Ask AI about: ${a.title}`} onClick={() => ai.ask(`${a.title} — why, and what should I do?`, { mode: "research" })} className="flex size-7 shrink-0 items-center justify-center rounded-md text-primary active:bg-primary/10"><IconSparkles className="size-4" /></button>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section title={`Transporters · ${cur}`} action={<span className="text-xs text-muted-foreground">tap a column to sort</span>}>
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
            <DenseTable rank maxHeight={300} dimLabel="Transporter" initialSort={{ key: "freight", dir: "desc" }} rows={tr.rows.map((r) => ({ label: r.label, values: r.values }))} total={tr.totals}
              cols={[{ key: "trips", label: "Trips", format: "number" }, { key: "freight", label: "Freight", format: "inr" }, { key: "cost_per_km", label: "₹/km", format: "inr_per_km", higherIsBetter: false }, { key: "detention_rate", label: "Det.", format: "pct", higherIsBetter: false }, { key: "tracking_rate", label: "GPS", format: "pct", higherIsBetter: true }]} />
          </div>
        </Section>

        <Section title="Trip pipeline" action={<span className="text-xs text-muted-foreground">{fmtN(active.length)} active</span>}>
          <ul className="m-0 list-none divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-card p-0">
            {TSTAGES.slice(0, 7).map((s) => {
              const rs = active.filter((t) => t.stage === s.key);
              return (
                <li key={s.key}>
                  <button type="button" onClick={() => openList({ title: s.label, kind: "trips", rows: rs })} className="flex min-h-10 w-full items-center gap-2.5 px-3 py-1.5 text-left active:bg-muted">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="flex-1 text-[13px]">{s.label}</span>
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${(rs.length / Math.max(1, active.length)) * 100}%`, background: s.color }} /></span>
                    <span className="w-8 text-right text-[13px] font-semibold tabular-nums">{rs.length}</span>
                    <IconChevronRight className="size-4 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>

        {late.length ? (
          <Section title="Behind plan" action={<button type="button" className="text-xs font-medium text-primary" onClick={() => openList({ title: "Trips behind plan", kind: "trips", rows: late.map((x) => x.t) })}>See all</button>}>
            <ul className="m-0 list-none divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-card p-0">
              {late.slice(0, 6).map(({ t, eta }) => (
                <li key={t.id} className="flex items-center gap-2.5 px-3 py-1.5">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[13px]"><span className="font-mono text-[11.5px] text-muted-foreground">{t.id}</span><span className="truncate font-medium">{t.loc} → {t.dest}</span></span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">{eta!.leg} · {t.transporter}</span>
                  </span>
                  <span className="h-1 w-10 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${(t.stageIdx / 7) * 100}%` }} /></span>
                  <span className="w-12 text-right text-[12px] font-semibold text-rose-600 tabular-nums dark:text-rose-400">+{Math.round(eta!.lateBy)} h</span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section title={`Sales pace · ${cur}`}>
          <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-3">
            <div className="text-[13px]"><b className="tabular-nums">{cr(mc.mtd.sales)}</b> <span className="text-muted-foreground">of {cr(mc.mTarget)} · need {cr(mc.required)}/day for {mc.daysLeft} days</span></div>
            <SegmentedMeter value={(mc.mtd.sales / mc.mTarget) * 100} zones={[{ label: "Behind", from: 0, to: 70, color: C.bad }, { label: "Close", from: 70, to: 90, color: C.warn }, { label: "On pace", from: 90, to: 100, color: C.good }]} showMarker tickFormatter={(v) => v + "%"} />
          </div>
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
            <DenseTable dimLabel="Zone" rows={zoneT.rows.map((r) => ({ label: r.label.split(" – ")[0], values: r.values }))} total={zoneT.totals} initialSort={{ key: "achievement_pct", dir: "asc" }}
              cols={[{ key: "sales", label: "Sales", format: "inr" }, { key: "achievement_pct", label: "Ach.", format: "pct", higherIsBetter: true }, { key: "gap_to_target", label: "Gap", format: "inr", higherIsBetter: false }]} />
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
