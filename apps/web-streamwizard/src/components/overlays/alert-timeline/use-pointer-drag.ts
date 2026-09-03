"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { beginDrag } from "./drag-registry";

export interface DragMove {
  clientX: number;
  clientY: number;
  /** Since pointerdown. */
  dx: number;
  dy: number;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  /** False until the pointer travelled `minDistance`; a bare click ends with false. */
  moved: boolean;
}

export interface PointerDragHandlers<T> {
  /** Return the gesture context, or null to let the event go. */
  onStart(e: ReactPointerEvent<HTMLElement>): T | null | undefined;
  onMove?(move: DragMove, ctx: T): void;
  onEnd?(move: DragMove, ctx: T): void;
  /** Escape, pointercancel, lost capture, window blur. */
  onCancel?(ctx: T): void;
  minDistance?: number;
  button?: number;
}

const DEFAULT_MIN_DISTANCE = 3;

/**
 * Pointer-captured drag. Once the element captures the pointer, every move
 * and the release reach it even outside the modal or the browser window, so
 * a clip dragged past the dialog edge keeps tracking. Registers with the drag
 * registry so Escape can cancel it from anywhere.
 */
export function usePointerDrag<T>(handlers: PointerDragHandlers<T>) {
  const handlersRef = useRef(handlers);
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });
  const [dragging, setDragging] = useState(false);
  const activeRef = useRef<{ teardown: () => void } | null>(null);

  useEffect(() => () => activeRef.current?.teardown(), []);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const h = handlersRef.current;
    if (e.button !== (h.button ?? 0)) return;
    if (activeRef.current) return;
    const ctx = h.onStart(e);
    if (ctx === null || ctx === undefined) return;
    e.preventDefault();
    e.stopPropagation();

    const el = e.currentTarget;
    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    const minDistance = h.minDistance ?? DEFAULT_MIN_DISTANCE;
    let moved = false;
    let finished = false;

    const describe = (ev: PointerEvent): DragMove => ({
      clientX: ev.clientX,
      clientY: ev.clientY,
      dx: ev.clientX - startX,
      dy: ev.clientY - startY,
      shiftKey: ev.shiftKey,
      altKey: ev.altKey,
      ctrlKey: ev.ctrlKey,
      metaKey: ev.metaKey,
      moved,
    });

    const teardown = () => {
      if (finished) return;
      finished = true;
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("lostpointercapture", onLost);
      window.removeEventListener("blur", onCancel);
      try {
        if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
      } catch {
        // Element already gone.
      }
      release();
      activeRef.current = null;
      setDragging(false);
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (!moved) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < minDistance) return;
        moved = true;
        setDragging(true);
      }
      handlersRef.current.onMove?.(describe(ev), ctx);
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const move = describe(ev);
      teardown();
      handlersRef.current.onEnd?.(move, ctx);
    };
    const onCancel = () => {
      if (finished) return;
      teardown();
      handlersRef.current.onCancel?.(ctx);
    };
    const onLost = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      onCancel();
    };

    const release = beginDrag(onCancel);
    activeRef.current = { teardown: onCancel };

    try {
      el.setPointerCapture(pointerId);
    } catch {
      // Some synthetic pointers refuse capture; listeners on the element still work while inside it.
    }
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("lostpointercapture", onLost);
    window.addEventListener("blur", onCancel);
  }, []);

  return { onPointerDown, dragging };
}
