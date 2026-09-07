/**
 * Single registry object for every root widget (library, canvas, inspector, nested
 * `childFields`). Add new roots here; keep heavy logic in `widgets/<name>/`.
 *
 * To add a root widget:
 * 1. Extend `OverlayItemType` / config in `src/types/overlays.ts`
 * 2. Add Zod in `src/schemas/overlay.ts` (and DB enum if applicable)
 * 3. Add a key to `OVERLAY_WIDGET_REGISTRY` and any helpers under `widgets/<name>/`
 */

"use client";

import {
  Bell,
  Clapperboard,
  Clock,
  Code2,
  Compass,
  Crosshair,
  Gauge,
  MapPin,
  Mountain,
  Timer,
  Type,
} from "lucide-react";
import type { ChildOverlayItemType, OverlayItemType, RootOverlayItemType } from "@/types/overlays";
import {
  getClipDisplayChildren,
  isRootOverlayItemType,
} from "@/types/overlays";
import {
  CLIPS_WIDGET_DEFAULT_SIZE,
  createClipsWidgetRootItems,
} from "../widgets/clips/clips-widget-definition";
import { ClipDisplayFieldSettings } from "../widgets/clips/clip-display-field-settings";
import { ClipsWidgetCanvas } from "../widgets/clips/clips-widget-canvas";
import { ClipsWidgetSettings } from "../widgets/clips/clips-widget-settings";
import {
  createTextWidgetRootItems,
  TEXT_WIDGET_DEFAULT_SIZE,
} from "../widgets/text/text-widget-definition";
import { TextWidgetSettings } from "../widgets/text/text-widget-settings";
import {
  createTimerWidgetRootItems,
  TIMER_WIDGET_DEFAULT_SIZE,
} from "../widgets/timer/timer-widget-definition";
import { TimerWidgetSettings } from "../widgets/timer/timer-widget-settings";
import {
  CLOCK_WIDGET_DEFAULT_SIZE,
  createClockWidgetRootItems,
} from "../widgets/clock/clock-widget-definition";
import { ClockWidgetSettings } from "../widgets/clock/clock-widget-settings";
import {
  IRL_FIELD_WIDGET_DEFAULT_SIZE,
  createIrlSpeedWidgetRootItems,
  createIrlHeadingWidgetRootItems,
  createIrlAltitudeWidgetRootItems,
  createIrlLatitudeWidgetRootItems,
  createIrlLongitudeWidgetRootItems,
  createIrlAccuracyWidgetRootItems,
} from "../widgets/irl/irl-field-widget-definition";
import { IrlFieldWidgetSettings } from "../widgets/irl/irl-field-widget-settings";
import {
  CUSTOM_WIDGET_DEFAULT_SIZE,
  createCustomWidgetRootItems,
} from "../widgets/custom/custom-widget-definition";
import { CustomWidgetSettings } from "../widgets/custom/custom-widget-settings";
import { CustomWidgetCanvas } from "../widgets/custom/custom-widget-canvas";
import {
  ALERT_WIDGET_DEFAULT_SIZE,
  createAlertWidgetRootItems,
} from "../widgets/alert/alert-widget-definition";
import { AlertWidgetSettings } from "../widgets/alert/alert-widget-settings";
import {
  AlertWidgetRenderer,
  TextWidgetRenderer,
  TimerWidgetRenderer,
  ClockWidgetRenderer,
  IrlFieldWidgetRenderer,
} from "@repo/ui/overlay";
import type {
  OverlayCanvasProps,
  OverlayChildResolvedDefinition,
  OverlayRootWidgetDefinition,
  ResolvedOverlayWidgetDefinition,
  WidgetCategory,
} from "./overlay-widget-registry.types";

/**
 * On the canvas the alert box has no live socket to listen to, so it renders a
 * placeholder instead of subscribing and sitting empty.
 */
function AlertWidgetCanvas({ item, scene }: OverlayCanvasProps) {
  return <AlertWidgetRenderer item={item} scene={scene} isEditor />;
}

export const OVERLAY_WIDGET_REGISTRY: Record<
  RootOverlayItemType,
  OverlayRootWidgetDefinition
> = {
  clips_widget: {
    type: "clips_widget",
    layerScope: "root",
    icon: Clapperboard,
    showInLibrary: true,
    category: "media",
    library: {
      title: "Clips widget",
      description: "Rotating Twitch clips with customizable display fields.",
    },
    defaultSize: { ...CLIPS_WIDGET_DEFAULT_SIZE },
    createRootItems: createClipsWidgetRootItems,
    getChildItems: getClipDisplayChildren,
    syncChildGeometryFromParent: true,
    CanvasContent: ClipsWidgetCanvas,
    SettingsPanel: ClipsWidgetSettings,
    childFields: [
      {
        type: "clip_display_field",
        defaultSize: { ...CLIPS_WIDGET_DEFAULT_SIZE },
        SettingsPanel: ClipDisplayFieldSettings,
      },
    ],
  },
  alert_widget: {
    type: "alert_widget",
    layerScope: "root",
    icon: Bell,
    showInLibrary: true,
    category: "alerts",
    library: {
      title: "Alert box",
      description:
        "Follow, sub, cheer, and raid alerts with your own images, videos, and sounds. No code needed.",
    },
    defaultSize: { ...ALERT_WIDGET_DEFAULT_SIZE },
    createRootItems: createAlertWidgetRootItems,
    CanvasContent: AlertWidgetCanvas,
    SettingsPanel: AlertWidgetSettings,
  },
  text_widget: {
    type: "text_widget",
    layerScope: "root",
    icon: Type,
    showInLibrary: true,
    category: "layout",
    library: {
      title: "Text",
      description: "Static text with font size, color, and alignment.",
    },
    defaultSize: { ...TEXT_WIDGET_DEFAULT_SIZE },
    createRootItems: createTextWidgetRootItems,
    CanvasContent: TextWidgetRenderer,
    SettingsPanel: TextWidgetSettings,
  },
  timer_widget: {
    type: "timer_widget",
    layerScope: "root",
    icon: Timer,
    showInLibrary: true,
    category: "layout",
    library: {
      title: "Countdown",
      description:
        "Count down to a date and time—starting soon, breaks, or anything you schedule.",
    },
    defaultSize: { ...TIMER_WIDGET_DEFAULT_SIZE },
    createRootItems: createTimerWidgetRootItems,
    CanvasContent: TimerWidgetRenderer,
    SettingsPanel: TimerWidgetSettings,
  },
  clock_widget: {
    type: "clock_widget",
    layerScope: "root",
    icon: Clock,
    showInLibrary: true,
    category: "layout",
    library: {
      title: "Time",
      description:
        "Live date and time—local or a fixed time zone, with typography you control.",
    },
    defaultSize: { ...CLOCK_WIDGET_DEFAULT_SIZE },
    createRootItems: createClockWidgetRootItems,
    CanvasContent: ClockWidgetRenderer,
    SettingsPanel: ClockWidgetSettings,
  },
  irl_speed_widget: {
    type: "irl_speed_widget",
    layerScope: "root",
    icon: Gauge,
    showInLibrary: true,
    category: "other",
    library: { title: "IRL · Speed", description: "Live GPS speed from an IRL stream." },
    defaultSize: { ...IRL_FIELD_WIDGET_DEFAULT_SIZE },
    createRootItems: createIrlSpeedWidgetRootItems,
    CanvasContent: IrlFieldWidgetRenderer,
    SettingsPanel: IrlFieldWidgetSettings,
  },
  irl_heading_widget: {
    type: "irl_heading_widget",
    layerScope: "root",
    icon: Compass,
    showInLibrary: true,
    category: "other",
    library: { title: "IRL · Heading", description: "Live GPS heading direction from an IRL stream." },
    defaultSize: { ...IRL_FIELD_WIDGET_DEFAULT_SIZE },
    createRootItems: createIrlHeadingWidgetRootItems,
    CanvasContent: IrlFieldWidgetRenderer,
    SettingsPanel: IrlFieldWidgetSettings,
  },
  irl_altitude_widget: {
    type: "irl_altitude_widget",
    layerScope: "root",
    icon: Mountain,
    showInLibrary: true,
    category: "other",
    library: { title: "IRL · Altitude", description: "Live GPS altitude from an IRL stream." },
    defaultSize: { ...IRL_FIELD_WIDGET_DEFAULT_SIZE },
    createRootItems: createIrlAltitudeWidgetRootItems,
    CanvasContent: IrlFieldWidgetRenderer,
    SettingsPanel: IrlFieldWidgetSettings,
  },
  irl_latitude_widget: {
    type: "irl_latitude_widget",
    layerScope: "root",
    icon: MapPin,
    showInLibrary: true,
    category: "other",
    library: { title: "IRL · Latitude", description: "Live GPS latitude from an IRL stream." },
    defaultSize: { ...IRL_FIELD_WIDGET_DEFAULT_SIZE },
    createRootItems: createIrlLatitudeWidgetRootItems,
    CanvasContent: IrlFieldWidgetRenderer,
    SettingsPanel: IrlFieldWidgetSettings,
  },
  irl_longitude_widget: {
    type: "irl_longitude_widget",
    layerScope: "root",
    icon: MapPin,
    showInLibrary: true,
    category: "other",
    library: { title: "IRL · Longitude", description: "Live GPS longitude from an IRL stream." },
    defaultSize: { ...IRL_FIELD_WIDGET_DEFAULT_SIZE },
    createRootItems: createIrlLongitudeWidgetRootItems,
    CanvasContent: IrlFieldWidgetRenderer,
    SettingsPanel: IrlFieldWidgetSettings,
  },
  irl_accuracy_widget: {
    type: "irl_accuracy_widget",
    layerScope: "root",
    icon: Crosshair,
    showInLibrary: true,
    category: "other",
    library: { title: "IRL · Accuracy", description: "Live GPS accuracy from an IRL stream." },
    defaultSize: { ...IRL_FIELD_WIDGET_DEFAULT_SIZE },
    createRootItems: createIrlAccuracyWidgetRootItems,
    CanvasContent: IrlFieldWidgetRenderer,
    SettingsPanel: IrlFieldWidgetSettings,
  },
  custom_widget: {
    type: "custom_widget",
    layerScope: "root",
    icon: Code2,
    showInLibrary: false,
    category: "other",
    library: {
      title: "Custom Widget",
      description: "Build your own widget with HTML, JavaScript, and Tailwind CSS.",
    },
    defaultSize: { ...CUSTOM_WIDGET_DEFAULT_SIZE },
    createRootItems: createCustomWidgetRootItems,
    CanvasContent: CustomWidgetCanvas,
    SettingsPanel: CustomWidgetSettings,
  },
};

const childDefinitionByType: Map<
  ChildOverlayItemType,
  OverlayChildResolvedDefinition
> = new Map();

for (const root of Object.values(OVERLAY_WIDGET_REGISTRY)) {
  if (!root.childFields) continue;
  for (const field of root.childFields) {
    if (childDefinitionByType.has(field.type)) {
      throw new Error(
        `Duplicate child overlay definition for type: ${field.type}`
      );
    }
    childDefinitionByType.set(field.type, {
      type: field.type,
      layerScope: "child",
      showInLibrary: false,
      defaultSize: field.defaultSize,
      SettingsPanel: field.SettingsPanel,
      CanvasContent: field.CanvasContent,
    });
  }
}

export function getOverlayWidgetDefinition(
  type: OverlayItemType
): ResolvedOverlayWidgetDefinition {
  if (isRootOverlayItemType(type)) {
    return OVERLAY_WIDGET_REGISTRY[type];
  }
  const resolved = childDefinitionByType.get(type as ChildOverlayItemType);
  if (resolved) return resolved;
  throw new Error(`Unknown overlay item type: ${type}`);
}

export function getRootOverlayWidgetDefinition(
  type: RootOverlayItemType
): OverlayRootWidgetDefinition {
  return OVERLAY_WIDGET_REGISTRY[type];
}

export function isRootLayerType(type: OverlayItemType): boolean {
  return isRootOverlayItemType(type);
}

export function getLibraryWidgetDefinitions(): OverlayRootWidgetDefinition[] {
  return Object.values(OVERLAY_WIDGET_REGISTRY).filter((d) => d.showInLibrary);
}

export function groupLibraryWidgetsByCategory(): Record<
  WidgetCategory,
  OverlayRootWidgetDefinition[]
> {
  const grouped: Record<WidgetCategory, OverlayRootWidgetDefinition[]> = {
    media: [],
    alerts: [],
    layout: [],
    other: [],
  };
  for (const def of getLibraryWidgetDefinitions()) {
    const cat: WidgetCategory = def.category ?? "other";
    grouped[cat].push(def);
  }
  return grouped;
}

export type {
  OverlayCanvasProps,
  OverlayChildFieldDeclaration,
  OverlayChildResolvedDefinition,
  OverlayInspectorAppendProps,
  OverlayRootWidgetDefinition,
  ResolvedOverlayWidgetDefinition,
} from "./overlay-widget-registry.types";
export { isRootOverlayDefinition } from "./overlay-widget-registry.types";
