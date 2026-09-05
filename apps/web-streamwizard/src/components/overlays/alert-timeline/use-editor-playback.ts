"use client";

import { useCallback, useEffect, useRef } from "react";
import { useScenePlayback, type SceneStageHandle } from "@repo/alert-scene/renderer";
import { useTimeline, useTimelineStoreApi, type EditorPlayback } from "./timeline-context";

/**
 * Binds the renderer's clock to the editor store: frames move the playhead,
 * a paused playhead change (scrub, Home/End, typing a time) repaints the stage,
 * and the end of the scene flips `playing` off unless looping.
 */
export function useEditorPlayback(paneRef: EditorPlayback["paneRef"]): EditorPlayback {
  const api = useTimelineStoreApi();
  const stageRef = useRef<SceneStageHandle | null>(null);
  const duration = useTimeline((s) => s.scene.duration);
  const loop = useTimeline((s) => s.loop);
  const testRun = useTimeline((s) => s.testRun);

  const controls = useScenePlayback({
    stageRef,
    duration,
    // A test run plays through once whatever the loop toggle says.
    loop: loop && !testRun,
    onTime: (t) => api.getState().setPlayhead(t),
    onEnded: () => api.getState().setPlaying(false),
  });

  const playOnce = useCallback(() => {
    const s = api.getState();
    s.setTestRun(true);
    controls.pause();
    controls.seek(0);
    controls.play();
    s.setPlaying(true);
  }, [api, controls]);

  // Scrubs while paused: the clock did not produce this playhead, so seek it.
  useEffect(() => {
    return api.subscribe((state, prev) => {
      if (state.playhead === prev.playhead) return;
      if (controls.isPlaying()) return;
      if (controls.getTime() !== state.playhead) controls.seek(state.playhead);
    });
  }, [api, controls]);

  // `playing` in the store is the intent; the clock is the truth.
  useEffect(() => {
    return api.subscribe((state, prev) => {
      if (state.playing === prev.playing) return;
      if (state.playing && !controls.isPlaying()) controls.play();
      else if (!state.playing && controls.isPlaying()) controls.pause();
    });
  }, [api, controls]);

  // A shortened scene with the playhead past its end.
  useEffect(() => {
    const { playhead, setPlayhead } = api.getState();
    if (playhead > duration) setPlayhead(duration);
  }, [api, duration]);

  return { controls, playOnce, stageRef, paneRef };
}
