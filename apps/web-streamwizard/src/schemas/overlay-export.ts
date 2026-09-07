import { z } from "zod";
import {
  ANCHOR_X_VALUES,
  ANCHOR_Y_VALUES,
  DEFAULT_ANCHOR_X,
  DEFAULT_ANCHOR_Y,
} from "@repo/ui/overlay";

/**
 * The shape of an exported overlay file.
 *
 * Deliberately not the database shape. Ids, the owner, the slug and above all
 * the subscriber token never travel — the token is the key an open overlay page
 * uses to read and write its own state, and these files are made to be shared.
 * Items refer to each other by `ref` instead, and the importer assigns real ids.
 *
 * `schemaVersion` is checked on import and is the hook for migrating older
 * files later. Bump it whenever a change would make an old file import wrong.
 */
export const OVERLAY_EXPORT_KIND = "streamwizard.overlay-scene";
export const OVERLAY_EXPORT_SCHEMA_VERSION = 1;

/** Guards against a hand-made file asking the importer to build something huge. */
const MAX_EXPORTED_ITEMS = 500;
const MAX_EXPORTED_WIDGETS = 50;
const MAX_WIDGET_SOURCE_CHARS = 500_000;

/**
 * A custom widget's source, carried along so the item still works in an account
 * that has never seen it. Import makes a private copy rather than linking.
 */
export const exportedWidgetSchema = z.object({
  ref: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  html: z.string().max(MAX_WIDGET_SOURCE_CHARS).default(""),
  js: z.string().max(MAX_WIDGET_SOURCE_CHARS).default(""),
  extra_css: z.string().max(MAX_WIDGET_SOURCE_CHARS).default(""),
  fields: z.record(z.string(), z.unknown()).default({}),
});

/**
 * Geometry is only loosely checked here. The real per-type validation is
 * `overlayItemSchema`, which the importer runs on every item once it has a
 * scene id to attach them to — one source of truth for what a valid item is.
 */
export const exportedItemSchema = z.object({
  ref: z.string().min(1).max(100),
  type: z.string().min(1).max(50),
  x: z.number(),
  y: z.number(),
  // Files from before anchors existed carry none; top-left is what they meant.
  anchor_x: z.enum(ANCHOR_X_VALUES).default(DEFAULT_ANCHOR_X),
  anchor_y: z.enum(ANCHOR_Y_VALUES).default(DEFAULT_ANCHOR_Y),
  w: z.number(),
  h: z.number(),
  design_w: z.number(),
  design_h: z.number(),
  crop_top: z.number(),
  crop_right: z.number(),
  crop_bottom: z.number(),
  crop_left: z.number(),
  z_index: z.number(),
  rotation: z.number(),
  // Files from before flipping existed carry neither; unflipped is what they meant.
  flip_h: z.boolean().default(false),
  flip_v: z.boolean().default(false),
  opacity: z.number(),
  is_visible: z.boolean(),
  is_locked: z.boolean(),
  label: z.string(),
  config: z.record(z.string(), z.unknown()),
});

export const overlayExportDocumentSchema = z.object({
  kind: z.literal(OVERLAY_EXPORT_KIND),
  schemaVersion: z.literal(OVERLAY_EXPORT_SCHEMA_VERSION),
  exportedAt: z.string(),
  scene: z.object({
    name: z.string().min(1).max(100),
    width: z.number().int().min(1).max(20000),
    height: z.number().int().min(1).max(20000),
    render_mode: z.enum(["obs", "gps"]).default("obs"),
  }),
  items: z.array(exportedItemSchema).max(MAX_EXPORTED_ITEMS),
  widgets: z.array(exportedWidgetSchema).max(MAX_EXPORTED_WIDGETS).default([]),
});

export type OverlayExportDocument = z.infer<typeof overlayExportDocumentSchema>;
export type ExportedOverlayItem = z.infer<typeof exportedItemSchema>;
export type ExportedWidget = z.infer<typeof exportedWidgetSchema>;
