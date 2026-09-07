"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { captureEvent } from "@repo/posthog";
import { launchMyInstanceAction } from "@/actions/nodes";
import { toggleInstance } from "@/lib/instance-actions";
import { useObsInstanceSession } from "@/hooks/obs/use-obs-instance-session";

/**
 * The dashboard's cloud-OBS controls: the shared instance session plus the two
 * things only this page can do — provision a first container, and start/stop
 * an existing one.
 */
export function useCloudObsInstance() {
  const session = useObsInstanceSession();
  const {
    instanceId,
    setInstanceId,
    apiUrl,
    setApiUrl,
    setObsWsPassword,
    containerStatus,
    setContainerStatus,
    obs,
    awaitingConnectRef,
    selfInitiatedRef,
    clearStopReason,
  } = session;

  const [togglingContainer, setTogglingContainer] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const handleLaunch = async () => {
    setLaunching(true);
    setLaunchError(null);
    // Our own launch: suppress the external toast for the "started" it produces.
    selfInitiatedRef.current = true;
    clearStopReason();
    try {
      const { data, error } = await launchMyInstanceAction();
      if (error || !data) {
        const message = error ?? "Couldn't launch. Try again?";
        setLaunchError(message);
        toast.error("Couldn't launch Cloud OBS", { description: message });
        return;
      }
      awaitingConnectRef.current = true;
      setInstanceId(data.instance.id);
      setApiUrl(data.apiUrl);
      setObsWsPassword(data.password);
      setContainerStatus("running");
      captureEvent("cloud_obs_launched");
      toast.success("Cloud OBS launched", {
        description: "Your container is booting. Give it a few seconds.",
      });
    } catch {
      const message = "Something broke while launching. Try again?";
      setLaunchError(message);
      toast.error("Couldn't launch Cloud OBS", { description: message });
    } finally {
      setLaunching(false);
    }
  };

  const handleToggleContainer = async () => {
    if (!apiUrl || !instanceId) return;
    const action = containerStatus === "running" ? "stop" : "start";
    setTogglingContainer(true);
    // Our own start/stop: suppress the external toast for the event it produces,
    // and clear any crash banner we're recovering from.
    selfInitiatedRef.current = true;
    clearStopReason();
    try {
      await toggleInstance(apiUrl, instanceId, action);
      setContainerStatus(action === "start" ? "running" : "stopped");
      if (action === "start") {
        awaitingConnectRef.current = true;
        // reconnect (not connect) resets the retry budget, so a restart after a
        // previous boot timeout will actually retry instead of giving up at once.
        obs.reconnect();
        toast.success("Starting your container", { description: "OBS is booting up." });
      } else {
        awaitingConnectRef.current = false;
        toast.success("Container stopped");
      }
    } catch (err) {
      toast.error(action === "start" ? "Couldn't start the container" : "Couldn't stop the container", {
        description: err instanceof Error ? err.message : "Try again?",
      });
    } finally {
      setTogglingContainer(false);
    }
  };

  // The container is up but OBS never became reachable within the retry budget.
  useEffect(() => {
    if (obs.hasTimedOut) {
      awaitingConnectRef.current = false;
      toast.error("OBS isn't responding", {
        description: "Your container's running, but OBS never came online.",
        action: { label: "Retry", onClick: () => obs.reconnect() },
      });
    }
  }, [obs.hasTimedOut, obs.reconnect]);

  return {
    instanceId,
    apiUrl,
    containerStatus,
    obs,
    launching,
    launchError,
    togglingContainer,
    awaitingConnectRef,
    handleLaunch,
    handleToggleContainer,
    stopReason: session.stopReason,
    clearStopReason,
    transition: session.transition,
  };
}
