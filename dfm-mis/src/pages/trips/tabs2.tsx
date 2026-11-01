import * as React from "react";
import { TrendChart } from "@/components/overtrue/trend-chart";
import { ComposedChart } from "@/components/overtrue/composed-chart";
import { BarList } from "@/components/overtrue/bar-list";
import { HeatmapChart } from "@/components/overtrue/heatmap-chart";
import { ScatterChart } from "@/components/overtrue/scatter-chart";
import { RadialGauge } from "@/components/overtrue/radial-gauge";
import { DataTable, Foot, Grid, KpiRow, LinkCell, Num, Panel, Pill, Stat, Toggle, type Col } from "@/components/app/kit";
import { MonthlyStack, MonthlyWithRate } from "@/components/app/charts";
import { useDrill } from "@/state/drill";
import { C } from "@/data/colors";
import { MONTHS, TR_CONTRACT, type Trip } from "@/data/data";
import { avg, cr, crAxis, fmtN, groupBy, inr, pct, pctv, sum } from "@/data/format";

type P = { rows: Trip[] };

/* -------------------------------- Detention ------------------------------- */
export function Detention({ rows: all }: P) {
  const { openTrips } = useDrill();
  const [m, setM] = React.useState<"count" | "cost">("cost");
  const rows = all.filter((r) => r.epodDone);
  const det = rows.filter((r) => r.actDet > 0);
  const sys = rows.filter((r) => r.sysDet > 0);
  const destTop = [...groupBy(det, (r) => r.dest).entries()].sort((a, b) => sum(b[1], "actDet") - sum(a[1], "actDet")).slice(0, 12);
  const avs = MONTHS.map((mm, i) => ({ month: mm.label, __i: i, sys: sum(sys.filter((r) => r.mk === mm.key), "sysDet"), act: sum(det.filter((r) => r.mk === mm.key), "actDet") }))
    .map((d) => ({ ...d, ratio: d.sys ? (d.act / d.sys) * 100 : null }));
  return (
    <>
      <KpiRow>
        <Stat label="Trips with detention" value={sys.length} hint={pct(sys.length, rows.length) + " of ePOD trips"} onClick={() => openTrips("Trips with detention", sys)} />
        <Stat label="Actual detention cost" value={cr(sum(det, "actDet"))} color={C.bad} />
        <Stat label="System computed" value={cr(sum(sys, "sysDet"))} color={C.c3} />
        <Stat label="Claimed vs system" value={pct(sum(det, "actDet"), sum(sys, "sysDet"))} hint="Lower = better negotiation" />
        <Stat label="Avg detention / trip" value={inr(avg(det, "actDet"))} />
      </KpiRow>
      <Grid>
        <Panel title="ePOD trips with vs without detention" description="Line: detention incidence % (right axis)">
          <MonthlyWithRate rows={rows} onDrill={openTrips} rate={(rs) => (rs.length ? pctv(rs.filter((r) => r.sysDet > 0).length, rs.length) : null)} rateLabel="% with detention"
            cats={[{ label: "With detention", color: C.bad, pred: (r) => r.sysDet > 0 }, { label: "Without", color: C.c2, pred: (r) => !r.sysDet }]} />
        </Panel>
        <Panel title="Actual vs system-computed detention" description="Bars in ₹ · line: claimed as % of system (right axis)">
          <ComposedChart data={avs} xKey="month" showYAxis showLegend yFormatter={crAxis} rightYFormatter={(v) => v.toFixed(0) + "%"} className="h-72"
            series={[{ key: "sys", label: "System computed", type: "bar", color: C.c3 }, { key: "act", label: "Actual (claimed)", type: "bar", color: C.bad }, { key: "ratio", label: "Claimed %", type: "line", axis: "right", color: "var(--color-foreground)", dots: true }]}
            onBarClick={(row, key) => openTrips(`${key === "sys" ? "System detention" : "Claimed detention"} · ${row.month}`, (key === "sys" ? sys : det).filter((r) => r.mk === MONTHS[Number(row.__i)].key))} />
        </Panel>
        <Panel title="Detained trips · tracked vs untracked" info="Untracked detention can’t be verified against GPS dwell time."
          actions={<Toggle label="Measure" value={m} onChange={setM} options={[["count", "Trips"], ["cost", "₹ Cost"]]} />}>
          <MonthlyStack rows={det} onDrill={openTrips} agg={m === "cost" ? (rs) => sum(rs, "actDet") : undefined} fmt={m === "cost" ? crAxis : fmtN}
            cats={[{ label: "Tracked", color: C.c2, pred: (r) => r.consent === "ALLOWED" }, { label: "Untracked", color: C.muted, pred: (r) => r.consent !== "ALLOWED" }]} />
        </Panel>
        <Panel title="Detention cost by payment status">
          <MonthlyStack rows={det} onDrill={openTrips} agg={(rs) => sum(rs, "actDet")} fmt={crAxis} cats={[{ label: "Paid", color: C.good, pred: (r) => r.payStatus === "Paid" }, { label: "Unpaid", color: C.bad, pred: (r) => r.payStatus !== "Paid" }]} />
        </Panel>
      </Grid>
      <Panel title="Destination × month detention charges" description="Top 12 destinations by claimed detention. Darker = higher cost. Click a cell for its trips.">
        <HeatmapChart
          rows={destTop.map(([d, rs]) => ({ label: d, values: MONTHS.map((mm) => sum(rs.filter((x) => x.mk === mm.key), "actDet")) }))}
          columns={MONTHS.map((mm) => mm.label)}
          color="var(--color-destructive)"
          valueFormatter={(v) => (v ? inr(v) : "–")}
          onCellClick={(c) => openTrips(`Detention · ${c.rowLabel} · ${c.columnLabel}`, destTop[c.row][1].filter((x) => x.mk === MONTHS[c.column].key))}
          maxCellHeight={34}
        />
      </Panel>
    </>
  );
}

/* ------------------------------ Transporters ------------------------------ */
export function Transporters({ rows }: P) {
  const { openTrips } = useDrill();
  const [m, setM] = React.useState<"count" | "value">("count");
  const isF = m === "value";
  const g = [...groupBy(rows, (r) => r.transporter).entries()].sort((a, b) => (isF ? sum(b[1], "total") - sum(a[1], "total") : b[1].length - a[1].length));
  type Row = [string, Trip[]];
  const sc = (rs: Trip[]) => ({
    track: pctv(rs.filter((r) => r.consent === "ALLOWED").length, rs.length),
    det: pctv(rs.filter((r) => r.sysDet).length, rs.filter((r) => r.epodDone).length),
    short: pctv(rs.filter((r) => r.shortQty).length, rs.filter((r) => r.stage === "epod_done" || r.stage === "unloaded").length),
    transit: avg(rs.filter((r) => r.tTransit), (r) => r.tTransit!),
    perKm: sum(rs, "total") / (sum(rs, "km") || 1),
  });
  const cols: Col<Row>[] = [
    { id: "n", header: "Transporter", value: (r) => r[0], cell: (r) => <span className="font-medium">{r[0]}</span> },
    { id: "t", header: "Type", value: (r) => (TR_CONTRACT.includes(r[0]) ? "Contracted" : "Market"), cell: (r) => (TR_CONTRACT.includes(r[0]) ? <Pill tone="info">Contracted</Pill> : <Pill>Market</Pill>) },
    { id: "trips", header: "Trips", align: "right", value: (r) => r[1].length, cell: (r) => <LinkCell onClick={() => openTrips(r[0], r[1])}>{fmtN(r[1].length)}</LinkCell> },
    { id: "f", header: "Freight", align: "right", value: (r) => sum(r[1], "total"), cell: (r) => cr(sum(r[1], "total")) },
    { id: "km", header: "₹ / km", align: "right", value: (r) => sc(r[1]).perKm, cell: (r) => "₹" + sc(r[1]).perKm.toFixed(1) },
    { id: "tr", header: "Tracking", align: "right", value: (r) => sc(r[1]).track, cell: (r) => <Num tone={sc(r[1]).track >= 60 ? "good" : sc(r[1]).track >= 45 ? "warn" : "bad"}>{sc(r[1]).track.toFixed(0)}%</Num> },
    { id: "det", header: "Detention", align: "right", value: (r) => sc(r[1]).det, cell: (r) => sc(r[1]).det.toFixed(0) + "%" },
    { id: "sh", header: "Shortage", align: "right", value: (r) => sc(r[1]).short, cell: (r) => sc(r[1]).short.toFixed(1) + "%" },
    { id: "tt", header: "Avg transit", align: "right", value: (r) => sc(r[1]).transit, cell: (r) => sc(r[1]).transit.toFixed(1) + " h" },
    ...MONTHS.map((mm) => ({ id: mm.key, header: mm.label, align: "right" as const, value: (r: Row) => { const rs = r[1].filter((x) => x.mk === mm.key); return isF ? sum(rs, "total") : rs.length; }, cell: (r: Row) => { const rs = r[1].filter((x) => x.mk === mm.key); return isF ? cr(sum(rs, "total")) : fmtN(rs.length); } })),
  ];
  const scatter = (own: boolean) => g.filter((x) => TR_CONTRACT.includes(x[0]) === own).map(([n, rs]) => ({ name: n, perKm: +sc(rs).perKm.toFixed(1), track: +sc(rs).track.toFixed(1), trips: rs.length }));
  return (
    <>
      <Grid>
        <Panel title="Transporter ranking" description="Click a transporter for its trips" actions={<Toggle label="Measure" value={m} onChange={setM} options={[["count", "Trips"], ["value", "₹ Freight"]]} />}>
          <BarList data={g.map(([n, rs]) => ({ name: n, value: isF ? sum(rs, "total") : rs.length }))} valueFormatter={isF ? cr : fmtN} showPercentage onItemClick={(i) => openTrips(i.name, g.find((x) => x[0] === i.name)![1])} />
        </Panel>
        <Panel title="Cost vs tracking compliance" description="Each dot is a transporter · size = trips. Bottom-right is best: cheap and tracked." info="Helps pick which market transporters to convert to contracts.">
          <ScatterChart xKey="perKm" yKey="track" sizeKey="trips" nameKey="name" xLabel="₹ / km" yLabel="% tracked" sizeLabel="Trips" showAxisLabels showLegend
            xFormatter={(v) => "₹" + v} yFormatter={(v) => v + "%"} className="h-80"
            series={[{ label: "Contracted", data: scatter(true), color: C.c1 }, { label: "Market", data: scatter(false), color: C.orange }]} />
        </Panel>
      </Grid>
      <Panel title="Contracted vs market share by month">
        <MonthlyWithRate rows={rows} onDrill={openTrips} rate={(rs) => (rs.length ? pctv(rs.filter((r) => r.own === "Contracted").length, rs.length) : null)} rateLabel="% contracted"
          cats={[{ label: "Contracted", color: C.c1, pred: (r) => r.own === "Contracted" }, { label: "Market", color: C.orange, pred: (r) => r.own === "Market" }]} />
      </Panel>
      <Panel title="Transporter scorecard" description="Sort any column · click trips to drill in">
        <DataTable rows={g} cols={cols} pageSize={15} exportName="transporter-scorecard" getRowId={(r) => r[0]} />
      </Panel>
    </>
  );
}

/* ------------------------------ Destinations ------------------------------ */
export function Destinations({ rows }: P) {
  const { openTrips } = useDrill();
  const g = [...groupBy(rows, (r) => r.dest).entries()].sort((a, b) => b[1].length - a[1].length);
  const top = g.slice(0, 12);
  const topData = top.map(([d, rs]) => ({ dest: d, c: rs.filter((r) => r.own === "Contracted").length, m: rs.filter((r) => r.own === "Market").length }));
  const ct = top.map(([d, rs]) => { const c = rs.filter((r) => r.tEpod != null); return { dest: d, t1: +avg(c, (r) => r.tPlant!).toFixed(1), t2: +avg(c, (r) => r.tTransit!).toFixed(1), t3: +avg(c, (r) => r.tDest!).toFixed(1), t4: +avg(c, (r) => r.tEpod!).toFixed(1) }; });
  type Row = [string, Trip[]];
  const cols: Col<Row>[] = [
    { id: "d", header: "Destination", value: (r) => r[0], cell: (r) => <span className="font-medium">{r[0]}</span> },
    { id: "t", header: "Trips", align: "right", value: (r) => r[1].length, cell: (r) => <LinkCell onClick={() => openTrips(r[0], r[1])}>{r[1].length}</LinkCell> },
    { id: "km", header: "Avg km", align: "right", value: (r) => avg(r[1], "km"), cell: (r) => fmtN(avg(r[1], "km")) },
    { id: "f", header: "Freight", align: "right", value: (r) => sum(r[1], "total"), cell: (r) => cr(sum(r[1], "total")) },
    { id: "af", header: "Freight / trip", align: "right", value: (r) => avg(r[1], "total"), cell: (r) => inr(avg(r[1], "total")) },
    { id: "c", header: "Cases", align: "right", value: (r) => sum(r[1], "invQty"), cell: (r) => fmtN(sum(r[1], "invQty")) },
    { id: "tr", header: "Avg transit", align: "right", value: (r) => avg(r[1].filter((x) => x.tTransit), (x) => x.tTransit!), cell: (r) => avg(r[1].filter((x) => x.tTransit), (x) => x.tTransit!).toFixed(1) + " h" },
    { id: "det", header: "Detention trips", align: "right", value: (r) => r[1].filter((x) => x.sysDet).length },
    { id: "cu", header: "Customers", align: "right", value: (r) => new Set(r[1].map((x) => x.customer)).size },
  ];
  return (
    <>
      <Grid>
        <Panel title="Top destinations by trips">
          <TrendChart data={topData} xKey="dest" type="bar" layout="horizontal" stacked showLegend className="h-[380px]"
            series={[{ key: "c", label: "Contracted", color: C.c1 }, { key: "m", label: "Market", color: C.orange }]}
            onBarClick={(row, key) => openTrips(`${row.dest} · ${key === "c" ? "Contracted" : "Market"}`, g.find((x) => x[0] === row.dest)![1].filter((r) => r.own === (key === "c" ? "Contracted" : "Market")))} />
        </Panel>
        <Panel title="Cycle time by destination" description="Average hours per leg for closed trips" info="T1 reporting → gate-out · T2 gate-out → destination · T3 destination dwell · T4 unload → ePOD.">
          <TrendChart data={ct} xKey="dest" type="bar" layout="horizontal" stacked showLegend className="h-[380px]" yFormatter={(v) => v.toFixed(1) + " h"}
            series={[{ key: "t1", label: "T1 Plant", color: C.orange }, { key: "t2", label: "T2 Transit", color: C.c1 }, { key: "t3", label: "T3 Destination", color: C.c4 }, { key: "t4", label: "T4 ePOD", color: C.muted }]} />
        </Panel>
      </Grid>
      <Panel title="Destination summary">
        <DataTable rows={g} cols={cols} pageSize={15} exportName="destination-summary" getRowId={(r) => r[0]} />
      </Panel>
    </>
  );
}

/* --------------------------- Dispatch accuracy ---------------------------- */
export function Accuracy({ rows: all }: P) {
  const { openTrips } = useDrill();
  const rows = all.filter((r) => ["unloaded", "epod_done"].includes(r.stage));
  const sh = rows.filter((r) => r.shortQty), ex = rows.filter((r) => r.excessQty);
  const acc = rows.length - sh.length - ex.length;
  const byTr = [...groupBy(sh, (r) => r.transporter).entries()].sort((a, b) => b[1].length - a[1].length);
  return (
    <>
      <KpiRow>
        <Stat label="Delivered trips" value={rows.length} />
        <Stat label="Dispatch accuracy" value={pct(acc, rows.length)} hint="No shortage or excess at ePOD" />
        <Stat label="Trips with shortage" value={sh.length} color={C.bad} hint={fmtN(sum(sh, "shortQty")) + " cases short"} onClick={() => openTrips("Trips with shortage", sh)} />
        <Stat label="Trips with excess" value={ex.length} color={C.c3} hint={fmtN(sum(ex, "excessQty")) + " cases excess"} onClick={() => openTrips("Trips with excess", ex)} />
        <Stat label="Shortage penalty recovered" value={inr(sum(sh, "shortPen"))} />
      </KpiRow>
      <Panel title="Monthly dispatch accuracy" description="Bars: delivered trips by outcome · line: accuracy % (right axis)">
        <MonthlyWithRate rows={rows} onDrill={openTrips} rateLabel="Accuracy %" rate={(rs) => (rs.length ? pctv(rs.filter((r) => !r.shortQty && !r.excessQty).length, rs.length) : null)}
          cats={[{ label: "Accurate", color: C.c2, pred: (r) => !r.shortQty && !r.excessQty }, { label: "Shortage", color: C.bad, pred: (r) => !!r.shortQty }, { label: "Excess", color: C.c3, pred: (r) => !!r.excessQty }]} />
      </Panel>
      <Grid>
        <Panel title="Shortage trips by transporter">
          <BarList data={byTr.map(([n, rs]) => ({ name: n, value: rs.length }))} color={C.bad} valueFormatter={fmtN} onItemClick={(i) => openTrips(`Shortage · ${i.name}`, byTr.find((x) => x[0] === i.name)![1])} />
        </Panel>
        <Panel title="Shortage cases by month">
          <MonthlyStack rows={sh} onDrill={openTrips} agg={(rs) => sum(rs, "shortQty")} cats={[{ label: "Contracted", color: C.c1, pred: (r) => r.own === "Contracted" }, { label: "Market", color: C.orange, pred: (r) => r.own === "Market" }]} />
        </Panel>
      </Grid>
    </>
  );
}

/* ------------------------------ Cash discount ----------------------------- */
export function CashDiscount({ rows: all }: P) {
  const { openTrips } = useDrill();
  const rows = all.filter((r) => r.paidAt);
  const el = rows.filter((r) => r.cdEligible), av = rows.filter((r) => r.cdAvailed);
  const missed = el.filter((r) => !r.cdAvailed);
  const capture = el.length ? av.length / el.length : 0;
  return (
    <>
      <KpiRow>
        <Stat label="Paid trips" value={rows.length} />
        <Stat label="CD eligible" value={el.length} hint={pct(el.length, rows.length) + " paid ≤ 7 days"} onClick={() => openTrips("CD eligible trips", el)} />
        <Stat label="CD availed" value={av.length} hint={pct(av.length, el.length) + " of eligible"} onClick={() => openTrips("Cash discount availed", av)} />
        <Stat label="Cash discount earned" value={inr(sum(av, "cdAmt"))} color={C.good} />
        <Stat label="Missed CD" value={inr(sum(missed, (r) => r.freight * 0.02))} color={C.bad} hint={`${missed.length} trips`} onClick={() => openTrips("CD missed", missed)} />
      </KpiRow>
      <Grid className="lg:grid-cols-[1fr_2fr]">
        <Panel title="CD capture rate" description="Availed ÷ eligible">
          <div className="flex justify-center py-2">
            <RadialGauge value={capture * 100} max={100} size={220} zones={[{ from: 0, to: 80, color: C.bad }, { from: 80, to: 90, color: C.warn }, { from: 90, to: 100, color: C.good }]}>
              <div className="text-center"><div className="text-3xl font-semibold tracking-[-0.035em] tabular-nums">{(capture * 100).toFixed(1)}%</div><div className="text-xs text-muted-foreground">target 95%</div></div>
            </RadialGauge>
          </div>
          <Foot>2% cash discount on base freight when paid within 7 days of PI.</Foot>
        </Panel>
        <Panel title="Cash discount earned by month">
          <MonthlyStack rows={av} onDrill={openTrips} agg={(rs) => sum(rs, "cdAmt")} fmt={(v) => inr(v)} axis={crAxis} cats={[{ label: "Contracted", color: C.c1, pred: (r) => r.own === "Contracted" }, { label: "Market", color: C.orange, pred: (r) => r.own === "Market" }]} />
        </Panel>
      </Grid>
      <Panel title="Paid trips · CD availed vs not" description="Line: capture % of eligible (right axis)">
        <MonthlyWithRate rows={rows} onDrill={openTrips} rateLabel="Capture %" rate={(rs) => { const e = rs.filter((r) => r.cdEligible); return e.length ? pctv(e.filter((r) => r.cdAvailed).length, e.length) : null; }}
          cats={[{ label: "CD availed", color: C.good, pred: (r) => r.cdAvailed }, { label: "Eligible, missed", color: C.bad, pred: (r) => r.cdEligible && !r.cdAvailed }, { label: "Not eligible", color: C.muted, pred: (r) => !r.cdEligible }]} />
      </Panel>
    </>
  );
}
