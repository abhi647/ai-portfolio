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

/* ------------------------- Semantic-layer filter bar ------------------------- */
import type { Filter as QFilter } from "@/ai/engine";
import { dimValues, type Dataset } from "@/ai/catalog";

const NEG = new Set(["is-not", "is-none-of"]);
export const toBar = (fs: QFilter[]): FilterValues =>
  fs.map((f, i) => ({ id: `q${i}-${f.field}`, field: f.field, operator: f.op === "in" ? (f.values.length > 1 ? "is-any-of" : "is") : f.values.length > 1 ? "is-none-of" : "is-not", value: f.values.length > 1 ? f.values : f.values[0] ?? null }) as Filter);
export const fromBar = (v: FilterValues): QFilter[] =>
  (Array.isArray(v) ? v : []).map((x) => ({
    field: x.field,
    op: NEG.has(x.operator) ? ("not_in" as const) : ("in" as const),
    values: x.value == null ? [] : Array.isArray(x.value) ? (x.value as unknown[]).map(String) : [String(x.value)],
  }));

/** Filter fields for a dataset: every dimension, with its distinct values. */
export function datasetFields(ds: Dataset, exclude: string[] = []): FilterField[] {
  return ds.dims.filter((d) => !exclude.includes(d.key)).map((d) => ({ key: d.key, label: d.label, options: opts(dimValues(ds, d.key, 400)) }));
}

/** FilterBar bound to the semantic layer's filter shape. */
export function DatasetFilterBar({ ds, filters, onChange, children, count, exclude }: {
  ds: Dataset; filters: QFilter[]; onChange: (f: QFilter[]) => void; children?: React.ReactNode; count?: React.ReactNode; exclude?: string[];
}) {
  const fields = React.useMemo(() => datasetFields(ds, exclude), [ds, exclude]);
  return <FilterBar fields={fields} values={toBar(filters)} onChange={(v) => onChange(fromBar(v))} count={count}>{children}</FilterBar>;
}
