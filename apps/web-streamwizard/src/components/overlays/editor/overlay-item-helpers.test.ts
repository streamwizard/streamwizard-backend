import { expect, test } from "bun:test";
import { resolveAnchoredPosition } from "@repo/ui/overlay";
import {
  clampGeometry,
  fromAbsoluteGeometry,
  pinToSceneEdge,
  reanchorInPlace,
} from "./overlay-item-helpers";
import type { OverlayItem } from "@/types/overlays";

const scene = { width: 1920, height: 1080 };

function makeItem(extra: Partial<OverlayItem> = {}): OverlayItem {
  return {
    id: "a",
    scene_id: "scene-1",
    type: "text_widget",
    x: 100,
    y: 100,
    anchor_x: "left",
    anchor_y: "top",
    w: 400,
    h: 200,
    design_w: 400,
    design_h: 200,
    crop_top: 0,
    crop_right: 0,
    crop_bottom: 0,
    crop_left: 0,
    z_index: 1,
    rotation: 0,
    flip_h: false,
    flip_v: false,
    opacity: 1,
    is_visible: true,
    is_locked: false,
    label: "Text",
    config: {} as OverlayItem["config"],
    ...extra,
  };
}

test("clamp keeps a top-left item inside the scene as before", () => {
  const item = makeItem();
  expect(clampGeometry(item, { x: -10, y: 2000 }, scene)).toMatchObject({ x: 0, y: 880 });
});

test("clamp works on the resolved rect, so a right-pinned item stops at the left edge", () => {
  const item = makeItem({ anchor_x: "right", x: 0 });
  // An offset of 1600 from the right would put the left edge at -80.
  const next = clampGeometry(item, { x: 1600 }, scene);
  expect(next.x).toBe(1520);
  expect(resolveAnchoredPosition({ ...item, ...next }, scene).x).toBe(0);
});

test("clamp never pushes a pinned item past its own edge", () => {
  const item = makeItem({ anchor_y: "bottom", y: 0 });
  expect(clampGeometry(item, { y: -50 }, scene).y).toBe(0);
});

test("clamp reads the offset from the new anchor when a patch changes both", () => {
  const item = makeItem();
  const next = clampGeometry(item, { anchor_x: "right", x: 0 }, scene);
  expect(next).toMatchObject({ anchor_x: "right", x: 0 });
  expect(resolveAnchoredPosition({ ...item, ...next }, scene).x).toBe(1520);
});

test("fromAbsoluteGeometry turns a screen position into the pinned offset", () => {
  const item = makeItem({ anchor_x: "right", anchor_y: "bottom", x: 0, y: 0 });
  expect(fromAbsoluteGeometry(item, { x: 1500, y: 870 }, scene)).toEqual({ x: 20, y: 10 });
});

test("fromAbsoluteGeometry uses the patch's own size for a resize", () => {
  const item = makeItem({ anchor_x: "right", x: 20 });
  // Dragging the west handle 100px left: the box is wider and starts further left,
  // so its right edge, and therefore the offset, has not moved.
  const next = fromAbsoluteGeometry(item, { x: 1400, w: 500 }, scene);
  expect(next).toEqual({ x: 20, w: 500 });
});

test("fromAbsoluteGeometry leaves a patch without a position alone", () => {
  const item = makeItem({ anchor_x: "right" });
  const patch = { w: 300, h: 150 };
  expect(fromAbsoluteGeometry(item, patch, scene)).toBe(patch);
});

test("pinning to an edge moves the anchor and zeroes the offset", () => {
  expect(pinToSceneEdge("right")).toEqual({ anchor_x: "right", x: 0 });
  expect(pinToSceneEdge("vcenter")).toEqual({ anchor_y: "center", y: 0 });
});

test("re-anchoring in place changes the offset but not where the item is", () => {
  const item = makeItem({ x: 1500, y: 870 });
  const next = reanchorInPlace(item, { anchor_x: "right", anchor_y: "bottom" }, scene);
  expect(next).toEqual({ anchor_x: "right", anchor_y: "bottom", x: 20, y: 10 });
  expect(resolveAnchoredPosition({ ...item, ...next }, scene)).toEqual({ x: 1500, y: 870 });
});
