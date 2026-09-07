"use client";

import type { ComponentType } from "react";
import { useMemo, type ReactNode } from "react";
import type { OverlayItem, OverlayScene } from "./types";
import { resolveAnchoredPosition } from "./lib/item-anchor";
import { itemTransform } from "./lib/item-flip";
import { useGoogleFonts } from "./hooks/use-google-font";
import { WidgetScaleFrame } from "./WidgetScaleFrame";
import { textWidgetBaseDefinition } from "./widgets/text/text-widget-definition";
import { timerWidgetBaseDefinition } from "./widgets/timer/timer-widget-definition";
import { clockWidgetBaseDefinition } from "./widgets/clock/clock-widget-definition";
import { TextWidgetRenderer } from "./widgets/text/TextWidgetRenderer";
import { TimerWidgetRenderer } from "./widgets/timer/TimerWidgetRenderer";
import { ClockWidgetRenderer } from "./widgets/clock/ClockWidgetRenderer";
import {
  IrlFieldWidgetRenderer,
  collectIrlFieldFontFamilies,
} from "./widgets/irl/irl-field-widget-definition";
import { alertWidgetBaseDefinition } from "./widgets/alert/alert-widget-definition";
import { AlertWidgetRenderer } from "./widgets/alert/AlertWidgetRenderer";
import { IRL_FIELD_WIDGET_TYPES } from "./types";

export type OverlayWidgetProps = {
  item: OverlayItem;
  scene: OverlayScene;
};

export type OverlayWidgetRegistration = {
  id: string;
  Component: ComponentType<OverlayWidgetProps>;
  collectFontFamilies?: (item: OverlayItem) => string[];
};

type W = ComponentType<OverlayWidgetProps>;

const CORE_WIDGETS: OverlayWidgetRegistration[] = [
  {
    id: "text_widget",
    Component: TextWidgetRenderer as W,
    collectFontFamilies: textWidgetBaseDefinition.collectFontFamilies,
  },
  {
    id: "timer_widget",
    Component: TimerWidgetRenderer as W,
    collectFontFamilies: timerWidgetBaseDefinition.collectFontFamilies,
  },
  {
    id: "clock_widget",
    Component: ClockWidgetRenderer as W,
    collectFontFamilies: clockWidgetBaseDefinition.collectFontFamilies,
  },
  {
    id: "alert_widget",
    Component: AlertWidgetRenderer as W,
    collectFontFamilies: alertWidgetBaseDefinition.collectFontFamilies,
  },
  ...IRL_FIELD_WIDGET_TYPES.map((type) => ({
    id: type,
    Component: IrlFieldWidgetRenderer as W,
    collectFontFamilies: collectIrlFieldFontFamilies,
  })),
];

function collectFonts(
  items: OverlayItem[],
  registry: Map<string, OverlayWidgetRegistration>
): string[] {
  const set = new Set<string>();
  for (const item of items) {
    const reg = registry.get(item.type);
    for (const f of reg?.collectFontFamilies?.(item) ?? []) {
      if (f.trim()) set.add(f.trim());
    }
  }
  return [...set];
}

function OverlayLayerWrapper({
  item,
  scene,
  children,
}: {
  item: OverlayItem;
  scene: OverlayScene;
  children: ReactNode;
}) {
  const opacity =
    typeof item.opacity === "number" && Number.isFinite(item.opacity)
      ? Math.min(1, Math.max(0, item.opacity))
      : 1;
  // Same resolution the editor canvas uses, so both agree on where an anchored
  // item sits. The scene size is the live one, which is what makes a
  // bottom-right item stay bottom-right in a portrait GPS view.
  const position = resolveAnchoredPosition(item, scene);

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width: item.w,
        height: item.h,
        zIndex: item.z_index,
        opacity,
        transform: itemTransform(item),
        transformOrigin: "center center",
        pointerEvents: "none",
        boxSizing: "border-box",
      }}
    >
      <WidgetScaleFrame item={item}>{children}</WidgetScaleFrame>
    </div>
  );
}

/**
 * Renders an overlay scene. Core widgets (text, timer, clock) are built-in.
 * Pass additional widget registrations via `widgets` for app-specific types
 * (e.g. clips widget with its data-fetching container).
 */
export function OverlaySceneCanvas({
  scene,
  items,
  widgets = [],
}: {
  scene: OverlayScene;
  items: OverlayItem[];
  /** App-specific widget registrations appended on top of the core registry. */
  widgets?: OverlayWidgetRegistration[];
}) {
  const registry = useMemo(() => {
    const map = new Map(CORE_WIDGETS.map((w) => [w.id, w]));
    for (const w of widgets) map.set(w.id, w);
    return map;
  }, [widgets]);

  const fonts = useMemo(() => collectFonts(items, registry), [items, registry]);
  useGoogleFonts(fonts);

  return (
    <div
      style={{
        position: "relative",
        width: scene.width,
        height: scene.height,
        overflow: "hidden",
        background: "transparent",
      }}
    >
      {items.map((item) => {
        const reg = registry.get(item.type);
        if (!reg) return null;
        const Widget = reg.Component;
        return (
          <OverlayLayerWrapper key={item.id} item={item} scene={scene}>
            <Widget item={item} scene={scene} />
          </OverlayLayerWrapper>
        );
      })}
    </div>
  );
}
