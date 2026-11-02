import * as React from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  IconChevronRight, IconLayoutList, IconLayoutRows, IconLogout, IconMoon, IconRefresh, IconSearch, IconSparkles, IconSun, IconCheck, IconAlertTriangle, IconInfoCircle, IconX,
} from "@tabler/icons-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu,
  SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarProvider,
  SidebarRail, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CommandPalette, type CommandPaletteGroup } from "@/components/overtrue/command-palette";
import { NotificationCenterPopover, type NotificationItem } from "@/components/overtrue/notification-center";
import { StatusBadge } from "@/components/overtrue/status-badge";
import { BrandMark } from "./brand";
import { MODULES, moduleFor } from "@/nav";
import { useApp } from "@/state/app";
import { computeAlerts } from "@/data/insights";
import { orders, trips, NOW } from "@/data/data";
import { fdt, initials } from "@/data/format";
import { useDrill } from "@/state/drill";
import { useAI } from "@/state/ai";
import { AskSheet } from "@/components/ai/AskSheet";
import { cn } from "@/lib/utils";

const ALERTS = computeAlerts();

export function AppShell() {
  const { user, theme, setTheme, density, setDensity, signOut, sync, doSync, lastSync, toasts, commandOpen, setCommandOpen } = useApp();
  const loc = useLocation();
  const nav = useNavigate();
  const ai = useAI();
  const mod = moduleFor(loc.pathname);
  const tab = mod.tabs?.find((t) => loc.pathname.endsWith("/" + t.id));
  const visible = MODULES.filter((m) => !m.access || user?.access[m.access] || user?.role === "Admin").filter((m) => m.id !== "settings" || user?.role === "Admin");
  const groups = [...new Set(visible.map((m) => m.group))];

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCommandOpen(true); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") { e.preventDefault(); ai?.setOpen(!ai.open); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen, ai]);

  React.useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);

  const [notes, setNotes] = React.useState<NotificationItem[]>(() =>
    ALERTS.map((a) => ({ id: a.id, title: a.title, body: a.body, time: a.time, kind: a.kind, read: false, href: a.href })),
  );

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="px-3 pt-4 pb-2">
          <Link to="/" className="flex items-center rounded-md p-1 group-data-[collapsible=icon]:p-0"><BrandMark className="group-data-[collapsible=icon]:[&>span:last-child]:hidden group-data-[collapsible=icon]:[&>img]:h-7" /></Link>
        </SidebarHeader>
        <SidebarContent className="scrollbar-thin">
          {groups.map((g) => (
            <SidebarGroup key={g}>
              <SidebarGroupLabel>{g}</SidebarGroupLabel>
              <SidebarMenu>
                {visible.filter((m) => m.group === g).map((m) => {
                  const active = mod.id === m.id;
                  const alertCount = m.id === "trips" ? ALERTS.filter((a) => a.href.startsWith("/trips")).length : m.id === "orders" ? ALERTS.filter((a) => a.href.startsWith("/orders")).length : 0;
                  return (
                    <SidebarMenuItem key={m.id}>
                      <SidebarMenuButton asChild isActive={active} tooltip={m.label}>
                        <NavLink to={m.tabs ? `${m.path}/${m.tabs[0].id}` : m.path} end={m.path === "/"}>
                          <m.icon className="size-4" />
                          <span>{m.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                      {alertCount ? <SidebarMenuBadge className="bg-rose-500/10 text-rose-700 dark:text-rose-400">{alertCount}</SidebarMenuBadge> : null}
                      {active && m.tabs ? (
                        <SidebarMenuSub>
                          {m.tabs.map((t) => (
                            <SidebarMenuSubItem key={t.id}>
                              <SidebarMenuSubButton asChild isActive={tab?.id === t.id}>
                                <NavLink to={`${m.path}/${t.id}`}><span>{t.label}</span></NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="p-3 group-data-[collapsible=icon]:p-2">
          <div className="inset-panel flex items-center gap-2 p-2.5 text-xs group-data-[collapsible=icon]:hidden">
            <StatusBadge variant={sync === "syncing" ? "info" : "success"} live={sync === "syncing"}>{sync === "syncing" ? "Syncing" : "Synced"}</StatusBadge>
            <span className="truncate text-muted-foreground">{fdt(lastSync)}</span>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 bg-background">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur-md sm:px-5">
          <SidebarTrigger className="-ml-1" />
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-[13px] text-muted-foreground">
            <Link to="/" className="hidden hover:text-foreground sm:inline">Home</Link>
            {mod.id !== "home" && (<><IconChevronRight className="hidden size-3.5 sm:inline" /><Link to={mod.tabs ? `${mod.path}/${mod.tabs[0].id}` : mod.path} className="truncate hover:text-foreground">{mod.label}</Link></>)}
            {tab && (<><IconChevronRight className="size-3.5" /><span className="truncate font-medium text-foreground">{tab.label}</span></>)}
            {mod.id === "home" && <><IconChevronRight className="hidden size-3.5 sm:inline" /><span className="font-medium text-foreground">Hub</span></>}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            {loc.pathname !== "/ask" ? (
              <Button size="sm" onClick={() => ai?.setOpen(true)} className="gap-1.5 shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-primary)_14%,transparent)]" aria-label="Ask AI (Ctrl+J)">
                <IconSparkles className="size-4" /><span className="hidden sm:inline">Ask AI</span>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setCommandOpen(true)} className="hidden w-56 justify-start gap-2 text-muted-foreground md:flex">
              <IconSearch className="size-4" /> Search trips, orders, pages
              <kbd className="ml-auto rounded border border-border bg-muted px-1.5 font-mono text-[10px]">⌘K</kbd>
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Search" className="md:hidden" onClick={() => setCommandOpen(true)}><IconSearch className="size-4" /></Button>
            <Button variant="ghost" size="sm" onClick={doSync} disabled={sync === "syncing"} className="gap-1.5" aria-label="Sync data now">
              <IconRefresh className={cn("size-4", sync === "syncing" && "animate-spin")} />
              <span className="hidden lg:inline">{sync === "syncing" ? "Syncing…" : "Sync"}</span>
            </Button>
            <NotificationCenterPopover
              notifications={notes}
              onNotificationsChange={(n) => setNotes(n)}
              now={NOW}
              heading="Needs attention"
              onOpen={(n) => n.href && nav(n.href)}
            />
            <Button variant="ghost" size="icon-sm" aria-label={density === "compact" ? "Switch to comfortable layout" : "Switch to compact layout"} title={density === "compact" ? "Compact layout · click for comfortable" : "Comfortable layout · click for compact"} aria-pressed={density === "compact"}
              onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}>
              {density === "compact" ? <IconLayoutList className="size-4" /> : <IconLayoutRows className="size-4" />}
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <IconSun className="size-4" /> : <IconMoon className="size-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Account" className="ml-1 flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground ring-2 ring-background">
                  {initials(user?.name ?? "U")}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm font-semibold">{user?.name}</div>
                  <div className="text-xs text-muted-foreground">{user?.email}</div>
                  <StatusBadge variant={user?.role === "Admin" ? "warning" : "neutral"} className="mt-2">{user?.role}</StatusBadge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user?.role === "Admin" && <DropdownMenuItem onSelect={() => nav("/settings/users")}>Manage users</DropdownMenuItem>}
                <DropdownMenuItem onSelect={() => setTheme(theme === "dark" ? "light" : "dark")}>Switch to {theme === "dark" ? "light" : "dark"} mode</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDensity(density === "compact" ? "comfortable" : "compact")}>{density === "compact" ? "Comfortable layout" : "Compact (data-dense) layout"}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { window.location.href = "/app/"; }}>Open phone app (Ask AI first)</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => { signOut(); nav("/login"); }}><IconLogout className="size-4" /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div data-slot="app-content" className="mx-auto w-full max-w-[1760px] min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </SidebarInset>

      <Command open={commandOpen} onOpenChange={setCommandOpen} visible={visible} />
      <AskSheet />
      <Toasts toasts={toasts} />
    </SidebarProvider>
  );
}

function Command({ open, onOpenChange, visible }: { open: boolean; onOpenChange: (v: boolean) => void; visible: typeof MODULES }) {
  const nav = useNavigate();
  const { openTrip, openOrders } = useDrill();
  const { theme, setTheme, doSync } = useApp();
  const groups: CommandPaletteGroup[] = [
    {
      heading: "Dashboards",
      items: visible.flatMap((m) => [
        { id: m.id, label: m.label, description: m.description, icon: <m.icon className="size-4" />, keywords: [m.group], onSelect: () => nav(m.tabs ? `${m.path}/${m.tabs[0].id}` : m.path) },
        ...(m.tabs ?? []).slice(1).map((t) => ({ id: `${m.id}-${t.id}`, label: `${m.label} › ${t.label}`, description: t.description, icon: <m.icon className="size-4" />, onSelect: () => nav(`${m.path}/${t.id}`) })),
      ]),
    },
    {
      heading: "Recent trips",
      items: trips.slice(-40).reverse().map((t) => ({ id: t.id, label: `${t.id} · ${t.dest}`, description: `${t.vno} · ${t.transporter}`, keywords: [t.vno, t.transporter, t.customer], onSelect: () => openTrip(t) })),
    },
    {
      heading: "Recent orders",
      items: orders.slice(0, 30).map((o) => ({ id: o.no, label: o.no, description: `${o.dest} · ${o.customer}`, keywords: [o.dest, o.customer], onSelect: () => openOrders(o.no, [o]) })),
    },
    {
      heading: "Actions",
      items: [
        { id: "sync", label: "Sync data now", icon: <IconRefresh className="size-4" />, onSelect: doSync },
        { id: "theme", label: `Switch to ${theme === "dark" ? "light" : "dark"} mode`, icon: theme === "dark" ? <IconSun className="size-4" /> : <IconMoon className="size-4" />, onSelect: () => setTheme(theme === "dark" ? "light" : "dark") },
      ],
    },
  ];
  return <CommandPalette open={open} onOpenChange={onOpenChange} groups={groups} placeholder="Search dashboards, trip IDs, vehicles, orders…" title="Search" size="wide" />;
}

function Toasts({ toasts }: { toasts: { id: number; title: string; tone?: string }[] }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div key={t.id} className="animate-rise pointer-events-auto flex items-center gap-2.5 rounded-xl border border-border/70 bg-popover/90 px-4 py-2.5 text-sm text-popover-foreground shadow-xl backdrop-blur-md">
          {t.tone === "error" ? <IconX className="size-4 text-rose-500" /> : t.tone === "warning" ? <IconAlertTriangle className="size-4 text-amber-500" /> : t.tone === "info" ? <IconInfoCircle className="size-4 text-primary" /> : <IconCheck className="size-4 text-emerald-500" />}
          {t.title}
        </div>
      ))}
    </div>
  );
}
