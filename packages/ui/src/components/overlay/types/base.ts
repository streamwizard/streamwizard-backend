/** Shared overlay vocabulary: item type unions, text styling, GPS payloads. */

export type GoogleFontFamily = string;

export const DEFAULT_GOOGLE_FONT_FAMILY: GoogleFontFamily = "Inter";

export function isValidGoogleFontFamilyName(v: string): boolean {
  const t = v.trim();
  return t.length > 0 && t.length <= 200 && !/[<>]/.test(t);
}

export const IRL_FIELD_WIDGET_TYPES = [
  "irl_speed_widget",
  "irl_heading_widget",
  "irl_altitude_widget",
  "irl_latitude_widget",
  "irl_longitude_widget",
  "irl_accuracy_widget",
] as const;

export type IrlFieldWidgetType = (typeof IRL_FIELD_WIDGET_TYPES)[number];

export const OVERLAY_ITEM_TYPES = [
  "clips_widget",
  "clip_display_field",
  "text_widget",
  "timer_widget",
  "clock_widget",
  "custom_widget",
  "alert_widget",
  ...IRL_FIELD_WIDGET_TYPES,
] as const;

export type OverlayItemType = (typeof OVERLAY_ITEM_TYPES)[number];

/** Root overlay items that can be added from the widget library. */
export const ROOT_OVERLAY_ITEM_TYPES = [
  "clips_widget",
  "text_widget",
  "timer_widget",
  "clock_widget",
  "custom_widget",
  "alert_widget",
  ...IRL_FIELD_WIDGET_TYPES,
] as const;

export type RootOverlayItemType = (typeof ROOT_OVERLAY_ITEM_TYPES)[number];

export function isRootOverlayItemType(
  type: OverlayItemType
): type is RootOverlayItemType {
  return (ROOT_OVERLAY_ITEM_TYPES as readonly string[]).includes(type);
}

/** Overlay item types that exist as child rows (not in the widget sheet). */
export type ChildOverlayItemType = Exclude<OverlayItemType, RootOverlayItemType>;

/** Typography shared by text and timer (and similar) widgets. */
export interface OverlayTextStyle {
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
  fontWeight: 400 | 500 | 600 | 700;
  /** Google Font family name (see fonts.google.com). */
  fontFamily: GoogleFontFamily;
}

/** Raw GPS data sent from the phone over WebSocket. */
export interface GeoPayload {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  accuracy: number;
  timestamp: number;
}
