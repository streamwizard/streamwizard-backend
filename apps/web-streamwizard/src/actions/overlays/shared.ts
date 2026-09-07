import type { Json } from "@repo/supabase";
import type { ClipDisplayFieldItemConfig, OverlayItemConfig } from "@/types/overlays";
import type { overlayItemSchema } from "@/schemas/overlay";
import type { z } from "zod";

/** Internal helpers shared by the overlay action modules. Not server actions. */

export const OVERLAYS_ERROR_SCOPE = "actions/overlays";

export function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    Math.random().toString(36).substring(2, 8)
  );
}

/**
 * Editor state holds not-yet-saved items under `temp-*` ids, so "has an id"
 * isn't the same as "exists in the database".
 */
export function isPersistedOverlayItemId(id: string | undefined): boolean {
  return (
    !!id &&
    !id.startsWith("temp-") &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  );
}

/** Clip-field children point at their parent by id; re-point them after an insert. */
export function resolveClipFieldParentRefs(
  cfg: OverlayItemConfig,
  idMap: Map<string, string>,
): OverlayItemConfig {
  if (typeof cfg !== "object" || !cfg || !("parentClipItemId" in cfg)) return cfg;
  const c = cfg as ClipDisplayFieldItemConfig;
  const nextParent = idMap.get(c.parentClipItemId) ?? c.parentClipItemId;
  if (nextParent === c.parentClipItemId) return cfg;
  return { ...c, parentClipItemId: nextParent };
}

type ParsedOverlayItem = z.infer<typeof overlayItemSchema>;

/**
 * The geometry/appearance columns of an overlay item, mapped straight off a
 * validated payload. Every insert and update path needs exactly this shape, so
 * it lives here instead of being spelled out five times.
 */
export function overlayItemColumns(parsed: ParsedOverlayItem) {
  return {
    type: parsed.type,
    x: parsed.x,
    y: parsed.y,
    anchor_x: parsed.anchor_x,
    anchor_y: parsed.anchor_y,
    w: parsed.w,
    h: parsed.h,
    design_w: parsed.design_w,
    design_h: parsed.design_h,
    crop_top: parsed.crop_top,
    crop_right: parsed.crop_right,
    crop_bottom: parsed.crop_bottom,
    crop_left: parsed.crop_left,
    z_index: parsed.z_index,
    rotation: parsed.rotation,
    flip_h: parsed.flip_h,
    flip_v: parsed.flip_v,
    opacity: parsed.opacity,
    is_visible: parsed.is_visible,
    is_locked: parsed.is_locked,
    label: parsed.label,
    config: parsed.config as unknown as Json,
  };
}
