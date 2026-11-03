/* Forecasts — the predictive dashboard. Every number is projected from the demo history (see data/forecast.ts). */
import * as React from "react";
import { ComposedChart } from "@/components/overtrue/composed-chart";
import { BulletChart } from "@/components/overtrue/bullet-chart";
import { ModulePage } from "@/components/app/module";
import { DataTable, Grid, KpiRow, Panel, Pill, StagePill, Stat, type Col } from "@/components/app/kit";
import { AxisFrame } from "@/components/app/kit";
import { useApp } from "@/state/app";
import { useDrill } from "@/state/drill";
import { oStage, tStage, type Order, type Trip } from "@/data/data";
import { cr, fdt, fmtN } from "@/data/format";
import { cfaForecast, delayRisk, freightForecast, marginForecast, otifRisk, salesForecast, zoneForecasts } from "@/data/forecast";

const band = "color-mix(in oklab, var(--color-chart-2) 45%, transparent)";
const riskTone = (p: number): "error" | "warning" | "neutral" => (p >= 0.5 ? "error" : p >= 0.25 ? "warning" : "neutral");

export default function Forecasts() {
  const { otif } = useApp();
  const { openTrip, openOrders } = useDrill();
  const f = React.useMemo(() => ({ sales: salesForecast(), zones: zoneForecasts(), fr: freightForecast(), or: otifRisk(), dl: delayRisk(), cfa: cfaForecast(14), mg: marginForecast() }), []);
  const { sales, zones, fr, or, dl, cfa, mg } = f;
  const worstZone = [...zones].sort((a, b) => a.achievement - b.achievement)[0];

  const frData = [
    ...fr.hist.map((h, i) => ({ month: h.month, actual: +h.v.toFixed(2), forecast: i === fr.hist.length - 1 ? +h.v.toFixed(2) : null, lo: i === fr.hist.length - 1 ? +h.v.toFixed(2) : null, hi: i === fr.hist.length - 1 ? +h.v.toFixed(2) : null })),
    ...fr.next.map((n) => ({ month: n.month, actual: null, forecast: +n.v.toFixed(2), lo: +n.lo.toFixed(2), hi: +n.hi.toFixed(2) })),
  ];
  const cfaData = [
    ...cfa.hist.slice(-14).map((h) => ({ day: h.d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), actual: h.v, forecast: null as number | null })),
    ...cfa.next.map((n) => ({ day: n.day, actual: null as number | null, forecast: Math.round(n.v) })),
  ];
  const mgNextLabel = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  const mgData = [...mg.hist.map((h) => ({ month: h.month, margin: +h.v.toFixed(2), projected: null as number | null })), { month: "Next", margin: null as number | null, projected: +mg.nextMonth.toFixed(2) }];
  mgData[mgData.length - 2].projected = mgData[mgData.length - 2].margin;
  void mgNextLabel;

  const orderCols: Col<{ o: Order; p: number }>[] = [
    { id: "no", header: "Order", value: (r) => r.o.no, cell: (r) => <span className="font-mono text-xs font-medium">{r.o.no}</span> },
    { id: "dest", header: "Destination", value: (r) => r.o.dest },
    { id: "stage", header: "Stage", value: (r) => r.o.stage, cell: (r) => <StagePill s={oStage(r.o.stage)} /> },
    { id: "target", header: "OTIF due", value: (r) => +r.o.target, cell: (r) => fdt(r.o.target) },
    { id: "qty", header: "Cases", align: "right", value: (r) => r.o.qtyShown, cell: (r) => fmtN(r.o.qtyShown) },
    { id: "p", header: "Miss risk", align: "right", value: (r) => r.p, cell: (r) => <Pill tone={riskTone(r.p)}>{Math.round(r.p * 100)}%</Pill> },
  ];
  const tripCols: Col<{ t: Trip; p: number; eta: ReturnType<typeof delayRisk>["scored"][number]["eta"] }>[] = [
    { id: "id", header: "Trip", value: (r) => r.t.id, cell: (r) => <span className="font-mono text-xs font-medium">{r.t.id}</span> },
    { id: "route", header: "Route", value: (r) => `${r.t.loc} → ${r.t.dest}` },
    { id: "stage", header: "Stage", value: (r) => r.t.stageIdx, cell: (r) => <StagePill s={tStage(r.t.stage)} /> },
    { id: "leg", header: "Current leg", value: (r) => r.eta?.leg ?? "Final leg" },
    { id: "due", header: "Leg due", value: (r) => (r.eta ? +r.eta.due : 0), cell: (r) => (r.eta ? fdt(r.eta.due) : "On schedule") },
    { id: "tr", header: "Transporter", value: (r) => r.t.transporter },
    { id: "p", header: "Delay risk", align: "right", value: (r) => r.p, cell: (r) => <Pill tone={riskTone(r.p)}>{r.eta?.late ? `Late +${Math.round(r.eta.lateBy)} h` : `${Math.round(r.p * 100)}%`}</Pill> },
  ];

  return (
    <ModulePage moduleId="forecasts">
      <KpiRow className="xl:grid-cols-6">
        <Stat label="Sales landing" value={cr(sales.projected)} hint={`${(sales.achievement * 100).toFixed(1)}% of ${cr(sales.target)}`} sparkline={sales.series.map((s) => s.actual ?? s.forecast ?? 0)} />
        <Stat label="Chance to hit target" value={sales.pHit < 0.01 ? "<1%" : Math.round(sales.pHit * 100) + "%"} hint={`gap ${cr(Math.max(0, sales.target - sales.projected))}`} />
        <Stat label="OTIF at month-end" value={or.projectedOtif.toFixed(1) + "%"} hint={`now ${or.mtdOtif.toFixed(1)}% · target ${otif.green}%`} />
        <Stat label="Freight ₹/km next month" value={"₹" + fr.next[0].v.toFixed(1)} hint={`range ₹${fr.next[0].lo.toFixed(1)}–${fr.next[0].hi.toFixed(1)}`} sparkline={[...fr.hist.map((h) => h.v), ...fr.next.map((n) => n.v)]} />
        <Stat label="CFA cases · next 14 days" value={fmtN(Math.round(cfa.total))} hint={`${cfa.trend >= 1 ? "+" : ""}${((cfa.trend - 1) * 100).toFixed(0)}% trend vs prior 4 weeks`} sparkline={cfa.next.map((n) => n.v)} />
        <Stat label="E-com margin next month" value={mg.nextMonth.toFixed(1) + "%"} hint={`MTD ${mg.mtd.toFixed(1)}%`} sparkline={mgData.map((m) => m.margin ?? m.projected ?? 0)} />
      </KpiRow>

      <Grid>
        <Panel span={8} title="Secondary sales · month-end landing" description="Cumulative sales: actual to date, forecast with 80% band, and pro-rated target" info="Weekday pattern and month-end push learned from the last 12 weeks, applied to the current 14-day run rate. The band covers daily noise and run-rate uncertainty."
          insight={`Likely to land at {{metric:${cr(sales.projected)}|${(sales.achievement * 100).toFixed(1)}%|${sales.achievement >= 1 ? "positive" : "negative"}}} of target. Closing the gap needs {{metric:${cr(sales.needPerDay)}/day|vs ${cr(sales.expectedPerDay)} expected|negative}} for the last ${sales.daysLeft} days.`}>
          <div id="sales" />
          <AxisFrame y="Cumulative secondary sales (₹)" x="Day of the month"><ComposedChart data={sales.series} xKey="day" className="h-72" showYAxis showLegend yFormatter={(v) => "₹" + (v / 1e7).toFixed(0) + "Cr"}
            series={[
              { key: "actual", label: "Actual", type: "area", color: "var(--color-chart-1)" },
              { key: "hi", label: "High (80%)", type: "line", dashed: true, color: band },
              { key: "forecast", label: "Forecast", type: "line", dashed: true, color: "var(--color-chart-2)", dots: true },
              { key: "lo", label: "Low (80%)", type: "line", dashed: true, color: band },
              { key: "target", label: "Target pace", type: "line", color: "var(--color-chart-3)" },
            ]} /></AxisFrame>
        </Panel>
        <Panel span={4} title="Zone landing" description="Projected month-end achievement · tick = 100%"
          insight={`{{metric:${worstZone.zone}|${(worstZone.achievement * 100).toFixed(1)}%|negative}} is furthest from target — the push should start there.`}>
          <BulletChart size="compact" tone="status" valueFormatter={(v) => (v * 100).toFixed(1) + "%"}
            items={zones.map((z) => ({ id: z.full, label: z.zone, sublabel: `${cr(z.projected)} · ${z.pHit < 0.01 ? "<1" : Math.round(z.pHit * 100)}% chance`, value: z.achievement, target: 1, ranges: [0.9, 0.97, 1.1] as [number, number, number], max: 1.15 }))} />
        </Panel>

        <Panel span={6} title="Freight cost per km · next 3 months" description="Monthly ₹/km with a linear trend forecast and 80% band"
          insight={`Trend is {{metric:${fr.slope >= 0 ? "+" : "−"}₹${Math.abs(fr.slope).toFixed(2)}/km per month|${fr.slope > 0.05 ? "rising" : fr.slope < -0.05 ? "falling" : "flat"}|${fr.slope > 0.05 ? "negative" : "positive"}}}; next month ₹${fr.next[0].v.toFixed(1)}/km.`}>
          <AxisFrame y="Freight cost per km (₹)" x="Month · dashed = forecast with 80% range"><ComposedChart data={frData} xKey="month" className="h-64" showYAxis showLegend yFormatter={(v) => "₹" + v.toFixed(1)} yDomain="auto"
            series={[{ key: "actual", label: "Actual", type: "line", color: "var(--color-chart-1)", dots: true }, { key: "hi", label: "High", type: "line", dashed: true, color: band }, { key: "forecast", label: "Forecast", type: "line", dashed: true, color: "var(--color-chart-2)", dots: true }, { key: "lo", label: "Low", type: "line", dashed: true, color: band }]} /></AxisFrame>
        </Panel>
        <Panel span={6} title="CFA demand · next 14 days" description="Daily cases across all CFAs: last 14 days actual, next 14 days forecast"
          insight={`Expect about {{metric:${fmtN(Math.round(cfa.total))} cases|next 14 days|neutral}} — ${cfa.trend >= 1 ? "up" : "down"} ${Math.abs((cfa.trend - 1) * 100).toFixed(0)}% on the prior trend. Sundays run a half shift.`}>
          <AxisFrame y="Cases dispatched · all CFAs" x="Date · hatched = forecast"><ComposedChart data={cfaData} xKey="day" className="h-64" showYAxis showLegend yFormatter={(v) => (v / 1000).toFixed(0) + "k"}
            series={[{ key: "actual", label: "Actual", type: "bar", color: "var(--color-chart-1)" }, { key: "forecast", label: "Forecast", type: "bar", pattern: "hatched", color: "var(--color-chart-2)" }]} /></AxisFrame>
        </Panel>

        <Panel span={6} title="Orders likely to miss OTIF" description={`${or.scored.length} open orders scored by stage and how much of the OTIF window is used`} contentClassName="p-0"
          insight={or.high.length ? `{{metric:${or.high.length} orders|≥25% risk|negative}} — push indents and vehicle placement on these first.` : "No open order is above 25% risk."}>
          <div id="otif" />
          <DataTable rows={or.scored} cols={orderCols} pageSize={8} exportName="otif_risk" getRowId={(r) => r.o.no} onRowClick={(r) => openOrders(r.o.no, [r.o])} />
        </Panel>
        <Panel span={6} title="Trips likely to arrive late" description="Active trips scored by leg SLA, fleet type and GPS consent" contentClassName="p-0"
          insight={`{{metric:${dl.late.length} trips|late now|negative}} and {{metric:${dl.atRisk.length} more|likely in 24 h|negative}}. Market vehicles without GPS carry the most risk.`}>
          <div id="delay" />
          <DataTable rows={dl.scored.filter((s) => s.p >= 0.2)} cols={tripCols} pageSize={8} exportName="delay_risk" getRowId={(r) => r.t.id} onRowClick={(r) => openTrip(r.t)} />
        </Panel>

        <Panel span={12} title="E-com material margin · projection" description="Monthly material margin % with next month’s projection"
          insight={`Margin trends to {{metric:${mg.nextMonth.toFixed(1)}%|next month|${mg.nextMonth >= mg.mtd ? "positive" : "negative"}}} from ${mg.mtd.toFixed(1)}% MTD.`}>
          <div id="margin" />
          <AxisFrame y="Material margin (% of net sales)" x="Month · dashed = projection"><ComposedChart data={mgData} xKey="month" className="h-56" showYAxis showLegend yFormatter={(v) => v.toFixed(1) + "%"} yDomain="auto"
            series={[{ key: "margin", label: "Actual", type: "line", color: "var(--color-chart-1)", dots: true }, { key: "projected", label: "Projected", type: "line", dashed: true, color: "var(--color-chart-2)", dots: true }]} /></AxisFrame>
        </Panel>
      </Grid>
    </ModulePage>
  );
}
