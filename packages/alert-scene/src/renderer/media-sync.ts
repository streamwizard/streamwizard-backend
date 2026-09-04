/**
 * Keeps a <video>/<audio> element on the scene clock. The element is never
 * the source of truth: every frame we tell it where it should be, and only
 * nudge it when it has drifted, so a scrub, a pause and live playback all
 * read from the same `mediaTime`.
 */

/** Seek when playback has drifted this far from the clock. */
const PLAYING_DRIFT_S = 0.12;
/** Do not correct drift more often than this: each seek costs a decoder flush. */
const PLAYING_SEEK_INTERVAL_MS = 250;
/** While paused a frame-accurate position matters more than smoothness. */
const PAUSED_DRIFT_S = 0.02;

export interface MediaSyncOptions {
  mediaTimeMs: number;
  playing: boolean;
  /** 0..1, already multiplied by any master volume. */
  volume: number;
  muted: boolean;
  loop: boolean;
}

export interface MediaSyncState {
  lastSeekAt: number;
  pendingSeek: number | null;
  lastVolume: number;
  lastMuted: boolean | null;
  detach: () => void;
}

export function createMediaSyncState(el: HTMLMediaElement): MediaSyncState {
  const state: MediaSyncState = {
    lastSeekAt: -Infinity,
    pendingSeek: null,
    lastVolume: -1,
    lastMuted: null,
    detach: () => {},
  };
  // A seek asked for before metadata arrived, or while another seek was in
  // flight, is applied as soon as the element can take it.
  const flush = () => {
    if (state.pendingSeek === null || el.seeking || el.readyState < 1) return;
    const t = state.pendingSeek;
    state.pendingSeek = null;
    el.currentTime = t;
  };
  el.addEventListener("loadedmetadata", flush);
  el.addEventListener("seeked", flush);
  state.detach = () => {
    el.removeEventListener("loadedmetadata", flush);
    el.removeEventListener("seeked", flush);
  };
  return state;
}

function sourceDuration(el: HTMLMediaElement): number | null {
  const d = el.duration;
  return Number.isFinite(d) && d > 0 ? d : null;
}

function targetSeconds(el: HTMLMediaElement, mediaTimeMs: number, loop: boolean): number {
  const t = Math.max(0, mediaTimeMs / 1000);
  const d = sourceDuration(el);
  if (d === null) return t;
  return loop ? t % d : Math.min(t, d);
}

/**
 * Past the end of a non-looping source there is nothing to play, so the
 * element holds its last frame instead. An element that already ended
 * reports `paused`, and play() on it restarts from 0; asking it to play
 * again within drift of the end would loop the tail forever.
 */
function holdAtEnd(el: HTMLMediaElement, mediaTimeMs: number, loop: boolean): boolean {
  if (loop) return false;
  const d = sourceDuration(el);
  if (d === null) return false;
  const t = mediaTimeMs / 1000;
  return t >= d || (el.ended && d - t <= PLAYING_DRIFT_S);
}

function seek(el: HTMLMediaElement, state: MediaSyncState, seconds: number, now: number): void {
  state.lastSeekAt = now;
  if (el.readyState < 1 || el.seeking) {
    state.pendingSeek = seconds;
    return;
  }
  el.currentTime = seconds;
}

export function syncMedia(el: HTMLMediaElement, state: MediaSyncState, opts: MediaSyncOptions, now: number): void {
  const vol = Math.min(1, Math.max(0, opts.volume));
  if (vol !== state.lastVolume) {
    el.volume = vol;
    state.lastVolume = vol;
  }
  const muted = opts.muted || vol === 0;
  if (muted !== state.lastMuted) {
    el.muted = muted;
    state.lastMuted = muted;
  }
  if (el.loop !== opts.loop) el.loop = opts.loop;

  const target = targetSeconds(el, opts.mediaTimeMs, opts.loop);
  const current = el.currentTime;

  if (opts.playing && !holdAtEnd(el, opts.mediaTimeMs, opts.loop)) {
    if (el.paused) {
      // Autoplay policy can reject this; the clock keeps going regardless.
      void el.play()?.catch?.(() => {});
    }
    if (Math.abs(current - target) > PLAYING_DRIFT_S && now - state.lastSeekAt > PLAYING_SEEK_INTERVAL_MS) {
      seek(el, state, target, now);
    }
    return;
  }

  if (!el.paused) el.pause();
  if (Math.abs(current - target) > PAUSED_DRIFT_S || state.pendingSeek !== null) {
    seek(el, state, target, now);
  }
}

/** Stops playback and drops the buffered source so a closed editor frees the decoder. */
export function releaseMedia(el: HTMLMediaElement): void {
  try {
    el.pause();
    el.removeAttribute("src");
    el.load();
  } catch {
    // A detached element can throw on load(); nothing left to release.
  }
}
