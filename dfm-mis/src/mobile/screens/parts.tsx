/* Shared phone-screen building blocks. */
import * as React from "react";
import { IconChevronRight } from "@tabler/icons-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StagePill } from "@/components/app/kit";
import { useDrill } from "@/state/drill";
import { NOW, oStage, tStage, type Order, type Trip } from "@/data/data";
import { ageStr, fdt, fmtN } from "@/data/format";
import { initials } from "@/data/format";
import { useApp } from "@/state/app";
import { cn } from "@/lib/utils";

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: React.ReactNode; right?: React.ReactNode }) {
  const { user } = useApp();
  return (
    <header className="pt-safe sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4">
        <img src="/brand/crax-logo.png" alt="" className="h-7 w-auto" />
        <div className="min-w-0 flex-1">
          <h1 className="m-0 truncate text-[17px] leading-tight font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="m-0 truncate text-[12px] text-muted-foreground">{subtitle}</p> : null}
        </div>
        {right ?? <span className="flex size-8 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{initials(user?.name ?? "U")}</span>}
      </div>
    </header>
  );
}

export function Section({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex items-center justify-between px-0.5">
        <h2 className="m-0 text-[15px] font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

type ListState = { title: string; kind: "trips"; rows: Trip[] } | { title: string; kind: "orders"; rows: Order[] } | null;
const ListCtx = React.createContext<(s: ListState) => void>(() => undefined);
export const useList = () => React.useContext(ListCtx);

/** Bottom sheet of trip or order cards — phone-friendly replacement for the desktop drill-down table. */
export function ListProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ListState>(null);
  const { openTrip } = useDrill();
  return (
    <ListCtx.Provider value={setState}>
      {children}
      <Sheet open={!!state} onOpenChange={(o) => !o && setState(null)}>
        <SheetContent side="bottom" className="pb-safe max-h-[85dvh] gap-0 rounded-t-2xl p-0">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden />
          <SheetHeader className="px-4 pt-3 pb-2">
            <SheetTitle className="text-base">{state?.title}</SheetTitle>
            <SheetDescription>{state ? `${fmtN(state.rows.length)} ${state.kind}` : ""}</SheetDescription>
          </SheetHeader>
          <ul className="m-0 flex list-none flex-col gap-2 overflow-y-auto px-4 pb-4">
            {state?.kind === "trips" && state.rows.slice(0, 80).map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => { setState(null); window.setTimeout(() => openTrip(t), 250); }}
                  className="surface-card flex w-full items-center gap-3 p-3 text-left active:scale-[0.99]">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="font-mono text-xs font-medium">{t.id}</span><StagePill s={tStage(t.stage)} /></div>
                    <div className="mt-1 truncate text-sm font-medium">{t.loc} → {t.dest}</div>
                    <div className="truncate text-xs text-muted-foreground">{t.transporter} · {t.vno}</div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div className="tabular-nums">{ageStr(+NOW - +t.lastUpdated)}</div>
                    <IconChevronRight className="ml-auto mt-1 size-4" />
                  </div>
                </button>
              </li>
            ))}
            {state?.kind === "orders" && state.rows.slice(0, 80).map((o) => (
              <li key={o.no} className="surface-card p-3">
                <div className="flex items-center gap-2"><span className="truncate font-mono text-xs font-medium">{o.no}</span><StagePill s={oStage(o.stage)} /></div>
                <div className="mt-1 truncate text-sm font-medium">{o.dest} · {fmtN(o.qtyShown)} cases</div>
                <div className="truncate text-xs text-muted-foreground">{o.customer} · approved {fdt(o.approved)}</div>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </ListCtx.Provider>
  );
}
