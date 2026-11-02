import * as React from "react";
import { useNavigate } from "react-router-dom";
import { IconInfoCircle } from "@tabler/icons-react";
import { PageHeader } from "@/components/overtrue/page-header";
import { FilterTabs } from "@/components/overtrue/filter-tabs";
import { StatusBadge } from "@/components/overtrue/status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MODULES } from "@/nav";
import { fdt } from "@/data/format";
import { useApp } from "@/state/app";

/**
 * Module page frame: a header, then one sticky toolbar holding the view tabs and the
 * compact filter bar, so filters stay reachable while scrolling through charts.
 */
export function ModulePage({ moduleId, tab, filters, children, note, updated }: {
  moduleId: string; tab?: string; filters?: React.ReactNode; children: React.ReactNode; note?: React.ReactNode; updated?: Date;
}) {
  const mod = MODULES.find((m) => m.id === moduleId)!;
  const t = mod.tabs?.find((x) => x.id === tab);
  const nav = useNavigate();
  const { lastSync } = useApp();
  return (
    <div className="flex flex-col gap-[var(--page-gap)]">
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
      {mod.tabs || filters ? (
        <div className="sticky top-14 z-20 -mx-4 flex flex-col gap-3 border-b border-border/60 bg-background/85 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {mod.tabs ? (
            <div className="-mx-1 overflow-x-auto px-1 scrollbar-thin">
              <FilterTabs label={`${mod.label} views`} items={mod.tabs.map((x) => ({ value: x.id, label: x.label }))} value={tab ?? mod.tabs[0].id} onValueChange={(v) => nav(`${mod.path}/${v}`)} />
            </div>
          ) : null}
          {filters ? (
            <div className="flex min-w-0 items-start gap-2">
              <div className="min-w-0 flex-1">{filters}</div>
              {note ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="About this data" className="mt-1.5 text-muted-foreground hover:text-foreground"><IconInfoCircle className="size-4" /></button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs text-xs leading-5">{note}</TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <div key={tab} className="flex flex-col gap-[var(--page-gap)]">{children}</div>
    </div>
  );
}
