"use server";

import { revalidatePath } from "next/cache";
import { reportError } from "@repo/sentry";
import type { Database } from "@repo/supabase";
import {
  deleteOverlayItemsByIds,
  getOverlayItems,
  insertOverlayItemsReturningIds,
  updateOverlayItemData,
} from "@repo/supabase/queries/overlays";
import { overlayItemSchema } from "@/schemas/overlay";
import type { OverlayItem, OverlayItemConfig, OverlaySceneWithItems } from "@/types/overlays";
import { tryAuthContext } from "@/lib/auth";
import { getOverlayScene } from "./scenes";
import {
  OVERLAYS_ERROR_SCOPE,
  isPersistedOverlayItemId,
  overlayItemColumns,
  resolveClipFieldParentRefs,
} from "./shared";

interface OverlayItemInput {
  id?: string;
  scene_id: string;
  type: string;
  x: number;
  y: number;
  anchor_x: OverlayItem["anchor_x"];
  anchor_y: OverlayItem["anchor_y"];
  w: number;
  h: number;
  design_w: number;
  design_h: number;
  crop_top: number;
  crop_right: number;
  crop_bottom: number;
  crop_left: number;
  z_index: number;
  rotation: number;
  opacity: number;
  is_visible: boolean;
  is_locked: boolean;
  label: string;
  config: OverlayItemConfig;
}

/**
 * Persists the editor's whole item list in one go: deletes what's gone, updates
 * what stayed, inserts what's new (roots before clip-field children, so the
 * children can be re-pointed at their new parent ids).
 */
export async function saveAllOverlayItems(
  sceneId: string,
  items: Array<OverlayItemInput & { temp_id: string }>,
): Promise<{
  success: boolean;
  error: string | null;
  data: OverlaySceneWithItems | null;
  /** temp-N id -> the DB id it was inserted as, so the editor can keep its selection. */
  idMap: Record<string, string>;
}> {
  const ctx = await tryAuthContext();
  if (!ctx) return { success: false, error: "Unauthorized", data: null, idMap: {} };
  const { supabase } = ctx;

  const idMap = new Map<string, string>();

  const { data: dbItems } = await getOverlayItems(supabase, sceneId);
  const liveIds = new Set((dbItems ?? []).map((row) => row.id));

  // Undo can bring back an item a previous save already deleted: it still
  // carries its old DB id, but no row answers to it any more. Updating that id
  // would match zero rows and drop the item without an error, so anything the
  // table no longer holds is re-inserted and reported back through idMap.
  const isLive = (i: (typeof items)[number]) =>
    isPersistedOverlayItemId(i.id) && liveIds.has(i.id!);
  const existingItems = items.filter(isLive);
  const newItems = items.filter((i) => !isLive(i));
  const keepIds = existingItems.map((i) => i.id!);

  const idsToDelete = [...liveIds].filter((id) => !keepIds.includes(id));

  if (idsToDelete.length > 0) {
    const { error: delErr } = await deleteOverlayItemsByIds(supabase, idsToDelete);
    if (delErr) {
      reportError(delErr, OVERLAYS_ERROR_SCOPE);
      return { success: false, error: delErr.message, data: null, idMap: {} };
    }
  }

  for (const item of existingItems) {
    const parsed = overlayItemSchema.safeParse({
      ...item,
      id: item.id,
      config: resolveClipFieldParentRefs(item.config, idMap),
    });
    if (!parsed.success) {
      return { success: false, error: parsed.error.message, data: null, idMap: {} };
    }
    const { error } = await updateOverlayItemData(supabase, item.id!, overlayItemColumns(parsed.data));
    if (error) {
      reportError(error, OVERLAYS_ERROR_SCOPE);
      return { success: false, error: error.message, data: null, idMap: {} };
    }
  }

  type ItemInsert = Database["public"]["Tables"]["overlay_items"]["Insert"];

  /** Validates each item and maps it to an insert row, or returns the first error. */
  function buildInsertPayloads(
    batch: Array<OverlayItemInput & { temp_id: string }>,
    config: (item: OverlayItemInput) => OverlayItemConfig,
  ): { rows: ItemInsert[]; error?: string } {
    const rows: ItemInsert[] = [];
    for (const item of batch) {
      const parsed = overlayItemSchema.safeParse({ ...item, id: undefined, config: config(item) });
      if (!parsed.success) return { rows: [], error: parsed.error.message };
      rows.push({ scene_id: sceneId, ...overlayItemColumns(parsed.data) });
    }
    return { rows };
  }

  const newRoots = newItems.filter((i) => i.type !== "clip_display_field");
  const newChildren = newItems.filter((i) => i.type === "clip_display_field");

  if (newRoots.length > 0) {
    const { rows, error: buildErr } = buildInsertPayloads(newRoots, (item) => item.config);
    if (buildErr) return { success: false, error: buildErr, data: null, idMap: {} };

    const { data: insertedRoots, error: insErr } = await insertOverlayItemsReturningIds(supabase, rows);

    if (insErr) {
      reportError(insErr, OVERLAYS_ERROR_SCOPE);
      return { success: false, error: insErr.message, data: null, idMap: {} };
    }
    if (!insertedRoots || insertedRoots.length !== newRoots.length) {
      return { success: false, error: "Failed to assign new item ids", data: null, idMap: {} };
    }

    newRoots.forEach((item, idx) => {
      const row = insertedRoots[idx];
      if (row?.id) idMap.set(item.temp_id, row.id);
    });
  }

  if (newChildren.length > 0) {
    const { rows, error: buildErr } = buildInsertPayloads(newChildren, (item) =>
      resolveClipFieldParentRefs(item.config, idMap),
    );
    if (buildErr) return { success: false, error: buildErr, data: null, idMap: {} };

    const { data: insertedChildren, error: chErr } = await insertOverlayItemsReturningIds(
      supabase,
      rows,
    );
    if (chErr) {
      reportError(chErr, OVERLAYS_ERROR_SCOPE);
      return { success: false, error: chErr.message, data: null, idMap: {} };
    }

    newChildren.forEach((item, idx) => {
      const row = insertedChildren?.[idx];
      if (row?.id) idMap.set(item.temp_id, row.id);
    });
  }

  revalidatePath("/dashboard/overlays");

  const reloaded = await getOverlayScene(sceneId);
  // getOverlayScene already reports its own DB errors; this reload is
  // best-effort, so the save still returns success without the fresh data.
  if (reloaded.error || !reloaded.data) {
    return { success: true, error: null, data: null, idMap: Object.fromEntries(idMap) };
  }
  return { success: true, error: null, data: reloaded.data, idMap: Object.fromEntries(idMap) };
}
