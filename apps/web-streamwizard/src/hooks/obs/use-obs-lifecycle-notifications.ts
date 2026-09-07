"use client";

import { useCallback, useRef, useState, type MutableRefObject } from "react";
import { toast } from "sonner";
import type { ObsInstanceLifecyclePayload } from "@repo/types";
import { useObsInstanceLifecycle } from "@/hooks/obs/use-obs-instance-lifecycle";

// Why the box is stopped, derived from the last terminal lifecycle event. Drives
// the stopped-state card, the crash banner, and the status badge so a clean
// stop, a crash, and a delete never look the same.
//  - clean:   user/admin stopped it (or a graceful shutdown, exit 0/143)
//  - crashed: it died on its own (non-zero exit / OOM -> producer "error")
//  - deleted: the instance was removed entirely
export type ObsStopReason = "clean" | "crashed" | "deleted";

// Transitional, non-terminal state derived from the leading-edge events the
// manager fires before a start or stop completes. Lets a device that didn't
// trigger the change show an honest "Starting…"/"Stopping…" during the wait
// instead of misreading the imminent OBS socket drop as a reconnect.
export type ObsTransition = "starting" | "stopping";

interface UseObsLifecycleNotificationsOptions {
  /** The instance the page is tracking; events for others are ignored. */
  instanceId: string | null;
  /**
   * True for the brief window right after a local start/stop so the resulting
   * lifecycle event doesn't fire a second toast on top of the action's own
   * feedback. The hook flips it back to false once it consumes a terminal event.
   */
  selfInitiatedRef: MutableRefObject<boolean>;
  /** Imperative side-effects the page still owns (disconnect / reconnect / hydrate). */
  onEvent: (payload: ObsInstanceLifecyclePayload) => void;
}

/**
 * Wraps the raw lifecycle subscription with the notification layer shared by the
 * deck and the cloud dashboard: it derives a stop reason and a transitional
 * state, fires the right toast for externally-triggered events, and hands the
 * payload off to the page for the imperative work. Keeps both surfaces telling
 * the same story.
 */
export function useObsLifecycleNotifications({ instanceId, selfInitiatedRef, onEvent }: UseObsLifecycleNotificationsOptions) {
  const [stopReason, setStopReason] = useState<ObsStopReason | null>(null);
  const [transition, setTransition] = useState<ObsTransition | null>(null);
  const clearStopReason = useCallback(() => setStopReason(null), []);
  // A "stopping" we already announced. Lets the terminal "stopped" that follows
  // skip its own toast, so a deliberate stop reads as one message, not two.
  const announcedStoppingRef = useRef(false);

  const handle = useCallback(
    (payload: ObsInstanceLifecyclePayload) => {
      // Same scope rule as the page: ignore events for an instance we're not
      // tracking, unless we're tracking none yet (a "started" adopts it).
      if (instanceId && payload.instanceId !== instanceId) return;

      // The user's own start/stop already gave feedback; only surprise us with a
      // toast when the change came from elsewhere (another device, admin, crash).
      const external = !selfInitiatedRef.current;

      switch (payload.action) {
        case "starting":
          // Transitional: box coming up. No toast — the terminal "started" (or a
          // local start's own toast) covers it; here we just drive the UI state.
          setTransition("starting");
          break;
        case "stopping":
          setTransition("stopping");
          if (external) {
            announcedStoppingRef.current = true;
            toast.warning("Cloud OBS is shutting down", { description: "Wrapping up your container." });
          }
          break;
        case "error":
          setTransition(null);
          setStopReason("crashed");
          announcedStoppingRef.current = false;
          if (external) {
            toast.error("Your Cloud OBS crashed", {
              description: "It stopped on its own. Restart when you're ready.",
            });
          }
          break;
        case "stopped":
          setTransition(null);
          setStopReason("clean");
          // Skip the toast if we already announced the "stopping" that led here.
          if (external && !announcedStoppingRef.current) {
            toast.warning("Cloud OBS stopped", {
              description: "It was shut down. Start it again anytime.",
            });
          }
          announcedStoppingRef.current = false;
          break;
        case "deleted":
          setTransition(null);
          setStopReason("deleted");
          announcedStoppingRef.current = false;
          if (external) {
            toast.warning("Cloud OBS removed", {
              description: "This container is gone. Set up a new one from the dashboard.",
            });
          }
          break;
        case "started":
          setTransition(null);
          setStopReason(null);
          announcedStoppingRef.current = false;
          if (external) {
            toast.success("Cloud OBS is back", { description: "Reconnecting your controls." });
          }
          break;
      }

      // Consume the self-initiated window on a terminal event; the transitional
      // "starting"/"stopping" that precede it belong to the same local action.
      if (payload.action !== "starting" && payload.action !== "stopping") {
        selfInitiatedRef.current = false;
      }

      onEvent(payload);
    },
    [instanceId, selfInitiatedRef, onEvent],
  );

  useObsInstanceLifecycle(handle);

  return { stopReason, clearStopReason, setStopReason, transition };
}
