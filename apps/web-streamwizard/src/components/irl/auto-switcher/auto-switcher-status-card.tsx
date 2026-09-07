"use client";

import { useEffect, useState } from "react";
import type { AutoSwitcherStatus } from "@repo/schemas";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Progress } from "@repo/ui";
import { Activity } from "lucide-react";

function stateBadge(state: AutoSwitcherStatus["state"]): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  switch (state) {
    case "live":
      return { label: "Live", variant: "default" };
    case "startup":
      return { label: "Checking signal", variant: "secondary" };
    case "degraded":
      return { label: "Low quality", variant: "destructive" };
    case "offline":
      return { label: "Signal lost", variant: "destructive" };
    case "override":
      return { label: "Held by you", variant: "outline" };
    default:
      return { label: "Waiting for stream", variant: "secondary" };
  }
}

const METRIC_LABELS: Record<"bitrate" | "rtt" | "loss", string> = {
  bitrate: "Bitrate",
  rtt: "Ping (RTT)",
  loss: "Dropped packets",
};

function reasonLabel(reason: string): string {
  switch (reason) {
    case "auto_fallback":
      return "auto — quality dropped";
    case "auto_recover":
      return "auto — recovered";
    case "auto_offline":
      return "auto — signal lost";
    case "auto_stop":
      return "auto — stream stopped";
    case "override":
      return "manual hold";
    default:
      return reason;
  }
}

// Live view of what the engine is doing right now: state, per-metric
// bad/good streak progress toward the next switch, and the last switch it
// made with the reason it logged.
export function AutoSwitcherStatusCard({ status, enabled }: { status: AutoSwitcherStatus | null; enabled: boolean }) {
  // Clock state for the countdowns (auto-stop / override expiry) — driven by
  // an interval so render stays pure; countdowns appear within a second.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  if (!enabled) return null;

  if (!status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Auto switcher
          </CardTitle>
          <CardDescription>Waiting for engine status — start a stream to your ingest and this comes alive.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const badge = stateBadge(status.state);
  const { thresholds } = status;
  const limits = {
    bitrate: { trigger: thresholds.bitrate_trigger_polls, recover: thresholds.bitrate_recover_polls },
    rtt: { trigger: thresholds.rtt_trigger_polls, recover: thresholds.rtt_recover_polls },
    loss: { trigger: thresholds.loss_trigger_polls, recover: thresholds.loss_recover_polls },
  };
  const recovering = status.state === "degraded" || status.state === "offline";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Auto switcher
          <Badge variant={badge.variant}>{badge.label}</Badge>
          {status.selected_session?.label ? (
            <span className="text-xs font-normal text-muted-foreground">watching {status.selected_session.label}</span>
          ) : null}
        </CardTitle>
        {status.last_error ? (
          <CardDescription className="text-destructive">Problem: {status.last_error}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {status.armed && status.state !== "override" ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(METRIC_LABELS) as ("bitrate" | "rtt" | "loss")[]).map((key) => {
              const streak = status.streaks[key];
              // While live: progress toward triggering a switch (bad polls).
              // While recovering: progress toward switching back (good polls).
              const target = recovering ? limits[key].recover : limits[key].trigger;
              const value = recovering ? streak.good : streak.bad;
              const pct = Math.min(100, Math.round((value / Math.max(1, target)) * 100));
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{METRIC_LABELS[key]}</span>
                    <span>
                      {value}/{target} {recovering ? "stable" : "bad"}
                    </span>
                  </div>
                  <Progress value={pct} className={recovering ? "" : pct > 0 ? "[&>div]:bg-destructive" : ""} />
                </div>
              );
            })}
          </div>
        ) : null}

        {status.state === "override" && status.override ? (
          <p className="text-sm text-muted-foreground">
            Holding <span className="font-medium text-foreground">{status.override.scene_name ?? "scene"}</span>
            {status.override.expires_at && now !== null
              ? ` — auto switching resumes in ${formatRemaining(new Date(status.override.expires_at).getTime() - now)}`
              : " until you release it"}
          </p>
        ) : null}

        {status.auto_stop_deadline && now !== null ? (
          <p className="text-sm text-destructive">Stream output stops in {formatRemaining(status.auto_stop_deadline - now)} unless the signal comes back.</p>
        ) : null}

        {status.last_switch ? (
          <p className="text-xs text-muted-foreground">
            Last switch: {status.last_switch.from_scene ? `${status.last_switch.from_scene} → ` : ""}
            <span className="font-medium text-foreground">{status.last_switch.to_scene}</span>{" "}
            ({reasonLabel(status.last_switch.reason)}: {status.last_switch.detail}) —{" "}
            {new Date(status.last_switch.at).toLocaleTimeString()}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">No switches yet this session.</p>
        )}
      </CardContent>
    </Card>
  );
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
