"use server";

import {
  getActiveOverlaySceneBySlugMaybe,
  getAllOverlayItemsByScene,
  getOverlaySceneByIdForEmbed,
} from "@repo/supabase/queries/overlays";
import type { Json } from "@repo/supabase";
import type { OverlayItemRow, OverlaySceneRow } from "@/types/overlays";
import {
  isOverlaySceneUuid,
  safeDecodeOverlaySegment,
} from "@/lib/overlay-route-params";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { reportError } from "@repo/sentry";
import {
  DISPLAY_FIELD_KEYS,
  type DisplayFieldKey,
} from "@repo/ui/overlay";

type LoadOverlayErrorCode =
  | "MISSING_LOOKUP"
  | "SCENE_NOT_FOUND"
  | "DATABASE_ERROR";

type LoadOverlayResult =
  | { ok: true; scene: OverlaySceneRow; items: OverlayItemRow[] }
  | { ok: false; code: LoadOverlayErrorCode; message: string };

function asRecord(j: Json): Record<string, unknown> {
  return typeof j === "object" && j !== null && !Array.isArray(j)
    ? (j as Record<string, unknown>)
    : {};
}

function mergeDisplayChildrenIntoClipsWidgets(
  items: OverlayItemRow[],
): OverlayItemRow[] {
  const clipsParents = new Map<string, OverlayItemRow>();
  for (const it of items) {
    if (it.type === "clips_widget") {
      clipsParents.set(it.id, it);
    }
  }

  const childrenByParent = new Map<
    string,
    Array<{ item: OverlayItemRow; cfg: Record<string, unknown> }>
  >();

  for (const item of items) {
    if (item.type !== "clip_display_field" || item.is_visible === false)
      continue;
    const cfg = asRecord(item.config);
    const parentId =
      typeof cfg.parentClipItemId === "string" ? cfg.parentClipItemId : null;
    if (!parentId || !clipsParents.has(parentId)) continue;
    const list = childrenByParent.get(parentId) ?? [];
    list.push({ item, cfg });
    childrenByParent.set(parentId, list);
  }

  const passthroughTypes = new Set([
    "clip_display_field", // merged away
  ]);

  const result: OverlayItemRow[] = [];

  for (const item of items) {
    if (passthroughTypes.has(item.type)) continue;

    if (item.type !== "clips_widget") {
      result.push(item);
      continue;
    }

    const base = asRecord(item.config);
    const children = childrenByParent.get(item.id) ?? [];

    children.sort((a, b) => {
      const ao = typeof a.cfg.stackOrder === "number" ? a.cfg.stackOrder : 0;
      const bo = typeof b.cfg.stackOrder === "number" ? b.cfg.stackOrder : 0;
      return ao - bo;
    });

    const displayFields: Partial<Record<DisplayFieldKey, boolean>> = {};
    const displayFieldLayouts: Partial<
      Record<
        DisplayFieldKey,
        { x: number; y: number; w: number; h: number; fontSize: number }
      >
    > = {};
    const displayFieldLocks: Partial<Record<DisplayFieldKey, boolean>> = {};

    const existingFields = asRecord(base.displayFields as Json);
    const existingLayouts = asRecord(base.displayFieldLayouts as Json);
    const existingLocks = asRecord(base.displayFieldLocks as Json);

    for (const key of DISPLAY_FIELD_KEYS) {
      const v = existingFields[key];
      displayFields[key] = typeof v === "boolean" ? v : false;
    }

    for (const key of DISPLAY_FIELD_KEYS) {
      const ly = existingLayouts[key];
      if (ly && typeof ly === "object" && !Array.isArray(ly)) {
        const o = ly as Record<string, unknown>;
        displayFieldLayouts[key] = {
          x: typeof o.x === "number" ? o.x : 0,
          y: typeof o.y === "number" ? o.y : 0,
          w: typeof o.w === "number" ? o.w : 100,
          h: typeof o.h === "number" ? o.h : 100,
          fontSize: typeof o.fontSize === "number" ? o.fontSize : 14,
        };
      }
    }

    for (const key of DISPLAY_FIELD_KEYS) {
      const lk = existingLocks[key];
      displayFieldLocks[key] = lk === true;
    }

    const orderFromChildren: DisplayFieldKey[] = [];

    for (const { cfg } of children) {
      const fk = cfg.fieldKey;
      if (typeof fk !== "string") continue;
      if (!(DISPLAY_FIELD_KEYS as readonly string[]).includes(fk))
        continue;
      const key = fk as DisplayFieldKey;
      displayFields[key] = true;

      const layoutRaw = cfg.layout;
      if (
        layoutRaw &&
        typeof layoutRaw === "object" &&
        !Array.isArray(layoutRaw)
      ) {
        const ly = layoutRaw as Record<string, unknown>;
        displayFieldLayouts[key] = {
          x: typeof ly.x === "number" ? ly.x : 0,
          y: typeof ly.y === "number" ? ly.y : 0,
          w: typeof ly.w === "number" ? ly.w : 100,
          h: typeof ly.h === "number" ? ly.h : 100,
          fontSize: typeof ly.fontSize === "number" ? ly.fontSize : 14,
        };
      }

      displayFieldLocks[key] = cfg.isLayoutLocked === true;
      orderFromChildren.push(key);
    }

    let displayFieldOrder: DisplayFieldKey[];

    const parentOrderRaw = base.displayFieldOrder;
    if (orderFromChildren.length > 0) {
      const rest = DISPLAY_FIELD_KEYS.filter(
        (k) => !orderFromChildren.includes(k),
      );
      displayFieldOrder = [...orderFromChildren, ...rest];
    } else if (Array.isArray(parentOrderRaw)) {
      displayFieldOrder = [];
      for (const entry of parentOrderRaw) {
        if (
          typeof entry === "string" &&
          (DISPLAY_FIELD_KEYS as readonly string[]).includes(entry)
        ) {
          displayFieldOrder.push(entry as DisplayFieldKey);
        }
      }
      for (const k of DISPLAY_FIELD_KEYS) {
        if (!displayFieldOrder.includes(k)) displayFieldOrder.push(k);
      }
    } else {
      displayFieldOrder = [...DISPLAY_FIELD_KEYS];
    }

    const mergedConfig = {
      ...base,
      displayFields,
      displayFieldLayouts,
      displayFieldLocks,
      displayFieldOrder,
    } as Json;

    result.push({
      ...item,
      config: mergedConfig,
    });
  }

  return result;
}

/**
 * Trusted server fetch (service role). Slug lookups require an active scene;
 * direct scene UUID lookup does not enforce is_active (embed/back-office flexibility).
 */
export async function loadOverlayBySlugOrId(args: {
  slug?: string | null;
  sceneId?: string | null;
}): Promise<LoadOverlayResult> {
  const slug = args.slug?.trim();
  const sceneId = args.sceneId?.trim();

  if (!slug && !sceneId) {
    return {
      ok: false,
      code: "MISSING_LOOKUP",
      message: "Provide a scene slug or scene UUID to load an overlay scene.",
    };
  }

  let scene: OverlaySceneRow | null = null;
  let sceneErr: Error | null = null;

  if (slug) {
    const { data, error } = await getActiveOverlaySceneBySlugMaybe(
      supabaseAdmin,
      slug,
    );
    if (error) sceneErr = new Error(error.message);
    else scene = data;
  } else if (sceneId) {
    const { data, error } = await getOverlaySceneByIdForEmbed(
      supabaseAdmin,
      sceneId,
    );
    if (error) sceneErr = new Error(error.message);
    else scene = data;
  }

  if (sceneErr) {
    // The result object is only rendered as a broken overlay in OBS — without
    // this, a DB failure leaves no trace anywhere.
    reportError(sceneErr, "overlay.loadOverlayBySlugOrId: scene query");
    return {
      ok: false,
      code: "DATABASE_ERROR",
      message: sceneErr.message,
    };
  }

  if (!scene) {
    return {
      ok: false,
      code: "SCENE_NOT_FOUND",
      message: slug
        ? `No active overlay scene found for slug “${slug}”.`
        : "Overlay scene not found for that id.",
    };
  }

  const { data: rawItems, error: itemsError } = await getAllOverlayItemsByScene(
    supabaseAdmin,
    scene.id,
  );

  if (itemsError) {
    reportError(itemsError, "overlay.loadOverlayBySlugOrId: items query");
    return {
      ok: false,
      code: "DATABASE_ERROR",
      message: itemsError.message,
    };
  }

  const visibleFirst = (rawItems ?? []).filter(
    (row) => row.is_visible !== false,
  );
  const items = mergeDisplayChildrenIntoClipsWidgets(visibleFirst);

  return { ok: true, scene, items };
}

/**
 * Path segment from `/overlay/[overlayId]`: UUID loads by primary key (any `is_active`);
 * anything else is treated as an active scene slug.
 */
export async function loadOverlaySceneByOverlayId(
  overlayId: string,
): Promise<LoadOverlayResult> {
  const raw = overlayId.trim();
  if (!raw) {
    return {
      ok: false,
      code: "MISSING_LOOKUP",
      message: "Missing overlay id in the URL.",
    };
  }
  const decoded = safeDecodeOverlaySegment(raw);
  if (isOverlaySceneUuid(decoded)) {
    return loadOverlayBySlugOrId({ sceneId: decoded });
  }
  return loadOverlayBySlugOrId({ slug: decoded });
}
