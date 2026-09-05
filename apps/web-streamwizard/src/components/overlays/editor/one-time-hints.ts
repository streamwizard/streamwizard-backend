/**
 * One-time editor hints.
 *
 * Some things are only worth saying once: the first clip widget someone adds
 * starts at half volume, and after they know that, a toast every time is noise.
 * The flag lives in localStorage so it follows the streamer across scenes and
 * sessions, and a browser refusing storage falls back to once per page load.
 */

export const CLIP_VOLUME_HINT_KEY = "overlay-editor-clip-volume-hint-seen";

/** Hints already shown this page load, for a browser that refuses storage. */
const shownThisLoad = new Set<string>();

/**
 * True the first time it is called for a hint, false every time after, and
 * records the hint as shown. Call it only where the hint would be displayed.
 */
export function claimOneTimeHint(key: string): boolean {
  if (shownThisLoad.has(key)) return false;
  shownThisLoad.add(key);

  if (typeof window === "undefined") return false;

  try {
    if (window.localStorage.getItem(key) === "true") return false;
    window.localStorage.setItem(key, "true");
  } catch {
    // Nothing saved, so the hint comes back on the next visit. Still once here.
  }

  return true;
}

/** Test seam: forgets what this page load has shown. */
export function resetOneTimeHintsForTest() {
  shownThisLoad.clear();
}
