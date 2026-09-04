"use client";

import { moveClip, trimClip, type AlertScene, type Clip, type Layer } from "@repo/alert-scene";
import { cn } from "@repo/ui";
import { moveClipCommand, trimClipCommand } from "../commands";
import { keyframeTimesForClip } from "../keyframe-nav";
import { useTimeline, useTimelineStoreApi } from "../timeline-context";
import { usePointerDrag } from "../use-pointer-drag";
import { LAYER_CLIP_CLASSES } from "./layer-colors";
import { ROW_HEIGHT_PX, TRIM_HANDLE_PX } from "./timeline-constants";
import {
  clampClipMove,
  clampClipTrim,
  msToPx,
  neighboursOf,
  niceTickMs,
  pxToMs,
  snapCandidates,
  snapTime,
  type Neighbours,
} from "./timeline-math";

type Mode = "move" | "start" | "end";

interface Gesture {
  mode: Mode;
  /** The committed scene at pointer-down; every draft derives from it. */
  scene: AlertScene;
  clip: Clip;
  pxPerMs: number;
  neighbours: Neighbours;
  candidates: number[];
  /** Result of the last move, committed on release. */
  delta: number;
  time: number;
}

function clipLabel(clip: Clip, layer: Layer): string {
  if (clip.source.kind === "text") return clip.source.text.trim() || layer.name || "Text";
  return layer.name || clip.source.kind;
}

export function ClipBlock({ clip, layer }: { clip: Clip; layer: Layer }) {
  const api = useTimelineStoreApi();
  const pxPerMs = useTimeline((s) => s.pxPerMs);
  const selected = useTimeline((s) => s.selection.clipId === clip.id);
  const expanded = useTimeline((s) => !!s.expandedLayerIds[layer.id]);
  const left = msToPx(clip.start, pxPerMs);
  // Folded clips still hint at their keyframes along the bottom edge.
  const keyframeTimes = expanded ? [] : keyframeTimesForClip(clip);
  const width = Math.max(2, msToPx(clip.end - clip.start, pxPerMs));

  const drag = usePointerDrag<Gesture>({
    onStart: (e) => {
      const s = api.getState();
      s.select({ layerId: layer.id, clipId: clip.id, keyframe: null });
      if (layer.locked) return null;
      const target = e.target as HTMLElement;
      const mode = (target.dataset.trim as Mode | undefined) ?? "move";
      const committed = s.scene;
      const liveLayer = committed.layers.find((l) => l.id === layer.id) ?? layer;
      return {
        mode,
        scene: committed,
        clip,
        pxPerMs: s.pxPerMs,
        neighbours: neighboursOf(liveLayer.clips, clip.id),
        candidates: snapCandidates(committed.layers, {
          playhead: s.playhead,
          duration: committed.duration,
          excludeClipId: clip.id,
          tickMs: niceTickMs(s.pxPerMs) / 4,
        }),
        delta: 0,
        time: mode === "end" ? clip.end : clip.start,
      };
    },
    onMove: (m, g) => {
      const s = api.getState();
      const snapOn = s.snap !== m.altKey;
      const dt = pxToMs(m.dx, g.pxPerMs);
      try {
        if (g.mode === "move") {
          let delta = clampClipMove(g.clip, dt, g.neighbours);
          if (snapOn) {
            const a = snapTime(g.clip.start + delta, g.candidates, g.pxPerMs);
            const b = snapTime(g.clip.end + delta, g.candidates, g.pxPerMs);
            const aDist = Math.abs(a.time - (g.clip.start + delta));
            const bDist = Math.abs(b.time - (g.clip.end + delta));
            const pick = a.snapped && (!b.snapped || aDist <= bDist) ? a.time - g.clip.start : b.snapped ? b.time - g.clip.end : delta;
            delta = clampClipMove(g.clip, pick, g.neighbours);
          }
          g.delta = delta;
          s.setDraft(delta === 0 ? null : moveClip(g.scene, g.clip.id, delta));
          return;
        }
        const edge = g.mode;
        let t = clampClipTrim(g.clip, edge, g.clip[edge] + dt, g.neighbours);
        if (snapOn) {
          const snapped = snapTime(t, g.candidates, g.pxPerMs);
          if (snapped.snapped) t = clampClipTrim(g.clip, edge, snapped.time, g.neighbours);
        }
        g.time = t;
        s.setDraft(t === g.clip[edge] ? null : trimClip(g.scene, g.clip.id, edge, t));
      } catch {
        // A clamp should make this unreachable; leave the last good draft in place.
      }
    },
    onEnd: (m, g) => {
      const s = api.getState();
      if (!m.moved) {
        s.commitDraft(null);
        return;
      }
      if (g.mode === "move") {
        s.commitDraft(g.delta === 0 ? null : moveClipCommand(g.clip.id, g.delta));
        return;
      }
      s.commitDraft(g.time === g.clip[g.mode] ? null : trimClipCommand(g.scene, g.clip.id, g.mode, g.time));
    },
    onCancel: () => api.getState().commitDraft(null),
  });

  return (
    <div
      role="button"
      tabIndex={-1}
      aria-label={`${clipLabel(clip, layer)} clip`}
      aria-pressed={selected}
      onPointerDown={drag.onPointerDown}
      className={cn(
        "absolute top-1 flex items-center overflow-hidden rounded-md border text-xs shadow-sm",
        LAYER_CLIP_CLASSES[layer.type],
        layer.locked ? "cursor-not-allowed opacity-60" : drag.dragging ? "cursor-grabbing" : "cursor-grab",
        selected && "ring-2 ring-primary ring-offset-1 ring-offset-background"
      )}
      style={{ left, width, height: ROW_HEIGHT_PX - 8 }}
    >
      <span className="pointer-events-none truncate px-2 font-medium">{clipLabel(clip, layer)}</span>
      {keyframeTimes.map((t) => (
        <span
          key={t}
          aria-hidden
          data-mini-keyframe=""
          className="pointer-events-none absolute bottom-0.5 block size-1.5 -translate-x-1/2 rotate-45 bg-current opacity-80"
          style={{ left: msToPx(t - clip.start, pxPerMs) }}
        />
      ))}
      {!layer.locked && (
        <>
          <div data-trim="start" className="absolute inset-y-0 left-0 cursor-ew-resize hover:bg-white/20" style={{ width: TRIM_HANDLE_PX }} />
          <div data-trim="end" className="absolute inset-y-0 right-0 cursor-ew-resize hover:bg-white/20" style={{ width: TRIM_HANDLE_PX }} />
        </>
      )}
    </div>
  );
}
