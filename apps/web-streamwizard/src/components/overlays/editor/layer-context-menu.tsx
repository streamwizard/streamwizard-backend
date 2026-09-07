"use client";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@repo/ui";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Pencil,
  Trash2,
  Unlock,
} from "lucide-react";
import type { OverlayItem } from "@/types/overlays";
import { asClipDisplayFieldConfig } from "@/types/overlays";
import { useOverlayStore } from "@/stores/overlay-editor-store";

interface LayerContextMenuProps {
  item: OverlayItem;
  /** Called for "Rename" — layers panel starts inline editing; canvas focuses the inspector label. */
  onRename?: () => void;
  children: React.ReactNode;
}

/**
 * Shared right-click menu for canvas widgets and layer rows.
 * When the item is part of a multi-selection, Duplicate/Delete act on the whole
 * selection and single-item actions (rename, z-order, lock, visibility) are hidden.
 * No delete confirmation — undo (Ctrl+Z) covers it.
 */
export function LayerContextMenu({ item, onRename, children }: LayerContextMenuProps) {
  const {
    selectedItemIds,
    duplicateItem,
    duplicateSelectedItems,
    removeItem,
    removeSelectedItems,
    bringToFront,
    sendToBack,
    reorderItem,
    toggleItemLock,
    toggleItemVisibility,
  } = useOverlayStore();

  const isMulti =
    selectedItemIds.length > 1 && selectedItemIds.includes(item.id);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {!isMulti && onRename ? (
          <ContextMenuItem onSelect={() => onRename()}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Rename
          </ContextMenuItem>
        ) : null}
        <ContextMenuItem
          onSelect={() => (isMulti ? duplicateSelectedItems() : duplicateItem(item.id))}
        >
          <Copy className="mr-2 h-3.5 w-3.5" />
          Duplicate
          <ContextMenuShortcut>Ctrl+D</ContextMenuShortcut>
        </ContextMenuItem>

        {!isMulti ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => bringToFront(item.id)}>
              <ArrowUpToLine className="mr-2 h-3.5 w-3.5" />
              Bring to front
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => reorderItem(item.id, "up")}>
              <ArrowUp className="mr-2 h-3.5 w-3.5" />
              Bring forward
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => reorderItem(item.id, "down")}>
              <ArrowDown className="mr-2 h-3.5 w-3.5" />
              Send backward
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => sendToBack(item.id)}>
              <ArrowDownToLine className="mr-2 h-3.5 w-3.5" />
              Send to back
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => toggleItemLock(item.id)}>
              {item.is_locked ? (
                <>
                  <Unlock className="mr-2 h-3.5 w-3.5" />
                  Unlock
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-3.5 w-3.5" />
                  Lock
                </>
              )}
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => toggleItemVisibility(item.id)}>
              {item.is_visible ? (
                <>
                  <EyeOff className="mr-2 h-3.5 w-3.5" />
                  Hide
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-3.5 w-3.5" />
                  Show
                </>
              )}
            </ContextMenuItem>
          </>
        ) : null}

        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onSelect={() => (isMulti ? removeSelectedItems() : removeItem(item.id))}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Delete
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

interface ClipFieldContextMenuProps {
  field: OverlayItem;
  /** Sibling fields, front to back, as the layers panel lists them. */
  siblings: OverlayItem[];
  children: React.ReactNode;
}

/**
 * Right-click menu for a clip display field row. These never leave their
 * clips widget, so there is no rename, duplicate or delete: only stacking
 * order, plus the same show/lock toggles the row itself carries.
 */
export function ClipFieldContextMenu({
  field,
  siblings,
  children,
}: ClipFieldContextMenuProps) {
  const { updateItem, toggleItemVisibility, selectedItemIds, selectItem } =
    useOverlayStore();

  const fc = asClipDisplayFieldConfig(field.config);
  const index = siblings.findIndex((s) => s.id === field.id);
  const above = index > 0 ? siblings[index - 1] : undefined;
  const below =
    index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : undefined;

  const swapStack = (other: OverlayItem) => {
    const o = asClipDisplayFieldConfig(other.config);
    updateItem(field.id, { config: { ...fc, stackOrder: o.stackOrder } });
    updateItem(other.id, { config: { ...o, stackOrder: fc.stackOrder } });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem disabled={!above} onSelect={() => above && swapStack(above)}>
          <ArrowUp className="mr-2 h-3.5 w-3.5" />
          Bring forward
        </ContextMenuItem>
        <ContextMenuItem disabled={!below} onSelect={() => below && swapStack(below)}>
          <ArrowDown className="mr-2 h-3.5 w-3.5" />
          Send backward
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() =>
            updateItem(field.id, {
              config: { ...fc, isLayoutLocked: !fc.isLayoutLocked },
            })
          }
        >
          {fc.isLayoutLocked ? (
            <>
              <Unlock className="mr-2 h-3.5 w-3.5" />
              Unlock in editor
            </>
          ) : (
            <>
              <Lock className="mr-2 h-3.5 w-3.5" />
              Lock position &amp; size
            </>
          )}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            toggleItemVisibility(field.id);
            // A field that just went hidden should not stay the selection.
            if (field.is_visible && selectedItemIds.includes(field.id)) {
              selectItem(fc.parentClipItemId);
            }
          }}
        >
          {field.is_visible ? (
            <>
              <EyeOff className="mr-2 h-3.5 w-3.5" />
              Hide on overlay
            </>
          ) : (
            <>
              <Eye className="mr-2 h-3.5 w-3.5" />
              Show on overlay
            </>
          )}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
