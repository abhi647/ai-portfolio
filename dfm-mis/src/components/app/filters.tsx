import * as React from "react";
import { MultiSelect } from "@/components/overtrue/multi-select";
import { FilterBar as OtFilterBar, type Filter, type FilterView } from "@/components/overtrue/filter-bar";

/** Active filters, in overtrue/ui FilterBar's shape: field + operator + value. */
export type FilterValues = Filter[];
export interface FilterField { key: string; label: string; plural?: string; options: { value: string; label: string; group?: string }[] }

export const opts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));

/** True when `v` passes every filter on `key`. Supports is / is-not / is-any-of / is-none-of. */
export const inF = (f: FilterValues, key: string, v: string) =>
  (Array.isArray(f) ? f : []).every((x) => {
    if (x.field !== key || x.value == null) return true;
    const list = Array.isArray(x.value) ? (x.value as string[]) : [String(x.value)];
    if (!list.length) return true;
    const hit = list.includes(v);
    return x.operator === "is-not" || x.operator === "is-none-of" ? !hit : hit;
  });

let seq = 0;
export const fv = (field: string, value: string[] | string, operator: Filter["operator"] = "is-any-of"): Filter => ({ id: `v-${field}-${seq++}`, field, operator, value });

export function FilterBar({ fields, values, onChange, children, views, count }: {
  fields: FilterField[]; values: FilterValues; onChange: (v: FilterValues) => void; children?: React.ReactNode;
  views?: FilterView[]; count?: React.ReactNode;
}) {
  const safe = Array.isArray(values) ? values : [];
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <OtFilterBar
        className="min-w-0 flex-1"
        size="sm"
        showSearch={false}
        fields={fields.map((f) => ({ key: f.key, label: f.label, type: "enum" as const, plural: f.plural, options: f.options.map((o) => ({ value: o.value, label: o.label })) }))}
        filters={safe}
        onFiltersChange={onChange}
        views={views}
        actions={count}
      />
      {children}
    </div>
  );
}

/** A labelled multi-select, for single-field pickers that sit outside the main filter bar. */
export function FieldSelect({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5 sm:w-56">
      <span className="text-xs text-muted-foreground">{label}</span>
      <MultiSelect options={options} value={value} onValueChange={onChange} placeholder="All" collapse={1} aria-label={label} />
    </div>
  );
}
