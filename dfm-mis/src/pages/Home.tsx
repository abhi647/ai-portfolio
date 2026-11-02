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
import { InsightCard } from "@/components/overtrue/insight-card";
import { TrendChart } from "@/components/overtrue/trend-chart";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Grid, Panel, Foot } from "@/components/app/kit";
import { tripEta } from "@/pages/trips/timeline";
import { MODULES } from "@/nav";
import { useApp } from "@/state/app";
import { useDrill } from "@/state/drill";
import { ACCOUNTS, ASMS, CFAS, CUR_MONTH, MONTHS, NOW, TSTAGES, ZONES, cfaQty, orders, plSum, today0, trips } from "@/data/data";
import { DAY, cr, crAxis, fdDay, fmtN, pct, pctv, sum } from "@/data/format";
import { asmDay, asmTarget } from "@/data/data";
import { asmPeriod, asmPeriodTarget, monthContext, periodRange } from "@/data/sales";
import { computeAlerts } from "@/data/insights";
import { cn } from "@/lib/utils";

const ALERTS = computeAlerts();
const C2 = "var(--color-chart-1)";

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

  const late = active.filter((t) => tripEta(t)?.late);
  const worstZone = [...zoneItems].sort((a, b) => a.value - b.value)[0];
  const monthly = MONTHS.map((m) => {
    const ts = trips.filter((t) => t.mk === m.key && t.ms.gateOut);
    const os = orders.filter((o) => o.mk === m.key && o.otif != null);
    return { month: m.label, perKm: +(sum(ts, "total") / (sum(ts, "km") || 1)).toFixed(1), otif: +(pctv(sum(os, (o) => o.otif! * o.qty), sum(os, "qty"))).toFixed(1) };
  });
  const briefing = [
    `Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}. Secondary sales are at {{metric:${pct(mc.mtd.sales, mc.mTarget, 0)} of the month target|${cr(mc.mtd.sales)}|neutral}} with ${mc.daysLeft} days left, so the team needs {{metric:${cr(mc.required)}/day|+${pct(mc.required - mc.runRate, mc.runRate, 0)} vs today|negative}} {{cite:1}}.`,
    `${worstZone.label} is the weakest zone at {{metric:${(worstZone.value * 100).toFixed(0)}%|of target|negative}}.`,
    `On supply, MTD OTIF is {{metric:${(otifV * 100).toFixed(1)}%|vs ${otif.green}% target|${otifV * 100 >= otif.green ? "positive" : "negative"}}} and {{metric:${late.length} trips|behind plan|negative}} on the trip timeline {{cite:2}}.`,
    `Watch ePOD closures — ${pct(active.filter((t) => t.stage === "unloaded").length, active.length, 0)} of the active board is waiting on them, which also delays transporter payments.`,
  ].join(" ");
  const makeStream = React.useCallback(() => (async function* () {
    await new Promise((r) => setTimeout(r, 500));
    for (const w of briefing.split(/(?<= )/)) { yield w; await new Promise((r) => setTimeout(r, 18)); }
  })(), [briefing]);
  const [stream, setStream] = React.useState<AsyncIterable<string>>(() => makeStream());

  return (
    <div className="flex flex-col gap-6">
      <Grid>
        <section className="surface-card relative overflow-hidden lg:col-span-8 animate-rise">
          <img src="/brand/crax-range.webp" alt="The CRAX product range" className="absolute inset-y-0 right-0 hidden h-full w-[50%] object-cover object-[20%_center] md:block" />
          <div aria-hidden className="absolute inset-0 hidden bg-[linear-gradient(90deg,var(--color-card)_50%,color-mix(in_oklab,var(--color-card)_60%,transparent)_62%,transparent_80%)] md:block" />
          <div className="relative flex h-full flex-col gap-6 p-6 md:max-w-[56%]">
            <PageHeader
              eyebrow={NOW.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) + " · " + NOW.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}
              title={`Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, ${first}`}
              description={`${ALERTS.length} things need attention today. Everything else is on track.`}
            />
            <dl className="mt-auto grid grid-cols-3 gap-4 border-t border-border/60 pt-4">
              {[
                ["Active trips", fmtN(active.length), `${late.length} behind plan`],
                ["Open orders", fmtN(orders.filter((o) => o.stage !== "dispatched" && (+NOW - +o.approved) / DAY <= 30).length), "last 30 days"],
                ["E-com margin", ((pnlMtd.materialMargin / pnlMtd.netSales) * 100).toFixed(1) + "%", "MTD material"],
              ].map(([l, v, c]) => (
                <div key={l} className="min-w-0"><dt className="text-xs text-muted-foreground">{l}</dt><dd className="m-0 mt-1 text-xl font-semibold tracking-[-0.02em] tabular-nums">{v}</dd><dd className="m-0 text-xs text-muted-foreground">{c}</dd></div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => nav("/trips/timeline")} className="gap-1.5">Open trip timeline <IconArrowRight className="size-4" /></Button>
              <Button variant="outline" onClick={() => nav("/sales/team")}>Sales vs target</Button>
            </div>
          </div>
        </section>
        <InsightCard
          className="lg:col-span-4 animate-rise"
          title="Today’s briefing"
          source="Generated from today’s TMS, DMS and ERP data"
          stream={stream}
          sources={[{ id: "1", label: "DMS secondary sales", href: "/sales/team" }, { id: "2", label: "Traqo TMS trips", href: "/trips/timeline" }]}
          onRegenerate={() => setStream(makeStream())}
        />
      </Grid>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Dispatched today" value={today.length} deltaLabel={`so far today · ${fmtN(sum(today, "invQty"))} cases · 7-day avg ${avg7.toFixed(1)}/day`} sparkline={dispByDay.map((r) => r.length)}
          className="cursor-pointer" onClick={() => openTrips("Dispatched today", today)} />
        <KpiCard label="MTD secondary sales" value={cr(mc.mtd.sales)} delta={mc.mtd.target ? mc.mtd.sales / mc.mtd.target - 1 : 0} deltaLabel={`vs pro-rated target · ${pct(mc.mtd.sales, mc.mTarget)} of month`} sparkline={salesDaily}
          className="cursor-pointer" onClick={() => nav("/sales/team")} />
        <KpiCard label="MTD OTIF" value={(otifV * 100).toFixed(1) + "%"} delta={otifV - otif.green / 100} deltaLabel={`vs ${otif.green}% target · ${mtdOrders.length} eligible orders`} sparkline={monthly.map((m) => m.otif)}
          className="cursor-pointer" onClick={() => nav("/orders/otif")} />
        <KpiCard label="MTD freight spend" value={cr(mtdFreight)} deltaLabel={`₹${(mtdFreight / (sum(trips.filter((t) => t.mk === CUR_MONTH), "km") || 1)).toFixed(1)} per km · ${fmtN(trips.filter((t) => t.mk === CUR_MONTH).length)} trips`} sparkline={monthly.map((m) => m.perKm)} invertDelta
          className="cursor-pointer" onClick={() => nav("/trips/costing")} />
      </div>

      <Grid>
        <Panel span={7} title="Needs attention" description="Generated from live data — click to jump to the exact view" contentClassName="p-0">
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
            {late.length ? (
              <li>
                <Link to="/trips/timeline" className="group flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-muted/50">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400"><IconAlertTriangle className="size-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{late.length} trips behind plan on the timeline</span><span className="block text-[13px] text-muted-foreground">Leg SLAs exceeded — see the Gantt for where they are stuck.</span></span>
                  <IconArrowRight className="mt-2 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ) : null}
            {!ALERTS.length && <li className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground"><IconCircleCheck className="size-4 text-emerald-500" /> All clear.</li>}
          </ul>
        </Panel>

        <Panel span={5} title="Active trip pipeline" description={`${fmtN(active.length)} trips not yet ePOD-closed`} actions={<StatusBadge variant="success" live>Live</StatusBadge>}
          insight={`{{metric:${flow[4].length} orders|dispatched today|positive}} against ${flow[0].length} approved — the plant is clearing older backlog.`}>
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
          </div>
        </Panel>

        <Panel span={8} title="Daily secondary sales vs target run-rate" description="Last 14 days · bars are actual sales, dashed line is the daily target pace"
          insight={(() => { const above = dailyTrend.filter((d) => d.sales >= d.target).length; return `Sales beat the daily target pace on {{metric:${above} of 14 days|${pct(above, 14, 0)}|${above >= 7 ? "positive" : "negative"}}}. The last two days show the month-end push kicking in.`; })()}>
          <ComposedChart
            data={dailyTrend}
            xKey="day"
            series={[{ key: "sales", label: "Sales", type: "bar" }, { key: "target", label: "Daily target", type: "line", dashed: true, color: "var(--color-chart-3)" }]}
            showYAxis
            showLegend
            yFormatter={crAxis}
            className="h-80"
          />
        </Panel>
        <Panel span={4} title="Zone achievement · MTD" description="Bar = achievement, tick = 100% of target" info="Achievement = MTD secondary sales ÷ pro-rated MTD target."
          insight={`{{metric:${worstZone.label}|${(worstZone.value * 100).toFixed(0)}%|negative}} needs the most help to close the month.`}>
          <BulletChart items={zoneItems} valueFormatter={(v) => (v * 100).toFixed(0) + "%"} tone="status" size="compact" />
        </Panel>

        <Panel span={12} title="Service vs cost · last 6 months" description="OTIF % (line, right axis) against freight cost per km (bars) — are we buying service with money?"
          info="Plotting cost and service together shows the trade-off a single metric hides."
          insight={(() => { const a = monthly[4], b = monthly[3]; return `In ${a.month} cost per km moved {{metric:₹${(a.perKm - b.perKm).toFixed(1)}|${a.perKm > b.perKm ? "up" : "down"}|${a.perKm > b.perKm ? "negative" : "positive"}}} while OTIF moved {{metric:${(a.otif - b.otif).toFixed(1)} pts|${a.otif >= b.otif ? "up" : "down"}|${a.otif >= b.otif ? "positive" : "negative"}}} — ${a.perKm > b.perKm && a.otif < b.otif ? "paying more for worse service; review market-vehicle usage." : "a healthy trade-off."}`; })()}>
          <ComposedChart data={monthly} xKey="month" showYAxis showLegend className="h-64" yFormatter={(v) => "₹" + v} rightYFormatter={(v) => v + "%"} yDomain="auto"
            series={[{ key: "perKm", label: "₹ / km", type: "bar", color: C2 }, { key: "otif", label: "OTIF %", type: "line", axis: "right", color: "var(--color-chart-2)", dots: true }]} />
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
