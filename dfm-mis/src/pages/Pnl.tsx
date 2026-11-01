import * as React from "react";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { WaterfallChart } from "@/components/overtrue/waterfall-chart";
import { TrendChart } from "@/components/overtrue/trend-chart";
import { MultiSelect } from "@/components/overtrue/multi-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormSelect } from "@/components/ui/select";
import { ModulePage } from "@/components/app/module";
import { Grid, KpiRow, Num, Panel, Stat, Toggle } from "@/components/app/kit";
import { usePersistentState } from "@/state/app";
import { PALETTE } from "@/data/colors";
import { ACCOUNTS, MONTHS, monthLabel, plSum, pnl, type Pnl as PnlT } from "@/data/data";
import { cr, crAxis, pct, pctv } from "@/data/format";
import { cn } from "@/lib/utils";

const ALL = ACCOUNTS.map((a) => a[0]);
type RowDef = [keyof PnlT, string, "major" | "sub" | "detail", string | null, string | null];
const PL_ROWS: RowDef[] = [
  ["grossRevenue", "Gross revenue", "major", null, null],
  ["productClaims", "Product claims", "major", "productClaims", null],
  ["primarySchemes", "Primary schemes", "sub", null, "productClaims"],
  ["secondaryScheme", "Secondary scheme", "sub", null, "productClaims"],
  ["tradeExpiry", "Trade expiry", "sub", null, "productClaims"],
  ["ssCommission", "SS commission", "sub", null, "productClaims"],
  ["netSales", "Net sales", "major", null, null],
  ["costOfSales", "Cost of sales", "major", "costOfSales", null],
  ["rmCost", "RM cost", "sub", "rm", "costOfSales"],
  ["rmNetBom", "RM cost (net BOM)", "detail", null, "rm"],
  ["rmYield", "RM yield loss", "detail", null, "rm"],
  ["pmCost", "PM cost", "sub", "pm", "costOfSales"],
  ["pmNetBom", "PM cost (net BOM)", "detail", null, "pm"],
  ["pmYield", "PM yield loss", "detail", null, "pm"],
  ["materialMargin", "Material margin", "major", null, null],
];

export default function Pnl() {
  const [mk, setMk] = usePersistentState("pnl.month", MONTHS[4].key);
  const [accs, setAccs] = usePersistentState<string[]>("pnl.accounts", ALL);
  const [view, setView] = React.useState<"cons" | "cmp">("cons");
  const [open, setOpen] = React.useState(new Set(["productClaims", "costOfSales"]));
  const sel = accs.length ? accs : ALL;
  const tot = plSum(sel, mk);
  const prevKey = MONTHS[Math.max(0, MONTHS.findIndex((m) => m.key === mk) - 1)].key;
  const prev = plSum(sel, prevKey);
  const mm = (f: PnlT) => pctv(f.materialMargin, f.netSales);
  const visible = (r: RowDef) => { const p = r[4]; if (!p) return true; if (!open.has(p)) return false; return p === "rm" || p === "pm" ? open.has("costOfSales") : true; };
  const colsets: [string, PnlT][] = view === "cmp" ? [["Total", tot], ...sel.map((a) => [a, pnl(a, mk)] as [string, PnlT])] : [["Amount", tot]];
  const toggle = (k: string) => setOpen((s) => { const x = new Set(s); if (x.has(k)) x.delete(k); else x.add(k); return x; });

  return (
    <ModulePage moduleId="pnl"
      filters={
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">Month
            <FormSelect value={mk} onChange={(e) => setMk(e.target.value)} className="h-10 w-48 text-sm text-foreground">
              {MONTHS.map((m, i) => <option key={m.key} value={m.key}>{m.label}{i === 5 ? " (provisional)" : ""}</option>)}
            </FormSelect>
          </label>
          <div className="flex w-full min-w-0 flex-col gap-1.5 sm:w-80"><span className="text-xs text-muted-foreground">Accounts</span>
            <MultiSelect options={ALL.map((a) => ({ value: a, label: a }))} value={accs} onValueChange={(v) => setAccs(v)} placeholder="All accounts" collapse={2} aria-label="Accounts" />
          </div>
          <div className="flex flex-col gap-1.5"><span className="text-xs text-muted-foreground">View</span><Toggle label="View" value={view} onChange={setView} options={[["cons", "Consolidated"], ["cmp", "Compare accounts"]]} /></div>
        </div>
      }
      note="E-com P&L · month-end close data. The current month is provisional."
    >
      <KpiRow className="xl:grid-cols-5">
        <Stat label="Gross sales" value={cr(tot.grossRevenue)} delta={prev.grossRevenue ? tot.grossRevenue / prev.grossRevenue - 1 : undefined} hint="vs previous month" />
        <Stat label="Product claims" value={cr(tot.productClaims)} hint={pct(tot.productClaims, tot.grossRevenue) + " of gross"} delta={prev.productClaims ? tot.productClaims / prev.productClaims - 1 : undefined} invertDelta />
        <Stat label="Net sales" value={cr(tot.netSales)} delta={prev.netSales ? tot.netSales / prev.netSales - 1 : undefined} />
        <Stat label="Cost of sales" value={cr(tot.costOfSales)} hint={pct(tot.costOfSales, tot.netSales) + " of net"} />
        <Stat label="Material margin" value={mm(tot).toFixed(1) + "%"} hint={`${cr(tot.materialMargin)} · ${(() => { const d = +(mm(tot) - mm(prev)).toFixed(1); return (d > 0 ? "+" : "") + (d === 0 ? "0.0" : d.toFixed(1)); })()} pts MoM`} />
      </KpiRow>

      <Panel title={`Gross revenue to material margin · ${monthLabel(mk)}`} description="Where every rupee of gross revenue goes" info="A waterfall shows how each deduction bridges gross revenue to margin — the clearest way to read a P&L.">
        <WaterfallChart height={300} valueFormatter={(v, ctx) => (ctx === "axis" ? "₹" + crAxis(v) : cr(v))}
          steps={[
            { id: "g", label: "Gross revenue", value: tot.grossRevenue, kind: "start" },
            { id: "ps", label: "Primary schemes", value: -tot.primarySchemes },
            { id: "ss", label: "Secondary scheme", value: -tot.secondaryScheme },
            { id: "te", label: "Trade expiry", value: -tot.tradeExpiry },
            { id: "sc", label: "SS commission", value: -tot.ssCommission },
            { id: "n", label: "Net sales", value: tot.netSales, kind: "subtotal" },
            { id: "rm", label: "RM cost", value: -tot.rmCost },
            { id: "pm", label: "PM cost", value: -tot.pmCost },
            { id: "m", label: "Material margin", value: tot.materialMargin, kind: "end" },
          ]} />
      </Panel>

      <Panel title={`E-com P&L · ${monthLabel(mk)}`} description="Click claims, cost of sales, RM or PM to expand">
        <div className="overflow-x-auto rounded-xl ring-1 ring-border/60">
          <Table>
            <TableHeader><TableRow><TableHead>Particulars</TableHead>{colsets.map(([l]) => <TableHead key={l} className="text-right">{l}</TableHead>)}<TableHead className="text-right">% of net sales</TableHead></TableRow></TableHeader>
            <TableBody>
              {PL_ROWS.filter(visible).map(([k, l, style, tg]) => (
                <TableRow key={k} className={cn(tg && "cursor-pointer", (k === "netSales" || k === "materialMargin") && "bg-muted/40 font-semibold", style === "major" && "font-medium")} onClick={tg ? () => toggle(tg) : undefined} aria-expanded={tg ? open.has(tg) : undefined}>
                  <TableCell style={{ paddingLeft: style === "major" ? 12 : style === "sub" ? 34 : 56 }} className={cn("whitespace-nowrap", style === "detail" && "text-muted-foreground")}>
                    <span className="inline-flex items-center gap-1.5">{tg ? (open.has(tg) ? <IconChevronDown className="size-4" /> : <IconChevronRight className="size-4" />) : null}{l}</span>
                  </TableCell>
                  {colsets.map(([a, f]) => <TableCell key={a} className="text-right tabular-nums">{f[k] ? cr(f[k]) : <Num tone="muted">–</Num>}</TableCell>)}
                  <TableCell className="text-right tabular-nums text-muted-foreground">{pct(tot[k], tot.netSales)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>

      <Grid>
        <Panel title="Material margin % by account" description="Last 6 months">
          <TrendChart data={MONTHS.map((m) => ({ month: m.label, ...Object.fromEntries(sel.map((a) => [a, +mm(pnl(a, m.key)).toFixed(1)])) }))} xKey="month" type="line" showLegend showYAxis yDomain={["auto", "auto"]} yFormatter={(v) => v + "%"} className="h-72"
            series={sel.map((a) => ({ key: a, label: a, color: PALETTE[ALL.indexOf(a)] }))} />
        </Panel>
        <Panel title="Net sales by account">
          <TrendChart data={MONTHS.map((m) => ({ month: m.label, ...Object.fromEntries(sel.map((a) => [a, pnl(a, m.key).netSales])) }))} xKey="month" type="bar" stacked showLegend showYAxis yFormatter={crAxis} className="h-72"
            series={sel.map((a) => ({ key: a, label: a, color: PALETTE[ALL.indexOf(a)] }))} />
        </Panel>
      </Grid>
    </ModulePage>
  );
}
