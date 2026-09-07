"use client";

import { useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button, cn, Input } from "@repo/ui";
import { Eye, EyeOff, GripVertical, Lock, Unlock } from "lucide-react";
import type { ClipsWidgetConfig, RootOverlayItemType } from "@/types/overlays";
import {
  asClipDisplayFieldConfig,
  buildCompositeClipsConfig,
} from "@/types/overlays";
import {
  getRootOverlayWidgetDefinition,
  isRootLayerType,
} from "../registry/overlay-widget-registry";
import { DISPLAY_FIELD_LABELS } from "../widgets/clips/nested-fields";
import { ClipFieldContextMenu, LayerContextMenu } from "./layer-context-menu";
import { extendsSelection } from "./selection-modifiers";
import { SortableLayerRow } from "./sortable-layer-row";
import { selectPrimarySelectedId, useOverlayStore } from "@/stores/overlay-editor-store";

export function EditorLayers() {
  const {
    scene,
    selectedItemIds,
    selectItem,
    toggleSelectItem,
    updateItem,
    renameItem,
    setLayerOrder,
    toggleItemVisibility,
    toggleItemLock,
  } = useOverlayStore();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const sensors = useSensors(
    // 5px activation distance keeps plain click-to-select working on rows.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!scene) return null;

  const primarySelectedId = selectPrimarySelectedId({ selectedItemIds });
  const selected = scene.items.find((i) => i.id === primarySelectedId);

  const rootItems = [...scene.items]
    .filter((i) => isRootLayerType(i.type))
    .sort((a, b) => b.z_index - a.z_index);
  const rootIds = rootItems.map((i) => i.id);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rootIds.indexOf(String(active.id));
    const newIndex = rootIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    setLayerOrder(arrayMove(rootIds, oldIndex, newIndex));
  }

  function commitRename(id: string) {
    const trimmed = renameDraft.trim();
    const current = scene?.items.find((i) => i.id === id);
    if (trimmed && current && trimmed !== current.label) {
      renameItem(id, trimmed);
    }
    setRenamingId(null);
  }

  return (
    <div className="p-3 space-y-1">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Layers
      </h3>

      {rootItems.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6">
          No items yet. Open Widgets in the header to add clips, text, a
          countdown, or a clock.
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={rootIds} strategy={verticalListSortingStrategy}>
          {rootItems.map((item) => {
            const hasFieldSelectedUnderThis =
              selected?.type === "clip_display_field" &&
              asClipDisplayFieldConfig(selected.config).parentClipItemId === item.id;
            const isParentRowSelected =
              selectedItemIds.includes(item.id) && !hasFieldSelectedUnderThis;

            const parentDef = getRootOverlayWidgetDefinition(
              item.type as RootOverlayItemType
            );
            const TypeIcon = parentDef.icon;
            const clipChildren = parentDef.getChildItems
              ? parentDef.getChildItems(scene.items, item.id).sort(
                  (a, b) =>
                    asClipDisplayFieldConfig(b.config).stackOrder -
                    asClipDisplayFieldConfig(a.config).stackOrder
                )
              : [];

            const clipComposite: ClipsWidgetConfig | null =
              item.type === "clips_widget"
                ? buildCompositeClipsConfig(item, scene.items)
                : null;

            return (
              <SortableLayerRow key={item.id} id={item.id}>
                {({ attributes, listeners }) => (
                  <div className="space-y-0.5">
                    <LayerContextMenu
                      item={item}
                      onRename={() => {
                        setRenamingId(item.id);
                        setRenameDraft(item.label);
                      }}
                    >
                      <div
                        className={`
                        flex items-center gap-1 rounded-md pl-0.5 pr-2 py-1.5 cursor-pointer text-sm
                        transition-colors group
                        ${
                          isParentRowSelected
                            ? "bg-accent text-accent-foreground"
                            : hasFieldSelectedUnderThis
                              ? "bg-accent/40 hover:bg-accent/50"
                              : "hover:bg-accent/50"
                        }
                        ${!item.is_visible ? "opacity-50" : ""}
                      `}
                        onClick={(e) => {
                          if (extendsSelection(e)) {
                            toggleSelectItem(item.id);
                          } else {
                            selectItem(item.id);
                          }
                        }}
                      >
                        <button
                          type="button"
                          className="h-5 w-4 shrink-0 flex items-center justify-center rounded text-muted-foreground/60 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-grab active:cursor-grabbing"
                          aria-label={`Reorder ${item.label}`}
                          onClick={(e) => e.stopPropagation()}
                          {...attributes}
                          {...listeners}
                        >
                          <GripVertical className="h-3 w-3" />
                        </button>

                        <TypeIcon
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                          aria-hidden
                        />

                        {renamingId === item.id ? (
                          <Input
                            autoFocus
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={() => commitRename(item.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename(item.id);
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            className="h-5 flex-1 text-xs px-1"
                          />
                        ) : (
                          <span
                            className="flex-1 min-w-0 truncate text-xs"
                            title={item.label}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setRenamingId(item.id);
                              setRenameDraft(item.label);
                            }}
                          >
                            {item.label}
                          </span>
                        )}

                        {/*
                          Only show/lock live on the row. Order, duplicate and
                          delete sit in the right-click menu, so the name keeps
                          the width.
                        */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <RowToggle
                            title={item.is_visible ? "Hide" : "Show"}
                            active={!item.is_visible}
                            groupHover="group-hover:opacity-100"
                            onClick={() => toggleItemVisibility(item.id)}
                          >
                            {item.is_visible ? (
                              <Eye className="h-3 w-3" />
                            ) : (
                              <EyeOff className="h-3 w-3" />
                            )}
                          </RowToggle>
                          <RowToggle
                            title={item.is_locked ? "Unlock" : "Lock"}
                            active={item.is_locked}
                            groupHover="group-hover:opacity-100"
                            onClick={() => toggleItemLock(item.id)}
                          >
                            {item.is_locked ? (
                              <Lock className="h-3 w-3" />
                            ) : (
                              <Unlock className="h-3 w-3" />
                            )}
                          </RowToggle>
                        </div>
                      </div>
                    </LayerContextMenu>

                    {clipComposite &&
                      clipChildren.map((child) => {
                        const fc = asClipDisplayFieldConfig(child.config);
                        const field = fc.fieldKey;
                        const locked = fc.isLayoutLocked;
                        const enabled = child.is_visible;
                        const fieldSelected = selectedItemIds.includes(child.id);

                        return (
                          <ClipFieldContextMenu
                            key={child.id}
                            field={child}
                            siblings={clipChildren}
                          >
                            <div
                              className={`
                                ml-2 pl-2 border-l border-border/70 flex items-center gap-1 rounded px-1 py-1 text-[11px] leading-tight
                                transition-colors group/field
                                ${fieldSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/40 text-muted-foreground hover:text-foreground"}
                                ${!enabled ? "opacity-50" : ""}
                              `}
                            >
                              <button
                                type="button"
                                className="flex-1 min-w-0 text-left truncate cursor-pointer rounded px-1 py-0.5"
                                onClick={() => selectItem(child.id)}
                              >
                                {DISPLAY_FIELD_LABELS[field]}
                              </button>

                              <div className="flex items-center gap-0 shrink-0">
                                <RowToggle
                                  title={enabled ? "Hide on overlay" : "Show on overlay"}
                                  active={!enabled}
                                  groupHover="group-hover/field:opacity-100"
                                  onClick={() => {
                                    toggleItemVisibility(child.id);
                                    if (enabled && selectedItemIds.includes(child.id)) {
                                      selectItem(item.id);
                                    }
                                  }}
                                >
                                  {enabled ? (
                                    <Eye className="h-3 w-3" />
                                  ) : (
                                    <EyeOff className="h-3 w-3" />
                                  )}
                                </RowToggle>
                                <RowToggle
                                  title={locked ? "Unlock in editor" : "Lock position & size"}
                                  active={locked}
                                  groupHover="group-hover/field:opacity-100"
                                  onClick={() =>
                                    updateItem(child.id, {
                                      config: { ...fc, isLayoutLocked: !locked },
                                    })
                                  }
                                >
                                  {locked ? (
                                    <Lock className="h-3 w-3" />
                                  ) : (
                                    <Unlock className="h-3 w-3" />
                                  )}
                                </RowToggle>
                              </div>
                            </div>
                          </ClipFieldContextMenu>
                        );
                      })}
                  </div>
                )}
              </SortableLayerRow>
            );
          })}
        </SortableContext>
      </DndContext>
    </div>
  );
}

/**
 * Show/lock button on a layer row. Hidden until the row is hovered, unless it
 * is already switched on: a hidden or locked layer should say so without a
 * mouse over it.
 */
function RowToggle({
  title,
  active,
  groupHover,
  onClick,
  children,
}: {
  title: string;
  active: boolean;
  /** The parent row's hover variant, e.g. `group-hover:opacity-100`. */
  groupHover: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "h-5 w-5 transition-opacity focus-visible:opacity-100",
        groupHover,
        active ? "opacity-100" : "opacity-0"
      )}
      title={title}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </Button>
  );
}
