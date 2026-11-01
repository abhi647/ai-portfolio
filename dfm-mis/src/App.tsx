import * as React from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useApp } from "@/state/app";
import { DrillProvider } from "@/state/drill";
import { AppShell } from "@/components/app/shell";
import Login from "@/pages/Login";
import Home from "@/pages/Home";

const Trips = React.lazy(() => import("@/pages/trips/Trips"));
const Orders = React.lazy(() => import("@/pages/orders/Orders"));
const Sales = React.lazy(() => import("@/pages/sales/Sales"));
const Cfa = React.lazy(() => import("@/pages/Cfa"));
const Pnl = React.lazy(() => import("@/pages/Pnl"));
const Settings = React.lazy(() => import("@/pages/settings/Settings"));

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
      <Routes>
        <Route path="/login" element={user ? <BackToApp /> : <Login />} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<Home />} />
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
