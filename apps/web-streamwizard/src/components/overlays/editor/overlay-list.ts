/**
 * Search, sort and favourites for the overlay library.
 *
 * Plain functions over the already-loaded list: at the scale of one streamer's
 * overlays there is nothing to gain from asking the server. The sort choice is
 * a working preference like the editor's canvas settings, so it lives in
 * localStorage and follows the user rather than the data.
 */

export interface ListableScene {
  name: string;
  created_at: string;
  updated_at: string;
  is_favourite: boolean;
}

export type OverlaySortKey = "updated" | "name" | "created";

export const OVERLAY_SORT_STORAGE_KEY = "overlay-list-sort";

/** Matches the order the server has always returned: most recently edited first. */
export const DEFAULT_OVERLAY_SORT: OverlaySortKey = "updated";

export const OVERLAY_SORT_OPTIONS: ReadonlyArray<{ key: OverlaySortKey; label: string }> = [
  { key: "updated", label: "Last edited" },
  { key: "name", label: "Name" },
  { key: "created", label: "Newest" },
];

export function isOverlaySortKey(value: unknown): value is OverlaySortKey {
  return value === "updated" || value === "name" || value === "created";
}

/** Case-insensitive "name contains" match. Blank or whitespace keeps everything. */
export function filterScenes<T extends ListableScene>(scenes: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return scenes;
  return scenes.filter((scene) => scene.name.toLowerCase().includes(needle));
}

function timestamp(value: string): number {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function compareBy(key: OverlaySortKey): (a: ListableScene, b: ListableScene) => number {
  switch (key) {
    case "name":
      // numeric: "Overlay 2" before "Overlay 10", the way a person would list them.
      return (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
    case "created":
      return (a, b) => timestamp(b.created_at) - timestamp(a.created_at);
    case "updated":
      return (a, b) => timestamp(b.updated_at) - timestamp(a.updated_at);
  }
}

/**
 * Favourites always come first, then the chosen order inside each group. Ties
 * keep their incoming order, so two scenes saved in the same instant do not
 * swap places between renders.
 */
export function sortScenes<T extends ListableScene>(scenes: T[], key: OverlaySortKey): T[] {
  const compare = compareBy(key);
  return [...scenes].sort((a, b) => {
    if (a.is_favourite !== b.is_favourite) return a.is_favourite ? -1 : 1;
    return compare(a, b);
  });
}

/**
 * The saved sort is read through `useSyncExternalStore`, so the server and the
 * first client paint both see the default and the stored choice lands right
 * after hydration without a state-in-effect dance.
 */
const listeners = new Set<() => void>();

/** Last value chosen this session, for a browser that refuses localStorage. */
let sessionSort: OverlaySortKey | null = null;

export function subscribeOverlaySort(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab changing the sort shows up here as a storage event.
  if (typeof window !== "undefined") window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", listener);
  };
}

export function readOverlaySort(): OverlaySortKey {
  if (typeof window === "undefined") return DEFAULT_OVERLAY_SORT;
  try {
    const raw = window.localStorage.getItem(OVERLAY_SORT_STORAGE_KEY);
    return isOverlaySortKey(raw) ? raw : DEFAULT_OVERLAY_SORT;
  } catch {
    return sessionSort ?? DEFAULT_OVERLAY_SORT;
  }
}

export function saveOverlaySort(key: OverlaySortKey) {
  sessionSort = key;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(OVERLAY_SORT_STORAGE_KEY, key);
    } catch {
      // Still sorted for this visit, just forgotten on the next one.
    }
  }
  for (const listener of listeners) listener();
}
