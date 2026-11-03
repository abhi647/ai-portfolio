/* Data health: source availability, freshness vs SLA, data-quality checks and the sync log. */
import * as React from "react";
import { ModulePage } from "@/components/app/module";
import { DataTable, Pill, type Col } from "@/components/app/kit";
import { MetricGroup, MetricGroupItem } from "@/components/overtrue/metric-group";
import { ServiceStatus } from "@/components/overtrue/service-status";
import { StatusBadge } from "@/components/overtrue/status-badge";
import { LogStream, type LogEntry } from "@/components/overtrue/log-stream";
import { SectionCard } from "@/components/overtrue/section-card";
import { SOURCES, qualityChecks, sourceHealth, sourceSamples, type QualityCheck, type Source } from "@/data/governance";
import { syncRuns } from "@/data/data";
import { fdt, fmtN } from "@/data/format";

const ago = (min: number) => (min === Infinity ? "Never" : min < 60 ? `${Math.round(min)} min ago` : min < 1440 ? `${(min / 60).toFixed(1)} h ago` : `${(min / 1440).toFixed(1)} days ago`);
const every = (m: number) => (m >= 1440 ? "Daily" : m >= 60 ? `Every ${m / 60} h` : `Every ${m} min`);

export default function DataHealth() {
  const rows = React.useMemo(() => SOURCES.map((s, i) => ({ s, h: sourceHealth(s), samples: sourceSamples(s, i) })), []);
  const checks = React.useMemo(() => qualityChecks(), []);
  const current = rows.filter((r) => r.h.status === "operational").length;
  const slaMet = rows.filter((r) => r.h.lagMin <= r.s.slaMin).length;
  const logs: LogEntry[] = React.useMemo(() => [...syncRuns].sort((a, b) => +b.start - +a.start).slice(0, 60).map((r) => ({
    id: r.id, time: r.start, source: r.table, level: r.status === "failed" ? "error" : r.status === "in_process" ? "info" : "info",
    message: r.status === "failed" ? `Sync failed after ${r.secs}s — ${r.err}` : r.status === "in_process" ? `Sync running — ${fmtN(r.rows)} rows so far` : `Sync completed in ${r.secs}s — ${fmtN(r.rows)} rows upserted`,
  })), []);

  const srcCols: Col<(typeof rows)[number]>[] = [
    { id: "t", header: "Table", value: (r) => r.s.table, cell: (r) => <span className="flex flex-col"><span className="font-mono text-[12px] font-medium">{r.s.table}</span><span className="text-[11px] text-muted-foreground">{r.s.system}</span></span> },
    { id: "d", header: "Domain", value: (r) => r.s.domain },
    { id: "c", header: "Cadence", value: (r) => r.s.cadenceMin, cell: (r) => every(r.s.cadenceMin) },
    { id: "sla", header: "Freshness SLA", value: (r) => r.s.slaMin, cell: (r) => `≤ ${r.s.slaMin >= 1440 ? `${r.s.slaMin / 1440} days` : r.s.slaMin >= 60 ? `${r.s.slaMin / 60} h` : `${r.s.slaMin} min`}` },
    { id: "l", header: "Last success", value: (r) => r.h.lagMin, cell: (r) => <span className="tabular-nums">{r.h.lastOk ? fdt(r.h.lastOk.start) : "Never"} <span className="text-muted-foreground">· {ago(r.h.lagMin)}</span></span> },
    { id: "r", header: "Rows (last run)", align: "right", value: (r) => r.h.rows, cell: (r) => fmtN(r.h.rows) },
    { id: "s", header: "Status", value: (r) => r.h.status, cell: (r) => <StatusBadge variant={r.h.status === "operational" ? "success" : r.h.status === "degraded" ? "warning" : "error"}>{r.h.status === "operational" ? (r.h.running ? "Syncing" : "Within SLA") : r.h.status === "degraded" ? "Recent failure" : "SLA breached"}</StatusBadge> },
    { id: "o", header: "Owner", value: (r) => r.s.owner },
  ];
  const qCols: Col<QualityCheck>[] = [
    { id: "r", header: "Rule", value: (q) => q.rule, cell: (q) => <span className="flex flex-col"><span className="font-medium">{q.rule}</span><span className="text-[11px] text-muted-foreground">{q.detail}</span></span> },
    { id: "k", header: "Type", value: (q) => q.kind },
    { id: "d", header: "Dataset", value: (q) => q.dataset },
    { id: "s", header: "Scanned", align: "right", value: (q) => q.scanned, cell: (q) => fmtN(q.scanned) },
    { id: "f", header: "Failing", align: "right", value: (q) => q.failing, cell: (q) => <span className={q.failing ? "font-semibold text-rose-700 dark:text-rose-400" : "text-muted-foreground"}>{fmtN(q.failing)}</span> },
    { id: "res", header: "Result", value: (q) => q.result, cell: (q) => <Pill tone={q.result === "pass" ? "success" : q.result === "warn" ? "warning" : "error"}>{q.result === "pass" ? "Pass" : q.result === "warn" ? "Warning" : "Fail"}</Pill> },
  ];

  return (
    <ModulePage moduleId="health">
      <MetricGroup className="grid grid-cols-2 lg:grid-cols-5">
        <MetricGroupItem label="Sources within SLA" value={`${slaMet}/${SOURCES.length}`} context="freshness SLA met" />
        <MetricGroupItem label="Healthy now" value={`${current}/${SOURCES.length}`} context={`${SOURCES.length - current} with a recent failure`} />
        <MetricGroupItem label="Quality checks passing" value={`${checks.filter((c) => c.result === "pass").length}/${checks.length}`} context={`${checks.filter((c) => c.result === "warn").length} warnings · ${checks.filter((c) => c.result === "fail").length} failures`} />
        <MetricGroupItem label="Rows synced · last runs" value={fmtN(rows.reduce((s, r) => s + r.h.rows, 0))} context="across all source tables" />
        <MetricGroupItem label="30-day availability" value={`${((rows.flatMap((r) => r.samples).filter((x) => x.status === "operational").length / rows.flatMap((r) => r.samples).length) * 100).toFixed(1)}%`} context="share of source-days fully healthy" />
      </MetricGroup>

      <SectionCard title="Source freshness" description="Every table that feeds the semantic layer, its refresh cadence and freshness SLA" contentClassName="p-0">
        <DataTable rows={rows} cols={srcCols} pageSize={0} showPagination={false} getRowId={(r) => r.s.id} exportName="source_freshness" />
      </SectionCard>

      <ServiceStatus title="Source availability · last 30 days" description="One bar per day — amber is a day with a failed or late sync, red an SLA breach"
        services={rows.map((r) => ({ id: r.s.id, name: `${r.s.system} · ${r.s.table}`, status: r.h.status, samples: r.samples, startLabel: "30 days ago", endLabel: "Today" }))} />

      <SectionCard title="Data quality checks" description="Run after every load · completeness, validity, uniqueness, reconciliation and timeliness" contentClassName="p-0">
        <DataTable rows={checks} cols={qCols} pageSize={0} showPagination={false} getRowId={(q) => q.id} exportName="quality_checks" initialSorting={[{ id: "f", desc: true }]} />
      </SectionCard>

      <LogStream title="Sync log" description="Latest 60 pipeline runs across all sources" entries={logs} height={320} defaultFollow={false} />
    </ModulePage>
  );
}

export type { Source };
