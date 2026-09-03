import { collectSceneFontFamilies } from "@repo/alert-scene";
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
  collectFontFamilies: (item) => collectAlertFontFamilies(normalizeAlertWidgetConfig(item.config)),
};

/** Each alert type carries its own font, and a timeline can use several more. */
export function collectAlertFontFamilies(cfg: ReturnType<typeof normalizeAlertWidgetConfig>): string[] {
  const out = new Set<string>();
  for (const event of ALERT_EVENT_TYPES) {
    const variant = cfg.variants[event];
    if (variant.fontFamily) out.add(variant.fontFamily);
    if (variant.timeline) for (const f of collectSceneFontFamilies(variant.timeline)) out.add(f);
  }
  return [...out];
}
