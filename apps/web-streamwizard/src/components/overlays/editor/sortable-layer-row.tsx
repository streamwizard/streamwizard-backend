"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";

export interface LayerDragHandle {
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
  isDragging: boolean;
}

interface SortableLayerRowProps {
  id: string;
  children: (drag: LayerDragHandle) => React.ReactNode;
}

/** Sortable wrapper for a root layer row; exposes drag attributes/listeners for a grip handle. */
export function SortableLayerRow({ id, children }: SortableLayerRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={isDragging ? "opacity-50 relative z-10" : undefined}
    >
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}
