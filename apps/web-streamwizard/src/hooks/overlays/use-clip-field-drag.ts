"use client";

import { useCallback, useEffect, useState } from "react";
import type { RefObject } from "react";
import type { ClipDisplayFieldLayout, DisplayFieldKey } from "@repo/ui/overlay";

/**
 * Drag-to-move / drag-to-resize for the clip widget's display fields in the
 * editor. Layouts are percentages of the widget box, so every delta is
 * converted against the element's measured size and clamped to stay inside it.
 */
export function useClipFieldDrag({
  editable,
  rootRef,
  displayFieldLocks,
  getFieldLayout,
  onUpdateDisplayFieldLayout,
  onSelectField,
}: {
  editable: boolean;
  rootRef: RefObject<HTMLDivElement | null>;
  displayFieldLocks: Record<string, boolean>;
  getFieldLayout: (field: DisplayFieldKey) => ClipDisplayFieldLayout;
  onUpdateDisplayFieldLayout?: (field: DisplayFieldKey, layout: Partial<ClipDisplayFieldLayout>) => void;
  onSelectField: (field: DisplayFieldKey | null) => void;
}) {
  const [fieldDrag, setFieldDrag] = useState<{
    field: DisplayFieldKey;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    startLayout: ClipDisplayFieldLayout;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (!fieldDrag || !onUpdateDisplayFieldLayout) return;
    const activeDrag = fieldDrag;
    const updateLayout = onUpdateDisplayFieldLayout;

    function onMouseMove(e: MouseEvent) {
      const dx = e.clientX - activeDrag.startX;
      const dy = e.clientY - activeDrag.startY;
      const dxPct = (dx / activeDrag.width) * 100;
      const dyPct = (dy / activeDrag.height) * 100;

      if (activeDrag.mode === "move") {
        const nextX = Math.max(
          0,
          Math.min(
            100 - activeDrag.startLayout.w,
            activeDrag.startLayout.x + dxPct
          )
        );
        const nextY = Math.max(
          0,
          Math.min(
            100 - activeDrag.startLayout.h,
            activeDrag.startLayout.y + dyPct
          )
        );
        updateLayout(activeDrag.field, {
          x: Number(nextX.toFixed(2)),
          y: Number(nextY.toFixed(2)),
        });
      } else {
        const nextW = Math.max(
          5,
          Math.min(100 - activeDrag.startLayout.x, activeDrag.startLayout.w + dxPct)
        );
        const nextH = Math.max(
          5,
          Math.min(100 - activeDrag.startLayout.y, activeDrag.startLayout.h + dyPct)
        );
        updateLayout(activeDrag.field, {
          w: Number(nextW.toFixed(2)),
          h: Number(nextH.toFixed(2)),
        });
      }
    }

    function onMouseUp() {
      setFieldDrag(null);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [fieldDrag, onUpdateDisplayFieldLayout]);

  const startFieldDrag = useCallback(
    (
      e: React.MouseEvent,
      field: DisplayFieldKey,
      mode: "move" | "resize"
    ) => {
      if (!editable) return;
      if (displayFieldLocks[field]) return;
      e.stopPropagation();
      e.preventDefault();
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();

      onSelectField(field);
      setFieldDrag({
        field,
        mode,
        startX: e.clientX,
        startY: e.clientY,
        startLayout: getFieldLayout(field),
        width: rect.width,
        height: rect.height,
      });
    },
    [editable, displayFieldLocks, getFieldLayout, onSelectField]
  );

  return { fieldDrag, startFieldDrag };
}
