import * as React from "react";
import { DistributionBar } from "@/components/overtrue/distribution-bar";
import { TrendChart } from "@/components/overtrue/trend-chart";
import { BarChart } from "@/components/overtrue/bar-chart";
import { BarList } from "@/components/overtrue/bar-list";
import { FunnelChart } from "@/components/overtrue/funnel-chart";
import { WaterfallChart } from "@/components/overtrue/waterfall-chart";
import { DataTable, Foot, Grid, KpiRow, LinkCell, Num, Panel, Pill, SectionHeading, StagePill, Stat, Toggle, type Col } from "@/components/app/kit";
import { MonthlyStack, MonthlyWithRate } from "@/components/app/charts";
import { tripCols, useDrill } from "@/state/drill";
import { C } from "@/data/colors";
import { DIST_SLABS, LOCATIONS, MONTHS, NOW, TSTAGES, today0, tStage, type Trip } from "@/data/data";
import { DAY, H, ageStr, avg, cr, crAxis, dayKey, fdShort, fdDay, fdt, fmtN, groupBy, inr, pct, pctv, sum } from "@/data/format";

type P = { rows: Trip[] };
const tripSearch = (r: Trip) => [r.id, r.vno, r.transporter, r.customer, r.dest].join(" ");
const useMode = (init: "count" | "value" = "count") => React.useState<"count" | "value">(init);
const modeToggle = (v: "count" | "value", set: (x: "count" | "value") => void) => <Toggle label="Measure" value={v} onChange={set} options={[["count", "Trips"], ["value", "₹ Freight"]]} />;
const aggOf = (m: "count" | "value") => (m === "value" ? (rs: Trip[]) => sum(rs, "total") : (rs: Trip[]) => rs.length);
const fmtOf = (m: "count" | "value") => (m === "value" ? crAxis : fmtN);

/* -------------------------------- Live trips ------------------------------ */
export function Live({ rows }: P) {
  const { openTrips, openTrip } = useDrill();
  const [sel, setSel] = React.useState<string | null>(null);
  const today = rows.filter((r) => r.created >= today0);
  const active = rows.filter((r) => r.stage !== "epod_done");
  const stages = TSTAGES.filter((s) => s.key !== "epod_done");
  const list = (sel ? active.filter((r) => r.stage === sel) : active).sort((a, b) => +b.lastUpdated - +a.lastUpdated);
  return (
    <>
      <SectionHeading title={`Today · ${fdShort(NOW)}`} description={`${fmtN(today.length)} trips created · ${fmtN(sum(today, "invQty"))} cases invoiced`} />
      <KpiRow>
        <Stat label="Today’s trips" value={today.length} onClick={() => openTrips("Today’s trips", today)} hint="Created since midnight" />
        {TSTAGES.slice(0, 5).map((s) => {
          const n = today.filter((r) => r.stage === s.key);
          return <Stat key={s.key} label={s.label} value={n.length} color={s.color} onClick={() => openTrips(`Today · ${s.label}`, n)} hint={pct(n.length, today.length, 0) + " of today"} />;
        })}
      </KpiRow>

      <SectionHeading title="All active trips" description="Every trip not yet ePOD-closed. Pick a stage to filter the list." />
      <KpiRow>
        <Stat label="Total active" value={active.length} selected={!sel} onClick={() => setSel(null)} hint="All open stages" />
        {stages.map((s) => {
          const n = active.filter((r) => r.stage === s.key).length;
          return <Stat key={s.key} label={s.label} value={n} color={s.color} selected={sel === s.key} onClick={() => setSel(sel === s.key ? null : s.key)} hint={pct(n, active.length, 0) + " of active"} />;
        })}
      </KpiRow>
      <div className="surface-card p-5">
        <DistributionBar segments={stages.map((s) => ({ name: s.label, value: active.filter((r) => r.stage === s.key).length, color: s.color }))} valueFormatter={fmtN} />
      </div>
      <Panel title={sel ? tStage(sel).label : "All active trips"} description={`${fmtN(list.length)} trips · newest update first`} contentClassName="p-5">
        <DataTable rows={list} cols={tripCols} search={tripSearch} searchPlaceholder="Search trip ID, vehicle, transporter, customer…" getRowId={(r) => r.id} onRowClick={openTrip} exportName="active-trips" />
      </Panel>
    </>
  );
}

/* ----------------------------- Dispatch tracker --------------------------- */
export function Dispatch({ rows }: P) {
  const { openTrips } = useDrill();
  const disp = rows.filter((r) => r.ms.gateOut);
  const days = Array.from({ length: 15 }, (_, i) => new Date(+today0 - (14 - i) * DAY));
  const byDay = days.map((d) => disp.filter((r) => r.ms.gateOut! >= d && +r.ms.gateOut! < +d + DAY));
  const today = byDay[14];
  const mtd = disp.filter((r) => r.ms.gateOut! >= new Date(NOW.getFullYear(), NOW.getMonth(), 1));
  const data = days.map((d, i) => ({ day: fdDay(d), __i: i, ...Object.fromEntries(LOCATIONS.map((l, j) => ["s" + j, byDay[i].filter((r) => r.loc === l).length])) }));
  type DayRow = { d: Date; rows: Trip[] };
  const cols: Col<DayRow>[] = [
    { id: "d", header: "Date", value: (r) => +r.d, cell: (r) => <span className="font-medium">{fdShort(r.d)}</span>, csv: (r) => fdShort(r.d) },
    ...LOCATIONS.map((l) => ({ id: l, header: l, align: "right" as const, value: (r: DayRow) => r.rows.filter((x) => x.loc === l).length })),
    { id: "tot", header: "Total trips", align: "right", value: (r) => r.rows.length, cell: (r) => <LinkCell onClick={() => openTrips(`Dispatched ${fdShort(r.d)}`, r.rows)}>{r.rows.length}</LinkCell> },
    { id: "qty", header: "Cases", align: "right", value: (r) => sum(r.rows, "invQty"), cell: (r) => fmtN(sum(r.rows, "invQty")) },
    { id: "con", header: "Contracted", align: "right", value: (r) => pctv(r.rows.filter((x) => x.own === "Contracted").length, r.rows.length), cell: (r) => pct(r.rows.filter((x) => x.own === "Contracted").length, r.rows.length, 0) },
    { id: "avg", header: "Cases / trip", align: "right", value: (r) => avg(r.rows, "invQty"), cell: (r) => fmtN(avg(r.rows, "invQty")) },
  ];
  const prevAvg = sum(byDay.slice(7, 14), (r) => r.length) / 7;
  return (
    <>
      <KpiRow>
        <Stat label="Dispatched today" value={today.length} delta={prevAvg ? today.length / prevAvg - 1 : undefined} hint="vs 7-day average" onClick={() => openTrips("Dispatched today", today)} />
        <Stat label="Cases dispatched today" value={fmtN(sum(today, "invQty"))} />
        <Stat label="MTD trips dispatched" value={mtd.length} onClick={() => openTrips("MTD dispatches", mtd)} />
        <Stat label="MTD cases" value={fmtN(sum(mtd, "invQty"))} hint={`${fmtN(avg(mtd, "invQty"))} cases / trip`} />
        <Stat label="Avg trips / day (15d)" value={(sum(byDay, (r) => r.length) / 15).toFixed(1)} sparkline={byDay.map((r) => r.length)} />
      </KpiRow>
      <Panel title="Date-wise dispatches · last 15 days" description="By origin gate-out time, stacked by plant. Click a segment for its trips." info="Sundays are typically low-volume.">
        <TrendChart data={data} xKey="day" type="bar" stacked showLegend showYAxis series={LOCATIONS.map((l, j) => ({ key: "s" + j, label: l, color: [C.c1, C.c2, C.c3][j] }))}
          className="h-72" onBarClick={(row, key) => openTrips(`${LOCATIONS[+key.slice(1)]} · ${row.day}`, byDay[Number(row.__i)].filter((r) => r.loc === LOCATIONS[+key.slice(1)]))} />
      </Panel>
      <Panel title="Date-wise dispatch tracker">
        <DataTable rows={days.map((d, i) => ({ d, rows: byDay[i] })).reverse()} cols={cols} pageSize={15} exportName="dispatch-tracker" />
      </Panel>
    </>
  );
}

/* ---------------------------- Vehicle ageing ------------------------------ */
const BUCKETS = [
  { key: "plant", label: "Inside plant", stages: ["vehicle_reported", "loading", "invoiced"], since: (r: Trip) => r.ms.reported!, color: C.orange, warn: 8, from: "origin reporting" },
  { key: "transit", label: "In transit", stages: ["in_transit"], since: (r: Trip) => r.ms.gateOut!, color: C.c1, warn: 36, from: "origin gate-out" },
  { key: "dest", label: "At CFA / destination", stages: ["at_destination"], since: (r: Trip) => r.ms.destReported!, color: C.c4, warn: 24, from: "destination reporting" },
];
export function Inside({ rows }: P) {
  const { openTrips, openTrip } = useDrill();
  const [k, setK] = React.useState("plant");
  const b = BUCKETS.find((x) => x.key === k)!;
  const list = rows.filter((r) => b.stages.includes(r.stage)).map((r) => ({ ...r, age: +NOW - +b.since(r) })).sort((x, y) => y.age - x.age);
  const slabs: [string, number, number][] = [["< 4 h", 0, 4], ["4–8 h", 4, 8], ["8–24 h", 8, 24], ["24–48 h", 24, 48], ["> 48 h", 48, 1e9]];
  const slabRows = slabs.map(([l, a, z]) => ({ slab: l, a, vehicles: list.filter((r) => r.age / H >= a && r.age / H < z).length, rows: list.filter((r) => r.age / H >= a && r.age / H < z) }));
  const by = [...groupBy(list, (r) => (k === "plant" ? r.loc : r.dest)).entries()].sort((x, y) => y[1].length - x[1].length);
  const cols: Col<Trip & { age: number }>[] = [
    { id: "id", header: "Trip ID", value: (r) => r.id, cell: (r) => <span className="font-mono text-xs font-medium">{r.id}</span> },
    { id: "vno", header: "Vehicle", value: (r) => r.vno },
    { id: "tr", header: "Transporter", value: (r) => r.transporter },
    { id: "route", header: "Route", value: (r) => `${r.loc} → ${r.dest}` },
    { id: "stage", header: "Stage", value: (r) => r.stageIdx, cell: (r) => <StagePill s={tStage(r.stage)} /> },
    { id: "since", header: "Since", value: (r) => +b.since(r), cell: (r) => fdt(b.since(r)) },
    { id: "age", header: "Ageing", align: "right", value: (r) => r.age, cell: (r) => <Pill tone={r.age / H > b.warn ? "error" : r.age / H > b.warn / 2 ? "warning" : "success"}>{ageStr(r.age)}</Pill> },
    { id: "trk", header: "Tracking", value: (r) => r.consent, cell: (r) => (r.consent === "ALLOWED" ? <Pill tone="success" live>Live</Pill> : <Num tone="muted">—</Num>) },
  ];
  return (
    <>
      <KpiRow className="xl:grid-cols-3">
        {BUCKETS.map((x) => {
          const rs = rows.filter((r) => x.stages.includes(r.stage));
          const over = rs.filter((r) => (+NOW - +x.since(r)) / H > x.warn).length;
          return <Stat key={x.key} label={x.label} value={rs.length} color={x.color} selected={k === x.key} onClick={() => setK(x.key)} hint={<Num tone={over ? "bad" : "good"}>{over} over {x.warn} h</Num>} />;
        })}
      </KpiRow>
      <Grid>
        <Panel title={`${b.label} · ageing`} description={`Hours since ${b.from}. Red bars are past the ${b.warn} h threshold.`}>
          <BarChart data={slabRows} xKey="slab" yKey="vehicles" color={C.bad} mutedColor="var(--color-chart-1)" highlight={(r) => Number(r.a) >= b.warn} showYAxis
            onBarClick={(r) => openTrips(`${b.label} · ${r.slab}`, (r as unknown as { rows: Trip[] }).rows)} className="h-64" />
        </Panel>
        <Panel title={`${b.label} · by ${k === "plant" ? "plant" : "destination"}`} description="Click a row to see its vehicles">
          <BarList data={by.slice(0, 10).map(([n, rs]) => ({ name: n, value: rs.length }))} valueFormatter={fmtN} color={b.color} onItemClick={(i) => openTrips(`${b.label} · ${i.name}`, by.find((x) => x[0] === i.name)![1])} />
        </Panel>
      </Grid>
      <Panel title={`${b.label} · ${list.length} vehicles`} description="Oldest first">
        <DataTable rows={list} cols={cols} search={tripSearch} getRowId={(r) => r.id} onRowClick={openTrip} exportName={`vehicles-${k}`} />
      </Panel>
    </>
  );
}

/* ------------------------------ Trip hygiene ------------------------------ */
export function Hygiene({ rows }: P) {
  const { openTrips } = useDrill();
  const [m1, setM1] = useMode();
  const [m2, setM2] = useMode();
  const done = rows.filter((r) => ["unloaded", "epod_done"].includes(r.stage));
  const tracked = (rs: Trip[]) => (rs.length ? pctv(rs.filter((r) => r.consent === "ALLOWED").length, rs.length) : null);
  return (
    <>
      <KpiRow>
        <Stat label="Total trips" value={rows.length} />
        <Stat label="Tracking adherence" value={pct(rows.filter((r) => r.consent === "ALLOWED").length, rows.length)} hint="Driver SIM consent allowed" onClick={() => openTrips("Untracked trips", rows.filter((r) => r.consent !== "ALLOWED"))} />
        <Stat label="Contracted share" value={pct(rows.filter((r) => r.own === "Contracted").length, rows.length)} />
        <Stat label="Trip completion" value={pct(done.length, rows.length)} hint="Unloaded or ePOD done" />
        <Stat label="Total distance" value={fmtN(sum(rows, "km")) + " km"} />
        <Stat label="Avg distance / trip" value={fmtN(avg(rows, "km")) + " km"} />
      </KpiRow>
      <Grid>
        <Panel title="Order mix by month" description="Direct vs indent vs mixed trips">
          <MonthlyStack rows={rows} onDrill={openTrips} cats={[["Indent Order", C.c1], ["Direct Order", C.c2], ["Mixed Order", C.c4]].map(([l, c]) => ({ label: l, color: c, pred: (r: Trip) => r.otype === l }))} />
        </Panel>
        <Panel title="Contracted vs market" actions={modeToggle(m1, setM1)}>
          <MonthlyStack rows={rows} onDrill={openTrips} agg={aggOf(m1)} fmt={fmtOf(m1)} cats={[{ label: "Contracted", color: C.c1, pred: (r) => r.own === "Contracted" }, { label: "Market", color: C.orange, pred: (r) => r.own === "Market" }]} />
        </Panel>
        <Panel title="Tracking adherence" description="Bars: trip count · line: % tracked (right axis)" info="Tracked = driver gave SIM-based location consent.">
          <MonthlyWithRate rows={rows} onDrill={openTrips} rate={tracked} rateLabel="% tracked" cats={[{ label: "Tracked", color: C.c2, pred: (r) => r.consent === "ALLOWED" }, { label: "Not tracked", color: C.muted, pred: (r) => r.consent !== "ALLOWED" }]} />
        </Panel>
        <Panel title="Contracted trips · indent acceptance" description="Who accepted the indent">
          <MonthlyStack rows={rows.filter((r) => r.own === "Contracted")} onDrill={openTrips} cats={[{ label: "Transporter accepted", color: C.c3, pred: (r) => r.acceptedBy === "Transporter Accepted" }, { label: "DFM accepted", color: C.c1, pred: (r) => r.acceptedBy === "DFM Accepted" }]} />
        </Panel>
        <Panel title="Trips by distance slab">
          <MonthlyStack rows={rows} onDrill={openTrips} cats={DIST_SLABS.map(([l, a, b, c]) => ({ label: l, color: c, pred: (r: Trip) => r.km >= a && r.km <= b }))} />
        </Panel>
        <Panel title="Trips by vehicle length" actions={modeToggle(m2, setM2)}>
          <MonthlyStack rows={rows} onDrill={openTrips} agg={aggOf(m2)} fmt={fmtOf(m2)} cats={["20", "22", "24", "27", "32"].map((l, i) => ({ label: l + " ft", color: [C.c1, C.c2, C.c3, C.c4, C.c5][i], pred: (r: Trip) => r.len === l }))} />
        </Panel>
        <Panel title="Distance travelled (km)">
          <MonthlyStack rows={rows} onDrill={openTrips} agg={(rs) => sum(rs, "km")} axis={(v) => (v / 1000).toFixed(0) + "k"} cats={[{ label: "Contracted", color: C.c1, pred: (r) => r.own === "Contracted" }, { label: "Market", color: C.orange, pred: (r) => r.own === "Market" }]} />
        </Panel>
        <Panel title="Trip completion" description="Bars: trips · line: completion % (right axis)">
          <MonthlyWithRate rows={rows} onDrill={openTrips} rate={(rs) => (rs.length ? pctv(rs.filter((r) => ["unloaded", "epod_done"].includes(r.stage)).length, rs.length) : null)} rateLabel="% complete"
            cats={[{ label: "Completed", color: C.c2, pred: (r) => ["unloaded", "epod_done"].includes(r.stage) }, { label: "Open", color: C.bad, pred: (r) => !["unloaded", "epod_done"].includes(r.stage) }]} />
        </Panel>
      </Grid>
    </>
  );
}

/* --------------------------------- Costing -------------------------------- */
export function Costing({ rows: all }: P) {
  const { openTrips } = useDrill();
  const rows = all.filter((r) => r.ms.gateOut);
  const [mo, setMo] = React.useState(MONTHS[4].key);
  const [m1, setM1] = useMode();
  const costKm = (rs: Trip[]) => (sum(rs, "km") ? sum(rs, "total") / sum(rs, "km") : 0);
  const mk = rows.filter((r) => r.own === "Market" && r.l1);
  const lineData = MONTHS.map((m) => {
    const rs = rows.filter((r) => r.mk === m.key);
    return { month: m.label, c: +costKm(rs.filter((r) => r.own === "Contracted")).toFixed(1), m: +costKm(rs.filter((r) => r.own === "Market")).toFixed(1), t: +costKm(rs).toFixed(1) };
  });
  const mr = rows.filter((r) => r.mk === mo);
  return (
    <>
      <KpiRow>
        <Stat label="Total freight" value={cr(sum(rows, "total"))} />
        <Stat label="Avg cost / km" value={"₹" + costKm(rows).toFixed(1)} />
        <Stat label="Contracted ₹/km" value={"₹" + costKm(rows.filter((r) => r.own === "Contracted")).toFixed(1)} color={C.c1} />
        <Stat label="Market ₹/km" value={"₹" + costKm(rows.filter((r) => r.own === "Market")).toFixed(1)} color={C.orange} />
        <Stat label="Market premium over L1" value={"+" + pct(sum(mk, "freight") - sum(mk, "l1"), sum(mk, "l1"))} hint="Defined routes only" onClick={() => openTrips("Market trips above L1", mk.filter((r) => r.freight > r.l1))} />
        <Stat label="Undefined-route trips" value={rows.filter((r) => !r.definedRoute).length} hint="No L1 benchmark" onClick={() => openTrips("Undefined route trips", rows.filter((r) => !r.definedRoute))} />
      </KpiRow>
      <Panel title="Monthly freight value · contracted vs market" description="Click a segment for the trips">
        <MonthlyStack rows={rows} onDrill={openTrips} agg={(rs) => sum(rs, "total")} fmt={cr} axis={crAxis} cats={[{ label: "Contracted", color: C.c1, pred: (r) => r.own === "Contracted" }, { label: "Market", color: C.orange, pred: (r) => r.own === "Market" }]} />
      </Panel>
      <Grid>
        <Panel title="Cost per km trend" description="₹ per km, total freight ÷ total distance" info="A line chart shows the trend across months more clearly than grouped bars.">
          <TrendChart data={lineData} xKey="month" type="line" showLegend showYAxis yFormatter={(v) => "₹" + v} yDomain={["auto", "auto"]} className="h-72"
            series={[{ key: "c", label: "Contracted", color: C.c1 }, { key: "m", label: "Market", color: C.orange }, { key: "t", label: "Total", color: "var(--color-foreground)" }]} />
        </Panel>
        <Panel title="Market vehicles vs L1 benchmark" description="Base freight compared with the lane’s lowest contracted rate">
          <MonthlyStack rows={rows.filter((r) => r.own === "Market")} onDrill={openTrips} cats={[{ label: "≤ L1", color: C.good, pred: (r) => !!r.l1 && r.freight <= r.l1 }, { label: "> L1", color: C.bad, pred: (r) => !!r.l1 && r.freight > r.l1 }, { label: "No L1", color: C.muted, pred: (r) => !r.l1 }]} />
        </Panel>
      </Grid>
      <Panel title="Freight build-up" description="Base freight to total freight for the selected month"
        actions={<Toggle label="Month" value={mo} onChange={setMo} options={MONTHS.map((m) => [m.key, m.label.split(" ")[0]])} />}>
        <WaterfallChart
          height={280}
          valueFormatter={(v, ctx) => (ctx === "axis" ? "₹" + crAxis(v) : cr(v))}
          steps={[
            { id: "base", label: "Base freight", value: sum(mr, "freight"), kind: "start" },
            { id: "det", label: "Detention", value: sum(mr, "actDet") },
            { id: "addl", label: "Additional", value: sum(mr, "addl") },
            { id: "short", label: "Shortage penalty", value: -sum(mr, "shortPen") },
            { id: "dmg", label: "Damage penalty", value: -sum(mr, "dmgPen") },
            { id: "total", label: "Total freight", value: sum(mr, "total"), kind: "end" },
          ]}
        />
        <Foot>Total freight = base + detention + additional − shortage − damage. Avg ₹{costKm(mr).toFixed(1)}/km across {fmtN(mr.length)} trips.</Foot>
      </Panel>
      <Grid>
        <Panel title="Freight by order type">
          <MonthlyStack rows={rows} onDrill={openTrips} agg={(rs) => sum(rs, "total")} fmt={cr} axis={crAxis} cats={[{ label: "Direct", color: C.c1, pred: (r) => r.otype === "Direct Order" }, { label: "Indent + mixed", color: C.c3, pred: (r) => r.otype !== "Direct Order" }]} />
        </Panel>
        <Panel title="Trips by distance slab" actions={modeToggle(m1, setM1)}>
          <MonthlyStack rows={rows} onDrill={openTrips} agg={aggOf(m1)} fmt={fmtOf(m1)} cats={DIST_SLABS.map(([l, a, b, c]) => ({ label: l, color: c, pred: (r: Trip) => r.km >= a && r.km <= b }))} />
        </Panel>
      </Grid>
    </>
  );
}

/* -------------------------------- Payments -------------------------------- */
export function Payments({ rows: all }: P) {
  const { openTrips } = useDrill();
  const [m1, setM1] = useMode();
  const rows = all.filter((r) => r.epodDone);
  const funnel: [string, Trip[]][] = [["ePOD done", rows], ["PI generated", rows.filter((r) => r.pi)], ["Approved", rows.filter((r) => ["Payment Pending", "Paid"].includes(r.payStatus))], ["Paid", rows.filter((r) => r.payStatus === "Paid")]];
  const paid = rows.filter((r) => r.paidAt);
  const st: [string, string][] = [["Invoice Pending", C.muted], ["Approval Pending", C.c3], ["Payment Pending", C.orange], ["Paid", C.good], ["Charges Rejected", C.bad]];
  const [active, setActive] = React.useState<number | null>(null);
  return (
    <>
      <KpiRow>
        {funnel.map(([l, rs], i) => <Stat key={l} label={l} value={rs.length} hint={(i ? pct(rs.length, rows.length, 0) + " · " : "") + cr(sum(rs, "total"))} onClick={() => openTrips(l, rs)} />)}
        <Stat label="Avg PI → payment" value={avg(paid, (r) => (+r.paidAt! - +r.piAt!) / DAY).toFixed(1) + " days"} />
        <Stat label="Paid within due date" value={pct(paid.filter((r) => r.timely).length, paid.length)} hint="Due = PI + 30 days" />
      </KpiRow>
      <Grid className="lg:grid-cols-[1fr_1.4fr]">
        <Panel title="Payment funnel" description="ePOD-closed trips moving to payment">
          <FunnelChart steps={funnel.map(([n, rs]) => ({ name: n, value: rs.length }))} valueFormatter={fmtN} activeIndex={active} onActiveIndexChange={setActive} />
          <Foot>Biggest drop: {(() => { let w = 1, d = 0; for (let i = 1; i < funnel.length; i++) { const x = funnel[i - 1][1].length - funnel[i][1].length; if (x > d) { d = x; w = i; } } return `${funnel[w - 1][0]} → ${funnel[w][0]} (${fmtN(d)} trips)`; })()}</Foot>
        </Panel>
        <Panel title="Payment status by month" actions={modeToggle(m1, setM1)}>
          <MonthlyStack rows={rows} onDrill={openTrips} agg={aggOf(m1)} fmt={fmtOf(m1)} cats={st.map(([s, c]) => ({ label: s, color: c, pred: (r: Trip) => r.payStatus === s }))} />
        </Panel>
        <Panel title="Paid trips · within due date vs delayed" description="Line: % on time (right axis)">
          <MonthlyWithRate rows={paid} onDrill={openTrips} rate={(rs) => (rs.length ? pctv(rs.filter((r) => r.timely).length, rs.length) : null)} rateLabel="% on time"
            cats={[{ label: "Within due date", color: C.good, pred: (r) => !!r.timely }, { label: "Delayed", color: C.bad, pred: (r) => !r.timely }]} />
        </Panel>
        <Panel title="ePOD clean source" description="Auto-verified vs manually cleaned ePODs">
          <MonthlyStack rows={rows} onDrill={openTrips} cats={[{ label: "Auto", color: C.c2, pred: (r) => r.cleanSource === "Auto" }, { label: "Manual", color: C.c3, pred: (r) => r.cleanSource === "Manual" }]} />
        </Panel>
      </Grid>
    </>
  );
}

