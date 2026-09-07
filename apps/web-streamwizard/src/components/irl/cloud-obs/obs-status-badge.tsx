"use client";

import { Badge } from "@repo/ui";
import { AlertTriangle, Loader2, WifiOff } from "lucide-react";
import type { ObsFlowState } from "@/components/irl/cloud-obs/obs-flow-state";

/**
 * "Is OBS reachable" pill. Two flavours: the setup stepper only knows about the
 * launch flow, while the dashboard also reports crashes, deliberate stops and a
 * running container whose socket dropped.
 */

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

function badgeVariant(obsOpen: boolean, flow: ObsFlowState): BadgeVariant {
  if (obsOpen) return "default";
  if (flow.hasTimedOut || flow.crashed) return "destructive";
  if (flow.inLaunchFlow || flow.isStopping || flow.externalStarting) return "secondary";
  return "outline";
}

/** Stepper flavour: the box is being set up, so there's no crash/stop story yet. */
export function ObsSetupStatusBadge({ obsOpen, flow }: { obsOpen: boolean; flow: ObsFlowState }) {
  return (
    <Badge variant={badgeVariant(obsOpen, flow)} className="gap-1.5">
      {obsOpen && <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block animate-pulse" />}
      {flow.inLaunchFlow && <Loader2 className="h-3 w-3 animate-spin" />}
      {flow.hasTimedOut && <AlertTriangle className="h-3 w-3" />}
      {obsOpen
        ? "OBS Connected"
        : flow.hasTimedOut
          ? "Not responding"
          : flow.isProvisioning
            ? "Starting up…"
            : flow.isBooting
              ? "OBS booting…"
              : "Offline"}
    </Badge>
  );
}

export function ObsStatusBadge({
  obsStatus,
  containerStatus,
  flow,
}: {
  obsStatus: "closed" | "connecting" | "open";
  containerStatus: "running" | "stopped" | "unknown";
  flow: ObsFlowState;
}) {
  const obsOpen = obsStatus === "open";
  const transitioning = flow.inLaunchFlow || flow.isStopping || flow.externalStarting;

  return (
    <Badge variant={badgeVariant(obsOpen, flow)} className="gap-1.5">
      {obsOpen && <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block animate-pulse" />}
      {transitioning && <Loader2 className="h-3 w-3 animate-spin" />}
      {(flow.hasTimedOut || flow.crashed) && <AlertTriangle className="h-3 w-3" />}
      {!transitioning && !flow.hasTimedOut && !flow.crashed && obsStatus === "closed" && (
        <WifiOff className="h-3 w-3" />
      )}
      {obsOpen
        ? "OBS Connected"
        : flow.crashed
          ? "Crashed"
          : flow.hasTimedOut
            ? "Not responding"
            : flow.isStopping
              ? "Stopping…"
              : flow.isProvisioning || flow.externalStarting
                ? "Starting up…"
                : flow.isBooting
                  ? "OBS booting…"
                  : containerStatus === "running"
                    ? "Disconnected"
                    : "Offline"}
    </Badge>
  );
}
