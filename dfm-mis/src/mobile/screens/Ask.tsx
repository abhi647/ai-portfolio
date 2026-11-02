import * as React from "react";
import { IconChartBar, IconClipboardList, IconMicrophone, IconPlayerStopFilled, IconReportMoney, IconBuildingWarehouse, IconTruck, IconShare2, IconX } from "@tabler/icons-react";
import { StatusBadge } from "@/components/overtrue/status-badge";
import { Conversation } from "@/components/ai/Conversation";
import { useAI } from "@/state/ai";
import { useApp } from "@/state/app";
import { CUR_MONTH, NOW, orders, trips } from "@/data/data";
import { sum } from "@/data/format";
import { monthContext } from "@/data/sales";
import { tripEta } from "@/pages/trips/timeline";
import { isIOS, isStandalone } from "../install";
import { cn } from "@/lib/utils";

const SUGGESTIONS: { q: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { q: "Which transporters cost the most per km?", icon: IconTruck },
  { q: "OTIF by destination this month", icon: IconClipboardList },
  { q: "Top 5 ASMs by achievement", icon: IconChartBar },
  { q: "Detention rate by month", icon: IconTruck },
  { q: "Material margin % by account", icon: IconReportMoney },
  { q: "CFA throughput by day", icon: IconBuildingWarehouse },
];

/** Browser speech-to-text, where the phone supports it (Chrome on Android, Safari on iOS 14.5+). */
type Recognition = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void };
function useSpeech(onText: (t: string) => void) {
  const Ctor = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
  const [listening, setListening] = React.useState(false);
  const rec = React.useRef<Recognition | null>(null);
  const start = () => {
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-IN"; r.interimResults = true; r.continuous = false;
    r.onresult = (e) => onText(Array.from(e.results).map((x) => x[0].transcript).join(" "));
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r; r.start(); setListening(true);
    navigator.vibrate?.(10);
  };
  return { supported: !!Ctor, listening, start, stop: () => rec.current?.stop() };
}

export default function AskScreen() {
  const ai = useAI()!;
  const { user } = useApp();
  const [draft, setDraft] = React.useState("");
  const speech = useSpeech(setDraft);
  const [iosHint, setIosHint] = React.useState(() => { try { return isIOS() && !isStandalone() && !localStorage.getItem("dfm.iosHint"); } catch { return false; } });
  const prevLen = React.useRef(ai.messages.length);
  React.useEffect(() => { if (ai.messages.length > prevLen.current) navigator.vibrate?.(8); prevLen.current = ai.messages.length; }, [ai.messages.length]);

  const hour = NOW.getHours();
  const mc = monthContext();
  const active = trips.filter((t) => t.stage !== "epod_done");
  const late = active.filter((t) => tripEta(t)?.late).length;
  const mtd = orders.filter((o) => o.mk === CUR_MONTH && o.otif != null);
  const otif = (sum(mtd, (o) => o.otif! * o.qty) / (sum(mtd, "qty") || 1)) * 100;

  const empty = (
    <div className="flex w-full flex-col gap-4 self-start px-1 pb-2 text-left">
      <div>
        <h1 className="m-0 mt-0.5 text-[24px] leading-tight font-semibold tracking-[-0.04em]">Good {hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, {user?.name.split(" ")[0]}</h1>
        <p className="m-0 mt-1 text-[14px] text-muted-foreground">What do you want to know today? Type or tap the mic.</p>
      </div>
      <div className="grid grid-cols-3 gap-2" aria-label="Today at a glance">
        {[
          { l: "Behind plan", v: `${late} trips`, tone: late ? "text-rose-600 dark:text-rose-400" : "" },
          { l: "MTD OTIF", v: otif.toFixed(1) + "%", tone: "" },
          { l: "Sales vs target", v: Math.round((mc.mtd.sales / mc.mTarget) * 100) + "%", tone: "" },
        ].map((x) => (
          <div key={x.l} className="inset-panel px-3 py-2.5">
            <div className="text-[11px] text-muted-foreground">{x.l}</div>
            <div className={cn("mt-0.5 text-[17px] font-semibold tabular-nums tracking-tight", x.tone)}>{x.v}</div>
          </div>
        ))}
      </div>
      {iosHint ? (
        <div className="flex items-start gap-3 rounded-xl bg-primary/5 p-3 text-[13px] ring-1 ring-inset ring-primary/15">
          <IconShare2 className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="flex-1">Install this app: tap <b>Share</b> in Safari, then <b>Add to Home Screen</b>.</span>
          <button type="button" aria-label="Dismiss" onClick={() => { setIosHint(false); try { localStorage.setItem("dfm.iosHint", "1"); } catch { /* ignore */ } }}><IconX className="size-4 text-muted-foreground" /></button>
        </div>
      ) : null}
      <div>
        <h2 className="m-0 mb-2 text-[13px] font-medium text-muted-foreground">Try asking</h2>
        <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
          {SUGGESTIONS.slice(0, 4).map((s) => (
            <li key={s.q}>
              <button type="button" onClick={() => ai.send(s.q)}
                className="surface-card flex h-full min-h-[76px] w-full flex-col items-start gap-1.5 p-3 text-left text-[13px] leading-snug active:scale-[0.98]">
                <s.icon className="size-4 text-primary" />
                {s.q}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  return (
    <div className="pt-safe absolute inset-0 flex flex-col">
      <Conversation
        compact
        autoFocus={false}
        className="flex-1 rounded-none border-0 shadow-none"
        value={draft}
        onValueChange={setDraft}
        emptyState={empty}
        title={
          <span className="inline-flex items-center gap-2">
            <img src="/brand/crax-logo.png" alt="" className="h-6 w-auto" />
            <span className="font-semibold">Ask DFM</span>
            {ai.configured === null ? null : ai.configured ? <StatusBadge variant="success">Claude</StatusBadge> : <StatusBadge variant="warning">Offline</StatusBadge>}
          </span>
        }
        footer={null}
        composerActions={speech.supported ? (
          <button type="button" aria-label={speech.listening ? "Stop listening" : "Ask by voice"} onClick={speech.listening ? speech.stop : speech.start}
            className={cn("flex size-9 items-center justify-center rounded-full transition-colors", speech.listening ? "mic-live bg-destructive text-white" : "text-muted-foreground hover:bg-muted")}>
            {speech.listening ? <IconPlayerStopFilled className="size-4" /> : <IconMicrophone className="size-5" />}
          </button>
        ) : undefined}
      />
    </div>
  );
}
