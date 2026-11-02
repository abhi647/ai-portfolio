import * as React from "react";
import { IconArrowLeft, IconCheck, IconMapPin, IconTruck } from "@tabler/icons-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Timeline, TimelineConnector, TimelineContent, TimelineDescription, TimelineHeader, TimelineItem,
  TimelineMarker, TimelineRail, TimelineTime, TimelineTitle,
} from "@/components/overtrue/event-timeline";
import { DetailList } from "@/components/overtrue/detail-list";
import { MetricGroup, MetricGroupItem } from "@/components/overtrue/metric-group";
import { DataTable, Pill, StagePill, type Col } from "@/components/app/kit";
import { NOW, oStage, tStage, type Order, type Trip } from "@/data/data";
import { ageStr, cr, fdt, fmtN, inr, sum } from "@/data/format";
import { OtifValue } from "@/components/app/otif";

type Drill = { title: string; kind: "trip"; rows: Trip[] } | { title: string; kind: "order"; rows: Order[] };
const Ctx = React.createContext<{ openTrips: (title: string, rows: Trip[]) => void; openOrders: (title: string, rows: Order[]) => void; openTrip: (t: Trip) => void } | null>(null);
export const useDrill = () => React.useContext(Ctx)!;

export const tripCols: Col<Trip>[] = [
  { id: "id", header: "Trip ID", value: (r) => r.id, cell: (r) => <span className="font-mono text-xs font-medium">{r.id}</span> },
  { id: "created", header: "Created", value: (r) => +r.created, cell: (r) => fdt(r.created), csv: (r) => fdt(r.created) },
  { id: "stage", header: "Stage", value: (r) => r.stageIdx, cell: (r) => <StagePill s={tStage(r.stage)} />, csv: (r) => tStage(r.stage).label },
  { id: "route", header: "Route", value: (r) => r.loc + " → " + r.dest },
  { id: "customer", header: "Customer", value: (r) => r.customer },
  { id: "transporter", header: "Transporter", value: (r) => r.transporter },
  { id: "vno", header: "Vehicle", value: (r) => r.vno, cell: (r) => <span className="font-mono text-xs">{r.vno}</span> },
  { id: "own", header: "Type", value: (r) => r.own, cell: (r) => <Pill tone={r.own === "Contracted" ? "info" : "neutral"}>{r.own}</Pill> },
  { id: "km", header: "KM", align: "right", value: (r) => r.km, cell: (r) => fmtN(r.km) },
  { id: "freight", header: "Freight", align: "right", value: (r) => r.total, cell: (r) => inr(r.total) },
  { id: "qty", header: "Cases", align: "right", value: (r) => r.invQty || r.planQty, cell: (r) => (r.invQty ? fmtN(r.invQty) : <span className="text-muted-foreground" title="Planned — not yet invoiced">{fmtN(r.planQty)} plan</span>), csv: (r) => r.invQty || r.planQty },
  { id: "track", header: "Tracking", value: (r) => r.consent, cell: (r) => (r.consent === "ALLOWED" ? <Pill tone="success">Live</Pill> : <Pill>Not tracked</Pill>) },
  { id: "pay", header: "Payment", value: (r) => r.payStatus, cell: (r) => <span className={["Not due", "Awaiting ePOD"].includes(r.payStatus) ? "text-muted-foreground" : undefined}>{r.payStatus}</span> },
];

export const orderCols = (otif: { green: number; amber: number }): Col<Order>[] => [
  { id: "no", header: "Order no", value: (r) => r.no, cell: (r) => <span className="font-mono text-xs font-medium">{r.no}</span> },
  { id: "approved", header: "Approved", value: (r) => +r.approved, cell: (r) => fdt(r.approved), csv: (r) => fdt(r.approved) },
  { id: "age", header: "Ageing", align: "right", value: (r) => +NOW - +r.approved, cell: (r) => {
    if (r.stage === "dispatched") return <span className="text-muted-foreground">Closed</span>;
    const a = (+NOW - +r.approved) / 3600e3;
    return <Pill tone={a > 48 ? "error" : a > 24 ? "warning" : "success"}>{ageStr(+NOW - +r.approved)}</Pill>;
  } },
  { id: "stage", header: "Stage", value: (r) => r.stage, cell: (r) => <StagePill s={oStage(r.stage)} />, csv: (r) => oStage(r.stage).label },
  { id: "type", header: "Type", value: (r) => r.type },
  { id: "dest", header: "Destination", value: (r) => r.dest },
  { id: "customer", header: "Customer", value: (r) => r.customer },
  { id: "qty", header: "Qty", align: "right", value: (r) => r.qtyShown, cell: (r) => fmtN(r.qtyShown) },
  { id: "pt", header: "PT", value: (r) => r.productType },
  { id: "transporter", header: "Transporter", value: (r) => r.transporter },
  { id: "target", header: "OTIF target", value: (r) => +r.target, cell: (r) => fdt(r.target), csv: (r) => fdt(r.target) },
  { id: "otif", header: "OTIF", align: "right", value: (r) => r.otif ?? -1, cell: (r) => <OtifValue v={r.otif} t={otif} />, csv: (r) => (r.otif == null ? "NA" : (r.otif * 100).toFixed(1) + "%") },
];

const tripSearch = (r: Trip) => [r.id, r.vno, r.transporter, r.customer, r.dest].join(" ");
const orderSearch = (r: Order) => [r.no, r.dest, r.customer, r.transporter, r.vno].join(" ");

export function DrillProvider({ children, otif }: { children: React.ReactNode; otif: { green: number; amber: number } }) {
  const [drill, setDrill] = React.useState<Drill | null>(null);
  const [trip, setTrip] = React.useState<Trip | null>(null);
  const [open, setOpen] = React.useState(false);
  const api = React.useMemo(() => ({
    openTrips: (title: string, rows: Trip[]) => { setDrill({ title, kind: "trip", rows }); setTrip(null); setOpen(true); },
    openOrders: (title: string, rows: Order[]) => { setDrill({ title, kind: "order", rows }); setTrip(null); setOpen(true); },
    openTrip: (t: Trip) => { setTrip(t); setOpen(true); },
  }), []);
  const oc = React.useMemo(() => orderCols(otif), [otif]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[min(1100px,92vw)]">
          {trip ? (
            <TripDetail trip={trip} onBack={drill ? () => setTrip(null) : undefined} />
          ) : drill ? (
            <>
              <SheetHeader className="border-b border-border/60 p-5">
                <SheetTitle className="text-base">{drill.title}</SheetTitle>
                <SheetDescription>
                  {drill.kind === "trip"
                    ? `${fmtN(drill.rows.length)} trips · ${cr(sum(drill.rows, "total"))} freight · click a trip for its journey`
                    : `${fmtN(drill.rows.length)} orders · ${fmtN(sum(drill.rows, "qtyShown"))} cases`}
                </SheetDescription>
              </SheetHeader>
              <div className="p-5">
                {drill.kind === "trip" ? (
                  <DataTable rows={drill.rows} cols={tripCols} search={tripSearch} searchPlaceholder="Search trip, vehicle, transporter…" exportName={drill.title} getRowId={(r) => r.id} onRowClick={setTrip} pageSize={15} />
                ) : (
                  <DataTable rows={drill.rows} cols={oc} search={orderSearch} searchPlaceholder="Search order, destination, customer…" exportName={drill.title} getRowId={(r) => r.no} pageSize={15} />
                )}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </Ctx.Provider>
  );
}

const MILESTONES: [keyof Trip["ms"], string, string][] = [
  ["created", "Trip created", "Indent converted to trip in Traqo"],
  ["reported", "Vehicle reported", "Origin gate entry"],
  ["loadStart", "Loading started", "Bay assigned, loading in progress"],
  ["invoiced", "Invoiced", "ERP invoice generated"],
  ["gateOut", "Gate out", "Left origin — in transit"],
  ["destReported", "Reached destination", "Destination vehicle reported"],
  ["destGateOut", "Unloaded", "Destination gate out"],
  ["epod", "ePOD closed", "Proof of delivery verified"],
];

function TripDetail({ trip: t, onBack }: { trip: Trip; onBack?: () => void }) {
  const cur = t.stageIdx;
  return (
    <>
      <SheetHeader className="border-b border-border/60 p-5">
        {onBack ? (
          <Button variant="ghost" size="sm" className="-ml-2 mb-1 w-fit gap-1.5" onClick={onBack}><IconArrowLeft className="size-4" /> Back to list</Button>
        ) : null}
        <SheetTitle className="flex flex-wrap items-center gap-2 text-base">
          <IconTruck className="size-5 text-primary" />
          <span className="font-mono">{t.id}</span>
          <StagePill s={tStage(t.stage)} />
          {t.consent === "ALLOWED" ? <Pill tone="success" live>GPS tracked</Pill> : <Pill>Not tracked</Pill>}
        </SheetTitle>
        <SheetDescription className="flex items-center gap-1.5"><IconMapPin className="size-4" />{t.origin} → {t.dest} · {fmtN(t.km)} km</SheetDescription>
      </SheetHeader>
      <div className="grid gap-6 p-5 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h3 className="m-0 mb-3 text-sm font-semibold">Journey</h3>
          <Timeline>
            {MILESTONES.map(([k, label, desc], i) => {
              const at = t.ms[k];
              const status = i < cur || (i === cur && cur === MILESTONES.length - 1) ? "done" : i === cur ? "current" : "default";
              const prev = i > 0 ? t.ms[MILESTONES[i - 1][0]] : null;
              return (
                <TimelineItem key={k} status={status}>
                  <TimelineRail>
                    <TimelineMarker>{status === "done" ? <IconCheck /> : null}</TimelineMarker>
                    <TimelineConnector />
                  </TimelineRail>
                  <TimelineContent className="pb-4">
                    <TimelineHeader>
                      <TimelineTitle className={at ? "" : "text-muted-foreground"}>{label}</TimelineTitle>
                      <TimelineTime>{at ? fdt(at) : "Pending"}</TimelineTime>
                    </TimelineHeader>
                    <TimelineDescription>
                      {desc}
                      {at && prev ? <span className="text-muted-foreground"> · +{ageStr(+at - +prev)}</span> : null}
                    </TimelineDescription>
                  </TimelineContent>
                </TimelineItem>
              );
            })}
          </Timeline>
        </div>
        <div className="flex flex-col gap-5">
          <MetricGroup>
            <MetricGroupItem label="Total freight" value={inr(t.total)} context={`Base ${inr(t.freight)}`} />
            <MetricGroupItem label="₹ / km" value={"₹" + (t.total / t.km).toFixed(1)} context={t.l1 ? `L1 ${inr(t.l1)}` : "No L1 benchmark"} />
            <MetricGroupItem label="Cases" value={t.invQty ? fmtN(t.invQty) : "—"} context={t.shortQty ? `${t.shortQty} short` : t.excessQty ? `${t.excessQty} excess` : "No variance"} />
          </MetricGroup>
          <DetailList
            items={[
              { id: "cust", label: "Customer", value: t.customer },
              { id: "tr", label: "Transporter", value: `${t.transporter} (${t.own})` },
              { id: "veh", label: "Vehicle", value: `${t.vno} · ${t.vtype}` },
              { id: "otype", label: "Order type", value: t.otype },
              { id: "det", label: "Detention", value: t.sysDet ? `${inr(t.actDet)} claimed of ${inr(t.sysDet)} system` : "None" },
              { id: "pay", label: "Payment", value: t.payStatus || "Not yet due" },
              { id: "tat", label: "Plant TAT / Transit", value: `${t.tPlant ? t.tPlant.toFixed(1) + " h" : "—"} / ${t.tTransit ? t.tTransit.toFixed(1) + " h" : "—"}` },
              { id: "upd", label: "Last update", value: fdt(t.lastUpdated) },
            ]}
          />
        </div>
      </div>
    </>
  );
}
