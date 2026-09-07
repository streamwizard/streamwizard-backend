"use client";

import Link from "next/link";
import { AlertTriangle, Loader2, RotateCw, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, Button } from "@repo/ui";
import type { ObsStopReason } from "@/hooks/obs/use-obs-lifecycle-notifications";

interface ObsLifecycleBannerProps {
  reason: ObsStopReason | null;
  /** Restart handler for the crash case. Omitted when a restart isn't possible. */
  onRestart?: () => void;
  /** A restart is in flight. */
  restarting?: boolean;
  /** Dismiss the banner (clears the stop reason). */
  onDismiss: () => void;
}

/**
 * A sticky, high-signal banner for the two events an IRL streamer must not miss:
 * a crash (the stream just dropped) and a delete. It stays until the container
 * comes back or the streamer dismisses it, so a pocketed phone doesn't swallow
 * the news the way a 4-second toast would. A clean stop gets no banner — the
 * offline card already says enough.
 */
export function ObsLifecycleBanner({ reason, onRestart, restarting, onDismiss }: ObsLifecycleBannerProps) {
  if (reason !== "crashed" && reason !== "deleted") return null;

  const crashed = reason === "crashed";

  return (
    <Alert variant="destructive" role="alert" aria-live="assertive" className="relative">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{crashed ? "Cloud OBS crashed" : "Cloud OBS removed"}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span>
          {crashed
            ? "Your container stopped unexpectedly and your stream dropped. Restart to get back live."
            : "This container is gone. Spin up a new one from the dashboard."}
        </span>
        <div className="flex gap-2">
          {crashed
            ? onRestart && (
                <Button size="sm" variant="outline" onClick={onRestart} disabled={restarting}>
                  {restarting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <RotateCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {restarting ? "Restarting…" : "Restart"}
                </Button>
              )
            : (
                <Button size="sm" variant="outline" asChild>
                  <Link href="/dashboard/irl/obs">Go to dashboard</Link>
                </Button>
              )}
        </div>
      </AlertDescription>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 text-foreground/60 transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </Alert>
  );
}
