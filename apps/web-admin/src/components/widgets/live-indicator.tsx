"use client";

import { REFRESH_OPTIONS, useRefreshInterval } from "@/lib/refresh-interval-context";
import { useTimeRange } from "@/lib/time-range-context";

// Honest "this page is live" badge: a pulsing dot plus the *actual* refresh
// cadence and selected range read from context — replaces the old hardcoded
// "Last 24 hours · refreshes every 30s" subtitle that no longer matched the
// header controls once range/refresh became user-configurable.
export function LiveIndicator() {
  const { interval } = useRefreshInterval();
  const { range } = useTimeRange();
  const cadence = REFRESH_OPTIONS.find((o) => o.value === interval)?.label ?? `${Math.round(interval / 1000)}s`;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/70 motion-reduce:hidden" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="font-medium text-foreground/80">Live</span>
      <span aria-hidden="true">·</span>
      <span className="tabular-nums">{range.label.replace("Last ", "")}</span>
      <span aria-hidden="true">·</span>
      <span className="tabular-nums">every {cadence}</span>
    </div>
  );
}
