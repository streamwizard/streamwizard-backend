/**
 * The row list both timeline columns render. Building it once keeps the
 * header column and the track pane on the same rows, whatever is expanded.
 */

import type { AlertScene, Clip, KeyframeTrack, Layer, PropName } from "@repo/alert-scene";
import { ROW_HEIGHT_PX } from "./timeline-constants";

export const PROPERTY_ROW_HEIGHT_PX = 26;

export const PROP_LABELS: Record<PropName, string> = {
  x: "Position X",
  y: "Position Y",
  scaleX: "Scale X",
  scaleY: "Scale Y",
  rotation: "Rotation",
  opacity: "Opacity",
  anchorX: "Anchor X",
  anchorY: "Anchor Y",
  width: "Width",
  height: "Height",
  volume: "Volume",
};

/** Inspector and row order. */
export const PROP_ORDER: readonly PropName[] = ["x", "y", "scaleX", "scaleY", "rotation", "opacity", "anchorX", "anchorY", "width", "height", "volume"];

export type TimelineRow =
  | { kind: "layer"; key: string; layer: Layer; height: number }
  | { kind: "property"; key: string; layer: Layer; clip: Clip; prop: PropName; track: KeyframeTrack; height: number };

/** Tracks with keyframes, in display order. */
export function clipTracks(clip: Clip): KeyframeTrack[] {
  const out: KeyframeTrack[] = [];
  for (const prop of PROP_ORDER) {
    const track = clip.tracks[prop];
    if (track && track.keyframes.length > 0) out.push(track);
  }
  return out;
}

export function layerHasTracks(layer: Layer): boolean {
  return layer.clips.some((c) => clipTracks(c).length > 0);
}

/** Top layer first, then each expanded layer's animated properties per clip. */
export function buildTimelineRows(scene: AlertScene, expanded: Record<string, true>): TimelineRow[] {
  const rows: TimelineRow[] = [];
  for (let i = scene.layers.length - 1; i >= 0; i--) {
    const layer = scene.layers[i]!;
    rows.push({ kind: "layer", key: layer.id, layer, height: ROW_HEIGHT_PX });
    if (!expanded[layer.id]) continue;
    for (const clip of layer.clips) {
      for (const track of clipTracks(clip)) {
        rows.push({ kind: "property", key: `${clip.id}:${track.property}`, layer, clip, prop: track.property, track, height: PROPERTY_ROW_HEIGHT_PX });
      }
    }
  }
  return rows;
}

export function rowsHeight(rows: readonly TimelineRow[]): number {
  return rows.reduce((sum, r) => sum + r.height, 0);
}
