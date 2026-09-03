"use client";

import { useCallback } from "react";
import { findClip, type PropName } from "@repo/alert-scene";
import { activatableControl } from "@/components/overlays/editor/space-activation";
import {
  compositeCommand,
  moveClipCommand,
  removeClipCommand,
  removeKeyframeCommand,
  removeLayerCommand,
  splitClipCommand,
} from "./commands";
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
            const cmd = removeKeyframeCommand(scene, selection.keyframe.clipId, selection.keyframe.prop as PropName, selection.keyframe.keyframeId);
            if (cmd) state.execute(cmd);
            return;
          }
          if (selection.clipId) {
            const loc = findClip(scene, selection.clipId);
            if (!loc || loc.layer.locked) return;
            const remove = removeClipCommand(scene, loc.clip.id);
            if (!remove) return;
            // An alert layer is its clip: emptying it deletes the row too.
            const layerGone = loc.layer.clips.length === 1 ? removeLayerCommand(scene, loc.layer.id) : null;
            state.execute(layerGone ? compositeCommand("Delete layer", [remove, layerGone]) : remove);
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
        case "l":
        case "L":
          if (mod) return;
          handled();
          state.setLoop(!state.loop);
          return;
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
