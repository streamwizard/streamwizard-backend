import type { OverlayItem } from "@/types/overlays";

/**
 * Unsaved editor state, parked in localStorage so a crash or an accidental
 * reload doesn't take the work with it.
 *
 * Items only. Widget source is fetched fresh and would blow the quota for
 * nothing, and everything else about the scene comes back from the server.
 */
export interface OverlayDraft {
  sceneId: string;
  items: OverlayItem[];
  savedAt: string;
}

const DRAFT_KEY_PREFIX = "overlay-draft:";

/** localStorage is roughly 5MB per origin; a draft has no business near that. */
const MAX_DRAFT_CHARS = 2_000_000;

function keyFor(sceneId: string) {
  return `${DRAFT_KEY_PREFIX}${sceneId}`;
}

/** The stored string, or null. Kept separate so callers can memo on a stable value. */
export function readOverlayDraftRaw(sceneId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(keyFor(sceneId));
  } catch {
    return null;
  }
}

/** Parses a stored draft, returning null for anything that isn't one. */
export function parseOverlayDraft(raw: string | null, sceneId: string): OverlayDraft | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as OverlayDraft).sceneId !== sceneId ||
      !Array.isArray((parsed as OverlayDraft).items) ||
      typeof (parsed as OverlayDraft).savedAt !== "string"
    ) {
      return null;
    }
    return parsed as OverlayDraft;
  } catch {
    return null;
  }
}

export function readOverlayDraft(sceneId: string): OverlayDraft | null {
  return parseOverlayDraft(readOverlayDraftRaw(sceneId), sceneId);
}

export function writeOverlayDraft(sceneId: string, items: OverlayItem[]) {
  if (typeof window === "undefined") return;

  const payload = JSON.stringify({
    sceneId,
    items,
    savedAt: new Date().toISOString(),
  } satisfies OverlayDraft);

  // A scene too big to store is better off with no draft than with a write that
  // throws on every edit and leaves a half-written one behind.
  if (payload.length > MAX_DRAFT_CHARS) {
    clearOverlayDraft(sceneId);
    return;
  }

  try {
    window.localStorage.setItem(keyFor(sceneId), payload);
  } catch {
    clearOverlayDraft(sceneId);
  }
}

export function clearOverlayDraft(sceneId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(keyFor(sceneId));
  } catch {
    // A browser that won't let us remove it won't let us write it either.
  }
}

/**
 * Whether a draft is worth offering. A draft older than the server's copy is
 * stale work — restoring it would undo whatever was saved from somewhere else.
 */
export function isDraftNewerThan(draft: OverlayDraft, serverUpdatedAt: string): boolean {
  const draftAt = Date.parse(draft.savedAt);
  if (!Number.isFinite(draftAt)) return false;

  const serverAt = Date.parse(serverUpdatedAt);
  if (!Number.isFinite(serverAt)) return true;

  return draftAt > serverAt;
}
