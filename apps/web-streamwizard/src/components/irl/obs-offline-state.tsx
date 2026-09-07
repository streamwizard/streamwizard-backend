"use client";

import Link from "next/link";
import { AlertTriangle, Loader2, MonitorOff, Play, RotateCw } from "lucide-react";
import { Button, Card, CardContent } from "@repo/ui";
import type { ObsStopReason } from "@/hooks/obs/use-obs-lifecycle-notifications";

interface ObsOfflineStateProps {
  status: "booting" | "offline";
  /** Why it's offline. Splits a clean stop from a crash from a delete. Defaults to clean. */
  reason?: ObsStopReason;
  /** Start-the-container handler. Only passed when starting is the right action. */
  onStart?: () => void;
  /** A start is in flight — show a spinner and disable the button. */
  starting?: boolean;
}

/**
 * Fills the controls area when OBS isn't connected. Showing the Scenes/Sources
 * tabs while the container is off is meaningless, so we replace the whole strip
 * with a single state that tells the truth about why it's off: warming up while
 * booting, a plain offline state with a Start button, a crash state with a
 * Restart button, or a "removed" state pointing back to the dashboard.
 */
export function ObsOfflineState({ status, reason = "clean", onStart, starting }: ObsOfflineStateProps) {
  if (status === "booting") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Warming up</p>
            <p className="text-sm text-muted-foreground">Your scenes, sources, and stats show up here in a sec.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (reason === "crashed") {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">OBS crashed</p>
            <p className="text-sm text-muted-foreground">
              Your container stopped unexpectedly. Restart to get back live.
            </p>
          </div>
          {onStart && (
            <Button size="sm" disabled={starting} onClick={onStart}>
              {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RotateCw className="h-3.5 w-3.5 mr-1.5" />}
              {starting ? "Restarting…" : "Restart"}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (reason === "deleted") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <MonitorOff className="h-6 w-6 text-muted-foreground" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">Cloud OBS removed</p>
            <p className="text-sm text-muted-foreground">This one&apos;s gone. Spin up a new container from the dashboard.</p>
          </div>
          <Button size="sm" asChild>
            <Link href="/dashboard/irl/obs">Go to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <MonitorOff className="h-6 w-6 text-muted-foreground" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium">OBS is offline</p>
          <p className="text-sm text-muted-foreground">
            Start your container and your scenes, sources, and controls show up right here.
          </p>
        </div>
        {onStart && (
          <Button size="sm" disabled={starting} onClick={onStart}>
            {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
            {starting ? "Starting…" : "Start it up"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
