import { useParams } from "react-router-dom";
import { ModulePage } from "@/components/app/module";
import { FilterBar, inF, opts, type FilterValues } from "@/components/app/filters";
import { usePersistentState } from "@/state/app";
import { DESTINATIONS, LOCATIONS, MONTHS, TR_CONTRACT, TR_MARKET, TSTAGES, trips, type Trip } from "@/data/data";
import * as T from "./tabs";
import * as T2 from "./tabs2";

const VIEWS: Record<string, (p: { rows: Trip[] }) => React.ReactNode> = {
  live: T.Live, dispatch: T.Dispatch, inside: T.Inside, hygiene: T.Hygiene, costing: T.Costing, payments: T.Payments,
  detention: T2.Detention, transporters: T2.Transporters, destinations: T2.Destinations, accuracy: T2.Accuracy, "cash-discount": T2.CashDiscount,
};

export const latestTrip = trips.reduce((m, t) => (t.lastUpdated > m ? t.lastUpdated : m), trips[0].created);

export default function Trips() {
  const { tab = "live" } = useParams();
  const [f, setF] = usePersistentState<FilterValues>("trip.filters", {});
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
        ]} />
      }
      note={`${rows.length.toLocaleString("en-IN")} of ${trips.length.toLocaleString("en-IN")} trips in scope · click any bar, tile or highlighted number to see the trips behind it`}
    >
      <View rows={rows} />
    </ModulePage>
  );
}
