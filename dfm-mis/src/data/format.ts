export const H = 3600e3;
export const DAY = 24 * H;

export const fmtN = (n: number | null | undefined) => Math.round(n || 0).toLocaleString("en-IN");
export const inr = (n: number) => "₹" + fmtN(n);
export const cr = (n: number) =>
  Math.abs(n) >= 1e7 ? "₹" + (n / 1e7).toFixed(2) + " Cr" : "₹" + (n / 1e5).toFixed(2) + " L";
/** Compact axis formatter for rupee values. */
export const crAxis = (n: number) =>
  Math.abs(n) >= 1e7 ? (n / 1e7).toFixed(1) + "Cr" : Math.abs(n) >= 1e5 ? (n / 1e5).toFixed(0) + "L" : Math.abs(n) >= 1e3 ? (n / 1e3).toFixed(0) + "k" : String(Math.round(n));
export const compact = (n: number) =>
  Math.abs(n) >= 1e5 ? (n / 1e5).toFixed(1) + "L" : Math.abs(n) >= 1e3 ? (n / 1e3).toFixed(1) + "k" : fmtN(n);
export const pctv = (a: number, b: number) => (b ? (a / b) * 100 : 0);
export const pct = (a: number, b: number, d = 1) => (b ? ((a / b) * 100).toFixed(d) + "%" : "–");
export const fdt = (d: Date | null | undefined) =>
  d
    ? d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })
    : "–";
export const fd = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
export const fdShort = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
export const fdDay = (d: Date) => d.getDate() + " " + d.toLocaleDateString("en-IN", { month: "short" });
export const ageStr = (ms: number) => {
  const h = ms / H;
  return h < 24 ? h.toFixed(1) + " h" : Math.floor(h / 24) + "d " + Math.round(h % 24) + "h";
};
export const sum = <T,>(rows: T[], f: keyof T | ((r: T) => number)) =>
  rows.reduce((s, r) => s + (typeof f === "function" ? f(r) : (Number(r[f]) || 0)), 0);
export const avg = <T,>(rows: T[], f: keyof T | ((r: T) => number)) => (rows.length ? sum(rows, f) / rows.length : 0);
export function groupBy<T, K>(rows: T[], f: (r: T) => K) {
  const m = new Map<K, T[]>();
  rows.forEach((r) => {
    const k = f(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  });
  return m;
}
export const monthKey = (d: Date) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
export const dayKey = (d: Date) => monthKey(d) + "-" + String(d.getDate()).padStart(2, "0");
export const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
