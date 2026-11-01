import { Link, useNavigate } from "react-router-dom";
import { IconAlertTriangle, IconArrowRight, IconCircleCheck, IconInfoCircle, IconAlertOctagon } from "@tabler/icons-react";
import { PageHeader } from "@/components/overtrue/page-header";
import { KpiCard } from "@/components/overtrue/kpi-card";
import { DistributionBar } from "@/components/overtrue/distribution-bar";
import { BarList } from "@/components/overtrue/bar-list";
import { BulletChart } from "@/components/overtrue/bullet-chart";
import { Sparkline } from "@/components/overtrue/trend-sparkline";
import { StatusBadge } from "@/components/overtrue/status-badge";
import { ComposedChart } from "@/components/overtrue/composed-chart";
import { Button } from "@/components/ui/button";
import { Grid, Panel, Foot } from "@/components/app/kit";
import { MODULES } from "@/nav";
import { useApp } from "@/state/app";
import { useDrill } from "@/state/drill";
import { ACCOUNTS, ASMS, CFAS, CUR_MONTH, NOW, TSTAGES, ZONES, cfaQty, orders, plSum, today0, trips } from "@/data/data";
import { DAY, cr, crAxis, fdDay, fmtN, pct, sum } from "@/data/format";
import { asmDay, asmTarget } from "@/data/data";
import { asmPeriod, asmPeriodTarget, monthContext, periodRange } from "@/data/sales";
import { computeAlerts } from "@/data/insights";
import { cn } from "@/lib/utils";

const ALERTS = computeAlerts();

export default function Home() {
  const { user, otif } = useApp();
  const { openTrips, openOrders } = useDrill();
  const nav = useNavigate();
  const hour = NOW.getHours();
  const first = (user?.name ?? "").split(" ")[0];

  const days14 = Array.from({ length: 14 }, (_, i) => new Date(+today0 - (13 - i) * DAY));
  const dispByDay = days14.map((d) => trips.filter((t) => t.ms.gateOut && t.ms.gateOut >= d && +t.ms.gateOut < +d + DAY));
  const today = dispByDay[13];
  const avg7 = sum(dispByDay.slice(6, 13), (r) => r.length) / 7;
  const active = trips.filter((t) => t.stage !== "epod_done");
  const mc = monthContext();
  const mtdOrders = orders.filter((o) => o.mk === CUR_MONTH && o.otif != null);
  const otifV = sum(mtdOrders, (o) => o.otif! * o.qty) / (sum(mtdOrders, "qty") || 1);
  const salesDaily = days14.map((d) => sum(ASMS, (a) => asmDay(a, d)));
  const mtdFreight = sum(trips.filter((t) => t.mk === CUR_MONTH), "total");
  const pnlMtd = plSum(ACCOUNTS.map((a) => a[0]), CUR_MONTH);
  const mtdRange = periodRange("month");
  const zoneItems = ZONES.map(([z]) => {
    const l = ASMS.filter((a) => a.zone === z);
    const s = sum(l, (a) => asmPeriod(a, mtdRange)), t = sum(l, (a) => asmPeriodTarget(a, mtdRange));
    return { id: z, label: z.split(" – ")[0], sublabel: cr(s), value: s / t, target: 1, ranges: [0.85, 0.95, 1.1] as [number, number, number], max: 1.2 };
  });

  const todayOrders = ["approved", "indent", "accept", "report", "dispatch"] as const;
  const flow = todayOrders.map((k) => orders.filter((o) => o.m[k] && o.m[k]! >= today0));
  const dailyTrend = days14.map((d, i) => ({
    day: fdDay(d),
    sales: salesDaily[i],
    target: sum(ASMS, (a) => asmTarget(a, d.getFullYear(), d.getMonth())) / new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(),
  }));
  const cfaToday = CFAS.reduce((s, _, i) => s + cfaQty(i, today0), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={NOW.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) + " · " + NOW.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}
        title={`Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, ${first}`}
        description={`${ALERTS.length} things need attention today. Everything else is on track.`}
        actions={<Button variant="outline" onClick={() => nav("/trips/live")} className="gap-1.5">Open live trips <IconArrowRight className="size-4" /></Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Dispatched today" value={today.length} deltaLabel={`so far today · ${fmtN(sum(today, "invQty"))} cases · 7-day avg ${avg7.toFixed(1)}/day`} sparkline={dispByDay.map((r) => r.length)}
          className="cursor-pointer" onClick={() => openTrips("Dispatched today", today)} />
        <KpiCard label="MTD secondary sales" value={cr(mc.mtd.sales)} delta={mc.mtd.target ? mc.mtd.sales / mc.mtd.target - 1 : 0} deltaLabel={`vs pro-rated target · ${pct(mc.mtd.sales, mc.mTarget)} of month · need ${cr(mc.required)}/day`} sparkline={salesDaily}
          className="cursor-pointer" onClick={() => nav("/sales/team")} />
        <KpiCard label="MTD OTIF" value={(otifV * 100).toFixed(1) + "%"} delta={otifV - otif.green / 100} deltaLabel={`vs ${otif.green}% target · ${mtdOrders.length} eligible orders`}
          className="cursor-pointer" onClick={() => nav("/orders/otif")} />
        <KpiCard label="MTD freight spend" value={cr(mtdFreight)} deltaLabel={`₹${(mtdFreight / (sum(trips.filter((t) => t.mk === CUR_MONTH), "km") || 1)).toFixed(1)} per km · ${fmtN(trips.filter((t) => t.mk === CUR_MONTH).length)} trips`}
          className="cursor-pointer" onClick={() => nav("/trips/costing")} />
      </div>

      <Grid className="lg:grid-cols-[1.25fr_1fr]">
        <Panel title="Needs attention" description="Generated from live data — click to jump to the exact view" contentClassName="p-0">
          <ul className="m-0 list-none divide-y divide-border/60 p-0">
            {ALERTS.map((a) => {
              const Icon = a.severity === "error" ? IconAlertOctagon : a.severity === "warning" ? IconAlertTriangle : IconInfoCircle;
              return (
                <li key={a.id}>
                  <Link to={a.href} className="group flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-muted/50">
                    <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                      a.severity === "error" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : a.severity === "warning" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-primary/10 text-primary")}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{a.title}</span>
                      <span className="block text-[13px] text-muted-foreground">{a.body}</span>
                    </span>
                    <IconArrowRight className="mt-2 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              );
            })}
            {!ALERTS.length && <li className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground"><IconCircleCheck className="size-4 text-emerald-500" /> All clear.</li>}
          </ul>
        </Panel>

        <Panel title="Active trip pipeline" description={`${fmtN(active.length)} trips not yet ePOD-closed`} actions={<StatusBadge variant="success" live>Live</StatusBadge>}>
          <DistributionBar
            segments={TSTAGES.slice(0, 7).map((s) => ({ name: s.label, value: active.filter((t) => t.stage === s.key).length, color: s.color }))}
            valueFormatter={(v) => fmtN(v)}
          />
          <div className="mt-6">
            <h3 className="m-0 mb-3 text-[13px] font-medium text-muted-foreground">Order milestones hit today</h3>
            <BarList
              data={["Approved", "Indent placed", "Accepted", "Vehicle reported", "Dispatched"].map((n, i) => ({ name: n, value: flow[i].length }))}
              valueFormatter={(v) => fmtN(v) + " orders"}
              sortOrder="none"
              onItemClick={(it) => openOrders(`Today · ${it.name}`, flow[["Approved", "Indent placed", "Accepted", "Vehicle reported", "Dispatched"].indexOf(it.name)])}
            />
            <Button variant="link" className="mt-2 h-auto p-0 text-[13px]" onClick={() => openOrders("Orders approved today", flow[0])}>See today’s orders</Button>
          </div>
        </Panel>
      </Grid>

      <Grid className="lg:grid-cols-[1.25fr_1fr]">
        <Panel title="Daily secondary sales vs target run-rate" description="Last 14 days · bars are actual sales, dashed line is the daily target pace">
          <ComposedChart
            data={dailyTrend}
            xKey="day"
            series={[{ key: "sales", label: "Sales", type: "bar" }, { key: "target", label: "Daily target", type: "line", dashed: true, color: "var(--color-chart-3)" }]}
            showYAxis
            showLegend
            yFormatter={crAxis}
            className="h-64"
          />
        </Panel>
        <Panel title="Zone achievement · MTD" description="Bar = achievement, tick = 100% of target; bands mark 85% / 95%" info="Achievement = MTD secondary sales ÷ pro-rated MTD target.">
          <BulletChart items={zoneItems} valueFormatter={(v) => (v * 100).toFixed(0) + "%"} tone="status" size="compact" />
        </Panel>
      </Grid>

      <section className="flex flex-col gap-3">
        <h2 className="m-0 text-[15px] font-semibold tracking-tight">Dashboards</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {MODULES.filter((m) => m.id !== "home" && (!m.access || user?.access[m.access] || user?.role === "Admin") && (m.id !== "settings" || user?.role === "Admin")).map((m) => {
            const meta =
              m.id === "trips" ? { k: fmtN(active.length), l: "active trips", s: dispByDay.map((r) => r.length) }
              : m.id === "orders" ? { k: fmtN(orders.filter((o) => o.stage !== "dispatched" && (+NOW - +o.approved) / DAY <= 30).length), l: "open orders", s: days14.map((d) => orders.filter((o) => o.approved >= d && +o.approved < +d + DAY).length) }
              : m.id === "sales" ? { k: cr(mc.mtd.sales), l: "MTD sales", s: salesDaily }
              : m.id === "cfa" ? { k: fmtN(cfaToday), l: "cases today", s: days14.map((d) => CFAS.reduce((s, _, i) => s + cfaQty(i, d), 0)) }
              : m.id === "pnl" ? { k: ((pnlMtd.materialMargin / pnlMtd.netSales) * 100).toFixed(1) + "%", l: "material margin (MTD)", s: undefined }
              : { k: "8 / 8", l: "sync jobs healthy", s: undefined };
            return (
              <Link key={m.id} to={m.tabs ? `${m.path}/${m.tabs[0].id}` : m.path}
                className="surface-card group flex flex-col gap-3 p-5 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><m.icon className="size-[18px]" /></span>
                  {m.source ? <StatusBadge variant="neutral">{m.source}</StatusBadge> : null}
                </div>
                <div>
                  <div className="text-sm font-semibold">{m.label}</div>
                  <div className="text-[13px] leading-5 text-muted-foreground">{m.description}</div>
                </div>
                <div className="mt-auto flex items-end justify-between gap-4">
                  <div><div className="text-xl font-semibold tracking-[-0.02em] tabular-nums">{meta.k}</div><div className="text-xs text-muted-foreground">{meta.l}</div></div>
                  {meta.s ? <Sparkline data={meta.s} className="h-10 w-28" /> : null}
                </div>
              </Link>
            );
          })}
        </div>
        <Foot>Data refreshes automatically every 15 minutes. Use Sync in the top bar to pull the latest now.</Foot>
      </section>
    </div>
  );
}
