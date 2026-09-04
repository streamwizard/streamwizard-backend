/**
 * Per-modal editor state. One store per open dialog, created in useState and
 * dropped with it, so nothing survives a close. The scene document itself is
 * only ever changed through commands (undo/redo) or a draft (live preview of
 * a gesture that becomes one command on release).
 */

import { createStore, type StoreApi } from "zustand/vanilla";
import { findClip, type AlertScene, type PropName } from "@repo/alert-scene";
import type { Command } from "./commands";
import { DEFAULT_PX_PER_MS, clampPxPerMs } from "./timeline/timeline-math";

export const HISTORY_LIMIT = 100;
/** Commands sharing a coalesceKey inside this window become one undo step. */
export const COALESCE_WINDOW_MS = 400;

export interface KeyframeSelection {
  clipId: string;
  prop: PropName;
  keyframeId: string;
}

export interface Selection {
  layerId: string | null;
  clipId: string | null;
  keyframe: KeyframeSelection | null;
}

interface HistoryEntry {
  command: Command;
  at: number;
}

export interface TimelineState {
  scene: AlertScene;
  /** What the overlay holds; null for a timeline that was never saved. */
  savedScene: AlertScene | null;
  /** True when Save would change the overlay. */
  dirty: boolean;
  /** Gesture preview; when set, the UI renders this instead of `scene`. */
  draft: AlertScene | null;
  past: HistoryEntry[];
  future: HistoryEntry[];
  selection: Selection;
  playhead: number;
  playing: boolean;
  loop: boolean;
  pxPerMs: number;
  snap: boolean;
  /** Layers whose animated properties are unfolded in the timeline. Session only. */
  expandedLayerIds: Record<string, true>;
  /** Inspector: one scale field drives both axes. Session only. */
  uniformScale: boolean;

  execute(command: Command): void;
  undo(): void;
  redo(): void;
  setDraft(scene: AlertScene | null): void;
  /** Ends a gesture: drops the draft and records its one command. */
  commitDraft(command: Command | null): void;
  select(selection: Partial<Selection>): void;
  /** Selects a keyframe together with its clip and layer. */
  selectKeyframe(clipId: string, prop: PropName, keyframeId: string): void;
  clearSelection(): void;
  toggleLayerExpanded(layerId: string): void;
  setLayerExpanded(layerId: string, expanded: boolean): void;
  setUniformScale(uniform: boolean): void;
  setPlayhead(ms: number): void;
  setPlaying(playing: boolean): void;
  setLoop(loop: boolean): void;
  setPxPerMs(v: number): void;
  setSnap(snap: boolean): void;
  markSaved(): void;
}

export type TimelineStore = StoreApi<TimelineState>;

const EMPTY_SELECTION: Selection = { layerId: null, clipId: null, keyframe: null };

/** Drops selection that points at things the scene no longer has. */
function pruneSelection(scene: AlertScene, selection: Selection): Selection {
  let next = selection;
  if (next.clipId && !findClip(scene, next.clipId)) next = { ...next, clipId: null, keyframe: null };
  if (next.layerId && !scene.layers.some((l) => l.id === next.layerId)) next = { ...next, layerId: null };
  if (next.keyframe) {
    const loc = findClip(scene, next.keyframe.clipId);
    const track = loc?.clip.tracks[next.keyframe.prop];
    if (!track?.keyframes.some((k) => k.id === next.keyframe!.keyframeId)) next = { ...next, keyframe: null };
  }
  return next;
}

function mergeCommands(older: Command, newer: Command): Command {
  return {
    label: newer.label,
    coalesceKey: newer.coalesceKey,
    apply: (s) => newer.apply(older.apply(s)),
    invert: (s) => older.invert(newer.invert(s)),
  };
}

/**
 * Undo back to the saved state must read as clean, and undo produces a new
 * object, so compare structurally. Scenes are small; this only runs on edits.
 */
export function computeDirty(scene: AlertScene, savedScene: AlertScene | null): boolean {
  if (savedScene === null) return true;
  if (scene === savedScene) return false;
  return JSON.stringify(scene) !== JSON.stringify(savedScene);
}

export function isDirty(state: Pick<TimelineState, "dirty">): boolean {
  return state.dirty;
}

export function visibleScene(state: Pick<TimelineState, "scene" | "draft">): AlertScene {
  return state.draft ?? state.scene;
}

export interface TimelineStoreOptions {
  /** False for a freshly seeded timeline: Save is meaningful before any edit. */
  saved?: boolean;
  now?: () => number;
}

export function createTimelineStore(initial: AlertScene, options: TimelineStoreOptions = {}): TimelineStore {
  const now = options.now ?? (() => Date.now());
  const savedScene = options.saved === false ? null : initial;
  return createStore<TimelineState>((set, get) => ({
    scene: initial,
    savedScene,
    dirty: computeDirty(initial, savedScene),
    draft: null,
    past: [],
    future: [],
    selection: EMPTY_SELECTION,
    playhead: 0,
    playing: false,
    loop: false,
    pxPerMs: DEFAULT_PX_PER_MS,
    snap: true,
    expandedLayerIds: {},
    uniformScale: false,

    execute: (command) => {
      const { scene, past, selection } = get();
      const next = command.apply(scene);
      const at = now();
      const last = past[past.length - 1];
      let nextPast: HistoryEntry[];
      if (last && command.coalesceKey && last.command.coalesceKey === command.coalesceKey && at - last.at <= COALESCE_WINDOW_MS) {
        nextPast = [...past.slice(0, -1), { command: mergeCommands(last.command, command), at }];
      } else {
        nextPast = [...past, { command, at }].slice(-HISTORY_LIMIT);
      }
      set({
        scene: next,
        dirty: computeDirty(next, get().savedScene),
        draft: null,
        past: nextPast,
        future: [],
        selection: pruneSelection(next, selection),
      });
    },

    undo: () => {
      const { scene, past, future, selection } = get();
      const entry = past[past.length - 1];
      if (!entry) return;
      const next = entry.command.invert(scene);
      set({
        scene: next,
        dirty: computeDirty(next, get().savedScene),
        draft: null,
        past: past.slice(0, -1),
        future: [...future, entry],
        selection: pruneSelection(next, selection),
      });
    },

    redo: () => {
      const { scene, past, future, selection } = get();
      const entry = future[future.length - 1];
      if (!entry) return;
      const next = entry.command.apply(scene);
      set({
        scene: next,
        dirty: computeDirty(next, get().savedScene),
        draft: null,
        past: [...past, { ...entry, at: now() }],
        future: future.slice(0, -1),
        selection: pruneSelection(next, selection),
      });
    },

    setDraft: (draft) => set({ draft }),

    commitDraft: (command) => {
      if (command) get().execute(command);
      else set({ draft: null });
    },

    select: (partial) => set((s) => ({ selection: { ...s.selection, ...partial } })),
    selectKeyframe: (clipId, prop, keyframeId) => {
      const loc = findClip(get().scene, clipId);
      if (!loc) return;
      set({ selection: { layerId: loc.layer.id, clipId, keyframe: { clipId, prop, keyframeId } } });
    },
    clearSelection: () => set({ selection: EMPTY_SELECTION }),
    toggleLayerExpanded: (layerId) =>
      set((s) => {
        const next = { ...s.expandedLayerIds };
        if (next[layerId]) delete next[layerId];
        else next[layerId] = true;
        return { expandedLayerIds: next };
      }),
    setLayerExpanded: (layerId, expanded) =>
      set((s) => {
        const next = { ...s.expandedLayerIds };
        if (expanded) next[layerId] = true;
        else delete next[layerId];
        return { expandedLayerIds: next };
      }),
    setUniformScale: (uniformScale) => set({ uniformScale }),

    setPlayhead: (ms) => {
      const { scene } = get();
      set({ playhead: Math.min(scene.duration, Math.max(0, ms)) });
    },
    setPlaying: (playing) => set({ playing }),
    setLoop: (loop) => set({ loop }),
    setPxPerMs: (v) => set({ pxPerMs: clampPxPerMs(v) }),
    setSnap: (snap) => set({ snap }),
    markSaved: () => set((s) => ({ savedScene: s.scene, dirty: false })),
  }));
}
