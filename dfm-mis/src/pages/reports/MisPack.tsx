/* Monthly MIS pack: the month-end management report — statement tables, bridges, commentary and sign-off. */
import * as React from "react";
import { IconCheck, IconFileAnalytics, IconPrinter, IconBellRinging, IconArrowBackUp, IconPencil, IconArrowUp, IconArrowDown, IconTrash, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/overtrue/page-header";
import { SectionCard } from "@/components/overtrue/section-card";
import { StatusBadge } from "@/components/overtrue/status-badge";
import { Steps } from "@/components/overtrue/steps";
import { WaterfallChart } from "@/components/overtrue/waterfall-chart";
import { AuditTrail } from "@/components/overtrue/audit-trail";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AxisFrame } from "@/components/app/kit";
import { FormSelect } from "@/components/ui/select";
import { ExecScorecard, RAG_LABEL, RAG_VARIANT, fmtUnit } from "@/components/app/ExecScorecard";
import { KPIS, evaluate, ragFor, type Period } from "@/data/kpis";
import { ACCOUNTS, ASMS, CFAS, MONTHS, NOW, ZONES, cfaQty, plSum, today0, type Pnl } from "@/data/data";
import { DAY, cr } from "@/data/format";
import { asmPeriod, asmPeriodTarget } from "@/data/sales";
import { useApp } from "@/state/app";
import { cn } from "@/lib/utils";

const STAGES = ["Draft", "Finance review", "CFO approval", "Published"];
interface SectionCfg { id: string; title: string; visible: boolean; custom?: boolean }
interface PackState {
  stage: number; version: number; notes: Record<string, string>;
  log: { id: string; actor: string; action: string; time: string; outcome?: "success" | "warning" | "neutral"; changes?: { field: string; before: string; after: string }[] }[];
  title?: string; sections: SectionCfg[]; targets: Record<string, number>; hidden: string[];
}
const DEFAULT_SECTIONS: SectionCfg[] = [
  { id: "exec", title: "Executive summary", visible: true }, { id: "sales", title: "Secondary sales by zone", visible: true },
  { id: "supply", title: "Supply chain performance", visible: true }, { id: "pnl", title: "E-commerce P&L statement", visible: true },
  { id: "cfa", title: "Secondary supply · CFA dispatch", visible: true },
];

const monthRange = (i: number): Period => {
  const m = MONTHS[i]; const a = m.date; const end = new Date(Math.min(+new Date(a.getFullYear(), a.getMonth() + 1, 0), +today0));
  const pm = new Date(a.getFullYear(), a.getMonth() - 1, 1); const pe = new Date(a.getFullYear(), a.getMonth() - 1, Math.min(end.getDate(), new Date(a.getFullYear(), a.getMonth(), 0).getDate()));
  return { key: "mtd", label: m.label, start: a, end, prior: { start: pm, end: pe }, long: `${m.label}${+end < +new Date(a.getFullYear(), a.getMonth() + 1, 0) ? " (month to date)" : ""} · ${a.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` };
};
const shiftYear = (d: Date, n: number) => new Date(d.getFullYear() + n, d.getMonth(), d.getDate());
const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);
const signed = (v: number, d = 1, suffix = "%") => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}${suffix}`;
const tone = (v: number, upGood = true) => (v === 0 ? "" : (v > 0) === upGood ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400");

function usePack(mk: string, draft: Record<string, string>) {
  const key = `dfm.mis.v1.${mk}`;
  const [st, setSt] = React.useState<PackState>(() => {
    const base: PackState = { stage: 0, version: 1, notes: draft, sections: DEFAULT_SECTIONS, targets: {}, hidden: [], log: [{ id: "c", actor: "MIS bot", action: "drafted the pack from source data", time: NOW.toLocaleString("en-IN"), outcome: "neutral" }] };
    try { const v = localStorage.getItem(key); if (v) return { ...base, ...JSON.parse(v) }; } catch { /* ignore */ }
    return base;
  });
  React.useEffect(() => { try { localStorage.setItem(key, JSON.stringify(st)); } catch { /* ignore */ } }, [key, st]);
  return [st, setSt] as const;
}

export default function MisPack() {
  const [mi, setMi] = React.useState(MONTHS.length - 1);
  // One pack per month: remount so each month loads its own saved state.
  return <Pack key={mi} mi={mi} setMi={setMi} />;
}

function Pack({ mi, setMi }: { mi: number; setMi: (i: number) => void }) {
  const nav = useNavigate();
  const { user, toast } = useApp();
  const per = React.useMemo(() => monthRange(mi), [mi]);
  const m = MONTHS[mi];
  const kpisDefault = React.useMemo(() => evaluate(per, "target"), [per]);

  // ---------- Sales by zone ----------
  const zones = React.useMemo(() => ZONES.map(([z]) => {
    const l = ASMS.filter((a) => a.zone === z);
    const r: [Date, Date] = [per.start, per.end];
    const act = l.reduce((s, a) => s + asmPeriod(a, r), 0), tgt = l.reduce((s, a) => s + asmPeriodTarget(a, r), 0);
    const lm = l.reduce((s, a) => s + asmPeriod(a, [per.prior.start, per.prior.end]), 0);
    const ly = l.reduce((s, a) => s + asmPeriod(a, [shiftYear(per.start, -1), shiftYear(per.end, -1)]), 0);
    return { zone: z.split(" – ")[0], act, tgt, lm, ly };
  }), [per]);
  const sT = zones.reduce((s, z) => ({ act: s.act + z.act, tgt: s.tgt + z.tgt, lm: s.lm + z.lm, ly: s.ly + z.ly }), { act: 0, tgt: 0, lm: 0, ly: 0 });

  // ---------- Supply chain ----------
  const prev3 = [mi - 1, mi - 2, mi - 3].filter((i) => i >= 0).map(monthRange);
  const supply = KPIS.filter((k) => k.fn === "Supply chain").map((def) => {
    const cur = def.value(per.start, per.end), lm = mi > 0 ? def.value(monthRange(mi - 1).start, monthRange(mi - 1).end) : null;
    const avg3 = prev3.length ? prev3.map((p) => def.value(p.start, p.end) ?? 0).reduce((a, b) => a + b, 0) / prev3.length : null;
    const tgt = def.target(per.start, per.end);
    return { def, cur, lm, avg3, tgt, rag: ragFor(def, cur, tgt) };
  });

  // ---------- E-com P&L ----------
  const accs = ACCOUNTS.map((a) => a[0]);
  const plCur = plSum(accs, m.key), plLm = mi > 0 ? plSum(accs, MONTHS[mi - 1].key) : null;
  const plYtd = MONTHS.slice(0, mi + 1).map((x) => plSum(accs, x.key)).reduce((s, p) => Object.fromEntries(Object.keys(p).map((k) => [k, (s[k as keyof Pnl] ?? 0) + p[k as keyof Pnl]])) as Pnl, {} as Pnl);
  const PL: [string, keyof Pnl, number, boolean?][] = [
    ["Gross revenue", "grossRevenue", 1, true], ["Primary schemes", "primarySchemes", -1], ["Secondary scheme", "secondaryScheme", -1], ["Trade expiry", "tradeExpiry", -1], ["SS commission", "ssCommission", -1], ["Total claims & schemes", "productClaims", -1, true],
    ["Net sales", "netSales", 1, true], ["RM cost", "rmCost", -1], ["PM cost", "pmCost", -1], ["Cost of sales", "costOfSales", -1, true], ["Material margin", "materialMargin", 1, true],
  ];

  // ---------- CFA ----------
  const cfa = CFAS.map((c, ci) => {
    const sumR = (a: Date, b: Date) => { let s = 0; for (let d = new Date(a); d <= b; d = new Date(+d + DAY)) s += cfaQty(ci, d); return s; };
    return { cfa: c.replace("CFA ", ""), cur: sumR(per.start, per.end), lm: sumR(per.prior.start, per.prior.end) };
  });
  const cT = cfa.reduce((s, c) => ({ cur: s.cur + c.cur, lm: s.lm + c.lm }), { cur: 0, lm: 0 });

  // ---------- Auto-drafted commentary ----------
  const worst = [...zones].sort((a, b) => a.act / a.tgt - b.act / b.tgt)[0], best = [...zones].sort((a, b) => b.act / b.tgt - a.act / a.tgt)[0];
  const reds = kpisDefault.filter((k) => k.rag === "red");
  const draft: Record<string, string> = {
    exec: `${m.label}: ${kpisDefault.filter((k) => k.rag === "green").length} of ${kpisDefault.length} KPIs on target, ${reds.length} off target (${reds.map((k) => k.def.label).join(", ") || "none"}). Secondary sales ${cr(sT.act)} at ${pct(sT.act, sT.tgt).toFixed(1)}% of plan.`,
    sales: `Secondary sales ${cr(sT.act)} against a plan of ${cr(sT.tgt)} (${pct(sT.act, sT.tgt).toFixed(1)}%). ${best.zone} leads at ${pct(best.act, best.tgt).toFixed(1)}%; ${worst.zone} trails at ${pct(worst.act, worst.tgt).toFixed(1)}%. Year-on-year growth ${signed(pct(sT.act - sT.ly, sT.ly))}.`,
    supply: `OTIF ${fmtUnit(supply.find((s) => s.def.key === "otif")?.cur ?? null, "pct")} versus 95% target. Detention rate ${fmtUnit(supply.find((s) => s.def.key === "det")?.cur ?? null, "pct")} and GPS adherence ${fmtUnit(supply.find((s) => s.def.key === "track")?.cur ?? null, "pct")} remain the main gaps.`,
    pnl: `E-com net sales ${cr(plCur.netSales)}; material margin ${pct(plCur.materialMargin, plCur.netSales).toFixed(1)}% of net sales${plLm ? ` (${signed(pct(plCur.materialMargin, plCur.netSales) - pct(plLm.materialMargin, plLm.netSales), 1, " pts")} vs ${MONTHS[mi - 1].label})` : ""}.`,
    cfa: `CFAs dispatched ${Math.round(cT.cur).toLocaleString("en-IN")} cases, ${signed(pct(cT.cur - cT.lm, cT.lm))} versus the same days last month.`,
  };
  const [pack, setPack] = usePack(m.key, draft);
  const locked = pack.stage >= 3;
  const kpis = React.useMemo(() => evaluate(per, "target", pack.targets, pack.hidden), [per, pack.targets, pack.hidden]);
  const [editing, setEditing] = React.useState(false);
  const [editNote, setEditNote] = React.useState<string | null>(null);
  const who = user?.name ?? "User";
  const logEdit = (action: string, changes?: { field: string; before: string; after: string }[]) =>
    setPack((p) => ({ ...p, log: [{ id: String(Date.now() + Math.random()), actor: who, action, time: new Date().toLocaleString("en-IN"), outcome: "neutral", changes }, ...p.log] }));
  const setSections = (fn: (s: SectionCfg[]) => SectionCfg[]) => setPack((p) => ({ ...p, sections: fn(p.sections) }));
  const packTitle = pack.title || `Management information pack — ${m.label}`;
  const setNote = (k: string, v: string) => setPack((p) => ({ ...p, notes: { ...p.notes, [k]: v } }));
  const advance = () => {
    const next = Math.min(3, pack.stage + 1);
    setPack((p) => ({ ...p, stage: next, version: next === 3 ? p.version : p.version, log: [{ id: String(Date.now()), actor: user?.name ?? "User", action: next === 1 ? "submitted the pack for finance review" : next === 2 ? "completed finance review" : "approved and published the pack", time: new Date().toLocaleString("en-IN"), outcome: "success" }, ...p.log] }));
    toast(next === 3 ? `MIS pack ${m.label} published (v${pack.version})` : `Moved to ${STAGES[next]}`);
  };
  const reopen = () => setPack((p) => ({ ...p, stage: 0, version: p.version + 1, log: [{ id: String(Date.now()), actor: user?.name ?? "User", action: `reopened the pack as v${p.version + 1}`, time: new Date().toLocaleString("en-IN"), outcome: "warning" }, ...p.log] }));

  const note = (k: string) => {
    const text = pack.notes[k] ?? draft[k] ?? "";
    const open = !locked && (editing || editNote === k);
    return (
      <div className="border-t border-border bg-muted/30 px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="eyebrow">Management commentary</span>
          <span className="flex items-center gap-2">
            {pack.notes[k] === draft[k] ? <span className="text-[11px] text-muted-foreground">Auto-drafted from data</span> : <span className="text-[11px] text-muted-foreground">Edited</span>}
            {!locked && !editing ? (
              editNote === k
                ? <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => { setEditNote(null); logEdit(`edited the commentary for “${pack.sections.find((x) => x.id === k)?.title ?? k}”`); }} data-print="hide"><IconCheck className="size-3.5" />Done</Button>
                : <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setEditNote(k)} data-print="hide"><IconPencil className="size-3.5" />Edit commentary</Button>
            ) : null}
          </span>
        </div>
        {open ? <Textarea autoFocus={editNote === k} value={text} onChange={(e) => setNote(k, e.target.value)} rows={3} className="min-h-[72px] bg-card text-[13px]" aria-label={`Commentary · ${k}`} /> : <p className="m-0 text-[13px] leading-5 whitespace-pre-wrap">{text || <span className="text-muted-foreground">No commentary yet.</span>}</p>}
      </div>
    );
  };
  const H = ({ children, right }: { children: React.ReactNode; right?: boolean }) => <TableHead className={cn("whitespace-nowrap", right && "text-right")}>{children}</TableHead>;
  const N = ({ children, className }: { children: React.ReactNode; className?: string }) => <TableCell className={cn("text-right tabular-nums whitespace-nowrap", className)}>{children}</TableCell>;

  const renderSection = (sc: SectionCfg, n: number) => {
    const t = sc.title;
    switch (sc.id) {
      case "exec": return (
      <section aria-label={`${n}. ${t}`} className="flex flex-col gap-0">
        <h2 className="m-0 mb-2 text-[15px] font-semibold tracking-tight">{n}. {t}</h2>
        <ExecScorecard results={kpis} period={per} compare="target" className="rounded-b-none" />
        <div className="rounded-b-lg border border-t-0 border-border bg-card">{note("exec")}</div>
      </section>
      );
      case "sales": return (
      <SectionCard title={`${n}. ${t}`} description="Actual vs AOP target, previous month (same days) and same period last year" contentClassName="p-0">
        <div className="grid grid-cols-1">
          <Table className="text-[12.5px] [&_td]:py-1.5">
            <TableHeader className="bg-muted/50"><TableRow className="hover:bg-transparent"><H>Zone</H><H right>Target</H><H right>Actual</H><H right>Ach. %</H><H right>Gap</H><H right>Prev. month</H><H right>MoM</H><H right>Last year</H><H right>YoY</H></TableRow></TableHeader>
            <TableBody>
              {zones.map((z) => (
                <TableRow key={z.zone}>
                  <TableCell className="font-medium">{z.zone}</TableCell><N>{cr(z.tgt)}</N><N className="font-semibold">{cr(z.act)}</N>
                  <N><StatusBadge variant={RAG_VARIANT[z.act >= z.tgt ? "green" : z.act >= z.tgt * 0.95 ? "amber" : "red"]}>{pct(z.act, z.tgt).toFixed(1)}%</StatusBadge></N>
                  <N className={tone(z.act - z.tgt)}>{z.act >= z.tgt ? "+" : "−"}{cr(Math.abs(z.act - z.tgt))}</N><N>{cr(z.lm)}</N><N className={tone(z.act - z.lm)}>{signed(pct(z.act - z.lm, z.lm))}</N><N>{cr(z.ly)}</N><N className={tone(z.act - z.ly)}>{signed(pct(z.act - z.ly, z.ly))}</N>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter><TableRow><TableCell className="font-semibold">Total</TableCell><N>{cr(sT.tgt)}</N><N className="font-semibold">{cr(sT.act)}</N><N>{pct(sT.act, sT.tgt).toFixed(1)}%</N><N className={tone(sT.act - sT.tgt)}>{sT.act >= sT.tgt ? "+" : "−"}{cr(Math.abs(sT.act - sT.tgt))}</N><N>{cr(sT.lm)}</N><N className={tone(sT.act - sT.lm)}>{signed(pct(sT.act - sT.lm, sT.lm))}</N><N>{cr(sT.ly)}</N><N className={tone(sT.act - sT.ly)}>{signed(pct(sT.act - sT.ly, sT.ly))}</N></TableRow></TableFooter>
          </Table>
          <div className="border-t border-border p-3">
            <div className="eyebrow mb-1">Bridge · target to actual</div>
            <AxisFrame y="Secondary sales (₹)" x="Target, then each zone’s shortfall (red) or excess (green), ending at actual">
            <WaterfallChart height={260} orientation="vertical" valueFormatter={(v, ctx) => (ctx === "axis" ? "₹" + (v / 1e7).toFixed(0) + "Cr" : cr(v))}
              steps={[{ id: "t", label: "Target", value: sT.tgt, kind: "start" }, ...zones.map((z) => ({ id: z.zone, label: z.zone, value: z.act - z.tgt })), { id: "a", label: "Actual", value: sT.act, kind: "end" }]} />
            </AxisFrame>
          </div>
        </div>
        {note("sales")}
      </SectionCard>
      );
      case "supply": return (
      <SectionCard title={`${n}. ${t}`} description="This month vs previous month, trailing 3-month average and target" contentClassName="p-0">
        <Table className="text-[12.5px] [&_td]:py-1.5">
          <TableHeader className="bg-muted/50"><TableRow className="hover:bg-transparent"><H>KPI</H><H right>{m.label}</H><H right>Prev. month</H><H right>3-month avg</H><H right>Target</H><H right>vs target</H><H>Status</H><H>Owner</H></TableRow></TableHeader>
          <TableBody>
            {supply.map((s) => {
              const gap = s.cur != null && s.tgt != null ? s.cur - s.tgt : 0;
              return (
                <TableRow key={s.def.key}>
                  <TableCell className="font-medium">{s.def.label}</TableCell><N className="font-semibold">{fmtUnit(s.cur, s.def.unit)}</N><N>{fmtUnit(s.lm, s.def.unit)}</N><N>{fmtUnit(s.avg3, s.def.unit)}</N><N className="text-muted-foreground">{fmtUnit(s.tgt, s.def.unit)}</N>
                  <N className={tone(gap, s.def.better === "up")}>{s.def.unit === "pct" ? signed(gap, 1, " pts") : s.def.unit === "hours" ? signed(gap, 1, " h") : s.def.unit === "inr_per_km" ? signed(gap, 2, "") : signed(pct(gap, s.tgt ?? 1))}</N>
                  <TableCell><StatusBadge variant={RAG_VARIANT[s.rag]}>{RAG_LABEL[s.rag]}</StatusBadge></TableCell><TableCell className="text-muted-foreground">{s.def.owner}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {note("supply")}
      </SectionCard>
      );
      case "pnl": return (
      <SectionCard title={`${n}. ${t}`} description={`All marketplace accounts · ${m.label} vs ${mi > 0 ? MONTHS[mi - 1].label : "—"} and year to date (from ${MONTHS[0].label})`} contentClassName="p-0">
        <Table className="text-[12.5px] [&_td]:py-1.5">
          <TableHeader className="bg-muted/50"><TableRow className="hover:bg-transparent"><H>Line item</H><H right>{m.label}</H><H right>% of gross</H><H right>{mi > 0 ? MONTHS[mi - 1].label : "Prev. month"}</H><H right>Change</H><H right>YTD</H><H right>YTD % of gross</H></TableRow></TableHeader>
          <TableBody>
            {PL.map(([label, k, sign, strong]) => {
              const cur = plCur[k], lm = plLm?.[k] ?? 0, ytd = plYtd[k];
              const ch = pct(cur - lm, lm);
              return (
                <TableRow key={k} className={cn(strong && "bg-muted/30 font-semibold")}>
                  <TableCell className={cn(!strong && "pl-6 text-muted-foreground")}>{label}</TableCell>
                  <N>{sign < 0 ? `(${cr(cur)})` : cr(cur)}</N><N className="text-muted-foreground">{pct(cur, plCur.grossRevenue).toFixed(1)}%</N>
                  <N>{plLm ? (sign < 0 ? `(${cr(lm)})` : cr(lm)) : "First month"}</N><N className={plLm ? tone(ch, sign > 0) : "text-muted-foreground"}>{plLm ? signed(ch) : "First month"}</N>
                  <N>{sign < 0 ? `(${cr(ytd)})` : cr(ytd)}</N><N className="text-muted-foreground">{pct(ytd, plYtd.grossRevenue).toFixed(1)}%</N>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter><TableRow><TableCell className="font-semibold">Material margin %</TableCell><N>{pct(plCur.materialMargin, plCur.netSales).toFixed(1)}%</N><N className="text-muted-foreground">of net sales</N><N>{plLm ? pct(plLm.materialMargin, plLm.netSales).toFixed(1) + "%" : "First month"}</N><N className={plLm ? tone(pct(plCur.materialMargin, plCur.netSales) - pct(plLm.materialMargin, plLm.netSales)) : "text-muted-foreground"}>{plLm ? signed(pct(plCur.materialMargin, plCur.netSales) - pct(plLm.materialMargin, plLm.netSales), 1, " pts") : "First month"}</N><N>{pct(plYtd.materialMargin, plYtd.netSales).toFixed(1)}%</N><N className="text-muted-foreground">of net sales</N></TableRow></TableFooter>
        </Table>
        {note("pnl")}
      </SectionCard>
      );
      case "cfa": return (
      <SectionCard title={`${n}. ${t}`} description="Cases dispatched this period vs the same days last month" contentClassName="p-0">
        <Table className="text-[12.5px] [&_td]:py-1.5">
          <TableHeader className="bg-muted/50"><TableRow className="hover:bg-transparent"><H>CFA</H><H right>Cases</H><H right>Share</H><H right>Prev. month</H><H right>Change</H></TableRow></TableHeader>
          <TableBody>{[...cfa].sort((a, b) => b.cur - a.cur).map((c) => (
            <TableRow key={c.cfa}><TableCell className="font-medium">{c.cfa}</TableCell><N className="font-semibold">{Math.round(c.cur).toLocaleString("en-IN")}</N><N className="text-muted-foreground">{pct(c.cur, cT.cur).toFixed(1)}%</N><N>{Math.round(c.lm).toLocaleString("en-IN")}</N><N className={tone(c.cur - c.lm)}>{signed(pct(c.cur - c.lm, c.lm))}</N></TableRow>
          ))}</TableBody>
          <TableFooter><TableRow><TableCell className="font-semibold">Total</TableCell><N className="font-semibold">{Math.round(cT.cur).toLocaleString("en-IN")}</N><N>100%</N><N>{Math.round(cT.lm).toLocaleString("en-IN")}</N><N className={tone(cT.cur - cT.lm)}>{signed(pct(cT.cur - cT.lm, cT.lm))}</N></TableRow></TableFooter>
        </Table>
        {note("cfa")}
      </SectionCard>
      );
      default: return (
        <SectionCard title={`${n}. ${t}`} description="Additional commentary section" contentClassName="p-0">{note(sc.id)}</SectionCard>
      );
    }
  };

  return (
    <div className="flex flex-col gap-[var(--page-gap)]">
      <PageHeader eyebrow="Reports · Monthly MIS pack" title={packTitle}
        description={`${per.long} · DFM Foods Ltd · version ${pack.version} · prepared from TMS, ERP, DMS, CFA WMS and marketplace data · Confidential`}
        actions={
          <div className="flex flex-wrap items-center gap-2" data-print="hide">
            <FormSelect aria-label="Month" value={mi} onChange={(e) => setMi(Number(e.target.value))} className="h-8 w-36 rounded-md px-2.5 text-[13px]">
              {MONTHS.map((x, i) => <option key={x.key} value={i}>{x.label}{i === MONTHS.length - 1 ? " (MTD)" : ""}</option>)}
            </FormSelect>
            {locked ? <Button size="sm" variant="outline" disabled title="Reopen the pack to edit">Published · read only</Button>
              : <Button size="sm" variant={editing ? "default" : "outline"} className="gap-1.5" onClick={() => { setEditing((e) => !e); setEditNote(null); }}><IconPencil className="size-4" />{editing ? "Close editor" : "Edit pack"}</Button>}
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.print()}><IconPrinter className="size-4" />Print / PDF</Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => nav("/alerts")}><IconBellRinging className="size-4" />Subscribe</Button>
          </div>
        } />

      <SectionCard title="Sign-off" description="Draft → Finance review → CFO approval → Published. The pack can be edited until it is published; reopen it to make changes after that." contentClassName="flex flex-col gap-3 p-4">
        <Steps steps={STAGES} current={pack.stage} />
        <div className="flex flex-wrap items-center gap-2" data-print="hide">
          <StatusBadge variant={locked ? "success" : "warning"}>{locked ? `Published · v${pack.version}` : `${STAGES[pack.stage]} · v${pack.version}`}</StatusBadge>
          {!locked ? <Button size="sm" className="gap-1.5" onClick={advance}><IconCheck className="size-4" />{pack.stage === 0 ? "Submit for review" : pack.stage === 1 ? "Mark reviewed" : "Approve & publish"}</Button> : <Button size="sm" variant="outline" className="gap-1.5" onClick={reopen}><IconArrowBackUp className="size-4" />Reopen as v{pack.version + 1}</Button>}
          <span className="text-xs text-muted-foreground">Approvals are recorded in the audit trail below.</span>
        </div>
      </SectionCard>

      {editing ? (
        <SectionCard title="Edit pack" description="Changes save automatically and are recorded in the approval history" data-print="hide" contentClassName="grid grid-cols-1 gap-5 p-4 xl:grid-cols-2"
          actions={<Button size="sm" className="gap-1.5" onClick={() => { setEditing(false); logEdit("finished editing the pack"); }}><IconCheck className="size-4" />Done editing</Button>}>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">Pack title
              <Input value={pack.title ?? ""} placeholder={`Management information pack — ${m.label}`} onChange={(e) => setPack((p) => ({ ...p, title: e.target.value }))} className="h-9 text-sm text-foreground" />
            </label>
            <div>
              <div className="eyebrow mb-1.5">Sections · order, name and visibility</div>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {pack.sections.map((sc, i) => (
                  <li key={sc.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5">
                    <Switch checked={sc.visible} aria-label={`Show ${sc.title}`} onCheckedChange={(v) => { setSections((xs) => xs.map((x) => (x.id === sc.id ? { ...x, visible: v } : x))); logEdit(`${v ? "showed" : "hid"} the section “${sc.title}”`); }} />
                    <Input value={sc.title} aria-label="Section title" onChange={(e) => setSections((xs) => xs.map((x) => (x.id === sc.id ? { ...x, title: e.target.value } : x)))} className="h-8 flex-1 text-[13px]" />
                    <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => setSections((xs) => { const y = [...xs]; [y[i - 1], y[i]] = [y[i], y[i - 1]]; return y; })}><IconArrowUp className="size-4" /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === pack.sections.length - 1} onClick={() => setSections((xs) => { const y = [...xs]; [y[i + 1], y[i]] = [y[i], y[i + 1]]; return y; })}><IconArrowDown className="size-4" /></Button>
                    {sc.custom ? <Button variant="ghost" size="icon-sm" aria-label="Delete section" onClick={() => { setSections((xs) => xs.filter((x) => x.id !== sc.id)); logEdit(`deleted the section “${sc.title}”`); }}><IconTrash className="size-4" /></Button> : <span className="w-8" />}
                  </li>
                ))}
              </ul>
              <Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={() => { const id = `custom-${Date.now()}`; setSections((xs) => [...xs, { id, title: "Additional notes", visible: true, custom: true }]); setPack((p) => ({ ...p, notes: { ...p.notes, [id]: "" } })); logEdit("added a commentary section"); }}><IconPlus className="size-4" />Add commentary section</Button>
            </div>
          </div>
          <div>
            <div className="eyebrow mb-1.5">Executive scorecard · KPIs and targets for {m.label}</div>
            <Table className="text-[12.5px] [&_td]:py-1">
              <TableHeader className="bg-muted/50"><TableRow className="hover:bg-transparent"><TableHead className="w-10">Show</TableHead><TableHead>KPI</TableHead><TableHead className="text-right">AOP target</TableHead><TableHead className="w-32 text-right">Pack target</TableHead></TableRow></TableHeader>
              <TableBody>
                {KPIS.map((k) => {
                  const aop = k.target(per.start, per.end);
                  const scale = k.unit === "inr" ? 1e7 : 1;
                  return (
                    <TableRow key={k.key}>
                      <TableCell><Switch checked={!pack.hidden.includes(k.key)} aria-label={`Show ${k.label}`} onCheckedChange={(v) => { setPack((p) => ({ ...p, hidden: v ? p.hidden.filter((x) => x !== k.key) : [...p.hidden, k.key] })); logEdit(`${v ? "added" : "removed"} “${k.label}” ${v ? "to" : "from"} the scorecard`); }} /></TableCell>
                      <TableCell className="font-medium">{k.label}</TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">{fmtUnit(aop, k.unit)}</TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1">
                          <Input type="number" step="0.1" aria-label={`${k.label} target`} className="h-7 w-24 text-right text-[12.5px]"
                            value={pack.targets[k.key] != null ? +(pack.targets[k.key] / scale).toFixed(2) : ""} placeholder={aop != null ? String(+(aop / scale).toFixed(2)) : ""}
                            onChange={(e) => setPack((p) => { const t = { ...p.targets }; if (e.target.value === "") delete t[k.key]; else t[k.key] = Number(e.target.value) * scale; return { ...p, targets: t }; })}
                            onBlur={(e) => { if (e.target.value !== "") logEdit(`changed the ${k.label} target`, [{ field: k.label, before: fmtUnit(aop, k.unit), after: fmtUnit(Number(e.target.value) * scale, k.unit) }]); }} />
                          <span className="w-5 text-left text-[11px] text-muted-foreground">{k.unit === "inr" ? "Cr" : k.unit === "pct" ? "%" : k.unit === "hours" ? "h" : k.unit === "inr_per_km" ? "₹" : ""}</span>
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="m-0 mt-1.5 text-[11px] text-muted-foreground">Leave a pack target blank to use the AOP target. Overrides apply to this month’s pack only.</p>
          </div>
        </SectionCard>
      ) : null}

      {pack.sections.filter((x) => x.visible).map((sc, i) => <React.Fragment key={sc.id}>{renderSection(sc, i + 1)}</React.Fragment>)}

      <SectionCard title="Approval history" description="Every submission, review and approval of this pack" contentClassName="p-4">
        <AuditTrail events={pack.log} label="MIS pack approvals" />
      </SectionCard>
      <p className="m-0 flex items-center gap-1.5 text-xs text-muted-foreground"><IconFileAnalytics className="size-3.5" />Confidential — for internal management use only. Figures in ₹; Cr = crore, L = lakh. Brackets denote deductions.</p>
    </div>
  );
}
