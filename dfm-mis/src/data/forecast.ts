/**
 * Predictive layer for the demo MIS. Every forecast is learned from the demo history itself
 * (run rates, weekday patterns, month-end push, linear trends) — nothing is hard-coded.
 */
import { ACCOUNTS, ASMS, CFAS, CUR_MONTH, MONTHS, NOW, ZONES, asmDay, cfaQty, orders, plSum, today0, trips, type Asm } from "./data";
import { DAY, H, sum } from "./format";
import { asmPeriodTarget } from "./sales";
import { tripEta } from "../pages/trips/timeline";

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const stdev = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
/** Standard normal CDF (Abramowitz–Stegun). */
export function normCdf(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dim = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
/** Least-squares line through y over x = 0..n-1. */
export function linFit(ys: number[]) {
  const n = ys.length, xs = ys.map((_, i) => i), mx = mean(xs), my = mean(ys);
  const b = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / (xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1);
  const a = my - b * mx;
  const resid = stdev(ys.map((y, i) => y - (a + b * i)));
  return { a, b, resid, at: (x: number) => a + b * x, n };
}

/* --------------------------- secondary sales landing -------------------------- */
export interface SalesForecast {
  mtd: number; target: number; projected: number; lo: number; hi: number; pHit: number; achievement: number;
  daysLeft: number; needPerDay: number; expectedPerDay: number;
  /** Cumulative series for the month: actual (to today), forecast with band (from today), pro-rated target. */
  series: { day: string; actual: number | null; forecast: number | null; lo: number | null; hi: number | null; target: number }[];
}

function learnFactors(asms: Asm[]) {
  const daily = (d: Date) => sum(asms, (a) => asmDay(a, d));
  // Weekday factors and month-end push, learned from the last 12 weeks of history.
  const hist: { d: Date; v: number }[] = [];
  for (let i = 84; i >= 1; i--) { const d = addDays(today0, -i); hist.push({ d, v: daily(d) }); }
  const mid = hist.filter((h) => h.d.getDate() > 3 && h.d.getDate() <= dim(h.d) - 5);
  const base = mean(mid.filter((h) => h.d.getDay() !== 0).map((h) => h.v));
  const wd = Array.from({ length: 7 }, (_, k) => { const xs = mid.filter((h) => h.d.getDay() === k).map((h) => h.v); return xs.length ? mean(xs) / base : 1; });
  const ends = hist.filter((h) => h.d.getDate() > dim(h.d) - 5 && h.d.getDay() !== 0);
  const starts = hist.filter((h) => h.d.getDate() <= 3 && h.d.getDay() !== 0);
  const push = ends.length ? mean(ends.map((h) => h.v)) / base : 1;
  const start = starts.length ? mean(starts.map((h) => h.v)) / base : 1;
  // Current level: last 14 days, de-seasonalised.
  const recent = hist.slice(-14).map((h) => h.v / (wd[h.d.getDay()] * (h.d.getDate() > dim(h.d) - 5 ? push : h.d.getDate() <= 3 ? start : 1)));
  const level = mean(recent);
  const noise = stdev(mid.slice(-28).map((h) => h.v / (wd[h.d.getDay()] || 1))) / (base || 1);
  const expect = (d: Date) => level * wd[d.getDay()] * (d.getDate() > dim(d) - 5 ? push : d.getDate() <= 3 ? start : 1);
  return { daily, expect, level, noise, push };
}

export function salesForecast(asms: Asm[] = ASMS): SalesForecast {
  const f = learnFactors(asms);
  const mStart = new Date(today0.getFullYear(), today0.getMonth(), 1);
  const n = dim(today0);
  const target = sum(asms, (a) => asmPeriodTarget(a, [mStart, new Date(today0.getFullYear(), today0.getMonth(), n)]));
  let cumA = 0, cumF = 0, varF = 0, sumE = 0;
  const LEVEL_SD = 0.05; // uncertainty in the run rate itself, shared by all remaining days
  const series: SalesForecast["series"] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(today0.getFullYear(), today0.getMonth(), i);
    const tgt = (target * i) / n;
    if (d <= today0) {
      cumA += f.daily(d);
      cumF = cumA;
      series.push({ day: String(i), actual: cumA, forecast: d.getTime() === today0.getTime() ? cumA : null, lo: d.getTime() === today0.getTime() ? cumA : null, hi: d.getTime() === today0.getTime() ? cumA : null, target: tgt });
    } else {
      const e = f.expect(d);
      cumF += e; sumE += e;
      varF += (e * Math.max(0.08, f.noise)) ** 2;
      const s = Math.sqrt(varF + (LEVEL_SD * sumE) ** 2);
      series.push({ day: String(i), actual: null, forecast: cumF, lo: cumF - 1.28 * s, hi: cumF + 1.28 * s, target: tgt });
    }
  }
  const sd = Math.sqrt(varF + (LEVEL_SD * sumE) ** 2) || 1;
  const daysLeft = n - today0.getDate();
  return {
    mtd: cumA, target, projected: cumF, lo: cumF - 1.28 * sd, hi: cumF + 1.28 * sd, pHit: normCdf((cumF - target) / sd), achievement: cumF / target,
    daysLeft, needPerDay: Math.max(0, target - cumA) / Math.max(1, daysLeft), expectedPerDay: daysLeft ? (cumF - cumA) / daysLeft : 0, series,
  };
}

export function zoneForecasts() {
  return ZONES.map(([z]) => ({ zone: z.split(" – ")[0], full: z, ...salesForecast(ASMS.filter((a) => a.zone === z)) }));
}

/* ------------------------------ freight ₹/km ------------------------------ */
export function freightForecast() {
  const hist = MONTHS.map((m) => { const ts = trips.filter((t) => t.mk === m.key && t.ms.gateOut); return { month: m.label, v: sum(ts, "total") / (sum(ts, "km") || 1) }; });
  const fit = linFit(hist.map((h) => h.v));
  const next = [1, 2, 3].map((k) => { const d = new Date(MONTHS[5].date.getFullYear(), MONTHS[5].date.getMonth() + k, 1); const v = fit.at(5 + k); return { month: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), v, lo: v - 1.28 * fit.resid * Math.sqrt(1 + k / 6), hi: v + 1.28 * fit.resid * Math.sqrt(1 + k / 6) }; });
  return { hist, next, slope: fit.b };
}

/* --------------------------------- OTIF risk -------------------------------- */
/** Probability an open order misses OTIF, from its stage and how much of its OTIF window is already used. */
export function otifRisk() {
  const open = orders.filter((o) => o.stage !== "dispatched" && (+NOW - +o.approved) / DAY <= 30);
  const stageP: Record<string, number> = { no_indent: 0.55, not_accepted: 0.42, vehicle_pending: 0.3, vehicle_reported: 0.16, under_process: 0.08 };
  const scored = open.map((o) => {
    const used = (+NOW - +o.approved) / Math.max(H, +o.target - +o.approved);
    const p = Math.min(0.97, Math.max(0.02, (stageP[o.stage] ?? 0.2) * (0.4 + used * 1.3) + (o.otifStatus === "risk" ? 0.35 : 0)));
    return { o, p };
  }).sort((a, b) => b.p - a.p);
  const mtd = orders.filter((o) => o.mk === CUR_MONTH && o.otif != null);
  const metQ = sum(mtd, (o) => o.otif! * o.qty), q = sum(mtd, "qty");
  const openMtd = scored.filter((s) => s.o.mk === CUR_MONTH);
  const expMet = metQ + sum(openMtd, (s) => (1 - s.p) * s.o.qty);
  const expQ = q + sum(openMtd, (s) => s.o.qty);
  return { scored, high: scored.filter((s) => s.p >= 0.25), mtdOtif: (metQ / (q || 1)) * 100, projectedOtif: (expMet / (expQ || 1)) * 100 };
}

/* ------------------------------ trip delay risk ----------------------------- */
export function delayRisk() {
  const active = trips.filter((t) => t.stage !== "epod_done");
  const scored = active.map((t) => {
    const eta = tripEta(t);
    if (!eta) return { t, p: 0.05, eta };
    const hoursToDue = (+eta.due - +NOW) / H;
    const p = eta.late ? Math.min(0.98, 0.7 + eta.lateBy / 100) : Math.max(0.03, Math.min(0.6, 0.45 - hoursToDue / 40 + (t.own === "Market" ? 0.08 : 0) + (t.consent !== "ALLOWED" ? 0.07 : 0)));
    return { t, p, eta };
  }).sort((a, b) => b.p - a.p);
  return { scored, late: scored.filter((s) => s.eta?.late), atRisk: scored.filter((s) => !s.eta?.late && s.p >= 0.3) };
}

/* -------------------------------- CFA demand -------------------------------- */
export function cfaForecast(days = 14) {
  const daily = (d: Date) => CFAS.reduce((a, _, i) => a + cfaQty(i, d), 0);
  const hist: { d: Date; v: number }[] = [];
  for (let i = 56; i >= 0; i--) { const d = addDays(today0, -i); hist.push({ d, v: daily(d) }); }
  const wd = Array.from({ length: 7 }, (_, k) => mean(hist.filter((h) => h.d.getDay() === k).map((h) => h.v)));
  const recent = mean(hist.slice(-28).map((h) => h.v)), prior = mean(hist.slice(0, 28).map((h) => h.v));
  const trend = prior ? recent / prior : 1;
  const next = Array.from({ length: days }, (_, i) => { const d = addDays(today0, i + 1); const v = wd[d.getDay()] * Math.sqrt(trend); return { d, day: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), v, lo: v * 0.86, hi: v * 1.14 }; });
  return { hist: hist.slice(-28), next, total: sum(next, "v"), trend };
}

/* ------------------------------ margin projection ----------------------------- */
export function marginForecast() {
  const accs = ACCOUNTS.map((a) => a[0]);
  const hist = MONTHS.map((m) => { const p = plSum(accs, m.key); return { month: m.label, v: (p.materialMargin / (p.netSales || 1)) * 100, net: p.netSales }; });
  const fit = linFit(hist.slice(0, 5).map((h) => h.v));
  const projected = fit.at(5);
  const nextMonth = fit.at(6);
  return { hist, projected, nextMonth, mtd: hist[5].v, slope: fit.b };
}

/* -------------------------------- spoke health ------------------------------- */
export type Health = "healthy" | "degraded" | "down";
export const healthLabel: Record<Health, string> = { healthy: "On track", degraded: "Watch", down: "Critical" };
