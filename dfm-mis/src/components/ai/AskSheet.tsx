import { Link } from "react-router-dom";
import { IconArrowsMaximize, IconX } from "@tabler/icons-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAI } from "@/state/ai";
import { Conversation } from "./Conversation";

/** Slide-over assistant available from every page (header button, ⌘J, or "Ask AI" on any chart). */
export function AskSheet() {
  const ai = useAI()!;
  return (
    <Sheet open={ai.open} onOpenChange={ai.setOpen}>
      <SheetContent side="right" showCloseButton={false} className="w-full gap-0 p-0 sm:max-w-[620px]">
        <SheetTitle className="sr-only">Ask AI</SheetTitle>
        <SheetDescription className="sr-only">Ask questions about the MIS data and get charts and insights.</SheetDescription>
        <Conversation
          compact
          className="rounded-none border-0"
          headerActions={
            <>
              <Button asChild variant="ghost" size="icon-sm" aria-label="Open full screen" onClick={() => ai.setOpen(false)}>
                <Link to="/ask"><IconArrowsMaximize className="size-4" /></Link>
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={() => ai.setOpen(false)}><IconX className="size-4" /></Button>
            </>
          }
        />
      </SheetContent>
    </Sheet>
  );
}
