import {
  DEFAULT_GOOGLE_FONT_FAMILY,
  isValidGoogleFontFamilyName,
  type GoogleFontFamily,
  type OverlayTextStyle,
} from "./base";
import type { OverlayItemConfig } from "./item";

/** Per-widget configs and their defaults: text, timer, clock, IRL field, custom. */

/** Persisted on `overlay_items` rows with `type === "text_widget"`. */
export interface TextWidgetItemConfig extends OverlayTextStyle {
  text: string;
}

export const TIMER_COUNTDOWN_MODES = ["duration", "absolute"] as const;

export type TimerCountdownMode = (typeof TIMER_COUNTDOWN_MODES)[number];

export const CLOCK_DATE_STYLES = ["short", "medium", "long"] as const;

export type ClockDateStyle = (typeof CLOCK_DATE_STYLES)[number];

export const CLOCK_TIME_STYLES = ["short", "medium", "long"] as const;

export type ClockTimeStyle = (typeof CLOCK_TIME_STYLES)[number];

export const CLOCK_LAYOUT_MODES = ["inline", "stacked"] as const;

export type ClockLayoutMode = (typeof CLOCK_LAYOUT_MODES)[number];

/** Countdown: either a fixed length from first paint / load, or a wall-clock target. */
export interface TimerWidgetItemConfig extends OverlayTextStyle {
  countdownMode: TimerCountdownMode;
  /**
   * When `countdownMode === "duration"`: length of the countdown after the overlay loads
   * (each page load starts a new countdown).
   */
  durationSeconds: number;
  /** When `countdownMode === "absolute"`: ISO 8601 instant to count down to. */
  targetAtIso: string;
  /** Shown when the countdown reaches zero. */
  finishedText: string;
}

/** Live clock / date-time for the viewer's wall clock (optionally a specific IANA time zone). */
export interface ClockWidgetItemConfig extends OverlayTextStyle {
  /** IANA zone, e.g. `Europe/Amsterdam`. Empty = each viewer's local time. */
  timeZone: string;
  showDate: boolean;
  showTime: boolean;
  dateStyle: ClockDateStyle;
  timeStyle: ClockTimeStyle;
  hour12: boolean;
  /** Uses a longer time pattern so seconds are visible where the locale supports it. */
  showSeconds: boolean;
  /** `stacked` shows date above time when both are enabled. */
  layout: ClockLayoutMode;
}

/** Persisted on `overlay_items` rows with any `irl_*_widget` type. */
export interface IrlFieldWidgetItemConfig extends OverlayTextStyle {
  /** Only meaningful when `item.type === "irl_speed_widget"`. */
  unit: "kmh" | "mph";
  mockData: boolean;
}

export const DEFAULT_IRL_FIELD_WIDGET_ITEM_CONFIG: IrlFieldWidgetItemConfig = {
  unit: "kmh",
  mockData: false,
  fontSize: 28,
  color: "#ffffff",
  align: "left",
  fontWeight: 600,
  fontFamily: DEFAULT_GOOGLE_FONT_FAMILY,
};

/** Config for a custom user-authored widget placed on an overlay scene. */
export interface CustomWidgetItemConfig {
  widget_id: string;
  /**
   * Row in overlay_widget_instances backing this item. Only carries
   * `widget_state` now -- field values live in `field_values` below so they
   * save with the item and can be previewed without a round trip.
   */
  instance_id: string;
  /**
   * Author-visible settings. Optional because items placed before field values
   * moved out of the instance row don't have it; readers fall back to the
   * instance's `field_values` until the item is saved again.
   */
  field_values?: Record<string, unknown>;
}

export const DEFAULT_CUSTOM_WIDGET_ITEM_CONFIG: CustomWidgetItemConfig = {
  widget_id: "",
  instance_id: "",
  field_values: {},
};

export const DEFAULT_TEXT_WIDGET_ITEM_CONFIG: TextWidgetItemConfig = {
  text: "Your text here",
  fontSize: 24,
  color: "#ffffff",
  align: "left",
  fontWeight: 400,
  fontFamily: DEFAULT_GOOGLE_FONT_FAMILY,
};

/** Defaults for new timer rows (absolute target is a sensible placeholder if you switch mode). */
export const TIMER_WIDGET_CONFIG_DEFAULTS: TimerWidgetItemConfig = {
  countdownMode: "duration",
  durationSeconds: 300,
  targetAtIso: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  finishedText: "We're live!",
  fontSize: 36,
  color: "#ffffff",
  align: "center",
  fontWeight: 600,
  fontFamily: DEFAULT_GOOGLE_FONT_FAMILY,
};

export function createDefaultTimerWidgetConfig(): TimerWidgetItemConfig {
  return {
    ...TIMER_WIDGET_CONFIG_DEFAULTS,
    targetAtIso: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Coerce persisted / partial timer config (including rows from before `countdownMode` existed).
 */
export function normalizeTimerWidgetConfig(
  config: OverlayItemConfig | Record<string, unknown>
): TimerWidgetItemConfig {
  const r = config as Partial<TimerWidgetItemConfig> & Record<string, unknown>;
  const base = createDefaultTimerWidgetConfig();

  const merged: TimerWidgetItemConfig = {
    ...base,
    ...r,
    fontFamily: resolvedTextWidgetFontFamily(r),
    finishedText:
      typeof r.finishedText === "string" ? r.finishedText : base.finishedText,
    fontSize:
      typeof r.fontSize === "number" && r.fontSize >= 8 ? r.fontSize : base.fontSize,
    color: typeof r.color === "string" ? r.color : base.color,
    align:
      r.align === "left" || r.align === "center" || r.align === "right"
        ? r.align
        : base.align,
    fontWeight:
      r.fontWeight === 400 ||
      r.fontWeight === 500 ||
      r.fontWeight === 600 ||
      r.fontWeight === 700
        ? r.fontWeight
        : base.fontWeight,
  };

  if (
    merged.countdownMode !== "duration" &&
    merged.countdownMode !== "absolute"
  ) {
    merged.countdownMode =
      typeof r.targetAtIso === "string" &&
      r.targetAtIso.length > 0 &&
      !Number.isNaN(Date.parse(r.targetAtIso))
        ? "absolute"
        : "duration";
  }

  if (
    typeof r.durationSeconds !== "number" ||
    !Number.isFinite(r.durationSeconds)
  ) {
    merged.durationSeconds = base.durationSeconds;
  }
  merged.durationSeconds = Math.round(
    Math.max(10, Math.min(604800, merged.durationSeconds))
  );

  if (
    typeof merged.targetAtIso !== "string" ||
    merged.targetAtIso.length === 0 ||
    Number.isNaN(Date.parse(merged.targetAtIso))
  ) {
    merged.targetAtIso = base.targetAtIso;
  }

  return merged;
}

/** Runtime-safe family for editors / renderers (older rows may omit `fontFamily`). */
export function resolvedTextWidgetFontFamily(cfg: {
  fontFamily?: string;
}): GoogleFontFamily {
  const f = cfg.fontFamily;
  return typeof f === "string" && isValidGoogleFontFamilyName(f)
    ? f.trim()
    : DEFAULT_GOOGLE_FONT_FAMILY;
}

export const DEFAULT_CLOCK_WIDGET_ITEM_CONFIG: ClockWidgetItemConfig = {
  fontSize: 28,
  color: "#ffffff",
  align: "center",
  fontWeight: 600,
  fontFamily: DEFAULT_GOOGLE_FONT_FAMILY,
  timeZone: "",
  showDate: true,
  showTime: true,
  dateStyle: "medium",
  timeStyle: "short",
  hour12: false,
  showSeconds: true,
  layout: "inline",
};

export function normalizeClockWidgetConfig(
  config: OverlayItemConfig | Record<string, unknown>
): ClockWidgetItemConfig {
  const r = config as Partial<ClockWidgetItemConfig> & Record<string, unknown>;
  const base = DEFAULT_CLOCK_WIDGET_ITEM_CONFIG;

  const merged: ClockWidgetItemConfig = {
    ...base,
    ...r,
    fontFamily: resolvedTextWidgetFontFamily(r),
    fontSize:
      typeof r.fontSize === "number" && r.fontSize >= 8 ? r.fontSize : base.fontSize,
    color: typeof r.color === "string" ? r.color : base.color,
    align:
      r.align === "left" || r.align === "center" || r.align === "right"
        ? r.align
        : base.align,
    fontWeight:
      r.fontWeight === 400 ||
      r.fontWeight === 500 ||
      r.fontWeight === 600 ||
      r.fontWeight === 700
        ? r.fontWeight
        : base.fontWeight,
    timeZone: typeof r.timeZone === "string" ? r.timeZone : base.timeZone,
    showDate: typeof r.showDate === "boolean" ? r.showDate : base.showDate,
    showTime: typeof r.showTime === "boolean" ? r.showTime : base.showTime,
    dateStyle:
      r.dateStyle === "short" || r.dateStyle === "medium" || r.dateStyle === "long"
        ? r.dateStyle
        : base.dateStyle,
    timeStyle:
      r.timeStyle === "short" || r.timeStyle === "medium" || r.timeStyle === "long"
        ? r.timeStyle
        : base.timeStyle,
    hour12: typeof r.hour12 === "boolean" ? r.hour12 : base.hour12,
    showSeconds:
      typeof r.showSeconds === "boolean" ? r.showSeconds : base.showSeconds,
    layout: r.layout === "stacked" ? "stacked" : base.layout,
  };

  if (!merged.showDate && !merged.showTime) {
    merged.showTime = true;
  }

  return merged;
}
