import type { WidgetBaseDefinition } from "../../widget-definition";
import {
  ALERT_EVENT_TYPES,
  createDefaultAlertWidgetConfig,
  normalizeAlertWidgetConfig,
} from "./alert-widget-config";
import { AlertWidgetRenderer } from "./AlertWidgetRenderer";

export const ALERT_WIDGET_DEFAULT_SIZE = { w: 600, h: 400 } as const;

export const alertWidgetBaseDefinition: WidgetBaseDefinition<"alert_widget"> = {
  type: "alert_widget",
  defaultSize: { ...ALERT_WIDGET_DEFAULT_SIZE },
  createDefaultConfig: createDefaultAlertWidgetConfig,
  Renderer: AlertWidgetRenderer,
  collectFontFamilies: (item) => {
    const cfg = normalizeAlertWidgetConfig(item.config);
    // Each alert type carries its own font.
    return [
      ...new Set(
        ALERT_EVENT_TYPES.map((e) => cfg.variants[e].fontFamily).filter(Boolean)
      ),
    ];
  },
};
