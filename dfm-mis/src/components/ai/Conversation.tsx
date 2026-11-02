import * as React from "react";
import { useLocation } from "react-router-dom";
import { IconChartBar, IconSparkles, IconTruck, IconClipboardList, IconReportMoney, IconBuildingWarehouse } from "@tabler/icons-react";
import { AssistantPanel, type AssistantSuggestion } from "@/components/overtrue/assistant-panel";
import { StatusBadge } from "@/components/overtrue/status-badge";
import { useAI, type AIMessage } from "@/state/ai";
import { GenChart } from "./GenChart";
import { cn } from "@/lib/utils";

const BY_MODULE: Record<string, AssistantSuggestion[]> = {
  trips: [
    { label: "Which transporters cost the most per km?", icon: <IconTruck className="size-4" /> },
    { label: "Detention rate by month", icon: <IconTruck className="size-4" /> },
    { label: "Freight by destination and fleet", icon: <IconTruck className="size-4" /> },
    { label: "Tracking adherence by transporter", icon: <IconTruck className="size-4" /> },
  ],
  orders: [
    { label: "OTIF by destination this month", icon: <IconClipboardList className="size-4" /> },
    { label: "Open orders by stage", icon: <IconClipboardList className="size-4" /> },
    { label: "Approval to dispatch hours by month", icon: <IconClipboardList className="size-4" /> },
  ],
  sales: [
    { label: "Top 5 ASMs by achievement", icon: <IconChartBar className="size-4" /> },
    { label: "Sales by brand and channel", icon: <IconChartBar className="size-4" /> },
    { label: "Achievement by zone this month", icon: <IconChartBar className="size-4" /> },
  ],
  cfa: [{ label: "CFA throughput by day", icon: <IconBuildingWarehouse className="size-4" /> }, { label: "Cases by CFA by weekday", icon: <IconBuildingWarehouse className="size-4" /> }],
  pnl: [{ label: "Material margin % by account", icon: <IconReportMoney className="size-4" /> }, { label: "Net sales by month and account", icon: <IconReportMoney className="size-4" /> }],
};
const DEFAULT: AssistantSuggestion[] = [
  { label: "Which transporters cost the most per km?", icon: <IconTruck className="size-4" /> },
  { label: "OTIF by destination this month", icon: <IconClipboardList className="size-4" /> },
  { label: "Top 5 ASMs by achievement", icon: <IconChartBar className="size-4" /> },
  { label: "Material margin % by account", icon: <IconReportMoney className="size-4" /> },
];

export function suggestionsFor(path: string) {
  const mod = path.split("/")[1];
  return BY_MODULE[mod] ?? DEFAULT;
}

export function Conversation({ compact, headerActions, className, showCharts = true }: { compact?: boolean; headerActions?: React.ReactNode; className?: string; showCharts?: boolean }) {
  const ai = useAI()!;
  const loc = useLocation();
  const lastAssistant = [...ai.messages].reverse().find((m) => m.role === "assistant");
  return (
    <AssistantPanel
      className={cn("h-full min-h-0", className)}
      messages={ai.messages}
      status={ai.status}
      onSend={(t) => ai.send(t)}
      onStop={ai.stop}
      onRegenerate={ai.regenerate}
      onNewChat={ai.messages.length ? ai.newChat : undefined}
      suggestions={suggestionsFor(loc.pathname)}
      density={compact ? "compact" : "comfortable"}
      autoFocus
      title={
        <span className="inline-flex items-center gap-2">
          <IconSparkles className="size-4 text-primary" /> Ask AI
          {ai.configured === null ? null : ai.configured
            ? <StatusBadge variant="success">Claude</StatusBadge>
            : <StatusBadge variant="warning">Offline mode</StatusBadge>}
        </span>
      }
      placeholder="Ask about trips, orders, sales, CFAs or the P&L…"
      headerActions={headerActions}
      labels={{
        emptyTitle: "Talk to your data",
        emptyDescription: "Ask a question in plain English. I’ll query the MIS, chart the answer and point out what matters.",
        thinking: "Querying the MIS…",
      }}
      footer={ai.configured === false
        ? <span>Offline mode understands common questions. Set ANTHROPIC_API_KEY on the server to let Claude answer anything.</span>
        : <span>Answers come from live MIS data. Every number is computed, not written by the AI.</span>}
      renderMessage={(m, ctx) => {
        const msg = m as AIMessage;
        if (msg.role !== "assistant" || msg.status === "streaming") return undefined;
        const isLast = msg.id === lastAssistant?.id;
        return (
          <>
            {ctx.children}
            {showCharts && msg.charts?.length ? (
              <div className="flex flex-col gap-3">
                {msg.charts.map((c, i) => <GenChart key={i} spec={c} compact={compact} pinned={ai.isPinned(c)} onPin={() => ai.togglePin(c)} />)}
              </div>
            ) : null}
            {isLast && msg.followUps?.length ? (
              <div className="flex flex-wrap gap-2" aria-label="Suggested follow-ups">
                {msg.followUps.map((f) => (
                  <button key={f} type="button" onClick={() => ai.send(f)} disabled={ai.status === "streaming"}
                    className="rounded-full border border-border/80 bg-card px-3 py-1 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50">
                    {f}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        );
      }}
    />
  );
}
