"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collectSceneFontFamilies } from "@repo/alert-scene";
import { SceneStage } from "@repo/alert-scene/renderer";
import {
  alertInstanceFromSocketMessage,
  alertTokensFromInstance,
  buildTestAlertSocketMessage,
  useGoogleFonts,
  type AlertEventType,
} from "@repo/ui/overlay";
import { usePlayback, useTimeline } from "../timeline-context";
import { visibleScene } from "../timeline-store";
import { StageOverlay } from "./stage-overlay";

const MARGIN_PX = 24;
/** Never blow a 600×400 alert up past 2× on a big monitor. */
const MAX_SCALE = 2;

/**
 * The stage, fitted to whatever room the splitters leave it. Content that
 * animates outside the scene box stays visible, as it would on stream; only
 * the checkerboard marks the scene bounds.
 */
export function PreviewPane({ event }: { event: AlertEventType }) {
  const { stageRef } = usePlayback();
  const scene = useTimeline(visibleScene);
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A realistic alert while editing: the same fixture the Test button fires.
  const tokens = useMemo(() => {
    const alert = alertInstanceFromSocketMessage(buildTestAlertSocketMessage(event));
    return alert ? alertTokensFromInstance(alert) : {};
  }, [event]);

  const fonts = useMemo(() => collectSceneFontFamilies(scene), [scene]);
  useGoogleFonts(fonts);

  const scale =
    size.width > 0 && size.height > 0
      ? Math.max(0.05, Math.min(MAX_SCALE, (size.width - MARGIN_PX * 2) / scene.width, (size.height - MARGIN_PX * 2) / scene.height))
      : 0;
  const fit = { width: Math.max(1, Math.round(scene.width * scale)), height: Math.max(1, Math.round(scene.height * scale)) };
  // The checkerboard is centred in the pane and the stage centres the scaled
  // scene inside it; the overlay covers the whole pane and needs that origin.
  const offset = { x: (size.width - scene.width * scale) / 2, y: (size.height - scene.height * scale) / 2 };

  return (
    <div ref={hostRef} className="relative flex h-full w-full items-center justify-center overflow-hidden bg-muted/30">
      {scale > 0 && (
        <div className="bg-checkerboard relative rounded-sm shadow-md ring-1 ring-border" style={{ width: fit.width, height: fit.height }}>
          <SceneStage ref={stageRef} scene={scene} tokens={tokens} fit={fit} />
        </div>
      )}
      {scale > 0 && <StageOverlay scale={scale} offset={offset} />}
      <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
        {scene.width}×{scene.height} · {Math.round(scale * 100)}%
      </div>
    </div>
  );
}
