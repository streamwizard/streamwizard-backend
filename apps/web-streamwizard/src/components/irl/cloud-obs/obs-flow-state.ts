/**
 * Turns "what the container is doing" plus "what the OBS socket is doing" into
 * the handful of booleans the dashboard renders from. Pure — every input is
 * passed in, so the phase logic can be read (and corrected) in one place
 * instead of being spread across a 500-line component.
 */

export type ContainerStatus = "running" | "stopped" | "unknown";

export interface ObsFlowInput {
  containerStatus: ContainerStatus;
  launching: boolean;
  togglingContainer: boolean;
  obsStatus: "closed" | "connecting" | "open";
  obsHasTimedOut: boolean;
  obsIsAutoRetrying: boolean;
  /** Why the container last stopped, from the lifecycle feed. */
  stopReason: string | null;
  /** Transitional lifecycle state driven by another device or an admin. */
  transition: "starting" | "stopping" | null;
}

export interface ObsFlowState {
  /** Server action in flight for a *start* — the box isn't up yet. */
  isProvisioning: boolean;
  /** Container up, OBS websocket still connecting or retrying. */
  isBooting: boolean;
  inLaunchFlow: boolean;
  /** Container is up but OBS never answered within the retry budget. */
  hasTimedOut: boolean;
  /**
   * Whether to show the idle "offline" state (with a Start button) rather than
   * the booting loader. Only true once we *know* the box is stopped and nothing
   * is launching, or after a boot timeout — anything else (initial lookup still
   * resolving, launch in flight, socket connecting) is a loading state, so a
   * refresh doesn't flash "offline" before we know the real status.
   */
  stripIsOffline: boolean;
  crashed: boolean;
  /** A deliberate stop from elsewhere, so the UI reads "Stopping…". */
  isStopping: boolean;
  /** A start from elsewhere; the local actor sees `inLaunchFlow` instead. */
  externalStarting: boolean;
}

export function deriveObsFlowState(input: ObsFlowInput): ObsFlowState {
  const {
    containerStatus,
    launching,
    togglingContainer,
    obsStatus,
    obsHasTimedOut,
    obsIsAutoRetrying,
    stopReason,
    transition,
  } = input;

  const isProvisioning = launching || (togglingContainer && containerStatus !== "running");
  const isBooting =
    !isProvisioning &&
    containerStatus === "running" &&
    obsStatus !== "open" &&
    !obsHasTimedOut &&
    (obsStatus === "connecting" || obsIsAutoRetrying);
  const inLaunchFlow = isProvisioning || isBooting;
  const hasTimedOut = containerStatus === "running" && obsHasTimedOut && obsStatus !== "open";

  return {
    isProvisioning,
    isBooting,
    inLaunchFlow,
    hasTimedOut,
    stripIsOffline: hasTimedOut || (containerStatus === "stopped" && !isProvisioning),
    crashed: containerStatus === "stopped" && stopReason === "crashed",
    isStopping: transition === "stopping" && obsStatus !== "open",
    externalStarting: transition === "starting" && !inLaunchFlow && obsStatus !== "open",
  };
}
