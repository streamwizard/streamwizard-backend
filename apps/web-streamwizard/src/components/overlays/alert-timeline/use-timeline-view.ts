"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { useTimelineStoreApi } from "./timeline-context";
import type { TimelineView } from "./timeline-context";
import { fitPxPerMs, msToPx, wheelZoomPxPerMs, zoomAboutTime } from "./timeline/timeline-math";

const LINE_PX = 16;

function wheelDeltaPx(e: WheelEvent, pane: HTMLElement): { x: number; y: number } {
  // Firefox reports lines or pages for a mouse wheel; normalise to px like the canvas does.
  const unit = e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? pane.clientHeight : 1;
  return { x: e.deltaX * unit, y: e.deltaY * unit };
}

/**
 * Owns the track pane's scroll and zoom. The wheel listener itself is bound
 * by `useTimelineWheel` inside the pane's component; it is native and
 * non-passive because React's is passive and Radix's scroll lock lets
 * ctrl+wheel through to the browser, which would zoom the whole page.
 */
export function useTimelineViewController(paneRef: RefObject<HTMLDivElement | null>): TimelineView {
  const api = useTimelineStoreApi();
  const pendingScroll = useRef<number | null>(null);

  const view = useMemo<TimelineView>(() => {
    const zoomTo = (next: number, cursorViewportPx?: number) => {
      const pane = paneRef.current;
      const { pxPerMs, playhead, setPxPerMs } = api.getState();
      if (!pane) {
        setPxPerMs(next);
        return;
      }
      const cursor = cursorViewportPx ?? Math.min(Math.max(0, msToPx(playhead, pxPerMs) - pane.scrollLeft), pane.clientWidth);
      pendingScroll.current = zoomAboutTime(pane.scrollLeft, pxPerMs, next, cursor);
      setPxPerMs(next);
    };
    return {
      zoomTo,
      zoomBy: (factor) => zoomTo(api.getState().pxPerMs * factor),
      fit: () => {
        const pane = paneRef.current;
        const { scene, setPxPerMs } = api.getState();
        setPxPerMs(fitPxPerMs(scene.duration, pane?.clientWidth ?? 800));
        pendingScroll.current = 0;
      },
      scrollToTime: (ms) => {
        const pane = paneRef.current;
        if (!pane) return;
        const x = msToPx(ms, api.getState().pxPerMs);
        if (x < pane.scrollLeft || x > pane.scrollLeft + pane.clientWidth) {
          pane.scrollLeft = Math.max(0, x - pane.clientWidth / 2);
        }
      },
    };
  }, [api, paneRef]);

  // The content only grows after React paints the new zoom, so the scroll
  // that keeps the cursor still has to land in a layout effect.
  useLayoutEffect(() => {
    return api.subscribe((state, prev) => {
      if (state.pxPerMs === prev.pxPerMs) return;
      const pane = paneRef.current;
      const target = pendingScroll.current;
      pendingScroll.current = null;
      if (!pane || target === null) return;
      // Two frames of certainty: once now, once after the wider content lays out.
      pane.scrollLeft = target;
      requestAnimationFrame(() => {
        if (paneRef.current) paneRef.current.scrollLeft = target;
      });
    });
  }, [api, paneRef]);

  return view;
}

/**
 * Binds the pane's wheel handling. Lives in the component that renders the
 * pane: Radix mounts dialog content on a second pass, so an effect higher up
 * would run before the element exists and never see it.
 */
export function useTimelineWheel(paneRef: RefObject<HTMLDivElement | null>, view: TimelineView): void {
  const api = useTimelineStoreApi();
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = wheelDeltaPx(e, pane);
      if (e.ctrlKey || e.metaKey) {
        const rect = pane.getBoundingClientRect();
        view.zoomTo(wheelZoomPxPerMs(api.getState().pxPerMs, delta.y), e.clientX - rect.left);
        return;
      }
      if (e.shiftKey) {
        pane.scrollLeft += delta.y || delta.x;
        return;
      }
      if (Math.abs(delta.x) > Math.abs(delta.y)) pane.scrollLeft += delta.x;
      else pane.scrollTop += delta.y;
    };
    pane.addEventListener("wheel", onWheel, { passive: false });
    return () => pane.removeEventListener("wheel", onWheel);
  }, [api, paneRef, view]);
}
