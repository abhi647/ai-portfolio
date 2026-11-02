/* Overview tiles: one card per area with live health, a prediction and links into its sub-dashboards. overtrue/ui only. */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { IconArrowRight, IconBuildingWarehouse, IconChartBar, IconClipboardList, IconLayoutGrid, IconReportMoney, IconSparkles, IconTablePlus, IconTruck } from "@tabler/icons-react";
import { StatusEdgeCard } from "@/components/overtrue/status-edge-card";
import { SectionCard } from "@/components/overtrue/section-card";
import { StatusBadge } from "@/components/overtrue/status-badge";
import { Sparkline } from "@/components/overtrue/trend-sparkline";
import { DeltaBadge } from "@/components/overtrue/delta-badge";
import { Button } from "@/components/ui/button";
import { MODULES } from "@/nav";
import { useApp } from "@/state/app";
import { useDashboards } from "@/state/dashboards";
import { ACCOUNTS, ASMS, CFAS, CUR_MONTH, MONTHS, orders, plSum, today0, trips, asmDay, cfaQty } from "@/data/data";
import { DAY, cr, fmtN, sum } from "@/data/format";
import { cfaForecast, delayRisk, freightForecast, healthLabel, marginForecast, otifRisk, salesForecast, zoneForecasts, type Health } from "@/data/forecast";

const TONE: Record<Health, "success" | "warning" | "danger"> = { healthy: "success", degraded: "warning", down: "danger" };
const BADGE: Record<Health, "success" | "warning" | "error"> = { healthy: "success", degraded: "warning", down: "error" };

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
    return { spokes, sales, zones, fr, or, dl, cfa, mg, perKm, otifM };
  }, [otif]);
}


export function ModuleTiles() {
  const nav = useNavigate();
  const { user } = useApp();
  const db = useDashboards();
  const { spokes } = useHubData();
  const allowed = (id?: string) => { const m = MODULES.find((x) => x.id === id); return !m?.access || user?.role === "Admin" || !!user?.access[m.access]; };
  const tools = [
    { label: "My dashboards", icon: IconLayoutGrid, path: "/dashboards", text: `${db.dashboards.length} dashboards · build your own` },
    { label: "Data explorer", icon: IconTablePlus, path: "/explore/pivot", text: "Pivot and raw records for every dataset" },
    { label: "Ask AI", icon: IconSparkles, path: "/ask", text: "Ask in plain English — Quick, Research, Brief or Compare" },
  ];
  return (
    <section className="flex flex-col gap-2.5" aria-label="Dashboards">
      <div><h2 className="m-0 text-[15px] font-semibold tracking-tight">Dashboards</h2><p className="m-0 text-[13px] text-muted-foreground">Pick an area, or jump straight to one of its dashboards.</p></div>
      <div className="grid grid-cols-1 gap-[var(--grid-gap)] md:grid-cols-2 xl:grid-cols-3">
        {spokes.filter((s) => allowed(s.moduleId)).map((s) => {
          const mod = MODULES.find((m) => m.id === s.moduleId);
          const tabs = mod?.tabs ?? [];
          return (
            <StatusEdgeCard key={s.id} tone={TONE[s.health]} edge="top" contentClassName="flex flex-1 flex-col gap-3 p-4" className="flex flex-col"
              title={<span className="inline-flex items-center gap-2"><s.icon className="size-4 text-primary" />{s.label}</span>}
              description={s.source}
              actions={<StatusBadge variant={BADGE[s.health]}>{healthLabel[s.health]}</StatusBadge>}>
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5"><span className="text-[24px] leading-8 font-semibold tracking-[-0.03em] tabular-nums">{s.kpi}</span>{s.delta != null ? <DeltaBadge delta={s.delta} invert={s.invert} /> : null}</div>
                  <div className="truncate text-xs text-muted-foreground">{s.kpiLabel}</div>
                </div>
                <Sparkline data={s.spark} className="h-9 w-20 shrink-0" />
              </div>
              <dl className="m-0 grid grid-cols-2 gap-1.5 text-xs">
                {s.facts.map(([k, v]) => <div key={k} className="rounded-lg bg-muted/50 px-2 py-1.5"><dt className="truncate text-muted-foreground">{k}</dt><dd className="m-0 font-semibold tabular-nums">{v}</dd></div>)}
              </dl>
              <p className="m-0 flex items-start gap-1.5 text-[12px] leading-[1.4]"><IconSparkles className="mt-0.5 size-3.5 shrink-0 text-primary" /><span>{s.predict}</span></p>
              {tabs.length ? (
                <div className="flex flex-wrap gap-1">
                  {tabs.map((t) => <button key={t.id} type="button" onClick={() => nav(`${mod!.path}/${t.id}`)} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary">{t.label}</button>)}
                </div>
              ) : null}
              <Button size="sm" variant="outline" className="mt-auto w-full justify-between" onClick={() => nav(s.path)}>Open {s.label} <IconArrowRight className="size-4" /></Button>
            </StatusEdgeCard>
          );
        })}
        <SectionCard title={<span className="inline-flex items-center gap-2"><IconSparkles className="size-4 text-primary" />Tools</span>} description="Build, explore and ask" contentClassName="flex flex-1 flex-col p-0" className="flex flex-col">
          <ul className="m-0 flex flex-1 list-none flex-col divide-y divide-border/60 p-0">
            {tools.map((t) => (
              <li key={t.label} className="flex-1">
                <button type="button" onClick={() => nav(t.path)} className="flex h-full w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><t.icon className="size-[18px]" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{t.label}</span><span className="block text-[12.5px] text-muted-foreground">{t.text}</span></span>
                  <IconArrowRight className="size-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </section>
  );
}
