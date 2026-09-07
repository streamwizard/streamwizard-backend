"use client";

import { useSyncExternalStore } from "react";

/** The platform never changes mid-session, so there is nothing to subscribe to. */
const subscribeToNothing = () => () => {};

/**
 * What the `"Mod"` token in a shortcut renders as: Cmd on a Mac, Ctrl anywhere
 * else. The platform is only known in the browser, so the server and the
 * first client render both say Ctrl and the Mac label lands on hydration.
 */
export function useModKeyLabel(): "Cmd" | "Ctrl" {
  const isMac = useSyncExternalStore(
    subscribeToNothing,
    () => /Mac|iPhone|iPad|iPod/.test(navigator.userAgent),
    () => false
  );
  return isMac ? "Cmd" : "Ctrl";
}
