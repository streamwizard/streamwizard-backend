import { z } from "zod";
import {
  DEFAULT_GOOGLE_FONT_FAMILY,
  isValidGoogleFontFamilyName,
  CLIP_SORT_OPTIONS,
  CLIP_SOURCE_MODES,
  DISPLAY_FIELD_KEYS,
  TIME_WINDOW_PRESETS,
  type DisplayFieldKey,
} from "./components/overlay/types";
import {
  ALERT_EVENT_TYPES,
  type AlertEventType,
} from "./components/overlay/widgets/alert/alert-widget-config";
import {
  ANCHOR_X_VALUES,
  ANCHOR_Y_VALUES,
  DEFAULT_ANCHOR_X,
  DEFAULT_ANCHOR_Y,
} from "./components/overlay/lib/item-anchor";

const displayFieldLayoutSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  w: z.number().min(1).max(100),
  h: z.number().min(1).max(100),
  fontSize: z.number().min(8).max(80),
});

/** Persisted JSON on `clips_widget` rows (no per-field embed). */
export const clipsWidgetItemConfigSchema = z.object({
  sourceMode: z.enum(CLIP_SOURCE_MODES),
  folderIds: z.array(z.string()),
  gameIds: z.array(z.string()),
  creatorIds: z.array(z.string()),
  timeWindow: z.union([z.enum(TIME_WINDOW_PRESETS), z.literal("custom")]),
  customDateRange: z
    .object({ start: z.string(), end: z.string() })
    .optional(),
  sort: z.enum(CLIP_SORT_OPTIONS),
  minViewCount: z.number().int().min(0),
  isFeaturedOnly: z.boolean(),
  clipMuted: z.boolean().default(false),
  clipVolume: z.number().min(0).max(1).default(1),
  clipTransition: z.enum(["cut", "crossfade"]).default("cut"),
  clipTransitionMs: z.number().int().min(200).max(3000).default(600),
});

/** Full composite for validation when reading API responses / preview (merged shape). */
export const clipsWidgetCompositeConfigSchema = clipsWidgetItemConfigSchema.extend({
  displayFields: z.object(
    Object.fromEntries(
      DISPLAY_FIELD_KEYS.map((field) => [field, z.boolean()])
    ) as Record<DisplayFieldKey, z.ZodBoolean>
  ),
  displayFieldLayouts: z.object(
    Object.fromEntries(
      DISPLAY_FIELD_KEYS.map((field) => [field, displayFieldLayoutSchema])
    ) as Record<DisplayFieldKey, typeof displayFieldLayoutSchema>
  ),
  displayFieldLocks: z.object(
    Object.fromEntries(
      DISPLAY_FIELD_KEYS.map((field) => [field, z.boolean()])
    ) as Record<DisplayFieldKey, z.ZodBoolean>
  ),
  displayFieldOrder: z
    .array(
      z.enum(
        DISPLAY_FIELD_KEYS as unknown as [DisplayFieldKey, ...DisplayFieldKey[]]
      )
    )
    .length(DISPLAY_FIELD_KEYS.length)
    .refine((arr) => new Set(arr).size === DISPLAY_FIELD_KEYS.length, {
      message: "displayFieldOrder must be a permutation",
    }),
});

export const clipDisplayFieldItemConfigSchema = z.object({
  parentClipItemId: z.string().min(1),
  fieldKey: z.enum(
    DISPLAY_FIELD_KEYS as unknown as [DisplayFieldKey, ...DisplayFieldKey[]]
  ),
  stackOrder: z.number().int().min(0).max(99),
  layout: displayFieldLayoutSchema,
  isLayoutLocked: z.boolean(),
});

const hexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Expected #rgb or #rrggbb");

const googleFontFamilySchema = z
  .string()
  .min(1)
  .max(200)
  .refine((s) => isValidGoogleFontFamilyName(s), {
    message: "Invalid font family",
  });

const overlayTextStyleSchema = z.object({
  fontSize: z.number().min(8).max(200),
  color: hexColorSchema,
  align: z.enum(["left", "center", "right"]),
  fontWeight: z.union([
    z.literal(400),
    z.literal(500),
    z.literal(600),
    z.literal(700),
  ]),
  fontFamily: z.preprocess(
    (val) =>
      typeof val === "string" && isValidGoogleFontFamilyName(val)
        ? val.trim()
        : DEFAULT_GOOGLE_FONT_FAMILY,
    googleFontFamilySchema
  ),
});

/** Persisted JSON on `text_widget` rows. */
export const textWidgetItemConfigSchema = overlayTextStyleSchema.extend({
  text: z.string().min(0).max(5000),
});

const timerWidgetItemConfigSchemaInner = overlayTextStyleSchema.extend({
  finishedText: z.string().min(0).max(200),
  countdownMode: z.enum(["duration", "absolute"]),
  durationSeconds: z.number().int().min(10).max(604800),
  targetAtIso: z.string().min(1),
}).superRefine((data, ctx) => {
  if (data.countdownMode === "absolute" && Number.isNaN(Date.parse(data.targetAtIso))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid date/time",
      path: ["targetAtIso"],
    });
  }
});

/** Persisted JSON on `timer_widget` rows. */
export const timerWidgetItemConfigSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object") return raw;
  const o = { ...(raw as Record<string, unknown>) };
  if (o.countdownMode !== "duration" && o.countdownMode !== "absolute") {
    if (
      typeof o.targetAtIso === "string" &&
      o.targetAtIso.length > 0 &&
      !Number.isNaN(Date.parse(o.targetAtIso))
    ) {
      o.countdownMode = "absolute";
    } else {
      o.countdownMode = "duration";
    }
  }
  if (
    typeof o.durationSeconds !== "number" ||
    !Number.isFinite(o.durationSeconds)
  ) {
    o.durationSeconds = 300;
  }
  if (typeof o.targetAtIso !== "string" || o.targetAtIso.length === 0) {
    o.targetAtIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  }
  return o;
}, timerWidgetItemConfigSchemaInner);

/** Persisted JSON on `clock_widget` rows. */
export const clockWidgetItemConfigSchema = overlayTextStyleSchema.extend({
  timeZone: z.string().max(100).default(""),
  showDate: z.boolean().default(true),
  showTime: z.boolean().default(true),
  dateStyle: z.enum(["short", "medium", "long"]).default("medium"),
  timeStyle: z.enum(["short", "medium", "long"]).default("short"),
  hour12: z.boolean().default(false),
  showSeconds: z.boolean().default(true),
  layout: z.enum(["inline", "stacked"]).default("inline"),
});

export const irlFieldWidgetConfigSchema = overlayTextStyleSchema.extend({
  unit: z.enum(["kmh", "mph"]).default("kmh"),
  mockData: z.boolean().default(false),
});

export const customWidgetItemConfigSchema = z.object({
  widget_id: z.string().default(""),
  instance_id: z.string().default(""),
  // Author-defined settings, so the shape is only known to the widget itself.
  // Values are rendered as text or fed to the widget's own script -- never
  // executed here -- and the schema that produced them lives on the widget row.
  field_values: z.record(z.string(), z.unknown()).default({}),
});

const alertMediaKindSchema = z.enum(["", "image", "video"]).default("");

const alertVariantConfigSchema = z.object({
  enabled: z.boolean().default(true),
  mediaUrl: z.string().max(2000).default(""),
  mediaKind: alertMediaKindSchema,
  soundUrl: z.string().max(2000).default(""),
  volume: z.number().min(0).max(1).default(0.8),
  titleTemplate: z.string().max(200).default(""),
  messageTemplate: z.string().max(200).default(""),
  durationSeconds: z.number().min(0).max(60).default(6),
  durationMode: z.enum(["fixed", "media"]).default("fixed"),
  minAmount: z.number().int().min(0).max(1_000_000).default(0),
  layout: z.enum(["stacked", "row", "overlay"]).default("stacked"),
  animationIn: z
    .enum(["fade", "slide_up", "slide_down", "zoom", "bounce"])
    .default("zoom"),
  animationOut: z.enum(["fade", "slide_down", "zoom"]).default("fade"),
  fontFamily: z.preprocess(
    (val) =>
      typeof val === "string" && isValidGoogleFontFamilyName(val)
        ? val.trim()
        : DEFAULT_GOOGLE_FONT_FAMILY,
    googleFontFamilySchema
  ),
  fontSize: z.number().min(8).max(200).default(32),
  fontWeight: z
    .union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)])
    .default(700),
  align: z.enum(["left", "center", "right"]).default("center"),
  titleColor: hexColorSchema.default("#ffffff"),
  messageColor: hexColorSchema.default("#d4d4d8"),
  accentColor: hexColorSchema.default("#9e7aff"),
  textShadow: z.boolean().default(true),
});

/**
 * Persisted JSON on `alert_widget` rows.
 *
 * Built from ALERT_EVENT_TYPES rather than a hand-written list: a z.object
 * strips keys it does not declare, so every event missing here would be
 * silently dropped on save and come back on its default at the next load.
 * Each variant is optional so rows written before an event existed still
 * validate -- normalizeAlertWidgetConfig fills the gaps on read.
 */
export const alertWidgetItemConfigSchema = z.object({
  gapSeconds: z.number().min(0).max(30).default(1),
  masterVolume: z.number().min(0).max(1).default(0.8),
  variants: z.object(
    Object.fromEntries(
      ALERT_EVENT_TYPES.map((event) => [event, alertVariantConfigSchema.optional()])
    ) as Record<AlertEventType, z.ZodOptional<typeof alertVariantConfigSchema>>
  ),
});

export const overlayItemConfigSchema = z.union([
  clipsWidgetItemConfigSchema,
  clipDisplayFieldItemConfigSchema,
  textWidgetItemConfigSchema,
  timerWidgetItemConfigSchema,
  clockWidgetItemConfigSchema,
  irlFieldWidgetConfigSchema,
  customWidgetItemConfigSchema,
  alertWidgetItemConfigSchema,
]);

/**
 * The geometry every item variant shares. `x`/`y` are offsets from the item's
 * anchor, so they may go negative for a centre anchor (left of / above the
 * centre); the editor keeps the resolved rect inside the scene.
 */
const overlayItemBoxFields = {
  x: z.number(),
  y: z.number(),
  anchor_x: z.enum(ANCHOR_X_VALUES).default(DEFAULT_ANCHOR_X),
  anchor_y: z.enum(ANCHOR_Y_VALUES).default(DEFAULT_ANCHOR_Y),
  w: z.number().min(50),
  h: z.number().min(50),
  design_w: z.number().min(1).max(20000),
  design_h: z.number().min(1).max(20000),
  crop_top: z.number().min(0).max(20000),
  crop_right: z.number().min(0).max(20000),
  crop_bottom: z.number().min(0).max(20000),
  crop_left: z.number().min(0).max(20000),
  // Payloads from before flipping existed carry neither; unflipped is what they meant.
  flip_h: z.boolean().default(false),
  flip_v: z.boolean().default(false),
};

export const overlayItemSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().uuid().optional(),
    scene_id: z.string().uuid(),
    type: z.literal("clips_widget"),
    ...overlayItemBoxFields,
    z_index: z.number().int(),
    rotation: z.number().min(-360).max(360),
    opacity: z.number().min(0).max(1),
    is_visible: z.boolean(),
    is_locked: z.boolean(),
    label: z.string().min(1).max(100),
    config: clipsWidgetItemConfigSchema,
  }),
  z.object({
    id: z.string().uuid().optional(),
    scene_id: z.string().uuid(),
    type: z.literal("clip_display_field"),
    ...overlayItemBoxFields,
    z_index: z.number().int(),
    rotation: z.number().min(-360).max(360),
    opacity: z.number().min(0).max(1),
    is_visible: z.boolean(),
    is_locked: z.boolean(),
    label: z.string().min(1).max(100),
    config: clipDisplayFieldItemConfigSchema,
  }),
  z.object({
    id: z.string().uuid().optional(),
    scene_id: z.string().uuid(),
    type: z.literal("text_widget"),
    ...overlayItemBoxFields,
    z_index: z.number().int(),
    rotation: z.number().min(-360).max(360),
    opacity: z.number().min(0).max(1),
    is_visible: z.boolean(),
    is_locked: z.boolean(),
    label: z.string().min(1).max(100),
    config: textWidgetItemConfigSchema,
  }),
  z.object({
    id: z.string().uuid().optional(),
    scene_id: z.string().uuid(),
    type: z.literal("timer_widget"),
    ...overlayItemBoxFields,
    z_index: z.number().int(),
    rotation: z.number().min(-360).max(360),
    opacity: z.number().min(0).max(1),
    is_visible: z.boolean(),
    is_locked: z.boolean(),
    label: z.string().min(1).max(100),
    config: timerWidgetItemConfigSchema,
  }),
  z.object({
    id: z.string().uuid().optional(),
    scene_id: z.string().uuid(),
    type: z.literal("clock_widget"),
    ...overlayItemBoxFields,
    z_index: z.number().int(),
    rotation: z.number().min(-360).max(360),
    opacity: z.number().min(0).max(1),
    is_visible: z.boolean(),
    is_locked: z.boolean(),
    label: z.string().min(1).max(100),
    config: clockWidgetItemConfigSchema,
  }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("irl_speed_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: irlFieldWidgetConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("irl_heading_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: irlFieldWidgetConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("irl_altitude_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: irlFieldWidgetConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("irl_latitude_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: irlFieldWidgetConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("irl_longitude_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: irlFieldWidgetConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("irl_accuracy_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: irlFieldWidgetConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("custom_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: customWidgetItemConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("alert_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: alertWidgetItemConfigSchema }),
]);

export const createSceneSchema = z.object({
  name: z.string().min(1).max(100),
  width: z.number().int().min(100).max(7680).default(1920),
  height: z.number().int().min(100).max(4320).default(1080),
});

export const updateSceneSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  width: z.number().int().min(100).max(7680).optional(),
  height: z.number().int().min(100).max(4320).optional(),
  is_active: z.boolean().optional(),
  is_favourite: z.boolean().optional(),
});

/** Alias / API validation for merged clip widget config. */
export const clipsWidgetConfigSchema = clipsWidgetCompositeConfigSchema;
