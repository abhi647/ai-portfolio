import * as React from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useApp } from "@/state/app";
import { DrillProvider } from "@/state/drill";
import { AIProvider } from "@/state/ai";
import { DashboardsProvider } from "@/state/dashboards";
import { AppShell } from "@/components/app/shell";
import Login from "@/pages/Login";
import Home from "@/pages/Home";

const Trips = React.lazy(() => import("@/pages/trips/Trips"));
const Orders = React.lazy(() => import("@/pages/orders/Orders"));
const Sales = React.lazy(() => import("@/pages/sales/Sales"));
const Cfa = React.lazy(() => import("@/pages/Cfa"));
const Pnl = React.lazy(() => import("@/pages/Pnl"));
const Settings = React.lazy(() => import("@/pages/settings/Settings"));
const Ask = React.lazy(() => import("@/pages/Ask"));
const Forecasts = React.lazy(() => import("@/pages/Forecasts"));
const Explore = React.lazy(() => import("@/pages/Explore"));
const Dashboards = React.lazy(() => import("@/pages/dashboards/Dashboards"));
const DashboardPage = React.lazy(() => import("@/pages/dashboards/Dashboard"));
const ImportDashboard = React.lazy(() => import("@/pages/dashboards/Dashboards").then((m) => ({ default: m.ImportDashboard })));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

function RequireAccess({ access, admin, children }: { access?: string; admin?: boolean; children: React.ReactNode }) {
  const { user } = useApp();
  const ok = user?.role === "Admin" || (!admin && (!access || user?.access[access]));
  if (!ok) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function BackToApp() {
  const loc = useLocation() as { state?: { from?: string } };
  return <Navigate to={loc.state?.from || "/"} replace />;
}

function Loading() {
  return <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">Loading dashboard…</div>;
}

function Routed() {
  const { otif, user } = useApp();
  return (
    <DrillProvider otif={otif}>
     <AIProvider>
     <DashboardsProvider>
      <Routes>
        <Route path="/login" element={user ? <BackToApp /> : <Login />} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<Home />} />
          <Route path="overview" element={<Navigate to="/" replace />} />
          <Route path="ask" element={<React.Suspense fallback={<Loading />}><Ask /></React.Suspense>} />
          <Route path="dashboards" element={<React.Suspense fallback={<Loading />}><Dashboards /></React.Suspense>} />
          <Route path="dashboards/import" element={<React.Suspense fallback={<Loading />}><ImportDashboard /></React.Suspense>} />
          <Route path="dashboards/:id" element={<React.Suspense fallback={<Loading />}><DashboardPage /></React.Suspense>} />
          <Route path="forecasts" element={<React.Suspense fallback={<Loading />}><Forecasts /></React.Suspense>} />
          <Route path="explore" element={<Navigate to="/explore/pivot" replace />} />
          <Route path="explore/:tab" element={<React.Suspense fallback={<Loading />}><Explore /></React.Suspense>} />
          <Route path="trips" element={<Navigate to="/trips/live" replace />} />
          <Route path="trips/:tab" element={<RequireAccess access="trip"><React.Suspense fallback={<Loading />}><Trips /></React.Suspense></RequireAccess>} />
          <Route path="orders" element={<Navigate to="/orders/live" replace />} />
          <Route path="orders/:tab" element={<RequireAccess access="order"><React.Suspense fallback={<Loading />}><Orders /></React.Suspense></RequireAccess>} />
          <Route path="sales" element={<Navigate to="/sales/team" replace />} />
          <Route path="sales/:tab" element={<RequireAccess access="sales"><React.Suspense fallback={<Loading />}><Sales /></React.Suspense></RequireAccess>} />
          <Route path="cfa" element={<RequireAccess access="secondary"><React.Suspense fallback={<Loading />}><Cfa /></React.Suspense></RequireAccess>} />
          <Route path="pnl" element={<RequireAccess access="fin"><React.Suspense fallback={<Loading />}><Pnl /></React.Suspense></RequireAccess>} />
          <Route path="settings" element={<Navigate to="/settings/users" replace />} />
          <Route path="settings/:tab" element={<RequireAccess admin><React.Suspense fallback={<Loading />}><Settings /></React.Suspense></RequireAccess>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
     </DashboardsProvider>
     </AIProvider>
    </DrillProvider>
  );
}

export default function App() {
  return (
    <AppProvider>
      <TooltipProvider delayDuration={200}>
        <BrowserRouter>
          <Routed />
        </BrowserRouter>
      </TooltipProvider>
    </AppProvider>
  );
}
