import { HeatmapChart } from "@/components/overtrue/heatmap-chart";
import { BarList } from "@/components/overtrue/bar-list";
import { ComposedChart } from "@/components/overtrue/composed-chart";
import { ModulePage } from "@/components/app/module";
import { FilterBar, inF, opts, type FilterValues } from "@/components/app/filters";
import { DataTable, Foot, Grid, KpiRow, Panel, Stat, Toggle, type Col } from "@/components/app/kit";
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
  type Row = { cfa: string; vals: number[]; total: number };
  const rows: Row[] = list.map(([c], k) => ({ cfa: c, vals: M[k], total: tot[k] }));
  const cols: Col<Row>[] = [
    { id: "c", header: "CFA", value: (r) => r.cfa, cell: (r) => <span className="font-medium">{r.cfa.replace("CFA ", "")}</span> },
    ...days.map((d, j) => ({ id: "d" + j, header: fdDay(d), align: "right" as const, value: (r: Row) => r.vals[j], cell: (r: Row) => (r.vals[j] ? fmtN(r.vals[j]) : <span className="text-muted-foreground">–</span>) })),
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
      note="Secondary dispatches from CFAs to distributors, in cases. Sundays are non-dispatch days."
    >
      <KpiRow className="xl:grid-cols-4">
        <Stat label="Total dispatch qty" value={fmtN(grand)} delta={prev ? grand / prev - 1 : undefined} hint={`vs previous ${n} days · ${list.length} CFAs`} />
        <Stat label="Avg / working day" value={fmtN(grand / work)} sparkline={dayTot.filter((_, j) => days[j].getDay())} />
        <Stat label="Top CFA" value={list.length ? list[topIdx][0].replace("CFA ", "") : "—"} hint={fmtN(Math.max(...tot, 0)) + " cases"} />
        <Stat label="Peak day" value={fdShort(days[peak])} hint={fmtN(dayTot[peak]) + " cases"} />
      </KpiRow>
      <Panel title="CFA × date throughput" description="Darker = more cases dispatched. Hover a cell for the exact figure."
        insight={list.length ? `{{metric:${list[topIdx][0].replace("CFA ", "")}|${pct(tot[topIdx], grand, 0)}|neutral}} moves the most volume. The last 4 days of each month run ~30% hotter — plan CFA labour and trucks for the month-end surge.` : null} info="A heatmap reads 10 CFAs × 15+ days at a glance — a 10-colour stacked bar can’t.">
        <HeatmapChart rows={rows.map((r) => ({ label: r.cfa.replace("CFA ", ""), values: r.vals }))} columns={days.map((d) => fdDay(d))} valueFormatter={(v) => fmtN(v) + " cases"} columnLabelEvery={n > 15 ? 3 : 1} maxCellHeight={30} scale="sqrt" />
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
      <Panel title="CFA × date matrix">
        <DataTable rows={rows} cols={cols} pageSize={10} exportName={`cfa-matrix-${n}d`} getRowId={(r) => r.cfa} />
        <Foot>Totals: {fmtN(grand)} cases across {list.length} CFAs.</Foot>
      </Panel>
    </ModulePage>
  );
}

