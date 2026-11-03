/* Executive KPI scorecard: governed KPIs with actual, comparator, variance, RAG status vs target, trend and owner. */
import * as React from "react";
import { Link } from "react-router-dom";
import { IconInfoCircle } from "@tabler/icons-react";
import { SectionCard } from "@/components/overtrue/section-card";
import { StatusBadge } from "@/components/overtrue/status-badge";
import { Sparkline } from "@/components/overtrue/trend-sparkline";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fmt } from "@/ai/engine";
import type { CompareKey, KpiResult, Period, Rag, Unit } from "@/data/kpis";
import { cn } from "@/lib/utils";

export const RAG_LABEL: Record<Rag, string> = { green: "On target", amber: "Watch", red: "Off target" };
export const RAG_VARIANT: Record<Rag, "success" | "warning" | "error"> = { green: "success", amber: "warning", red: "error" };

export function fmtUnit(v: number | null | undefined, u: Unit, compact = false) {
  if (v == null || Number.isNaN(v)) return "No history";
  if (u === "number") return Math.round(v).toLocaleString("en-IN");
  if (u === "pct" && Math.abs(v) < 5) return v.toFixed(2) + "%";
  return fmt(v, u, compact);
}
export function fmtVar(r: KpiResult) {
  if (r.variance == null) return "No history";
  const u = r.def.unit;
  const sign = r.variance > 0 ? "+" : r.variance < 0 ? "−" : "";
  const a = Math.abs(r.variance);
  if (u === "pct") return `${sign}${a.toFixed(r.comparator != null && Math.abs(r.comparator) < 5 ? 2 : 1)} pts`;
  if (u === "hours") return `${sign}${a.toFixed(1)} h`;
  if (u === "inr_per_km") return `${sign}₹${a.toFixed(2)}`;
  if (u === "number") return `${sign}${Math.round(a).toLocaleString("en-IN")}`;
  return `${sign}${fmt(a, u, true)}`;
}
/** Good or bad direction of a variance, given whether higher is better. */
export const varTone = (r: KpiResult) => (r.variance == null || r.variance === 0 ? "flat" : (r.variance > 0) === (r.def.better === "up") ? "good" : "bad");

export function ExecScorecard({ results, period, compare, className }: { results: KpiResult[]; period: Period; compare: CompareKey; className?: string }) {
  const groups = [...new Set(results.map((r) => r.def.fn))];
  const cmpLabel = compare === "target" ? "Target" : "Prior period";
  const counts = { green: results.filter((r) => r.rag === "green").length, amber: results.filter((r) => r.rag === "amber").length, red: results.filter((r) => r.rag === "red").length };
  return (
    <SectionCard className={className} contentClassName="p-0"
      title="Executive KPI scorecard"
      description={`${period.long} · variance against ${cmpLabel.toLowerCase()} · status always judged against target`}
      actions={<div className="flex items-center gap-1.5 text-xs"><StatusBadge variant="success">{counts.green} on target</StatusBadge><StatusBadge variant="warning">{counts.amber} watch</StatusBadge><StatusBadge variant="error">{counts.red} off target</StatusBadge></div>}>
      <Table className="text-[12.5px] [&_td]:py-1.5 [&_td]:whitespace-nowrap [&_th]:h-8 [&_th]:whitespace-nowrap">
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[26%] pl-4">KPI</TableHead>
            <TableHead className="text-right">Actual</TableHead>
            <TableHead className="text-right">{cmpLabel}</TableHead>
            <TableHead className="text-right">Variance</TableHead>
            <TableHead className="text-right">Var %</TableHead>
            <TableHead className="w-28">6-month trend</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="pr-4">Owner</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((g) => (
            <React.Fragment key={g}>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableCell colSpan={8} className="py-1 pl-4"><span className="eyebrow">{g}</span></TableCell>
              </TableRow>
              {results.filter((r) => r.def.fn === g).map((r) => {
                const tone = varTone(r);
                return (
                  <TableRow key={r.def.key}>
                    <TableCell className="pl-4">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        {r.def.label}
                        <Tooltip>
                          <TooltipTrigger asChild><button type="button" aria-label={`Definition of ${r.def.label}`} className="text-muted-foreground hover:text-foreground"><IconInfoCircle className="size-3.5" /></button></TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs text-xs leading-5">
                            <b>{r.def.label}</b> — {r.def.definition}<br />Target {fmtUnit(r.target, r.def.unit)} · {r.def.better === "up" ? "higher is better" : "lower is better"} · amber within {r.def.unit === "pct" ? `${r.def.tolerance} pts` : `${r.def.tolerance * 100}%`}<br />Source: {r.def.source}
                          </TooltipContent>
                        </Tooltip>
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{fmtUnit(r.actual, r.def.unit)}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">{fmtUnit(r.comparator, r.def.unit)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", tone === "good" && "text-emerald-700 dark:text-emerald-400", tone === "bad" && "text-rose-700 dark:text-rose-400", r.variance == null && "text-muted-foreground")}>{fmtVar(r)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", tone === "good" && "text-emerald-700 dark:text-emerald-400", tone === "bad" && "text-rose-700 dark:text-rose-400", r.variancePct == null && "text-muted-foreground")}>{r.variancePct == null ? "No history" : `${r.variancePct > 0 ? "+" : ""}${r.variancePct.toFixed(1)}%`}</TableCell>
                    <TableCell><Sparkline data={r.trend} className="h-6 w-24" color={r.rag === "red" ? "var(--color-destructive)" : undefined} /></TableCell>
                    <TableCell><StatusBadge variant={RAG_VARIANT[r.rag]}>{RAG_LABEL[r.rag]}</StatusBadge></TableCell>
                    <TableCell className="pr-4 text-muted-foreground">{r.def.metricId ? <Link to={`/catalog?m=${r.def.metricId}`} className="hover:text-foreground hover:underline">{r.def.owner}</Link> : r.def.owner}</TableCell>
                  </TableRow>
                );
              })}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );
}

/** Deterministic management messages: the biggest misses and wins against target. */
export function keyMessages(results: KpiResult[]) {
  const gap = (r: KpiResult) => {
    if (r.actual == null || r.target == null || !r.target) return 0;
    const g = r.def.better === "up" ? (r.actual - r.target) / Math.abs(r.target) : (r.target - r.actual) / Math.abs(r.target);
    return r.def.unit === "pct" ? (r.def.better === "up" ? r.actual - r.target : r.target - r.actual) / 10 : g;
  };
  const misses = results.filter((r) => r.rag === "red").sort((a, b) => gap(a) - gap(b)).slice(0, 3);
  const wins = results.filter((r) => r.rag === "green").sort((a, b) => gap(b) - gap(a)).slice(0, 2);
  const line = (r: KpiResult) => `${r.def.label} at ${fmtUnit(r.actual, r.def.unit)} against a target of ${fmtUnit(r.target, r.def.unit)}${r.prior != null ? `; ${fmtUnit(r.prior, r.def.unit)} in the prior period` : ""}. Owner: ${r.def.owner}.`;
  return { misses: misses.map((r) => ({ r, text: line(r) })), wins: wins.map((r) => ({ r, text: line(r) })) };
}
