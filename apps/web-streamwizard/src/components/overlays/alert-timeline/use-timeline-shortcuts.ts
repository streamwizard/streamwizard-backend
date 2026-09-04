"use client";

import { useCallback } from "react";
import { findClip } from "@repo/alert-scene";
import { activatableControl } from "@/components/overlays/editor/space-activation";
import {
  deleteClipCommand,
  deleteKeyframeCommand,
  duplicateClipCommand,
  duplicateLayerCommand,
  moveClipCommand,
  removeLayerCommand,
  rippleDeleteCommand,
  splitClipCommand,
} from "./commands";
import { keyframeTimesForClip, nextKeyframeTime, prevKeyframeTime } from "./keyframe-nav";
import { usePlayback, useTimelineStoreApi, useTimelineView } from "./timeline-context";
import { clampClipMove, frameMs, neighboursOf } from "./timeline/timeline-math";

const TYPING_TAGS = /^(INPUT|TEXTAREA|SELECT)$/;

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || TYPING_TAGS.test(el.tagName));
}

export interface TimelineShortcutOptions {
  onSave: () => void;
}

/** What the handler reads; satisfied by React's synthetic event and by a picked native one. */
export interface ShortcutKeyEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
  currentTarget: EventTarget | null;
  preventDefault(): void;
  stopPropagation(): void;
}

/**
 * Keyboard bindings for the modal. Bound on the dialog content so they work
 * anywhere inside it, and every handled key stops propagating so the overlay
 * editor's window listener (Mod+S, ?) never sees it.
 */
export function useTimelineShortcuts({ onSave }: TimelineShortcutOptions) {
  const api = useTimelineStoreApi();
  const { controls } = usePlayback();
  const view = useTimelineView();

  return useCallback(
    (e: ShortcutKeyEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const handled = () => {
        e.preventDefault();
        e.stopPropagation();
      };

      // Save works from inside a field too; nothing else does.
      if (mod && e.key.toLowerCase() === "s") {
        handled();
        onSave();
        return;
      }
      if (isTyping(e.target)) return;
      // Nested Radix surfaces (a select list, the discard dialog) keep their own keys.
      const surface = (e.target as HTMLElement | null)?.closest('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]');
      if (surface && surface !== e.currentTarget) return;

      const state = api.getState();
      const { scene, selection } = state;

      switch (e.key) {
        case " ": {
          handled();
          // A clicked transport button would otherwise fire again on Space.
          activatableControl(e.target as HTMLElement)?.blur?.();
          controls.toggle();
          state.setPlaying(controls.isPlaying());
          return;
        }
        case "Home":
          handled();
          state.setPlayhead(0);
          view.scrollToTime(0);
          return;
        case "End":
          handled();
          state.setPlayhead(scene.duration);
          view.scrollToTime(scene.duration);
          return;
        case "ArrowLeft":
        case "ArrowRight": {
          handled();
          const dir = e.key === "ArrowLeft" ? -1 : 1;
          const step = frameMs(scene.fps) * (e.shiftKey ? 10 : 1);
          if (selection.clipId) {
            const loc = findClip(scene, selection.clipId);
            if (!loc || loc.layer.locked) return;
            const delta = clampClipMove(loc.clip, dir * step, neighboursOf(loc.layer.clips, loc.clip.id));
            if (delta !== 0) state.execute({ ...moveClipCommand(loc.clip.id, delta), coalesceKey: `nudge:${loc.clip.id}` });
            return;
          }
          state.setPlayhead(state.playhead + dir * step);
          return;
        }
        case "Delete":
        case "Backspace": {
          handled();
          if (selection.keyframe) {
            const k = selection.keyframe;
            const cmd = deleteKeyframeCommand(scene, k.clipId, k.prop, k.keyframeId, state.playhead);
            if (cmd) state.execute(cmd);
            return;
          }
          if (selection.clipId) {
            const loc = findClip(scene, selection.clipId);
            if (!loc || loc.layer.locked) return;
            // Shift closes the gap the clip leaves behind.
            const cmd = e.shiftKey ? rippleDeleteCommand(scene, loc.clip.id) : deleteClipCommand(scene, loc.clip.id);
            if (cmd) state.execute(cmd);
            return;
          }
          if (selection.layerId) {
            const cmd = removeLayerCommand(scene, selection.layerId);
            if (cmd) state.execute(cmd);
          }
          return;
        }
        case "s":
        case "S": {
          if (mod) return;
          handled();
          if (!selection.clipId) return;
          const cmd = splitClipCommand(scene, selection.clipId, state.playhead);
          if (cmd) state.execute(cmd);
          return;
        }
        case "d":
        case "D": {
          if (!mod) return;
          // Handled even when nothing is selected: the browser's bookmark dialog must never open.
          handled();
          if (selection.clipId) {
            const loc = findClip(scene, selection.clipId);
            if (!loc || loc.layer.locked) return;
            const res = duplicateClipCommand(scene, loc.clip.id);
            if (!res) return;
            state.execute(res.command);
            state.select({ layerId: res.layerId, clipId: res.clipId, keyframe: null });
            return;
          }
          if (selection.layerId) {
            const res = duplicateLayerCommand(scene, selection.layerId);
            if (!res) return;
            state.execute(res.command);
            state.select({ layerId: res.layerId, clipId: null, keyframe: null });
          }
          return;
        }
        case "l":
        case "L":
          if (mod) return;
          handled();
          state.setLoop(!state.loop);
          return;
        case "j":
        case "J":
        case "k":
        case "K": {
          if (mod) return;
          handled();
          if (!selection.clipId) return;
          const loc = findClip(scene, selection.clipId);
          if (!loc) return;
          const times = keyframeTimesForClip(loc.clip);
          const t = e.key.toLowerCase() === "j" ? prevKeyframeTime(times, state.playhead) : nextKeyframeTime(times, state.playhead);
          if (t === null) return;
          state.setPlaying(false);
          state.setPlayhead(t);
          view.scrollToTime(t);
          return;
        }
        case "=":
        case "+":
          handled();
          view.zoomBy(1.25);
          return;
        case "-":
        case "_":
          handled();
          view.zoomBy(0.8);
          return;
        case "0":
          if (!e.shiftKey) return;
          handled();
          view.fit();
          return;
        case "z":
        case "Z":
          if (!mod) return;
          handled();
          if (e.shiftKey) state.redo();
          else state.undo();
          return;
        case "y":
        case "Y":
          if (!mod) return;
          handled();
          state.redo();
          return;
        default:
          return;
      }
    },
    [api, controls, onSave, view]
  );
}
