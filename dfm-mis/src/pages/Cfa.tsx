import { BarList } from "@/components/overtrue/bar-list";
import { ComposedChart } from "@/components/overtrue/composed-chart";
import { ModulePage } from "@/components/app/module";
import { FilterBar, inF, opts, type FilterValues } from "@/components/app/filters";
import { Grid, KpiRow, Panel, Stat, Toggle, downloadCsv, type Col } from "@/components/app/kit";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { IconDownload } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { usePersistentState } from "@/state/app";
import { CFAS, cfaQty, today0 } from "@/data/data";
import { DAY, fdDay, fdShort, fmtN, pct } from "@/data/format";

export default function Cfa() {
  const [f, setF] = usePersistentState<FilterValues>("cfa.filters.v2", []);
  const [win, setWin] = usePersistentState<"7" | "15" | "30">("cfa.window", "15");
  const n = +win;
  const days = Array.from({ length: n }, (_, i) => new Date(+today0 - (n - 1 - i) * DAY));
  const list = CFAS.map((c, i) => [c, i] as const).filter(([c]) => inF(f, "cfa", c));
  const M = list.map(([, i]) => days.map((d) => cfaQty(i, d)));
  const tot = M.map((r) => r.reduce((a, b) => a + b, 0));
  const dayTot = days.map((_, j) => M.reduce((s, r) => s + r[j], 0));
  const work = days.filter((d) => d.getDay()).length || 1;
  const grand = tot.reduce((a, b) => a + b, 0);
  const prevDays = Array.from({ length: n }, (_, i) => new Date(+today0 - (2 * n - 1 - i) * DAY));
  const prev = list.reduce((s, [, i]) => s + prevDays.reduce((x, d) => x + cfaQty(i, d), 0), 0);
  const topIdx = tot.indexOf(Math.max(...tot, 0));
  const peak = dayTot.indexOf(Math.max(...dayTot, 0));
  const trend = days.map((d, j) => {
    const w = dayTot.slice(Math.max(0, j - 6), j + 1).filter((_, k) => days[Math.max(0, j - 6) + k].getDay());
    return { day: fdDay(d), qty: dayTot[j], avg: Math.round(w.reduce((a, b) => a + b, 0) / (w.length || 1)) };
  });
  const allVals = M.flat();
  const lo = allVals.length ? Math.min(...allVals) : 0, hi = allVals.length ? Math.max(...allVals) : 0;
  type Row = { cfa: string; vals: number[]; total: number };
  const rows: Row[] = list.map(([c], k) => ({ cfa: c, vals: M[k], total: tot[k] }));
  const cols: Col<Row>[] = [
    { id: "c", header: "CFA", value: (r) => r.cfa, cell: (r) => <span className="font-medium">{r.cfa.replace("CFA ", "")}</span> },
    ...days.map((d, j) => ({ id: "d" + j, header: fdDay(d), align: "right" as const, value: (r: Row) => r.vals[j], cell: (r: Row) => fmtN(r.vals[j]) })),
    { id: "t", header: "Total", align: "right", value: (r) => r.total, cell: (r) => <span className="font-semibold">{fmtN(r.total)}</span> },
    { id: "a", header: "Avg / day", align: "right", value: (r) => r.total / work, cell: (r) => fmtN(r.total / work) },
  ];
  return (
    <ModulePage moduleId="cfa"
      filters={
        <FilterBar values={f} onChange={setF} fields={[{ key: "cfa", label: "CFA", options: opts(CFAS) }]}>
          <div className="flex flex-col gap-1.5"><span className="text-xs text-muted-foreground">Window</span><Toggle label="Window" value={win} onChange={setWin} options={[["7", "7 days"], ["15", "15 days"], ["30", "30 days"]]} /></div>
        </FilterBar>
      }
      note="Secondary dispatches from CFA warehouses to distributors, in cases. Sundays run a half shift for urgent orders; averages use working days (Mon–Sat)."
    >
      <KpiRow className="xl:grid-cols-4">
        <Stat label="Total dispatch qty" value={fmtN(grand)} delta={prev ? grand / prev - 1 : undefined} hint={`vs previous ${n} days · ${list.length} CFAs`} />
        <Stat label="Avg / working day" value={fmtN(grand / work)} sparkline={dayTot.filter((_, j) => days[j].getDay())} />
        <Stat label="Top CFA" value={list.length ? list[topIdx][0].replace("CFA ", "") : "—"} hint={fmtN(Math.max(...tot, 0)) + " cases"} />
        <Stat label="Peak day" value={fdShort(days[peak])} hint={fmtN(dayTot[peak]) + " cases"} />
      </KpiRow>
      <Panel title="Cases dispatched per CFA per day" contentClassName="p-0"
        description={`Last ${n} days · each row is a CFA warehouse, each column a dispatch date, each cell the number of cases dispatched that day · darker = more cases`}
        info="Cell shading runs from the lowest to the highest daily figure in view. Sundays run a half shift for urgent distributor orders, so those columns are lighter by design."
        actions={<Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadCsv(`cfa-daily-cases-${n}d`, cols, rows)}><IconDownload className="size-4" />Export CSV</Button>}
        insight={list.length ? `{{metric:${list[topIdx][0].replace("CFA ", "")}|${pct(tot[topIdx], grand, 0)} of cases|neutral}} moves the most volume. Month-end days run ~30% above a normal weekday — plan CFA labour and trucks for the surge.` : null}>
        <div className="overflow-x-auto scrollbar-thin">
          <Table className="w-full border-separate border-spacing-0 text-[12px] [&_td]:h-8 [&_td]:py-0 [&_th]:py-1">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky left-0 z-10 bg-card pl-4 align-bottom"><span className="eyebrow whitespace-nowrap">CFA · date</span></TableHead>
                {days.map((d, j) => (
                  <TableHead key={j} className={cn("min-w-[52px] px-1 text-center align-bottom leading-tight", !d.getDay() && "bg-muted/60")}>
                    <span className="block text-[10px] font-normal text-muted-foreground uppercase">{d.toLocaleDateString("en-IN", { weekday: "short" })}</span>
                    <span className="block text-foreground">{d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  </TableHead>
                ))}
                <TableHead className="border-l border-border px-3 text-right align-bottom">Total</TableHead>
                <TableHead className="px-3 text-right align-bottom leading-tight">Avg /<br />working day</TableHead>
                <TableHead className="pr-4 text-right align-bottom">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.cfa} className="hover:bg-transparent">
                  <TableCell className="sticky left-0 z-10 bg-card pl-4 font-medium whitespace-nowrap">{r.cfa.replace("CFA ", "")}</TableCell>
                  {r.vals.map((v, j) => {
                    const t = hi > lo ? (v - lo) / (hi - lo) : 0.5;
                    return (
                      <TableCell key={j} title={`${r.cfa.replace("CFA ", "")} · ${days[j].toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}: ${fmtN(v)} cases`}
                        className={cn("border border-card px-1 text-center tabular-nums", t > 0.55 ? "text-white" : "text-foreground")}
                        style={{ background: `color-mix(in oklab, var(--color-primary) ${Math.round(8 + t * 82)}%, var(--color-card))` }}>
                        {n > 15 ? (v / 1000).toFixed(1) + "k" : fmtN(v)}
                      </TableCell>
                    );
                  })}
                  <TableCell className="border-l border-border px-3 text-right font-semibold tabular-nums">{fmtN(r.total)}</TableCell>
                  <TableCell className="px-3 text-right tabular-nums">{fmtN(r.total / work)}</TableCell>
                  <TableCell className="pr-4 text-right text-muted-foreground tabular-nums">{pct(r.total, grand, 1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell className="sticky left-0 z-10 bg-muted pl-4 font-semibold whitespace-nowrap">Daily total</TableCell>
                {dayTot.map((v, j) => <TableCell key={j} className="px-1 text-center font-medium tabular-nums">{(v / 1000).toFixed(1)}k</TableCell>)}
                <TableCell className="border-l border-border px-3 text-right font-semibold tabular-nums">{fmtN(grand)}</TableCell>
                <TableCell className="px-3 text-right font-semibold tabular-nums">{fmtN(grand / work)}</TableCell>
                <TableCell className="pr-4 text-right tabular-nums">100%</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span>Cells show cases dispatched{n > 15 ? " in thousands (k)" : ""}. Hover a cell for the exact figure. Shaded columns are Sundays (half shift).</span>
          <span className="flex items-center gap-2">
            <span>Fewest · {fmtN(lo)} cases</span>
            <span className="h-2.5 w-32 rounded-sm" style={{ background: "linear-gradient(90deg, color-mix(in oklab, var(--color-primary) 8%, var(--color-card)), var(--color-primary))" }} />
            <span>Most · {fmtN(hi)} cases</span>
          </span>
        </div>
      </Panel>
      <Grid>
        <Panel span={7} title="Daily dispatch · all selected CFAs"
          insight={`Throughput is {{metric:${fmtN(grand / work)} cases/day|${prev ? ((grand / prev - 1) * 100 >= 0 ? "+" : "") + ((grand / prev - 1) * 100).toFixed(1) + "%" : "–"}|${grand >= prev ? "positive" : "negative"}}} vs the previous ${n} days; peak was ${fdShort(days[peak])}.`} description="Bars: cases · line: 7-day working-day average">
          <ComposedChart data={trend} xKey="day" showYAxis showLegend yFormatter={(v) => (v / 1000).toFixed(0) + "k"} className="h-72"
            series={[{ key: "qty", label: "Cases", type: "bar" }, { key: "avg", label: "7-day avg", type: "line", color: "var(--color-chart-3)" }]} />
        </Panel>
        <Panel span={5} title="CFA ranking" description={`Total cases · last ${n} days`}
          insight={list.length > 2 ? `Top 3 CFAs handle {{metric:${pct([...tot].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0), grand, 0)}|of volume|neutral}}.` : null}>
          <BarList data={rows.map((r) => ({ name: r.cfa.replace("CFA ", ""), value: r.total }))} valueFormatter={fmtN} showPercentage />
        </Panel>
      </Grid>
    </ModulePage>
  );
}

