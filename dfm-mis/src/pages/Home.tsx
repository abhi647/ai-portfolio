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
import { AxisFrame } from "@/components/app/kit";
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
import { DenseTable } from "@/components/app/dense";
import { ModuleTiles } from "@/components/app/ModuleTiles";
import { ExecScorecard, keyMessages } from "@/components/app/ExecScorecard";
import { SectionCard } from "@/components/overtrue/section-card";
import { PeriodTabs } from "@/components/overtrue/period-tabs";
import { FormSelect } from "@/components/ui/select";
import { IconFileAnalytics, IconPrinter } from "@tabler/icons-react";
import { usePersistentState } from "@/state/app";
import { PERIODS, evaluate, period, type CompareKey, type PeriodKey } from "@/data/kpis";
import { execute, type QuerySpec } from "@/ai/engine";

const MONTH_LABEL = MONTHS[5].label;
const sc = (dataset: string, measures: string[], dimension: string, mtdOnly = true): ReturnType<typeof execute> =>
  execute({ dataset, measures, dimension, series: null, filters: mtdOnly ? [{ field: "month", op: "in", values: [MONTH_LABEL] }] : [], sort: "desc", limit: null, chart: "table", title: "" } as QuerySpec);

function Scorecards() {
  const nav = useNavigate();
  const tr = React.useMemo(() => sc("trips", ["trips", "freight", "cost_per_km", "detention_rate", "tracking_rate", "shortage_rate", "avg_transit_h"], "transporter"), []);
  const plantT = React.useMemo(() => sc("trips", ["trips", "freight", "cost_per_km", "avg_plant_tat_h"], "plant"), []);
  const plantO = React.useMemo(() => sc("orders", ["orders", "otif_pct", "avg_approval_to_dispatch_h"], "plant"), []);
  const region = React.useMemo(() => sc("sales", ["sales", "target", "achievement_pct", "gap_to_target"], "region"), []);
  const zoneOf = React.useMemo(() => Object.fromEntries(ASMS.map((a) => [a.region, a.zone.split(" – ")[0]])), []);
  // Orders are booked per plant (Greater Noida / Ghaziabad); trips per dispatch location (GN, GZB, C-37 GZB).
  const site = (code: string) => (code === "GN" ? "Greater Noida" : "Ghaziabad");
  const plants = plantT.rows.map((r) => ({ label: r.label, sub: site(r.label), values: { ...r.values, ...(plantO.rows.find((o) => o.label === site(r.label))?.values ?? {}) } }));
  return (
    <Grid>
      <Panel span={8} title={`Transporter scorecard · ${MONTH_LABEL}`} description="Best and worst quartile highlighted · click a column to sort · click a row for the transporter view" contentClassName="p-0"
        actions={<Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => nav("/explore/pivot")}>Pivot</Button>}>
        <DenseTable rank maxHeight={344} dimLabel="Transporter" initialSort={{ key: "freight", dir: "desc" }} onRowClick={() => nav("/trips/transporters")}
          rows={tr.rows.map((r) => ({ label: r.label, values: r.values }))} total={tr.totals}
          cols={[
            { key: "trips", label: "Trips", format: "number" }, { key: "freight", label: "Freight", format: "inr", bar: true },
            { key: "cost_per_km", label: "₹/km", format: "inr_per_km", higherIsBetter: false }, { key: "detention_rate", label: "Detention", format: "pct", higherIsBetter: false },
            { key: "tracking_rate", label: "Tracked", format: "pct", higherIsBetter: true }, { key: "shortage_rate", label: "Shortage", format: "pct", higherIsBetter: false },
            { key: "avg_transit_h", label: "Transit", format: "hours", higherIsBetter: false },
          ]} />
      </Panel>
      <Panel span={4} title={`Plant scorecard · ${MONTH_LABEL}`} description="Trips and orders by supply location" contentClassName="p-0">
        <DenseTable dimLabel="Plant" maxHeight={344} rows={plants} initialSort={{ key: "freight", dir: "desc" }} onRowClick={() => nav("/orders/otif")}
          cols={[
            { key: "trips", label: "Trips", format: "number" }, { key: "cost_per_km", label: "₹/km", format: "inr_per_km" },
            { key: "otif_pct", label: "Plant OTIF", format: "pct" }, { key: "avg_plant_tat_h", label: "Plant TAT", format: "hours" }, { key: "avg_approval_to_dispatch_h", label: "Order→disp.", format: "hours" },
          ]} />
      </Panel>
      <Panel span={12} title={`Region sales scorecard · ${MONTH_LABEL}`} description="Secondary sales vs pro-rated target, month to date" contentClassName="p-0"
        actions={<Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => nav("/sales/team")}>Sales detail</Button>}>
        <DenseTable rank dimLabel="Region" maxHeight={300} initialSort={{ key: "achievement_pct", dir: "asc" }} onRowClick={() => nav("/sales/team")}
          rows={region.rows.map((r) => ({ label: r.label, sub: zoneOf[r.label], values: r.values }))} total={region.totals}
          cols={[
            { key: "sales", label: "Sales", format: "inr", bar: true }, { key: "target", label: "Target", format: "inr" },
            { key: "achievement_pct", label: "Achievement", format: "pct", higherIsBetter: true }, { key: "gap_to_target", label: "Gap to target", format: "inr", higherIsBetter: false },
          ]} />
      </Panel>
    </Grid>
  );
}

const ALERTS = computeAlerts();
const C2 = "var(--color-chart-1)";

export default function Home() {
  const [periodKey, setPeriodKey] = usePersistentState<PeriodKey>("exec.period", "mtd");
  const [compare, setCompare] = usePersistentState<CompareKey>("exec.compare", "target");
  const per = React.useMemo(() => period(periodKey), [periodKey]);
  const results = React.useMemo(() => evaluate(per, compare), [per, compare]);
  const msgs = React.useMemo(() => keyMessages(results), [results]);
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
    <div className="flex flex-col gap-[var(--page-gap)]">
      <PageHeader
        eyebrow="Executive overview · DFM Foods Ltd"
        title="Business performance"
        description={`${per.long} · variance against ${compare === "target" ? "target (FY27 AOP)" : "the prior period"} · all plants, all zones · data as of ${NOW.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} IST`}
        actions={
          <div className="flex flex-wrap items-center gap-2" data-print="hide">
            <PeriodTabs size="sm" aria-label="Reporting period" options={PERIODS.map((p) => ({ value: p.key, label: p.label }))} value={periodKey} onValueChange={(v: string) => setPeriodKey(v as PeriodKey)} />
            <FormSelect aria-label="Compare with" value={compare} onChange={(e) => setCompare(e.target.value as CompareKey)} className="h-8 w-40 rounded-md px-2.5 text-[13px]">
              <option value="target">vs Target (AOP)</option><option value="prior">vs Prior period</option>
            </FormSelect>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.print()}><IconPrinter className="size-4" />Print / PDF</Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => nav("/reports/mis")}><IconFileAnalytics className="size-4" />MIS pack</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-[var(--grid-gap)] xl:grid-cols-12">
        <ExecScorecard className="xl:col-span-12" results={results} period={per} compare={compare} />
        <SectionCard className="xl:col-span-12" title="Key messages" description="Largest misses and wins against target this period" contentClassName="grid grid-cols-1 gap-x-8 gap-y-4 p-4 lg:grid-cols-2">
          <div>
            <div className="eyebrow mb-2">Needs action</div>
            <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
              {msgs.misses.length ? msgs.misses.map(({ r, text }, i) => (
                <li key={r.def.key} className="flex gap-2.5 text-[13px] leading-5"><span className="flex size-5 shrink-0 items-center justify-center rounded bg-rose-500/10 text-[11px] font-semibold text-rose-700 dark:text-rose-400">{i + 1}</span><span>{text}</span></li>
              )) : <li className="text-[13px] text-muted-foreground">No KPI is off target this period.</li>}
            </ol>
          </div>
          <div>
            <div className="eyebrow mb-2">Ahead of plan</div>
            <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
              {msgs.wins.map(({ r, text }, i) => (
                <li key={r.def.key} className="flex gap-2.5 text-[13px] leading-5"><span className="flex size-5 shrink-0 items-center justify-center rounded bg-emerald-500/10 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">{i + 1}</span><span>{text}</span></li>
              ))}
            </ol>
          </div>
          <div className="border-t border-border pt-3 text-xs leading-5 text-muted-foreground lg:col-span-2">
            Status rule: green meets target; amber is within tolerance (shown on each KPI); red is outside tolerance. Targets are the FY27 annual operating plan.
          </div>
        </SectionCard>
      </div>

      <ModuleTiles />

      <Scorecards />

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
          <AxisFrame y="Secondary sales (₹)" x="Day · last 14 days"><ComposedChart
            data={dailyTrend}
            xKey="day"
            series={[{ key: "sales", label: "Sales", type: "bar" }, { key: "target", label: "Daily target", type: "line", dashed: true, color: "var(--color-chart-3)" }]}
            showYAxis
            showLegend
            yFormatter={crAxis}
            className="h-80"
          /></AxisFrame>
        </Panel>
        <Panel span={4} title="Zone achievement · MTD" description="Bar = achievement, tick = 100% of target" info="Achievement = MTD secondary sales ÷ pro-rated MTD target."
          insight={`{{metric:${worstZone.label}|${(worstZone.value * 100).toFixed(0)}%|negative}} needs the most help to close the month.`}>
          <BulletChart items={zoneItems} valueFormatter={(v) => (v * 100).toFixed(0) + "%"} tone="status" size="compact" />
        </Panel>

        <Panel span={12} title="Service vs cost · last 6 months" description="OTIF % (line, right axis) against freight cost per km (bars) — are we buying service with money?"
          info="Plotting cost and service together shows the trade-off a single metric hides."
          insight={(() => { const a = monthly[4], b = monthly[3]; return `In ${a.month} cost per km moved {{metric:₹${(a.perKm - b.perKm).toFixed(1)}|${a.perKm > b.perKm ? "up" : "down"}|${a.perKm > b.perKm ? "negative" : "positive"}}} while OTIF moved {{metric:${(a.otif - b.otif).toFixed(1)} pts|${a.otif >= b.otif ? "up" : "down"}|${a.otif >= b.otif ? "positive" : "negative"}}} — ${a.perKm > b.perKm && a.otif < b.otif ? "paying more for worse service; review market-vehicle usage." : "a healthy trade-off."}`; })()}>
          <AxisFrame y="Freight cost per km (₹) · bars" y2="OTIF (%) · line" x="Month"><ComposedChart data={monthly} xKey="month" showYAxis showLegend className="h-64" yFormatter={(v) => "₹" + v} rightYFormatter={(v) => v + "%"} yDomain="auto"
            series={[{ key: "perKm", label: "₹ / km", type: "bar", color: C2 }, { key: "otif", label: "OTIF %", type: "line", axis: "right", color: "var(--color-chart-2)", dots: true }]} /></AxisFrame>
        </Panel>
      </Grid>

      <Foot>Data refreshes automatically every 15 minutes. Use Sync in the top bar to pull the latest now.</Foot>
    </div>
  );
}
