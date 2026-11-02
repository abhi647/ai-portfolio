/* Hub · Command Center — the centre of the hub-and-spoke MIS. Built only from overtrue/ui components. */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  IconArrowRight, IconBuildingWarehouse, IconChartBar, IconClipboardList, IconCloudDataConnection, IconCrystalBall, IconDatabase,
  IconReportMoney, IconShoppingCart, IconSparkles, IconTruck, IconAlertTriangle, IconAlertOctagon, IconInfoCircle, IconBuildingFactory2,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/overtrue/page-header";
import { MetricGroup, MetricGroupItem } from "@/components/overtrue/metric-group";
import { ServiceMap, type ServiceMapEdge, type ServiceMapNode } from "@/components/overtrue/service-map";
import { SectionCard } from "@/components/overtrue/section-card";
import { StatusEdgeCard } from "@/components/overtrue/status-edge-card";
import { StatusBadge } from "@/components/overtrue/status-badge";
import { RadialGauge } from "@/components/overtrue/radial-gauge";
import { BulletChart } from "@/components/overtrue/bullet-chart";
import { ComposedChart } from "@/components/overtrue/composed-chart";
import { Sparkline } from "@/components/overtrue/trend-sparkline";
import { ActivityFeed } from "@/components/overtrue/activity-feed";
import { DeltaBadge } from "@/components/overtrue/delta-badge";
import { Button } from "@/components/ui/button";
import { MODULES } from "@/nav";
import { useApp } from "@/state/app";
import { useAI } from "@/state/ai";
import { ACCOUNTS, ASMS, CFAS, CUR_MONTH, MONTHS, NOW, cfaQty, orders, plSum, today0, trips, asmDay } from "@/data/data";
import { DAY, cr, fdt, fmtN, sum } from "@/data/format";
import { computeAlerts } from "@/data/insights";
import { cfaForecast, delayRisk, freightForecast, healthLabel, marginForecast, otifRisk, salesForecast, zoneForecasts, type Health } from "@/data/forecast";
import { C } from "@/data/colors";
import { cn } from "@/lib/utils";

const ALERTS = computeAlerts();
const TONE: Record<Health, "success" | "warning" | "danger"> = { healthy: "success", degraded: "warning", down: "danger" };
const BADGE: Record<Health, "success" | "warning" | "error"> = { healthy: "success", degraded: "warning", down: "error" };
const worst = (hs: Health[]): Health => (hs.includes("down") ? "down" : hs.includes("degraded") ? "degraded" : "healthy");

interface Spoke {
  id: string; label: string; icon: typeof IconTruck; path: string; source: string; health: Health;
  kpi: string; kpiLabel: string; delta?: number; invert?: boolean; spark: number[]; facts: [string, string][]; predict: string; moduleId?: string;
}

function useHubData() {
  const { otif } = useApp();
  return React.useMemo(() => {
    const days14 = Array.from({ length: 14 }, (_, i) => new Date(+today0 - (13 - i) * DAY));
    const active = trips.filter((t) => t.stage !== "epod_done");
    const sales = salesForecast();
    const zones = zoneForecasts();
    const fr = freightForecast();
    const or = otifRisk();
    const dl = delayRisk();
    const cfa = cfaForecast(7);
    const mg = marginForecast();
    const perKm = fr.hist.map((h) => h.v);
    const otifM = MONTHS.map((m) => { const os = orders.filter((o) => o.mk === m.key && o.otif != null); return (sum(os, (o) => o.otif! * o.qty) / (sum(os, "qty") || 1)) * 100; });
    const cfaDaily = days14.map((d) => CFAS.reduce((a, _, i) => a + cfaQty(i, d), 0));
    const pnlNow = plSum(ACCOUNTS.map((a) => a[0]), CUR_MONTH);
    const mtdCfa = (() => { let s = 0; for (let d = new Date(today0.getFullYear(), today0.getMonth(), 1); d <= today0; d = new Date(+d + DAY)) s += CFAS.reduce((a, _, i) => a + cfaQty(i, d), 0); return s; })();

    const spokes: Spoke[] = [
      {
        id: "logistics", label: "Logistics", icon: IconTruck, path: "/trips/live", source: "Traqo TMS", moduleId: "trips",
        health: dl.late.length > 8 ? "down" : dl.late.length ? "degraded" : "healthy",
        kpi: fmtN(active.length), kpiLabel: "active trips", spark: days14.map((d) => trips.filter((t) => t.ms.gateOut && t.ms.gateOut >= d && +t.ms.gateOut < +d + DAY).length),
        facts: [["Behind plan", String(dl.late.length)], ["Freight ₹/km", "₹" + perKm[5].toFixed(1)]],
        predict: `${dl.atRisk.length} more trips likely to slip in the next 24 h`,
      },
      {
        id: "orders", label: "Orders & OTIF", icon: IconClipboardList, path: "/orders/live", source: "Traqo TMS · ERP", moduleId: "orders",
        health: or.mtdOtif >= otif.green ? "healthy" : or.mtdOtif >= otif.amber ? "degraded" : "down",
        kpi: or.mtdOtif.toFixed(1) + "%", kpiLabel: "OTIF this month", delta: (otifM[5] - otifM[4]) / 100, spark: otifM,
        facts: [["Open orders", String(or.scored.length)], ["Likely to miss", String(or.high.length)]],
        predict: `Month-end OTIF projected at ${or.projectedOtif.toFixed(1)}% (target ${otif.green}%)`,
      },
      {
        id: "sales", label: "Sales", icon: IconChartBar, path: "/sales/team", source: "DMS", moduleId: "sales",
        health: sales.achievement >= 1 ? "healthy" : sales.achievement >= 0.95 ? "degraded" : "down",
        kpi: cr(sales.mtd), kpiLabel: `MTD · ${Math.round((sales.mtd / sales.target) * 100)}% of month target`, spark: days14.map((d) => sum(ASMS, (a) => asmDay(a, d))),
        facts: [["Need / day", cr(sales.needPerDay)], ["Expected / day", cr(sales.expectedPerDay)]],
        predict: `Lands at ${cr(sales.projected)} — ${(sales.achievement * 100).toFixed(1)}% of target`,
      },
      {
        id: "cfa", label: "Secondary supply", icon: IconBuildingWarehouse, path: "/cfa", source: "CFA WMS", moduleId: "cfa",
        health: cfa.trend >= 0.97 ? "healthy" : "degraded",
        kpi: fmtN(mtdCfa), kpiLabel: "cases dispatched MTD", spark: cfaDaily,
        facts: [["Today", fmtN(cfaDaily[13])], ["CFAs", String(CFAS.length)]],
        predict: `~${fmtN(Math.round(cfa.total))} cases expected in the next 7 days (${cfa.trend >= 1 ? "+" : ""}${((cfa.trend - 1) * 100).toFixed(0)}% trend)`,
      },
      {
        id: "finance", label: "Finance", icon: IconReportMoney, path: "/pnl", source: "Marketplaces · ERP", moduleId: "pnl",
        health: mg.mtd >= mg.hist[4].v - 0.3 ? "healthy" : "degraded",
        kpi: mg.mtd.toFixed(1) + "%", kpiLabel: "e-com material margin MTD", delta: (mg.mtd - mg.hist[4].v) / 100, spark: mg.hist.map((h) => h.v),
        facts: [["Net sales MTD", cr(pnlNow.netSales)], ["Accounts", String(ACCOUNTS.length)]],
        predict: `Margin trending to ${mg.nextMonth.toFixed(1)}% next month`,
      },
    ];
    const fHealth = worst([spokes[0].health, spokes[1].health, spokes[2].health]);
    spokes.push({
      id: "forecasts", label: "Forecasts", icon: IconCrystalBall, path: "/forecasts", source: "Predictive models", health: fHealth,
      kpi: `${Math.round(sales.pHit * 100) < 1 ? "<1" : Math.round(sales.pHit * 100)}%`, kpiLabel: "chance sales hits 100% of target", spark: sales.series.map((s) => s.actual ?? s.forecast ?? 0),
      facts: [["Freight ₹/km next month", "₹" + fr.next[0].v.toFixed(1)], ["Risks flagged", String(dl.late.length + dl.atRisk.length + or.high.length)]],
      predict: "Sales landing, OTIF risk, trip delays, CFA demand and margin — all in one place",
    });
    return { spokes, sales, zones, fr, or, dl, cfa, mg, perKm, otifM };
  }, [otif]);
}

export default function Hub() {
  const nav = useNavigate();
  const ai = useAI();
  const { user, lastSync, otif } = useApp();
  const d = useHubData();
  const { spokes, sales, zones } = d;
  const hour = NOW.getHours();
  const first = (user?.name ?? "").split(" ")[0];
  const open = (s: Spoke) => nav(s.path);

  // Hub-and-spoke map: source systems → DFM MIS → areas.
  const sources: ServiceMapNode[] = [
    { id: "src-tms", label: "Traqo TMS", kind: "external", icon: <IconCloudDataConnection className="size-4" /> },
    { id: "src-erp", label: "SAP ERP", kind: "database", icon: <IconDatabase className="size-4" /> },
    { id: "src-dms", label: "DMS", kind: "database", icon: <IconDatabase className="size-4" /> },
    { id: "src-wms", label: "CFA WMS", kind: "database", icon: <IconBuildingFactory2 className="size-4" /> },
    { id: "src-mkt", label: "Marketplaces", kind: "external", icon: <IconShoppingCart className="size-4" /> },
  ];
  const nodes: ServiceMapNode[] = [
    ...sources,
    { id: "hub", label: "DFM MIS", kind: "gateway", status: worst(spokes.map((s) => s.health)) },
    ...spokes.map((s) => ({ id: s.id, label: s.label, kind: "service" as const, status: s.health, group: s.source, icon: <s.icon className="size-4" /> })),
  ];
  const syncFailed = ALERTS.some((a) => a.id.startsWith("sync"));
  const edges: ServiceMapEdge[] = [
    ...sources.map((s) => ({ source: s.id, target: "hub", status: (s.id === "src-dms" && syncFailed ? "degraded" : "healthy") as Health })),
    ...spokes.map((s) => ({ source: "hub", target: s.id, status: s.health })),
  ];

  const feed = [
    ...d.dl.late.slice(0, 1).map(() => ({ id: "late", icon: IconAlertTriangle, tone: "warning", title: `${d.dl.late.length} trips behind plan`, body: `Worst: ${d.dl.late[0].t.id} · ${d.dl.late[0].eta!.leg} · +${Math.round(d.dl.late[0].eta!.lateBy)} h`, href: "/trips/timeline" })),
    ...ALERTS.map((a) => ({ id: a.id, icon: a.severity === "error" ? IconAlertOctagon : a.severity === "warning" ? IconAlertTriangle : IconInfoCircle, tone: a.severity, title: a.title, body: a.body, href: a.href })),
    { id: "pred-sales", icon: IconSparkles, tone: "info", title: `Sales likely to land at ${(sales.achievement * 100).toFixed(1)}% of target`, body: `Needs ${cr(sales.needPerDay)}/day for ${sales.daysLeft} days; expected ${cr(sales.expectedPerDay)}/day.`, href: "/sales/team" },
    ...(d.or.high.length ? [{ id: "pred-otif", icon: IconSparkles, tone: "info", title: `${d.or.high.length} open orders likely to miss OTIF`, body: `Highest risk ${d.or.high[0].o.no} · ${d.or.high[0].o.dest} · ${Math.round(d.or.high[0].p * 100)}%`, href: "/orders/live" }] : []),
  ];

  return (
    <div className="flex flex-col gap-[var(--page-gap)]">
      <PageHeader
        eyebrow={`${NOW.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · Hub`}
        title={`Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, ${first} — here’s DFM today`}
        description="The command center: live health of every area, what’s likely to happen next, and one click into any dashboard."
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge variant="success" live>Refreshed {fdt(lastSync)}</StatusBadge>
            {ai ? <Button size="sm" variant="outline" className="gap-1.5" onClick={() => ai.ask("Give me a briefing on today: what’s on track, what’s at risk, and what should I do first?", { mode: "research" })}><IconSparkles className="size-4" /> Brief me</Button> : null}
          </div>
        }
      />

      <MetricGroup className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <MetricGroupItem label="Secondary sales MTD" value={cr(sales.mtd)} context={<span>{Math.round((sales.mtd / sales.target) * 100)}% of {cr(sales.target)} target</span>} />
        <MetricGroupItem label="Month-end forecast" value={cr(sales.projected)} context={<span>{cr(sales.lo)} – {cr(sales.hi)} · 80% range</span>} />
        <MetricGroupItem label="OTIF this month" value={d.or.mtdOtif.toFixed(1) + "%"} context={<DeltaBadge delta={(d.otifM[5] - d.otifM[4]) / 100} />} />
        <MetricGroupItem label="Freight ₹/km" value={"₹" + d.perKm[5].toFixed(1)} context={<DeltaBadge delta={(d.perKm[5] - d.perKm[4]) / d.perKm[4]} invert />} />
        <MetricGroupItem label="Active trips" value={fmtN(trips.filter((t) => t.stage !== "epod_done").length)} context={<span>{d.dl.late.length} behind plan · {d.dl.atRisk.length} at risk</span>} />
        <MetricGroupItem label="E-com margin" value={d.mg.mtd.toFixed(1) + "%"} context={<DeltaBadge delta={(d.mg.mtd - d.mg.hist[4].v) / 100} />} />
      </MetricGroup>

      <div className="grid grid-cols-1 gap-[var(--grid-gap)] xl:grid-cols-12">
        <SectionCard className="xl:col-span-8" title="Hub map" description="Source systems feed the MIS; the MIS feeds six areas. Colour shows each area’s health — click one to open it."
          contentClassName="p-3">
          <ServiceMap nodes={nodes} edges={edges} direction="LR" nodeWidth={176} nodeHeight={62} showLegend={false}
            onSelect={(id) => { const s = spokes.find((x) => x.id === id); if (s) open(s); }}
            renderNode={(n, info) => {
              const s = spokes.find((x) => x.id === n.id);
              if (!s) return (
                <div className="flex h-full items-center gap-2 px-3">
                  <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", n.id === "hub" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{n.id === "hub" ? <img src="/brand/crax-logo.png" alt="" className="h-4 w-auto" /> : info.icon}</span>
                  <span className="min-w-0"><span className="block truncate text-[13px] font-semibold">{n.label}</span><span className="block truncate text-[11px] text-muted-foreground">{n.id === "hub" ? `${spokes.filter((x) => x.health === "healthy").length}/6 areas on track` : "connected"}</span></span>
                </div>
              );
              return (
                <div className="flex h-full items-center gap-2 px-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{info.icon}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold">{s.label}</span><span className="block truncate text-[11px] text-muted-foreground tabular-nums">{s.kpi} · {healthLabel[s.health]}</span></span>
                </div>
              );
            }} />
        </SectionCard>

        <SectionCard className="xl:col-span-4" title="Month-end outlook" description={`Secondary sales forecast · ${sales.daysLeft} days left`} contentClassName="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-4">
            <RadialGauge value={Math.round(sales.achievement * 1000) / 10} min={80} max={110} size={148} thickness={12}
              zones={[{ from: 80, to: 95, color: C.bad, label: "Behind" }, { from: 95, to: 100, color: C.warn, label: "Close" }, { from: 100, to: 110, color: C.good, label: "On target" }]}>
              <div className="text-center"><div className="text-[22px] font-semibold tracking-tight tabular-nums">{(sales.achievement * 100).toFixed(1)}%</div><div className="text-[11px] text-muted-foreground">of target</div></div>
            </RadialGauge>
            <div className="min-w-0 text-[13px] leading-5">
              <p className="m-0">Likely landing <b className="tabular-nums">{cr(sales.projected)}</b> against <b className="tabular-nums">{cr(sales.target)}</b>.</p>
              <p className="m-0 mt-1 text-muted-foreground">Chance of hitting 100%: <b className={cn("tabular-nums", sales.pHit < 0.3 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{sales.pHit < 0.01 ? "<1%" : Math.round(sales.pHit * 100) + "%"}</b></p>
              <p className="m-0 mt-1 text-muted-foreground">Gap to close: <b className="text-foreground tabular-nums">{cr(Math.max(0, sales.target - sales.projected))}</b></p>
            </div>
          </div>
          <BulletChart size="compact" tone="status" showLegend={false} valueFormatter={(v) => (v * 100).toFixed(0) + "%"}
            items={zones.map((z) => ({ id: z.full, label: z.zone, sublabel: `→ ${cr(z.projected)}`, value: z.achievement, target: 1, ranges: [0.9, 0.97, 1.1] as [number, number, number], max: 1.15 }))} />
        </SectionCard>
      </div>

      <section className="flex flex-col gap-2.5" aria-label="Areas">
        <div className="flex items-end justify-between gap-3">
          <div><h2 className="m-0 text-[15px] font-semibold tracking-tight">Areas</h2><p className="m-0 text-[13px] text-muted-foreground">Each spoke opens its own set of dashboards.</p></div>
        </div>
        <div className="grid grid-cols-1 gap-[var(--grid-gap)] md:grid-cols-2 xl:grid-cols-3">
          {spokes.map((s) => {
            const mod = MODULES.find((m) => m.id === s.moduleId);
            const tabs = mod?.tabs ?? [];
            return (
              <StatusEdgeCard key={s.id} tone={TONE[s.health]} edge="top" contentClassName="flex flex-col gap-3 p-4"
                title={<span className="inline-flex items-center gap-2"><s.icon className="size-4 text-primary" />{s.label}</span>}
                description={s.source}
                actions={<StatusBadge variant={BADGE[s.health]}>{healthLabel[s.health]}</StatusBadge>}>
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="text-[26px] leading-8 font-semibold tracking-[-0.03em] tabular-nums">{s.kpi}</span>{s.delta != null ? <DeltaBadge delta={s.delta} invert={s.invert} /> : null}</div>
                    <div className="truncate text-xs text-muted-foreground">{s.kpiLabel}</div>
                  </div>
                  <Sparkline data={s.spark} className="h-10 w-28 shrink-0" />
                </div>
                <dl className="m-0 grid grid-cols-2 gap-2 text-xs">
                  {s.facts.map(([k, v]) => <div key={k} className="rounded-lg bg-muted/50 px-2.5 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="m-0 font-semibold tabular-nums">{v}</dd></div>)}
                </dl>
                <p className="m-0 flex items-start gap-1.5 text-[12.5px] leading-5"><IconSparkles className="mt-0.5 size-3.5 shrink-0 text-primary" /><span>{s.predict}</span></p>
                {tabs.length ? (
                  <div className="flex flex-wrap gap-1">
                    {tabs.slice(0, 5).map((t) => <button key={t.id} type="button" onClick={() => nav(`${mod!.path}/${t.id}`)} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary">{t.label}</button>)}
                    {tabs.length > 5 ? <span className="px-1 py-0.5 text-[11px] text-muted-foreground">+{tabs.length - 5} more</span> : null}
                  </div>
                ) : null}
                <Button size="sm" variant="outline" className="mt-auto w-full justify-between" onClick={() => open(s)}>Open {s.label} <IconArrowRight className="size-4" /></Button>
              </StatusEdgeCard>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-[var(--grid-gap)] xl:grid-cols-12">
        <SectionCard className="xl:col-span-8" title="Sales landing forecast" description="Cumulative secondary sales this month · actual to date, forecast with 80% band, and the pro-rated target" contentClassName="p-4">
          <ComposedChart data={sales.series} xKey="day" className="h-72" showYAxis showLegend yFormatter={(v) => "₹" + (v / 1e7).toFixed(0) + "Cr"}
            series={[
              { key: "actual", label: "Actual", type: "area", color: "var(--color-chart-1)" },
              { key: "hi", label: "Forecast high", type: "line", dashed: true, color: "color-mix(in oklab, var(--color-chart-2) 45%, transparent)" },
              { key: "forecast", label: "Forecast", type: "line", dashed: true, color: "var(--color-chart-2)", dots: true },
              { key: "lo", label: "Forecast low", type: "line", dashed: true, color: "color-mix(in oklab, var(--color-chart-2) 45%, transparent)" },
              { key: "target", label: "Target pace", type: "line", color: "var(--color-chart-3)" },
            ]} />
          <p className="m-0 mt-2 text-xs text-muted-foreground">Model: weekday pattern and month-end push learned from the last 12 weeks, applied to the current 14-day run rate. Band includes daily noise and run-rate uncertainty.</p>
        </SectionCard>
        <ActivityFeed className="surface-card xl:col-span-4" title="Needs attention · and what’s coming"
          items={feed.map((f) => ({
            id: f.id,
            initials: f.id.startsWith("pred") ? "AI" : f.tone === "error" ? "!!" : "!",
            time: f.id.startsWith("pred") ? "Prediction" : "Now",
            content: (
              <button type="button" onClick={() => nav(f.href)} className="flex items-start gap-2 text-left">
                <span><span className="block font-medium hover:underline">{f.title}</span><span className="block text-xs text-muted-foreground">{f.body}</span></span>
              </button>
            ),
          }))} />
      </div>
      <p className="m-0 text-xs text-muted-foreground">OTIF thresholds: green ≥ {otif.green}%, amber ≥ {otif.amber}%. Health: On track · Watch · Critical.</p>
    </div>
  );
}
