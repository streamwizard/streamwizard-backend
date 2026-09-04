"use client";

import { useMemo, useRef } from "react";
import { evaluate, findClip, type AlertScene, type RenderNode } from "@repo/alert-scene";
import { cn } from "@repo/ui";
import type { NodeBox } from "../anchor-math";
import { writePropsCommand } from "../commands";
import { writeProps } from "../prop-writer";
import { useTimeline, useTimelineStoreApi } from "../timeline-context";
import { visibleScene } from "../timeline-store";
import { usePointerDrag } from "../use-pointer-drag";
import { CORNERS, angleDeg, hitTest, localToWorld, nodeCorners, resizeFromCorner, rotationFromPointer, upVector, type Corner, type Point } from "./stage-geometry";

const HANDLE_PX = 9;
const ROTATE_OFFSET_PX = 26;

interface Frame {
  /** Scene px → screen px. */
  scale: number;
  /** Scene origin inside the overlay, screen px. */
  offset: Point;
}

interface Gesture {
  kind: "move" | "resize" | "rotate";
  scene: AlertScene;
  clipId: string;
  playhead: number;
  box: NodeBox;
  frame: Frame;
  /** Overlay's screen rect at pointer-down, for pointer → scene. */
  left: number;
  top: number;
  corner: Corner;
  startAngle: number;
  values: Partial<Record<"x" | "y" | "width" | "height" | "rotation", number>>;
}

function boxOf(node: RenderNode): NodeBox {
  return { x: node.x, y: node.y, width: node.width, height: node.height, scaleX: node.scaleX, scaleY: node.scaleY, rotation: node.rotation, anchorX: node.anchorX, anchorY: node.anchorY };
}

const CURSORS: Record<Corner, string> = { tl: "cursor-nwse-resize", br: "cursor-nwse-resize", tr: "cursor-nesw-resize", bl: "cursor-nesw-resize" };

/**
 * Direct manipulation over the preview. A transparent hit layer covering the
 * whole preview pane (content may animate in from outside the scene box)
 * selects the clip under the pointer and drags it; the selected node gets an outline,
 * corner handles, an anchor crosshair and a rotation handle. Every gesture
 * drafts the scene for live preview and commits one command on release,
 * routed through the auto-keyframe rule.
 */
export function StageOverlay({ scale, offset }: { scale: number; offset: Point }) {
  const api = useTimelineStoreApi();
  const hostRef = useRef<HTMLDivElement>(null);
  const clipId = useTimeline((s) => s.selection.clipId);
  const locked = useTimeline((s) => (s.selection.clipId ? findClip(s.scene, s.selection.clipId)?.layer.locked ?? false : false));
  // The selected node as drawn right now (draft included). Selectors return
  // stable slices; the derived node is memoised so the store never sees a
  // fresh object per read.
  const scene = useTimeline(visibleScene);
  const playhead = useTimeline((s) => s.playhead);
  // A sound clip has no picture, so it gets no chrome either.
  const node = useMemo(
    () => (clipId ? evaluate(scene, playhead).nodes.find((n) => n.clipId === clipId && n.type !== "audio") ?? null : null),
    [scene, playhead, clipId]
  );

  const toScene = (clientX: number, clientY: number, g: Pick<Gesture, "left" | "top" | "frame">): Point => ({
    x: (clientX - g.left - g.frame.offset.x) / g.frame.scale,
    y: (clientY - g.top - g.frame.offset.y) / g.frame.scale,
  });
  const toScreen = (p: Point): Point => ({ x: offset.x + p.x * scale, y: offset.y + p.y * scale });

  const begin = (kind: Gesture["kind"], target: RenderNode, e: { clientX: number; clientY: number }, corner: Corner = "br"): Gesture | null => {
    const host = hostRef.current;
    if (!host) return null;
    const s = api.getState();
    if (s.playing) s.setPlaying(false);
    const rect = host.getBoundingClientRect();
    const box = boxOf(target);
    const frame = { scale, offset };
    const g: Gesture = { kind, scene: s.scene, clipId: target.clipId, playhead: s.playhead, box, frame, left: rect.left, top: rect.top, corner, startAngle: 0, values: {} };
    if (kind === "rotate") g.startAngle = angleDeg({ x: box.x, y: box.y }, toScene(e.clientX, e.clientY, g));
    return g;
  };

  const drag = usePointerDrag<Gesture>({
    onStart: (e) => {
      const target = e.currentTarget as HTMLElement;
      const s = api.getState();
      const host = hostRef.current;
      if (!host) return null;
      const handle = target.dataset.handle;
      const current = node;
      if (handle && current) {
        if (locked) return null;
        return begin(handle === "rotate" ? "rotate" : "resize", current, e, handle === "rotate" ? "br" : (handle as Corner));
      }
      // Hit layer: pick what is under the pointer.
      const rect = host.getBoundingClientRect();
      const p = { x: (e.clientX - rect.left - offset.x) / scale, y: (e.clientY - rect.top - offset.y) / scale };
      const nodes = evaluate(visibleScene(s), s.playhead).nodes.filter((n) => n.type !== "audio");
      const hit = hitTest(nodes, p);
      if (!hit) {
        s.clearSelection();
        return null;
      }
      const loc = findClip(s.scene, hit.clipId);
      s.select({ layerId: hit.layerId, clipId: hit.clipId, keyframe: null });
      if (!loc || loc.layer.locked) return null;
      return begin("move", hit, e);
    },
    onMove: (m, g) => {
      const s = api.getState();
      if (g.kind === "move") {
        let dx = m.dx / g.frame.scale;
        let dy = m.dy / g.frame.scale;
        if (m.shiftKey) {
          if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
          else dx = 0;
        }
        g.values = { x: Math.round(g.box.x + dx), y: Math.round(g.box.y + dy) };
      } else if (g.kind === "resize") {
        const r = resizeFromCorner(g.box, g.corner, toScene(m.clientX, m.clientY, g), { keepAspect: m.shiftKey });
        g.values = { x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, width: Math.round(r.width), height: Math.round(r.height) };
      } else {
        g.values = { rotation: rotationFromPointer(g.box.rotation, g.startAngle, { x: g.box.x, y: g.box.y }, toScene(m.clientX, m.clientY, g), { snap: m.shiftKey }) };
      }
      s.setDraft(writeProps(g.scene, g.clipId, g.values, g.playhead));
    },
    onEnd: (m, g) => {
      const s = api.getState();
      if (!m.moved) {
        s.commitDraft(null);
        return;
      }
      const label = g.kind === "move" ? "Move clip" : g.kind === "resize" ? "Resize clip" : "Rotate clip";
      s.commitDraft(writePropsCommand(g.scene, g.clipId, g.values, g.playhead, label));
    },
    onCancel: () => api.getState().commitDraft(null),
  });

  const box = node ? boxOf(node) : null;
  const corners = box ? nodeCorners(box) : null;
  const screenCorners = corners ? (Object.fromEntries(CORNERS.map((c) => [c, toScreen(corners[c])])) as Record<Corner, Point>) : null;
  const anchor = box ? toScreen({ x: box.x, y: box.y }) : null;
  let rotateHandle: Point | null = null;
  let topMid: Point | null = null;
  if (box) {
    const up = upVector(box);
    topMid = toScreen(localToWorld(box, box.width / 2, 0));
    rotateHandle = { x: topMid.x + up.x * ROTATE_OFFSET_PX, y: topMid.y + up.y * ROTATE_OFFSET_PX };
  }

  return (
    <div
      ref={hostRef}
      data-stage-overlay=""
      className={cn("absolute inset-0 z-10 touch-none", drag.dragging ? "cursor-grabbing" : "cursor-default")}
      onPointerDown={drag.onPointerDown}
    >
      {screenCorners && anchor && rotateHandle && topMid && (
        <>
          <svg className="pointer-events-none absolute inset-0 overflow-visible" width="100%" height="100%" data-stage-selection={clipId ?? ""}>
            <polygon
              points={CORNERS.map((c) => `${screenCorners[c].x},${screenCorners[c].y}`).join(" ")}
              className={cn("fill-none stroke-primary", locked && "stroke-muted-foreground")}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
            <line x1={topMid.x} y1={topMid.y} x2={rotateHandle.x} y2={rotateHandle.y} className="stroke-primary/70" strokeWidth={1} />
            {/* Anchor crosshair */}
            <circle cx={anchor.x} cy={anchor.y} r={4} className="fill-none stroke-primary" strokeWidth={1.5} />
            <line x1={anchor.x - 8} y1={anchor.y} x2={anchor.x + 8} y2={anchor.y} className="stroke-primary" strokeWidth={1} />
            <line x1={anchor.x} y1={anchor.y - 8} x2={anchor.x} y2={anchor.y + 8} className="stroke-primary" strokeWidth={1} />
          </svg>
          {!locked &&
            CORNERS.map((c) => (
              <button
                key={c}
                type="button"
                data-handle={c}
                data-corner={c}
                aria-label={`Resize from the ${c === "tl" ? "top left" : c === "tr" ? "top right" : c === "br" ? "bottom right" : "bottom left"} corner`}
                onPointerDown={drag.onPointerDown}
                className={cn("absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-primary bg-background shadow-sm", CURSORS[c])}
                style={{ left: screenCorners[c].x, top: screenCorners[c].y, width: HANDLE_PX, height: HANDLE_PX }}
              />
            ))}
          {!locked && (
            <button
              type="button"
              data-handle="rotate"
              aria-label="Rotate"
              title="Drag to rotate. Hold Shift for 15° steps."
              onPointerDown={drag.onPointerDown}
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border border-primary bg-background shadow-sm"
              style={{ left: rotateHandle.x, top: rotateHandle.y, width: HANDLE_PX + 2, height: HANDLE_PX + 2 }}
            />
          )}
        </>
      )}
    </div>
  );
}
