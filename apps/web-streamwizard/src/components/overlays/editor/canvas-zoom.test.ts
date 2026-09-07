import { expect, test } from "bun:test";
import {
  MIN_VISIBLE_PX,
  ZOOM_MAX,
  ZOOM_MIN,
  centerPan,
  clampPan,
  clampZoom,
  computeFitZoom,
  wheelZoom,
  zoomAboutPoint,
} from "./canvas-zoom";

const scene = { width: 1920, height: 1080 };

test("zoom clamps to the editor's range", () => {
  expect(clampZoom(5)).toBe(ZOOM_MAX);
  expect(clampZoom(0.01)).toBe(ZOOM_MIN);
  expect(clampZoom(0.75)).toBe(0.75);
  expect(clampZoom(Number.NaN)).toBe(1);
});

test("fit takes the tighter axis so nothing is cropped", () => {
  // Wide pane: height is the constraint. (600 - 64) / 1080.
  expect(computeFitZoom({ width: 2000, height: 600 }, scene, 1)).toBeCloseTo(536 / 1080, 5);
  // Tall pane: width is the constraint. (1000 - 64) / 1920.
  expect(computeFitZoom({ width: 1000, height: 2000 }, scene, 1)).toBeCloseTo(936 / 1920, 5);
});

test("fit leaves the margin free on both sides", () => {
  const zoom = computeFitZoom({ width: 1000, height: 2000 }, scene, 1, 100);
  expect(zoom).toBeCloseTo(800 / 1920, 5);
});

test("a scene far bigger than the pane lands on the minimum, not a failure", () => {
  const huge = { width: 100_000, height: 100_000 };
  expect(computeFitZoom({ width: 800, height: 600 }, huge, 1)).toBe(ZOOM_MIN);
});

test("a tiny scene is capped at the maximum", () => {
  const tiny = { width: 10, height: 10 };
  expect(computeFitZoom({ width: 800, height: 600 }, tiny, 1)).toBe(ZOOM_MAX);
});

test("an unmeasured pane leaves the zoom alone", () => {
  expect(computeFitZoom({ width: 0, height: 0 }, scene, 0.7)).toBe(0.7);
});

test("a pane smaller than its own margins falls back to the minimum", () => {
  expect(computeFitZoom({ width: 40, height: 40 }, scene, 1)).toBe(ZOOM_MIN);
});

test("a wheel notch up zooms in, down zooms out", () => {
  expect(wheelZoom(1, -100, 1.1)).toBeCloseTo(1.1, 5);
  expect(wheelZoom(1, 100, 1.1)).toBeCloseTo(1 / 1.1, 5);
});

test("a trackpad pinch delta is a fraction of a notch, not a whole one", () => {
  expect(wheelZoom(1, -10, 1.1)).toBeCloseTo(Math.pow(1.1, 0.1), 5);
  expect(wheelZoom(1, 0)).toBe(1);
});

test("wheel zoom respects the same bounds as everything else", () => {
  expect(wheelZoom(ZOOM_MAX, -100)).toBe(ZOOM_MAX);
  expect(wheelZoom(ZOOM_MIN, 100)).toBe(ZOOM_MIN);
});

test("centring puts the canvas in the middle of the pane", () => {
  expect(centerPan({ width: 1000, height: 800 }, { width: 400, height: 300 })).toEqual({ x: 300, y: 250 });
});

test("centring a canvas bigger than the pane goes negative, so the middle shows", () => {
  expect(centerPan({ width: 1000, height: 800 }, { width: 2000, height: 1600 })).toEqual({ x: -500, y: -400 });
});

test("zooming about a point keeps that point under the cursor", () => {
  // Cursor at 500 with the canvas at 100 and zoom 1: scene point 400.
  const pan = zoomAboutPoint({ x: 100, y: 50 }, 1, 2, { x: 500, y: 250 });
  // At zoom 2 the same scene point must still land on 500: pan + 400 * 2.
  expect(pan.x + 400 * 2).toBeCloseTo(500, 5);
  expect(pan.y + 200 * 2).toBeCloseTo(250, 5);
});

test("zooming about a point without changing zoom changes nothing", () => {
  expect(zoomAboutPoint({ x: 100, y: 50 }, 1, 1, { x: 500, y: 250 })).toEqual({ x: 100, y: 50 });
});

test("clamping keeps a sliver of the canvas inside the pane", () => {
  const pane = { width: 1000, height: 800 };
  const canvas = { width: 2000, height: 1600 };
  // Pushed off to the right and bottom.
  expect(clampPan({ x: 5000, y: 5000 }, pane, canvas)).toEqual({
    x: 1000 - MIN_VISIBLE_PX,
    y: 800 - MIN_VISIBLE_PX,
  });
  // Pushed off to the left and top.
  expect(clampPan({ x: -5000, y: -5000 }, pane, canvas)).toEqual({
    x: MIN_VISIBLE_PX - 2000,
    y: MIN_VISIBLE_PX - 1600,
  });
});

test("clamping leaves a pan that is already in view alone", () => {
  const pane = { width: 1000, height: 800 };
  expect(clampPan({ x: 300, y: 250 }, pane, { width: 400, height: 300 })).toEqual({ x: 300, y: 250 });
});

test("a canvas smaller than the visible minimum is kept fully inside", () => {
  const pane = { width: 1000, height: 800 };
  const canvas = { width: 20, height: 20 };
  expect(clampPan({ x: 5000, y: -5000 }, pane, canvas)).toEqual({ x: 980, y: 0 });
});
