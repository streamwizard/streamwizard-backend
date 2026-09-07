"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOverlayStore } from "@/stores/overlay-editor-store";
import {
  centerPan,
  clampPan,
  wheelZoom,
  zoomAboutPoint,
} from "@/components/overlays/editor/canvas-zoom";

interface CanvasViewportOptions {
  /** The pane the canvas floats in. Wheel events bind here; pan is measured against it. */
  paneRef: React.RefObject<HTMLDivElement | null>;
}

/** Firefox can report wheel deltas in lines; everything else sends pixels. */
const LINE_PX = 16;

function wheelDeltaPx(event: WheelEvent, pane: HTMLElement) {
  const unit =
    event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? LINE_PX
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? pane.clientHeight
        : 1;
  return { x: event.deltaX * unit, y: event.deltaY * unit };
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

/** Controls that Space activates on its own; they keep their key. */
function activatesWithSpace(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el?.closest?.(
    'button, a, [role="button"], [role="switch"], [role="checkbox"], [role="radio"], [role="tab"], [role="menuitem"], [role="slider"]'
  );
}

/**
 * The editor viewport: wheel zoom about the cursor, wheel and drag panning,
 * and the hand tool.
 *
 * The pane never scrolls. Pan and zoom in the store say where the canvas sits,
 * so there is one way to move around rather than a translate fighting native
 * scrollbars. Photoshop's model: the hand tool, Space and the middle button all
 * drag the same thing, and the canvas can be pushed mostly out of view but
 * never lost.
 */
export function useCanvasViewport({ paneRef }: CanvasViewportOptions) {
  const activeTool = useOverlayStore((s) => s.activeTool);
  const sceneWidth = useOverlayStore((s) => s.scene?.width ?? 0);
  const sceneHeight = useOverlayStore((s) => s.scene?.height ?? 0);

  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const panOrigin = useRef<{ x: number; y: number } | null>(null);
  const endPanRef = useRef<(() => void) | null>(null);

  /** Writes a pan, kept inside the pane and on whole pixels so text stays crisp. */
  const applyPan = useCallback(
    (x: number, y: number, zoom: number) => {
      const pane = paneRef.current;
      const { scene, setPan } = useOverlayStore.getState();
      if (!pane || pane.clientWidth === 0 || !scene) {
        setPan(Math.round(x), Math.round(y));
        return;
      }
      const clamped = clampPan(
        { x, y },
        { width: pane.clientWidth, height: pane.clientHeight },
        { width: scene.width * zoom, height: scene.height * zoom }
      );
      setPan(Math.round(clamped.x), Math.round(clamped.y));
    },
    [paneRef]
  );

  // Centre the scene when it first appears and whenever its size changes: a
  // new resolution reads better from the middle than from wherever the old
  // top-left happened to be. A passive effect, not a layout one: the pane is
  // the parent's element, and a child's layout effect runs before the parent's
  // ref is attached, so on first mount a layout effect would find no pane.
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane || !sceneWidth || !sceneHeight) return;
    const { zoom } = useOverlayStore.getState();
    const centred = centerPan(
      { width: pane.clientWidth, height: pane.clientHeight },
      { width: sceneWidth * zoom, height: sceneHeight * zoom }
    );
    applyPan(centred.x, centred.y, zoom);
  }, [paneRef, sceneWidth, sceneHeight, applyPan]);

  // The pane changes size when the app sidebar or the layers panel toggles, or
  // the window resizes. Keep whatever sat at the pane's centre at its centre
  // (a pan is the canvas's top-left, so shift it by half the change), then
  // re-clamp so the canvas is never stranded outside the new bounds.
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane || typeof ResizeObserver === "undefined") return;
    let last = { width: pane.clientWidth, height: pane.clientHeight };
    // Sub-pixel remainder carried between callbacks: the sidebar's width
    // transition arrives a few pixels per frame, and rounding each half on its
    // own would walk the canvas a pixel sideways every other frame.
    let carry = { x: 0, y: 0 };
    const observer = new ResizeObserver(() => {
      const next = { width: pane.clientWidth, height: pane.clientHeight };
      carry = {
        x: carry.x + (next.width - last.width) / 2,
        y: carry.y + (next.height - last.height) / 2,
      };
      const dx = Math.round(carry.x);
      const dy = Math.round(carry.y);
      carry = { x: carry.x - dx, y: carry.y - dy };
      last = next;
      const { panX, panY, zoom } = useOverlayStore.getState();
      applyPan(panX + dx, panY + dy, zoom);
    });
    observer.observe(pane);
    return () => observer.disconnect();
  }, [paneRef, applyPan]);

  // Bound natively rather than through onWheel: React registers wheel handlers
  // passively, so preventDefault() there is ignored and the page zooms away
  // under the cursor. Same options the VOD timeline uses.
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const { zoom, panX, panY, setZoom } = useOverlayStore.getState();
      const delta = wheelDeltaPx(event, pane);

      // Trackpad pinch arrives as ctrl+wheel, so this covers both.
      if (event.ctrlKey || event.metaKey) {
        const next = wheelZoom(zoom, delta.y);
        if (next === zoom) return;
        const rect = pane.getBoundingClientRect();
        const focal = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        const pan = zoomAboutPoint({ x: panX, y: panY }, zoom, next, focal);
        setZoom(next);
        applyPan(pan.x, pan.y, next);
        return;
      }

      // Shift turns a one-axis wheel sideways; a trackpad already sends both.
      const sideways = event.shiftKey && delta.x === 0;
      const dx = sideways ? delta.y : delta.x;
      const dy = sideways ? 0 : delta.y;
      applyPan(panX - dx, panY - dy, zoom);
    };

    pane.addEventListener("wheel", onWheel, { passive: false });
    return () => pane.removeEventListener("wheel", onWheel);
  }, [paneRef, applyPan]);

  // Space pans, but not while it is being typed into something.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTyping(e.target)) return;
      // With nothing focused, Space scrolls the page; hold it for panning
      // instead. A focused button keeps its own Space so tabbing around the
      // toolbar still works.
      if (!activatesWithSpace(e.target)) e.preventDefault();
      if (!e.repeat) setSpaceHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    // Alt-tabbing away never delivers the keyup.
    const onBlur = () => setSpaceHeld(false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // A drag that leaves the pane, or the window, must still end cleanly.
  useEffect(() => () => endPanRef.current?.(), []);

  const startPan = useCallback(
    (clientX: number, clientY: number) => {
      endPanRef.current?.();
      panOrigin.current = { x: clientX, y: clientY };
      setPanning(true);

      const onMove = (e: MouseEvent) => {
        const origin = panOrigin.current;
        if (!origin) return;
        const { panX, panY, zoom } = useOverlayStore.getState();
        applyPan(panX + e.clientX - origin.x, panY + e.clientY - origin.y, zoom);
        panOrigin.current = { x: e.clientX, y: e.clientY };
      };
      const end = () => {
        panOrigin.current = null;
        endPanRef.current = null;
        setPanning(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", end);
        window.removeEventListener("blur", end);
      };
      endPanRef.current = end;

      // On the window, not the pane: the hand keeps dragging past the edge.
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", end);
      window.addEventListener("blur", end);
    },
    [applyPan]
  );

  /** True when this mousedown should pan instead of selecting or marquee-ing. */
  const handlePanMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const isMiddle = e.button === 1;
      const handDrag = e.button === 0 && (spaceHeld || activeTool === "hand");
      if (!isMiddle && !handDrag) return false;
      e.preventDefault();
      e.stopPropagation();
      startPan(e.clientX, e.clientY);
      return true;
    },
    [spaceHeld, activeTool, startPan]
  );

  return {
    /** A click would pan: show the open hand. */
    panReady: spaceHeld || activeTool === "hand",
    panning,
    handlePanMouseDown,
  };
}
