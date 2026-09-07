"use server";

import { revalidatePath } from "next/cache";
import { reportError } from "@repo/sentry";
import {
  createOverlayScene as createSceneRow,
  deleteOverlayScene as deleteSceneRow,
  insertOverlayItems,
  insertOverlayItemsReturningIds,
} from "@repo/supabase/queries/overlays";
import { overlayItemSchema } from "@/schemas/overlay";
import {
  OVERLAY_EXPORT_KIND,
  OVERLAY_EXPORT_SCHEMA_VERSION,
  overlayExportDocumentSchema,
  type ExportedOverlayItem,
  type OverlayExportDocument,
} from "@/schemas/overlay-export";
import type {
  ClipDisplayFieldItemConfig,
  CustomWidgetItemConfig,
} from "@/types/overlays";
import { createWidget, deleteWidget, getWidgetsByIds } from "@/actions/widgets";
import type { WidgetFieldSchema } from "@repo/ui/overlay";
import { tryAuthContext } from "@/lib/auth";
import { getOverlayScene } from "./scenes";
import { OVERLAYS_ERROR_SCOPE, generateSlug, overlayItemColumns } from "./shared";

/** Stands in while items are validated, before a real scene row exists. */
const UNASSIGNED_ID = "00000000-0000-0000-0000-000000000000";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Writes a scene out as a portable document.
 *
 * Everything account-specific is dropped or rewritten: no id, user_id, slug,
 * subscriber_token or timestamps, item ids become `ref`s, and a custom widget's
 * source travels with it so the item still works in another account.
 */
export async function exportOverlayScene(sceneId: string): Promise<{
  data: OverlayExportDocument | null;
  error: string | null;
}> {
  const { data: scene, error } = await getOverlayScene(sceneId);
  if (error || !scene) return { data: null, error: error ?? "Not found" };

  const refById = new Map<string, string>();
  scene.items.forEach((item, index) => refById.set(item.id, `item-${index}`));

  const widgetIds = scene.items
    .filter((item) => item.type === "custom_widget")
    .map((item) => (item.config as CustomWidgetItemConfig).widget_id)
    .filter((id): id is string => !!id);

  const { data: widgetRows, error: widgetError } = await getWidgetsByIds(widgetIds);
  if (widgetError) return { data: null, error: widgetError };

  const refByWidgetId = new Map<string, string>();
  const widgets = (widgetRows ?? []).map((widget, index) => {
    const ref = `widget-${index}`;
    refByWidgetId.set(widget.id, ref);
    return {
      ref,
      name: widget.name,
      description: widget.description,
      html: widget.html,
      js: widget.js,
      extra_css: widget.extra_css,
      fields: widget.fields as Record<string, unknown>,
    };
  });

  const items: ExportedOverlayItem[] = scene.items.map((item) => {
    let config = item.config as unknown as Record<string, unknown>;

    // Cross-references travel as refs; the ids they hold mean nothing to the
    // importing account.
    if (item.type === "clip_display_field") {
      const clipField = config as unknown as ClipDisplayFieldItemConfig;
      config = {
        ...config,
        parentClipItemId: refById.get(clipField.parentClipItemId) ?? "",
      };
    }
    if (item.type === "custom_widget") {
      const custom = config as unknown as CustomWidgetItemConfig;
      config = {
        ...config,
        widget_id: refByWidgetId.get(custom.widget_id) ?? "",
        // The instance row belongs to the exporting account's item.
        instance_id: "",
      };
    }

    return {
      ref: refById.get(item.id)!,
      type: item.type,
      x: item.x,
      y: item.y,
      anchor_x: item.anchor_x,
      anchor_y: item.anchor_y,
      w: item.w,
      h: item.h,
      design_w: item.design_w,
      design_h: item.design_h,
      crop_top: item.crop_top,
      crop_right: item.crop_right,
      crop_bottom: item.crop_bottom,
      crop_left: item.crop_left,
      z_index: item.z_index,
      rotation: item.rotation,
      flip_h: item.flip_h,
      flip_v: item.flip_v,
      opacity: item.opacity,
      is_visible: item.is_visible,
      is_locked: item.is_locked,
      label: item.label,
      config,
    };
  });

  return {
    data: {
      kind: OVERLAY_EXPORT_KIND,
      schemaVersion: OVERLAY_EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      scene: {
        name: scene.name,
        width: scene.width,
        height: scene.height,
        render_mode: scene.render_mode === "gps" ? "gps" : "obs",
      },
      items,
      widgets,
    },
    error: null,
  };
}

/**
 * Rewrites an exported item's config for the importing account.
 *
 * Clip filters name the exporter's own folders, games and creators, so they are
 * cleared rather than carried in as ids that match nothing — the layout work
 * survives and the new owner picks their own sources.
 */
function localizeConfig(
  item: ExportedOverlayItem,
  widgetIdByRef: Map<string, string>
): Record<string, unknown> {
  if (item.type === "clips_widget") {
    return { ...item.config, folderIds: [], gameIds: [], creatorIds: [] };
  }
  if (item.type === "custom_widget") {
    const custom = item.config as unknown as CustomWidgetItemConfig;
    return {
      ...item.config,
      widget_id: widgetIdByRef.get(custom.widget_id) ?? "",
      instance_id: "",
    };
  }
  return { ...item.config };
}

/**
 * Builds a scene from an exported document.
 *
 * The whole file is validated before a single row is written, so a truncated or
 * hand-edited file fails without leaving half a scene behind. Rows created
 * after that point are cleaned up if a later step fails.
 */
export async function importOverlayScene(rawJson: string): Promise<{
  data: { id: string; name: string } | null;
  error: string | null;
  /** Plain-language notes about what changed on the way in. */
  notes: string[];
}> {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawJson);
  } catch {
    return { data: null, error: "That file isn't valid JSON.", notes: [] };
  }

  if (isRecord(parsedJson)) {
    if (parsedJson.kind !== OVERLAY_EXPORT_KIND) {
      return { data: null, error: "That's not a StreamWizard overlay file.", notes: [] };
    }
    if (
      typeof parsedJson.schemaVersion === "number" &&
      parsedJson.schemaVersion > OVERLAY_EXPORT_SCHEMA_VERSION
    ) {
      return {
        data: null,
        error: "This file came from a newer version of StreamWizard. Update and try again.",
        notes: [],
      };
    }
  }

  const doc = overlayExportDocumentSchema.safeParse(parsedJson);
  if (!doc.success) {
    return {
      data: null,
      error: "This overlay file is damaged or incomplete, so nothing was imported.",
      notes: [],
    };
  }

  const { scene: sceneMeta, items, widgets } = doc.data;

  if (new Set(items.map((item) => item.ref)).size !== items.length) {
    return { data: null, error: "This overlay file lists the same item twice.", notes: [] };
  }

  // Every item is checked against the real item schema before anything is
  // written, using placeholder ids for the rows that don't exist yet.
  const placeholderIds = new Map(widgets.map((widget) => [widget.ref, UNASSIGNED_ID]));
  for (const item of items) {
    const check = overlayItemSchema.safeParse({
      ...item,
      id: undefined,
      scene_id: UNASSIGNED_ID,
      config: localizeConfig(item, placeholderIds),
    });
    if (!check.success) {
      return {
        data: null,
        error: `"${item.label || item.type}" in this file isn't a valid widget, so nothing was imported.`,
        notes: [],
      };
    }
  }

  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized", notes: [] };
  const { supabase, user } = ctx;

  const notes: string[] = [];
  const createdWidgetIds: string[] = [];

  /** Best-effort unwind so a failure halfway leaves nothing behind. */
  async function rollback(sceneId?: string) {
    if (sceneId) await deleteSceneRow(supabase, sceneId, user.id);
    for (const id of createdWidgetIds) await deleteWidget(id);
  }

  // Private copies of the embedded widgets first: the items point at their ids.
  const widgetIdByRef = new Map<string, string>();
  for (const widget of widgets) {
    const { data, error } = await createWidget({
      name: widget.name,
      description: widget.description,
      html: widget.html,
      js: widget.js,
      extra_css: widget.extra_css,
      fields: widget.fields as WidgetFieldSchema,
    });
    if (error || !data) {
      await rollback();
      return { data: null, error: error ?? "Couldn't copy the custom widgets.", notes: [] };
    }
    widgetIdByRef.set(widget.ref, data.id);
    createdWidgetIds.push(data.id);
  }
  if (widgets.length > 0) {
    notes.push(
      widgets.length === 1
        ? "Its custom widget was copied into your widget library."
        : `Its ${widgets.length} custom widgets were copied into your widget library.`
    );
  }

  const { data: newScene, error: sceneError } = await createSceneRow(supabase, {
    user_id: user.id,
    name: sceneMeta.name,
    slug: generateSlug(sceneMeta.name),
    width: sceneMeta.width,
    height: sceneMeta.height,
    render_mode: sceneMeta.render_mode,
    is_active: true,
  });

  if (sceneError || !newScene) {
    if (sceneError) reportError(sceneError, OVERLAYS_ERROR_SCOPE);
    await rollback();
    return { data: null, error: sceneError?.message ?? "Couldn't create the overlay.", notes: [] };
  }

  function rowFor(item: ExportedOverlayItem, config: Record<string, unknown>) {
    const parsed = overlayItemSchema.safeParse({
      ...item,
      id: undefined,
      scene_id: newScene!.id,
      config,
    });
    // Already validated above; a failure here would be a bug, not bad input.
    if (!parsed.success) return null;
    return { scene_id: newScene!.id, ...overlayItemColumns(parsed.data) };
  }

  // Roots before children, so a display field can point at a real parent id.
  const roots = items.filter((item) => item.type !== "clip_display_field");
  const children = items.filter((item) => item.type === "clip_display_field");

  const idByRef = new Map<string, string>();

  if (roots.length > 0) {
    const rows = roots
      .map((item) => rowFor(item, localizeConfig(item, widgetIdByRef)))
      .filter((row): row is NonNullable<typeof row> => row !== null);
    if (rows.length !== roots.length) {
      await rollback(newScene.id);
      return { data: null, error: "Couldn't rebuild this overlay's widgets.", notes: [] };
    }

    const { data: inserted, error: insertError } = await insertOverlayItemsReturningIds(
      supabase,
      rows
    );
    if (insertError || !inserted || inserted.length !== roots.length) {
      if (insertError) reportError(insertError, OVERLAYS_ERROR_SCOPE);
      await rollback(newScene.id);
      return {
        data: null,
        error: insertError?.message ?? "Couldn't add this overlay's widgets.",
        notes: [],
      };
    }
    roots.forEach((item, index) => idByRef.set(item.ref, inserted[index]!.id));
  }

  if (children.length > 0) {
    const childRows = children
      .map((item) => {
        const clipField = item.config as unknown as ClipDisplayFieldItemConfig;
        const parentId = idByRef.get(clipField.parentClipItemId);
        // A child whose parent didn't come with the file has nothing to attach
        // to; dropping it beats writing a row that renders nowhere.
        if (!parentId) return null;
        return rowFor(item, {
          ...localizeConfig(item, widgetIdByRef),
          parentClipItemId: parentId,
        });
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (childRows.length > 0) {
      const { error: childError } = await insertOverlayItems(supabase, childRows);
      if (childError) {
        reportError(childError, OVERLAYS_ERROR_SCOPE);
        await rollback(newScene.id);
        return { data: null, error: childError.message, notes: [] };
      }
    }
    if (childRows.length !== children.length) {
      notes.push("Some clip fields were left out — their widget wasn't in the file.");
    }
  }

  if (items.some((item) => item.type === "clips_widget")) {
    notes.push("Clip filters were cleared. Pick your own folders in the editor.");
  }

  revalidatePath("/dashboard/overlays");
  return { data: { id: newScene.id, name: newScene.name }, error: null, notes };
}
