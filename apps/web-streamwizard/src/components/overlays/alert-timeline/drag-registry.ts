/**
 * The one drag that may be live at a time. Lets the dialog's Escape handler
 * cancel a drag it knows nothing about, without threading refs through every
 * track and handle.
 */

let active: { cancel: () => void } | null = null;

/** Registers a drag. Returns the release to call when it ends normally. */
export function beginDrag(cancel: () => void): () => void {
  const entry = { cancel };
  active = entry;
  return () => {
    if (active === entry) active = null;
  };
}

/** Cancels the live drag, if any. True when there was one. */
export function cancelActiveDrag(): boolean {
  const entry = active;
  if (!entry) return false;
  active = null;
  entry.cancel();
  return true;
}

export function isDragging(): boolean {
  return active !== null;
}
