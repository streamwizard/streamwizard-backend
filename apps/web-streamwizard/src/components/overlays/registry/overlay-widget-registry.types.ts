import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import type { Database } from "@repo/supabase";
import type {
  ChildOverlayItemType,
  DisplayFieldKey,
  OverlayItem,
  OverlayItemConfig,
  OverlayItemType,
  OverlaySceneWithItems,
  RootOverlayItemType,
} from "@/types/overlays";
import type { WidgetBaseDefinition } from "@repo/ui/overlay";

export type WidgetCategory = "media" | "alerts" | "layout" | "other";

export type LayerScope = "root" | "child";

export interface CreateRootItemContext {
  scene: OverlaySceneWithItems;
  nextId: () => string;
  maxZ: number;
}

export interface EditorClipPlaybackControls {
  previewPaused: boolean;
  previewForceMute: boolean;
  autoplayBlocked: boolean;
  resumeTick: number;
  setAutoplayBlocked: (blocked: boolean) => void;
  setPreviewPaused: (paused: boolean) => void;
  setPreviewForceMute: (forceMute: boolean) => void;
  bumpResumePlayback: () => void;
}

export interface OverlayCanvasProps {
  item: OverlayItem;
  scene: OverlaySceneWithItems;
  /**
   * On-screen px per content px (editor zoom x the item's content scale). The
   * canvas already applies both as CSS transforms, so widget bodies must NOT
   * multiply by this — it exists only so editor-only chrome (playback buttons,
   * placeholder labels) can divide by it to stay legible when zoomed out.
   */
  screenScale: number;
  selectedItemId: string | null;
  selected: OverlayItem | undefined;
  selectItem: (id: string | null) => void;
  selectClipDisplayFieldForEdit: (
    parentClipItemId: string,
    fieldKey: DisplayFieldKey
  ) => void;
  updateItem: (
    id: string,
    updates: Partial<OverlayItem>,
    options?: { history?: boolean }
  ) => void;
  /** Editor-only: session clip preview (pause / mute / autoplay), not saved. */
  editorClipPlayback?: EditorClipPlaybackControls;
}

export type ClipFolderRow = Database["public"]["Tables"]["clip_folders"]["Row"];

/** Shown below generic “Properties” for root items. */
export interface OverlayInspectorAppendProps {
  item: OverlayItem;
  updateItem: (
    id: string,
    updates: Partial<OverlayItem>,
    options?: { history?: boolean }
  ) => void;
  clipFolders: ClipFolderRow[];
}

/**
 * One nested row type owned by a root (`childFields` array). Not listed in the widget sheet.
 * Same optional building blocks as roots where relevant (`defaultSize`, `SettingsPanel`, …).
 */
export interface OverlayChildFieldDeclaration {
  type: ChildOverlayItemType;
  defaultSize?: { w: number; h: number };
  SettingsPanel?: ComponentType<OverlayInspectorAppendProps>;
  CanvasContent?: ComponentType<OverlayCanvasProps>;
}

/**
 * Root entry in `OVERLAY_WIDGET_REGISTRY` only.
 * Extends the shared `WidgetBaseDefinition` with editor-specific capabilities.
 */
export interface OverlayRootWidgetDefinition extends WidgetBaseDefinition {
  layerScope: "root";
  showInLibrary: boolean;
  category?: WidgetCategory;
  /** Marks the widget's rows in the layers panel so a type reads at a glance. */
  icon: LucideIcon;
  library?: {
    title: string;
    description?: string;
  };

  createRootItems?: (ctx: CreateRootItemContext) => OverlayItem[];

  newLabel?: (scene: OverlaySceneWithItems) => string;

  getChildItems?: (items: OverlayItem[], parentId: string) => OverlayItem[];

  syncChildGeometryFromParent?: boolean;

  CanvasContent?: ComponentType<OverlayCanvasProps>;
  SettingsPanel?: ComponentType<OverlayInspectorAppendProps>;

  /**
   * Nested overlay item types owned by this root (layers sidebar only).
   */
  childFields?: OverlayChildFieldDeclaration[];
}

/** Resolved definition for a child item (flattened from a root’s `childFields`). */
export interface OverlayChildResolvedDefinition {
  type: ChildOverlayItemType;
  layerScope: "child";
  showInLibrary: false;
  defaultSize?: { w: number; h: number };
  SettingsPanel?: ComponentType<OverlayInspectorAppendProps>;
  CanvasContent?: ComponentType<OverlayCanvasProps>;
}

/** What consumers get from `getOverlayWidgetDefinition(type)`. */
export type ResolvedOverlayWidgetDefinition =
  | OverlayRootWidgetDefinition
  | OverlayChildResolvedDefinition;

export function isRootOverlayDefinition(
  def: ResolvedOverlayWidgetDefinition
): def is OverlayRootWidgetDefinition {
  return def.layerScope === "root";
}
