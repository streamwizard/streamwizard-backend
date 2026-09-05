import type { FireMode } from "./demo-fire";

/**
 * Below this, a Live simulator is more round trips than the server action
 * should take. Local has no such cost, so the cap only applies to Live.
 */
export const MIN_LIVE_INTERVAL_MS = 1000;

export const TOO_FAST_FOR_LIVE_HINT = "Too fast for Live. Switch to Local to run it.";

/**
 * Whether a simulator's menu item can be clicked, and the line shown under
 * its label. A running one is always clickable: the cap stops starts, never
 * stops, so switching to Live mid-loop leaves a way to halt it.
 */
export function simulatorItemState(input: {
  mode: FireMode;
  running: boolean;
  intervalMs: number;
  description: string;
}): { disabled: boolean; hint: string } {
  const tooFast = input.mode === "live" && input.intervalMs < MIN_LIVE_INTERVAL_MS;
  if (tooFast && !input.running) {
    return { disabled: true, hint: TOO_FAST_FOR_LIVE_HINT };
  }
  return { disabled: false, hint: input.description };
}
