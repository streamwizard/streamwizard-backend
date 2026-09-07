import { cn } from "@/lib/utils";

export type IndicatorStatus = "ok" | "warn" | "crit" | "muted";

const DOT_CLASSES: Record<IndicatorStatus, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  crit: "bg-red-500",
  muted: "bg-muted-foreground/40",
};

/** Colored dot + text label; the label carries the meaning so the color is
 * never the only signal. */
export function StatusIndicator({
  status,
  label,
  className,
}: {
  status: IndicatorStatus;
  label: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)} aria-label={`${label} (${status})`}>
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT_CLASSES[status])} />
      {label}
    </span>
  );
}
