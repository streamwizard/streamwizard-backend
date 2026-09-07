"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useOverlayStore } from "@/stores/overlay-editor-store";
import {
  clearOverlayDraft,
  isDraftNewerThan,
  parseOverlayDraft,
  readOverlayDraftRaw,
  writeOverlayDraft,
} from "@/lib/overlay-draft";
import type { OverlaySceneWithItems } from "@/types/overlays";

/** Long enough that a drag writes once, short enough to survive a crash. */
const DRAFT_WRITE_DEBOUNCE_MS = 1000;

/**
 * What localStorage held when this scene was first opened.
 *
 * Cached because the editor writes drafts of its own while you work: reading
 * live would mean the prompt watched its own output, and `useSyncExternalStore`
 * needs a snapshot that stops changing.
 */
const openingDraft = new Map<string, string | null>();

function openingDraftSnapshot(sceneId: string): string | null {
  if (!openingDraft.has(sceneId)) {
    openingDraft.set(sceneId, readOverlayDraftRaw(sceneId));
  }
  return openingDraft.get(sceneId) ?? null;
}

/** The snapshot is fixed for the session; nothing to subscribe to. */
const subscribeToNothing = () => () => {};

export interface OverlayDraftPrompt {
  open: boolean;
  savedAt: string | null;
  onRestore: () => void;
  onDiscard: () => void;
}

/**
 * Keeps unsaved editor state in localStorage and offers it back after a reload.
 *
 * The offer is deliberate rather than automatic: restoring silently would
 * resurrect stale work over changes saved from another tab or machine, which is
 * worse than losing the draft.
 */
export function useOverlayDraft(initialScene: OverlaySceneWithItems): OverlayDraftPrompt {
  const scene = useOverlayStore((state) => state.scene);
  const isDirty = useOverlayStore((state) => state.isDirty);
  const setScene = useOverlayStore((state) => state.setScene);
  const markDirty = useOverlayStore((state) => state.markDirty);

  const sceneId = initialScene.id;
  const serverUpdatedAt = initialScene.updated_at;

  // localStorage only exists in the browser, so the server render and the first
  // client render agree on "no draft" and the offer appears once hydrated.
  const raw = useSyncExternalStore(
    subscribeToNothing,
    useCallback(() => openingDraftSnapshot(sceneId), [sceneId]),
    () => null
  );

  const offered = useMemo(() => {
    const draft = parseOverlayDraft(raw, sceneId);
    return draft && isDraftNewerThan(draft, serverUpdatedAt) ? draft : null;
  }, [raw, sceneId, serverUpdatedAt]);

  const [decided, setDecided] = useState(false);
  const settled = decided || offered === null;

  // A draft older than the server's copy is stale work; drop it rather than
  // leave it to be offered on some later visit.
  useEffect(() => {
    if (offered !== null || raw === null) return;
    clearOverlayDraft(sceneId);
  }, [offered, raw, sceneId]);

  useEffect(() => {
    if (!settled || !scene || !isDirty) return;
    const timer = setTimeout(
      () => writeOverlayDraft(scene.id, scene.items),
      DRAFT_WRITE_DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
  }, [settled, scene, isDirty]);

  // A save — or any other return to clean — makes the draft redundant.
  useEffect(() => {
    if (!settled || !scene || isDirty) return;
    clearOverlayDraft(scene.id);
    openingDraft.set(scene.id, null);
  }, [settled, scene, isDirty]);

  const onRestore = useCallback(() => {
    if (offered) {
      setScene({ ...initialScene, items: offered.items });
      // setScene lands a clean scene; restored work is unsaved by definition.
      markDirty();
    }
    setDecided(true);
  }, [offered, initialScene, setScene, markDirty]);

  const onDiscard = useCallback(() => {
    clearOverlayDraft(sceneId);
    openingDraft.set(sceneId, null);
    setDecided(true);
  }, [sceneId]);

  return {
    open: !decided && offered !== null,
    savedAt: offered?.savedAt ?? null,
    onRestore,
    onDiscard,
  };
}
