"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
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
 * The one rAF loop behind a stage. The clock is created on first use and
 * disposed on unmount; creating it lazily (not in render) is what keeps it
 * alive through StrictMode's simulated unmount/remount in development, which
 * would otherwise dispose a clock nothing recreates.
 */
export function useScenePlayback(opts: ScenePlaybackOptions): ScenePlaybackControls {
  const { stageRef, duration, loop = false, onTime, onEnded } = opts;
  const onTimeRef = useRef(onTime);
  const onEndedRef = useRef(onEnded);
  const durationRef = useRef(duration);
  const loopRef = useRef(loop);
  useLayoutEffect(() => {
    onTimeRef.current = onTime;
    onEndedRef.current = onEnded;
    durationRef.current = duration;
    loopRef.current = loop;
  });
  const clockRef = useRef<SceneClock | null>(null);

  const clock = useCallback((): SceneClock => {
    if (clockRef.current) return clockRef.current;
    const created = createSceneClock({
      duration: durationRef.current,
      loop: loopRef.current,
      onFrame: (t) => {
        stageRef.current?.render(t, { playing: clockRef.current?.isPlaying() ?? false });
        onTimeRef.current?.(t);
      },
      onEnded: () => onEndedRef.current?.(),
    });
    clockRef.current = created;
    return created;
  }, [stageRef]);

  useEffect(() => {
    clock().setDuration(duration);
  }, [clock, duration]);

  useEffect(() => {
    clock().setLoop(loop);
  }, [clock, loop]);

  useEffect(() => {
    clock();
    return () => {
      clockRef.current?.dispose();
      clockRef.current = null;
    };
  }, [clock]);

  return useMemo<ScenePlaybackControls>(() => {
    const paintPaused = () => {
      const c = clock();
      stageRef.current?.render(c.getTime(), { playing: false });
      onTimeRef.current?.(c.getTime());
    };
    return {
      play: () => clock().play(),
      pause: () => {
        clock().pause();
        // Paint the paused frame so media elements stop exactly here.
        paintPaused();
      },
      toggle: () => {
        const c = clock();
        if (c.isPlaying()) {
          c.pause();
          paintPaused();
        } else c.play();
      },
      seek: (t) => clock().seek(t),
      getTime: () => clock().getTime(),
      isPlaying: () => clock().isPlaying(),
    };
  }, [clock, stageRef]);
}
