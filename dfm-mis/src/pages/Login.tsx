import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  IconArrowLeft, IconArrowRight, IconBrandWindows, IconCheck, IconLoader2, IconLock, IconMail, IconMoon,
  IconShieldCheck, IconSun, IconTruckDelivery,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Steps } from "@/components/overtrue/steps";
import { Sparkline } from "@/components/overtrue/trend-sparkline";
import { NumberTicker } from "@/components/overtrue/number-ticker";
import { StatusBadge } from "@/components/overtrue/status-badge";
import { DistributionBar } from "@/components/overtrue/distribution-bar";
import { useApp } from "@/state/app";
import { TSTAGES, today0, trips } from "@/data/data";
import { DAY, fmtN } from "@/data/format";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/app/brand";

const DEMO_CODE = "482915";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Login() {
  const { signIn, theme, setTheme, users } = useApp();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [step, setStep] = React.useState<"email" | "otp" | "done">("email");
  const [email, setEmail] = React.useState("priya.verma@company.in");
  const [emailError, setEmailError] = React.useState("");
  const [code, setCode] = React.useState<string[]>(Array(6).fill(""));
  const [codeError, setCodeError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const [resendIn, setResendIn] = React.useState(0);
  const inputs = React.useRef<(HTMLInputElement | null)[]>([]);

  React.useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  const known = users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase());

  const sendCode = (e?: React.FormEvent) => {
    e?.preventDefault();
    const v = email.trim();
    if (!EMAIL_RE.test(v)) { setEmailError("Enter a valid work email, like name@company.in"); return; }
    setEmailError("");
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false); setStep("otp"); setResendIn(30); setCode(Array(6).fill(""));
      window.setTimeout(() => inputs.current[0]?.focus(), 30);
    }, 700);
  };

  const verify = (digits = code) => {
    if (digits.some((d) => !d)) { setCodeError("Enter all six digits"); return; }
    setCodeError("");
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false); setStep("done");
      window.setTimeout(() => { signIn(email.trim().toLowerCase(), remember); nav(loc.state?.from || "/", { replace: true }); }, 900);
    }, 800);
  };

  const setDigit = (i: number, raw: string) => {
    const chars = raw.replace(/\D/g, "");
    if (chars.length > 1) {
      const next = [...code];
      chars.slice(0, 6 - i).split("").forEach((c, k) => (next[i + k] = c));
      setCode(next);
      const focus = Math.min(5, i + chars.length);
      inputs.current[focus]?.focus();
      if (next.every(Boolean)) verify(next);
      return;
    }
    const next = [...code]; next[i] = chars; setCode(next); setCodeError("");
    if (chars && i < 5) inputs.current[i + 1]?.focus();
    if (chars && i === 5 && next.every(Boolean)) verify(next);
  };

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />

      <main className="relative flex flex-col px-5 py-6 sm:px-10">
        <div className="relative -mx-5 -mt-6 mb-2 h-40 overflow-hidden sm:-mx-10 lg:hidden">
          <img src="/brand/dfm-factory.webp" alt="CRAX Rings on a DFM Foods production line" className="size-full object-cover" />
          <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,var(--color-background)_100%)]" />
        </div>
        <div className="flex items-center justify-between">
          <div className="lg:invisible"><BrandMark /></div>
          <Button variant="ghost" size="icon-sm" aria-label="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <IconSun className="size-4" /> : <IconMoon className="size-4" />}
          </Button>
        </div>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <Steps steps={["Work email", "Verify", "Signed in"]} current={step === "email" ? 0 : step === "otp" ? 1 : 2} className="mb-8" />

          {step === "email" && (
            <form onSubmit={sendCode} noValidate className="animate-rise">
              <h1 className="m-0 text-[28px] font-semibold tracking-[-0.04em]">Welcome back</h1>
              <p className="m-0 mt-1.5 text-[15px] leading-6 text-muted-foreground">Sign in to the DFM Foods MIS with your company email. We’ll send a one-time code — no password needed.</p>

              <div className="mt-7 space-y-2">
                <Label htmlFor="email">Work email</Label>
                <div className="relative">
                  <IconMail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" autoComplete="email" autoFocus value={email} aria-invalid={!!emailError} aria-describedby="email-help"
                    onChange={(e) => { setEmail(e.target.value); setEmailError(""); }} className={cn("pl-9", emailError && "border-destructive")} placeholder="name@company.in" />
                </div>
                <p id="email-help" className={cn("m-0 text-xs", emailError ? "text-destructive" : "text-muted-foreground")}>
                  {emailError || (known ? "Account found · access to " + countAccess(users.find((u) => u.email === email.trim().toLowerCase())?.access) + " dashboards" : "Use the email your admin invited")}
                </p>
              </div>

              <Button type="submit" size="lg" className="mt-6 w-full gap-2" disabled={busy}>
                {busy ? <IconLoader2 className="size-4 animate-spin" /> : null}
                {busy ? "Sending code…" : "Send one-time code"}
                {!busy ? <IconArrowRight className="size-4" /> : null}
              </Button>

              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
              </div>
              <Button type="button" variant="outline" size="lg" className="w-full gap-2" onClick={() => { setEmail("priya.verma@company.in"); setStep("otp"); setResendIn(30); window.setTimeout(() => inputs.current[0]?.focus(), 30); }}>
                <IconBrandWindows className="size-4" /> Continue with company SSO
              </Button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="animate-rise">
              <button type="button" onClick={() => setStep("email")} className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
                <IconArrowLeft className="size-4" /> Use a different email
              </button>
              <h1 className="m-0 text-[28px] font-semibold tracking-[-0.04em]">Check your inbox</h1>
              <p className="m-0 mt-1.5 text-[15px] leading-6 text-muted-foreground">
                We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>. It expires in 10 minutes.
              </p>

              <fieldset className="mt-7">
                <legend className="mb-2 text-[13px] font-medium">Verification code</legend>
                <div className="flex gap-2" onPaste={(e) => { const t = e.clipboardData.getData("text"); if (/\d{2,}/.test(t)) { e.preventDefault(); setDigit(0, t); } }}>
                  {code.map((d, i) => (
                    <input key={i} ref={(el) => { inputs.current[i] = el; }} value={d} inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} maxLength={6}
                      aria-label={`Digit ${i + 1}`}
                      onChange={(e) => setDigit(i, e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Backspace" && !code[i] && i > 0) inputs.current[i - 1]?.focus(); if (e.key === "ArrowLeft" && i > 0) inputs.current[i - 1]?.focus(); if (e.key === "ArrowRight" && i < 5) inputs.current[i + 1]?.focus(); }}
                      className={cn("h-14 w-full min-w-0 rounded-xl border border-input bg-card text-center font-mono text-xl font-semibold tabular-nums shadow-xs outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-4 focus:ring-primary/15",
                        d && "border-primary/50", codeError && !d && "border-destructive")} />
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className={codeError ? "text-destructive" : "text-muted-foreground"}>{codeError || "Tip: paste the whole code into any box"}</span>
                  <button type="button" className="font-medium text-primary hover:underline" onClick={() => { setCode(DEMO_CODE.split("")); setCodeError(""); }}>Autofill demo code</button>
                </div>
              </fieldset>

              <label className="mt-5 flex cursor-pointer items-center gap-2.5 text-[13px]">
                <Checkbox checked={remember} onCheckedChange={setRemember} aria-label="Trust this device for 30 days" />
                Trust this device for 30 days
              </label>

              <Button type="submit" size="lg" className="mt-6 w-full gap-2" disabled={busy}>
                {busy ? <IconLoader2 className="size-4 animate-spin" /> : <IconLock className="size-4" />}
                {busy ? "Verifying…" : "Verify & sign in"}
              </Button>
              <p className="m-0 mt-4 text-center text-[13px] text-muted-foreground">
                Didn’t get it?{" "}
                {resendIn > 0 ? <span className="tabular-nums">Resend in 0:{String(resendIn).padStart(2, "0")}</span> : <button type="button" className="font-medium text-primary hover:underline" onClick={() => setResendIn(30)}>Resend code</button>}
              </p>
            </form>
          )}

          {step === "done" && (
            <div role="status" className="animate-rise text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 ring-8 ring-emerald-500/5 dark:text-emerald-400">
                <IconCheck className="size-7" />
              </span>
              <h1 className="m-0 mt-5 text-[26px] font-semibold tracking-[-0.04em]">You’re in</h1>
              <p className="m-0 mt-1.5 text-muted-foreground">Loading your dashboards…</p>
              <IconLoader2 className="mx-auto mt-5 size-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><IconShieldCheck className="size-4" /> SSO · OTP · Role-based access</span>
          <span>Prototype · dummy data · any 6-digit code works</span>
        </footer>
      </main>
    </div>
  );
}

function countAccess(a?: Record<string, boolean>) { return a ? Object.values(a).filter(Boolean).length : 0; }

/* ---------- Left brand panel with a live preview made of library components ---------- */
function BrandPanel() {
  const days = Array.from({ length: 21 }, (_, i) => new Date(+today0 - (20 - i) * DAY));
  const series = days.map((d) => trips.filter((t) => t.ms.gateOut && t.ms.gateOut >= d && +t.ms.gateOut < +d + DAY).length);
  const active = trips.filter((t) => t.stage !== "epod_done");
  const segs = TSTAGES.slice(0, 7).map((s) => ({ name: s.label, value: active.filter((t) => t.stage === s.key).length, color: s.color }));
  const wk = series.slice(-7).reduce((a, b) => a + b, 0), pw = series.slice(-14, -7).reduce((a, b) => a + b, 0);
  return (
    <aside className="relative hidden overflow-hidden bg-[#0b0d12] p-10 text-white lg:flex lg:flex-col dark">
      <img src="/brand/dfm-factory.webp" alt="" aria-hidden className="pointer-events-none absolute inset-0 size-full scale-105 object-cover" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(8_10_14/0.55)_0%,rgb(8_10_14/0.35)_30%,rgb(8_10_14/0.82)_62%,rgb(8_10_14/0.96)_100%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_10%_0%,rgb(226_0_26/0.28),transparent_70%)]" />
      <div className="relative flex items-center justify-between">
        <BrandMark inverted />
        <span className="rounded-full bg-black/35 px-3 py-1 text-[11px] text-white/80 ring-1 ring-white/15 backdrop-blur">Inside a DFM Foods plant · CRAX Rings</span>
      </div>

      <div className="relative mt-auto max-w-[520px]">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/20 backdrop-blur"><span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />Live from Traqo TMS · DMS · ERP</span>
        <h2 className="m-0 text-[44px] leading-[1.05] font-semibold tracking-[-0.045em]">
          Every truck, order<br />and rupee — <span className="text-primary">in one view.</span>
        </h2>
        <p className="m-0 mt-4 max-w-md text-[15px] leading-6 text-white/65">Supply, sales and finance analytics for DFM Foods. Spot delays before they cost you, and drill from any number to the trip behind it.</p>

        <div className="mt-9 grid grid-cols-[1.2fr_1fr] gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] backdrop-blur">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span className="inline-flex items-center gap-1.5"><IconTruckDelivery className="size-4" /> Dispatches · last 7 days</span>
              <span className="tabular-nums">{fmtN(pw)} prior week</span>
            </div>
            <div className="mt-1 text-3xl font-semibold tracking-[-0.035em] tabular-nums"><NumberTicker value={wk} animateOnMount /></div>
            <Sparkline data={series} className="mt-2 h-14" color="var(--color-primary)" />
          </div>
          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] backdrop-blur">
            <span className="text-xs text-white/60">Active trips right now</span>
            <div className="text-3xl font-semibold tracking-[-0.035em] tabular-nums"><NumberTicker value={active.length} animateOnMount /></div>
            <DistributionBar segments={segs} showLegend={false} />
          </div>
        </div>
      </div>
      <p className="relative m-0 mt-10 text-xs text-white/40">© DFM Foods · MIS Tool · Data refreshes every 15 minutes</p>
    </aside>
  );
}
