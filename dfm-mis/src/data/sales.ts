import { ASMS, BRANDS, CHANNELS, MONTHS, NOW, PACKS, ZONES, asmDay, asmTarget, hash, today0, type Asm } from "./data";
import { DAY, sum } from "./format";

export type Range = [Date, Date];
export const PRESETS: [string, string][] = [["today", "Today"], ["yesterday", "Yesterday"], ["week", "This week"], ["month", "MTD"], ["last_month", "Last month"], ["year", "FY to date"]];

export function periodRange(p: string): Range {
  const t = today0, y = t.getFullYear(), m = t.getMonth();
  if (p === "today") return [t, t];
  if (p === "yesterday") { const d = new Date(+t - DAY); return [d, d]; }
  if (p === "week") { const dow = (t.getDay() + 6) % 7; return [new Date(+t - dow * DAY), t]; }
  if (p === "month") return [new Date(y, m, 1), t];
  if (p === "last_month") return [new Date(y, m - 1, 1), new Date(y, m, 0)];
  return [new Date(m >= 3 ? y : y - 1, 3, 1), t];
}
export function shiftRange([a, b]: Range, how: string): Range {
  if (how === "lysm") return [new Date(a.getFullYear() - 1, a.getMonth(), a.getDate()), new Date(b.getFullYear() - 1, b.getMonth(), b.getDate())];
  return [new Date(a.getFullYear(), a.getMonth() - 1, a.getDate()), new Date(b.getFullYear(), b.getMonth() - 1, Math.min(b.getDate(), new Date(b.getFullYear(), b.getMonth(), 0).getDate()))];
}
export function eachDay([a, b]: Range, f: (d: Date) => void) {
  for (let d = new Date(a); d <= b; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) f(d);
}
const cache = new Map<string, number>();
export function asmPeriod(a: Asm, range: Range) {
  const k = `s${a.idx}-${+range[0]}-${+range[1]}`;
  if (!cache.has(k)) { let s = 0; eachDay(range, (d) => { s += asmDay(a, d); }); cache.set(k, s); }
  return cache.get(k)!;
}
export function asmPeriodTarget(a: Asm, range: Range) {
  const k = `t${a.idx}-${+range[0]}-${+range[1]}`;
  if (!cache.has(k)) {
    let t = 0;
    eachDay(range, (d) => { const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); t += asmTarget(a, d.getFullYear(), d.getMonth()) / dim; });
    cache.set(k, t);
  }
  return cache.get(k)!;
}
export function salesTotal(range: Range) {
  return { sales: sum(ASMS, (a) => asmPeriod(a, range)), target: sum(ASMS, (a) => asmPeriodTarget(a, range)) };
}
export const mixFactor = (i: number, j: number, range: Range) => 0.9 + hash(i * 7 + j, range[0].getMonth() + range[0].getFullYear()) * 0.2;

export interface SalesNode { key: string; label: string; kind?: string; sales: number; target: number; cmp: number; children?: SalesNode[] }

export function teamNodes(range: Range, cmp: Range): SalesNode[] {
  const agg = (list: Asm[]) => ({ sales: sum(list, (a) => asmPeriod(a, range)), target: sum(list, (a) => asmPeriodTarget(a, range)), cmp: sum(list, (a) => asmPeriod(a, cmp)) });
  return ZONES.map(([z, regs]) => ({
    key: "z:" + z, label: z, kind: "Zone", ...agg(ASMS.filter((a) => a.zone === z)),
    children: regs.map(([r]) => ({
      key: "r:" + r, label: r, kind: "Region", ...agg(ASMS.filter((a) => a.region === r)),
      children: ASMS.filter((a) => a.region === r).map((a) => ({ key: "a:" + a.idx, label: a.name, kind: "ASM", ...agg([a]) })),
    })),
  }));
}
export function brandNodes(range: Range, cmp: Range): SalesNode[] {
  const T0 = salesTotal(range), P0 = salesTotal(cmp);
  return BRANDS.map(([b, sh], i) => {
    const n: SalesNode = { key: "b:" + b, label: b, kind: "Brand", sales: T0.sales * sh * mixFactor(i, 0, range), target: T0.target * sh, cmp: P0.sales * sh * mixFactor(i, 0, cmp) };
    n.children = PACKS.map(([p, ps], j) => ({ key: "b:" + b + p, label: p, kind: "Pack", sales: n.sales * ps * mixFactor(i, j + 1, range), target: n.target * ps, cmp: n.cmp * ps * mixFactor(i, j + 1, cmp) }));
    return n;
  });
}
export function channelNodes(range: Range, cmp: Range, compare: string): SalesNode[] {
  const T0 = salesTotal(range), P0 = salesTotal(cmp);
  return CHANNELS.map(([c, sh, subs], i) => {
    const n: SalesNode = { key: "c:" + c, label: c, kind: "Channel", sales: T0.sales * sh * mixFactor(i, 9, range) * (c.startsWith("E-") ? 1.06 : 1), target: T0.target * sh, cmp: P0.sales * sh * mixFactor(i, 9, cmp) * (c.startsWith("E-") && compare === "lysm" ? 0.72 : 1) };
    n.children = subs.map(([s, ss], j) => ({ key: "c:" + c + s, label: s, kind: "Sub-channel", sales: n.sales * ss * mixFactor(i, j + 11, range), target: n.target * ss, cmp: n.cmp * ss * mixFactor(i, j + 11, cmp) }));
    return n;
  });
}
export function monthlySales() {
  return MONTHS.map((m) => {
    const r: Range = [m.date, new Date(Math.min(+new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0), +today0))];
    return { label: m.label, ...salesTotal(r) };
  });
}
export function monthContext() {
  const mStart = new Date(today0.getFullYear(), today0.getMonth(), 1);
  const mEnd = new Date(today0.getFullYear(), today0.getMonth() + 1, 0);
  const mtd = salesTotal([mStart, today0]);
  const mTarget = salesTotal([mStart, mEnd]).target;
  const daysLeft = Math.max(1, mEnd.getDate() - today0.getDate());
  return { mtd, mTarget, daysLeft, runRate: mtd.sales / today0.getDate(), required: Math.max(0, mTarget - mtd.sales) / daysLeft, now: NOW };
}
