import { useParams } from "react-router-dom";
import { ModulePage } from "@/components/app/module";
import { FilterBar, fv, inF, opts, type FilterValues } from "@/components/app/filters";
import { usePersistentState } from "@/state/app";
import { DESTINATIONS, LOCATIONS, MONTHS, TR_CONTRACT, TR_MARKET, TSTAGES, trips, type Trip } from "@/data/data";
import * as T from "./tabs";
import * as T2 from "./tabs2";
import { Timeline } from "./timeline";

const VIEWS: Record<string, (p: { rows: Trip[] }) => React.ReactNode> = {
  live: T.Live, timeline: Timeline, dispatch: T.Dispatch, inside: T.Inside, hygiene: T.Hygiene, costing: T.Costing, payments: T.Payments,
  detention: T2.Detention, transporters: T2.Transporters, destinations: T2.Destinations, accuracy: T2.Accuracy, "cash-discount": T2.CashDiscount,
};

export const latestTrip = trips.reduce((m, t) => (t.lastUpdated > m ? t.lastUpdated : m), trips[0].created);

export default function Trips() {
  const { tab = "live" } = useParams();
  const [f, setF] = usePersistentState<FilterValues>("trip.filters.v2", []);
  const rows = trips.filter((t) => inF(f, "month", t.mk) && inF(f, "loc", t.loc) && inF(f, "dest", t.dest) && inF(f, "stage", t.stage) && inF(f, "otype", t.otype) && inF(f, "tr", t.transporter) && inF(f, "own", t.own));
  const View = VIEWS[tab] ?? T.Live;
  return (
    <ModulePage
      moduleId="trips"
      tab={tab}
      updated={latestTrip}
      filters={
        <FilterBar values={f} onChange={setF} fields={[
          { key: "month", label: "Month", options: MONTHS.map((m) => ({ value: m.key, label: m.label })) },
          { key: "loc", label: "Supply location", options: opts(LOCATIONS) },
          { key: "dest", label: "Destination", options: opts(DESTINATIONS) },
          { key: "stage", label: "Status", options: TSTAGES.map((s) => ({ value: s.key, label: s.label })) },
          { key: "otype", label: "Order type", options: opts(["Direct Order", "Indent Order", "Mixed Order"]) },
          { key: "tr", label: "Transporter", options: [...TR_CONTRACT.map((t) => ({ value: t, label: t, group: "Contracted" })), ...TR_MARKET.map((t) => ({ value: t, label: t, group: "Market" }))] },
          { key: "own", label: "Vehicle", options: opts(["Contracted", "Market"]) },
        ]} views={[
          { id: "mtd", name: "This month", filters: [fv("month", [MONTHS[5].key])] },
          { id: "market", name: "Market vehicles", filters: [fv("own", ["Market"])] },
          { id: "gn", name: "Greater Noida plant", filters: [fv("loc", ["GN"])] },
          { id: "long", name: "Long-haul lanes", filters: [fv("dest", ["Lucknow", "Kanpur", "Varanasi", "Patna", "Ranchi", "Kolkata", "Indore", "Gorakhpur"])] },
        ]} count={<span className="text-xs text-muted-foreground tabular-nums">{rows.length.toLocaleString("en-IN")} trips</span>} />
      }
      note={`${rows.length.toLocaleString("en-IN")} of ${trips.length.toLocaleString("en-IN")} trips in scope · click any bar, tile or highlighted number to see the trips behind it`}
    >
      <View rows={rows} />
    </ModulePage>
  );
}
