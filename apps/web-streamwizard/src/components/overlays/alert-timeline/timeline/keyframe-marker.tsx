"use client";

import { moveKeyframe, type AlertScene, type Clip, type Keyframe, type PropName } from "@repo/alert-scene";
import { cn } from "@repo/ui";
import { moveKeyframeCommand } from "../commands";
import { formatTimecode } from "../format-time";
import { keyframeTimesForClip } from "../keyframe-nav";
import { keyframeTime } from "../prop-writer";
import { useTimeline, useTimelineStoreApi } from "../timeline-context";
import { usePointerDrag } from "../use-pointer-drag";
import { msToPx, niceTickMs, pxToMs, snapCandidates, snapTime } from "./timeline-math";

interface Gesture {
  scene: AlertScene;
  pxPerMs: number;
  candidates: number[];
  min: number;
  max: number;
  /** Where the keyframe sat at pointer-down; the prop updates with the draft. */
  from: number;
  /** Result of the last move, committed on release. */
  time: number;
}

/**
 * One keyframe on a property row. Click selects it (and its clip), drag
 * re-times it within the clip with the usual snapping, double-click parks
 * the playhead on it. Landing on another keyframe replaces that one, the
 * same way the scene op does.
 */
export function KeyframeMarker({ clip, prop, keyframe, locked }: { clip: Clip; prop: PropName; keyframe: Keyframe; locked: boolean }) {
  const api = useTimelineStoreApi();
  const pxPerMs = useTimeline((s) => s.pxPerMs);
  const selected = useTimeline((s) => s.selection.keyframe?.keyframeId === keyframe.id);

  const drag = usePointerDrag<Gesture>({
    onStart: () => {
      const s = api.getState();
      if (s.playing) s.setPlaying(false);
      s.selectKeyframe(clip.id, prop, keyframe.id);
      if (locked) return null;
      const committed = s.scene;
      const others = keyframeTimesForClip(clip).filter((t) => t !== keyframe.time);
      return {
        scene: committed,
        pxPerMs: s.pxPerMs,
        candidates: [
          ...snapCandidates(committed.layers, { playhead: s.playhead, duration: committed.duration, tickMs: niceTickMs(s.pxPerMs) / 4 }),
          ...others,
        ],
        min: clip.start,
        max: clip.end,
        from: keyframe.time,
        time: keyframe.time,
      };
    },
    onMove: (m, g) => {
      const s = api.getState();
      const snapOn = s.snap !== m.altKey;
      let t = g.from + pxToMs(m.dx, g.pxPerMs);
      if (snapOn) {
        const snapped = snapTime(t, g.candidates, g.pxPerMs);
        if (snapped.snapped) t = snapped.time;
      }
      t = keyframeTime(Math.min(g.max, Math.max(g.min, t)));
      g.time = t;
      s.setDraft(t === g.from ? null : moveKeyframe(g.scene, clip.id, prop, keyframe.id, t));
    },
    onEnd: (m, g) => {
      const s = api.getState();
      if (!m.moved || g.time === g.from) {
        s.commitDraft(null);
        return;
      }
      s.commitDraft(moveKeyframeCommand(g.scene, clip.id, prop, keyframe.id, g.time));
    },
    onCancel: () => api.getState().commitDraft(null),
  });

  return (
    <button
      type="button"
      aria-label={`Keyframe at ${formatTimecode(keyframe.time)}`}
      aria-pressed={selected}
      data-keyframe-id={keyframe.id}
      onPointerDown={drag.onPointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        const s = api.getState();
        s.setPlaying(false);
        s.setPlayhead(keyframe.time);
      }}
      className={cn(
        "absolute top-1/2 z-10 flex size-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-sm outline-none",
        locked ? "cursor-not-allowed" : drag.dragging ? "cursor-grabbing" : "cursor-grab",
        "focus-visible:ring-2 focus-visible:ring-ring"
      )}
      style={{ left: msToPx(keyframe.time, pxPerMs) }}
    >
      <span
        className={cn(
          "block size-2 rotate-45 border transition-colors",
          selected ? "border-primary bg-primary shadow-[0_0_0_2px_var(--background)]" : "border-foreground/70 bg-background hover:bg-foreground/80"
        )}
      />
    </button>
  );
}
