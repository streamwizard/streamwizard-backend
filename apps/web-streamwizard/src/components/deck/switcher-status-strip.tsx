"use client";

import { useEffect, useState } from "react";
import type { AutoSwitcherState, AutoSwitcherStatus } from "@repo/schemas";
import { Badge, cn } from "@repo/ui";

// One-line "what is the switcher doing right now", so a settings change on the
// phone can be judged against live behaviour. The dashboard's full status card
// (streak bars, countdowns) stays desktop-only.

const STATE_COPY: Record<AutoSwitcherState, { label: string; dot: string }> = {
  idle: { label: "Waiting for signal", dot: "bg-muted-foreground" },
  startup: { label: "Warming up", dot: "bg-yellow-500" },
  live: { label: "Live", dot: "bg-green-500" },
  degraded: { label: "Low bitrate", dot: "bg-yellow-500" },
  offline: { label: "Signal lost", dot: "bg-red-500" },
  override: { label: "Holding a scene", dot: "bg-primary" },
};

function agoLabel(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export function SwitcherStatusStrip({ status, enabled }: { status: AutoSwitcherStatus | null; enabled: boolean }) {
  // Re-render once a second so "switched 12s ago" stays honest between the
  // engine's 5s frames.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!status?.last_switch) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status?.last_switch]);

  if (!enabled) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border bg-card px-4 py-3">
        <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground" />
        <p className="text-sm text-muted-foreground">Auto switcher is off. Flip it on below.</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border bg-card px-4 py-3">
        <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground" />
        <p className="text-sm text-muted-foreground">No live status right now. Your settings still save.</p>
      </div>
    );
  }

  const copy = STATE_COPY[status.state];

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", copy.dot, status.armed && "animate-pulse")} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{copy.label}</p>
          {status.last_switch ? (
            <p className="truncate text-xs tabular-nums text-muted-foreground">
              Switched to {status.last_switch.to_scene} {agoLabel(status.last_switch.at, now)}
            </p>
          ) : null}
        </div>
      </div>
      {!status.armed ? (
        <Badge variant="outline" className="shrink-0">
          Standby
        </Badge>
      ) : null}
    </div>
  );
}
