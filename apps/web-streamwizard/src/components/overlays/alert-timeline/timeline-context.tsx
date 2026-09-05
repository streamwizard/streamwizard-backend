"use client";

import { createContext, useContext, type RefObject } from "react";
import { useStore } from "zustand";
import type { SceneStageHandle, ScenePlaybackControls } from "@repo/alert-scene/renderer";
import type { TimelineState, TimelineStore } from "./timeline-store";

const StoreContext = createContext<TimelineStore | null>(null);
export const TimelineStoreProvider = StoreContext.Provider;

export function useTimelineStoreApi(): TimelineStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useTimelineStoreApi: no TimelineStoreProvider above");
  return store;
}

/** Subscribe to a slice. Return primitives or stable references from the selector. */
export function useTimeline<T>(selector: (state: TimelineState) => T): T {
  return useStore(useTimelineStoreApi(), selector);
}

export interface EditorPlayback {
  controls: ScenePlaybackControls;
  /** Test: rewind to 0 and play through once, ignoring the loop toggle. */
  playOnce(): void;
  stageRef: RefObject<SceneStageHandle | null>;
  /** The scrolling track pane; focus target for shortcuts, anchor for zoom. */
  paneRef: RefObject<HTMLDivElement | null>;
}

const PlaybackContext = createContext<EditorPlayback | null>(null);
export const PlaybackProvider = PlaybackContext.Provider;

export function usePlayback(): EditorPlayback {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error("usePlayback: no PlaybackProvider above");
  return ctx;
}

export interface TimelineView {
  /** Zoom to `pxPerMs`, keeping the time under `cursorViewportPx` (or the playhead) in place. */
  zoomTo(pxPerMs: number, cursorViewportPx?: number): void;
  zoomBy(factor: number): void;
  fit(): void;
  scrollToTime(ms: number): void;
}

const ViewContext = createContext<TimelineView | null>(null);
export const TimelineViewProvider = ViewContext.Provider;

export function useTimelineView(): TimelineView {
  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error("useTimelineView: no TimelineViewProvider above");
  return ctx;
}
