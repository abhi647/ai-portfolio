import * as React from "react";
import { useNavigate } from "react-router-dom";
import { IconBell, IconChevronRight, IconDeviceDesktop, IconDownload, IconLogout, IconMoon, IconRefresh, IconSparkles, IconTrash } from "@tabler/icons-react";
import { StatusBadge } from "@/components/overtrue/status-badge";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/state/app";
import { useAI } from "@/state/ai";
import { computeAlerts } from "@/data/insights";
import { fdt, initials } from "@/data/format";
import { canInstall, install, isIOS, isStandalone, onInstallChange } from "../install";
import { ScreenHeader } from "./parts";

function Row({ icon: Icon, label, hint, right, onClick, href, danger }: { icon: React.ComponentType<{ className?: string }>; label: string; hint?: string; right?: React.ReactNode; onClick?: () => void; href?: string; danger?: boolean }) {
  const body = (
    <>
      <span className={"flex size-8 shrink-0 items-center justify-center rounded-lg " + (danger ? "bg-rose-500/10 text-rose-600" : "bg-muted text-foreground")}><Icon className="size-4" /></span>
      <span className="min-w-0 flex-1"><span className={"block text-[15px] " + (danger ? "text-rose-600" : "")}>{label}</span>{hint ? <span className="block truncate text-xs text-muted-foreground">{hint}</span> : null}</span>
      {right ?? (onClick || href ? <IconChevronRight className="size-4 text-muted-foreground" /> : null)}
    </>
  );
  const cls = "flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left";
  return <li>{href ? <a href={href} className={cls}>{body}</a> : onClick ? <button type="button" onClick={onClick} className={cls}>{body}</button> : <div className={cls}>{body}</div>}</li>;
}

export default function MoreScreen() {
  const { user, theme, setTheme, signOut, doSync, lastSync, sync, toast } = useApp();
  const ai = useAI()!;
  const nav = useNavigate();
  const [, force] = React.useState(0);
  React.useEffect(() => onInstallChange(() => force((n) => n + 1)), []);
  const installed = isStandalone();
  const alerts = computeAlerts();

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <ScreenHeader title="More" />
      <div className="flex flex-col gap-5 px-4 pt-4 pb-8">
        <div className="surface-card flex items-center gap-3 p-4">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground">{initials(user?.name ?? "U")}</span>
          <div className="min-w-0 flex-1"><div className="truncate font-semibold">{user?.name}</div><div className="truncate text-sm text-muted-foreground">{user?.email}</div></div>
          <StatusBadge variant={user?.role === "Admin" ? "warning" : "neutral"}>{user?.role}</StatusBadge>
        </div>

        <ul className="surface-card m-0 list-none divide-y divide-border/60 p-0">
          <Row icon={IconSparkles} label="Ask AI engine" hint={ai.configured ? `Claude (${ai.model ?? "claude-opus-5-5"})` : "Offline mode — common questions only"} right={<StatusBadge variant={ai.configured ? "success" : "warning"}>{ai.configured ? "Claude" : "Offline"}</StatusBadge>} />
          <Row icon={IconBell} label="Alerts" hint={`${alerts.length} need attention`} onClick={() => nav("/monitor")} />
          <Row icon={IconRefresh} label={sync === "syncing" ? "Syncing…" : "Sync data now"} hint={`Last synced ${fdt(lastSync)}`} onClick={doSync} />
          <Row icon={IconMoon} label="Dark mode" right={<Switch checked={theme === "dark"} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} aria-label="Dark mode" />} />
        </ul>

        <ul className="surface-card m-0 list-none divide-y divide-border/60 p-0">
          {!installed && canInstall() ? <Row icon={IconDownload} label="Install app" hint="Add DFM MIS to your home screen" onClick={async () => { if (await install()) toast("App installed"); }} /> : null}
          {!installed && !canInstall() && isIOS() ? <Row icon={IconDownload} label="Install on iPhone" hint="Safari → Share → Add to Home Screen" /> : null}
          {installed ? <Row icon={IconDownload} label="Installed" hint="Running as an app" /> : null}
          <Row icon={IconDeviceDesktop} label="Open desktop dashboard" hint="Full analytics, every view" href="/" />
          <Row icon={IconTrash} label="Clear conversation" onClick={() => { ai.newChat(); toast("Conversation cleared", "info"); }} />
        </ul>

        <ul className="surface-card m-0 list-none p-0">
          <Row icon={IconLogout} label="Sign out" danger onClick={() => { signOut(); nav("/login"); }} />
        </ul>
        <p className="m-0 text-center text-xs text-muted-foreground">DFM Foods MIS · prototype with dummy data</p>
      </div>
    </div>
  );
}
