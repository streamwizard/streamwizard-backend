"use client";

import { useState } from "react";
import { SyncBroadcasterClips } from "@/actions/twitch/clips";
import { RefreshCcw, Check, Clapperboard, AlertCircle } from "lucide-react";
import { Button, LoadingSpinner } from "@repo/ui";
import { captureEvent } from "@repo/posthog";

interface SyncNowStepProps {
  clipCount: number;
}

type SyncState = "idle" | "syncing" | "done" | "skipped" | "error";

export function SyncNowStep({ clipCount }: SyncNowStepProps) {
  const hasClips = clipCount > 0;
  const [state, setState] = useState<SyncState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSync() {
    setState("syncing");
    setErrorMessage(null);

    const response = await SyncBroadcasterClips();

    if (response.success) {
      captureEvent("clips_synced", { source: "onboarding", skipped: false });
      setState("done");
      return;
    }

    if (response.skipped) {
      captureEvent("clips_synced", { source: "onboarding", skipped: true });
      setState("skipped");
      return;
    }

    setErrorMessage(response.message || "Something broke. Try again?");
    setState("error");
  }

  const isSyncing = state === "syncing";
  const hasSynced = state === "done" || state === "skipped";

  let heading: string;
  let description: string;
  if (hasSynced) {
    heading = "All caught up.";
    description = "Your clips are in StreamWizard, ready to sort. You can pull in more any time.";
  } else if (hasClips) {
    heading = "We already have some clips of you.";
    description = "No idea how, but we do. Want to pull in the latest ones while you're here?";
  } else {
    heading = "No clips yet.";
    description = "Grab your Twitch clips now, or skip it — if you turned on auto-sync, they'll come in automatically after your next stream.";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">{heading}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {hasClips && (
        <div className="relative rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20">
              <Clapperboard className="h-4 w-4 text-purple-400" />
            </span>
            <div>
              <p className="text-sm font-medium">{clipCount.toLocaleString()} clips synced</p>
              <p className="text-xs text-muted-foreground">from your Twitch account</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Button
          variant={hasClips ? "outline" : "default"}
          onClick={handleSync}
          disabled={isSyncing}
          className="w-full sm:w-auto"
        >
          {isSyncing ? (
            <>
              <span className="mr-2 h-4 w-4 shrink-0">
                <LoadingSpinner />
              </span>
              {hasClips ? "Syncing..." : "Pulling in your clips..."}
            </>
          ) : state === "error" ? (
            <>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Try again
            </>
          ) : (
            <>
              <RefreshCcw className="mr-2 h-4 w-4" />
              {hasClips ? "Sync latest clips" : "Grab my clips"}
            </>
          )}
        </Button>

        {state === "done" && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <Check className="h-4 w-4 shrink-0" />
            {hasClips ? "Latest clips pulled in." : "Your clips are in. Slightly less chaotic now."}
          </div>
        )}

        {state === "skipped" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 shrink-0 text-primary" />
            Already up to date. Nothing new to pull in.
          </div>
        )}

        {state === "error" && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}
