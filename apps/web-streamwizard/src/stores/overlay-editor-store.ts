import { create } from "zustand";
import type { FireMode } from "@/components/demo/demo-fire";
import {
  getOverlayWidgetDefinition,
  isRootLayerType,
  isRootOverlayDefinition,
  OVERLAY_WIDGET_REGISTRY,
} from "@/components/overlays/registry/overlay-widget-registry";
import { clampZoom } from "@/components/overlays/editor/canvas-zoom";
import {
  clampGridLineWidth,
  clampGridSize,
  loadCanvasPreferences,
  saveCanvasBackground,
  saveGridSettings,
  saveRulerCursor,
  saveSnapToItems,
  saveRulersVisible,
  type CanvasBackground,
  type GridSettings,
  type SnapAxes,
} from "@/components/overlays/editor/canvas-preferences";
import {
  rescaleItemsForResolution,
  type ResolutionChangeMode,
} from "@/components/overlays/editor/scene-resize";
import {
  alignUpdates,
  distributeUpdates,
  flipUpdates,
  matchSizeUpdates,
  selectionBounds,
  type AlignEdge,
  type DistributeAxis,
  type FlipAxis,
  type ItemLayoutUpdate,
  type MatchDimension,
} from "@/components/overlays/editor/selection-layout";
import {
  MIN_ITEM_SIZE,
  applyLayerOrder,
  buildDuplicate,
  cascadeIds,
  clampGeometry,
  fromAbsoluteGeometry,
  nextTempId,
  pinToSceneEdge,
  touchesGeometry,
} from "@/components/overlays/editor/overlay-item-helpers";
import { resolveAnchoredPosition, withAbsolutePosition } from "@repo/ui/overlay";
import type {
  ClipDisplayFieldItemConfig,
  DisplayFieldKey,
  OverlayItem,
  RootOverlayItemType,
  OverlaySceneWithItems,
} from "@/types/overlays";
import { asClipDisplayFieldConfig } from "@/types/overlays";

/**
 * One undo step. The scene's size rides along with the items because changing
 * the resolution can reposition everything, and undoing half of that would
 * leave a layout built for a canvas that is no longer there.
 */
export interface EditorSnapshot {
  items: OverlayItem[];
  width: number;
  height: number;
}

const HISTORY_LIMIT = 50;
const NUDGE_HISTORY_COALESCE_MS = 400;
const CONFIG_HISTORY_COALESCE_MS = 400;
const CONFIG_DIFF_MAX_DEPTH = 4;

export { MIN_ITEM_SIZE };

/** What a plain left-drag on the canvas does: select drags widgets, hand drags the view. */
export type EditorTool = "select" | "hand";

interface OverlayEditorState {
  scene: OverlaySceneWithItems | null;
  selectedItemIds: string[];
  isDirty: boolean;
  zoom: number;
  /** Undo/redo snapshots of scene.items. Cleared on every setScene (save remaps temp ids). */
  history: { past: EditorSnapshot[]; future: EditorSnapshot[] };
  /** Set by the canvas context menu "Rename" — the inspector focuses its Label input, then clears it. */
  renameRequestId: string | null;

  /**
   * Design-time canvas aids. The streamer's own working preferences: they never
   * reach the scene, the database or the live overlay.
   */
  canvasBackground: CanvasBackground;
  setCanvasBackground: (background: CanvasBackground) => void;
  snapToItems: SnapAxes;
  setSnapToItems: (axes: Partial<SnapAxes>) => void;
  grid: GridSettings;
  setGrid: (grid: Partial<GridSettings>) => void;
  rulersVisible: boolean;
  setRulersVisible: (visible: boolean) => void;
  rulerCursorVisible: boolean;
  setRulerCursorVisible: (visible: boolean) => void;

  setScene: (
    scene: OverlaySceneWithItems,
    options?: { idMap?: Record<string, string> }
  ) => void;
  selectItem: (id: string | null) => void;
  toggleSelectItem: (id: string) => void;
  setSelectedItems: (ids: string[]) => void;
  clearSelection: () => void;
  selectClipDisplayFieldForEdit: (
    parentClipItemId: string,
    fieldKey: DisplayFieldKey
  ) => void;
  setZoom: (zoom: number) => void;
  /**
   * Changes the scene's resolution in the editor only; the row is written on
   * the next save. One undo step covers the size and any repositioning.
   */
  setSceneResolution: (
    width: number,
    height: number,
    mode: ResolutionChangeMode
  ) => void;
  /**
   * Where the canvas's top-left sits inside the pane, in screen px. The pane
   * never scrolls: pan and zoom are the whole viewport, so the hand tool, the
   * wheel and cursor-anchored zoom all move the same two numbers.
   */
  panX: number;
  panY: number;
  setPan: (x: number, y: number) => void;
  /** Space and the middle button pan whatever the tool; this decides the plain left-drag. */
  activeTool: EditorTool;
  setActiveTool: (tool: EditorTool) => void;
  markDirty: () => void;
  markClean: () => void;
  setRenameRequestId: (id: string | null) => void;

  pushHistory: (snapshot?: OverlayItem[]) => void;
  undo: () => void;
  redo: () => void;

  addItem: (type: RootOverlayItemType) => void;
  addCustomWidget: (widgetId: string) => void;
  updateItem: (
    id: string,
    updates: Partial<OverlayItem>,
    options?: { history?: boolean }
  ) => void;
  removeItem: (id: string) => void;
  removeSelectedItems: () => void;
  duplicateItem: (id: string) => void;
  duplicateSelectedItems: () => void;
  nudgeSelected: (dx: number, dy: number) => void;
  /** Multi-selection layout. Each pushes a single undo step. */
  alignSelected: (edge: AlignEdge) => void;
  distributeSelected: (axis: DistributeAxis) => void;
  matchSizeSelected: (dimension: MatchDimension) => void;
  /** Mirrors the selection; every unlocked item toggles its own flag. */
  flipSelected: (axis: FlipAxis) => void;
  /** The selected root items with absolute positions, for layout maths. */
  selectedRootItems: () => OverlayItem[];
  /** Applies layout patches whose `x`/`y` are absolute scene coordinates. */
  applyLayoutUpdates: (updates: ItemLayoutUpdate[]) => void;
  reorderItem: (id: string, direction: "up" | "down") => void;
  setLayerOrder: (orderedIdsTopFirst: string[]) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  renameItem: (id: string, label: string) => void;
  toggleItemVisibility: (id: string) => void;
  toggleItemLock: (id: string) => void;

  /** Editor-only: optional clip preview controls (pause / force-mute / autoplay), not persisted. */
  editorClipPreviewPaused: boolean;
  setEditorClipPreviewPaused: (paused: boolean) => void;
  editorClipPreviewForceMute: boolean;
  setEditorClipPreviewForceMute: (forceMute: boolean) => void;
  editorClipPreviewAutoplayBlocked: boolean;
  setEditorClipPreviewAutoplayBlocked: (blocked: boolean) => void;
  editorClipPreviewResumeTick: number;
  bumpEditorClipPreviewResume: () => void;
  attemptEditorClipPreviewUnblock: () => void;

  /**
   * Demo mode: the last fake event pushed at the canvas's widget iframes.
   * Editor-session only -- never enters history and never marks the scene
   * dirty, same as the clip preview controls above.
   *
   * Consumers compare `seq` and nothing else; firing the same event twice must
   * still deliver twice, which an equality check on the payload wouldn't do.
   */
  demoEvent: { listener: string; event: Record<string, unknown>; seq: number } | null;
  emitDemoEvent: (listener: string, event: Record<string, unknown>) => void;
  /**
   * Where test events go, shared by the demo bar and the alert box's own Test
   * buttons. It lives here rather than in the demo bar because the two panels
   * sit in different corners of the editor and must agree: a streamer who set
   * the bar to Live shouldn't find the alert inspector still firing locally.
   */
  demoFireMode: FireMode;
  setDemoFireMode: (mode: FireMode) => void;
  /** Ids of the simulators currently looping, so the toolbar can badge a count. */
  runningSimulatorIds: string[];
  setRunningSimulatorIds: (ids: string[]) => void;
}

/** The single-selection id when exactly one item is selected; feeds legacy single-select consumers. */
export function selectPrimarySelectedId(s: Pick<OverlayEditorState, "selectedItemIds">): string | null {
  return s.selectedItemIds.length === 1 ? s.selectedItemIds[0]! : null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Dotted paths of the values that differ between two configs, descending one
 * level at a time so nested settings name themselves (`variants.follow.title`,
 * `layout.x`) instead of collapsing into their container key. Arrays and
 * non-objects compare as leaves.
 */
function changedConfigPaths(
  prev: unknown,
  next: unknown,
  prefix = "",
  depth = 0
): string[] {
  if (Object.is(prev, next)) return [];
  if (
    depth >= CONFIG_DIFF_MAX_DEPTH ||
    !isPlainRecord(prev) ||
    !isPlainRecord(next)
  ) {
    return [prefix || "*"];
  }

  const paths: string[] = [];
  for (const key of new Set([...Object.keys(prev), ...Object.keys(next)])) {
    paths.push(
      ...changedConfigPaths(
        prev[key],
        next[key],
        prefix ? `${prefix}.${key}` : key,
        depth + 1
      )
    );
  }
  return paths;
}

/** Clip-field children point at their parent by id; re-point them after a save. */
function remapItemConfigRefs(
  config: OverlayItem["config"],
  idMap: Record<string, string>
): OverlayItem["config"] {
  if (typeof config !== "object" || !config || !("parentClipItemId" in config)) {
    return config;
  }
  const c = config as ClipDisplayFieldItemConfig;
  const nextParent = idMap[c.parentClipItemId];
  if (!nextParent || nextParent === c.parentClipItemId) return config;
  return { ...c, parentClipItemId: nextParent };
}

/**
 * Rewrites the undo/redo stack from temp ids to the DB ids a save handed back,
 * so a snapshot taken before the save still describes rows the next save can
 * find. Snapshots that reference nothing in the map keep their identity, which
 * keeps `pushHistory`'s no-op check working.
 */
function remapHistory(
  history: { past: EditorSnapshot[]; future: EditorSnapshot[] },
  idMap: Record<string, string>
): { past: EditorSnapshot[]; future: EditorSnapshot[] } {
  if (Object.keys(idMap).length === 0) return history;

  const remapSnapshot = (snapshot: EditorSnapshot): EditorSnapshot => {
    let changed = false;
    const next = snapshot.items.map((item) => {
      const id = idMap[item.id] ?? item.id;
      const config = remapItemConfigRefs(item.config, idMap);
      if (id === item.id && config === item.config) return item;
      changed = true;
      return { ...item, id, config };
    });
    return changed ? { ...snapshot, items: next } : snapshot;
  };

  return {
    past: history.past.map(remapSnapshot),
    future: history.future.map(remapSnapshot),
  };
}

let lastNudgeAt = 0;
let lastConfigEditAt = 0;
let lastConfigEditKey: string | null = null;
let configEditTickOpen = false;

/**
 * One undo step per field interaction. Continuous typing or dragging on the
 * same field coalesces into a single step, a different field starts a new one,
 * and everything written inside one handler stays in the same step so undo can
 * never leave a multi-item edit (swapping two display fields' stack order) half
 * applied. A write that changes nothing records no step at all.
 */
/** A scene swap ends any burst in progress; the next edit starts a fresh step. */
function resetConfigEditCoalescing() {
  lastConfigEditAt = 0;
  lastConfigEditKey = null;
  configEditTickOpen = false;
}

function recordConfigEdit(
  id: string,
  prevConfig: unknown,
  nextConfig: unknown,
  pushHistory: () => void
) {
  const paths = changedConfigPaths(prevConfig, nextConfig);
  if (paths.length === 0) return;

  const key = `${id}|${paths.sort().join(",")}`;
  const now = Date.now();
  const sameBurst =
    configEditTickOpen ||
    (key === lastConfigEditKey &&
      now - lastConfigEditAt <= CONFIG_HISTORY_COALESCE_MS);

  if (!sameBurst) pushHistory();

  lastConfigEditAt = now;
  lastConfigEditKey = key;
  if (!configEditTickOpen) {
    configEditTickOpen = true;
    queueMicrotask(() => {
      configEditTickOpen = false;
    });
  }
}


export const useOverlayStore = create<OverlayEditorState>((set, get) => ({
  scene: null,
  selectedItemIds: [],
  isDirty: false,
  zoom: 0.5,
  panX: 0,
  panY: 0,
  activeTool: "select",
  history: { past: [], future: [] },
  renameRequestId: null,

  ...(() => {
    const prefs = loadCanvasPreferences();
    return {
      canvasBackground: prefs.background,
      snapToItems: prefs.snapToItems,
      grid: prefs.grid,
      rulersVisible: prefs.rulers,
      rulerCursorVisible: prefs.rulerCursor,
    };
  })(),

  setCanvasBackground: (background) => {
    saveCanvasBackground(background);
    set({ canvasBackground: background });
  },

  setSnapToItems: (axes) => {
    const next = { ...get().snapToItems, ...axes };
    saveSnapToItems(next);
    set({ snapToItems: next });
  },

  setGrid: (grid) => {
    const next = { ...get().grid, ...grid };
    next.size = clampGridSize(next.size);
    next.lineWidth = clampGridLineWidth(next.lineWidth);
    saveGridSettings(next);
    set({ grid: next });
  },

  setRulersVisible: (visible) => {
    saveRulersVisible(visible);
    set({ rulersVisible: visible });
  },

  setRulerCursorVisible: (visible) => {
    saveRulerCursor(visible);
    set({ rulerCursorVisible: visible });
  },

  setScene: (scene, options) => {
    resetConfigEditCoalescing();
    set((state) => {
      const surviving = new Set(scene.items.map((i) => i.id));
      return {
        scene,
        isDirty: false,
        // A save replaces the scene wholesale, so clearing the selection here
        // would drop the streamer out of the inspector panel they were editing.
        // Keep what still exists; callers remap temp ids before calling this.
        selectedItemIds: state.selectedItemIds.filter((id) => surviving.has(id)),
        // A save hands back the temp-N -> DB id map, so the stack is rewritten
        // onto the new ids and undo keeps working across that boundary. Loading
        // a scene passes no map and starts from an empty stack.
        history: options?.idMap
          ? remapHistory(state.history, options.idMap)
          : { past: [], future: [] },
      };
    });
  },

  selectItem: (id) => set({ selectedItemIds: id === null ? [] : [id] }),

  toggleSelectItem: (id) => {
    const { scene, selectedItemIds } = get();
    const item = scene?.items.find((i) => i.id === id);
    if (!item) return;
    // Clip children never participate in multi-selection.
    if (!isRootLayerType(item.type)) {
      set({ selectedItemIds: [id] });
      return;
    }
    const onlyRoots = selectedItemIds.filter((sid) => {
      const s = scene!.items.find((i) => i.id === sid);
      return s && isRootLayerType(s.type);
    });
    set({
      selectedItemIds: onlyRoots.includes(id)
        ? onlyRoots.filter((sid) => sid !== id)
        : [...onlyRoots, id],
    });
  },

  setSelectedItems: (ids) => set({ selectedItemIds: ids }),

  clearSelection: () => set({ selectedItemIds: [] }),

  selectClipDisplayFieldForEdit: (parentClipItemId, fieldKey) => {
    const { scene } = get();
    if (!scene) return;
    const child = scene.items.find(
      (i) =>
        i.type === "clip_display_field" &&
        asClipDisplayFieldConfig(i.config).parentClipItemId ===
          parentClipItemId &&
        asClipDisplayFieldConfig(i.config).fieldKey === fieldKey
    );
    if (child) set({ selectedItemIds: [child.id] });
  },

  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),

  setSceneResolution: (width, height, mode) => {
    const { scene, pushHistory } = get();
    if (!scene) return;
    if (scene.width === width && scene.height === height) return;

    pushHistory();
    set({
      scene: {
        ...scene,
        width,
        height,
        items:
          mode === "scale"
            ? rescaleItemsForResolution(scene.items, scene, { width, height })
            : scene.items,
      },
      isDirty: true,
    });
  },

  setPan: (x, y) => set({ panX: x, panY: y }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  markDirty: () => set({ isDirty: true }),

  markClean: () => set({ isDirty: false }),

  setRenameRequestId: (id) => set({ renameRequestId: id }),

  pushHistory: (snapshot) => {
    const { scene, history } = get();
    if (!scene) return;
    const items = snapshot ?? scene.items;
    // Skip no-op pushes (e.g. focusing an input without editing) so undo never
    // appears to do nothing; the items reference only changes when something
    // mutated, and the size only when the resolution did.
    const last = history.past[history.past.length - 1];
    if (
      last &&
      last.items === items &&
      last.width === scene.width &&
      last.height === scene.height
    ) {
      return;
    }
    const past = [
      ...history.past,
      { items, width: scene.width, height: scene.height },
    ].slice(-HISTORY_LIMIT);
    set({ history: { past, future: [] } });
  },

  undo: () => {
    const { scene, history, selectedItemIds } = get();
    if (!scene || history.past.length === 0) return;
    const previous = history.past[history.past.length - 1]!;
    const surviving = new Set(previous.items.map((i) => i.id));
    set({
      scene: {
        ...scene,
        items: previous.items,
        width: previous.width,
        height: previous.height,
      },
      history: {
        past: history.past.slice(0, -1),
        future: [
          ...history.future,
          { items: scene.items, width: scene.width, height: scene.height },
        ],
      },
      selectedItemIds: selectedItemIds.filter((id) => surviving.has(id)),
      isDirty: true,
    });
  },

  redo: () => {
    const { scene, history, selectedItemIds } = get();
    if (!scene || history.future.length === 0) return;
    const next = history.future[history.future.length - 1]!;
    const surviving = new Set(next.items.map((i) => i.id));
    set({
      scene: {
        ...scene,
        items: next.items,
        width: next.width,
        height: next.height,
      },
      history: {
        past: [
          ...history.past,
          { items: scene.items, width: scene.width, height: scene.height },
        ].slice(-HISTORY_LIMIT),
        future: history.future.slice(0, -1),
      },
      selectedItemIds: selectedItemIds.filter((id) => surviving.has(id)),
      isDirty: true,
    });
  },

  addItem: (type) => {
    const { scene, pushHistory } = get();
    if (!scene) return;

    const def = OVERLAY_WIDGET_REGISTRY[type];
    if (!def?.createRootItems) return;

    const maxZ = scene.items.reduce((max, item) => Math.max(max, item.z_index), 0);
    const newItems = def.createRootItems({ scene, nextId: nextTempId, maxZ });
    if (newItems.length === 0) return;

    pushHistory();
    set({
      scene: { ...scene, items: [...scene.items, ...newItems] },
      selectedItemIds: [newItems[0]!.id],
      isDirty: true,
    });
  },

  addCustomWidget: (widgetId) => {
    const { scene, pushHistory } = get();
    if (!scene) return;

    const def = OVERLAY_WIDGET_REGISTRY["custom_widget"];
    if (!def?.createRootItems) return;

    const maxZ = scene.items.reduce((max, item) => Math.max(max, item.z_index), 0);
    const newItems = def.createRootItems({ scene, nextId: nextTempId, maxZ });
    if (newItems.length === 0) return;

    // Patch the widget_id into the config immediately so the canvas renders it right away
    const item = { ...newItems[0]!, config: { ...newItems[0]!.config, widget_id: widgetId } };

    pushHistory();
    set({
      scene: { ...scene, items: [...scene.items, item] },
      selectedItemIds: [item.id],
      isDirty: true,
    });
  },

  updateItem: (id, updates, options) => {
    const { scene, pushHistory } = get();
    if (!scene) return;

    const target = scene.items.find((i) => i.id === id);
    if (!target) return;

    // Geometry callers push their own snapshot on gesture start; config edits
    // arrive straight from the settings panels, so history is recorded here.
    if (updates.config !== undefined && options?.history !== false) {
      recordConfigEdit(id, target.config, updates.config, pushHistory);
    }

    const nextUpdates = touchesGeometry(updates)
      ? clampGeometry(target, updates, scene)
      : updates;

    let nextItems = scene.items.map((item) =>
      item.id === id ? { ...item, ...nextUpdates } : item
    );

    const updated = nextItems.find((i) => i.id === id);
    const parentDef = updated ? getOverlayWidgetDefinition(updated.type) : undefined;
    if (
      parentDef &&
      isRootOverlayDefinition(parentDef) &&
      parentDef.syncChildGeometryFromParent &&
      (touchesGeometry(nextUpdates) || nextUpdates.z_index !== undefined)
    ) {
      nextItems = nextItems.map((ch) => {
        if (ch.type !== "clip_display_field") return ch;
        if (asClipDisplayFieldConfig(ch.config).parentClipItemId !== id) return ch;
        return {
          ...ch,
          x: updated!.x,
          y: updated!.y,
          anchor_x: updated!.anchor_x,
          anchor_y: updated!.anchor_y,
          w: updated!.w,
          h: updated!.h,
          design_w: updated!.design_w,
          design_h: updated!.design_h,
          crop_top: updated!.crop_top,
          crop_right: updated!.crop_right,
          crop_bottom: updated!.crop_bottom,
          crop_left: updated!.crop_left,
          z_index: updated!.z_index,
        };
      });
    }

    set({
      scene: { ...scene, items: nextItems },
      isDirty: true,
    });
  },

  removeItem: (id) => {
    const { scene, selectedItemIds, pushHistory } = get();
    if (!scene) return;

    const idsToRemove = cascadeIds(scene, id);

    pushHistory();
    set({
      scene: {
        ...scene,
        items: scene.items.filter((i) => !idsToRemove.has(i.id)),
      },
      selectedItemIds: selectedItemIds.filter((sid) => !idsToRemove.has(sid)),
      isDirty: true,
    });
  },

  removeSelectedItems: () => {
    const { scene, selectedItemIds, pushHistory } = get();
    if (!scene || selectedItemIds.length === 0) return;

    // A selected clip child is "deleted" by hiding it (matches layers-panel semantics).
    const single =
      selectedItemIds.length === 1
        ? scene.items.find((i) => i.id === selectedItemIds[0])
        : undefined;
    if (single && !isRootLayerType(single.type)) {
      pushHistory();
      const parentId = asClipDisplayFieldConfig(single.config).parentClipItemId;
      set({
        scene: {
          ...scene,
          items: scene.items.map((i) =>
            i.id === single.id ? { ...i, is_visible: false } : i
          ),
        },
        selectedItemIds: parentId ? [parentId] : [],
        isDirty: true,
      });
      return;
    }

    const idsToRemove = new Set<string>();
    for (const id of selectedItemIds) {
      const item = scene.items.find((i) => i.id === id);
      if (!item || !isRootLayerType(item.type)) continue;
      for (const rid of cascadeIds(scene, id)) idsToRemove.add(rid);
    }
    if (idsToRemove.size === 0) return;

    pushHistory();
    set({
      scene: {
        ...scene,
        items: scene.items.filter((i) => !idsToRemove.has(i.id)),
      },
      selectedItemIds: [],
      isDirty: true,
    });
  },

  duplicateItem: (id) => {
    const { scene, pushHistory } = get();
    if (!scene) return;

    const maxZ = scene.items.reduce((max, item) => Math.max(max, item.z_index), 0);
    const dup = buildDuplicate(scene, id, maxZ);
    if (!dup) return;

    pushHistory();
    set({
      scene: { ...scene, items: [...scene.items, ...dup.items] },
      selectedItemIds: [dup.parentId],
      isDirty: true,
    });
  },

  duplicateSelectedItems: () => {
    const { scene, selectedItemIds, pushHistory } = get();
    if (!scene || selectedItemIds.length === 0) return;

    let items = scene.items;
    let maxZ = items.reduce((max, item) => Math.max(max, item.z_index), 0);
    const newSelection: string[] = [];
    const added: OverlayItem[] = [];

    for (const id of selectedItemIds) {
      const dup = buildDuplicate({ ...scene, items }, id, maxZ);
      if (!dup) continue;
      added.push(...dup.items);
      items = [...items, ...dup.items];
      newSelection.push(dup.parentId);
      maxZ += 1;
    }
    if (added.length === 0) return;

    pushHistory();
    set({
      scene: { ...scene, items },
      selectedItemIds: newSelection,
      isDirty: true,
    });
  },

  nudgeSelected: (dx, dy) => {
    const { scene, selectedItemIds, pushHistory, updateItem } = get();
    if (!scene || selectedItemIds.length === 0) return;

    const movable = selectedItemIds
      .map((id) => scene.items.find((i) => i.id === id))
      .filter(
        (i): i is OverlayItem =>
          !!i && isRootLayerType(i.type) && !i.is_locked
      );
    if (movable.length === 0) return;

    // Holding an arrow key produces one history entry per burst, not per press.
    const now = Date.now();
    if (now - lastNudgeAt > NUDGE_HISTORY_COALESCE_MS) {
      pushHistory();
    }
    lastNudgeAt = now;

    // Arrow keys move on screen, so the step is applied to the absolute
    // position: bumping a right-anchored offset would send it the wrong way.
    for (const item of movable) {
      const position = resolveAnchoredPosition(item, scene);
      updateItem(
        item.id,
        fromAbsoluteGeometry(item, { x: position.x + dx, y: position.y + dy }, scene)
      );
    }
  },

  alignSelected: (edge) => {
    const { scene, applyLayoutUpdates, selectedRootItems, pushHistory, updateItem } = get();
    if (!scene) return;
    const items = selectedRootItems();
    if (items.length === 0) return;

    // A lone item is pinned to the scene edge, same as the inspector's scene
    // layout tools, so it stays there when the resolution changes. Two or more
    // align to each other, which is a plain move.
    if (items.length === 1) {
      const item = items[0]!;
      if (item.is_locked) return;
      pushHistory();
      updateItem(item.id, pinToSceneEdge(edge));
      return;
    }

    const bounds = selectionBounds(items);
    if (!bounds) return;
    applyLayoutUpdates(alignUpdates(items, edge, bounds));
  },

  distributeSelected: (axis) => {
    const { applyLayoutUpdates, selectedRootItems } = get();
    applyLayoutUpdates(distributeUpdates(selectedRootItems(), axis));
  },

  matchSizeSelected: (dimension) => {
    const { applyLayoutUpdates, selectedItemIds, selectedRootItems } = get();
    const primaryId = selectedItemIds[0];
    if (!primaryId) return;
    applyLayoutUpdates(matchSizeUpdates(selectedRootItems(), primaryId, dimension));
  },

  flipSelected: (axis) => {
    const { applyLayoutUpdates, selectedRootItems } = get();
    applyLayoutUpdates(flipUpdates(selectedRootItems(), axis));
  },

  /**
   * The selected items that can actually be laid out; clip children can't.
   * Positions are absolute so the layout maths can read rects straight off
   * them; `applyLayoutUpdates` converts the results back.
   */
  selectedRootItems: () => {
    const { scene, selectedItemIds } = get();
    if (!scene) return [];
    return selectedItemIds
      .map((id) => scene.items.find((i) => i.id === id))
      .filter((i): i is OverlayItem => !!i && isRootLayerType(i.type))
      .map((i) => withAbsolutePosition(i, scene));
  },

  /** One snapshot for the whole operation, then the moves. */
  applyLayoutUpdates: (updates) => {
    if (updates.length === 0) return;
    const { scene, pushHistory, updateItem } = get();
    if (!scene) return;
    pushHistory();
    for (const { id, updates: patch } of updates) {
      const item = scene.items.find((i) => i.id === id);
      if (!item) continue;
      updateItem(id, fromAbsoluteGeometry(item, patch, scene));
    }
  },

  reorderItem: (id, direction) => {
    const { scene, pushHistory } = get();
    if (!scene) return;

    const item = scene.items.find((i) => i.id === id);
    if (!item || !isRootLayerType(item.type)) return;

    const roots = scene.items
      .filter((i) => isRootLayerType(i.type))
      .sort((a, b) => b.z_index - a.z_index);
    const idx = roots.findIndex((r) => r.id === id);
    if (idx === -1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= roots.length) return;

    const order = roots.map((r) => r.id);
    [order[idx], order[swapIdx]] = [order[swapIdx]!, order[idx]!];

    pushHistory();
    set({
      scene: { ...scene, items: applyLayerOrder(scene.items, order) },
      isDirty: true,
    });
  },

  setLayerOrder: (orderedIdsTopFirst) => {
    const { scene, pushHistory } = get();
    if (!scene) return;

    pushHistory();
    set({
      scene: { ...scene, items: applyLayerOrder(scene.items, orderedIdsTopFirst) },
      isDirty: true,
    });
  },

  bringToFront: (id) => {
    const { scene, setLayerOrder } = get();
    if (!scene) return;
    const order = scene.items
      .filter((i) => isRootLayerType(i.type))
      .sort((a, b) => b.z_index - a.z_index)
      .map((i) => i.id)
      .filter((iid) => iid !== id);
    setLayerOrder([id, ...order]);
  },

  sendToBack: (id) => {
    const { scene, setLayerOrder } = get();
    if (!scene) return;
    const order = scene.items
      .filter((i) => isRootLayerType(i.type))
      .sort((a, b) => b.z_index - a.z_index)
      .map((i) => i.id)
      .filter((iid) => iid !== id);
    setLayerOrder([...order, id]);
  },

  renameItem: (id, label) => {
    const { scene, pushHistory } = get();
    if (!scene) return;
    pushHistory();
    set({
      scene: {
        ...scene,
        items: scene.items.map((i) => (i.id === id ? { ...i, label } : i)),
      },
      isDirty: true,
    });
  },

  toggleItemVisibility: (id) => {
    const { scene, pushHistory } = get();
    if (!scene) return;

    pushHistory();
    set({
      scene: {
        ...scene,
        items: scene.items.map((item) =>
          item.id === id ? { ...item, is_visible: !item.is_visible } : item
        ),
      },
      isDirty: true,
    });
  },

  toggleItemLock: (id) => {
    const { scene, pushHistory } = get();
    if (!scene) return;

    pushHistory();
    set({
      scene: {
        ...scene,
        items: scene.items.map((item) =>
          item.id === id ? { ...item, is_locked: !item.is_locked } : item
        ),
      },
      isDirty: true,
    });
  },

  editorClipPreviewPaused: false,
  setEditorClipPreviewPaused: (paused) =>
    set({
      editorClipPreviewPaused: paused,
      ...(!paused ? { editorClipPreviewAutoplayBlocked: false } : {}),
    }),

  editorClipPreviewForceMute: false,
  setEditorClipPreviewForceMute: (forceMute) =>
    set({ editorClipPreviewForceMute: forceMute }),

  editorClipPreviewAutoplayBlocked: false,
  setEditorClipPreviewAutoplayBlocked: (blocked) =>
    set({ editorClipPreviewAutoplayBlocked: blocked }),

  editorClipPreviewResumeTick: 0,
  bumpEditorClipPreviewResume: () =>
    set((s) => ({ editorClipPreviewResumeTick: s.editorClipPreviewResumeTick + 1 })),

  attemptEditorClipPreviewUnblock: () =>
    set((s) => ({
      editorClipPreviewAutoplayBlocked: false,
      editorClipPreviewPaused: false,
      editorClipPreviewResumeTick: s.editorClipPreviewResumeTick + 1,
    })),

  demoFireMode: "local",
  setDemoFireMode: (mode) => set({ demoFireMode: mode }),

  demoEvent: null,
  emitDemoEvent: (listener, event) =>
    set((s) => ({
      demoEvent: { listener, event, seq: (s.demoEvent?.seq ?? 0) + 1 },
    })),

  runningSimulatorIds: [],
  setRunningSimulatorIds: (ids) => set({ runningSimulatorIds: ids }),
}));
