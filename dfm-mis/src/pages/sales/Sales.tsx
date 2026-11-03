import * as React from "react";
import { useParams } from "react-router-dom";
import { IconChevronDown, IconChevronRight, IconDeviceFloppy } from "@tabler/icons-react";
import { TrendChart } from "@/components/overtrue/trend-chart";
import { ComposedChart } from "@/components/overtrue/composed-chart";
import { BulletChart } from "@/components/overtrue/bullet-chart";
import { BarList } from "@/components/overtrue/bar-list";
import { DonutChart } from "@/components/overtrue/donut-chart";
import { DeltaBadge } from "@/components/overtrue/delta-badge";
import { SegmentedMeter } from "@/components/overtrue/segmented-meter";
import { StackedAreaChart } from "@/components/overtrue/stacked-area-chart";
import { InsightLine } from "@/components/app/kit";
import { AxisFrame } from "@/components/app/kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/select";
import { ModulePage } from "@/components/app/module";
import { DataTable, Foot, Grid, KpiRow, Num, Panel, Stat, Toggle, type Col } from "@/components/app/kit";
import { useApp, usePersistentState } from "@/state/app";
import { C, PALETTE } from "@/data/colors";
import { ASMS, BRANDS, CHANNELS, MONTHS, ZONES, asmDay, asmTarget, type Asm } from "@/data/data";
import { cr, crAxis, fd, fdDay, pct, pctv, sum } from "@/data/format";
import {
  PRESETS, asmPeriod, asmPeriodTarget, brandNodes, channelNodes, eachDay, mixFactor, monthContext, periodRange, salesTotal, shiftRange, teamNodes,
  type Range, type SalesNode,
} from "@/data/sales";
import { cn } from "@/lib/utils";

const achTone = (a: number) => (a >= 100 ? "good" : a >= 90 ? "warn" : "bad");

export default function Sales() {
  const { tab = "team" } = useParams();
  const [preset, setPreset] = usePersistentState("sales.preset", "month");
  const [compare, setCompare] = usePersistentState("sales.compare", "last_month");
  const range = periodRange(preset);
  const cmp = shiftRange(range, compare);
  const cmpLabel = compare === "lysm" ? "LYSM" : "Last month";
  return (
    <ModulePage moduleId="sales" tab={tab} updated={new Date(+new Date(2026, 9, 28, 15, 0))}
      filters={
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="flex flex-col gap-1.5"><span className="text-xs text-muted-foreground">Period</span><Toggle label="Period" value={preset} onChange={setPreset} options={PRESETS as [string, string][]} /></div>
          <div className="flex flex-col gap-1.5"><span className="text-xs text-muted-foreground">Compare with</span>
            <FormSelect value={compare} onChange={(e) => setCompare(e.target.value)} className="h-9 w-56" aria-label="Compare with">
              <option value="last_month">Last month (same days)</option>
              <option value="lysm">LYSM (last year, same period)</option>
            </FormSelect>
          </div>
          <span className="pb-2 text-xs text-muted-foreground tabular-nums">{fd(range[0])} → {fd(range[1])} vs {fd(cmp[0])} → {fd(cmp[1])}</span>
        </div>
      }
    >
      {tab !== "builder" && <SalesKpis range={range} cmp={cmp} cmpLabel={cmpLabel} />}
      {tab === "team" && <Team range={range} cmp={cmp} cmpLabel={cmpLabel} preset={preset} />}
      {tab === "brand" && <Brand range={range} cmp={cmp} cmpLabel={cmpLabel} />}
      {tab === "channel" && <Channel range={range} cmp={cmp} cmpLabel={cmpLabel} compare={compare} />}
      {tab === "builder" && <Builder range={range} />}
    </ModulePage>
  );
}

type SP = { range: Range; cmp: Range; cmpLabel: string };

function SalesKpis({ range, cmp, cmpLabel }: SP) {
  const cur = salesTotal(range), prev = salesTotal(cmp);
  const mc = monthContext();
  const ach = pctv(cur.sales, cur.target);
  return (
    <>
      <KpiRow className="xl:grid-cols-5">
        <Stat label="Secondary sales" value={cr(cur.sales)} hint={`Target ${cr(cur.target)}`} />
        <Stat label="Achievement" value={ach.toFixed(1) + "%"} hint={<Num tone={achTone(ach)}>{ach >= 100 ? "Ahead of target" : `${cr(cur.target - cur.sales)} gap`}</Num>} />
        <Stat label={`Growth vs ${cmpLabel}`} value={cr(cur.sales - prev.sales)} delta={prev.sales ? cur.sales / prev.sales - 1 : 0} hint={`${cmpLabel}: ${cr(prev.sales)}`} />
        <Stat label="Month target" value={cr(mc.mTarget)} hint={`${pct(mc.mtd.sales, mc.mTarget)} achieved MTD`} />
        <Stat label="Required run-rate / day" value={cr(mc.required)} hint={`${mc.daysLeft} days left · current ${cr(mc.runRate)}/day`} />
      </KpiRow>
      <div className="surface-card p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
          <span className="font-medium">Month pacing</span>
          <span className="text-muted-foreground tabular-nums">MTD {cr(mc.mtd.sales)} of {cr(mc.mTarget)} · need {cr(mc.required)}/day vs {cr(mc.runRate)}/day today</span>
        </div>
        <SegmentedMeter value={pctv(mc.mtd.sales, mc.mTarget)} zones={[{ label: "Behind", from: 0, to: 70, color: C.bad }, { label: "Catching up", from: 70, to: 90, color: C.warn }, { label: "On pace", from: 90, to: 100, color: C.good }]} showLabels showMarker tickFormatter={(v) => v + "%"} />
        <InsightLine text={mc.required > mc.runRate
          ? `To hit target, daily sales must rise to {{metric:${cr(mc.required)}/day|+${pct(mc.required - mc.runRate, mc.runRate, 0)}|negative}} for the last ${mc.daysLeft} days. The month-end push typically adds ~30%, so the gap is ${mc.required / mc.runRate > 1.3 ? "unlikely to close without a scheme" : "closable"}.`
          : `On pace: current run-rate {{metric:${cr(mc.runRate)}/day|ahead|positive}} already exceeds what is needed.`} />
      </div>
    </>
  );
}

/* ------------------------------ Hierarchy table --------------------------- */
function HierTable({ title, nodes, cmpLabel, range }: { title: string; nodes: SalesNode[]; cmpLabel: string; range: Range }) {
  const [open, setOpen] = React.useState<Set<string>>(new Set());
  const total = { sales: sum(nodes, "sales"), target: sum(nodes, "target"), cmp: sum(nodes, "cmp") };
  const allKeys = nodes.flatMap(function k(n: SalesNode): string[] { return n.children ? [n.key, ...n.children.flatMap(k)] : []; });
  const rows: { n: SalesNode; lvl: number }[] = [];
  const walk = (n: SalesNode, lvl: number) => { rows.push({ n, lvl }); if (n.children && open.has(n.key)) n.children.forEach((c) => walk(c, lvl + 1)); };
  nodes.forEach((n) => walk(n, 0));
  const cells = (n: { sales: number; target: number; cmp: number }) => {
    const a = pctv(n.sales, n.target);
    return (
      <>
        <TableCell className="text-right tabular-nums">{cr(n.sales)}</TableCell>
        <TableCell className="text-right tabular-nums">{cr(n.target)}</TableCell>
        <TableCell className="text-right"><div className="flex items-center justify-end gap-2"><div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block"><div className={cn("h-full rounded-full", a >= 100 ? "bg-emerald-500" : a >= 90 ? "bg-amber-500" : "bg-rose-500")} style={{ width: Math.min(100, a) + "%" }} /></div><Num tone={achTone(a)}>{a.toFixed(1)}%</Num></div></TableCell>
        <TableCell className="text-right tabular-nums">{n.target > n.sales ? <Num tone="bad">{cr(n.target - n.sales)}</Num> : <Num tone="good">✓</Num>}</TableCell>
        <TableCell className="text-right tabular-nums">{cr(n.cmp)}</TableCell>
        <TableCell className="text-right"><DeltaBadge delta={n.cmp ? n.sales / n.cmp - 1 : 0} variant="text" /></TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">{pct(n.sales, total.sales)}</TableCell>
      </>
    );
  };
  return (
    <Panel title={title} description={`Click a row to drill down · ${fd(range[0])} → ${fd(range[1])}`} span={12}
      insight={(() => { const gap = [...nodes].sort((a, b) => (b.target - b.sales) - (a.target - a.sales))[0]; const gr = [...nodes].sort((a, b) => b.sales / (b.cmp || 1) - a.sales / (a.cmp || 1))[0]; return `{{metric:${gap.label}|${cr(Math.max(0, gap.target - gap.sales))} gap|negative}} is the largest shortfall to target; {{metric:${gr.label}|+${pct(gr.sales - gr.cmp, gr.cmp)}|positive}} is growing fastest vs ${cmpLabel}.`; })()}
      actions={<div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setOpen(new Set(allKeys))}>Expand all</Button><Button size="sm" variant="ghost" onClick={() => setOpen(new Set())}>Collapse</Button></div>}>
      <div className="overflow-x-auto rounded-xl ring-1 ring-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead className="text-right">Sales</TableHead><TableHead className="text-right">Target</TableHead><TableHead className="text-right">Achv %</TableHead>
              <TableHead className="text-right">Gap</TableHead><TableHead className="text-right">{cmpLabel}</TableHead><TableHead className="text-right">Growth</TableHead><TableHead className="text-right">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ n, lvl }) => {
              const has = !!n.children?.length;
              return (
                <TableRow key={n.key} className={cn(has && "cursor-pointer", lvl === 0 && "font-medium")} onClick={has ? () => setOpen((s) => { const x = new Set(s); if (x.has(n.key)) x.delete(n.key); else x.add(n.key); return x; }) : undefined}
                  aria-expanded={has ? open.has(n.key) : undefined}>
                  <TableCell className="whitespace-nowrap" style={{ paddingLeft: 12 + lvl * 22 }}>
                    <span className="inline-flex items-center gap-1.5">
                      {has ? (open.has(n.key) ? <IconChevronDown className="size-4 text-muted-foreground" /> : <IconChevronRight className="size-4 text-muted-foreground" />) : <span className="inline-block w-4" />}
                      {n.label}
                      {n.kind && lvl > 0 ? <span className="text-xs font-normal text-muted-foreground">{n.kind}</span> : null}
                    </span>
                  </TableCell>
                  {cells(n)}
                </TableRow>
              );
            })}
            <TableRow className="bg-muted/40 font-semibold"><TableCell>Total</TableCell>{cells(total)}</TableRow>
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}

/* ---------------------------------- Team ---------------------------------- */
function Team({ range, cmp, cmpLabel, preset }: SP & { preset: string }) {
  const nodes = teamNodes(range, cmp);
  const days: Date[] = [];
  eachDay(preset === "year" || preset === "today" || preset === "yesterday" ? [new Date(+range[1] - 29 * 864e5), range[1]] : range, (d) => days.push(new Date(d)));
  const daily = days.map((d) => ({ day: fdDay(d), sales: sum(ASMS, (a) => asmDay(a, d)), target: sum(ASMS, (a) => asmTarget(a, d.getFullYear(), d.getMonth())) / new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() }));
  const leader = ASMS.map((a) => ({ a, s: asmPeriod(a, range), t: asmPeriodTarget(a, range) })).map((x) => ({ ...x, ach: (x.s / x.t) * 100 })).sort((x, y) => y.ach - x.ach);
  return (
    <>
      <Grid>
        <Panel span={5} title="Zone achievement" description="Bar = achievement · tick = 100% · bands at 85% / 95%"
          insight={(() => { const z = [...nodes].sort((a, b) => a.sales / a.target - b.sales / b.target); return `Only {{metric:${nodes.filter((n) => n.sales >= n.target * 0.95).length} of ${nodes.length} zones|≥ 95%|neutral}} are near target. ${z[0].label.split(" – ")[0]} lags at {{metric:|${pct(z[0].sales, z[0].target, 0)}|negative}}.`; })()} info="A bullet chart shows actual vs target in a compact row per zone — clearer than side-by-side bars.">
          <BulletChart tone="status" items={nodes.map((n) => ({ id: n.key, label: n.label.split(" – ")[0], sublabel: `${cr(n.sales)} of ${cr(n.target)}`, value: n.sales / n.target, target: 1, ranges: [0.85, 0.95, 1.15] as [number, number, number], max: 1.2 }))} valueFormatter={(v) => (v * 100).toFixed(0) + "%"} />
        </Panel>
        <Panel span={7} title="Daily sales vs target pace" description={preset === "month" || preset === "last_month" || preset === "week" ? "Selected period" : "Last 30 days"}
          insight={(() => { const above = daily.filter((d) => d.sales >= d.target).length; return `Sales beat the daily pace on {{metric:${above} of ${daily.length} days|${pct(above, daily.length, 0)}|${above / daily.length >= 0.5 ? "positive" : "negative"}}}; Sundays and the first 3 days of the month drag the average.`; })()}>
          <AxisFrame y="Secondary sales (₹)" x="Day · line = daily target pace"><ComposedChart data={daily} xKey="day" showYAxis showLegend yFormatter={crAxis} className="h-72"
            series={[{ key: "sales", label: "Sales", type: "bar" }, { key: "target", label: "Daily target pace", type: "line", dashed: true, color: C.c3 }]} /></AxisFrame>
          <Foot>Month-end push is visible in the last 5 days of each month; Sundays dip.</Foot>
        </Panel>
      </Grid>
      <HierTable title="Team-wise sales · Zone › Region › ASM" nodes={nodes} cmpLabel={cmpLabel} range={range} />
      <Grid>
        <Panel title="Top 5 ASMs" description="By achievement %" insight={`${leader.filter((x) => x.ach >= 100).length} of ${leader.length} ASMs are at or above target; {{metric:${leader[0].a.name}|${leader[0].ach.toFixed(1)}%|positive}} leads.`}>
          <BarList data={leader.slice(0, 5).map((x) => ({ name: `${x.a.name} · ${x.a.region}`, value: x.ach }))} color={C.good} valueFormatter={(v) => v.toFixed(1) + "%"} />
        </Panel>
        <Panel title="Bottom 5 ASMs" description="Need support before month-end" insight={`Bottom 5 are ${cr(sum(leader.slice(-5), (x) => Math.max(0, x.t - x.s)))} short combined — ${pct(sum(leader.slice(-5), (x) => Math.max(0, x.t - x.s)), sum(leader, (x) => Math.max(0, x.t - x.s)), 0)} of the company’s total gap.`}>
          <BarList data={leader.slice(-5).map((x) => ({ name: `${x.a.name} · ${x.a.region}`, value: x.ach }))} sortOrder="ascending" color={C.bad} valueFormatter={(v) => v.toFixed(1) + "%"} />
        </Panel>
      </Grid>
    </>
  );
}

/* ---------------------------------- Brand --------------------------------- */
function Brand({ range, cmp, cmpLabel }: SP) {
  const nodes = brandNodes(range, cmp);
  const growth = nodes.map((n) => ({ brand: n.label.replace("CRAX ", ""), cur: n.sales, prev: n.cmp }));
  const trend = MONTHS.map((m) => { const r: Range = [m.date, new Date(Math.min(+new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0), +range[1]))]; const ns = brandNodes(r, r); return { month: m.label, ...Object.fromEntries(ns.map((n, i) => ["b" + i, Math.round(n.sales)])) } as Record<string, string | number>; });
  const small = nodes.flatMap((n) => n.children!).filter((c) => c.label === "₹5 Pack");
  const fastest = [...nodes].sort((a, b) => b.sales / b.cmp - a.sales / a.cmp)[0];
  return (
    <>
      <Grid>
        <Panel span={7} title="Sales by brand and pack size" description="Secondary sales for each brand, split by pack price point"
          insight={`{{metric:₹5 packs|${pct(sum(small, "sales"), sum(nodes, "sales"), 0)}|neutral}} of brand sales — a price-point business. ${nodes[0].label} is the anchor at ${pct(nodes[0].sales, sum(nodes, "sales"), 0)}.`}>
          <AxisFrame y="Brand" x="Secondary sales (₹) · colour = pack size">
            <TrendChart data={nodes.map((n) => ({ brand: n.label, ...Object.fromEntries(n.children!.map((c, j) => ["p" + j, Math.round(c.sales)])) }))} xKey="brand" type="bar" layout="horizontal" stacked showLegend showYAxis yFormatter={crAxis} className="h-[340px]"
              series={nodes[0].children!.map((c, j) => ({ key: "p" + j, label: c.label, color: PALETTE[j] }))} />
          </AxisFrame>
        </Panel>
        <Panel span={5} title={`Brand sales vs ${cmpLabel}`} insight={`{{metric:${fastest.label}|+${pct(fastest.sales - fastest.cmp, fastest.cmp)}|positive}} is growing fastest vs ${cmpLabel}.`}>
          <AxisFrame y="Secondary sales (₹)" x={`Brand · current period vs ${cmpLabel}`}><TrendChart data={growth} xKey="brand" type="bar" showLegend showYAxis yFormatter={crAxis} className="h-[340px]" series={[{ key: "cur", label: "Current", color: C.c1 }, { key: "prev", label: cmpLabel, color: C.muted }]} /></AxisFrame>
        </Panel>
      </Grid>
      <Grid>
        <Panel span={12} title="Brand share trend · last 6 months" description="100% stacked — how each brand’s share of sales is moving" info="A 100% stacked area shows share shifts that absolute bars hide."
          insight={(() => { const tot = (r: Record<string, unknown>) => nodes.reduce((a, _, i) => a + Number(r["b" + i]), 0); const sh = nodes.map((n, i) => ({ n, d: (Number(trend[5]["b" + i]) / tot(trend[5]) - Number(trend[0]["b" + i]) / tot(trend[0])) * 100 })).sort((a, b) => b.d - a.d); return `{{metric:${sh[0].n.label}|${sh[0].d >= 0 ? "+" : ""}${sh[0].d.toFixed(1)} pts|positive}} gained the most share since ${MONTHS[0].label}; {{metric:${sh[sh.length - 1].n.label}|${sh[sh.length - 1].d.toFixed(1)} pts|negative}} lost the most.`; })()}>
          <AxisFrame y="Share of secondary sales (%)" x="Month · colour = brand"><StackedAreaChart data={trend} index="month" stack="expand" height={260} showLegend valueFormatter={(v) => cr(v)} series={nodes.map((n, i) => ({ key: "b" + i, label: n.label, color: PALETTE[i] }))} /></AxisFrame>
        </Panel>
      </Grid>
      <HierTable title="Brand-wise sales · Brand › Pack" nodes={nodes} cmpLabel={cmpLabel} range={range} />
    </>
  );
}

/* --------------------------------- Channel -------------------------------- */
function Channel({ range, cmp, cmpLabel, compare }: SP & { compare: string }) {
  const nodes = channelNodes(range, cmp, compare);
  const tot = sum(nodes, "sales");
  const trend = MONTHS.map((m) => { const r: Range = [m.date, new Date(Math.min(+new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0), +range[1]))]; const ns = channelNodes(r, r, compare); return { month: m.label, ...Object.fromEntries(ns.map((n, i) => ["c" + i, Math.round(n.sales)])) } as Record<string, string | number>; });
  const ecom = nodes.find((n) => n.label.startsWith("E-"))!;
  const subs = nodes.flatMap((n) => n.children!.map((c) => ({ name: c.label, value: c.cmp ? (c.sales / c.cmp - 1) * 100 : 0 }))).sort((a, b) => b.value - a.value);
  return (
    <>
      <Grid>
        <Panel span={5} title="Channel mix" description="Share of secondary sales"
          insight={`General trade is still {{metric:${pct(nodes[0].sales, tot, 0)}|of sales|neutral}}; e-com & q-comm is {{metric:${pct(ecom.sales, tot, 1)}|+${pct(ecom.sales - ecom.cmp, ecom.cmp, 0)} vs ${cmpLabel}|positive}}.`}>
          <DonutChart data={nodes.map((n, i) => ({ name: n.label, value: n.sales, color: PALETTE[i] }))} valueFormatter={(v) => cr(v)} centerLabel="Total" centerValue={cr(tot)} legendPosition="right" className="h-72" />
        </Panel>
        <Panel span={7} title={`Channel sales vs ${cmpLabel}`} insight={(() => { const w = [...nodes].sort((a, b) => a.sales / a.cmp - b.sales / b.cmp)[0]; return `{{metric:${w.label}|${pct(w.sales - w.cmp, w.cmp)}|${w.sales >= w.cmp ? "neutral" : "negative"}}} is the slowest channel vs ${cmpLabel}.`; })()} info="Quick-commerce (Blinkit, Zepto, Instamart) is the fastest-growing sub-channel.">
          <AxisFrame y="Secondary sales (₹)" x={`Channel · current period vs ${cmpLabel}`}><TrendChart data={nodes.map((n) => ({ ch: n.label.replace(" & ", " / "), cur: n.sales, prev: n.cmp }))} xKey="ch" type="bar" showLegend showYAxis yFormatter={crAxis} className="h-72" series={[{ key: "cur", label: "Current", color: C.c1 }, { key: "prev", label: cmpLabel, color: C.muted }]} /></AxisFrame>
        </Panel>
      </Grid>
      <Grid>
      <Panel span={7} title="Channel share trend · last 6 months" description="100% stacked area of each channel’s share"
        insight={`E-com & q-comm share moved from {{metric:${MONTHS[0].label}|${pct(Number(trend[0].c2), nodes.reduce((a, _, i) => a + Number(trend[0]["c" + i]), 0))}|neutral}} to {{metric:${MONTHS[5].label}|${pct(Number(trend[5].c2), nodes.reduce((a, _, i) => a + Number(trend[5]["c" + i]), 0))}|positive}}.`}>
        <AxisFrame y="Share of secondary sales (%)" x="Month · colour = channel"><StackedAreaChart data={trend} index="month" stack="expand" height={260} showLegend valueFormatter={(v) => cr(v)} series={nodes.map((n, i) => ({ key: "c" + i, label: n.label, color: PALETTE[i] }))} /></AxisFrame>
      </Panel>
      <Panel span={5} title="Fastest-growing sub-channels" description={`Growth vs ${cmpLabel}`} insight={subs.length ? `{{metric:${subs[0].name}|+${subs[0].value.toFixed(1)}%|positive}} leads growth — quick-commerce accounts dominate the top of this list.` : null}>
        <BarList data={subs.slice(0, 8).map((s) => ({ name: s.name, value: Math.max(0, s.value) }))} color={C.good} valueFormatter={(v) => "+" + v.toFixed(1) + "%"} />
      </Panel>
      </Grid>
      <HierTable title="Channel-wise sales · Channel › Sub-channel" nodes={nodes} cmpLabel={cmpLabel} range={range} />
    </>
  );
}

/* ---------------------------------- BYOD ---------------------------------- */
function Builder({ range }: { range: Range }) {
  const { toast } = useApp();
  const [b, setB] = usePersistentState("sales.byod", { dim: "zone", metric: "sales", chart: "bar" });
  const T0 = salesTotal(range);
  const pts: { l: string; s: number; t: number }[] = [];
  const agg = (l: Asm[]) => ({ s: sum(l, (a) => asmPeriod(a, range)), t: sum(l, (a) => asmPeriodTarget(a, range)) });
  if (b.dim === "zone") ZONES.forEach(([z]) => pts.push({ l: z.split(" – ")[0], ...agg(ASMS.filter((a) => a.zone === z)) }));
  else if (b.dim === "region") ZONES.forEach(([, regs]) => regs.forEach(([r]) => pts.push({ l: r, ...agg(ASMS.filter((a) => a.region === r)) })));
  else if (b.dim === "brand") BRANDS.forEach(([n, sh], i) => pts.push({ l: n, s: T0.sales * sh * mixFactor(i, 0, range), t: T0.target * sh }));
  else if (b.dim === "channel") CHANNELS.forEach(([n, sh], i) => pts.push({ l: n, s: T0.sales * sh * mixFactor(i, 9, range), t: T0.target * sh }));
  else MONTHS.forEach((m) => { const t = salesTotal([m.date, new Date(Math.min(+new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0), +range[1]))]); pts.push({ l: m.label, s: t.sales, t: t.target }); });
  const val = (p: { s: number; t: number }) => (b.metric === "sales" ? p.s : b.metric === "target" ? p.t : +pctv(p.s, p.t).toFixed(1));
  const fmt = b.metric === "ach" ? (v: number) => v + "%" : crAxis;
  const mLabel = ({ sales: "Sales", target: "Target", ach: "Achievement %" } as Record<string, string>)[b.metric];
  const sel = (k: "dim" | "metric" | "chart", label: string, o: [string, string][]) => (
    <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">{label}
      <FormSelect value={b[k]} onChange={(e) => setB({ ...b, [k]: e.target.value })} className="h-9 w-44 text-sm text-foreground">{o.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</FormSelect>
    </label>
  );
  const data = pts.map((p) => ({ l: p.l, v: val(p) }));
  const cols: Col<{ l: string; s: number; t: number }>[] = [
    { id: "l", header: b.dim[0].toUpperCase() + b.dim.slice(1), value: (r) => r.l, cell: (r) => <span className="font-medium">{r.l}</span> },
    { id: "s", header: "Sales", align: "right", value: (r) => r.s, cell: (r) => cr(r.s) },
    { id: "t", header: "Target", align: "right", value: (r) => r.t, cell: (r) => cr(r.t) },
    { id: "a", header: "Achv %", align: "right", value: (r) => pctv(r.s, r.t), cell: (r) => <Num tone={achTone(pctv(r.s, r.t))}>{pct(r.s, r.t)}</Num> },
  ];
  return (
    <>
      <Panel title="Build your own view" description="Pick a dimension, a metric and a chart. Your choice is remembered on this device.">
        <div className="flex flex-wrap items-end gap-4">
          {sel("dim", "Dimension", [["zone", "Zone"], ["region", "Region"], ["brand", "Brand"], ["channel", "Channel"], ["month", "Month (trend)"]])}
          {sel("metric", "Metric", [["sales", "Sales ₹"], ["target", "Target ₹"], ["ach", "Achievement %"]])}
          {sel("chart", "Chart", [["bar", "Bar"], ["line", "Line"], ["donut", "Donut"]])}
          <Button className="gap-1.5" onClick={() => toast("Saved to My Dashboards")}><IconDeviceFloppy className="size-4" /> Save view</Button>
        </div>
        {b.chart === "donut" && (b.metric === "ach" || b.dim === "month") ? <p className="m-0 mt-3 text-xs text-amber-700 dark:text-amber-400">Tip: a donut only makes sense for parts of a whole — try a bar chart for {b.metric === "ach" ? "percentages" : "trends"}.</p> : null}
      </Panel>
      <Panel span={12} title={`${mLabel} by ${b.dim}`} insight={(() => { const sorted = [...data].sort((x, y) => y.v - x.v); return sorted.length ? `Highest: {{metric:${sorted[0].l}|${fmt(sorted[0].v)}|positive}} · lowest: {{metric:${sorted[sorted.length - 1].l}|${fmt(sorted[sorted.length - 1].v)}|negative}}. Spread of ${(sorted[0].v / (sorted[sorted.length - 1].v || 1)).toFixed(1)}×.` : null; })()}>
        {b.chart === "donut" ? (
          <DonutChart data={data.map((d, i) => ({ name: d.l, value: d.v, color: PALETTE[i % PALETTE.length] }))} valueFormatter={(v) => fmt(v)} legendPosition="right" className="h-80" />
        ) : (
          <AxisFrame y={mLabel} x={String(b.dim)}><TrendChart data={data} xKey="l" type={b.chart as "bar" | "line"} showYAxis yFormatter={fmt} className="h-80" series={[{ key: "v", label: mLabel, color: C.c1 }]} /></AxisFrame>
        )}
      </Panel>
      <Panel title="Data">
        <DataTable rows={pts} cols={cols} pageSize={20} exportName={`sales-by-${b.dim}`} getRowId={(r) => r.l} />
      </Panel>
    </>
  );
}
