"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { createSceneClock, type SceneClock } from "../core/clock";
import type { SceneStageHandle } from "./SceneStage";

export interface ScenePlaybackOptions {
  stageRef: RefObject<SceneStageHandle | null>;
  duration: number;
  loop?: boolean;
  /** Fires once per frame while playing, and once after a paused seek. */
  onTime?: (timeMs: number) => void;
  onEnded?: () => void;
}

export interface ScenePlaybackControls {
  play(): void;
  pause(): void;
  toggle(): void;
  seek(timeMs: number): void;
  getTime(): number;
  isPlaying(): boolean;
}

/**
 * The one rAF loop behind a stage. Creates a clock on mount, tears it down on
 * unmount, and forwards every tick to `stage.render(t)`. Returns a stable
 * controls object so callers can bind buttons and shortcuts once.
 */
export function useScenePlayback(opts: ScenePlaybackOptions): ScenePlaybackControls {
  const { stageRef, duration, loop = false, onTime, onEnded } = opts;
  const onTimeRef = useRef(onTime);
  onTimeRef.current = onTime;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const clockRef = useRef<SceneClock | null>(null);

  if (clockRef.current === null) {
    clockRef.current = createSceneClock({
      duration,
      loop,
      onFrame: (t) => {
        const clock = clockRef.current;
        stageRef.current?.render(t, { playing: clock?.isPlaying() ?? false });
        onTimeRef.current?.(t);
      },
      onEnded: () => onEndedRef.current?.(),
    });
  }

  useEffect(() => {
    clockRef.current?.setDuration(duration);
  }, [duration]);

  useEffect(() => {
    clockRef.current?.setLoop(loop);
  }, [loop]);

  useEffect(() => {
    const clock = clockRef.current;
    return () => {
      clock?.dispose();
      clockRef.current = null;
    };
  }, []);

  return useMemo<ScenePlaybackControls>(
    () => ({
      play: () => clockRef.current?.play(),
      pause: () => {
        const clock = clockRef.current;
        if (!clock) return;
        clock.pause();
        // Paint the paused frame so media elements stop exactly here.
        stageRef.current?.render(clock.getTime(), { playing: false });
        onTimeRef.current?.(clock.getTime());
      },
      toggle: () => {
        const clock = clockRef.current;
        if (!clock) return;
        if (clock.isPlaying()) {
          clock.pause();
          stageRef.current?.render(clock.getTime(), { playing: false });
          onTimeRef.current?.(clock.getTime());
        } else clock.play();
      },
      seek: (t) => clockRef.current?.seek(t),
      getTime: () => clockRef.current?.getTime() ?? 0,
      isPlaying: () => clockRef.current?.isPlaying() ?? false,
    }),
    [stageRef]
  );
}
