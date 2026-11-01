/* DFM Foods MIS — deterministic demo data (ported from the prototype). */
import { C } from "./colors";
import { DAY, H, dayKey, monthKey } from "./format";

// Fixed demo clock so every view looks populated and data is identical on every load.
export const NOW = new Date(2026, 9, 28, 15, 40);
export const today0 = new Date(NOW);
today0.setHours(0, 0, 0, 0);
let _s = 20260501 + Math.floor(today0.getTime() / DAY);
const rnd = () => {
  _s = (_s * 1664525 + 1013904223) % 4294967296;
  return _s / 4294967296;
};
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const randInt = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
function wpick<T>(arr: [T, number][]): T {
  const t = arr.reduce((s, x) => s + x[1], 0);
  let r = rnd() * t;
  for (const [v, w] of arr) if ((r -= w) <= 0) return v;
  return arr[arr.length - 1][0];
}
export const hash = (a: number, b: number) => {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export interface Month { key: string; label: string; date: Date }
export const MONTHS: Month[] = [];
for (let i = 5; i >= 0; i--) {
  const d = new Date(NOW.getFullYear(), NOW.getMonth() - i, 1);
  MONTHS.push({ key: monthKey(d), label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), date: d });
}
export const monthLabel = (k: string) => MONTHS.find((m) => m.key === k)?.label ?? k;
export const CUR_MONTH = MONTHS[5].key;

// ---------- master data ----------
const ORIGINS: [string, number][] = [["FG(Main)Warehouse - GN", 84], ["FG(Main)Warehouse - GZB", 12], ["FG(Main)-C-37 Warehouse - GZB", 4]];
export const originShort = (o: string) => (o.includes("C-37") ? "C-37 GZB" : o.endsWith("GN") ? "GN" : "GZB");
export const LOCATIONS = ["GN", "GZB", "C-37 GZB"];
interface Dest { name: string; km: number; w: number; custs: string[] }
const DESTS: Dest[] = ([
  ["Delhi", 45, 15], ["Ghaziabad", 35, 7], ["Meerut", 75, 5], ["Gurugram", 70, 4], ["Agra", 190, 4], ["Lucknow", 470, 4], ["Dehradun", 250, 3.5],
  ["Moradabad", 165, 3], ["Kanpur", 440, 2.5], ["Jalandhar", 400, 2.5], ["Ludhiana", 340, 2.5], ["Jaipur", 290, 3], ["Chandigarh", 270, 2.5],
  ["Bareilly", 250, 2], ["Aligarh", 110, 2], ["Haridwar", 210, 1.5], ["Varanasi", 780, 1.5], ["Panipat", 120, 1.5], ["Ambala", 220, 1.2],
  ["Patna", 1050, 1.2], ["Faridabad", 40, 3], ["Noida", 15, 3], ["Rohtak", 110, 1.2], ["Hisar", 200, 1], ["Mathura", 140, 1.2],
  ["Saharanpur", 180, 1], ["Muzaffarnagar", 120, 1.2], ["Gorakhpur", 760, 0.8], ["Ranchi", 1240, 0.6], ["Kolkata", 1500, 0.5], ["Indore", 820, 0.5],
] as [string, number, number][]).map(([name, km, w]) => ({ name, km, w, custs: [] }));
const CFA_CITIES = ["Lucknow", "Kanpur", "Jaipur", "Dehradun", "Ludhiana", "Patna", "Ranchi", "Kolkata", "Indore", "Varanasi"];
const SURN = ["Gupta", "Agarwal", "Bansal", "Mittal", "Jain", "Goyal", "Singhal", "Arora", "Khanna", "Kapoor", "Chawla", "Sethi", "Verma", "Rastogi", "Garg", "Saxena", "Tandon", "Mehra"];
const SUFF = ["Traders", "Distributors", "Enterprises", "Agencies", "Trading Co.", "Sales Corporation", "& Sons", "Marketing"];
const PREF = ["Shiv Shakti", "Shree Balaji", "Maa Durga", "New", "Royal", "Om Sai", "Jai Ambey", "Krishna"];
DESTS.forEach((d) => {
  const n = d.w > 4 ? 6 : d.w > 2 ? 3 : 2;
  for (let i = 0; i < n; i++) d.custs.push(rnd() < 0.35 ? `${pick(PREF)} ${pick(SUFF)}` : `${pick(SURN)} ${pick(SUFF)}`);
});
export const TR_CONTRACT = ["Shree Ganesh Roadlines", "Om Sai Carriers", "Northern Freight Movers", "Kartar Roadways", "Raghav Logistics"];
export const TR_MARKET = ["Jai Mata Di Transport Co.", "Sharma Golden Transport", "Rathi Cargo Services", "Punjab Haryana Roadlines", "Doon Valley Carriers", "Shyam Logistics"];
const vehNo = () => {
  const st = wpick<string>([["UP16", 4], ["UP14", 3], ["HR55", 3], ["DL1L", 2], ["HR38", 2], ["UP15", 1], ["PB10", 1], ["RJ14", 1]]);
  return `${st} ${String.fromCharCode(65 + randInt(0, 25))}${String.fromCharCode(65 + randInt(0, 25))} ${randInt(1000, 9999)}`;
};
export const DEDICATED = [
  { vno: "UP16 DT 4521", tr: "Shree Ganesh Roadlines", len: "20" }, { vno: "UP16 ET 7708", tr: "Shree Ganesh Roadlines", len: "20" },
  { vno: "HR55 AK 3190", tr: "Om Sai Carriers", len: "22" }, { vno: "DL1L AB 6624", tr: "Kartar Roadways", len: "20" },
  { vno: "UP14 GT 9035", tr: "Raghav Logistics", len: "24" }, { vno: "UP16 CT 1187", tr: "Northern Freight Movers", len: "22" },
];
const RATE: Record<string, number> = { "32": 46, "27": 41, "24": 38, "22": 35, "20": 32 };

// ---------- trip stages ----------
export interface Stage { key: string; label: string; color: string; status?: string }
export const TSTAGES: Stage[] = [
  { key: "trip_created", label: "Reporting Pending", color: C.muted, status: "Trip Created" },
  { key: "vehicle_reported", label: "Vehicle Reported", color: C.orange, status: "Origin Gate Entry Done" },
  { key: "loading", label: "Loading", color: C.c3, status: "Loading Started" },
  { key: "invoiced", label: "Invoiced", color: C.c5, status: "Invoice Completed" },
  { key: "in_transit", label: "In Transit", color: C.c1, status: "Origin Gate Out Done" },
  { key: "at_destination", label: "At Destination", color: C.c4, status: "Destination Vehicle Reported" },
  { key: "unloaded", label: "Unloaded", color: C.c2, status: "Destination Gate Out Done" },
  { key: "epod_done", label: "ePOD Done", color: C.teal, status: "ePOD Done" },
];
export const tStage = (k: string) => TSTAGES.find((s) => s.key === k)!;
const MS_KEYS = ["created", "reported", "loadStart", "invoiced", "gateOut", "destReported", "destGateOut", "epod"] as const;
type MsKey = (typeof MS_KEYS)[number];

export interface Trip {
  id: string; created: Date; mk: string; dk: string; origin: string; loc: string; dest: string; km: number; own: "Contracted" | "Market";
  len: string; vtype: string; transporter: string; vno: string; dedicated: boolean; customer: string; otype: string; consent: string;
  stage: string; stageIdx: number; status: string; ms: Record<MsKey, Date | null>; lastUpdated: Date;
  freight: number; l1: number; definedRoute: boolean; sysDet: number; actDet: number; addl: number; shortPen: number; dmgPen: number;
  invQty: number; shortQty: number; excessQty: number; total: number; acceptedBy: string; epodDone: boolean; payStatus: string;
  pi: boolean; piAt: Date | null; paidAt: Date | null; timely: boolean | null; cleanSource: string | null; cdEligible: boolean;
  cdAvailed: boolean; cdAmt: number; tPlant: number | null; tTransit: number | null; tDest: number | null; tEpod: number | null;
}

export const trips: Trip[] = [];
let tripSeq = 1541870;
function makeTrip(created: Date) {
  const dest = wpick(DESTS.map((x) => [x, x.w] as [Dest, number]));
  const origin = wpick(ORIGINS);
  const km = Math.max(12, Math.round(dest.km * (0.94 + rnd() * 0.12) - (origin.includes("GZB") ? 18 : 0)));
  const own = rnd() < 0.57 ? "Contracted" : "Market";
  let len = dest.km < 130 ? wpick<string>([["20", 30], ["22", 15], ["24", 8], ["32", 47]]) : wpick<string>([["32", 76], ["27", 12], ["24", 5], ["22", 4], ["20", 3]]);
  let transporter = own === "Contracted" ? pick(TR_CONTRACT) : pick(TR_MARKET);
  let vno = vehNo();
  let dedicated = false;
  if (dest.km < 80 && own === "Contracted" && rnd() < 0.45) { const dv = pick(DEDICATED); vno = dv.vno; transporter = dv.tr; len = dv.len; dedicated = true; }
  const isCfa = CFA_CITIES.includes(dest.name) && rnd() < 0.55;
  const customer = isCfa ? `DFM CFA - ${dest.name}` : pick(dest.custs);
  const otype = rnd() < 0.012 ? "Mixed Order" : rnd() < 0.64 ? "Indent Order" : "Direct Order";
  const consent = rnd() < (own === "Contracted" ? 0.68 : 0.42) ? "ALLOWED" : "PENDING";
  const slow = rnd() < 0.1 ? 2.5 : 1;
  const ms = { created } as Record<MsKey, Date | null>;
  ms.reported = new Date(+created + (0.6 + rnd() * 3.5) * slow * H);
  ms.loadStart = new Date(+ms.reported + (0.8 + rnd() * 3) * slow * H);
  ms.invoiced = new Date(+ms.loadStart + (1.5 + rnd() * 2.5) * H);
  ms.gateOut = new Date(+ms.invoiced + (0.4 + rnd() * 1.2) * H);
  const transit = (km / (own === "Market" ? 30 : 34)) * (0.9 + rnd() * 0.45) + 1;
  ms.destReported = new Date(+ms.gateOut + transit * H);
  const detained = rnd() < 0.16;
  const destWait = detained ? 26 + rnd() * 50 : 1.5 + rnd() * 9;
  ms.destGateOut = new Date(+ms.destReported + destWait * H);
  ms.epod = new Date(+ms.destGateOut + (8 + rnd() * 70) * H);
  let stageIdx = 0;
  MS_KEYS.forEach((k, i) => { if (ms[k]! <= NOW) stageIdx = i; });
  MS_KEYS.forEach((k, i) => { if (i > stageIdx) ms[k] = null; });
  const stage = TSTAGES[stageIdx].key;
  const lastUpdated = ms[MS_KEYS[stageIdx]]!;
  const base = Math.max(len === "32" ? 6500 : 4500, km * RATE[len] * (own === "Market" ? 1.06 : 1) * (0.93 + rnd() * 0.14));
  const freight = Math.round(base / 50) * 50;
  const definedRoute = own === "Contracted" || rnd() < 0.74;
  const l1 = definedRoute ? Math.round((own === "Contracted" ? freight * (0.97 + rnd() * 0.05) : freight / (1.0 + rnd() * 0.09)) / 50) * 50 : 0;
  const detDays = detained ? Math.floor(destWait / 24) : 0;
  const sysDet = detDays * (+len >= 27 ? 1500 : 1000);
  const epodDone = stage === "epod_done";
  const actDet = epodDone && sysDet && rnd() < 0.72 ? Math.round((sysDet * (0.6 + rnd() * 0.4)) / 100) * 100 : 0;
  const addl = epodDone && rnd() < 0.12 ? pick([500, 750, 1000, 1500, 2000]) : 0;
  const invQty = stageIdx >= 3 ? Math.round(+len * (40 + rnd() * 12)) : 0;
  const shortQty = stageIdx >= 6 && rnd() < 0.07 ? randInt(1, 28) : 0;
  const excessQty = stageIdx >= 6 && !shortQty && rnd() < 0.025 ? randInt(1, 12) : 0;
  const shortPen = shortQty ? shortQty * randInt(180, 260) : 0;
  const dmgPen = epodDone && rnd() < 0.03 ? randInt(5, 30) * 100 : 0;
  let payStatus = "", pi = false, paidAt: Date | null = null, piAt: Date | null = null, timely: boolean | null = null, cleanSource: string | null = null;
  if (epodDone) {
    cleanSource = rnd() < 0.71 ? "Auto" : "Manual";
    const sinceEpod = (+NOW - +ms.epod!) / DAY;
    if (sinceEpod < 2) payStatus = "Invoice Pending";
    else {
      pi = true;
      piAt = new Date(+ms.epod! + (1 + rnd() * 3) * DAY);
      if (piAt > NOW) piAt = new Date(+NOW - H);
      const payDays = rnd() < 0.3 ? 3 + rnd() * 5 : 10 + rnd() * 30;
      if (rnd() < 0.015) payStatus = "Charges Rejected";
      else if ((+NOW - +piAt) / DAY > payDays) { payStatus = "Paid"; paidAt = new Date(+piAt + payDays * DAY); timely = payDays <= 30; }
      else payStatus = sinceEpod < 5 ? "Approval Pending" : "Payment Pending";
    }
  }
  const payDaysAct = paidAt && piAt ? (+paidAt - +piAt) / DAY : null;
  const cdEligible = !!paidAt && payDaysAct! <= 7;
  const cdAvailed = cdEligible && rnd() < 0.86;
  const t = (a: MsKey, b: MsKey) => (ms[a] && ms[b] ? (+ms[b]! - +ms[a]!) / H : null);
  const vtype = `${len} ft ${rnd() < 0.55 ? "SXL Container" : "SXL Closed Body"}`;
  const acceptedBy = own === "Contracted" ? (rnd() < 0.62 ? "Transporter Accepted" : "DFM Accepted") : "Transporter Accepted";
  trips.push({
    id: "DS-" + tripSeq++, created, mk: monthKey(created), dk: dayKey(created), origin, loc: originShort(origin), dest: dest.name, km, own, len, vtype,
    transporter, vno, dedicated, customer, otype, consent, stage, stageIdx, status: tStage(stage).status!, ms, lastUpdated,
    freight, l1, definedRoute, sysDet, actDet, addl, shortPen, dmgPen, invQty, shortQty, excessQty,
    total: freight + actDet + addl - shortPen - dmgPen, acceptedBy,
    epodDone, payStatus, pi, piAt, paidAt, timely, cleanSource, cdEligible, cdAvailed, cdAmt: cdAvailed ? Math.round(freight * 0.02) : 0,
    tPlant: t("reported", "gateOut"), tTransit: t("gateOut", "destReported"), tDest: t("destReported", "destGateOut"), tEpod: t("destGateOut", "epod"),
  });
}
for (let d = Math.round((+NOW - +MONTHS[0].date) / DAY); d >= 0; d--) {
  const day = new Date(+today0 - d * DAY);
  const dow = day.getDay();
  let n = dow === 0 ? randInt(3, 6) : randInt(13, 20);
  const m = day.getMonth();
  if (m === 9) n = Math.round(n * 1.18);
  if (m === 6 || m === 7) n = Math.round(n * 0.92);
  for (let i = 0; i < n; i++) { const c = new Date(+day + (6 + rnd() * 15) * H); if (c <= NOW) makeTrip(c); }
}
export const DESTINATIONS = [...new Set(trips.map((t) => t.dest))].sort();

// ---------- order stages ----------
export const OSTAGES: Stage[] = [
  { key: "no_indent", label: "Indent Pending", color: C.bad },
  { key: "not_accepted", label: "Acceptance Pending", color: C.orange },
  { key: "vehicle_pending", label: "Reporting Pending", color: C.c3 },
  { key: "vehicle_reported", label: "Vehicle Reported", color: C.c1 },
  { key: "under_process", label: "Under Process", color: C.c4 },
  { key: "dispatched", label: "Dispatched", color: C.c2 },
];
export const oStage = (k: string) => OSTAGES.find((s) => s.key === k)!;
type OmKey = "approved" | "indent" | "accept" | "report" | "process" | "dispatch";
export interface Order {
  no: string; approved: Date; mk: string; plant: string; location: string; type: string; dest: string; customer: string; qty: number;
  dispQty: number; qtyShown: number; m: Record<OmKey, Date | null>; stage: string; statusTxt: string; target: Date; onTime: boolean | null;
  otif: number | null; otifStatus: "met" | "missed" | "risk" | "na"; src: string; transporter: string; vno: string; productType: string;
}
export interface Indent {
  no: string; order: string; orderRef: Order; src: string; created: Date; accepted: Date | null; reported: Date | null; status: string;
  transporter: string; bids: number | null; l1: number | null; rate: number; dest: string; qty: number;
}
export const orders: Order[] = [];
export const indents: Indent[] = [];
let soSeq = 4180, indSeq = 22410;
function makeOrder(approved: Date) {
  const plant = rnd() < 0.86 ? "GN" : "GZB";
  const stock = rnd() < 0.38;
  const destName = stock ? pick(CFA_CITIES) : wpick(DESTS.filter((d) => d.km < 900).map((x) => [x.name, x.w] as [string, number]));
  const dest = DESTS.find((d) => d.name === destName)!;
  const customer = stock ? `DFM CFA - ${destName}` : pick(dest.custs);
  const qty = stock ? randInt(900, 1700) : rnd() < 0.2 ? randInt(40, 199) : randInt(250, 1250);
  const f = rnd() < 0.13 ? 2.2 + rnd() * 3 : 0.7 + rnd() * 0.6;
  const src = rnd() < 0.72 ? "Indent" : "Auction";
  const m = { approved } as Record<OmKey, Date | null>;
  m.indent = new Date(+approved + (0.4 + rnd() * 2.4) * f * H);
  m.accept = new Date(+m.indent + (src === "Auction" ? 1.5 + rnd() * 3 : 0.3 + rnd() * 2.5) * f * H);
  m.report = new Date(+m.accept + (2 + rnd() * 6) * f * H);
  m.process = new Date(+m.report + (1 + rnd() * 3) * f * H);
  m.dispatch = new Date(+m.process + (2 + rnd() * 3) * H);
  const order: OmKey[] = ["approved", "indent", "accept", "report", "process", "dispatch"];
  let si = 0;
  order.forEach((k, i) => { if (m[k]! <= NOW) si = i; });
  order.forEach((k, i) => { if (i > si) m[k] = null; });
  const stage = OSTAGES[si].key;
  const statusTxt = ["Draft", src + " Created", src + " Accepted", "Vehicle Reported", "Loading Started", rnd() < 0.5 ? "Invoice Completed" : "Dispatched"][si];
  const target = new Date(+approved + (stock ? 72 : 48) * H);
  const dispQty = m.dispatch ? Math.round(qty * (rnd() < 0.86 ? 1 : 0.86 + rnd() * 0.13)) : 0;
  const onTime = m.dispatch ? m.dispatch <= target : null;
  let otif: number | null = null;
  let otifStatus: Order["otifStatus"] = "na";
  if (m.dispatch) { otif = onTime ? dispQty / qty : 0; otifStatus = otif >= 0.999 ? "met" : "missed"; }
  else if (NOW > target) { otif = 0; otifStatus = "missed"; }
  else if (+target - +NOW < 8 * H) otifStatus = "risk";
  const tr = src === "Indent" ? pick(TR_CONTRACT) : pick(TR_MARKET);
  const o: Order = {
    no: `SO/${plant}/26-27/${String(soSeq++).padStart(6, "0")}`, approved, mk: monthKey(approved), plant, location: plant === "GN" ? "Greater Noida" : "Ghaziabad",
    type: stock ? "Stock Transfer" : "Direct Order", dest: destName, customer, qty, dispQty, qtyShown: dispQty || qty, m, stage, statusTxt,
    target, onTime, otif, otifStatus, src, transporter: si >= 2 ? tr : "—", vno: si >= 3 ? vehNo() : "—", productType: rnd() < 0.7 ? "SP" : rnd() < 0.6 ? "LP" : "LP + SP",
  };
  orders.push(o);
  if (si >= 1) {
    const bids = src === "Auction" ? randInt(3, 8) : null;
    const rate = Math.round(Math.max(4500, dest.km * 44 * (0.95 + rnd() * 0.12)) / 50) * 50;
    indents.push({
      no: (src === "Indent" ? "IND-" : "AUC-") + indSeq++, order: o.no, orderRef: o, src, created: m.indent!, accepted: m.accept, reported: m.report,
      status: si === 1 ? src + " Created" : si === 2 ? src + " Accepted" : "Vehicle Assigned",
      transporter: si >= 2 ? tr : src === "Auction" ? `${bids} bids received` : `Sent to ${tr}`, bids, l1: src === "Auction" ? rate : null, rate, dest: destName, qty,
    });
  }
}
for (let d = Math.round((+NOW - +MONTHS[0].date) / DAY); d >= 0; d--) {
  const day = new Date(+today0 - d * DAY);
  const n = day.getDay() === 0 ? randInt(1, 3) : randInt(10, 16);
  for (let i = 0; i < n; i++) { const a = new Date(+day + (9 + rnd() * 10) * H); if (a <= NOW) makeOrder(a); }
}
orders.sort((a, b) => +b.approved - +a.approved);
indents.sort((a, b) => +b.created - +a.created);
export const ORDER_DESTS = [...new Set(orders.map((o) => o.dest))].sort();

// ---------- ECOM appointment orders ----------
export const PLATFORMS = ["Amazon", "Flipkart", "Blinkit", "Zepto", "Swiggy Instamart", "BigBasket"];
const ECOM_FC: Record<string, string[]> = { Amazon: ["DEL4 – Jamalpur", "DED3 – Farukhnagar", "LKO1 – Lucknow"], Flipkart: ["Bilaspur (GGN)", "Dankuni (KOL)"], Blinkit: ["Gurugram Mother WH", "Noida Sec-63 WH"], Zepto: ["Delhi Mother Hub", "Ghaziabad Hub"], "Swiggy Instamart": ["Gurugram Pod Cluster", "Noida Cluster"], BigBasket: ["Ghaziabad DC", "Lucknow DC"] };
export interface EcomOrder { po: string; plat: string; fc: string; poDate: Date; appt: Date; status: string; qty: number; fill: number | null; value: number }
export const ecomOrders: EcomOrder[] = [];
for (let d = 34; d >= -6; d--) {
  const day = new Date(+today0 - d * DAY);
  for (let i = 0; i < randInt(3, 7); i++) {
    const plat = wpick<string>([["Amazon", 3], ["Flipkart", 2], ["Blinkit", 3], ["Zepto", 2.5], ["Swiggy Instamart", 2], ["BigBasket", 1.5]]);
    const appt = new Date(+day + (8 + randInt(0, 9)) * H);
    const po = new Date(+appt - randInt(2, 6) * DAY);
    if (po > NOW) continue;
    let status: string;
    if (appt > NOW) status = rnd() < 0.75 ? "Appointment Booked" : "Appointment Pending";
    else status = rnd() < 0.08 ? "Appointment Missed" : (+NOW - +appt) / DAY > 2 ? (rnd() < 0.9 ? "Delivered" : "GRN Pending") : "Dispatched";
    const q = randInt(60, 900);
    ecomOrders.push({ po: `${plat.slice(0, 2).toUpperCase()}-PO-${randInt(100000, 999999)}`, plat, fc: pick(ECOM_FC[plat]), poDate: po, appt, status, qty: q, fill: status === "Delivered" || status === "GRN Pending" ? Math.round(q * (0.9 + rnd() * 0.1)) : null, value: q * randInt(380, 520) });
  }
}
ecomOrders.sort((a, b) => +b.appt - +a.appt);

// ---------- Sales hierarchy ----------
export const ZONES: [string, [string, string[]][]][] = [
  ["North 1 – Delhi NCR", [["Delhi East", ["Rohit Malhotra", "Vikas Sehgal"]], ["Delhi West", ["Amit Khurana", "Neeraj Bhatia"]], ["Gurugram & Faridabad", ["Sandeep Yadav", "Manish Dahiya"]], ["Noida & Ghaziabad", ["Ankur Tyagi", "Pankaj Chauhan"]]]],
  ["North 2 – Punjab, Haryana & HP", [["Punjab", ["Gurpreet Singh", "Harjeet Sandhu", "Rajan Bedi"]], ["Haryana", ["Deepak Malik", "Sunil Kadian"]], ["HP & J&K", ["Ashish Thakur"]]]],
  ["UP & Uttarakhand", [["West UP", ["Rahul Tomar", "Vivek Rana"]], ["Central UP", ["Saurabh Awasthi", "Anuj Shukla", "Prateek Mishra"]], ["East UP", ["Alok Pandey", "Ravi Tripathi"]], ["Uttarakhand", ["Mohit Negi"]]]],
  ["East", [["Bihar", ["Abhishek Sinha", "Kundan Kumar"]], ["Jharkhand", ["Nitin Mahato"]], ["West Bengal", ["Subhojit Das", "Arindam Ghosh"]]]],
  ["West & Central", [["Rajasthan", ["Lokesh Sharma", "Hemant Rathore"]], ["Madhya Pradesh", ["Gaurav Jain", "Prakash Raghuvanshi"]], ["Gujarat", ["Chirag Patel"]]]],
];
export interface Asm { idx: number; zone: string; region: string; name: string; base: number; growth: number }
export const ASMS: Asm[] = [];
let asmIdx = 0;
ZONES.forEach(([z, regs], zi) => regs.forEach(([r, people]) => people.forEach((p) => {
  ASMS.push({ idx: asmIdx, zone: z, region: r, name: p, base: (zi === 0 ? 6.2 : zi === 2 ? 5.4 : zi === 1 ? 4.6 : 3.6) * 1e5 * (0.75 + hash(asmIdx, 7) * 0.5), growth: 0.86 + hash(asmIdx, 3) * 0.2 });
  asmIdx++;
})));
export const SEASON = [1.0, 0.98, 0.96, 1.02, 1.04, 1.0, 0.92, 0.9, 1.05, 1.2, 1.12, 1.0];
export function asmDay(a: Asm, d: Date) {
  const dn = Math.floor(d.getTime() / DAY);
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const wk = d.getDay() === 0 ? 0.3 : 1;
  const push = d.getDate() > dim - 5 ? 1.32 : d.getDate() <= 3 ? 0.78 : 1;
  const yr = d < new Date(+NOW - 300 * DAY) ? a.growth : 1;
  return a.base * SEASON[d.getMonth()] * wk * push * yr * (0.72 + hash(a.idx, dn) * 0.56);
}
export function asmTarget(a: Asm, y: number, m: number) {
  const dim = new Date(y, m + 1, 0).getDate();
  return a.base * SEASON[m] * dim * 0.93 * (1.02 + hash(a.idx, y * 12 + m) * 0.1);
}
export const BRANDS: [string, number][] = [["CRAX Corn Rings", 0.31], ["Natkhat Namkeen", 0.21], ["CRAX Curls", 0.16], ["CRAX Fritts", 0.13], ["CRAX Chips", 0.11], ["CRAX Pipes & Others", 0.08]];
export const PACKS: [string, number][] = [["₹5 Pack", 0.46], ["₹10 Pack", 0.31], ["₹20 Pack", 0.15], ["Large Pack (₹50+)", 0.08]];
export const CHANNELS: [string, number, [string, number][]][] = [["General Trade", 0.73, [["Urban GT", 0.52], ["Rural GT", 0.3], ["Super Stockist", 0.18]]], ["Modern Trade", 0.09, [["National Chains", 0.55], ["Regional Chains", 0.45]]], ["E-Commerce & Q-Comm", 0.11, [["Blinkit", 0.29], ["Zepto", 0.21], ["Amazon", 0.2], ["Swiggy Instamart", 0.16], ["Flipkart", 0.08], ["BigBasket", 0.06]]], ["CSD & Institutional", 0.07, [["CSD Canteens", 0.6], ["Institutional / HoReCa", 0.4]]]];

// ---------- CFA ----------
export const CFAS = ["CFA Lucknow", "CFA Kanpur", "CFA Jaipur", "CFA Dehradun", "CFA Ludhiana", "CFA Patna", "CFA Ranchi", "CFA Kolkata", "CFA Indore", "CFA Varanasi"];
const CFA_BASE = [2100, 1500, 1700, 1100, 1450, 1300, 750, 980, 820, 900];
export function cfaQty(ci: number, d: Date) {
  if (d.getDay() === 0) return 0;
  const dn = Math.floor(d.getTime() / DAY);
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.round(CFA_BASE[ci] * SEASON[d.getMonth()] * (d.getDate() > dim - 4 ? 1.3 : 1) * (0.6 + hash(ci + 50, dn) * 0.8));
}

// ---------- ECOM P&L ----------
export const ACCOUNTS: [string, number, number][] = [["Blinkit", 1.55e7, 0.115], ["Zepto", 1.12e7, 0.125], ["Amazon", 1.05e7, 0.085], ["Swiggy Instamart", 0.86e7, 0.12], ["Flipkart", 0.44e7, 0.09], ["BigBasket", 0.35e7, 0.075]];
export type Pnl = Record<"grossRevenue" | "productClaims" | "primarySchemes" | "secondaryScheme" | "tradeExpiry" | "ssCommission" | "netSales" | "costOfSales" | "rmCost" | "rmNetBom" | "rmYield" | "pmCost" | "pmNetBom" | "pmYield" | "materialMargin", number>;
export function pnl(acc: string, mk: string): Pnl {
  const [, base, schemeRate] = ACCOUNTS.find((a) => a[0] === acc)!;
  const ai = ACCOUNTS.findIndex((a) => a[0] === acc);
  const mi = MONTHS.findIndex((m) => m.key === mk);
  const mo = MONTHS[mi].date.getMonth();
  const growth = 1 + mi * 0.035;
  const gross = base * SEASON[mo] * growth * (0.92 + hash(ai, mi + 100) * 0.16);
  const primarySchemes = gross * schemeRate * (0.9 + hash(ai, mi + 1) * 0.2);
  const secondaryScheme = gross * 0.032 * (0.8 + hash(ai, mi + 2) * 0.4);
  const tradeExpiry = gross * 0.009 * (0.6 + hash(ai, mi + 3) * 0.8);
  const ssCommission = acc === "Amazon" || acc === "Flipkart" ? gross * 0.018 : 0;
  const claims = primarySchemes + secondaryScheme + tradeExpiry + ssCommission;
  const net = gross - claims;
  const rmNetBom = net * 0.355 * (0.97 + hash(ai, mi + 4) * 0.06);
  const rmYield = rmNetBom * 0.035;
  const pmNetBom = net * 0.118 * (0.97 + hash(ai, mi + 5) * 0.06);
  const pmYield = pmNetBom * 0.022;
  const cos = rmNetBom + rmYield + pmNetBom + pmYield;
  return { grossRevenue: gross, productClaims: claims, primarySchemes, secondaryScheme, tradeExpiry, ssCommission, netSales: net, costOfSales: cos, rmCost: rmNetBom + rmYield, rmNetBom, rmYield, pmCost: pmNetBom + pmYield, pmNetBom, pmYield, materialMargin: net - cos };
}
export function plSum(accs: string[], mk: string) {
  const r = {} as Pnl;
  accs.forEach((a) => { const p = pnl(a, mk); (Object.keys(p) as (keyof Pnl)[]).forEach((k) => (r[k] = (r[k] || 0) + p[k])); });
  return r;
}

// ---------- users / sync ----------
export const ACCESS: [string, string][] = [["sales", "Sales"], ["trip", "Trip"], ["order", "Order"], ["secondary", "Secondary Supply"], ["fin", "Financial"], ["byod", "BYOD"]];
export interface User { name: string; email: string; role: "Admin" | "Viewer"; access: Record<string, boolean>; lastActive: Date }
export const INITIAL_USERS: User[] = ([
  ["Priya Verma", "priya.verma", "Admin", [1, 1, 1, 1, 1, 1], 4], ["Rakesh Nair", "rakesh.nair", "Admin", [1, 1, 1, 1, 1, 1], 26],
  ["Sunil Arora", "sunil.arora", "Viewer", [0, 1, 1, 0, 0, 0], 12], ["Meenakshi Iyer", "meenakshi.iyer", "Viewer", [1, 0, 0, 0, 1, 1], 95],
  ["Harish Bhatt", "harish.bhatt", "Viewer", [0, 1, 1, 1, 0, 0], 3], ["Kavita Joshi", "kavita.joshi", "Viewer", [1, 0, 0, 0, 0, 0], 210],
  ["Amandeep Gill", "amandeep.gill", "Viewer", [1, 0, 0, 1, 0, 0], 48], ["Tarun Khanna", "tarun.khanna", "Viewer", [0, 1, 1, 0, 0, 0], 1500],
  ["Nidhi Saxena", "nidhi.saxena", "Viewer", [1, 1, 1, 1, 1, 0], 7], ["Ajay Rawat", "ajay.rawat", "Viewer", [0, 0, 1, 0, 0, 0], 360],
] as [string, string, "Admin" | "Viewer", number[], number][]).map(([name, u, role, acc, mins]) => ({ name, email: u + "@company.in", role, access: Object.fromEntries(ACCESS.map(([k], i) => [k, !!acc[i]])), lastActive: new Date(+NOW - mins * 60e3) }));
const SYNC_JOBS: [string, string, number, number, number][] = [["fact_TripDetentionReport", "Trip Analytics", 15, 6150, 41], ["fact_Traqo_SalesOrder", "Order Analytics", 15, 18420, 63], ["fact_Indent_Auction_Details", "Order Analytics", 15, 25210, 58], ["dim_Item_ERP", "Order Analytics", 60, 1840, 6], ["fact_OrderFulfillment_ERP", "Order Analytics", 15, 31090, 77], ["fact_SecondarySales_DMS", "Sales Analytics", 30, 412300, 184], ["fact_CFA_Dispatch", "Secondary Supply", 60, 9310, 22], ["fact_Ecom_PnL", "Financial Analytics", 1440, 2210, 15]];
export interface SyncRun { id: string; table: string; area: string; start: Date; secs: number; rows: number; status: "completed" | "in_process" | "failed"; err: string }
export const syncRuns: SyncRun[] = [];
SYNC_JOBS.forEach(([table, area, every, rows, secs], ji) => {
  for (let i = 0; i < 6; i++) {
    const start = new Date(+NOW - ((NOW.getMinutes() % every) + i * every) * 60e3 - 60e3 * ji);
    const failed = ji === 5 && i === 2;
    const inProc = i === 0 && ji === 2;
    syncRuns.push({ id: `${table}-${i}`, table, area, start, secs: Math.round(secs * (0.8 + rnd() * 0.5)), rows: failed ? 0 : rows + randInt(-40, 120), status: inProc ? "in_process" : failed ? "failed" : "completed", err: failed ? "Timeout: remote SQL Server did not respond within 300s" : "" });
  }
});
syncRuns.sort((a, b) => +b.start - +a.start);
export const SYNC_TABLES = SYNC_JOBS.length;

export const DIST_SLABS: [string, number, number, string][] = [["0–50 km", 0, 50, C.c1], ["51–100 km", 51, 100, C.c2], ["101–300 km", 101, 300, C.c3], [">300 km", 301, 1e9, C.c5]];
export const LAST_REFRESH = new Date(+NOW - (NOW.getMinutes() % 15) * 60e3);
