import * as React from "react";
import { IconLayoutDashboard, IconPinnedOff, IconSparkles } from "@tabler/icons-react";
import { PageHeader } from "@/components/overtrue/page-header";
import { EmptyState } from "@/components/overtrue/empty-state";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/app/kit";
import { Conversation } from "@/components/ai/Conversation";
import { GenChart } from "@/components/ai/GenChart";
import { useAI, type AIMessage } from "@/state/ai";

/** Full-screen Ask AI studio: conversation on the left, the generated charts and your pinned board on the right. */
export default function Ask() {
  const ai = useAI()!;
  const [tab, setTab] = React.useState<"answer" | "board">("answer");
  const last = [...ai.messages].reverse().find((m): m is AIMessage => m.role === "assistant" && !!(m as AIMessage).charts?.length) as AIMessage | undefined;
  React.useEffect(() => { ai.setOpen(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Workspace · Ask AI"
        title="Ask your data"
        description="Ask in plain English. The assistant queries trips, orders, sales, CFA throughput and the e-com P&L, then builds the chart that answers you. Pin any chart to build your own dashboard."
        actions={<Toggle label="Canvas" value={tab} onChange={setTab} options={[["answer", "Latest answer"], ["board", `My board (${ai.pins.length})`]]} />}
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="surface-card h-[calc(100svh-15rem)] min-h-[560px] overflow-hidden lg:sticky lg:top-20">
            <Conversation showCharts={false} className="rounded-none border-0" />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-7">
          {tab === "answer" ? (
            last?.charts?.length ? (
              <>
                <div className="flex items-center gap-2 text-[13px] text-muted-foreground"><IconSparkles className="size-4 text-primary" /> Charts for your last question{last.mode === "offline" ? " · offline mode" : ""}</div>
                {last.charts.map((c, i) => <GenChart key={`${last.id}-${i}`} spec={c} pinned={ai.isPinned(c)} onPin={() => ai.togglePin(c)} />)}
              </>
            ) : (
              <div className="surface-card p-8">
                <EmptyState icon={<IconSparkles className="size-6" />} title="Your charts appear here" description="Ask a question on the left — every answer comes with a chart you can switch, export or pin." />
              </div>
            )
          ) : ai.pins.length ? (
            <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
              {ai.pins.map((p) => <GenChart key={p.id} spec={p.spec} pinned onPin={() => ai.togglePin(p.spec)} />)}
            </div>
          ) : (
            <div className="surface-card p-8">
              <EmptyState icon={<IconLayoutDashboard className="size-6" />} title="Nothing pinned yet" description="Pin any AI-generated chart to keep it here as your own live dashboard."
                action={<Button variant="outline" onClick={() => setTab("answer")} className="gap-1.5"><IconPinnedOff className="size-4" /> Back to answers</Button>} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
