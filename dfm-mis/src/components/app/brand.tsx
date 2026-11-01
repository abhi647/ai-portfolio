import { cn } from "@/lib/utils";

/** CRAX logo (from crax.in, DFM Foods' official site) with the product name. */
export function BrandMark({ inverted, compact, className }: { inverted?: boolean; compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img src="/brand/crax-logo.png" alt="CRAX — DFM Foods" width={40} height={38} className="h-9 w-auto shrink-0 drop-shadow-[0_1px_1px_rgb(0_0_0/0.15)]" />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className={cn("text-[15px] font-semibold tracking-tight", inverted ? "text-white" : "text-foreground")}>DFM Foods</span>
          <span className={cn("mt-1 text-[11px]", inverted ? "text-white/60" : "text-muted-foreground")}>MIS · Supply, sales &amp; finance</span>
        </span>
      )}
    </span>
  );
}
