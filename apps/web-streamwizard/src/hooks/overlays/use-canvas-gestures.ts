"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCropInsets,
  getDesignSize,
  getItemScale,
  resolveAnchoredPosition,
  withAbsolutePosition,
} from "@repo/ui/overlay";
import type { OverlayItem } from "@/types/overlays";
import { isRootLayerType } from "@/components/overlays/registry/overlay-widget-registry";
import {
  computeSnap,
  type GapBadge,
  type Guide,
} from "@/components/overlays/editor/snapping";
import { useOverlayStore } from "@/stores/overlay-editor-store";
import {
  computeCropUpdate,
  computeResizeUpdate,
  groupMoveBounds,
  resolveDragAxis,
  type DragItemStart,
} from "@/components/overlays/editor/canvas-resize-math";
import { snapToGrid } from "@/components/overlays/editor/canvas-preferences";
import { fromAbsoluteGeometry } from "@/components/overlays/editor/overlay-item-helpers";
import { extendsSelection } from "@/components/overlays/editor/selection-modifiers";

/** Screen-px snap radius; converted to scene px by dividing by zoom. */
const SNAP_THRESHOLD_PX = 8;
/** Screen-px movement before a background drag becomes a marquee (below = click-to-deselect). */
const MARQUEE_THRESHOLD_PX = 4;
/** Travel before Shift commits the drag to an axis; below this the pointer hasn't said which. */
const AXIS_LOCK_THRESHOLD_PX = 4;

export interface DragState {
  mode: "move" | "resize";
  /** The item the pointer went down on — snapping references its rect. */
  grabbedId: string;
  pointerStartX: number;
  pointerStartY: number;
  items: DragItemStart[];
  handle?: string;
}

export interface MarqueeState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  active: boolean;
  additive: boolean;
}

/**
 * All pointer handling for the editor canvas: move/resize/crop drags, the
 * rubber-band marquee, snap guides and the one-history-entry-per-gesture rule.
 * The canvas component itself only renders what this returns.
 *
 * Everything in here works in absolute scene coordinates. Items store their
 * position as an offset from an anchor, so a gesture reads its start position
 * through `resolveAnchoredPosition` and writes back through
 * `fromAbsoluteGeometry`; the maths in between never sees an anchor.
 */
export function useCanvasGestures() {
  const scene = useOverlayStore((s) => s.scene);
  const selectedItemIds = useOverlayStore((s) => s.selectedItemIds);
  const zoom = useOverlayStore((s) => s.zoom);
  const grid = useOverlayStore((s) => s.grid);
  const snapToItems = useOverlayStore((s) => s.snapToItems);
  const selectItem = useOverlayStore((s) => s.selectItem);
  const toggleSelectItem = useOverlayStore((s) => s.toggleSelectItem);
  const setSelectedItems = useOverlayStore((s) => s.setSelectedItems);
  const clearSelection = useOverlayStore((s) => s.clearSelection);
  const updateItem = useOverlayStore((s) => s.updateItem);
  const pushHistory = useOverlayStore((s) => s.pushHistory);

  const canvasRef = useRef<HTMLDivElement>(null);
  /** Alt re-purposes the resize handles as crop handles; tracked so they can say so. */
  const [cropModifier, setCropModifier] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [gaps, setGaps] = useState<GapBadge[]>([]);
  /** Pre-gesture items snapshot — pushed as one history entry on mouseup if geometry changed. */
  const gestureSnapshotRef = useRef<OverlayItem[] | null>(null);
  const movedRef = useRef(false);
  /** Axis a Shift-held drag committed to, kept for the rest of the gesture. */
  const axisLockRef = useRef<"x" | "y" | null>(null);

  useEffect(() => {
    const sync = (e: KeyboardEvent) => setCropModifier(e.altKey);
    // Alt-tabbing away leaves keyup unheard, so drop the state on blur too.
    const clear = () => setCropModifier(false);
    window.addEventListener("keydown", sync);
    window.addEventListener("keyup", sync);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", sync);
      window.removeEventListener("keyup", sync);
      window.removeEventListener("blur", clear);
    };
  }, []);

  const toScenePoint = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (e.clientX - rect.left) / zoom,
        y: (e.clientY - rect.top) / zoom,
      };
    },
    [zoom],
  );

  const handleItemMouseDown = useCallback(
    (e: React.MouseEvent, itemId: string, mode: "move" | "resize", handle?: string) => {
      if (e.button !== 0) return; // right-click opens the context menu, never a drag
      e.stopPropagation();
      e.preventDefault();

      if (!scene) return;
      const item = scene.items.find((i) => i.id === itemId);
      if (!item) return;

      if (extendsSelection(e) && mode === "move" && isRootLayerType(item.type)) {
        toggleSelectItem(itemId);
        return;
      }

      // Locked items are selectable but never draggable.
      if (item.is_locked) {
        if (!selectedItemIds.includes(itemId)) selectItem(itemId);
        return;
      }

      const inSelection = selectedItemIds.includes(itemId);
      if (!inSelection) selectItem(itemId);

      // Group move when grabbing a member of a multi-selection; resize is always single-item.
      const groupIds =
        mode === "move" && inSelection && selectedItemIds.length > 1 ? selectedItemIds : [itemId];
      const items: DragItemStart[] = groupIds
        .map((id) => scene.items.find((i) => i.id === id))
        .filter(
          (i): i is OverlayItem => !!i && !i.is_locked && (i.id === itemId || isRootLayerType(i.type)),
        )
        .map((i) => {
          const design = getDesignSize(i);
          const position = resolveAnchoredPosition(i, scene);
          return {
            id: i.id,
            startX: position.x,
            startY: position.y,
            startW: i.w,
            startH: i.h,
            startDesignW: design.w,
            startDesignH: design.h,
            startCrop: getCropInsets(i),
            startScale: getItemScale(i),
          };
        });
      if (items.length === 0) return;

      gestureSnapshotRef.current = scene.items;
      movedRef.current = false;
      axisLockRef.current = null;
      setDragState({
        mode,
        grabbedId: itemId,
        pointerStartX: e.clientX,
        pointerStartY: e.clientY,
        items,
        handle,
      });
    },
    [scene, selectedItemIds, selectItem, toggleSelectItem],
  );

  const handleBackgroundMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      // A marquee dragged across a text widget would otherwise start a
      // native text selection and paint it blue.
      e.preventDefault();
      const point = toScenePoint(e);
      setMarquee({
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y,
        active: false,
        additive: extendsSelection(e),
      });
    },
    [toScenePoint],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!scene) return;

      if (marquee) {
        const point = toScenePoint(e);
        const movedPx =
          Math.max(Math.abs(point.x - marquee.startX), Math.abs(point.y - marquee.startY)) * zoom;
        setMarquee({
          ...marquee,
          currentX: point.x,
          currentY: point.y,
          active: marquee.active || movedPx > MARQUEE_THRESHOLD_PX,
        });
        return;
      }

      if (!dragState) return;

      const dx = (e.clientX - dragState.pointerStartX) / zoom;
      const dy = (e.clientY - dragState.pointerStartY) / zoom;
      if (dx !== 0 || dy !== 0) movedRef.current = true;

      if (dragState.mode === "move") {
        // Shift locks the drag to whichever axis the pointer commits to first.
        // Decided once, a few pixels in, so a wobble near the diagonal can't
        // flip it mid-gesture; letting go of Shift frees both axes again.
        // Shift on mousedown already means "toggle selection" and returns before
        // any drag starts, so this only ever engages once one is under way.
        let lockedAxis: "x" | "y" | null = null;
        if (e.shiftKey) {
          axisLockRef.current =
            axisLockRef.current ?? resolveDragAxis(dx, dy, zoom, AXIS_LOCK_THRESHOLD_PX);
          lockedAxis = axisLockRef.current;
        } else {
          axisLockRef.current = null;
        }

        const moveDx = lockedAxis === "y" ? 0 : dx;
        const moveDy = lockedAxis === "x" ? 0 : dy;

        const { minDx, maxDx, minDy, maxDy } = groupMoveBounds(dragState.items, scene);
        let cdx = Math.min(Math.max(moveDx, minDx), maxDx);
        let cdy = Math.min(Math.max(moveDy, minDy), maxDy);

        // Snap using the grabbed item's rect. Alt inverts whatever the toggle
        // says rather than only turning snapping off: with snapping off it is
        // how you snap one drag without going back to the toolbar.
        const grabbed = dragState.items.find((i) => i.id === dragState.grabbedId);
        const snapAxes = {
          x: snapToItems.x !== e.altKey,
          y: snapToItems.y !== e.altKey,
        };
        if (grabbed && (snapAxes.x || snapAxes.y)) {
          const draggedIds = new Set(dragState.items.map((i) => i.id));
          const targets = scene.items
            .filter((i) => isRootLayerType(i.type) && i.is_visible && !draggedIds.has(i.id))
            .map((i) => withAbsolutePosition(i, scene));
          const snapped = computeSnap(
            {
              x: grabbed.startX + cdx,
              y: grabbed.startY + cdy,
              w: grabbed.startW,
              h: grabbed.startH,
            },
            targets,
            scene,
            SNAP_THRESHOLD_PX / zoom,
            snapAxes,
          );
          const snapDx = snapped.x - (grabbed.startX + cdx);
          const snapDy = snapped.y - (grabbed.startY + cdy);
          // Only accept a snap that keeps the whole group in bounds, and never
          // one on a locked axis -- that would move what Shift is holding still.
          if (lockedAxis !== "y" && cdx + snapDx >= minDx && cdx + snapDx <= maxDx) {
            cdx += snapDx;
          }
          if (lockedAxis !== "x" && cdy + snapDy >= minDy && cdy + snapDy <= maxDy) {
            cdy += snapDy;
          }
          setGaps(snapped.gaps);
          // A vertical guide belongs to the x axis, a horizontal one to y; only
          // show the axis that is actually free to move.
          setGuides(
            lockedAxis === null
              ? snapped.guides
              : snapped.guides.filter((guide) =>
                  lockedAxis === "x" ? guide.orientation === "v" : guide.orientation === "h",
                ),
          );
        } else {
          setGuides([]);
          setGaps([]);
        }

        for (const it of dragState.items) {
          const item = scene.items.find((i) => i.id === it.id);
          if (!item) continue;
          // Grid snapping lands the item itself on the grid, so it is applied to
          // the final position rather than the delta. Alt inverts it too, so one
          // modifier flips every kind of snapping at once.
          const nextX = it.startX + cdx;
          const nextY = it.startY + cdy;
          const onGrid = grid.snap !== e.altKey;
          updateItem(
            it.id,
            fromAbsoluteGeometry(
              item,
              {
                x: Math.round(onGrid ? snapToGrid(nextX, grid.size) : nextX),
                y: Math.round(onGrid ? snapToGrid(nextY, grid.size) : nextY),
              },
              scene,
            ),
          );
        }
        return;
      }

      if (dragState.mode === "resize") {
        const it = dragState.items[0]!;
        const item = scene.items.find((i) => i.id === it.id);
        if (!item) return;
        const handle = dragState.handle ?? "se";
        updateItem(
          it.id,
          fromAbsoluteGeometry(
            item,
            e.altKey
              ? computeCropUpdate(it, handle, dx, dy)
              : computeResizeUpdate(it, handle, dx, dy, e.shiftKey),
            scene,
          ),
        );
      }
    },
    [
      dragState,
      marquee,
      scene,
      zoom,
      updateItem,
      toScenePoint,
      snapToItems.x,
      snapToItems.y,
      grid.snap,
      grid.size,
    ],
  );

  const handleMouseUp = useCallback(() => {
    if (marquee && scene) {
      if (marquee.active) {
        const x1 = Math.min(marquee.startX, marquee.currentX);
        const y1 = Math.min(marquee.startY, marquee.currentY);
        const x2 = Math.max(marquee.startX, marquee.currentX);
        const y2 = Math.max(marquee.startY, marquee.currentY);
        const hit = scene.items
          .filter((i) => isRootLayerType(i.type) && i.is_visible && !i.is_locked)
          .map((i) => withAbsolutePosition(i, scene))
          .filter((i) => i.x < x2 && i.x + i.w > x1 && i.y < y2 && i.y + i.h > y1)
          .map((i) => i.id);
        setSelectedItems(
          marquee.additive ? Array.from(new Set([...selectedItemIds, ...hit])) : hit,
        );
      } else if (!marquee.additive) {
        clearSelection();
      }
      setMarquee(null);
      return;
    }

    if (dragState) {
      if (movedRef.current && gestureSnapshotRef.current) {
        pushHistory(gestureSnapshotRef.current); // one undo entry per drag/resize gesture
      } else if (!movedRef.current && selectedItemIds.length > 1) {
        // Plain click (no drag) on a multi-selected item collapses to that item.
        selectItem(dragState.grabbedId);
      }
      gestureSnapshotRef.current = null;
      movedRef.current = false;
      axisLockRef.current = null;
      setDragState(null);
      setGuides([]);
      setGaps([]);
    }
  }, [
    marquee,
    dragState,
    scene,
    selectedItemIds,
    setSelectedItems,
    selectItem,
    clearSelection,
    pushHistory,
  ]);

  /** Mid-gesture the mode is already fixed, so only advertise crop when idle. */
  const cropping = cropModifier && !dragState;

  const marqueeRect = marquee?.active
    ? {
        x: Math.min(marquee.startX, marquee.currentX),
        y: Math.min(marquee.startY, marquee.currentY),
        w: Math.abs(marquee.currentX - marquee.startX),
        h: Math.abs(marquee.currentY - marquee.startY),
      }
    : null;

  return {
    canvasRef,
    cropping,
    dragState,
    guides,
    gaps,
    marqueeRect,
    handleItemMouseDown,
    handleBackgroundMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
