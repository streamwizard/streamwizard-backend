import {
  clampCrop,
  getCropInsets,
  getDesignSize,
  resolveAnchoredPosition,
  toAnchoredOffset,
} from "@repo/ui/overlay";
import {
  getOverlayWidgetDefinition,
  isRootLayerType,
  isRootOverlayDefinition,
} from "@/components/overlays/registry/overlay-widget-registry";
import type { OverlayItem, OverlaySceneWithItems } from "@/types/overlays";
import { asClipDisplayFieldConfig } from "@/types/overlays";

/** Pure geometry/item helpers behind the overlay editor store. No store access. */

export const MIN_ITEM_SIZE = 50;

let tempIdCounter = 0;

export function nextTempId(): string {
  tempIdCounter++;
  return `temp-${tempIdCounter}`;
}

/**
 * Keep an item inside the scene: size capped to scene dims, position so the
 * whole rect stays in-bounds. Single choke point for move/resize/nudge/inspector.
 *
 * `x`/`y` in `updates` are anchored offsets, like the model. The clamp itself
 * happens in absolute scene space and the result is converted back, so a
 * right-anchored item pushed past the left edge stops at the left edge rather
 * than at some offset that only looks right from one side. A patch that
 * changes the anchor must also say what the new offset is; on its own the old
 * offset is simply re-read from the new edge.
 *
 * The design box lives outside scene space (it is what the content is drawn at
 * before scaling), so it only gets a lower bound. When a caller changes the
 * rendered size without saying what the design size should be, the design box
 * is left alone and the content simply scales — that is the whole point.
 */
export function clampGeometry(
  item: OverlayItem,
  updates: Partial<OverlayItem>,
  scene: { width: number; height: number }
): Partial<OverlayItem> {
  const w = Math.min(Math.max(MIN_ITEM_SIZE, updates.w ?? item.w), scene.width);
  const h = Math.min(Math.max(MIN_ITEM_SIZE, updates.h ?? item.h), scene.height);
  const frame = {
    w,
    h,
    anchor_x: updates.anchor_x ?? item.anchor_x,
    anchor_y: updates.anchor_y ?? item.anchor_y,
  };
  const absolute = resolveAnchoredPosition(
    { ...frame, x: updates.x ?? item.x, y: updates.y ?? item.y },
    scene
  );
  const { x, y } = toAnchoredOffset(
    {
      x: Math.min(Math.max(0, absolute.x), scene.width - w),
      y: Math.min(Math.max(0, absolute.y), scene.height - h),
    },
    frame,
    scene
  );
  const geometry: Partial<OverlayItem> = { ...updates, x, y, w, h };
  if (updates.design_w !== undefined) {
    geometry.design_w = Math.max(MIN_ITEM_SIZE, updates.design_w);
  }
  if (updates.design_h !== undefined) {
    geometry.design_h = Math.max(MIN_ITEM_SIZE, updates.design_h);
  }

  if (touchesCrop(updates)) {
    const design = {
      w: geometry.design_w ?? getDesignSize(item).w,
      h: geometry.design_h ?? getDesignSize(item).h,
    };
    const current = getCropInsets(item);
    const crop = clampCrop(
      {
        top: updates.crop_top ?? current.top,
        right: updates.crop_right ?? current.right,
        bottom: updates.crop_bottom ?? current.bottom,
        left: updates.crop_left ?? current.left,
      },
      design
    );
    geometry.crop_top = crop.top;
    geometry.crop_right = crop.right;
    geometry.crop_bottom = crop.bottom;
    geometry.crop_left = crop.left;
  }

  return geometry;
}

export function touchesCrop(updates: Partial<OverlayItem>): boolean {
  return (
    updates.crop_top !== undefined ||
    updates.crop_right !== undefined ||
    updates.crop_bottom !== undefined ||
    updates.crop_left !== undefined
  );
}

export function touchesGeometry(updates: Partial<OverlayItem>): boolean {
  return (
    updates.x !== undefined ||
    updates.y !== undefined ||
    updates.anchor_x !== undefined ||
    updates.anchor_y !== undefined ||
    updates.w !== undefined ||
    updates.h !== undefined ||
    updates.design_w !== undefined ||
    updates.design_h !== undefined ||
    touchesCrop(updates)
  );
}

/**
 * Converts a geometry patch whose `x`/`y` are absolute scene coordinates into
 * the item's anchored offsets, ready for `updateItem`.
 *
 * Drag, nudge and layout maths all think in absolute space, and this is the one
 * boundary where that meets the model. The frame's size comes from the patch
 * when it changes it, so a resize that moves the left edge still lands the
 * right-anchored offset where the cursor put the box. A patch without a
 * position passes through untouched: resizing an anchored item then grows it
 * away from its anchored edge, which is what pinning it there means.
 */
export function fromAbsoluteGeometry(
  item: OverlayItem,
  patch: Partial<OverlayItem>,
  scene: { width: number; height: number }
): Partial<OverlayItem> {
  if (patch.x === undefined && patch.y === undefined) return patch;
  const current = resolveAnchoredPosition(item, scene);
  const offset = toAnchoredOffset(
    { x: patch.x ?? current.x, y: patch.y ?? current.y },
    {
      w: patch.w ?? item.w,
      h: patch.h ?? item.h,
      anchor_x: patch.anchor_x ?? item.anchor_x,
      anchor_y: patch.anchor_y ?? item.anchor_y,
    },
    scene
  );
  const next = { ...patch };
  if (patch.x !== undefined) next.x = offset.x;
  if (patch.y !== undefined) next.y = offset.y;
  return next;
}

export type SceneEdge = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";

/**
 * Pins an item to a scene edge or centre line. The anchor moves and the offset
 * resets, so this is a relationship rather than a one-off move: the item stays
 * on that edge when the scene's resolution changes or it renders at another
 * size.
 */
export function pinToSceneEdge(edge: SceneEdge): Partial<OverlayItem> {
  switch (edge) {
    case "left":
      return { anchor_x: "left", x: 0 };
    case "hcenter":
      return { anchor_x: "center", x: 0 };
    case "right":
      return { anchor_x: "right", x: 0 };
    case "top":
      return { anchor_y: "top", y: 0 };
    case "vcenter":
      return { anchor_y: "center", y: 0 };
    case "bottom":
      return { anchor_y: "bottom", y: 0 };
  }
}

/**
 * Changes where an item is measured from without moving it: the offsets are
 * recomputed so the resolved position is exactly what it was.
 */
export function reanchorInPlace(
  item: OverlayItem,
  anchor: Partial<Pick<OverlayItem, "anchor_x" | "anchor_y">>,
  scene: { width: number; height: number }
): Partial<OverlayItem> {
  const absolute = resolveAnchoredPosition(item, scene);
  const offset = toAnchoredOffset(absolute, { ...item, ...anchor }, scene);
  return { ...anchor, x: offset.x, y: offset.y };
}

/** Ids removed when deleting a root: itself plus any registry-defined children. */
export function cascadeIds(scene: OverlaySceneWithItems, id: string): Set<string> {
  const ids = new Set<string>([id]);
  const item = scene.items.find((i) => i.id === id);
  const def = item ? getOverlayWidgetDefinition(item.type) : undefined;
  if (item && def && isRootOverlayDefinition(def) && def.getChildItems) {
    for (const ch of def.getChildItems(scene.items, id)) {
      ids.add(ch.id);
    }
  }
  return ids;
}

/** Build duplicate items (parent + synced children) for a root item. */
export function buildDuplicate(
  scene: OverlaySceneWithItems,
  id: string,
  maxZ: number
): { items: OverlayItem[]; parentId: string } | null {
  const original = scene.items.find((item) => item.id === id);
  if (!original || !isRootLayerType(original.type)) return null;

  // Offset down-right on screen whatever the anchor; a raw offset bump would
  // send a right-anchored copy the other way.
  const position = resolveAnchoredPosition(original, scene);
  const newParentId = nextTempId();
  const duplicateParent: OverlayItem = {
    ...original,
    id: newParentId,
    ...fromAbsoluteGeometry(original, { x: position.x + 20, y: position.y + 20 }, scene),
    z_index: maxZ + 1,
    label: original.label + " (Copy)",
  };

  const newItems: OverlayItem[] = [duplicateParent];

  const origDef = getOverlayWidgetDefinition(original.type);
  if (isRootOverlayDefinition(origDef) && origDef.getChildItems) {
    const children = origDef.getChildItems(scene.items, id);
    for (const ch of children) {
      const cfg = asClipDisplayFieldConfig(ch.config);
      newItems.push({
        ...ch,
        id: nextTempId(),
        x: duplicateParent.x,
        y: duplicateParent.y,
        anchor_x: duplicateParent.anchor_x,
        anchor_y: duplicateParent.anchor_y,
        w: duplicateParent.w,
        h: duplicateParent.h,
        design_w: duplicateParent.design_w,
        design_h: duplicateParent.design_h,
        crop_top: duplicateParent.crop_top,
        crop_right: duplicateParent.crop_right,
        crop_bottom: duplicateParent.crop_bottom,
        crop_left: duplicateParent.crop_left,
        z_index: duplicateParent.z_index,
        config: {
          ...cfg,
          parentClipItemId: newParentId,
        },
      });
    }
  }

  return { items: newItems, parentId: newParentId };
}

/** Apply a top-first root ordering: contiguous z (top = count), clip children mirror parent z. */
export function applyLayerOrder(
  items: OverlayItem[],
  orderedIdsTopFirst: string[]
): OverlayItem[] {
  const zById = new Map<string, number>();
  orderedIdsTopFirst.forEach((id, idx) => {
    zById.set(id, orderedIdsTopFirst.length - idx);
  });

  return items.map((i) => {
    if (isRootLayerType(i.type)) {
      const z = zById.get(i.id);
      return z === undefined ? i : { ...i, z_index: z };
    }
    if (i.type === "clip_display_field") {
      const pid = asClipDisplayFieldConfig(i.config).parentClipItemId;
      const pz = zById.get(pid);
      return pz === undefined ? i : { ...i, z_index: pz };
    }
    return i;
  });
}

