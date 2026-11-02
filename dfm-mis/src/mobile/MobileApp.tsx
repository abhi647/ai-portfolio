import * as React from "react";
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { IconActivityHeartbeat, IconDots, IconLayoutDashboard, IconSparkles } from "@tabler/icons-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useApp } from "@/state/app";
import { DrillProvider } from "@/state/drill";
import { AIProvider } from "@/state/ai";
import Login from "@/pages/Login";
import { computeAlerts } from "@/data/insights";
import { trips } from "@/data/data";
import { tripEta } from "@/pages/trips/timeline";
import { cn } from "@/lib/utils";
import AskScreen from "./screens/Ask";
import MonitorScreen from "./screens/Monitor";
import BoardScreen from "./screens/Board";
import MoreScreen from "./screens/More";

// Same items as the Monitor "Needs attention" list: alerts plus the trips-behind-plan card.
const ALERT_COUNT = computeAlerts().length + (trips.some((t) => t.stage !== "epod_done" && tripEta(t)?.late) ? 1 : 0);

const TABS = [
  { to: "/", label: "Ask", icon: IconSparkles, end: true },
  { to: "/monitor", label: "Monitor", icon: IconActivityHeartbeat, badge: ALERT_COUNT },
  { to: "/board", label: "Board", icon: IconLayoutDashboard },
  { to: "/more", label: "More", icon: IconDots },
];

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

function LoginRoute() {
  const { user } = useApp();
  const loc = useLocation() as { state?: { from?: string } };
  return user ? <Navigate to={loc.state?.from || "/"} replace /> : <Login />;
}

/** Phone shell: content on top, a thumb-reachable tab bar at the bottom. */
function Shell() {
  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <div className="relative min-h-0 flex-1">
        <Outlet />
      </div>
      <nav aria-label="Main" className="pb-safe shrink-0 border-t border-border/60 bg-background/90 backdrop-blur-md">
        <ul className="m-0 grid list-none grid-cols-4 p-0">
          {TABS.map((t) => (
            <li key={t.to}>
              <NavLink to={t.to} end={t.end}
                className={({ isActive }) => cn("relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors", isActive ? "text-primary" : "text-muted-foreground")}>
                {({ isActive }) => (
                  <>
                    <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", isActive && "bg-primary/10")}>
                      <t.icon className="size-[22px]" stroke={isActive ? 2.1 : 1.7} />
                    </span>
                    {t.label}
                    {t.badge ? <span className="absolute top-1.5 left-1/2 ml-2.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] leading-4 text-white">{t.badge}</span> : null}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function Routed() {
  const { otif } = useApp();
  return (
    <DrillProvider otif={otif}>
      <AIProvider>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route element={<RequireAuth><Shell /></RequireAuth>}>
            <Route index element={<AskScreen />} />
            <Route path="monitor" element={<MonitorScreen />} />
            <Route path="board" element={<BoardScreen />} />
            <Route path="more" element={<MoreScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AIProvider>
    </DrillProvider>
  );
}

export default function MobileApp() {
  return (
    <AppProvider>
      <TooltipProvider delayDuration={300}>
        <BrowserRouter basename="/app">
          <Routed />
        </BrowserRouter>
      </TooltipProvider>
    </AppProvider>
  );
}
