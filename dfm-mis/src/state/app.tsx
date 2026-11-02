import * as React from "react";
import { INITIAL_USERS, NOW, type User } from "@/data/data";

const store = {
  get(k: string) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string | null) { try { if (v == null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

export type Theme = "light" | "dark";
export type Density = "compact" | "comfortable";
export interface Toast { id: number; title: string; tone?: "success" | "info" | "warning" | "error" }

interface AppState {
  user: User | null;
  signIn: (email: string, remember: boolean) => void;
  signOut: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  density: Density;
  setDensity: (d: Density) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  otif: { green: number; amber: number };
  setOtif: (v: { green: number; amber: number }) => void;
  refresh: Record<string, number>;
  setRefresh: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  sync: "idle" | "syncing" | "done";
  lastSync: Date;
  doSync: () => void;
  toasts: Toast[];
  toast: (title: string, tone?: Toast["tone"]) => void;
  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;
}

const Ctx = React.createContext<AppState | null>(null);
export const useApp = () => {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = React.useState(INITIAL_USERS);
  const [email, setEmail] = React.useState<string | null>(() => store.get("dfm.session") ?? sessionStorageGet());
  const [theme, setThemeState] = React.useState<Theme>(() => (store.get("dfm.theme") as Theme) || (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  const [density, setDensityState] = React.useState<Density>(() => (store.get("dfm.density") as Density) || "compact");
  const [otif, setOtif] = React.useState({ green: 95, amber: 85 });
  const [refresh, setRefresh] = React.useState<Record<string, number>>({ sales: 30, trip: 15, order: 15 });
  const [sync, setSync] = React.useState<AppState["sync"]>("idle");
  const [lastSync, setLastSync] = React.useState(new Date(+NOW - (NOW.getMinutes() % 15) * 60e3));
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [commandOpen, setCommandOpen] = React.useState(false);

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  React.useEffect(() => { document.documentElement.dataset.density = density; }, [density]);

  const toast = React.useCallback((title: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, title, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  const user = email ? users.find((u) => u.email === email) ?? { ...users[0], email, name: nameFromEmail(email) } : null;

  const value: AppState = {
    user,
    signIn: (e, remember) => {
      setEmail(e);
      if (remember) store.set("dfm.session", e);
      else try { window.sessionStorage.setItem("dfm.session", e); } catch { /* ignore */ }
    },
    signOut: () => { setEmail(null); store.set("dfm.session", null); try { window.sessionStorage.removeItem("dfm.session"); } catch { /* ignore */ } },
    theme,
    setTheme: (t) => { setThemeState(t); store.set("dfm.theme", t); },
    density,
    setDensity: (d) => { setDensityState(d); store.set("dfm.density", d); },
    users, setUsers, otif, setOtif, refresh, setRefresh, sync, lastSync,
    doSync: () => {
      if (sync === "syncing") return;
      setSync("syncing");
      window.setTimeout(() => { setSync("done"); setLastSync(new Date(+NOW)); toast("Synced 8 of 8 source tables"); }, 1800);
    },
    toasts, toast, commandOpen, setCommandOpen,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function sessionStorageGet() { try { return window.sessionStorage.getItem("dfm.session"); } catch { return null; } }
function nameFromEmail(e: string) {
  return e.split("@")[0].split(/[._-]/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join(" ") || e;
}

/** Simple keyed UI state shared within a module (filters, selections). */
export function usePersistentState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [v, setV] = React.useState<T>(() => {
    const raw = store.get("dfm.ui." + key);
    if (raw) { try { return JSON.parse(raw) as T; } catch { /* ignore */ } }
    return initial;
  });
  React.useEffect(() => { store.set("dfm.ui." + key, JSON.stringify(v)); }, [key, v]);
  return [v, setV];
}
