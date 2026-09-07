import type { ComponentType } from "react";
import type { OverlayItem, OverlayItemConfig, RootOverlayItemType } from "./types";

export interface WidgetRendererProps {
  item: OverlayItem;
  /**
   * Renderers always draw at raw scene pixels. Two CSS transforms sit above
   * them: `WidgetScaleFrame` scales content to the item's rendered box, and the
   * editor canvas scales the whole scene by its zoom. A renderer must never
   * apply a scale of its own or multiply its px by either factor.
   */
  isEditor?: boolean;
}

export interface WidgetBaseDefinition<T extends RootOverlayItemType = RootOverlayItemType> {
  type: T;
  /** Default pixel size when placed on the canvas. */
  defaultSize: { w: number; h: number };
  /**
   * Factory for default config values when a widget is created.
   * Populated by per-widget base definition objects in packages/ui.
   */
  createDefaultConfig?: () => OverlayItemConfig;
  /**
   * Pure renderer — receives the item with its config and emits visual output.
   * This same component is used in both the editor preview and the live overlay,
   * guaranteeing identical visual output in both contexts.
   * Populated by per-widget base definition objects in packages/ui.
   */
  Renderer?: ComponentType<WidgetRendererProps>;
  /** Returns Google Font family names to preload for this item, if any. */
  collectFontFamilies?: (item: OverlayItem) => string[];
}
