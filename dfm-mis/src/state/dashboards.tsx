import * as React from "react";
import { useApp } from "@/state/app";
import { TEMPLATES, fromTemplate, wid, type DashboardDef, type Widget } from "@/data/presets";

interface DashState {
  dashboards: DashboardDef[];
  get: (id: string) => DashboardDef | undefined;
  create: (d: DashboardDef) => string;
  update: (id: string, fn: (d: DashboardDef) => DashboardDef) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => string | undefined;
  /** Adds a widget to a dashboard (or to the most recent one, creating "My dashboard" if needed). Returns the dashboard id. */
  addWidgetToDashboard: (id: string | null, w: Omit<Widget, "id">) => string;
  resetTemplates: () => void;
}

const Ctx = React.createContext<DashState | null>(null);
/** Null outside the desktop app (e.g. the phone app has no dashboard builder). */
export const useDashboardsOptional = () => React.useContext(Ctx);
export const useDashboards = () => {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useDashboards outside provider");
  return v;
};

const read = (k: string): DashboardDef[] | null => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as DashboardDef[]) : null; } catch { return null; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };
const seed = () => TEMPLATES.map((t) => fromTemplate(t));

export function DashboardsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  const key = `dfm.dashboards.v1.${user?.email ?? "anon"}`;
  const [dashboards, setDashboards] = React.useState<DashboardDef[]>(() => read(key) ?? seed());
  const loaded = React.useRef(key);
  React.useEffect(() => {
    if (loaded.current !== key) { loaded.current = key; setDashboards(read(key) ?? seed()); return; }
    write(key, dashboards);
  }, [key, dashboards]);

  const value = React.useMemo<DashState>(() => {
    const touch = (d: DashboardDef) => ({ ...d, updatedAt: Date.now() });
    return {
      dashboards,
      get: (id) => dashboards.find((d) => d.id === id),
      create: (d) => { setDashboards((ds) => [d, ...ds]); return d.id; },
      update: (id, fn) => setDashboards((ds) => ds.map((d) => (d.id === id ? touch(fn(d)) : d))),
      remove: (id) => setDashboards((ds) => ds.filter((d) => d.id !== id)),
      duplicate: (id) => {
        const src = dashboards.find((d) => d.id === id);
        if (!src) return undefined;
        const copy: DashboardDef = { ...src, id: `d${Date.now().toString(36)}`, name: `${src.name} (copy)`, widgets: src.widgets.map((w) => ({ ...w, id: wid() })), createdAt: Date.now(), updatedAt: Date.now() };
        setDashboards((ds) => [copy, ...ds]);
        return copy.id;
      },
      addWidgetToDashboard: (id, w) => {
        const target = id ? dashboards.find((d) => d.id === id) : [...dashboards].sort((a, b) => b.updatedAt - a.updatedAt)[0];
        const widget = { ...w, id: wid() } as Widget;
        if (target) {
          setDashboards((ds) => ds.map((d) => (d.id === target.id ? touch({ ...d, widgets: [...d.widgets, widget] }) : d)));
          return target.id;
        }
        const d: DashboardDef = { id: `d${Date.now().toString(36)}`, name: "My dashboard", widgets: [widget], filters: [], createdAt: Date.now(), updatedAt: Date.now() };
        setDashboards((ds) => [d, ...ds]);
        return d.id;
      },
      resetTemplates: () => setDashboards((ds) => [...seed(), ...ds.filter((d) => !d.template)]),
    };
  }, [dashboards]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
