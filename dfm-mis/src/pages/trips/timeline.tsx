import * as React from "react";
import { GanttChart, type GanttTask } from "@/components/overtrue/gantt-chart";
import { Grid, KpiRow, Panel, Stat, Toggle } from "@/components/app/kit";
import { useDrill } from "@/state/drill";
import { C } from "@/data/colors";
import { NOW, TSTAGES, tStage, trips, type Trip } from "@/data/data";
import { DAY, H, fdt, fmtN, pct } from "@/data/format";

/** Planned duration (hours) for each leg — the SLA the plan is measured against. */
export const LEG_PLAN = {
  plant: () => 6,
  transit: (t: Trip) => t.km / 32 + 2,
  dest: () => 10,
  epod: () => 48,
};
const LEGS = [
  { key: "plant", label: "Plant TAT", from: "reported", to: "gateOut", color: C.orange },
  { key: "transit", label: "Transit", from: "gateOut", to: "destReported", color: C.c1 },
  { key: "dest", label: "At destination", from: "destReported", to: "destGateOut", color: C.c4 },
  { key: "epod", label: "ePOD closure", from: "destGateOut", to: "epod", color: C.teal },
] as const;

/** ETA for the trip's current leg, and whether it is already late. */
export function tripEta(t: Trip) {
  for (const l of LEGS) {
    const a = t.ms[l.from as keyof Trip["ms"]], b = t.ms[l.to as keyof Trip["ms"]];
    if (a && !b) { const due = new Date(+a + LEG_PLAN[l.key](t) * H); return { leg: l.label, due, late: due < NOW, lateBy: (+NOW - +due) / H }; }
  }
  return null;
}

function legTasks(t: Trip): GanttTask[] {
  const out: GanttTask[] = [];
  let prev: string | undefined;
  const group = `${t.id} · ${t.loc} → ${t.dest}`;
  out.push({ id: t.id + "-c", label: "Reporting", group, start: t.created, end: t.ms.reported ?? new Date(Math.max(+NOW, +t.created + 3 * H)), color: C.muted, progress: t.ms.reported ? 1 : 0.5 });
  prev = t.id + "-c";
  for (const l of LEGS) {
    const a = t.ms[l.from as keyof Trip["ms"]];
    const b = t.ms[l.to as keyof Trip["ms"]];
    if (!a) {
      // future leg: plan it after the previous one
      const lastEnd = out[out.length - 1].end as Date;
      out.push({ id: `${t.id}-${l.key}`, label: `${l.label} (planned)`, group, start: lastEnd, end: new Date(+lastEnd + LEG_PLAN[l.key](t) * H), color: `color-mix(in oklab, ${l.color} 35%, transparent)`, progress: 0, dependsOn: prev ? [prev] : undefined });
    } else {
      const planEnd = new Date(+a + LEG_PLAN[l.key](t) * H);
      out.push({ id: `${t.id}-${l.key}`, label: l.label, group, start: a, end: b ?? new Date(Math.max(+NOW, +planEnd)), color: l.color, progress: b ? 1 : Math.min(0.95, (+NOW - +a) / (+planEnd - +a)), dependsOn: prev ? [prev] : undefined });
    }
    prev = `${t.id}-${l.key}`;
  }
  return out;
}

export function Timeline({ rows }: { rows: Trip[] }) {
  const { openTrip } = useDrill();
  const [mode, setMode] = React.useState<"fleet" | "legs">("fleet");
  const active = rows.filter((t) => t.stage !== "epod_done").sort((a, b) => +a.created - +b.created);
  const withEta = active.map((t) => ({ t, eta: tripEta(t) }));
  const late = withEta.filter((x) => x.eta?.late);
  // Long-haul lanes over the last 6 days: these trips run for several days, so the Gantt shows real spans.
  const recent = rows.filter((t) => +NOW - +t.created < 6 * DAY && t.km >= 180).sort((a, b) => +a.created - +b.created);
  const fleet: GanttTask[] = recent.slice(-36).map((t) => {
    const eta = tripEta(t);
    const end = t.ms.epod ?? new Date(Math.max(+NOW + H, +(eta?.due ?? NOW)));
    return { id: t.id, label: `${t.id} · ${t.dest}`, group: tStage(t.stage).label, owner: t.transporter, start: t.created, end, progress: t.stageIdx / 7, color: eta?.late ? C.bad : tStage(t.stage).color };
  });
  const focus = (late.length ? late.map((x) => x.t) : active).slice(0, 6);
  const legs = focus.flatMap(legTasks);
  const byLeg = LEGS.map((l) => ({ l, n: withEta.filter((x) => x.eta?.leg === l.label && x.eta.late).length }));
  const worst = byLeg.sort((a, b) => b.n - a.n)[0];
  return (
    <>
      <KpiRow className="xl:grid-cols-4">
        <Stat label="Trips on the board" value={active.length} hint="Not yet ePOD-closed" />
        <Stat label="Behind plan" value={late.length} color={C.bad} hint={pct(late.length, active.length, 0) + " of active"} />
        <Stat label="On plan" value={active.length - late.length} color={C.good} />
        <Stat label="Worst leg" value={worst?.l.label ?? "—"} hint={`${worst?.n ?? 0} trips past their SLA`} />
      </KpiRow>
      <Grid>
        <Panel span={12} title="Trip timeline" description={mode === "fleet" ? "Long-haul trips (180+ km) from the last 6 days, creation → ePOD or ETA, grouped by current stage. Red bars are behind plan." : "Leg-by-leg plan vs actual for the trips most behind plan. Faded bars are planned legs."}
          info="Plan per leg: plant 6 h, transit km ÷ 32 + 2 h, destination 10 h, ePOD 48 h."
          actions={<Toggle label="Timeline mode" value={mode} onChange={setMode} options={[["fleet", "All trips"], ["legs", "Leg detail"]]} />}
          insight={late.length
            ? `{{metric:${late.length} trips|${pct(late.length, active.length, 0)}|negative}} are behind plan; most delays sit in {{metric:${worst.l.label}|${worst.n} trips|negative}}. The longest overrun is ${Math.round(Math.max(...late.map((x) => x.eta!.lateBy)))} h on ${late.sort((a, b) => b.eta!.lateBy - a.eta!.lateBy)[0].t.id}.`
            : "All active trips are on plan."}>
          <GanttChart
            key={mode}
            tasks={mode === "fleet" ? fleet : legs}
            today={NOW}
            defaultZoom={mode === "fleet" ? "day" : "day"}
            height={560}
            groupOrder={TSTAGES.map((s) => s.label)}
            dateFormatter={(d) => fdt(d)}
            onSelectedChange={(id) => { const t = trips.find((x) => x.id === id || (id && id.startsWith(x.id + "-"))); if (t && id) openTrip(t); }}
            summary={<span className="text-xs text-muted-foreground">{fmtN(mode === "fleet" ? fleet.length : focus.length)} trips shown · click a bar to open the trip</span>}
          />
        </Panel>
      </Grid>
    </>
  );
}
