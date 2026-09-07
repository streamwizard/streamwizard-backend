import { beforeEach, expect, test } from "bun:test";
import {
  DEFAULT_CANVAS_PREFERENCES,
  clampGridSize,
  isCanvasBackground,
  loadCanvasPreferences,
  parseGridSettings,
  parseSnapAxes,
  rulerStep,
  rulerTicks,
  saveCanvasBackground,
  saveGridSettings,
  DEFAULT_GRID_COLOR,
  clampGridLineWidth,
  isHexColor,
  saveRulerCursor,
  saveSnapToItems,
  saveRulersVisible,
  snapToGrid,
} from "./canvas-preferences";

function installLocalStorage() {
  const rows = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => rows.get(key) ?? null,
      setItem: (key: string, value: string) => void rows.set(key, value),
      removeItem: (key: string) => void rows.delete(key),
    },
  };
  return rows;
}

beforeEach(() => {
  installLocalStorage();
});

test("preferences default to a checkerboard with the grid hidden", () => {
  const prefs = loadCanvasPreferences();
  expect(prefs).toEqual(DEFAULT_CANVAS_PREFERENCES);
});

test("saved preferences come back after a reload", () => {
  saveCanvasBackground("dark");
  saveSnapToItems({ x: false, y: true });
  saveGridSettings({
    visible: true,
    size: 25,
    snap: true,
    color: "#22d3ee",
    lineWidth: 2,
  });
  saveRulersVisible(true);

  expect(loadCanvasPreferences()).toEqual({
    background: "dark",
    snapToItems: { x: false, y: true },
    grid: { visible: true, size: 25, snap: true, color: "#22d3ee", lineWidth: 2 },
    rulers: true,
    rulerCursor: true,
  });
});

test("snapping to other widgets is on for both axes by default", () => {
  expect(loadCanvasPreferences().snapToItems).toEqual({ x: true, y: true });
});

test("each snapping axis is remembered on its own", () => {
  saveSnapToItems({ x: false, y: true });
  expect(loadCanvasPreferences().snapToItems).toEqual({ x: false, y: true });
});

test("the boolean this used to be stored as still loads", () => {
  // Anyone who turned snapping off before it went per-axis keeps that choice.
  expect(parseSnapAxes("false")).toEqual({ x: false, y: false });
  expect(parseSnapAxes("true")).toEqual({ x: true, y: true });
  expect(parseSnapAxes(null)).toEqual({ x: true, y: true });
  expect(parseSnapAxes("{not json")).toEqual({ x: true, y: true });
  expect(parseSnapAxes(JSON.stringify({ x: false }))).toEqual({ x: false, y: true });
});

test("the ruler cursor is on unless it was explicitly turned off", () => {
  expect(loadCanvasPreferences().rulerCursor).toBe(true);
  saveRulerCursor(false);
  expect(loadCanvasPreferences().rulerCursor).toBe(false);
  saveRulerCursor(true);
  expect(loadCanvasPreferences().rulerCursor).toBe(true);
});

test("a background value that is not one of ours falls back", () => {
  expect(isCanvasBackground("magenta")).toBe(false);
  (globalThis as { window: { localStorage: Storage } }).window.localStorage.setItem(
    "overlay-editor-canvas-background",
    "magenta"
  );
  expect(loadCanvasPreferences().background).toBe("checker");
});

test("junk grid settings fall back rather than throwing", () => {
  expect(parseGridSettings("{not json")).toEqual(DEFAULT_CANVAS_PREFERENCES.grid);
  expect(parseGridSettings(null)).toEqual(DEFAULT_CANVAS_PREFERENCES.grid);
});

test("a partial grid setting keeps the defaults for what is missing", () => {
  expect(parseGridSettings(JSON.stringify({ size: 20 }))).toEqual({
    visible: false,
    size: 20,
    snap: false,
    color: DEFAULT_GRID_COLOR,
    lineWidth: 1,
  });
});

test("a colour that is not a hex value falls back", () => {
  expect(isHexColor("#fff")).toBe(true);
  expect(isHexColor("#22d3ee")).toBe(true);
  expect(isHexColor("rebeccapurple")).toBe(false);
  expect(isHexColor("#12345")).toBe(false);
  expect(parseGridSettings(JSON.stringify({ color: "javascript:alert(1)" })).color).toBe(
    DEFAULT_GRID_COLOR
  );
});

test("line width is clamped to something drawable", () => {
  expect(clampGridLineWidth(0)).toBe(1);
  expect(clampGridLineWidth(99)).toBe(6);
  expect(clampGridLineWidth(2.6)).toBe(3);
  expect(parseGridSettings(JSON.stringify({ lineWidth: 40 })).lineWidth).toBe(6);
});

test("grid size is clamped to something usable", () => {
  expect(clampGridSize(0)).toBe(5);
  expect(clampGridSize(9999)).toBe(500);
  expect(clampGridSize(33.4)).toBe(33);
});

test("ruler labels thin out as you zoom away", () => {
  expect(rulerStep(1, 64)).toBe(100);
  // 250 would only be 62.5px apart at quarter zoom, so it steps up to 500.
  expect(rulerStep(0.25, 64)).toBe(500);
  expect(rulerStep(0.25, 60)).toBe(250);
  expect(rulerStep(0.1, 64)).toBe(1000);
  expect(rulerStep(2, 64)).toBe(50);
});

test("ticks run from zero to the far edge", () => {
  expect(rulerTicks(400, 100)).toEqual([0, 100, 200, 300, 400]);
  expect(rulerTicks(0, 100)).toEqual([]);
  expect(rulerTicks(400, 0)).toEqual([]);
});

test("a 1080p scene ends on 1920 and 1080, not on the round step below", () => {
  expect(rulerTicks(1920, 250)).toEqual([0, 250, 500, 750, 1000, 1250, 1500, 1750, 1920]);
  // 1000 is only 80 from the end, so it yields rather than crowd the 1080.
  expect(rulerTicks(1080, 250)).toEqual([0, 250, 500, 750, 1080]);
});

test("the edge label never collides with the tick before it", () => {
  // 1900 sits 20 from 1920 at a 100 step, so it is dropped.
  expect(rulerTicks(1920, 100).slice(-2)).toEqual([1800, 1920]);
});

test("snapping goes to the nearest multiple", () => {
  expect(snapToGrid(112, 50)).toBe(100);
  expect(snapToGrid(138, 50)).toBe(150);
  expect(snapToGrid(-12, 50)).toBe(-0);
  expect(snapToGrid(42, 0)).toBe(42);
});
