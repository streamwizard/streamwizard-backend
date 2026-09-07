"use client";

import { Badge, Button, cn } from "@repo/ui";
import { Loader2, Play, Radio, Rocket, Square } from "lucide-react";
import type { ObsFlowState } from "@/components/irl/cloud-obs/obs-flow-state";

/** Go-live control. Only meaningful while the OBS socket is open. */
export function ObsStreamControl({
  canInteract,
  isStreaming,
  toggling,
  onToggle,
}: {
  canInteract: boolean;
  isStreaming: boolean;
  toggling: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Badge
        variant="outline"
        className={cn("gap-1.5", isStreaming ? "border-red-500/50 text-red-400" : "text-muted-foreground")}
      >
        <Radio className={cn("h-3 w-3", isStreaming && "animate-pulse")} />
        {isStreaming ? "Streaming" : "Not streaming"}
      </Badge>
      <Button
        size="sm"
        variant={isStreaming ? "destructive" : "default"}
        disabled={!canInteract || toggling}
        onClick={onToggle}
      >
        {toggling ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
        ) : isStreaming ? (
          <Square className="h-3.5 w-3.5 mr-1.5" />
        ) : (
          <Radio className="h-3.5 w-3.5 mr-1.5" />
        )}
        {toggling ? "Working…" : isStreaming ? "Stop stream" : "Go live"}
      </Button>
    </div>
  );
}

function containerCopy({
  flow,
  obsOpen,
  containerStatus,
  hasInstance,
}: {
  flow: ObsFlowState;
  obsOpen: boolean;
  containerStatus: "running" | "stopped" | "unknown";
  hasInstance: boolean;
}): string {
  if (flow.isStopping) return "Stopping your container…";
  if (flow.externalStarting) return "Starting your container…";
  if (flow.isProvisioning) return "Provisioning your container…";
  if (flow.isBooting) return "Container's up. Waiting for OBS.";
  if (obsOpen) return "Your OBS container is running";
  if (flow.hasTimedOut) return "Container's running, but we can't reach OBS";
  if (containerStatus === "running") return "Your OBS container is running";
  if (containerStatus === "stopped" && !hasInstance) return "No container running. Launch one to get started.";
  if (containerStatus === "stopped") return "Container is stopped";
  return "Checking status…";
}

/**
 * Container lifecycle strip: what the box is doing right now, plus the one
 * button that changes it — "Launch" for a user who has never had an instance,
 * start/stop afterwards.
 */
export function ObsContainerControl({
  canInteract,
  flow,
  obsStatus,
  containerStatus,
  instanceId,
  apiUrl,
  launching,
  launchError,
  togglingContainer,
  onLaunch,
  onToggleContainer,
}: {
  canInteract: boolean;
  flow: ObsFlowState;
  obsStatus: "closed" | "connecting" | "open";
  containerStatus: "running" | "stopped" | "unknown";
  instanceId: string | null;
  apiUrl: string | null;
  launching: boolean;
  launchError: string | null;
  togglingContainer: boolean;
  onLaunch: () => void;
  onToggleContainer: () => void;
}) {
  const running = containerStatus === "running";
  const neverLaunched = containerStatus === "stopped" && !instanceId;

  return (
    <div className="flex items-center gap-3 pt-2 border-t">
      <div>
        <p className="text-sm font-medium">Container</p>
        <p className="text-xs text-muted-foreground">
          {containerCopy({
            flow,
            obsOpen: obsStatus === "open",
            containerStatus,
            hasInstance: !!instanceId,
          })}
        </p>
        {launchError && <p className="text-xs text-destructive mt-1">{launchError}</p>}
      </div>
      {neverLaunched ? (
        <Button size="sm" disabled={!canInteract || launching} onClick={onLaunch} className="ml-auto">
          {launching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
          ) : (
            <Rocket className="h-3.5 w-3.5 mr-1.5" />
          )}
          {launching ? "Launching…" : "Launch Cloud OBS"}
        </Button>
      ) : (
        <Button
          size="sm"
          variant={running ? "destructive" : "default"}
          disabled={!canInteract || togglingContainer || !instanceId || !apiUrl}
          onClick={onToggleContainer}
          className="ml-auto"
        >
          {togglingContainer ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
          ) : running ? (
            <Square className="h-3.5 w-3.5 mr-1.5" />
          ) : (
            <Play className="h-3.5 w-3.5 mr-1.5" />
          )}
          {togglingContainer
            ? running
              ? "Stopping…"
              : "Starting…"
            : running
              ? "Stop container"
              : "Start container"}
        </Button>
      )}
    </div>
  );
}
