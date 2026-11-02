import * as React from "react";
import { useParams } from "react-router-dom";
import { TrendChart } from "@/components/overtrue/trend-chart";
import { ComposedChart } from "@/components/overtrue/composed-chart";
import { BarList } from "@/components/overtrue/bar-list";
import { HeatmapChart } from "@/components/overtrue/heatmap-chart";
import { RadialGauge } from "@/components/overtrue/radial-gauge";
import { GanttChart } from "@/components/overtrue/gantt-chart";
import { SankeyChart } from "@/components/overtrue/sankey-chart";
import { StackedAreaChart } from "@/components/overtrue/stacked-area-chart";
import { ModulePage } from "@/components/app/module";
import { FilterBar, fv, inF, opts, type FilterValues } from "@/components/app/filters";
import { DataTable, Foot, Grid, KpiRow, LinkCell, Num, Panel, Pill, Stat, StagePill, Toggle, type Col } from "@/components/app/kit";
import { otifTone, OtifValue } from "@/components/app/otif";
import { orderCols, tripCols, useDrill } from "@/state/drill";
import { useApp, usePersistentState } from "@/state/app";
import { C, PALETTE } from "@/data/colors";
import { tStage, CUR_MONTH, DEDICATED, MONTHS, NOW, ORDER_DESTS, OSTAGES, PLATFORMS, ecomOrders, indents, oStage, orders, today0, trips, type EcomOrder, type Indent, type Order } from "@/data/data";
import { DAY, H, ageStr, avg, dayKey, fd, fdDay, fdShort, fdt, fmtN, groupBy, inr, pct, pctv, sum } from "@/data/format";

type P = { rows: Order[] };
const orderSearch = (r: Order) => [r.no, r.dest, r.customer, r.transporter, r.vno].join(" ");

export default function Orders() {
  const { tab = "live" } = useParams();
  const [f, setF] = usePersistentState<FilterValues>("order.filters.v2", []);
  const rows = orders.filter((o) => inF(f, "month", o.mk) && inF(f, "loc", o.location) && inF(f, "type", o.type) && inF(f, "dest", o.dest) && inF(f, "pt", o.productType));
  const showFilters = tab !== "ecom" && tab !== "dedicated";
  const View = ({ live: Live, destinations: Destinations, indents: Indents, planning: Planning, dedicated: Dedicated, otif: Otif, ecom: Ecom } as Record<string, (p: P) => React.ReactNode>)[tab] ?? Live;
  return (
    <ModulePage moduleId="orders" tab={tab} updated={orders[0].approved}
      filters={showFilters ? (
        <FilterBar values={f} onChange={setF} fields={[
          { key: "month", label: "Month", options: MONTHS.map((m) => ({ value: m.key, label: m.label })) },
          { key: "loc", label: "Supply location", options: opts(["Greater Noida", "Ghaziabad"]) },
          { key: "type", label: "Order type", options: opts(["Direct Order", "Stock Transfer"]) },
          { key: "dest", label: "Destination", options: opts(ORDER_DESTS) },
          { key: "pt", label: "Product type", options: [{ value: "SP", label: "SP — Small pack" }, { value: "LP", label: "LP — Large pack" }, { value: "LP + SP", label: "LP + SP" }] },
        ]} views={[
          { id: "mtd", name: "This month", filters: [fv("month", [MONTHS[5].key])] },
          { id: "st", name: "Stock transfers", filters: [fv("type", ["Stock Transfer"])] },
          { id: "gzb", name: "Ghaziabad plant", filters: [fv("loc", ["Ghaziabad"])] },
        ]} count={<span className="text-xs text-muted-foreground tabular-nums">{rows.length.toLocaleString("en-IN")} orders</span>} />
      ) : undefined}
      note="Scope: GN / GZB supply locations, finished-goods orders. Cancelled, manually processed and inter-transfer orders are excluded."
    >
      <View rows={rows} />
    </ModulePage>
  );
}

const AGE: [string, string, number, number][] = [["< 24 h", C.good, 0, 24], ["24–48 h", C.warn, 24, 48], ["> 48 h", C.bad, 48, 1e9]];
const ageH = (o: Order) => (+NOW - +o.approved) / H;

/* ------------------------------ Live orders ------------------------------- */
function Live({ rows: all }: P) {
  const { openOrders } = useDrill();
  const { otif } = useApp();
  const [q, setQ] = React.useState<"all" | "gt" | "lt">("all");
  const [sel, setSel] = React.useState<string | null>(null);
  const rows = all.filter((o) => (+NOW - +o.approved) / DAY <= 30).filter((o) => (q === "gt" ? o.qtyShown > 200 : q === "lt" ? o.qtyShown < 200 : true));
  const open = rows.filter((o) => o.stage !== "dispatched");
  const list = (sel ? rows.filter((o) => o.stage === sel) : open).sort((a, b) => +a.approved - +b.approved);
  const openStages = OSTAGES.slice(0, 5);
  const data = openStages.map((s) => ({ stage: s.label, ...Object.fromEntries(AGE.map(([, , a, b], j) => ["s" + j, open.filter((o) => o.stage === s.key && ageH(o) >= a && ageH(o) < b).length])) }));
  const cols = React.useMemo(() => orderCols(otif), [otif]);
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
        Order quantity <Toggle label="Quantity" value={q} onChange={setQ} options={[["all", "All orders"], ["gt", "> 200 cases"], ["lt", "< 200 cases"]]} /> · approved in the last 30 days
      </div>
      <KpiRow>
        <Stat label="Open orders" value={open.length} selected={!sel} onClick={() => setSel(null)} hint={fmtN(sum(open, "qtyShown")) + " cases"} />
        {OSTAGES.map((s) => {
          const n = rows.filter((o) => o.stage === s.key).length;
          return <Stat key={s.key} label={s.label} value={n} color={s.color} selected={sel === s.key} onClick={() => setSel(sel === s.key ? null : s.key)} hint={pct(n, rows.length, 0) + " of orders"} />;
        })}
      </KpiRow>
      <Grid>
        <Panel span={7} title="Open orders by stage and ageing" description="Ageing from approval. Anything red needs escalation." info="Click a segment to see those orders."
          insight={(() => { const red = open.filter((o) => ageH(o) >= 48); const st = openStages.map((s) => ({ s, n: red.filter((o) => o.stage === s.key).length })).sort((a, b) => b.n - a.n)[0]; return red.length ? `{{metric:${red.length} orders|${pct(red.length, open.length, 0)}|negative}} are over 48 h old, mostly stuck at {{metric:${st.s.label}|${st.n}|negative}}.` : `No open order is older than 48 h — {{metric:${open.length} orders|on track|positive}}.`; })()}>
          <TrendChart data={data} xKey="stage" type="bar" stacked showLegend showYAxis className="h-72" series={AGE.map(([l, c], j) => ({ key: "s" + j, label: l, color: c }))}
            onBarClick={(row, key) => { const s = openStages.find((x) => x.label === row.stage)!; const [l, , a, b] = AGE[+key.slice(1)]; openOrders(`${s.label} · ${l}`, open.filter((o) => o.stage === s.key && ageH(o) >= a && ageH(o) < b)); }} />
        </Panel>
        <Panel span={5} title="Oldest open orders" description="Top 8 by hours since approval"
          insight={open.length ? `Oldest is {{metric:${open.slice().sort((a, b) => +a.approved - +b.approved)[0].dest}|${ageStr(+NOW - +open.slice().sort((a, b) => +a.approved - +b.approved)[0].approved)}|negative}} (${open.slice().sort((a, b) => +a.approved - +b.approved)[0].statusTxt}).` : null}>
          <BarList sortOrder="none" color={C.bad} valueFormatter={(v) => ageStr(v * H)}
            data={open.slice().sort((a, b) => +a.approved - +b.approved).slice(0, 8).map((o) => ({ name: `${o.dest} · ${o.no.slice(-6)}`, value: ageH(o), key: o.no }))}
            onItemClick={(i) => openOrders(i.name, open.filter((o) => o.no === i.key))} />
        </Panel>
      </Grid>
      <Panel title={sel ? oStage(sel).label : "All open orders"} description={`${fmtN(list.length)} orders · oldest first`}>
        <DataTable rows={list} cols={cols} search={orderSearch} searchPlaceholder="Search order, destination, customer, transporter…" getRowId={(r) => r.no} exportName="open-orders" />
      </Panel>
    </>
  );
}

/* -------------------------- Destination tracker --------------------------- */
function Destinations({ rows: all }: P) {
  const { openOrders } = useDrill();
  const rows = all.filter((o) => (+NOW - +o.approved) / DAY <= 30 && o.stage !== "dispatched");
  const g = [...groupBy(rows, (o) => o.dest).entries()].sort((a, b) => b[1].length - a[1].length);
  type Row = [string, Order[]];
  const cell = (rs: Order[], title: string) => (rs.length ? <LinkCell onClick={() => openOrders(title, rs)}>{rs.length}</LinkCell> : <Num tone="muted">0</Num>);
  const cols: Col<Row>[] = [
    { id: "d", header: "Destination", value: (r) => r[0], cell: (r) => <span className="font-medium">{r[0]}</span> },
    ...OSTAGES.slice(0, 5).map((s) => ({ id: s.key, header: s.label, align: "right" as const, value: (r: Row) => r[1].filter((o) => o.stage === s.key).length, cell: (r: Row) => cell(r[1].filter((o) => o.stage === s.key), `${r[0]} · ${s.label}`) })),
    ...AGE.map(([l, , a, b]) => ({ id: l, header: l, align: "right" as const, value: (r: Row) => r[1].filter((o) => ageH(o) >= a && ageH(o) < b).length, cell: (r: Row) => cell(r[1].filter((o) => ageH(o) >= a && ageH(o) < b), `${r[0]} · ${l}`) })),
    { id: "tot", header: "Total", align: "right", value: (r) => r[1].length, cell: (r) => cell(r[1], r[0]) },
    { id: "q", header: "Qty (cases)", align: "right", value: (r) => sum(r[1], "qtyShown"), cell: (r) => fmtN(sum(r[1], "qtyShown")) },
  ];
  const aged = rows.filter((o) => ageH(o) > 48);
  return (
    <>
      <KpiRow>
        <Stat label="Destinations with open orders" value={g.length} />
        <Stat label="Open orders" value={rows.length} onClick={() => openOrders("Open orders", rows)} />
        <Stat label="Open qty (cases)" value={fmtN(sum(rows, "qtyShown"))} />
        <Stat label="Aged > 48 h" value={aged.length} color={C.bad} onClick={() => openOrders("Orders aged > 48 h", aged)} />
      </KpiRow>
      <Panel title="Pending orders by destination" description="Last 30 days · click any cell for the orders behind it"
        insight={g.length ? `{{metric:${g[0][0]}|${g[0][1].length} open|neutral}} has the deepest backlog; ${pct(aged.length, rows.length, 0)} of all open orders are past 48 h.` : null}>
        <HeatmapChart rows={g.slice(0, 15).map(([d, rs]) => ({ label: d, values: OSTAGES.slice(0, 5).map((s) => rs.filter((o) => o.stage === s.key).length) }))}
          columns={OSTAGES.slice(0, 5).map((s) => s.label)} valueFormatter={(v) => `${v} orders`} maxCellHeight={30}
          onCellClick={(c) => openOrders(`${c.rowLabel} · ${c.columnLabel}`, g[c.row][1].filter((o) => o.stage === OSTAGES[c.column].key))} />
      </Panel>
      <Panel title="Destination-wise tracker">
        <DataTable rows={g} cols={cols} pageSize={15} exportName="destination-tracker" getRowId={(r) => r[0]} />
      </Panel>
    </>
  );
}

/* --------------------------- Indents & auctions --------------------------- */
function Indents({ rows: all }: P) {
  const [src, setSrc] = React.useState<"all" | "Indent" | "Auction">("all");
  const ok = new Set(all);
  const rows = indents.filter((i) => (+NOW - +i.created) / DAY <= 7 && (src === "all" || i.src === src) && ok.has(i.orderRef));
  const open = rows.filter((i) => i.status.endsWith("Created"));
  const acc = rows.filter((i) => i.status.endsWith("Accepted"));
  const accT = rows.filter((i) => i.accepted).map((i) => (+i.accepted! - +i.created) / H);
  const cols: Col<Indent>[] = [
    { id: "no", header: "Indent / auction", value: (r) => r.no, cell: (r) => <span className="font-mono text-xs font-medium">{r.no}</span> },
    { id: "o", header: "Order", value: (r) => r.order, cell: (r) => <span className="font-mono text-xs">{r.order}</span> },
    { id: "src", header: "Source", value: (r) => r.src, cell: (r) => <Pill tone={r.src === "Auction" ? "info" : "neutral"}>{r.src}</Pill> },
    { id: "st", header: "Status", value: (r) => r.status, cell: (r) => <Pill tone={r.status.endsWith("Created") ? "warning" : r.status.endsWith("Accepted") ? "success" : "neutral"}>{r.status}</Pill> },
    { id: "d", header: "Destination", value: (r) => r.dest },
    { id: "q", header: "Qty", align: "right", value: (r) => r.qty, cell: (r) => fmtN(r.qty) },
    { id: "t", header: "Transporter / bids", value: (r) => r.transporter },
    { id: "r", header: "L1 bid / rate", align: "right", value: (r) => r.l1 || r.rate, cell: (r) => inr(r.l1 || r.rate) },
    { id: "c", header: "Created", value: (r) => +r.created, cell: (r) => fdt(r.created) },
    { id: "open", header: "Time open", align: "right", value: (r) => +(r.accepted || NOW) - +r.created, cell: (r) => { const ms = +(r.accepted || NOW) - +r.created; return <Num tone={!r.accepted && ms > 3 * H ? "bad" : undefined}>{ageStr(ms)}</Num>; } },
  ];
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
        Source <Toggle label="Source" value={src} onChange={setSrc} options={[["all", "All"], ["Indent", "Indent"], ["Auction", "Auction"]]} /> · raised in the last 7 days
      </div>
      <KpiRow>
        <Stat label="Open indents" value={open.filter((i) => i.src === "Indent").length} color={C.orange} hint="Awaiting acceptance" />
        <Stat label="Live auctions" value={open.filter((i) => i.src === "Auction").length} color={C.c4} hint="Bidding in progress" />
        <Stat label="Accepted · vehicle pending" value={acc.length} color={C.c3} />
        <Stat label="Avg acceptance TAT" value={(accT.reduce((a, b) => a + b, 0) / (accT.length || 1)).toFixed(1) + " h"} />
        <Stat label="Avg bids / auction" value={avg(rows.filter((i) => i.bids), (i) => i.bids!).toFixed(1)} />
      </KpiRow>
      <Grid>
        <Panel span={12} title="Indents and auctions raised · last 7 days" description="Stacked by source, with the share still waiting for a transporter"
          insight={`{{metric:Auctions|${pct(rows.filter((i) => i.src === "Auction").length, rows.length, 0)}|neutral}} of requests went to auction, averaging ${avg(rows.filter((i) => i.bids), (i) => i.bids!).toFixed(1)} bids. Indents are accepted in ${avg(rows.filter((i) => i.src === "Indent" && i.accepted), (i) => (+i.accepted! - +i.created) / H).toFixed(1)} h vs ${avg(rows.filter((i) => i.src === "Auction" && i.accepted), (i) => (+i.accepted! - +i.created) / H).toFixed(1)} h for auctions.`}>
          <StackedAreaChart height={240} index="day" stack="normal" showLegend valueFormatter={(v) => `${v}`}
            series={[{ key: "ind", label: "Indent", color: C.c1 }, { key: "auc", label: "Auction", color: C.c4 }]}
            data={Array.from({ length: 7 }, (_, i) => { const d = new Date(+today0 - (6 - i) * DAY); const rs = rows.filter((x) => dayKey(x.created) === dayKey(d)); return { day: fdShort(d), ind: rs.filter((x) => x.src === "Indent").length, auc: rs.filter((x) => x.src === "Auction").length }; })} />
        </Panel>
      </Grid>
      <Panel title="Indent and auction feed" description={`${rows.length} raised`}>
        <DataTable rows={rows} cols={cols} search={(r) => [r.no, r.order, r.dest, r.transporter].join(" ")} getRowId={(r) => r.no} exportName="indents" />
      </Panel>
    </>
  );
}

/* -------------------------------- Planning -------------------------------- */
const STEPS: [string, keyof Order["m"], keyof Order["m"], string][] = [["Approval → indent", "approved", "indent", C.orange], ["Indent → acceptance", "indent", "accept", C.c3], ["Acceptance → reporting", "accept", "report", C.c1], ["Reporting → dispatch", "report", "dispatch", C.c2]];
const avgStep = (rs: Order[], a: keyof Order["m"], b: keyof Order["m"]) => { const v = rs.filter((o) => o.m[a] && o.m[b]); return v.length ? sum(v, (o) => (+o.m[b]! - +o.m[a]!) / H) / v.length : 0; };
function Planning({ rows: all }: P) {
  const { openOrders } = useDrill();
  const rows = all.filter((o) => o.m.indent);
  const w2 = (rs: Order[]) => pct(rs.filter((o) => (+o.m.indent! - +o.m.approved!) / H <= 2).length, rs.length);
  const ct = MONTHS.map((m) => ({ month: m.label, ...Object.fromEntries(STEPS.map(([, a, b], j) => ["s" + j, +avgStep(rows.filter((o) => o.mk === m.key), a, b).toFixed(1)])) }));
  type MRow = { key: string; label: string; rs: Order[] };
  const cols: Col<MRow>[] = [
    { id: "m", header: "Month", value: (r) => r.key, cell: (r) => <span className="font-medium">{r.label}</span> },
    { id: "o", header: "Orders", align: "right", value: (r) => r.rs.length, cell: (r) => <LinkCell onClick={() => openOrders(`Orders · ${r.label}`, r.rs)}>{fmtN(r.rs.length)}</LinkCell> },
    { id: "w2", header: "Indent ≤ 2 h", align: "right", value: (r) => w2(r.rs) },
    ...STEPS.map(([l, a, b]) => ({ id: l, header: l, align: "right" as const, value: (r: MRow) => avgStep(r.rs, a, b), cell: (r: MRow) => avgStep(r.rs, a, b).toFixed(1) + " h" })),
    { id: "au", header: "Auction share", align: "right", value: (r) => pct(r.rs.filter((o) => o.src === "Auction").length, r.rs.length) },
    { id: "tot", header: "Approval → dispatch", align: "right", value: (r) => avgStep(r.rs, "approved", "dispatch"), cell: (r) => <span className="font-semibold">{avgStep(r.rs, "approved", "dispatch").toFixed(1)} h</span> },
  ];
  const plant = MONTHS.map((m) => ({ month: m.label, gn: +avgStep(rows.filter((o) => o.mk === m.key && o.plant === "GN"), "approved", "indent").toFixed(2), gzb: +avgStep(rows.filter((o) => o.mk === m.key && o.plant === "GZB"), "approved", "indent").toFixed(2) }));
  const src = MONTHS.map((m) => ({ month: m.label, ind: +avgStep(rows.filter((o) => o.mk === m.key && o.src === "Indent"), "indent", "accept").toFixed(2), auc: +avgStep(rows.filter((o) => o.mk === m.key && o.src === "Auction"), "indent", "accept").toFixed(2) }));
  return (
    <>
      <KpiRow>
        <Stat label="Orders planned" value={rows.length} />
        <Stat label="Indent within 2 h" value={w2(rows)} hint="of order approval" />
        {STEPS.map(([l, a, b, c]) => <Stat key={l} label={"Avg " + l.toLowerCase()} value={avgStep(rows, a, b).toFixed(1) + " h"} color={c} />)}
      </KpiRow>
      <Panel title="Order-to-dispatch cycle time by month" description="Average hours per leg, stacked to the total cycle"
        insight={(() => { const legs = STEPS.map(([l, a, b]) => ({ l, v: avgStep(rows, a, b) })).sort((x, y) => y.v - x.v); return `{{metric:${legs[0].l}|${legs[0].v.toFixed(1)} h|negative}} is the longest leg — ${pct(legs[0].v, sum(legs, "v"), 0)} of the order-to-dispatch cycle.`; })()}>
        <TrendChart data={ct} xKey="month" type="bar" stacked showLegend showYAxis yFormatter={(v) => v + " h"} className="h-72" series={STEPS.map(([l, , , c], j) => ({ key: "s" + j, label: l, color: c }))} />
      </Panel>
      <Grid>
        <Panel title="Approval → indent by plant" description="Average hours"
          insight={`Ghaziabad takes {{metric:${plant[5].gzb} h|vs ${plant[5].gn} h GN|${plant[5].gzb > plant[5].gn ? "negative" : "positive"}}} to raise an indent this month.`}>
          <TrendChart data={plant} xKey="month" type="line" showLegend showYAxis yFormatter={(v) => v + " h"} className="h-64" series={[{ key: "gn", label: "Greater Noida", color: C.c1 }, { key: "gzb", label: "Ghaziabad", color: C.c2 }]} />
        </Panel>
        <Panel title="Acceptance TAT · indent vs auction" description="Average hours from indent to acceptance"
          insight={`Auctions take {{metric:${(src[5].auc - src[5].ind).toFixed(1)} h longer|${src[5].auc} h|negative}} to close than direct indents — reserve them for lanes without a contracted carrier.`}>
          <TrendChart data={src} xKey="month" type="line" showLegend showYAxis yFormatter={(v) => v + " h"} className="h-64" series={[{ key: "ind", label: "Indent", color: C.c1 }, { key: "auc", label: "Auction", color: C.c4 }]} />
        </Panel>
      </Grid>
      <Panel title="Planning performance by month">
        <DataTable rows={MONTHS.map((m) => ({ key: m.key, label: m.label, rs: rows.filter((o) => o.mk === m.key) })).reverse()} cols={cols} pageSize={6} exportName="planning-performance" getRowId={(r) => r.key} />
      </Panel>
    </>
  );
}

/* ---------------------------- Dedicated fleet ----------------------------- */
function Dedicated() {
  const { openTrips, openTrip } = useDrill();
  const days = Array.from({ length: 15 }, (_, i) => new Date(+today0 - (14 - i) * DAY));
  const [dest, setDest] = React.useState<FilterValues>([]);
  const vt = trips.filter((t) => t.dedicated && t.created >= days[0] && inF(dest, "dest", t.dest));
  const [sel, setSel] = React.useState<string | null>(null);
  const workDays = days.filter((d) => d.getDay() !== 0).length;
  const idle = DEDICATED.map((d) => ({ d, n: days.filter((day) => day.getDay() !== 0 && !vt.some((t) => t.vno === d.vno && t.dk === dayKey(day))).length }));
  const idleTot = sum(idle, "n");
  const worstIdle = [...idle].sort((a, b) => b.n - a.n)[0];
  const sched = vt.filter((t) => +NOW - +t.created < 5 * DAY).map((t) => ({
    id: t.id, label: `${t.id} → ${t.dest}`, group: t.vno, owner: t.transporter, start: t.created,
    end: t.ms.destGateOut ?? new Date(Math.max(+NOW, +t.created + 12 * H)), progress: Math.min(1, t.stageIdx / 6), color: tStage(t.stage).color,
  }));
  return (
    <>
      <div>
        <FilterBar values={dest} onChange={setDest} fields={[{ key: "dest", label: "Destination", options: opts([...new Set(trips.filter((t) => t.dedicated).map((t) => t.dest))].sort()) }]} />
      </div>
      <KpiRow>
        {DEDICATED.map((d, i) => {
          const rs = vt.filter((t) => t.vno === d.vno);
          return <Stat key={d.vno} label={d.vno} value={rs.length} color={PALETTE[i]} selected={sel === d.vno} onClick={() => setSel(sel === d.vno ? null : d.vno)} hint={`${(rs.length / workDays).toFixed(1)}/day · ${d.len} ft`} />;
        })}
      </KpiRow>
      <Panel title="Daily utilisation · last 15 days" description="Trips per vehicle per day. Target is 2+ trips; empty cells are idle days — dedicated vehicles are paid a fixed monthly rate, so idle days are pure cost."
        info="Click a cell to see that day’s trips."
        insight={`{{metric:${idleTot} idle vehicle-days|${pct(idleTot, workDays * DEDICATED.length, 0)} of capacity|negative}} on working days. ${worstIdle.d.vno} (${worstIdle.d.tr}) sat idle ${worstIdle.n} days — reassign it to the busiest short-haul lane.`}>
        <HeatmapChart rows={DEDICATED.map((d) => ({ label: d.vno, values: days.map((day) => vt.filter((t) => t.vno === d.vno && t.dk === dayKey(day)).length) }))}
          columns={days.map((d) => fdDay(d))} valueFormatter={(v) => `${v} trip${v === 1 ? "" : "s"}`} max={3} levels={4} maxCellHeight={32}
          onCellClick={(c) => openTrips(`${c.rowLabel} · ${c.columnLabel}`, vt.filter((t) => t.vno === c.rowLabel && t.dk === dayKey(days[c.column])))} />
      </Panel>
      <Panel title="Vehicle schedule · last 5 days" description="Gantt of each dedicated vehicle’s trips (creation → unloading). Gaps between bars are idle time. Click a trip to open it."
        insight={`Turnaround between trips averages {{metric:${(() => { const gaps: number[] = []; DEDICATED.forEach((d) => { const ts = sched.filter((x) => x.group === d.vno).sort((a, b) => +a.start - +b.start); for (let i = 1; i < ts.length; i++) gaps.push((+ts[i].start - +ts[i - 1].end) / H); }); const pos = gaps.filter((x) => x > 0); return pos.length ? (pos.reduce((a, b) => a + b, 0) / pos.length).toFixed(1) : "0"; })()} h|idle gap|neutral}} per vehicle — the target is under 4 h for a 2-trip day.`}>
        <GanttChart tasks={sched} today={NOW} defaultZoom="day" height={460} groupOrder={DEDICATED.map((d) => d.vno)} dateFormatter={(d) => fdt(d)}
          onSelectedChange={(id) => { const t = vt.find((x) => x.id === id); if (t) openTrip(t); }} />
      </Panel>
      {sel ? (
        <Panel title={`Trips · ${sel}`}>
          <DataTable rows={vt.filter((t) => t.vno === sel).sort((a, b) => +b.created - +a.created)} cols={tripCols} getRowId={(r) => r.id} onRowClick={openTrip} exportName={`dedicated-${sel}`} />
        </Panel>
      ) : null}
    </>
  );
}

/* ---------------------------------- OTIF ---------------------------------- */
function Otif({ rows: all }: P) {
  const { openOrders } = useDrill();
  const { otif: th } = useApp();
  const [st, setSt] = React.useState<FilterValues>([]);
  const rows = all.filter((o) => inF(st, "st", o.otifStatus));
  const elig = (rs: Order[]) => rs.filter((o) => o.otif != null);
  const otifOf = (rs: Order[]) => { const e = elig(rs); return e.length ? sum(e, (o) => o.otif! * o.qty) / sum(e, "qty") : null; };
  const mtd = rows.filter((o) => o.mk === CUR_MONTH);
  const overall = otifOf(mtd);
  const line = MONTHS.map((m) => {
    const rs = rows.filter((o) => o.mk === m.key);
    const v = (p: (o: Order) => boolean) => { const x = otifOf(rs.filter(p)); return x == null ? null : +(x * 100).toFixed(1); };
    return { month: m.label, all: v(() => true), d: v((o) => o.type === "Direct Order"), s: v((o) => o.type === "Stock Transfer") };
  });
  const missed = mtd.filter((o) => o.otifStatus === "missed");
  const causes: [string, Order[]][] = [["Indent placed late", []], ["Late acceptance", []], ["Vehicle reported late", []], ["Short dispatch", []]];
  missed.forEach((o) => {
    if (o.onTime && o.dispQty < o.qty) causes[3][1].push(o);
    else if (o.m.indent && (+o.m.indent - +o.approved) / H > 3) causes[0][1].push(o);
    else if (o.m.accept && o.m.indent && (+o.m.accept - +o.m.indent) / H > 3) causes[1][1].push(o);
    else causes[2][1].push(o);
  });
  type MRow = { key: string; label: string; rs: Order[] };
  const cols: Col<MRow>[] = [
    { id: "m", header: "Month", value: (r) => r.key, cell: (r) => <span className="font-medium">{r.label}</span> },
    { id: "o", header: "Orders", align: "right", value: (r) => r.rs.length, cell: (r) => <LinkCell onClick={() => openOrders(`OTIF · ${r.label}`, r.rs)}>{fmtN(r.rs.length)}</LinkCell> },
    { id: "met", header: "Met", align: "right", value: (r) => r.rs.filter((o) => o.otifStatus === "met").length, cell: (r) => <Num tone="good">{r.rs.filter((o) => o.otifStatus === "met").length}</Num> },
    { id: "mis", header: "Missed", align: "right", value: (r) => r.rs.filter((o) => o.otifStatus === "missed").length, cell: (r) => <Num tone="bad">{r.rs.filter((o) => o.otifStatus === "missed").length}</Num> },
    { id: "na", header: "NA / at risk", align: "right", value: (r) => r.rs.filter((o) => o.otifStatus === "na" || o.otifStatus === "risk").length },
    { id: "p", header: "OTIF %", align: "right", value: (r) => otifOf(r.rs) ?? -1, cell: (r) => <OtifValue v={otifOf(r.rs)} t={th} /> },
    { id: "q", header: "Order qty", align: "right", value: (r) => sum(r.rs, "qty"), cell: (r) => fmtN(sum(r.rs, "qty")) },
    { id: "dq", header: "Dispatch qty", align: "right", value: (r) => sum(r.rs, "dispQty"), cell: (r) => fmtN(sum(r.rs, "dispQty")) },
    { id: "eq", header: "On-time dispatch qty", align: "right", value: (r) => sum(r.rs.filter((o) => o.onTime), "dispQty"), cell: (r) => fmtN(sum(r.rs.filter((o) => o.onTime), "dispQty")) },
  ];
  type DRow = [string, Order[]];
  const destRows = [...groupBy(mtd, (o) => o.dest).entries()].filter((x) => otifOf(x[1]) != null).sort((a, b) => otifOf(a[1])! - otifOf(b[1])!);
  const dcols: Col<DRow>[] = [
    { id: "d", header: "Destination", value: (r) => r[0], cell: (r) => <span className="font-medium">{r[0]}</span> },
    { id: "o", header: "Orders", align: "right", value: (r) => r[1].length, cell: (r) => <LinkCell onClick={() => openOrders(`OTIF MTD · ${r[0]}`, r[1])}>{r[1].length}</LinkCell> },
    { id: "p", header: "OTIF %", align: "right", value: (r) => otifOf(r[1]) ?? -1, cell: (r) => <OtifValue v={otifOf(r[1])} t={th} /> },
    { id: "m", header: "Missed", align: "right", value: (r) => r[1].filter((o) => o.otifStatus === "missed").length },
  ];
  const tone = otifTone(overall, th);
  return (
    <>
      <div>
        <FilterBar values={st} onChange={setSt} fields={[{ key: "st", label: "OTIF status", options: [{ value: "met", label: "OTIF met (100%)" }, { value: "missed", label: "OTIF missed" }, { value: "risk", label: "At risk (< 8 h to target)" }, { value: "na", label: "NA (target not reached)" }] }]}>
          <p className="m-0 mb-2 text-xs text-muted-foreground">Colour bands: green ≥ {th.green}% · amber ≥ {th.amber}% · red below — change in Settings</p>
        </FilterBar>
      </div>
      <Grid>
        <Panel span={4} title="MTD overall OTIF" description={`${elig(mtd).length} eligible orders`}
          insight={(() => { const d = otifOf(mtd.filter((o) => o.type === "Direct Order")), st2 = otifOf(mtd.filter((o) => o.type === "Stock Transfer")); return d != null && st2 != null ? `Direct orders trail stock transfers by {{metric:|${((st2 - d) * 100).toFixed(1)} pts|${st2 > d ? "negative" : "positive"}}} — their 48 h target is tighter.` : null; })()}>
          <div className="flex justify-center py-2">
            <RadialGauge value={(overall ?? 0) * 100} max={100} size={220} zones={[{ from: 0, to: th.amber, color: C.bad }, { from: th.amber, to: th.green, color: C.warn }, { from: th.green, to: 100, color: C.good }]}>
              <div className="text-center"><div className={"text-3xl font-semibold tracking-[-0.035em] tabular-nums " + (tone === "good" ? "text-emerald-600 dark:text-emerald-400" : tone === "warn" ? "text-amber-600" : "text-rose-600")}>{overall == null ? "NA" : (overall * 100).toFixed(1) + "%"}</div><div className="text-xs text-muted-foreground">target {th.green}%</div></div>
            </RadialGauge>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {(["Direct Order", "Stock Transfer"] as const).map((t) => { const v = otifOf(mtd.filter((o) => o.type === t)); return <div key={t} className="inset-panel p-3"><div className="text-xs text-muted-foreground">{t}</div><div className="text-lg font-semibold tabular-nums"><OtifValue v={v} t={th} /></div></div>; })}
          </div>
        </Panel>
        <Panel span={8} title="Monthly OTIF %" description="Direct vs stock transfer, with the target line"
          insight={(() => { const below = line.filter((x) => x.d != null && x.d < th.green).length; return `Direct orders missed the {{metric:${th.green}% target|${below} of 6 months|${below > 2 ? "negative" : "neutral"}}}; stock transfers stayed above it every month.`; })()} info="OTIF % = qty dispatched by the target date (approval + 48 h direct / 72 h stock transfer) ÷ order qty.">
          <ComposedChart data={line} xKey="month" showYAxis showLegend yDomain="auto" yFormatter={(v) => v + "%"} className="h-80"
            referenceLines={[{ y: th.green, label: `Target ${th.green}%`, color: C.good, dashed: true }]}
            series={[{ key: "all", label: "Overall", type: "line", color: "var(--color-foreground)", dots: true }, { key: "d", label: "Direct", type: "line", color: C.c1, dots: true }, { key: "s", label: "Stock transfer", type: "line", color: C.orange, dots: true }]} />
        </Panel>
      </Grid>
      <KpiRow className="xl:grid-cols-4">
        <Stat label="At risk now" value={rows.filter((o) => o.otifStatus === "risk").length} color={C.orange} hint="Target within 8 h, not dispatched" onClick={() => openOrders("At-risk orders", rows.filter((o) => o.otifStatus === "risk"))} />
        <Stat label="Missed MTD" value={missed.length} color={C.bad} onClick={() => openOrders("Missed OTIF · MTD", missed)} />
        <Stat label="Met MTD" value={mtd.filter((o) => o.otifStatus === "met").length} color={C.good} />
        <Stat label="Short-dispatched MTD" value={causes[3][1].length} hint="On time, not in full" />
      </KpiRow>
      <Grid>
        <Panel span={12} title="Order outcome flow (MTD)" description="Order type → OTIF outcome → root cause of misses" info="Follow each band to see where misses come from."
          insight={`{{metric:Short dispatch|${pct(causes[3][1].length, missed.length || 1, 0)} of misses|negative}} — orders left on time but not in full. Fixing load planning recovers more OTIF than chasing transporters.`}>
          <SankeyChart className="h-[320px]" valueFormatter={(v) => `${v} orders`} showShares
            nodes={[{ name: "Direct Order", color: C.c1 }, { name: "Stock Transfer", color: C.orange }, { name: "Met", color: C.good }, { name: "Missed", color: C.bad }, { name: "Pending", color: C.muted }, ...causes.filter((c) => c[1].length).map((c) => ({ name: c[0], color: C.bad }))]}
            links={[
              ...(["Direct Order", "Stock Transfer"] as const).flatMap((t) => [
                { source: t, target: "Met", value: mtd.filter((o) => o.type === t && o.otifStatus === "met").length },
                { source: t, target: "Missed", value: mtd.filter((o) => o.type === t && o.otifStatus === "missed").length },
                { source: t, target: "Pending", value: mtd.filter((o) => o.type === t && (o.otifStatus === "na" || o.otifStatus === "risk")).length },
              ]),
              ...causes.filter((c) => c[1].length).map((c) => ({ source: "Missed", target: c[0], value: c[1].length })),
            ].filter((l) => l.value > 0)} />
        </Panel>
        <Panel title="Missed OTIF · root cause (MTD)" description="Ranked; click to see the orders" info="A ranked bar list compares causes more precisely than a doughnut.">
          <BarList data={causes.map(([n, rs]) => ({ name: n, value: rs.length }))} color={C.bad} showPercentage valueFormatter={fmtN} onItemClick={(i) => openOrders(`Missed OTIF · ${i.name}`, causes.find((c) => c[0] === i.name)![1])} />
        </Panel>
        <Panel title="Destination-wise OTIF (MTD)" description="Worst first"
          insight={destRows.length ? `{{metric:${destRows[0][0]}|${((otifOf(destRows[0][1]) ?? 0) * 100).toFixed(1)}%|negative}} is the weakest destination this month.` : null}>
          <DataTable rows={destRows} cols={dcols} pageSize={8} getRowId={(r) => r[0]} />
        </Panel>
      </Grid>
      <Panel title="Month-wise OTIF">
        <DataTable rows={MONTHS.map((m) => ({ key: m.key, label: m.label, rs: rows.filter((o) => o.mk === m.key) })).reverse()} cols={cols} pageSize={6} exportName="otif-by-month" getRowId={(r) => r.key} />
      </Panel>
    </>
  );
}

/* --------------------------------- E-com ---------------------------------- */
const EST: [string, "warning" | "neutral" | "info" | "success" | "error", string][] = [["Appointment Pending", "warning", C.c3], ["Appointment Booked", "neutral", C.muted], ["Dispatched", "info", C.c1], ["Delivered", "success", C.good], ["GRN Pending", "warning", C.orange], ["Appointment Missed", "error", C.bad]];
function Ecom() {
  const [pf, setPf] = React.useState<FilterValues>([]);
  const [sel, setSel] = React.useState<string | null>(null);
  const rows = ecomOrders.filter((o) => inF(pf, "p", o.plat));
  const del = rows.filter((o) => o.fill != null);
  const next7 = Array.from({ length: 7 }, (_, i) => new Date(+today0 + i * DAY));
  const data = next7.map((d) => ({ day: fdShort(d), ...Object.fromEntries(PLATFORMS.map((p, j) => ["s" + j, rows.filter((o) => o.plat === p && dayKey(o.appt) === dayKey(d)).length])) }));
  const list = rows.filter((o) => !sel || o.status === sel);
  const cols: Col<EcomOrder>[] = [
    { id: "po", header: "PO number", value: (r) => r.po, cell: (r) => <span className="font-mono text-xs font-medium">{r.po}</span> },
    { id: "p", header: "Platform", value: (r) => r.plat },
    { id: "fc", header: "Warehouse / FC", value: (r) => r.fc },
    { id: "pd", header: "PO date", value: (r) => +r.poDate, cell: (r) => fd(r.poDate) },
    { id: "ap", header: "Appointment", value: (r) => +r.appt, cell: (r) => fdt(r.appt) },
    { id: "st", header: "Status", value: (r) => r.status, cell: (r) => <Pill tone={EST.find((s) => s[0] === r.status)![1]}>{r.status}</Pill> },
    { id: "q", header: "PO qty", align: "right", value: (r) => r.qty, cell: (r) => fmtN(r.qty) },
    { id: "dq", header: "Delivered", align: "right", value: (r) => r.fill ?? -1, cell: (r) => (r.fill != null ? fmtN(r.fill) : <span className="text-muted-foreground">{r.status === "Dispatched" ? "In transit" : r.status === "Appointment Missed" ? "Rebook" : `Due ${fdShort(r.appt)}`}</span>) },
    { id: "f", header: "Fill %", align: "right", value: (r) => (r.fill != null ? r.fill / r.qty : -1), cell: (r) => (r.fill != null ? pct(r.fill, r.qty, 0) : <span className="text-muted-foreground">Pending</span>) },
    { id: "v", header: "PO value", align: "right", value: (r) => r.value, cell: (r) => inr(r.value) },
  ];
  return (
    <>
      <div><FilterBar values={pf} onChange={setPf} fields={[{ key: "p", label: "Platform", options: opts(PLATFORMS) }]} /></div>
      <KpiRow>
        {EST.map(([s, , c]) => <Stat key={s} label={s} value={rows.filter((o) => o.status === s).length} color={c} selected={sel === s} onClick={() => setSel(sel === s ? null : s)} />)}
        <Stat label="Fill rate" value={pct(sum(del, (o) => o.fill!), sum(del, "qty"))} hint="Delivered ÷ PO qty" />
      </KpiRow>
      <Panel title="Appointments · next 7 days" description="By platform"
        insight={(() => { const tot = data.map((d) => PLATFORMS.reduce((a, _, j) => a + Number((d as Record<string, unknown>)["s" + j]), 0)); const pk = tot.indexOf(Math.max(...tot)); const missedN = rows.filter((o) => o.status === "Appointment Missed").length; return `Peak day {{metric:${data[pk].day}|${tot[pk]} slots|neutral}}. ${missedN} missed appointments in 5 weeks — each one is a re-booking and a chargeback risk.`; })()}>
        <TrendChart data={data} xKey="day" type="bar" stacked showLegend showYAxis className="h-64" series={PLATFORMS.map((p, j) => ({ key: "s" + j, label: p, color: PALETTE[j] }))} />
      </Panel>
      <Panel title={`E-com appointment orders${sel ? " · " + sel : ""}`} description={`${list.length} purchase orders`}>
        <DataTable rows={list} cols={cols} search={(r) => [r.po, r.plat, r.fc].join(" ")} getRowId={(r) => r.po} exportName="ecom-appointments" />
      </Panel>
    </>
  );
}

