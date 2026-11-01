import { IconFilterOff } from "@tabler/icons-react";
import { MultiSelect } from "@/components/overtrue/multi-select";
import { Button } from "@/components/ui/button";

export type FilterValues = Record<string, string[]>;
export interface FilterField { key: string; label: string; options: { value: string; label: string }[] }

export const opts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));
export const inF = (f: FilterValues, key: string, v: string) => !f[key]?.length || f[key].includes(v);

export function FilterBar({ fields, values, onChange, children }: { fields: FilterField[]; values: FilterValues; onChange: (v: FilterValues) => void; children?: React.ReactNode }) {
  const active = Object.values(values).reduce((n, v) => n + (v?.length ? 1 : 0), 0);
  return (
    <div className="flex flex-wrap items-end gap-3">
      {fields.map((f) => (
        <div key={f.key} className="flex w-full min-w-0 flex-col gap-1.5 sm:w-52">
          <span className="text-xs text-muted-foreground">{f.label}</span>
          <MultiSelect
            options={f.options}
            value={values[f.key] ?? []}
            onValueChange={(v) => onChange({ ...values, [f.key]: v })}
            placeholder="All"
            collapse={1}
            aria-label={f.label}
          />
        </div>
      ))}
      {children}
      {active ? (
        <Button variant="ghost" size="sm" className="mb-1 gap-1.5 text-muted-foreground" onClick={() => onChange({})}>
          <IconFilterOff className="size-4" /> Clear {active} filter{active > 1 ? "s" : ""}
        </Button>
      ) : null}
    </div>
  );
}
