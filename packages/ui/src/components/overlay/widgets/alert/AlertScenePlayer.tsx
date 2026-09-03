"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { collectSceneFontFamilies, type AlertScene } from "@repo/alert-scene";
import { SceneStage, useScenePlayback, type SceneStageHandle } from "@repo/alert-scene/renderer";
import { useGoogleFonts } from "../../hooks/use-google-font";

export interface AlertScenePlayerProps {
  scene: AlertScene;
  /** `{token}` values for this alert; see `alertTokensFromInstance`. */
  tokens: Record<string, string>;
  /** The box the scene is scaled into, usually the widget's design size. */
  fit: { width: number; height: number };
  /** 0..1 */
  volume?: number;
  muted?: boolean;
  /** Fires exactly once, when the scene has run its full duration. */
  onEnded?: () => void;
}

/** How long past the scene's end we wait for a stalled rAF before moving on. */
const ENDED_SAFETY_MS = 250;

/**
 * Plays one alert scene from start to end, once. Mount it when the alert
 * starts and unmount it on `onEnded`; every mount is a fresh clock, so two
 * identical alerts in a row never share state.
 */
export function AlertScenePlayer({
  scene,
  tokens,
  fit,
  volume = 1,
  muted = false,
  onEnded,
}: AlertScenePlayerProps) {
  const stageRef = useRef<SceneStageHandle>(null);
  const fonts = useMemo(() => collectSceneFontFamilies(scene), [scene]);
  useGoogleFonts(fonts);

  const onEndedRef = useRef(onEnded);
  useLayoutEffect(() => {
    onEndedRef.current = onEnded;
  });
  const endedRef = useRef(false);
  const finish = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    onEndedRef.current?.();
  }, []);

  const controls = useScenePlayback({ stageRef, duration: scene.duration, onEnded: finish });

  useEffect(() => {
    stageRef.current?.render(0, { playing: false });
    controls.play();
    // A background tab throttles requestAnimationFrame to nothing; the alert
    // queue must not park on it.
    const safety = setTimeout(finish, scene.duration + ENDED_SAFETY_MS);
    return () => clearTimeout(safety);
  }, [controls, finish, scene.duration]);

  return <SceneStage ref={stageRef} scene={scene} tokens={tokens} fit={fit} volume={volume} muted={muted} />;
}
