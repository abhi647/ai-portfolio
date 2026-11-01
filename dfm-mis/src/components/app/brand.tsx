import { cn } from "@/lib/utils";

export function BrandMark({ inverted, compact, className }: { inverted?: boolean; compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground shadow-[0_1px_2px_rgb(0_0_0/0.2),inset_0_1px_0_rgb(255_255_255/0.25)]">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 18V9" /><path d="M10 18V5" /><path d="M16 18v-6" /><path d="M21 18H3" />
        </svg>
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className={cn("text-[15px] font-semibold tracking-tight", inverted ? "text-white" : "text-foreground")}>DFM Foods</span>
          <span className={cn("mt-1 text-[11px]", inverted ? "text-white/55" : "text-muted-foreground")}>MIS Tool</span>
        </span>
      )}
    </span>
  );
}
