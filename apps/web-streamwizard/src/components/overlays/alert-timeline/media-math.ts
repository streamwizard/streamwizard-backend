/**
 * What a media clip may do given how much footage its source holds. The
 * source length is probed by the editor (media-info), never stored, so every
 * function takes it as `sourceMs` and treats null as "unknown, no limit".
 */

import type { Clip, ClipSource } from "@repo/alert-scene";
import type { TrimLimits } from "./timeline/timeline-math";

type MediaClip = Pick<Clip, "start" | "end" | "trimIn" | "source">;

export function isMediaClip(clip: Pick<Clip, "source">): boolean {
  return clip.source.kind === "video" || clip.source.kind === "audio";
}

/** A looping video never runs out of footage. */
export function mediaLoops(source: ClipSource): boolean {
  return source.kind === "video" && source.loop;
}

/** Footage left after `trimIn`, or null when there is no bound to speak of. */
function footageMs(clip: MediaClip, sourceMs: number | null): number | null {
  if (sourceMs === null || !isMediaClip(clip) || mediaLoops(clip.source)) return null;
  return Math.max(0, sourceMs - clip.trimIn);
}

/**
 * The start edge cannot reveal footage before the source starts, and the end
 * edge cannot reach past it. An edge already over the line is never yanked
 * back: the limit only stops it going further.
 */
export function mediaTrimLimits(clip: MediaClip, sourceMs: number | null): TrimLimits {
  if (!isMediaClip(clip)) return {};
  const limits: TrimLimits = { minStart: clip.start - clip.trimIn };
  const footage = footageMs(clip, sourceMs);
  if (footage !== null) limits.maxEnd = Math.max(clip.end, clip.start + footage);
  return limits;
}

/** Scene time where the footage runs out inside the clip, or null when it does not. */
export function footageEndMs(clip: MediaClip, sourceMs: number | null): number | null {
  const footage = footageMs(clip, sourceMs);
  if (footage === null) return null;
  const at = clip.start + footage;
  return at < clip.end ? at : null;
}

/** Where the source offset may sit so the clip still has footage to its end. */
export function clampTrimIn(clip: Pick<Clip, "start" | "end" | "source">, wanted: number, sourceMs: number | null): number {
  const length = clip.end - clip.start;
  const bounded = sourceMs !== null && isMediaClip(clip) && !mediaLoops(clip.source);
  const max = bounded ? Math.max(0, sourceMs - length) : Infinity;
  return Math.min(max, Math.max(0, Math.round(wanted)));
}

/** Scales a natural size down to fit `max`, never up. */
export function fitBox(natural: { width: number; height: number }, max: { width: number; height: number }): { width: number; height: number } {
  const scale = Math.min(max.width / natural.width, max.height / natural.height, 1);
  return { width: Math.max(1, Math.round(natural.width * scale)), height: Math.max(1, Math.round(natural.height * scale)) };
}
