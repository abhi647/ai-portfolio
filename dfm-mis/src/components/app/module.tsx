import * as React from "react";
import { useNavigate } from "react-router-dom";
import { IconAdjustmentsHorizontal, IconChevronDown } from "@tabler/icons-react";
import { PageHeader } from "@/components/overtrue/page-header";
import { FilterTabs } from "@/components/overtrue/filter-tabs";
import { StatusBadge } from "@/components/overtrue/status-badge";
import { MODULES } from "@/nav";
import { fdt } from "@/data/format";
import { useApp } from "@/state/app";

export function ModulePage({ moduleId, tab, filters, children, note, updated }: {
  moduleId: string; tab?: string; filters?: React.ReactNode; children: React.ReactNode; note?: React.ReactNode; updated?: Date;
}) {
  const mod = MODULES.find((m) => m.id === moduleId)!;
  const t = mod.tabs?.find((x) => x.id === tab);
  const nav = useNavigate();
  const { lastSync } = useApp();
  const [showFilters, setShowFilters] = React.useState(false);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={mod.source ? `${mod.label} · Source: ${mod.source}` : mod.label}
        title={t ? t.label : mod.label}
        description={t ? t.description : mod.description}
        actions={
          <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
            <StatusBadge variant="success">Refreshed {fdt(lastSync)}</StatusBadge>
            {updated ? <span>Data till {fdt(updated)}</span> : null}
          </div>
        }
      />
      {mod.tabs ? (
        <div className="-mx-1 overflow-x-auto px-1 pb-1 scrollbar-thin">
          <FilterTabs label={`${mod.label} views`} items={mod.tabs.map((x) => ({ value: x.id, label: x.label }))} value={tab ?? mod.tabs[0].id} onValueChange={(v) => nav(`${mod.path}/${v}`)} />
        </div>
      ) : null}
      {filters ? (
        <div className="surface-card p-4">
          <button type="button" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} className="flex w-full items-center justify-between text-sm font-medium md:hidden">
            <span className="inline-flex items-center gap-2"><IconAdjustmentsHorizontal className="size-4" /> Filters</span>
            <IconChevronDown className={"size-4 transition-transform " + (showFilters ? "rotate-180" : "")} />
          </button>
          <div className={(showFilters ? "mt-4 block" : "hidden") + " md:mt-0 md:block"}>
            {filters}
            {note ? <p className="m-0 mt-3 text-xs text-muted-foreground">{note}</p> : null}
          </div>
        </div>
      ) : null}
      <div key={tab} className="flex flex-col gap-6">{children}</div>
    </div>
  );
}
