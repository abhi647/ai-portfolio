import { ASMS, NOW, orders, syncRuns, trips } from "./data";
import { H, fmtN, pct } from "./format";
import { asmPeriod, asmPeriodTarget, periodRange } from "./sales";

export interface Alert {
  id: string; severity: "error" | "warning" | "info"; title: string; body: string; href: string; time: Date; kind: string; count?: number;
}

export function computeAlerts(): Alert[] {
  const inside = trips.filter((t) => ["vehicle_reported", "loading", "invoiced"].includes(t.stage) && (+NOW - +t.ms.reported!) / H > 8);
  const transit = trips.filter((t) => t.stage === "in_transit" && (+NOW - +t.ms.gateOut!) / H > 36);
  const atRisk = orders.filter((o) => o.otifStatus === "risk");
  const stuck = orders.filter((o) => o.stage !== "dispatched" && (+NOW - +o.approved) / H > 48 && (+NOW - +o.approved) / H < 30 * 24);
  const failed = syncRuns.filter((r) => r.status === "failed");
  const mtd = periodRange("month");
  const behind = ASMS.filter((a) => asmPeriod(a, mtd) / asmPeriodTarget(a, mtd) < 0.9);
  const out: Alert[] = [];
  if (inside.length) out.push({ id: "inside", severity: "error", kind: "alert", title: `${inside.length} vehicles inside plant over 8 h`, body: `Oldest has waited ${Math.round(Math.max(...inside.map((t) => (+NOW - +t.ms.reported!) / H)))} h. Check bay allocation at GN.`, href: "/trips/inside", time: new Date(+NOW - 12 * 60e3), count: inside.length });
  if (atRisk.length) out.push({ id: "risk", severity: "warning", kind: "alert", title: `${atRisk.length} orders at OTIF risk`, body: "Target within 8 h and not yet dispatched.", href: "/orders/otif", time: new Date(+NOW - 25 * 60e3), count: atRisk.length });
  if (stuck.length) out.push({ id: "stuck", severity: "warning", kind: "assignment", title: `${stuck.length} open orders aged over 48 h`, body: "Escalate indent acceptance or vehicle reporting.", href: "/orders/live", time: new Date(+NOW - 58 * 60e3), count: stuck.length });
  if (transit.length) out.push({ id: "transit", severity: "info", kind: "alert", title: `${transit.length} trips in transit over 36 h`, body: `${pct(transit.filter((t) => t.consent === "ALLOWED").length, transit.length, 0)} are GPS tracked.`, href: "/trips/inside", time: new Date(+NOW - 2 * 3600e3), count: transit.length });
  if (failed.length) out.push({ id: "sync", severity: "error", kind: "system", title: `Sync failed: ${failed[0].table}`, body: failed[0].err + ". Auto-retried next cycle.", href: "/settings/sync", time: failed[0].start, count: failed.length });
  if (behind.length) out.push({ id: "asm", severity: "info", kind: "review", title: `${behind.length} ASMs below 90% of MTD target`, body: `${fmtN(behind.length)} of ${ASMS.length} sales managers need a push before month-end.`, href: "/sales/team", time: new Date(+NOW - 5 * 3600e3), count: behind.length });
  return out;
}
