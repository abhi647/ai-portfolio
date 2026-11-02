import { useNavigate } from "react-router-dom";
import { IconArrowDown, IconArrowUp, IconLayoutDashboard, IconSparkles } from "@tabler/icons-react";
import { EmptyState } from "@/components/overtrue/empty-state";
import { Button } from "@/components/ui/button";
import { GenChart } from "@/components/ai/GenChart";
import { useAI } from "@/state/ai";
import { ScreenHeader } from "./parts";

/** Charts the user pinned from Ask, re-run live on every visit. */
export default function BoardScreen() {
  const ai = useAI()!;
  const nav = useNavigate();
  return (
    <div className="absolute inset-0 overflow-y-auto">
      <ScreenHeader title="My board" subtitle={`${ai.pins.length} pinned chart${ai.pins.length === 1 ? "" : "s"} · live data`} />
      <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
        {ai.pins.length ? ai.pins.map((p, i) => (
          <div key={p.id} className="flex flex-col gap-1.5">
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => ai.movePin(p.id, -1)}><IconArrowUp className="size-4" /></Button>
              <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === ai.pins.length - 1} onClick={() => ai.movePin(p.id, 1)}><IconArrowDown className="size-4" /></Button>
            </div>
            <GenChart spec={p.spec} compact pinned onPin={() => ai.togglePin(p.spec)} />
          </div>
        )) : (
          <div className="surface-card mt-6 p-6">
            <EmptyState icon={<IconLayoutDashboard className="size-6" />} title="Build your own board" description="Ask a question, then tap the pin on any chart to keep it here."
              action={<Button onClick={() => nav("/")} className="gap-1.5"><IconSparkles className="size-4" /> Ask a question</Button>} />
          </div>
        )}
      </div>
    </div>
  );
}
