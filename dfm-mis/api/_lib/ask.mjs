// server/ask.ts
import Anthropic from "@anthropic-ai/sdk";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// src/data/colors.ts
var C = {
  c1: "var(--color-chart-1)",
  c2: "var(--color-chart-2)",
  c3: "var(--color-chart-3)",
  c4: "var(--color-chart-4)",
  c5: "var(--color-chart-5)",
  teal: "var(--color-pn-teal)",
  orange: "var(--color-pn-orange)",
  cyan: "var(--color-pn-cyan)",
  pink: "var(--color-pn-pink)",
  lime: "var(--color-pn-lime)",
  muted: "color-mix(in oklab, var(--color-muted-foreground) 45%, transparent)",
  good: "var(--color-success)",
  warn: "var(--color-warning)",
  bad: "var(--color-destructive)"
};
var PALETTE = [C.c1, C.c2, C.c3, C.c4, C.c5, C.teal, C.orange, C.cyan, C.pink, C.lime];

// src/data/format.ts
var H = 36e5;
var DAY = 24 * H;
var fdDay = (d) => d.getDate() + " " + d.toLocaleDateString("en-IN", { month: "short" });
var monthKey = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
var dayKey = (d) => monthKey(d) + "-" + String(d.getDate()).padStart(2, "0");

// src/data/data.ts
var NOW = new Date(2026, 9, 28, 15, 40);
var today0 = new Date(NOW);
today0.setHours(0, 0, 0, 0);
var _s = 20260501 + Math.floor(today0.getTime() / DAY);
var rnd = () => {
  _s = (_s * 1664525 + 1013904223) % 4294967296;
  return _s / 4294967296;
};
var pick = (a) => a[Math.floor(rnd() * a.length)];
var randInt = (a, b) => a + Math.floor(rnd() * (b - a + 1));
function wpick(arr) {
  const t = arr.reduce((s, x) => s + x[1], 0);
  let r = rnd() * t;
  for (const [v, w] of arr) if ((r -= w) <= 0) return v;
  return arr[arr.length - 1][0];
}
var hash = (a, b) => {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
var MONTHS = [];
for (let i = 5; i >= 0; i--) {
  const d = new Date(NOW.getFullYear(), NOW.getMonth() - i, 1);
  MONTHS.push({ key: monthKey(d), label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), date: d });
}
var monthLabel = (k) => MONTHS.find((m) => m.key === k)?.label ?? k;
var CUR_MONTH = MONTHS[5].key;
var ORIGINS = [["FG(Main)Warehouse - GN", 84], ["FG(Main)Warehouse - GZB", 12], ["FG(Main)-C-37 Warehouse - GZB", 4]];
var originShort = (o) => o.includes("C-37") ? "C-37 GZB" : o.endsWith("GN") ? "GN" : "GZB";
var DESTS = [
  ["Delhi", 45, 15],
  ["Ghaziabad", 35, 7],
  ["Meerut", 75, 5],
  ["Gurugram", 70, 4],
  ["Agra", 190, 4],
  ["Lucknow", 470, 4],
  ["Dehradun", 250, 3.5],
  ["Moradabad", 165, 3],
  ["Kanpur", 440, 2.5],
  ["Jalandhar", 400, 2.5],
  ["Ludhiana", 340, 2.5],
  ["Jaipur", 290, 3],
  ["Chandigarh", 270, 2.5],
  ["Bareilly", 250, 2],
  ["Aligarh", 110, 2],
  ["Haridwar", 210, 1.5],
  ["Varanasi", 780, 1.5],
  ["Panipat", 120, 1.5],
  ["Ambala", 220, 1.2],
  ["Patna", 1050, 1.2],
  ["Faridabad", 40, 3],
  ["Noida", 15, 3],
  ["Rohtak", 110, 1.2],
  ["Hisar", 200, 1],
  ["Mathura", 140, 1.2],
  ["Saharanpur", 180, 1],
  ["Muzaffarnagar", 120, 1.2],
  ["Gorakhpur", 760, 0.8],
  ["Ranchi", 1240, 0.6],
  ["Kolkata", 1500, 0.5],
  ["Indore", 820, 0.5]
].map(([name, km, w]) => ({ name, km, w, custs: [] }));
var CFA_CITIES = ["Lucknow", "Kanpur", "Jaipur", "Dehradun", "Ludhiana", "Patna", "Ranchi", "Kolkata", "Indore", "Varanasi"];
var SURN = ["Gupta", "Agarwal", "Bansal", "Mittal", "Jain", "Goyal", "Singhal", "Arora", "Khanna", "Kapoor", "Chawla", "Sethi", "Verma", "Rastogi", "Garg", "Saxena", "Tandon", "Mehra"];
var SUFF = ["Traders", "Distributors", "Enterprises", "Agencies", "Trading Co.", "Sales Corporation", "& Sons", "Marketing"];
var PREF = ["Shiv Shakti", "Shree Balaji", "Maa Durga", "New", "Royal", "Om Sai", "Jai Ambey", "Krishna"];
DESTS.forEach((d) => {
  const n = d.w > 4 ? 6 : d.w > 2 ? 3 : 2;
  for (let i = 0; i < n; i++) d.custs.push(rnd() < 0.35 ? `${pick(PREF)} ${pick(SUFF)}` : `${pick(SURN)} ${pick(SUFF)}`);
});
var TR_CONTRACT = ["Shree Ganesh Roadlines", "Om Sai Carriers", "Northern Freight Movers", "Kartar Roadways", "Raghav Logistics"];
var TR_MARKET = ["Jai Mata Di Transport Co.", "Sharma Golden Transport", "Rathi Cargo Services", "Punjab Haryana Roadlines", "Doon Valley Carriers", "Shyam Logistics"];
var vehNo = () => {
  const st = wpick([["UP16", 4], ["UP14", 3], ["HR55", 3], ["DL1L", 2], ["HR38", 2], ["UP15", 1], ["PB10", 1], ["RJ14", 1]]);
  return `${st} ${String.fromCharCode(65 + randInt(0, 25))}${String.fromCharCode(65 + randInt(0, 25))} ${randInt(1e3, 9999)}`;
};
var DEDICATED = [
  { vno: "UP16 DT 4521", tr: "Shree Ganesh Roadlines", len: "20" },
  { vno: "UP16 ET 7708", tr: "Shree Ganesh Roadlines", len: "20" },
  { vno: "HR55 AK 3190", tr: "Om Sai Carriers", len: "22" },
  { vno: "DL1L AB 6624", tr: "Kartar Roadways", len: "20" },
  { vno: "UP14 GT 9035", tr: "Raghav Logistics", len: "24" },
  { vno: "UP16 CT 1187", tr: "Northern Freight Movers", len: "22" }
];
var RATE = { "32": 46, "27": 41, "24": 38, "22": 35, "20": 32 };
var TSTAGES = [
  { key: "trip_created", label: "Reporting Pending", color: C.muted, status: "Trip Created" },
  { key: "vehicle_reported", label: "Vehicle Reported", color: C.orange, status: "Origin Gate Entry Done" },
  { key: "loading", label: "Loading", color: C.c3, status: "Loading Started" },
  { key: "invoiced", label: "Invoiced", color: C.c5, status: "Invoice Completed" },
  { key: "in_transit", label: "In Transit", color: C.c1, status: "Origin Gate Out Done" },
  { key: "at_destination", label: "At Destination", color: C.c4, status: "Destination Vehicle Reported" },
  { key: "unloaded", label: "Unloaded", color: C.c2, status: "Destination Gate Out Done" },
  { key: "epod_done", label: "ePOD Done", color: C.teal, status: "ePOD Done" }
];
var tStage = (k) => TSTAGES.find((s) => s.key === k);
var MS_KEYS = ["created", "reported", "loadStart", "invoiced", "gateOut", "destReported", "destGateOut", "epod"];
var trips = [];
var tripSeq = 1541870;
function makeTrip(created) {
  const dest = wpick(DESTS.map((x) => [x, x.w]));
  const origin = wpick(ORIGINS);
  const km = Math.max(12, Math.round(dest.km * (0.94 + rnd() * 0.12) - (origin.includes("GZB") ? 18 : 0)));
  const own = rnd() < 0.57 ? "Contracted" : "Market";
  let len = dest.km < 130 ? wpick([["20", 30], ["22", 15], ["24", 8], ["32", 47]]) : wpick([["32", 76], ["27", 12], ["24", 5], ["22", 4], ["20", 3]]);
  let transporter = own === "Contracted" ? pick(TR_CONTRACT) : pick(TR_MARKET);
  let vno = vehNo();
  let dedicated = false;
  if (dest.km < 80 && own === "Contracted" && rnd() < 0.45) {
    const dv = pick(DEDICATED);
    vno = dv.vno;
    transporter = dv.tr;
    len = dv.len;
    dedicated = true;
  }
  const isCfa = CFA_CITIES.includes(dest.name) && rnd() < 0.55;
  const customer = isCfa ? `DFM CFA - ${dest.name}` : pick(dest.custs);
  const otype = rnd() < 0.012 ? "Mixed Order" : rnd() < 0.64 ? "Indent Order" : "Direct Order";
  const consent = rnd() < (own === "Contracted" ? 0.68 : 0.42) ? "ALLOWED" : "PENDING";
  const slow = rnd() < 0.1 ? 2.5 : 1;
  const ms = { created };
  ms.reported = new Date(+created + (0.6 + rnd() * 3.5) * slow * H);
  ms.loadStart = new Date(+ms.reported + (0.8 + rnd() * 3) * slow * H);
  ms.invoiced = new Date(+ms.loadStart + (1.5 + rnd() * 2.5) * H);
  ms.gateOut = new Date(+ms.invoiced + (0.4 + rnd() * 1.2) * H);
  const transit = km / (own === "Market" ? 30 : 34) * (0.9 + rnd() * 0.45) + 1;
  ms.destReported = new Date(+ms.gateOut + transit * H);
  const detained = rnd() < 0.16;
  const destWait = detained ? 26 + rnd() * 50 : 1.5 + rnd() * 9;
  ms.destGateOut = new Date(+ms.destReported + destWait * H);
  ms.epod = new Date(+ms.destGateOut + (8 + rnd() * 70) * H);
  let stageIdx = 0;
  MS_KEYS.forEach((k, i) => {
    if (ms[k] <= NOW) stageIdx = i;
  });
  MS_KEYS.forEach((k, i) => {
    if (i > stageIdx) ms[k] = null;
  });
  const stage = TSTAGES[stageIdx].key;
  const lastUpdated = ms[MS_KEYS[stageIdx]];
  const base = Math.max(len === "32" ? 6500 : 4500, km * RATE[len] * (own === "Market" ? 1.06 : 1) * (0.93 + rnd() * 0.14));
  const freight = Math.round(base / 50) * 50;
  const definedRoute = own === "Contracted" || rnd() < 0.74;
  const l1 = definedRoute ? Math.round((own === "Contracted" ? freight * (0.97 + rnd() * 0.05) : freight / (1 + rnd() * 0.09)) / 50) * 50 : 0;
  const detDays = detained ? Math.floor(destWait / 24) : 0;
  const sysDet = detDays * (+len >= 27 ? 1500 : 1e3);
  const epodDone = stage === "epod_done";
  const actDet = epodDone && sysDet && rnd() < 0.72 ? Math.round(sysDet * (0.6 + rnd() * 0.4) / 100) * 100 : 0;
  const addl = epodDone && rnd() < 0.12 ? pick([500, 750, 1e3, 1500, 2e3]) : 0;
  const planQty = Math.round(+len * (40 + rnd() * 12));
  const invQty = stageIdx >= 3 ? planQty : 0;
  const shortQty = stageIdx >= 6 && rnd() < 0.07 ? randInt(1, 28) : 0;
  const excessQty = stageIdx >= 6 && !shortQty && rnd() < 0.025 ? randInt(1, 12) : 0;
  const shortPen = shortQty ? shortQty * randInt(180, 260) : 0;
  const dmgPen = epodDone && rnd() < 0.03 ? randInt(5, 30) * 100 : 0;
  let payStatus = stageIdx >= 6 ? "Awaiting ePOD" : "Not due", pi = false, paidAt = null, piAt = null, timely = null, cleanSource = null;
  if (epodDone) {
    cleanSource = rnd() < 0.71 ? "Auto" : "Manual";
    const sinceEpod = (+NOW - +ms.epod) / DAY;
    if (sinceEpod < 2) payStatus = "Invoice Pending";
    else {
      pi = true;
      piAt = new Date(+ms.epod + (1 + rnd() * 3) * DAY);
      if (piAt > NOW) piAt = new Date(+NOW - H);
      const payDays = rnd() < 0.3 ? 3 + rnd() * 5 : 10 + rnd() * 30;
      if (rnd() < 0.015) payStatus = "Charges Rejected";
      else if ((+NOW - +piAt) / DAY > payDays) {
        payStatus = "Paid";
        paidAt = new Date(+piAt + payDays * DAY);
        timely = payDays <= 30;
      } else payStatus = sinceEpod < 5 ? "Approval Pending" : "Payment Pending";
    }
  }
  const payDaysAct = paidAt && piAt ? (+paidAt - +piAt) / DAY : null;
  const cdEligible = !!paidAt && payDaysAct <= 7;
  const cdAvailed = cdEligible && rnd() < 0.86;
  const t = (a, b) => ms[a] && ms[b] ? (+ms[b] - +ms[a]) / H : null;
  const vtype = `${len} ft ${rnd() < 0.55 ? "SXL Container" : "SXL Closed Body"}`;
  const acceptedBy = own === "Contracted" ? rnd() < 0.62 ? "Transporter Accepted" : "DFM Accepted" : "Transporter Accepted";
  trips.push({
    id: "DS-" + tripSeq++,
    created,
    mk: monthKey(created),
    dk: dayKey(created),
    origin,
    loc: originShort(origin),
    dest: dest.name,
    km,
    own,
    len,
    vtype,
    transporter,
    vno,
    dedicated,
    customer,
    otype,
    consent,
    stage,
    stageIdx,
    status: tStage(stage).status,
    ms,
    lastUpdated,
    freight,
    l1,
    definedRoute,
    sysDet,
    actDet,
    addl,
    shortPen,
    dmgPen,
    invQty,
    planQty,
    shortQty,
    excessQty,
    total: freight + actDet + addl - shortPen - dmgPen,
    acceptedBy,
    epodDone,
    payStatus,
    pi,
    piAt,
    paidAt,
    timely,
    cleanSource,
    cdEligible,
    cdAvailed,
    cdAmt: cdAvailed ? Math.round(freight * 0.02) : 0,
    tPlant: t("reported", "gateOut"),
    tTransit: t("gateOut", "destReported"),
    tDest: t("destReported", "destGateOut"),
    tEpod: t("destGateOut", "epod")
  });
}
for (let d = Math.round((+NOW - +MONTHS[0].date) / DAY); d >= 0; d--) {
  const day = new Date(+today0 - d * DAY);
  const dow = day.getDay();
  let n = dow === 0 ? randInt(3, 6) : randInt(13, 20);
  const m = day.getMonth();
  if (m === 9) n = Math.round(n * 1.18);
  if (m === 6 || m === 7) n = Math.round(n * 0.92);
  for (let i = 0; i < n; i++) {
    const c = new Date(+day + (6 + rnd() * 15) * H);
    if (c <= NOW) makeTrip(c);
  }
}
var DESTINATIONS = [...new Set(trips.map((t) => t.dest))].sort();
var OSTAGES = [
  { key: "no_indent", label: "Indent Pending", color: C.bad },
  { key: "not_accepted", label: "Acceptance Pending", color: C.orange },
  { key: "vehicle_pending", label: "Reporting Pending", color: C.c3 },
  { key: "vehicle_reported", label: "Vehicle Reported", color: C.c1 },
  { key: "under_process", label: "Under Process", color: C.c4 },
  { key: "dispatched", label: "Dispatched", color: C.c2 }
];
var oStage = (k) => OSTAGES.find((s) => s.key === k);
var orders = [];
var indents = [];
var soSeq = 4180;
var indSeq = 22410;
function makeOrder(approved) {
  const plant = rnd() < 0.86 ? "GN" : "GZB";
  const stock = rnd() < 0.38;
  const destName = stock ? pick(CFA_CITIES) : wpick(DESTS.filter((d) => d.km < 900).map((x) => [x.name, x.w]));
  const dest = DESTS.find((d) => d.name === destName);
  const customer = stock ? `DFM CFA - ${destName}` : pick(dest.custs);
  const qty = stock ? randInt(900, 1700) : rnd() < 0.2 ? randInt(40, 199) : randInt(250, 1250);
  const f = rnd() < 0.13 ? 2.2 + rnd() * 3 : 0.7 + rnd() * 0.6;
  const src = rnd() < 0.72 ? "Indent" : "Auction";
  const m = { approved };
  m.indent = new Date(+approved + (0.4 + rnd() * 2.4) * f * H);
  m.accept = new Date(+m.indent + (src === "Auction" ? 1.5 + rnd() * 3 : 0.3 + rnd() * 2.5) * f * H);
  m.report = new Date(+m.accept + (2 + rnd() * 6) * f * H);
  m.process = new Date(+m.report + (1 + rnd() * 3) * f * H);
  m.dispatch = new Date(+m.process + (2 + rnd() * 3) * H);
  const order = ["approved", "indent", "accept", "report", "process", "dispatch"];
  let si = 0;
  order.forEach((k, i) => {
    if (m[k] <= NOW) si = i;
  });
  order.forEach((k, i) => {
    if (i > si) m[k] = null;
  });
  const stage = OSTAGES[si].key;
  const statusTxt = ["Draft", src + " Created", src + " Accepted", "Vehicle Reported", "Loading Started", rnd() < 0.5 ? "Invoice Completed" : "Dispatched"][si];
  const target = new Date(+approved + (stock ? 72 : 48) * H);
  const dispQty = m.dispatch ? Math.round(qty * (rnd() < 0.86 ? 1 : 0.86 + rnd() * 0.13)) : 0;
  const onTime = m.dispatch ? m.dispatch <= target : null;
  let otif = null;
  let otifStatus = "na";
  if (m.dispatch) {
    otif = onTime ? dispQty / qty : 0;
    otifStatus = otif >= 0.999 ? "met" : "missed";
  } else if (NOW > target) {
    otif = 0;
    otifStatus = "missed";
  } else if (+target - +NOW < 8 * H) otifStatus = "risk";
  const tr = src === "Indent" ? pick(TR_CONTRACT) : pick(TR_MARKET);
  const o = {
    no: `SO/${plant}/26-27/${String(soSeq++).padStart(6, "0")}`,
    approved,
    mk: monthKey(approved),
    plant,
    location: plant === "GN" ? "Greater Noida" : "Ghaziabad",
    type: stock ? "Stock Transfer" : "Direct Order",
    dest: destName,
    customer,
    qty,
    dispQty,
    qtyShown: dispQty || qty,
    m,
    stage,
    statusTxt,
    target,
    onTime,
    otif,
    otifStatus,
    src,
    transporter: si >= 2 ? tr : "Not assigned yet",
    vno: si >= 3 ? vehNo() : "Awaiting vehicle",
    productType: rnd() < 0.7 ? "SP" : rnd() < 0.6 ? "LP" : "LP + SP"
  };
  orders.push(o);
  if (si >= 1) {
    const bids = src === "Auction" ? randInt(3, 8) : null;
    const rate = Math.round(Math.max(4500, dest.km * 44 * (0.95 + rnd() * 0.12)) / 50) * 50;
    indents.push({
      no: (src === "Indent" ? "IND-" : "AUC-") + indSeq++,
      order: o.no,
      orderRef: o,
      src,
      created: m.indent,
      accepted: m.accept,
      reported: m.report,
      status: si === 1 ? src + " Created" : si === 2 ? src + " Accepted" : "Vehicle Assigned",
      transporter: si >= 2 ? tr : src === "Auction" ? `${bids} bids received` : `Sent to ${tr}`,
      bids,
      l1: src === "Auction" ? rate : null,
      rate,
      dest: destName,
      qty
    });
  }
}
for (let d = Math.round((+NOW - +MONTHS[0].date) / DAY); d >= 0; d--) {
  const day = new Date(+today0 - d * DAY);
  const n = day.getDay() === 0 ? randInt(1, 3) : randInt(10, 16);
  for (let i = 0; i < n; i++) {
    const a = new Date(+day + (9 + rnd() * 10) * H);
    if (a <= NOW) makeOrder(a);
  }
}
orders.sort((a, b) => +b.approved - +a.approved);
indents.sort((a, b) => +b.created - +a.created);
var ORDER_DESTS = [...new Set(orders.map((o) => o.dest))].sort();
var ECOM_FC = { Amazon: ["DEL4 \u2013 Jamalpur", "DED3 \u2013 Farukhnagar", "LKO1 \u2013 Lucknow"], Flipkart: ["Bilaspur (GGN)", "Dankuni (KOL)"], Blinkit: ["Gurugram Mother WH", "Noida Sec-63 WH"], Zepto: ["Delhi Mother Hub", "Ghaziabad Hub"], "Swiggy Instamart": ["Gurugram Pod Cluster", "Noida Cluster"], BigBasket: ["Ghaziabad DC", "Lucknow DC"] };
var ecomOrders = [];
for (let d = 34; d >= -6; d--) {
  const day = new Date(+today0 - d * DAY);
  for (let i = 0; i < randInt(3, 7); i++) {
    const plat = wpick([["Amazon", 3], ["Flipkart", 2], ["Blinkit", 3], ["Zepto", 2.5], ["Swiggy Instamart", 2], ["BigBasket", 1.5]]);
    const appt = new Date(+day + (8 + randInt(0, 9)) * H);
    const po = new Date(+appt - randInt(2, 6) * DAY);
    if (po > NOW) continue;
    let status2;
    if (appt > NOW) status2 = rnd() < 0.75 ? "Appointment Booked" : "Appointment Pending";
    else status2 = rnd() < 0.08 ? "Appointment Missed" : (+NOW - +appt) / DAY > 2 ? rnd() < 0.9 ? "Delivered" : "GRN Pending" : "Dispatched";
    const q = randInt(60, 900);
    ecomOrders.push({ po: `${plat.slice(0, 2).toUpperCase()}-PO-${randInt(1e5, 999999)}`, plat, fc: pick(ECOM_FC[plat]), poDate: po, appt, status: status2, qty: q, fill: status2 === "Delivered" || status2 === "GRN Pending" ? Math.round(q * (0.9 + rnd() * 0.1)) : null, value: q * randInt(380, 520) });
  }
}
ecomOrders.sort((a, b) => +b.appt - +a.appt);
var ZONES = [
  ["North 1 \u2013 Delhi NCR", [["Delhi East", ["Rohit Malhotra", "Vikas Sehgal"]], ["Delhi West", ["Amit Khurana", "Neeraj Bhatia"]], ["Gurugram & Faridabad", ["Sandeep Yadav", "Manish Dahiya"]], ["Noida & Ghaziabad", ["Ankur Tyagi", "Pankaj Chauhan"]]]],
  ["North 2 \u2013 Punjab, Haryana & HP", [["Punjab", ["Gurpreet Singh", "Harjeet Sandhu", "Rajan Bedi"]], ["Haryana", ["Deepak Malik", "Sunil Kadian"]], ["HP & J&K", ["Ashish Thakur"]]]],
  ["UP & Uttarakhand", [["West UP", ["Rahul Tomar", "Vivek Rana"]], ["Central UP", ["Saurabh Awasthi", "Anuj Shukla", "Prateek Mishra"]], ["East UP", ["Alok Pandey", "Ravi Tripathi"]], ["Uttarakhand", ["Mohit Negi"]]]],
  ["East", [["Bihar", ["Abhishek Sinha", "Kundan Kumar"]], ["Jharkhand", ["Nitin Mahato"]], ["West Bengal", ["Subhojit Das", "Arindam Ghosh"]]]],
  ["West & Central", [["Rajasthan", ["Lokesh Sharma", "Hemant Rathore"]], ["Madhya Pradesh", ["Gaurav Jain", "Prakash Raghuvanshi"]], ["Gujarat", ["Chirag Patel"]]]]
];
var ASMS = [];
var asmIdx = 0;
ZONES.forEach(([z, regs], zi) => regs.forEach(([r, people]) => people.forEach((p) => {
  ASMS.push({ idx: asmIdx, zone: z, region: r, name: p, base: (zi === 0 ? 6.2 : zi === 2 ? 5.4 : zi === 1 ? 4.6 : 3.6) * 1e5 * (0.75 + hash(asmIdx, 7) * 0.5), growth: 0.86 + hash(asmIdx, 3) * 0.2 });
  asmIdx++;
})));
var SEASON = [1, 0.98, 0.96, 1.02, 1.04, 1, 0.92, 0.9, 1.05, 1.2, 1.12, 1];
function asmDay(a, d) {
  const dn = Math.floor(d.getTime() / DAY);
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const wk = d.getDay() === 0 ? 0.3 : 1;
  const push = d.getDate() > dim - 5 ? 1.32 : d.getDate() <= 3 ? 0.78 : 1;
  const yr = d < new Date(+NOW - 300 * DAY) ? a.growth : 1;
  return a.base * SEASON[d.getMonth()] * wk * push * yr * (0.72 + hash(a.idx, dn) * 0.56);
}
function asmTarget(a, y, m) {
  const dim = new Date(y, m + 1, 0).getDate();
  return a.base * SEASON[m] * dim * 0.93 * (1.02 + hash(a.idx, y * 12 + m) * 0.1);
}
var BRANDS = [["CRAX Corn Rings", 0.31], ["Natkhat Namkeen", 0.21], ["CRAX Curls", 0.16], ["CRAX Fritts", 0.13], ["CRAX Chips", 0.11], ["CRAX Pipes & Others", 0.08]];
var CHANNELS = [["General Trade", 0.73, [["Urban GT", 0.52], ["Rural GT", 0.3], ["Super Stockist", 0.18]]], ["Modern Trade", 0.09, [["National Chains", 0.55], ["Regional Chains", 0.45]]], ["E-Commerce & Q-Comm", 0.11, [["Blinkit", 0.29], ["Zepto", 0.21], ["Amazon", 0.2], ["Swiggy Instamart", 0.16], ["Flipkart", 0.08], ["BigBasket", 0.06]]], ["CSD & Institutional", 0.07, [["CSD Canteens", 0.6], ["Institutional / HoReCa", 0.4]]]];
var CFAS = ["CFA Lucknow", "CFA Kanpur", "CFA Jaipur", "CFA Dehradun", "CFA Ludhiana", "CFA Patna", "CFA Ranchi", "CFA Kolkata", "CFA Indore", "CFA Varanasi"];
var CFA_BASE = [2100, 1500, 1700, 1100, 1450, 1300, 750, 980, 820, 900];
function cfaQty(ci, d) {
  if (d.getDay() === 0) return Math.round(CFA_BASE[ci] * SEASON[d.getMonth()] * (0.14 + hash(ci + 70, Math.floor(d.getTime() / DAY)) * 0.12));
  const dn = Math.floor(d.getTime() / DAY);
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.round(CFA_BASE[ci] * SEASON[d.getMonth()] * (d.getDate() > dim - 4 ? 1.3 : 1) * (0.6 + hash(ci + 50, dn) * 0.8));
}
var ACCOUNTS = [["Blinkit", 155e5, 0.115], ["Zepto", 112e5, 0.125], ["Amazon", 105e5, 0.085], ["Swiggy Instamart", 86e5, 0.12], ["Flipkart", 44e5, 0.09], ["BigBasket", 35e5, 0.075]];
function pnl(acc, mk) {
  const [, base, schemeRate] = ACCOUNTS.find((a) => a[0] === acc);
  const ai = ACCOUNTS.findIndex((a) => a[0] === acc);
  const mi = MONTHS.findIndex((m) => m.key === mk);
  const mo = MONTHS[mi].date.getMonth();
  const growth = 1 + mi * 0.035;
  const gross = base * SEASON[mo] * growth * (0.92 + hash(ai, mi + 100) * 0.16);
  const primarySchemes = gross * schemeRate * (0.9 + hash(ai, mi + 1) * 0.2);
  const secondaryScheme = gross * 0.032 * (0.8 + hash(ai, mi + 2) * 0.4);
  const tradeExpiry = gross * 9e-3 * (0.6 + hash(ai, mi + 3) * 0.8);
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
var ACCESS = [["sales", "Sales"], ["trip", "Trip"], ["order", "Order"], ["secondary", "Secondary Supply"], ["fin", "Financial"], ["byod", "BYOD"]];
var INITIAL_USERS = [
  ["Priya Verma", "priya.verma", "Admin", [1, 1, 1, 1, 1, 1], 4],
  ["Rakesh Nair", "rakesh.nair", "Admin", [1, 1, 1, 1, 1, 1], 26],
  ["Sunil Arora", "sunil.arora", "Viewer", [0, 1, 1, 0, 0, 0], 12],
  ["Meenakshi Iyer", "meenakshi.iyer", "Viewer", [1, 0, 0, 0, 1, 1], 95],
  ["Harish Bhatt", "harish.bhatt", "Viewer", [0, 1, 1, 1, 0, 0], 3],
  ["Kavita Joshi", "kavita.joshi", "Viewer", [1, 0, 0, 0, 0, 0], 210],
  ["Amandeep Gill", "amandeep.gill", "Viewer", [1, 0, 0, 1, 0, 0], 48],
  ["Tarun Khanna", "tarun.khanna", "Viewer", [0, 1, 1, 0, 0, 0], 1500],
  ["Nidhi Saxena", "nidhi.saxena", "Viewer", [1, 1, 1, 1, 1, 0], 7],
  ["Ajay Rawat", "ajay.rawat", "Viewer", [0, 0, 1, 0, 0, 0], 360]
].map(([name, u, role, acc, mins]) => ({ name, email: u + "@company.in", role, access: Object.fromEntries(ACCESS.map(([k], i) => [k, !!acc[i]])), lastActive: new Date(+NOW - mins * 6e4) }));
var SYNC_JOBS = [["fact_TripDetentionReport", "Trip Analytics", 15, 6150, 41], ["fact_Traqo_SalesOrder", "Order Analytics", 15, 18420, 63], ["fact_Indent_Auction_Details", "Order Analytics", 15, 25210, 58], ["dim_Item_ERP", "Order Analytics", 60, 1840, 6], ["fact_OrderFulfillment_ERP", "Order Analytics", 15, 31090, 77], ["fact_SecondarySales_DMS", "Sales Analytics", 30, 412300, 184], ["fact_CFA_Dispatch", "Secondary Supply", 60, 9310, 22], ["fact_Ecom_PnL", "Financial Analytics", 1440, 2210, 15]];
var syncRuns = [];
SYNC_JOBS.forEach(([table, area, every, rows, secs], ji) => {
  for (let i = 0; i < 6; i++) {
    const start = new Date(+NOW - (NOW.getMinutes() % every + i * every) * 6e4 - 6e4 * ji);
    const failed = ji === 5 && i === 2;
    const inProc = i === 0 && ji === 2;
    syncRuns.push({ id: `${table}-${i}`, table, area, start, secs: Math.round(secs * (0.8 + rnd() * 0.5)), rows: failed ? 0 : inProc ? Math.round(rows * 0.42) : rows + randInt(-40, 120), status: inProc ? "in_process" : failed ? "failed" : "completed", err: failed ? "Timeout: remote SQL Server did not respond within 300s" : "" });
  }
});
syncRuns.sort((a, b) => +b.start - +a.start);
var SYNC_TABLES = SYNC_JOBS.length;
var DIST_SLABS = [["0\u201350 km", 0, 50, C.c1], ["51\u2013100 km", 51, 100, C.c2], ["101\u2013300 km", 101, 300, C.c3], [">300 km", 301, 1e9, C.c5]];
var LAST_REFRESH = new Date(+NOW - NOW.getMinutes() % 15 * 6e4);

// src/data/sales.ts
var mixFactor = (i, j, range) => 0.9 + hash(i * 7 + j, range[0].getMonth() + range[0].getFullYear()) * 0.2;

// src/ai/catalog.ts
var sum2 = (rs, k) => rs.reduce((a, r) => a + (Number(r[k]) || 0), 0);
var cnt = (rs, pred) => rs.filter(pred).length;
var ratio = (a, b) => b ? a / b : null;
var avgOf = (rs, k) => {
  const v = rs.map((r) => r[k]).filter((x) => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
var WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
var wd = (d) => WEEKDAYS[(d.getDay() + 6) % 7];
var MONTH_ORDER = MONTHS.map((m) => m.label);
var ml = (key) => MONTHS.some((m) => m.key === key) ? monthLabel(key) : null;
var slab = (km) => km <= 50 ? "0\u201350 km" : km <= 100 ? "51\u2013100 km" : km <= 300 ? "101\u2013300 km" : ">300 km";
var recentDays = (d) => (+today0 - +new Date(d.getFullYear(), d.getMonth(), d.getDate())) / DAY;
var tripRows = null;
var TRIPS = {
  key: "trips",
  label: "Trips (Traqo TMS)",
  description: "One row per truck trip from DFM plants to customers/CFAs over the last 6 months: freight, distance, stage, transporter, detention, tracking, payment.",
  dims: [
    { key: "month", label: "Month", time: "month", order: MONTH_ORDER },
    { key: "day", label: "Day (last 30 days)", time: "day" },
    { key: "weekday", label: "Weekday", time: "weekday", order: WEEKDAYS },
    { key: "plant", label: "Plant" },
    { key: "destination", label: "Destination" },
    { key: "transporter", label: "Transporter" },
    { key: "fleet", label: "Fleet (contracted / market)" },
    { key: "stage", label: "Trip stage" },
    { key: "order_type", label: "Order type" },
    { key: "vehicle_length", label: "Vehicle length" },
    { key: "distance_slab", label: "Distance slab", order: ["0\u201350 km", "51\u2013100 km", "101\u2013300 km", ">300 km"] },
    { key: "tracking", label: "GPS tracking" },
    { key: "payment_status", label: "Payment status" },
    { key: "customer", label: "Customer" }
  ],
  measures: [
    { key: "trips", label: "Trips", agg: (r) => r.length, format: "number" },
    { key: "freight", label: "Freight \u20B9", agg: (r) => sum2(r, "freight"), format: "inr", higherIsBetter: false },
    { key: "km", label: "Distance km", agg: (r) => sum2(r, "km"), format: "km" },
    { key: "cost_per_km", label: "Cost per km \u20B9", agg: (r) => ratio(sum2(r, "freight"), sum2(r, "km")), format: "inr_per_km", higherIsBetter: false },
    { key: "cases", label: "Cases shipped", agg: (r) => sum2(r, "cases"), format: "number" },
    { key: "detention_cost", label: "Detention \u20B9", agg: (r) => sum2(r, "detention"), format: "inr", higherIsBetter: false },
    { key: "detention_rate", label: "Detention rate %", agg: (r) => {
      const e = r.filter((x) => x.epod_done === 1);
      return e.length ? cnt(e, (x) => Number(x.sys_detention) > 0) / e.length * 100 : null;
    }, format: "pct", higherIsBetter: false },
    { key: "tracking_rate", label: "Tracking adherence %", agg: (r) => r.length ? cnt(r, (x) => x.tracking === "Tracked") / r.length * 100 : null, format: "pct", higherIsBetter: true },
    { key: "avg_transit_h", label: "Avg transit hours", agg: (r) => avgOf(r, "transit_h"), format: "hours", higherIsBetter: false },
    { key: "avg_plant_tat_h", label: "Avg plant TAT hours", agg: (r) => avgOf(r, "plant_h"), format: "hours", higherIsBetter: false },
    { key: "shortage_rate", label: "Shortage rate %", agg: (r) => {
      const d = r.filter((x) => x.delivered === 1);
      return d.length ? cnt(d, (x) => Number(x.short_qty) > 0) / d.length * 100 : null;
    }, format: "pct", higherIsBetter: false },
    { key: "active_trips", label: "Active trips (not ePOD-closed)", agg: (r) => cnt(r, (x) => x.stage !== "ePOD Done"), format: "number" }
  ],
  rows: () => tripRows ??= trips.map((t) => ({
    id: t.id,
    month: ml(t.mk),
    day: recentDays(t.created) < 30 ? fdDay(t.created) : null,
    day_ts: +new Date(t.created.getFullYear(), t.created.getMonth(), t.created.getDate()),
    weekday: wd(t.created),
    plant: t.loc,
    destination: t.dest,
    transporter: t.transporter,
    fleet: t.own,
    stage: tStage(t.stage).label,
    order_type: t.otype,
    vehicle_length: t.len + " ft",
    distance_slab: slab(t.km),
    tracking: t.consent === "ALLOWED" ? "Tracked" : "Not tracked",
    payment_status: t.payStatus || "Not due",
    customer: t.customer,
    freight: t.total,
    km: t.km,
    cases: t.invQty,
    detention: t.actDet,
    sys_detention: t.sysDet,
    epod_done: t.epodDone ? 1 : 0,
    delivered: t.stageIdx >= 6 ? 1 : 0,
    short_qty: t.shortQty,
    transit_h: t.tTransit,
    plant_h: t.tPlant
  }))
};
var orderRows = null;
var ORDERS = {
  key: "orders",
  label: "Orders (Traqo TMS / ERP)",
  description: "One row per sales order approved over the last 6 months: quantity, stage, OTIF outcome, planning lead times.",
  dims: [
    { key: "month", label: "Month", time: "month", order: MONTH_ORDER },
    { key: "day", label: "Day (last 30 days)", time: "day" },
    { key: "weekday", label: "Weekday", time: "weekday", order: WEEKDAYS },
    { key: "plant", label: "Plant" },
    { key: "order_type", label: "Order type" },
    { key: "destination", label: "Destination" },
    { key: "stage", label: "Order stage" },
    { key: "product_type", label: "Product type" },
    { key: "otif_status", label: "OTIF status" },
    { key: "source", label: "Indent or auction" },
    { key: "customer", label: "Customer" }
  ],
  measures: [
    { key: "orders", label: "Orders", agg: (r) => r.length, format: "number" },
    { key: "qty", label: "Order qty (cases)", agg: (r) => sum2(r, "qty"), format: "number" },
    { key: "dispatched_qty", label: "Dispatched qty (cases)", agg: (r) => sum2(r, "disp_qty"), format: "number" },
    { key: "otif_pct", label: "OTIF %", agg: (r) => {
      const e = r.filter((x) => x.otif != null);
      return e.length ? sum2(e, "otif_qty") / sum2(e, "qty") * 100 : null;
    }, format: "pct", higherIsBetter: true },
    { key: "open_orders", label: "Open orders", agg: (r) => cnt(r, (x) => x.stage !== "Dispatched"), format: "number" },
    { key: "avg_approval_to_dispatch_h", label: "Avg approval \u2192 dispatch hours", agg: (r) => avgOf(r, "cycle_h"), format: "hours", higherIsBetter: false },
    { key: "avg_approval_to_indent_h", label: "Avg approval \u2192 indent hours", agg: (r) => avgOf(r, "indent_h"), format: "hours", higherIsBetter: false }
  ],
  rows: () => orderRows ??= orders.map((o) => ({
    id: o.no,
    month: ml(o.mk),
    day: recentDays(o.approved) < 30 ? fdDay(o.approved) : null,
    day_ts: +new Date(o.approved.getFullYear(), o.approved.getMonth(), o.approved.getDate()),
    weekday: wd(o.approved),
    plant: o.location,
    order_type: o.type,
    destination: o.dest,
    stage: oStage(o.stage).label,
    product_type: o.productType,
    otif_status: { met: "Met", missed: "Missed", risk: "At risk", na: "Not due" }[o.otifStatus],
    source: o.src,
    customer: o.customer,
    qty: o.qty,
    disp_qty: o.dispQty,
    otif: o.otif,
    otif_qty: o.otif == null ? 0 : o.otif * o.qty,
    cycle_h: o.m.dispatch ? (+o.m.dispatch - +o.approved) / H : null,
    indent_h: o.m.indent ? (+o.m.indent - +o.approved) / H : null
  }))
};
var salesRows = null;
var SALES = {
  key: "sales",
  label: "Secondary sales (DMS)",
  description: "Secondary sales vs target by month for every ASM, with zone and region. Brand and channel splits are allocated from mix shares.",
  dims: [
    { key: "month", label: "Month", time: "month", order: MONTH_ORDER },
    { key: "zone", label: "Zone" },
    { key: "region", label: "Region" },
    { key: "asm", label: "Area sales manager" },
    { key: "brand", label: "Brand" },
    { key: "channel", label: "Channel" }
  ],
  measures: [
    { key: "sales", label: "Sales \u20B9", agg: (r) => sum2(r, "sales"), format: "inr", higherIsBetter: true },
    { key: "target", label: "Target \u20B9", agg: (r) => sum2(r, "target"), format: "inr" },
    { key: "achievement_pct", label: "Achievement %", agg: (r) => {
      const t = sum2(r, "target");
      return t ? sum2(r, "sales") / t * 100 : null;
    }, format: "pct", higherIsBetter: true },
    { key: "gap_to_target", label: "Gap to target \u20B9", agg: (r) => Math.max(0, sum2(r, "target") - sum2(r, "sales")), format: "inr", higherIsBetter: false }
  ],
  rows: () => {
    if (salesRows) return salesRows;
    const out = [];
    MONTHS.forEach((m) => {
      const end = new Date(Math.min(+new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0), +today0));
      const dim = new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0).getDate();
      ASMS.forEach((a) => {
        let s = 0;
        for (let d = new Date(m.date); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) s += asmDay(a, d);
        const t = asmTarget(a, m.date.getFullYear(), m.date.getMonth()) * end.getDate() / dim;
        BRANDS.forEach(([b, bs], bi) => CHANNELS.forEach(([c, cs], ci) => {
          const f = bs * cs * mixFactor(bi, 0, [m.date, end]) * mixFactor(ci, 9, [m.date, end]);
          out.push({ month: m.label, zone: a.zone, region: a.region, asm: a.name, brand: b, channel: c, sales: s * f, target: t * bs * cs });
        }));
      });
    });
    return salesRows = out;
  }
};
var cfaRows = null;
var CFA = {
  key: "cfa",
  label: "CFA throughput",
  description: "Cases dispatched per day from each of 10 CFAs (carrying & forwarding agents) to distributors, last 90 days.",
  dims: [{ key: "cfa", label: "CFA" }, { key: "day", label: "Day (last 30 days)", time: "day" }, { key: "month", label: "Month", time: "month", order: MONTH_ORDER }, { key: "weekday", label: "Weekday", time: "weekday", order: WEEKDAYS }],
  measures: [
    { key: "cases", label: "Cases dispatched", agg: (r) => sum2(r, "cases"), format: "number" },
    { key: "avg_cases_per_day", label: "Avg cases per working day", agg: (r) => {
      const w = r.filter((x) => Number(x.cases) > 0);
      const days = new Set(w.map((x) => x.day_ts)).size;
      return days ? sum2(w, "cases") / days : null;
    }, format: "number" }
  ],
  rows: () => {
    if (cfaRows) return cfaRows;
    const out = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(+today0 - i * DAY);
      CFAS.forEach((c, ci) => out.push({ cfa: c.replace("CFA ", ""), day: i < 30 ? fdDay(d) : null, day_ts: +d, month: ml(monthKey(d)), weekday: wd(d), cases: cfaQty(ci, d) }));
    }
    return cfaRows = out;
  }
};
var pnlRows = null;
var PNL = {
  key: "pnl",
  label: "E-com P&L",
  description: "Monthly e-commerce P&L per marketplace/quick-commerce account: gross revenue, claims, net sales, cost of sales, material margin.",
  dims: [{ key: "month", label: "Month", time: "month", order: MONTH_ORDER }, { key: "account", label: "Account" }],
  measures: [
    { key: "gross_revenue", label: "Gross revenue \u20B9", agg: (r) => sum2(r, "grossRevenue"), format: "inr" },
    { key: "claims", label: "Claims & schemes \u20B9", agg: (r) => sum2(r, "productClaims"), format: "inr", higherIsBetter: false },
    { key: "net_sales", label: "Net sales \u20B9", agg: (r) => sum2(r, "netSales"), format: "inr", higherIsBetter: true },
    { key: "cost_of_sales", label: "Cost of sales \u20B9", agg: (r) => sum2(r, "costOfSales"), format: "inr", higherIsBetter: false },
    { key: "material_margin", label: "Material margin \u20B9", agg: (r) => sum2(r, "materialMargin"), format: "inr", higherIsBetter: true },
    { key: "margin_pct", label: "Material margin %", agg: (r) => {
      const n = sum2(r, "netSales");
      return n ? sum2(r, "materialMargin") / n * 100 : null;
    }, format: "pct", higherIsBetter: true },
    { key: "claims_pct", label: "Claims % of gross", agg: (r) => {
      const g = sum2(r, "grossRevenue");
      return g ? sum2(r, "productClaims") / g * 100 : null;
    }, format: "pct", higherIsBetter: false }
  ],
  rows: () => pnlRows ??= MONTHS.flatMap((m) => ACCOUNTS.map(([a]) => ({ month: m.label, account: a, ...pnl(a, m.key) })))
};
var DATASETS = [TRIPS, ORDERS, SALES, CFA, PNL];
var dataset = (k) => DATASETS.find((d) => d.key === k);
function dimValues(ds, dim, cap = 40) {
  const seen = /* @__PURE__ */ new Set();
  for (const r of ds.rows()) {
    const v = r[dim];
    if (v != null) seen.add(String(v));
    if (seen.size >= cap) break;
  }
  const d = ds.dims.find((x) => x.key === dim);
  return d?.order ? d.order.filter((x) => seen.has(x)) : [...seen].sort();
}
function catalogText() {
  return DATASETS.map((ds) => [
    `## dataset "${ds.key}" \u2014 ${ds.label}`,
    ds.description,
    `dimensions: ${ds.dims.map((d) => {
      const vals = d.time ? "" : ` (values: ${dimValues(ds, d.key, 12).join(" | ")}${dimValues(ds, d.key, 13).length > 12 ? " | \u2026" : ""})`;
      return `${d.key} = ${d.label}${vals}`;
    }).join("; ")}`,
    `measures: ${ds.measures.map((m) => `${m.key} = ${m.label}`).join("; ")}`
  ].join("\n")).join("\n\n") + `

Today is ${NOW.toDateString()}. Month labels look like "${MONTHS[5].label}" (current month, month-to-date). Currency is INR.`;
}

// src/ai/engine.ts
var QUERY_SPEC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["dataset", "measures", "dimension", "series", "filters", "sort", "limit", "chart", "title"],
  properties: {
    dataset: { type: "string", enum: DATASETS.map((d) => d.key), description: "Which dataset to query." },
    measures: { type: "array", items: { type: "string" }, description: "1\u20133 measure keys from the chosen dataset. For combo charts give exactly 2 (bars, then line)." },
    dimension: { type: ["string", "null"], description: "Dimension key to group by (x-axis / categories), or null for a single total." },
    series: { type: ["string", "null"], description: "Optional second dimension to split each group by (stacked bars, multi-line, heatmap columns). Null for none." },
    filters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "op", "values"],
        properties: { field: { type: "string" }, op: { type: "string", enum: ["in", "not_in"] }, values: { type: "array", items: { type: "string" } } }
      },
      description: "Row filters on dimension values. Use exact values from the catalog."
    },
    sort: { type: "string", enum: ["desc", "asc", "natural"], description: "Sort groups by the first measure, or keep natural/time order." },
    limit: { type: ["integer", "null"], description: "Keep only the top N groups after sorting, or null for all." },
    chart: { type: "string", enum: ["bar", "horizontal_bar", "stacked_bar", "line", "area", "combo", "donut", "bar_list", "heatmap", "kpi", "table"], description: "Best chart for the question: line/area for trends over time, horizontal_bar or bar_list for rankings, stacked_bar for composition, donut only for \u22646 parts of a whole, heatmap for two dimensions, combo for a volume measure plus a rate, kpi for single numbers, table for detail." },
    title: { type: "string", description: "Short chart title in sentence case." }
  }
};
var keyOf = (v) => v == null ? null : String(v);
function execute(spec) {
  const ds = dataset(spec.dataset) ?? DATASETS[0];
  const fail = (error) => ({ spec, ds, rows: [], seriesKeys: [], totals: {}, matched: 0, error });
  if (!dataset(spec.dataset)) return fail(`Unknown dataset "${spec.dataset}". Use one of: ${DATASETS.map((d) => d.key).join(", ")}.`);
  const measures = spec.measures.map((k) => ds.measures.find((m) => m.key === k));
  const bad = spec.measures.filter((_, i) => !measures[i]);
  if (!spec.measures.length || bad.length) return fail(`Unknown measure(s) ${bad.join(", ") || "(none given)"} for "${ds.key}". Valid: ${ds.measures.map((m) => m.key).join(", ")}.`);
  for (const d of [spec.dimension, spec.series, ...spec.filters.map((f) => f.field)]) {
    if (d && !ds.dims.find((x) => x.key === d)) return fail(`Unknown dimension "${d}" for "${ds.key}". Valid: ${ds.dims.map((x) => x.key).join(", ")}.`);
  }
  const ms = measures;
  const rows = ds.rows().filter((r) => spec.filters.every((f) => {
    const v = keyOf(r[f.field]);
    const hit = v != null && f.values.some((x) => x.toLowerCase() === v.toLowerCase());
    return f.op === "in" ? hit : !hit;
  }));
  const totals = Object.fromEntries(ms.map((m) => [m.key, m.agg(rows)]));
  if (!spec.dimension) return { spec, ds, rows: [{ label: "Total", values: totals }], seriesKeys: [], totals, matched: rows.length };
  const dimDef = ds.dims.find((d) => d.key === spec.dimension);
  const groups = /* @__PURE__ */ new Map();
  const seriesSet = /* @__PURE__ */ new Set();
  for (const r of rows) {
    const g = keyOf(r[spec.dimension]);
    if (g == null) continue;
    const s = spec.series ? keyOf(r[spec.series]) : "__all";
    if (s == null) continue;
    seriesSet.add(s);
    if (!groups.has(g)) groups.set(g, /* @__PURE__ */ new Map());
    const m = groups.get(g);
    if (!m.has(s)) m.set(s, []);
    m.get(s).push(r);
  }
  let labels = [...groups.keys()];
  if (dimDef.order) labels.sort((a, b) => dimDef.order.indexOf(a) - dimDef.order.indexOf(b));
  else if (dimDef.time === "day") {
    const ts = (l) => Math.min(...[...groups.get(l).values()].flat().map((r) => Number(r.day_ts)));
    labels.sort((a, b) => ts(a) - ts(b));
  } else labels.sort();
  const first = ms[0];
  const groupTotal = (l) => first.agg([...groups.get(l).values()].flat()) ?? 0;
  if (spec.sort !== "natural" && !(dimDef.time && spec.sort === "desc" && ["line", "area", "combo"].includes(spec.chart))) {
    labels.sort((a, b) => spec.sort === "desc" ? groupTotal(b) - groupTotal(a) : groupTotal(a) - groupTotal(b));
  }
  if (spec.limit && spec.limit > 0) labels = labels.slice(0, spec.limit);
  const seriesDef = spec.series ? ds.dims.find((d) => d.key === spec.series) : void 0;
  let seriesKeys = spec.series ? [...seriesSet] : [];
  if (seriesDef?.order) seriesKeys.sort((a, b) => seriesDef.order.indexOf(a) - seriesDef.order.indexOf(b));
  else seriesKeys.sort((a, b) => {
    const t = (s) => first.agg(labels.flatMap((l) => groups.get(l).get(s) ?? [])) ?? 0;
    return t(b) - t(a);
  });
  if (seriesKeys.length > 8) seriesKeys = seriesKeys.slice(0, 8);
  const out = [];
  for (const l of labels) {
    const m = groups.get(l);
    if (spec.series) for (const s of seriesKeys) out.push({ label: l, series: s, values: Object.fromEntries(ms.map((x) => [x.key, m.has(s) ? x.agg(m.get(s)) : null])) });
    else out.push({ label: l, values: Object.fromEntries(ms.map((x) => [x.key, x.agg([...m.values()].flat())])) });
  }
  return { spec, ds, rows: out, seriesKeys, totals, matched: rows.length };
}
function fmt(v, format, compact = false) {
  if (v == null || Number.isNaN(v)) return "\u2013";
  if (format === "pct") return v.toFixed(1) + "%";
  if (format === "hours") return v.toFixed(1) + " h";
  if (format === "inr_per_km") return "\u20B9" + v.toFixed(1);
  if (format === "km") return Math.round(v).toLocaleString("en-IN") + " km";
  if (format === "inr") {
    const a = Math.abs(v);
    if (a >= 1e7) return "\u20B9" + (v / 1e7).toFixed(compact ? 1 : 2) + (compact ? "Cr" : " Cr");
    if (a >= 1e5) return "\u20B9" + (v / 1e5).toFixed(compact ? 1 : 2) + (compact ? "L" : " L");
    if (compact && a >= 1e3) return "\u20B9" + (v / 1e3).toFixed(1) + "k";
    return "\u20B9" + Math.round(v).toLocaleString("en-IN");
  }
  if (compact && Math.abs(v) >= 1e5) return (v / 1e5).toFixed(1) + "L";
  if (compact && Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + "k";
  return Math.round(v).toLocaleString("en-IN");
}
function resultForModel(r) {
  if (r.error) return JSON.stringify({ error: r.error });
  const ms = r.spec.measures.map((k) => r.ds.measures.find((m) => m.key === k));
  return JSON.stringify({
    matched_rows: r.matched,
    totals: Object.fromEntries(ms.map((m) => [m.key, fmt(r.totals[m.key], m.format)])),
    groups: r.rows.slice(0, 60).map((x) => ({ [r.spec.dimension ?? "group"]: x.label, ...x.series ? { [r.spec.series]: x.series } : {}, ...Object.fromEntries(ms.map((m) => [m.key, fmt(x.values[m.key], m.format)])) })),
    truncated: r.rows.length > 60
  });
}
function insightsFor(r) {
  if (r.error || !r.rows.length) return [];
  const m = r.ds.measures.find((x) => x.key === r.spec.measures[0]);
  const f = (v) => fmt(v, m.format);
  const out = [];
  const additive = ["number", "inr", "km"].includes(m.format);
  const byLabel = /* @__PURE__ */ new Map();
  if (r.spec.series) {
    const raw = r.ds.rows();
    for (const l of new Set(r.rows.map((x) => x.label))) {
      const rs = raw.filter((row) => String(row[r.spec.dimension]) === l && r.spec.filters.every((fl) => {
        const v = row[fl.field];
        const hit = v != null && fl.values.some((x) => x.toLowerCase() === String(v).toLowerCase());
        return fl.op === "in" ? hit : !hit;
      }));
      byLabel.set(l, m.agg(rs) ?? 0);
    }
  } else r.rows.forEach((x) => byLabel.set(x.label, x.values[m.key] ?? 0));
  const entries = [...byLabel.entries()].filter(([, v]) => v != null);
  if (!r.spec.dimension) {
    out.push(`{{metric:${m.label}|${f(r.totals[m.key])}|neutral}} across ${r.matched.toLocaleString("en-IN")} records.`);
    return out;
  }
  const dimDef = r.ds.dims.find((d) => d.key === r.spec.dimension);
  if (dimDef.time && entries.length >= 3) {
    const ordered = dimDef.order ? entries.sort((a, b) => dimDef.order.indexOf(a[0]) - dimDef.order.indexOf(b[0])) : entries;
    const firstV = ordered[0][1], last = ordered[ordered.length - 1], prev = ordered[ordered.length - 2];
    const up = last[1] >= prev[1];
    const good = m.higherIsBetter === void 0 ? "neutral" : up === m.higherIsBetter ? "positive" : "negative";
    const delta = m.format === "pct" ? `${last[1] - prev[1] >= 0 ? "+" : ""}${(last[1] - prev[1]).toFixed(1)} pts` : prev[1] ? `${last[1] >= prev[1] ? "+" : ""}${((last[1] - prev[1]) / prev[1] * 100).toFixed(1)}%` : "\u2013";
    out.push(`${m.label} is {{metric:${last[0]}|${f(last[1])}|neutral}}, {{metric:|${delta}|${good}}} vs ${prev[0]}${dimDef.key === "month" ? " (current month is month-to-date)" : ""}.`);
    const peak = ordered.reduce((a, b) => b[1] > a[1] ? b : a);
    const low = ordered.reduce((a, b) => b[1] < a[1] ? b : a);
    out.push(`Peak {{metric:${peak[0]}|${f(peak[1])}|neutral}}, low {{metric:${low[0]}|${f(low[1])}|neutral}}${firstV ? ` \xB7 ${((last[1] - firstV) / Math.abs(firstV) * 100).toFixed(0)}% change since ${ordered[0][0]}` : ""}.`);
  } else {
    const sorted = [...entries].sort((a, b) => b[1] - a[1]);
    const top = sorted[0], bottom = sorted[sorted.length - 1];
    const totalV = additive ? sorted.reduce((a, b) => a + b[1], 0) : null;
    const topGood = m.higherIsBetter === void 0 ? "neutral" : m.higherIsBetter ? "positive" : "negative";
    const botGood = m.higherIsBetter === void 0 ? "neutral" : m.higherIsBetter ? "negative" : "positive";
    out.push(`{{metric:${top[0]}|${f(top[1])}|${topGood}}} is highest${totalV ? ` with ${(top[1] / totalV * 100).toFixed(0)}% of the total` : ""}; {{metric:${bottom[0]}|${f(bottom[1])}|${botGood}}} is lowest.`);
    if (additive && totalV && sorted.length >= 5) {
      const top3 = sorted.slice(0, 3).reduce((a, b) => a + b[1], 0);
      out.push(`Top 3 of ${sorted.length} make up {{metric:|${(top3 / totalV * 100).toFixed(0)}%|neutral}} \u2014 ${top3 / totalV > 0.6 ? "a concentrated mix" : "a fairly spread mix"}.`);
    } else if (!additive && sorted.length >= 3) {
      const mean = sorted.reduce((a, b) => a + b[1], 0) / sorted.length;
      out.push(`Spread is ${f(top[1] - bottom[1])} between best and worst; average ${f(mean)}.`);
    }
  }
  return out;
}
function normalize(spec) {
  const s = { ...spec, filters: spec.filters ?? [], measures: (spec.measures ?? []).slice(0, 3) };
  if (!s.dimension && s.chart !== "table") s.chart = "kpi";
  if (s.chart === "heatmap" && !s.series) s.chart = "bar";
  if (s.chart === "stacked_bar" && !s.series) s.chart = "bar";
  if (s.chart === "combo" && s.measures.length < 2) s.chart = "bar";
  if (s.chart === "donut" && s.series) s.chart = "stacked_bar";
  return s;
}

// src/ai/modes.ts
function modeInstructions(mode, focus) {
  const cite = 'Every run_query result is numbered as a source [n]. Cite the sources that back each figure or claim with [n] right after it, e.g. "OTIF fell to 91% [2]".';
  const focusLine = focus === "all" ? "" : `
Focus: answer using only the "${focus}" dataset. Do not query other datasets.`;
  const body = {
    quick: `Mode: QUICK. Use 1\u20132 queries. Answer in 2\u20134 short sentences. 1 chart. ${cite}`,
    research: `Mode: RESEARCH. Investigate properly: run 4\u20138 queries covering the headline number, the trend over months, the breakdown that explains it, and the outliers. Then answer with:
- a 1\u20132 sentence direct answer first (no heading),
- then 2\u20134 sections, each starting with a "## " heading (e.g. "## What changed", "## Why", "## What to do"), with 2\u20134 short "- " bullets each.
Up to 4 charts. ${cite}`,
    brief: `Mode: BRIEF. An executive summary: 3\u20135 "- " bullets, each leading with a key figure, no headings and no preamble. At most 1 chart (prefer kpi or a small ranking). ${cite}`,
    compare: `Mode: COMPARE. Put two periods or two groups side by side. Default to the current month vs the previous month when the user names no comparison. Lead with the overall change, then the 2\u20133 biggest movers with their change. Include a chart that shows both sides together \u2014 a bar chart with series set to the compared dimension (e.g. series "month" filtered to the two months). ${cite}`
  };
  return body[mode] + focusLine;
}
var MODE_EFFORT = { quick: "low", research: "high", brief: "medium", compare: "medium" };
var MODE_MAX_CHARTS = { quick: 2, research: 4, brief: 1, compare: 2 };

// server/ask.ts
var MODEL = process.env.DFM_AI_MODEL || "claude-opus-5-5";
var MAX_TURNS = 8;
var MODES_OK = /* @__PURE__ */ new Set(["quick", "research", "brief", "compare"]);
var FOCUS_OK = /* @__PURE__ */ new Set(["all", "trips", "orders", "sales", "cfa", "pnl"]);
var SYSTEM = `You are the analytics copilot inside the DFM Foods MIS (makers of CRAX snacks). Users are supply-chain, sales and finance managers asking about their own operational data.

How to work:
- Answer only from data you retrieve with run_query. Never invent numbers. If the data cannot answer the question, say so and suggest the closest question it can answer.
- Call run_query as many times as you need (in parallel when independent) to explore, compare, and check before answering. Prefer a few well-aimed queries over many.
- Finish every turn by calling present_answer exactly once. Do not write the final answer as plain text.

The answer (present_answer.answer):
- Plain business language, leading with the direct answer, then the most useful "why" or "so what", then a concrete next action when there is one. Length and structure follow the mode instructions below.
- Highlight key figures with inline tokens: {{metric:Label|value|tone}} where tone is positive, negative or neutral (e.g. {{metric:Shree Ganesh Roadlines|\u20B952.6/km|negative}}). Use the exact formatted values the query returned.
- No markdown tables \u2014 the charts carry the detail. Use "## " headings and "- " bullets only when the mode asks for them.

Charts (present_answer.charts): 0\u20133 QuerySpecs the app will execute and render. Pick the chart that answers the question best: line/area for trends over time, horizontal_bar or bar_list for rankings, stacked_bar for composition, donut only for \u22646 parts of a whole, heatmap for two dimensions, combo for a volume plus a rate (2 measures), kpi for single numbers, table for detail lists. Reuse specs you already ran so the user sees what you saw. Give each a clear title.

follow_ups: 3 short, specific next questions the user is likely to ask, phrased in their voice.

Data catalog (datasets, dimensions with sample values, measures):
${catalogText()}`;
var PRESENT_ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "charts", "follow_ups"],
  properties: {
    answer: { type: "string", description: "The narrative answer with {{metric:Label|value|tone}} tokens." },
    charts: { type: "array", items: QUERY_SPEC_SCHEMA, description: "0\u20133 chart specs to render." },
    follow_ups: { type: "array", items: { type: "string" }, description: "3 suggested follow-up questions." }
  }
};
var TOOLS = [
  {
    name: "run_query",
    description: "Run an aggregation over one dataset of the DFM MIS semantic layer. Returns totals and per-group values (formatted), plus computed takeaways. Use exact dimension values from the catalog in filters.",
    strict: true,
    input_schema: QUERY_SPEC_SCHEMA
  },
  {
    name: "present_answer",
    description: "Deliver the final answer to the user: narrative, charts to render, and follow-up questions. Call exactly once, at the end.",
    strict: true,
    input_schema: PRESENT_ANSWER_SCHEMA
  }
];
var NotConfiguredError = class extends Error {
};
async function handleAsk(history, mode = "quick", focus = "all") {
  let client;
  try {
    client = new Anthropic();
  } catch {
    throw new NotConfiguredError("No Anthropic credentials found on the server.");
  }
  const messages = history.slice(-12).map((t) => ({ role: t.role, content: t.content }));
  const steps = [];
  const sources = [];
  const maxCharts = MODE_MAX_CHARTS[mode];
  const turns = mode === "research" ? 12 : MAX_TURNS;
  for (let turn = 0; turn < turns; turn++) {
    let response;
    try {
      response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16e3,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: MODE_EFFORT[mode] },
        // The base prompt + tools are stable, so they are cached; the short mode block follows the breakpoint.
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }, { type: "text", text: modeInstructions(mode, focus) }],
        tools: TOOLS,
        tool_choice: { type: "auto" },
        messages
      });
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) throw new NotConfiguredError(err.message);
      if (!(err instanceof Anthropic.APIError) && err instanceof Error && /authentication method|api ?key|credentials/i.test(err.message)) throw new NotConfiguredError(err.message);
      throw err;
    }
    if (response.stop_reason === "refusal") {
      return { answer: "I can\u2019t help with that request. Try asking about trips, orders, sales, CFA throughput or the e-com P&L.", charts: [], followUps: [], steps, sources, model: response.model };
    }
    messages.push({ role: "assistant", content: response.content });
    const toolUses = response.content.filter((b) => b.type === "tool_use");
    const present = toolUses.find((t) => t.name === "present_answer");
    if (present) {
      const input = present.input;
      return {
        answer: String(input.answer ?? ""),
        charts: (input.charts ?? []).slice(0, maxCharts).map(normalize),
        followUps: (input.follow_ups ?? []).slice(0, 4),
        steps,
        sources,
        model: response.model
      };
    }
    if (!toolUses.length) {
      const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      return { answer: text || "I couldn\u2019t find an answer to that.", charts: [], followUps: [], steps, sources, model: response.model };
    }
    const results = toolUses.map((t) => {
      if (t.name !== "run_query") return { type: "tool_result", tool_use_id: t.id, is_error: true, content: `Unknown tool ${t.name}` };
      const spec = normalize(t.input);
      if (focus !== "all" && spec.dataset !== focus) return { type: "tool_result", tool_use_id: t.id, is_error: true, content: `Focus is set to "${focus}" \u2014 query that dataset only.` };
      const r = execute(spec);
      steps.push({ label: spec.title || `Query ${spec.dataset}`, detail: r.error ?? `${spec.dataset} \xB7 ${spec.measures.join(", ")}${spec.dimension ? ` by ${spec.dimension}` : ""}${spec.filters.length ? ` \xB7 ${spec.filters.length} filter(s)` : ""} \u2192 ${r.rows.length} rows`, ok: !r.error });
      if (r.error) return { type: "tool_result", tool_use_id: t.id, is_error: true, content: r.error };
      const n = sources.length + 1;
      sources.push({ id: n, dataset: spec.dataset, title: spec.title || `Query ${n}`, detail: `${spec.measures.join(", ")}${spec.dimension ? ` by ${spec.dimension}` : ""}${spec.filters.length ? ` \xB7 ${spec.filters.map((f) => f.values.join(", ")).join(" \xB7 ")}` : ""}`, rows: r.matched, spec });
      const takeaways = insightsFor(r).map((s) => s.replace(/\{\{metric:([^|}]*)\|?([^|}]*)\|?[^}]*\}\}/g, (_m, a, b) => [a, b].filter(Boolean).join(" ")));
      return { type: "tool_result", tool_use_id: t.id, content: `source [${n}]
` + resultForModel(r) + (takeaways.length ? `
Computed takeaways: ${takeaways.join(" ")}` : "") };
    });
    messages.push({ role: "user", content: results });
  }
  return { answer: "That took more analysis steps than I allow per question. Try narrowing it down (a dataset, a period or a measure).", charts: [], followUps: [], steps, sources, model: MODEL };
}
function readJson(req) {
  const pre = req.body;
  if (pre !== void 0) return Promise.resolve(typeof pre === "string" ? JSON.parse(pre || "{}") : pre);
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 2e5) reject(new Error("Body too large"));
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}
function send(res, status2, body) {
  res.statusCode = status2;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
var configured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE || existsSync(join(homedir(), ".config", "anthropic")));
function handleStatus(_req, res) {
  send(res, 200, { configured: configured(), model: MODEL });
}
async function handleHttp(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "method_not_allowed" });
  try {
    const body = await readJson(req);
    const mode = MODES_OK.has(String(body.mode)) ? body.mode : "quick";
    const focus = FOCUS_OK.has(String(body.focus)) ? body.focus : "all";
    const history = (body.messages ?? []).filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim());
    if (!history.length || history[history.length - 1].role !== "user") return send(res, 400, { error: "bad_request" });
    send(res, 200, await handleAsk(history, mode, focus));
  } catch (err) {
    if (err instanceof NotConfiguredError) return send(res, 503, { error: "not_configured", message: err.message });
    if (err instanceof Anthropic.RateLimitError) return send(res, 429, { error: "rate_limited", message: "Claude is busy \u2014 try again in a moment." });
    if (err instanceof Anthropic.APIError) return send(res, 502, { error: "upstream", message: `Claude API error ${err.status}` });
    console.error("[ask]", err);
    send(res, 500, { error: "internal", message: "Something went wrong answering that." });
  }
}

// server/vercel.ts
async function ask(req, res) {
  await handleHttp(req, res);
}
function status(req, res) {
  handleStatus(req, res);
}
export {
  ask as default,
  status
};
