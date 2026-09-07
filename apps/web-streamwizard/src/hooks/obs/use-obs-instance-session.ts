"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { mintWsUrl, useObsWebSocket } from "@repo/obs-web";
import type { ObsInstanceLifecyclePayload } from "@repo/types";
import {
  getInstanceNodeApiUrlAction,
  getInstanceObsWsPasswordAction,
  getMyLatestInstanceAction,
} from "@/actions/nodes";
import { useObsLifecycleNotifications } from "@/hooks/obs/use-obs-lifecycle-notifications";

export type ContainerStatus = "running" | "stopped" | "unknown";

/**
 * The streamer's cloud-OBS container as a session: which instance is theirs,
 * whether it's running, and a live obs-websocket connection to it.
 *
 * Shared by the desktop dashboard and the phone deck — both need the same
 * "find my instance, load its node URL + password, connect, and keep up with
 * starts and stops from other devices" behaviour. What differs (launching a
 * first container, deck-only reconnect-on-wake) stays in the callers.
 */
export function useObsInstanceSession(options?: {
  /** Runs on any terminal stop (stopped / error / deleted) — e.g. to clear a boot flag. */
  onStopped?: () => void;
}) {
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const [obsWsPassword, setObsWsPassword] = useState<string | null>(null);
  const [containerStatus, setContainerStatus] = useState<ContainerStatus>("unknown");
  const [loadError, setLoadError] = useState<string | null>(null);

  // Only toast "OBS connected" for a connect the user initiated from this page,
  // not the passive connect when the page loads against an already-running box.
  const awaitingConnectRef = useRef(false);
  // True from a local launch/start/restart until the next lifecycle event, so
  // the event our own action produces doesn't fire a second (external) toast.
  const selfInitiatedRef = useRef(false);

  const onStopped = options?.onStopped;

  // Loads a specific instance's node API URL + OBS WS password into state
  // (also setting instanceId). Shared by the initial load and the lifecycle
  // handler below, which uses it to adopt an instance started on another
  // device while this one was tracking none.
  const hydrateInstance = useCallback(async (id: string) => {
    setInstanceId(id);
    const [{ data: nodeData }, { data: passwordData }] = await Promise.all([
      getInstanceNodeApiUrlAction(id),
      getInstanceObsWsPasswordAction(id),
    ]);
    if (!nodeData || !passwordData) {
      setLoadError("Couldn't load your container info. Refresh to try again?");
      return;
    }
    setApiUrl(nodeData.apiUrl);
    setObsWsPassword(passwordData.password);
  }, []);

  useEffect(() => {
    async function init() {
      // Look up the most recent instance regardless of status -- a stopped
      // instance still needs to be picked up so the page offers Start instead
      // of provisioning a brand new one.
      const { data: instance } = await getMyLatestInstanceAction();
      if (!instance) {
        setContainerStatus("stopped");
        return;
      }
      setContainerStatus(instance.status === "running" ? "running" : "stopped");
      await hydrateInstance(instance.id);
    }
    init();
  }, [hydrateInstance]);

  const getWsUrl = useCallback(() => {
    if (!apiUrl || !instanceId) return Promise.reject(new Error("Instance not ready."));
    return mintWsUrl(apiUrl, {
      ticketPath: `/instances/${instanceId}/ws-ticket`,
      wsPath: `/instances/${instanceId}/obsws`,
      scope: "obsws",
    });
  }, [apiUrl, instanceId]);

  const obs = useObsWebSocket({
    getWsUrl: apiUrl && instanceId ? getWsUrl : null,
    password: obsWsPassword,
  });

  // Live container lifecycle from the manager (start/stop/delete/crash), so the
  // page reflects state changes from other devices or admins without a refresh
  // -- and, critically, learns about a "started" the OBS socket can't carry
  // (there's no socket while the box is off).
  const handleLifecycle = useCallback(
    (payload: ObsInstanceLifecyclePayload) => {
      // Ignore events for an instance we're not tracking -- unless we're
      // tracking none yet, in which case a "started" adopts the new one below.
      if (instanceId && payload.instanceId !== instanceId) return;

      switch (payload.action) {
        case "starting":
          // Transitional: box is coming up elsewhere. The hook's `transition`
          // drives the "Starting…" UI; the terminal "started" hydrates/connects.
          break;
        case "stopping":
          // Transitional: a deliberate stop is underway. Stop the OBS socket from
          // fighting the imminent drop so we show "Stopping…", not "Reconnecting".
          obs.disconnect();
          break;
        case "stopped":
        case "error":
          setContainerStatus("stopped");
          onStopped?.();
          obs.disconnect();
          break;
        case "deleted":
          setInstanceId(null);
          setApiUrl(null);
          setObsWsPassword(null);
          setContainerStatus("stopped");
          onStopped?.();
          obs.disconnect();
          break;
        case "started":
          setContainerStatus("running");
          if (payload.instanceId !== instanceId || !apiUrl || !obsWsPassword) {
            // New instance, or one we never fully loaded: fetch its node URL +
            // password; the OBS hook auto-connects once all three are set.
            void hydrateInstance(payload.instanceId);
          } else {
            obs.reconnect();
          }
          break;
      }
    },
    [instanceId, apiUrl, obsWsPassword, obs, hydrateInstance, onStopped],
  );

  const { stopReason, clearStopReason, setStopReason, transition } = useObsLifecycleNotifications({
    instanceId,
    selfInitiatedRef,
    onEvent: handleLifecycle,
  });

  // Closure toast once OBS actually connects after a user-initiated start.
  useEffect(() => {
    if (obs.status === "open" && awaitingConnectRef.current) {
      awaitingConnectRef.current = false;
      toast.success("OBS connected", { description: "You're ready to go live." });
    }
  }, [obs.status]);

  return {
    instanceId,
    setInstanceId,
    apiUrl,
    setApiUrl,
    obsWsPassword,
    setObsWsPassword,
    containerStatus,
    setContainerStatus,
    loadError,
    obs,
    hydrateInstance,
    awaitingConnectRef,
    selfInitiatedRef,
    stopReason,
    clearStopReason,
    setStopReason,
    transition,
  };
}
