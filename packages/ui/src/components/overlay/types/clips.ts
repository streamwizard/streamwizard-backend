import type { OverlayItem, OverlayItemConfig } from "./item";
import { getAnchor } from "../lib/item-anchor";

/** The clips widget: its config, its per-field children, and the helpers that
 *  flatten a parent row plus children into one renderable config. */

export const CLIP_SOURCE_MODES = ["all", "folders", "game", "custom"] as const;

export type ClipSourceMode = (typeof CLIP_SOURCE_MODES)[number];

export const CLIP_SORT_OPTIONS = ["newest", "oldest", "most_viewed", "least_viewed", "random"] as const;

export type ClipSortOption = (typeof CLIP_SORT_OPTIONS)[number];

export const CLIP_TRANSITION_MODES = ["cut", "crossfade"] as const;

export type ClipTransitionMode = (typeof CLIP_TRANSITION_MODES)[number];

export const TIME_WINDOW_PRESETS = ["last7d", "last30d", "last90d", "last365d", "all"] as const;

export type TimeWindowPreset = (typeof TIME_WINDOW_PRESETS)[number];

export const DISPLAY_FIELD_KEYS = [
  "title",
  "creator",
  "game",
  "date",
  "viewCount",
  "duration",
] as const;

export type DisplayFieldKey = (typeof DISPLAY_FIELD_KEYS)[number];

export interface ClipDisplayFieldLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
}

/** Persisted on the main clip `overlay_items` row only (clip source + playback; no per-field data). */
export interface ClipsWidgetItemConfig {
  sourceMode: ClipSourceMode;
  folderIds: string[];
  gameIds: string[];
  creatorIds: string[];
  timeWindow: TimeWindowPreset | "custom";
  customDateRange?: { start: string; end: string };
  sort: ClipSortOption;
  minViewCount: number;
  isFeaturedOnly: boolean;
  /** Muted by default so autoplay works in browsers; unmute for audible playback in OBS. */
  clipMuted: boolean;
  /** 0–1, applied when not muted. */
  clipVolume: number;
  /** How the player switches to the next clip (end of video or skip). */
  clipTransition: ClipTransitionMode;
  /** Crossfade length in ms; used when `clipTransition === "crossfade"`. */
  clipTransitionMs: number;
}

/** Saved on `overlay_items` rows with `type === "clip_display_field"`, linked to the parent clip widget. */
export interface ClipDisplayFieldItemConfig {
  parentClipItemId: string;
  fieldKey: DisplayFieldKey;
  /** Lower sorts behind; higher draws on top inside the clip widget. */
  stackOrder: number;
  layout: ClipDisplayFieldLayout;
  isLayoutLocked: boolean;
}

/**
 * Flattened shape used by the clip preview, API, and query builder: parent row + display field children merged.
 */
export type ClipsWidgetConfig = ClipsWidgetItemConfig & {
  displayFields: Record<DisplayFieldKey, boolean>;
  displayFieldLayouts: Record<DisplayFieldKey, ClipDisplayFieldLayout>;
  displayFieldLocks: Record<DisplayFieldKey, boolean>;
  displayFieldOrder: DisplayFieldKey[];
};

export const DEFAULT_CLIPS_WIDGET_ITEM_CONFIG: ClipsWidgetItemConfig = {
  sourceMode: "all",
  folderIds: [],
  gameIds: [],
  creatorIds: [],
  timeWindow: "all",
  sort: "random",
  minViewCount: 0,
  isFeaturedOnly: false,
  clipMuted: false,
  clipVolume: 1,
  clipTransition: "cut",
  clipTransitionMs: 600,
};

/** Default composite (parent + implicit field defaults) for previews and fallbacks. */
export const DEFAULT_CLIPS_WIDGET_CONFIG: ClipsWidgetConfig = {
  ...DEFAULT_CLIPS_WIDGET_ITEM_CONFIG,
  displayFields: {
    title: true,
    creator: true,
    game: true,
    date: true,
    viewCount: false,
    duration: true,
  },
  displayFieldLayouts: {
    title: { x: 3, y: 72, w: 70, h: 10, fontSize: 18 },
    creator: { x: 3, y: 83, w: 35, h: 8, fontSize: 14 },
    game: { x: 40, y: 83, w: 30, h: 8, fontSize: 14 },
    date: { x: 72, y: 83, w: 25, h: 8, fontSize: 14 },
    viewCount: { x: 3, y: 92, w: 28, h: 7, fontSize: 12 },
    duration: { x: 33, y: 92, w: 18, h: 7, fontSize: 12 },
  },
  displayFieldLocks: {
    title: false,
    creator: false,
    game: false,
    date: false,
    viewCount: false,
    duration: false,
  },
  displayFieldOrder: [...DISPLAY_FIELD_KEYS],
};

export function getClipDisplayChildren(
  items: OverlayItem[],
  parentId: string
): OverlayItem[] {
  return items.filter(
    (i) =>
      i.type === "clip_display_field" &&
      asClipDisplayFieldConfig(i.config).parentClipItemId === parentId
  );
}

export function slimClipsWidgetItemConfig(raw: unknown): ClipsWidgetItemConfig {
  const c = raw as Partial<ClipsWidgetItemConfig> & Partial<ClipsWidgetConfig>;
  const transitionRaw = c.clipTransition;
  const clipTransition =
    transitionRaw === "crossfade" || transitionRaw === "cut"
      ? transitionRaw
      : DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.clipTransition;
  const msRaw =
    c.clipTransitionMs ?? DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.clipTransitionMs;
  const clipTransitionMs = Math.min(3000, Math.max(200, Math.round(msRaw)));
  return {
    sourceMode: c.sourceMode ?? DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.sourceMode,
    folderIds: c.folderIds ?? DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.folderIds,
    gameIds: c.gameIds ?? DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.gameIds,
    creatorIds: c.creatorIds ?? DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.creatorIds,
    timeWindow: c.timeWindow ?? DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.timeWindow,
    customDateRange: c.customDateRange,
    sort: c.sort ?? DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.sort,
    minViewCount: c.minViewCount ?? DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.minViewCount,
    isFeaturedOnly:
      c.isFeaturedOnly ?? DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.isFeaturedOnly,
    clipMuted: c.clipMuted ?? DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.clipMuted,
    clipVolume: c.clipVolume ?? DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.clipVolume,
    clipTransition,
    clipTransitionMs,
  };
}

export function createClipDisplayFieldChildItems(
  sceneId: string,
  parentId: string,
  parent: Pick<OverlayItem, "x" | "y" | "w" | "h"> &
    Partial<
      Pick<
        OverlayItem,
        | "design_w"
        | "design_h"
        | "crop_top"
        | "crop_right"
        | "crop_bottom"
        | "crop_left"
        | "anchor_x"
        | "anchor_y"
      >
    > &
    Pick<OverlayItem, "z_index">,
  nextId: () => string
): OverlayItem[] {
  const anchor = getAnchor(parent);
  return DISPLAY_FIELD_KEYS.map((fieldKey, stackOrder) => ({
    id: nextId(),
    scene_id: sceneId,
    type: "clip_display_field" as const,
    x: parent.x,
    y: parent.y,
    w: parent.w,
    h: parent.h,
    // Children mirror the parent's box exactly: design size, crop and anchor
    // included, or they would resolve to a different spot on the scene.
    design_w: parent.design_w ?? parent.w,
    design_h: parent.design_h ?? parent.h,
    crop_top: parent.crop_top ?? 0,
    crop_right: parent.crop_right ?? 0,
    crop_bottom: parent.crop_bottom ?? 0,
    crop_left: parent.crop_left ?? 0,
    anchor_x: anchor.x,
    anchor_y: anchor.y,
    z_index: parent.z_index,
    rotation: 0,
    flip_h: false,
    flip_v: false,
    opacity: 1,
    is_visible: DEFAULT_CLIPS_WIDGET_CONFIG.displayFields[fieldKey],
    is_locked: false,
    label: `Display · ${fieldKey}`,
    config: {
      parentClipItemId: parentId,
      fieldKey,
      stackOrder,
      layout: { ...DEFAULT_CLIPS_WIDGET_CONFIG.displayFieldLayouts[fieldKey] },
      isLayoutLocked: DEFAULT_CLIPS_WIDGET_CONFIG.displayFieldLocks[fieldKey],
    },
  }));
}

export function buildCompositeClipsConfig(
  parent: OverlayItem,
  allItems: OverlayItem[]
): ClipsWidgetConfig {
  const base = slimClipsWidgetItemConfig(parent.config);

  const children = getClipDisplayChildren(allItems, parent.id).slice();
  const parentLegacy = parent.config as Partial<ClipsWidgetConfig>;

  if (children.length === 0 && parentLegacy.displayFields) {
    return {
      ...DEFAULT_CLIPS_WIDGET_CONFIG,
      ...base,
      displayFields: parentLegacy.displayFields as ClipsWidgetConfig["displayFields"],
      displayFieldLayouts:
        parentLegacy.displayFieldLayouts ??
        DEFAULT_CLIPS_WIDGET_CONFIG.displayFieldLayouts,
      displayFieldLocks:
        parentLegacy.displayFieldLocks ??
        DEFAULT_CLIPS_WIDGET_CONFIG.displayFieldLocks,
      displayFieldOrder: resolvedDisplayFieldOrder(parentLegacy),
    };
  }

  if (children.length === 0) {
    return {
      ...DEFAULT_CLIPS_WIDGET_CONFIG,
      ...base,
    };
  }

  children.sort(
    (a, b) =>
      asClipDisplayFieldConfig(a.config).stackOrder -
      asClipDisplayFieldConfig(b.config).stackOrder
  );

  const displayFields = { ...DEFAULT_CLIPS_WIDGET_CONFIG.displayFields };
  const displayFieldLayouts = {
    ...DEFAULT_CLIPS_WIDGET_CONFIG.displayFieldLayouts,
  };
  const displayFieldLocks = { ...DEFAULT_CLIPS_WIDGET_CONFIG.displayFieldLocks };

  for (const c of children) {
    const fc = asClipDisplayFieldConfig(c.config);
    displayFields[fc.fieldKey] = c.is_visible;
    displayFieldLayouts[fc.fieldKey] = { ...fc.layout };
    displayFieldLocks[fc.fieldKey] = fc.isLayoutLocked;
  }

  const displayFieldOrder =
    children.length === DISPLAY_FIELD_KEYS.length &&
    new Set(children.map((c) => asClipDisplayFieldConfig(c.config).fieldKey))
      .size === DISPLAY_FIELD_KEYS.length
      ? children.map((c) => asClipDisplayFieldConfig(c.config).fieldKey)
      : resolvedDisplayFieldOrder({});

  return {
    ...DEFAULT_CLIPS_WIDGET_CONFIG,
    ...base,
    displayFields,
    displayFieldLayouts,
    displayFieldLocks,
    displayFieldOrder,
  };
}

export function resolvedDisplayFieldOrder(
  config: Partial<Pick<ClipsWidgetConfig, "displayFieldOrder">>
): DisplayFieldKey[] {
  const o = config.displayFieldOrder;
  if (
    o &&
    o.length === DISPLAY_FIELD_KEYS.length &&
    new Set(o).size === DISPLAY_FIELD_KEYS.length
  ) {
    return [...o];
  }
  return [...DISPLAY_FIELD_KEYS];
}

export function resolvedDisplayFieldLocks(
  config: Partial<Pick<ClipsWidgetConfig, "displayFieldLocks">>
): Record<DisplayFieldKey, boolean> {
  return {
    ...DEFAULT_CLIPS_WIDGET_CONFIG.displayFieldLocks,
    ...config.displayFieldLocks,
  };
}

/**
 * Normalized clip data passed to `ClipsWidgetRenderer`.
 * The renderer never fetches clips — containers map their data source to this shape.
 */
export interface ClipDataRow {
  clipId: string;
  broadcasterId: string;
  title: string;
  creatorName: string;
  gameName: string | null;
  createdAtTwitch: string;
  viewCount: number | null;
  durationSec: number | null;
}

export function isClipDisplayFieldItem(item: OverlayItem): boolean {
  return item.type === "clip_display_field";
}

export function asClipDisplayFieldConfig(
  config: OverlayItemConfig
): ClipDisplayFieldItemConfig {
  return config as ClipDisplayFieldItemConfig;
}
