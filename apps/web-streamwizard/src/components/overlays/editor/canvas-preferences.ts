/**
 * Design-time canvas settings.
 *
 * These are the streamer's own working preferences, not part of the overlay:
 * they live in localStorage alongside the editor mode, follow the user across
 * every scene, and never reach the database or the live output.
 */

export type CanvasBackground = "dark" | "checker" | "light" | "grey" | "green";

/** Which axes a kind of snapping acts on. `x` is left/right, `y` is up/down. */
export interface SnapAxes {
  x: boolean;
  y: boolean;
}

export interface GridSettings {
  visible: boolean;
  /** Spacing in scene px. */
  size: number;
  /** Snap dragged items to the grid as well as to each other. */
  snap: boolean;
  /** Line colour as #rgb or #rrggbb. */
  color: string;
  /** Line thickness in screen px, so it stays constant as you zoom. */
  lineWidth: number;
}

export interface CanvasPreferences {
  background: CanvasBackground;
  /**
   * Snap dragged items to other items' edges and centres, per axis. Turning one
   * off lets you line a row up horizontally without it grabbing vertically too.
   */
  snapToItems: SnapAxes;
  grid: GridSettings;
  rulers: boolean;
  /** Track the pointer along the rulers. Only means anything while they are on. */
  rulerCursor: boolean;
}

export const CANVAS_BACKGROUND_KEY = "overlay-editor-canvas-background";
export const CANVAS_GRID_KEY = "overlay-editor-canvas-grid";
export const CANVAS_RULERS_KEY = "overlay-editor-canvas-rulers";
export const CANVAS_RULER_CURSOR_KEY = "overlay-editor-canvas-ruler-cursor";
export const CANVAS_SNAP_ITEMS_KEY = "overlay-editor-snap-to-items";

export const GRID_SIZE_MIN = 5;
export const GRID_SIZE_MAX = 500;
export const GRID_LINE_WIDTH_MIN = 1;
export const GRID_LINE_WIDTH_MAX = 6;

/** A muted grey reads on both a dark canvas and a light one. */
export const DEFAULT_GRID_COLOR = "#8a8a8a";

/** Grid colours worth one click; anything else goes through the colour input. */
export const GRID_COLOR_PRESETS = [
  DEFAULT_GRID_COLOR,
  "#ffffff",
  "#000000",
  "#22d3ee",
  "#f472b6",
] as const;

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value);
}

export function clampGridLineWidth(width: number): number {
  if (!Number.isFinite(width)) return GRID_LINE_WIDTH_MIN;
  return Math.min(GRID_LINE_WIDTH_MAX, Math.max(GRID_LINE_WIDTH_MIN, Math.round(width)));
}

export const DEFAULT_CANVAS_PREFERENCES: CanvasPreferences = {
  // Checkerboard shows transparency the way it will look in OBS.
  background: "checker",
  // On: it was always on before there was a switch for it.
  snapToItems: { x: true, y: true },
  grid: {
    visible: false,
    size: 50,
    snap: false,
    color: DEFAULT_GRID_COLOR,
    lineWidth: 1,
  },
  rulers: false,
  // On by default: someone who turned the rulers on wants to read positions off
  // them, and the marker is the fastest way to do that.
  rulerCursor: true,
};

export const CANVAS_BACKGROUND_LABELS: Record<CanvasBackground, string> = {
  dark: "Dark",
  checker: "Checkerboard",
  light: "Light",
  grey: "Grey",
  green: "Green",
};

function readKey(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // A browser refusing storage still gets a working editor, just a forgetful one.
  }
}

export function isCanvasBackground(value: unknown): value is CanvasBackground {
  return (
    value === "dark" ||
    value === "checker" ||
    value === "light" ||
    value === "grey" ||
    value === "green"
  );
}

export function parseGridSettings(raw: string | null): GridSettings {
  const fallback = DEFAULT_CANVAS_PREFERENCES.grid;
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return fallback;
    const grid = parsed as Partial<GridSettings>;
    return {
      visible: typeof grid.visible === "boolean" ? grid.visible : fallback.visible,
      size: clampGridSize(typeof grid.size === "number" ? grid.size : fallback.size),
      snap: typeof grid.snap === "boolean" ? grid.snap : fallback.snap,
      color: isHexColor(grid.color) ? grid.color : fallback.color,
      lineWidth: clampGridLineWidth(
        typeof grid.lineWidth === "number" ? grid.lineWidth : fallback.lineWidth
      ),
    };
  } catch {
    return fallback;
  }
}

export function clampGridSize(size: number): number {
  if (!Number.isFinite(size)) return DEFAULT_CANVAS_PREFERENCES.grid.size;
  return Math.min(GRID_SIZE_MAX, Math.max(GRID_SIZE_MIN, Math.round(size)));
}

export function loadCanvasPreferences(): CanvasPreferences {
  const background = readKey(CANVAS_BACKGROUND_KEY);
  return {
    background: isCanvasBackground(background)
      ? background
      : DEFAULT_CANVAS_PREFERENCES.background,
    snapToItems: parseSnapAxes(readKey(CANVAS_SNAP_ITEMS_KEY)),
    grid: parseGridSettings(readKey(CANVAS_GRID_KEY)),
    rulers: readKey(CANVAS_RULERS_KEY) === "true",
    // Absent means never set, which should read as the default rather than off.
    rulerCursor: readKey(CANVAS_RULER_CURSOR_KEY) !== "false",
  };
}

export function saveCanvasBackground(background: CanvasBackground) {
  writeKey(CANVAS_BACKGROUND_KEY, background);
}

export function saveGridSettings(grid: GridSettings) {
  writeKey(CANVAS_GRID_KEY, JSON.stringify(grid));
}

export function saveRulersVisible(visible: boolean) {
  writeKey(CANVAS_RULERS_KEY, String(visible));
}

/**
 * Reads the per-axis setting, accepting the plain boolean this used to be
 * stored as so nobody's saved preference is lost by the upgrade. Absent means
 * never set, which should read as the default rather than off.
 */
export function parseSnapAxes(raw: string | null): SnapAxes {
  const fallback = DEFAULT_CANVAS_PREFERENCES.snapToItems;
  if (raw === null) return fallback;
  if (raw === "true") return { x: true, y: true };
  if (raw === "false") return { x: false, y: false };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return fallback;
    const axes = parsed as Partial<SnapAxes>;
    return {
      x: typeof axes.x === "boolean" ? axes.x : fallback.x,
      y: typeof axes.y === "boolean" ? axes.y : fallback.y,
    };
  } catch {
    return fallback;
  }
}

export function saveSnapToItems(axes: SnapAxes) {
  writeKey(CANVAS_SNAP_ITEMS_KEY, JSON.stringify(axes));
}

export function saveRulerCursor(visible: boolean) {
  writeKey(CANVAS_RULER_CURSOR_KEY, String(visible));
}

/** Every step the rulers are allowed to use, coarsest last. */
const RULER_STEPS = [10, 25, 50, 100, 250, 500, 1000, 2500] as const;

/**
 * Scene-px spacing between ruler labels at a given zoom.
 *
 * Picks the finest step whose on-screen gap still clears `minGapPx`, so zooming
 * out thins the labels out instead of smearing them into each other.
 */
export function rulerStep(zoom: number, minGapPx: number = 64): number {
  const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  for (const step of RULER_STEPS) {
    if (step * scale >= minGapPx) return step;
  }
  return RULER_STEPS[RULER_STEPS.length - 1];
}

/**
 * Tick positions in scene px, always ending on the scene's own edge.
 *
 * A 1080-high scene stepping by 250 would otherwise stop at 1000 and leave the
 * streamer to guess where 1080 is — the number they actually care about is the
 * one that matches their OBS canvas. The tick before it is dropped when the two
 * would collide.
 */
export function rulerTicks(
  length: number,
  step: number,
  minEndGapRatio: number = 0.5
): number[] {
  if (step <= 0 || length <= 0) return [];

  const ticks: number[] = [];
  for (let position = 0; position < length; position += step) ticks.push(position);

  const last = ticks[ticks.length - 1];
  if (ticks.length > 1 && last !== undefined && length - last < step * minEndGapRatio) {
    ticks.pop();
  }
  ticks.push(length);

  return ticks;
}

/** Nearest multiple of `size`, for snap-to-grid. */
export function snapToGrid(value: number, size: number): number {
  if (size <= 0) return value;
  return Math.round(value / size) * size;
}
