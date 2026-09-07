/** Zoom bounds for the editor canvas. The readout shows 10% to 200%. */
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 2;

/** Breathing room around the scene when fitting, in screen px. */
export const FIT_MARGIN_PX = 32;

interface Point {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

/**
 * The zoom that shows the whole scene inside the pane, with a margin.
 *
 * Takes the tighter of the two axes so nothing is cropped, and clamps like
 * every other zoom path — a scene far larger than the pane lands on the minimum
 * rather than failing. A pane that hasn't been laid out yet (zero width or
 * height) leaves the zoom alone by returning the current one.
 */
export function computeFitZoom(
  pane: Size,
  scene: Size,
  currentZoom: number,
  marginPx: number = FIT_MARGIN_PX
): number {
  if (pane.width <= 0 || pane.height <= 0) return currentZoom;
  if (scene.width <= 0 || scene.height <= 0) return currentZoom;

  const availableW = pane.width - marginPx * 2;
  const availableH = pane.height - marginPx * 2;
  if (availableW <= 0 || availableH <= 0) return ZOOM_MIN;

  return clampZoom(Math.min(availableW / scene.width, availableH / scene.height));
}

/** Multiplier per notch of a mouse wheel. */
export const WHEEL_ZOOM_STEP = 1.1;

/** What one notch of a mouse wheel reports as deltaY in Chrome and Firefox. */
export const WHEEL_NOTCH_PX = 100;

/**
 * Where the wheel lands. Proportional to the delta rather than one step per
 * event: a mouse notch is a full step, while a trackpad pinch arrives as a
 * stream of tiny deltas and would leap a whole step on each of them.
 */
export function wheelZoom(zoom: number, deltaY: number, step: number = WHEEL_ZOOM_STEP): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return clampZoom(zoom);
  return clampZoom(zoom * Math.pow(step, -deltaY / WHEEL_NOTCH_PX));
}

/** The pan that centres a canvas of the given screen size in the pane. */
export function centerPan(pane: Size, canvas: Size): Point {
  return {
    x: (pane.width - canvas.width) / 2,
    y: (pane.height - canvas.height) / 2,
  };
}

/**
 * The pan that keeps one scene point fixed on screen across a zoom change.
 *
 * `focal` is pane-relative: the cursor, measured from the pane's top-left. The
 * scene point under it sits `(focal - pan)` screen px from the canvas origin;
 * that distance scales with the zoom ratio, and what's left over is the pan.
 */
export function zoomAboutPoint(pan: Point, zoom: number, nextZoom: number, focal: Point): Point {
  const ratio = nextZoom / zoom;
  return {
    x: focal.x - (focal.x - pan.x) * ratio,
    y: focal.y - (focal.y - pan.y) * ratio,
  };
}

/** How much of the canvas must stay inside the pane, in screen px. */
export const MIN_VISIBLE_PX = 48;

/**
 * Keeps at least a sliver of the canvas inside the pane on both axes.
 *
 * Photoshop's rule: you can push the canvas most of the way out of view, never
 * all of it, so there is always something left to grab and drag back.
 */
export function clampPan(
  pan: Point,
  pane: Size,
  canvas: Size,
  minVisiblePx: number = MIN_VISIBLE_PX
): Point {
  const clampAxis = (value: number, paneSize: number, canvasSize: number) => {
    const visible = Math.min(minVisiblePx, canvasSize, paneSize);
    const min = visible - canvasSize;
    const max = paneSize - visible;
    return Math.min(max, Math.max(min, value));
  };
  return {
    x: clampAxis(pan.x, pane.width, canvas.width),
    y: clampAxis(pan.y, pane.height, canvas.height),
  };
}
