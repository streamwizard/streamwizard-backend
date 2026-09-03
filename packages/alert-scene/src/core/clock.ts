/**
 * Playback clock. Owns the one requestAnimationFrame loop a player runs and
 * hands out the current scene time; it never touches the scene itself.
 * Timers are injectable so the loop is unit-testable without a browser.
 */

export interface SceneClockOptions {
  duration: number;
  /** Called with the current time on every frame, and once after a seek while paused. */
  onFrame: (timeMs: number) => void;
  /** Called once when playback runs off the end (not when looping). */
  onEnded?: () => void;
  loop?: boolean;
  now?: () => number;
  raf?: (cb: (ts: number) => void) => number;
  caf?: (id: number) => void;
}

export interface SceneClock {
  play(): void;
  pause(): void;
  /** Toggles play/pause; plays from the start again if sitting at the end. */
  toggle(): void;
  seek(timeMs: number): void;
  getTime(): number;
  isPlaying(): boolean;
  setDuration(ms: number): void;
  setLoop(loop: boolean): void;
  dispose(): void;
}

function defaultNow(): number {
  const p = (globalThis as { performance?: { now(): number } }).performance;
  return p ? p.now() : Date.now();
}

function defaultRaf(cb: (ts: number) => void): number {
  const g = globalThis as { requestAnimationFrame?: (cb: (ts: number) => void) => number };
  if (g.requestAnimationFrame) return g.requestAnimationFrame(cb);
  return setTimeout(() => cb(defaultNow()), 16) as unknown as number;
}

function defaultCaf(id: number): void {
  const g = globalThis as { cancelAnimationFrame?: (id: number) => void };
  if (g.cancelAnimationFrame) g.cancelAnimationFrame(id);
  else clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
}

export function createSceneClock(opts: SceneClockOptions): SceneClock {
  const now = opts.now ?? defaultNow;
  const raf = opts.raf ?? defaultRaf;
  const caf = opts.caf ?? defaultCaf;

  let duration = Math.max(0, opts.duration);
  let loop = opts.loop ?? false;
  let time = 0;
  let playing = false;
  let startedAt = 0; // now() at which time was 0
  let frameId: number | null = null;
  let disposed = false;

  const clamp = (t: number) => Math.min(duration, Math.max(0, t));

  const stopLoop = () => {
    if (frameId !== null) {
      caf(frameId);
      frameId = null;
    }
  };

  const tick = () => {
    frameId = null;
    if (!playing || disposed) return;
    let t = now() - startedAt;
    if (t >= duration) {
      if (loop && duration > 0) {
        t = t % duration;
        startedAt = now() - t;
      } else {
        time = duration;
        playing = false;
        opts.onFrame(time);
        opts.onEnded?.();
        return;
      }
    }
    time = t;
    opts.onFrame(time);
    frameId = raf(tick);
  };

  const play = () => {
    if (disposed || playing) return;
    if (time >= duration) time = 0;
    playing = true;
    startedAt = now() - time;
    stopLoop();
    frameId = raf(tick);
  };

  const pause = () => {
    if (!playing) return;
    time = clamp(now() - startedAt);
    playing = false;
    stopLoop();
  };

  return {
    play,
    pause,
    toggle: () => (playing ? pause() : play()),
    seek: (t) => {
      time = clamp(t);
      if (playing) startedAt = now() - time;
      else if (!disposed) opts.onFrame(time);
    },
    getTime: () => (playing ? clamp(now() - startedAt) : time),
    isPlaying: () => playing,
    setDuration: (ms) => {
      duration = Math.max(0, ms);
      if (!playing && time > duration) time = duration;
    },
    setLoop: (l) => {
      loop = l;
    },
    dispose: () => {
      disposed = true;
      playing = false;
      stopLoop();
    },
  };
}
