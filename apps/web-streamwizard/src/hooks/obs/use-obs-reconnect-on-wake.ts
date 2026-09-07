"use client";

import { useCallback, useEffect } from "react";
import { getMyLatestInstanceAction } from "@/actions/nodes";
import type { ObsStopReason } from "@/hooks/obs/use-obs-lifecycle-notifications";
import type { ContainerStatus } from "@/hooks/obs/use-obs-instance-session";

/**
 * Keeps a phone's OBS connection honest.
 *
 * Two problems, one answer. Phones kill the socket when the screen locks or the
 * network changes, and the connection hook deliberately doesn't retry after a
 * successful connect — so waking the device has to reconnect. And a stop/crash
 * push is best-effort: if one is missed, a dropped socket leaves the UI on
 * "Lost connection" forever, implying a reconnect that can't happen.
 *
 * Both cases resolve the same way: ask the database whether the container is
 * genuinely still running. If it is, reconnect. If it isn't, say what happened.
 */
export function useObsReconnectOnWake({
  instanceId,
  apiUrl,
  containerStatus,
  setContainerStatus,
  setStopReason,
  obsStatus,
  reconnect,
  disconnect,
}: {
  instanceId: string | null;
  apiUrl: string | null;
  containerStatus: ContainerStatus;
  setContainerStatus: (status: ContainerStatus) => void;
  setStopReason: (reason: ObsStopReason) => void;
  obsStatus: "closed" | "connecting" | "open";
  reconnect: () => void;
  disconnect: () => void;
}) {
  /**
   * Returns true when the container really is still up. Otherwise it records
   * why it's gone ("turned off" vs "crashed") and drops the socket.
   */
  const confirmStillRunning = useCallback(async () => {
    const { data: instance } = await getMyLatestInstanceAction();
    if (!instance || instance.id !== instanceId || instance.status !== "running") {
      setStopReason(instance?.status === "error" ? "crashed" : "clean");
      setContainerStatus("stopped");
      disconnect();
      return false;
    }
    return true;
  }, [instanceId, setStopReason, setContainerStatus, disconnect]);

  // Wake / focus / network-restore: reconnect rather than making the streamer
  // find a button — but only into a container that's actually still up.
  useEffect(() => {
    const maybeReconnect = async () => {
      if (document.visibilityState !== "visible") return;
      if (containerStatus !== "running" || obsStatus !== "closed" || !apiUrl || !instanceId) return;
      if (await confirmStillRunning()) reconnect();
    };

    document.addEventListener("visibilitychange", maybeReconnect);
    window.addEventListener("focus", maybeReconnect);
    window.addEventListener("online", maybeReconnect);
    window.addEventListener("pageshow", maybeReconnect);
    return () => {
      document.removeEventListener("visibilitychange", maybeReconnect);
      window.removeEventListener("focus", maybeReconnect);
      window.removeEventListener("online", maybeReconnect);
      window.removeEventListener("pageshow", maybeReconnect);
    };
  }, [containerStatus, obsStatus, apiUrl, instanceId, reconnect, confirmStillRunning]);

  // Deck open and focused, socket dropped, no push arrived: give the push a
  // moment to land, then check the source of truth.
  useEffect(() => {
    if (containerStatus !== "running" || obsStatus !== "closed" || !instanceId) return;
    const id = setTimeout(() => void confirmStillRunning(), 5_000);
    return () => clearTimeout(id);
  }, [containerStatus, obsStatus, instanceId, confirmStillRunning]);
}
