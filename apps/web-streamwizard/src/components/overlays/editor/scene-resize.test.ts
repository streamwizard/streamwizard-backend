import { expect, test } from "bun:test";
import {
  describeResolutionChange,
  rescaleItemsForResolution,
  resolutionScale,
} from "./scene-resize";
import type { OverlayItem } from "@/types/overlays";
import { resolveAnchoredPosition } from "@repo/ui/overlay";

function makeItem(rect: { x: number; y: number; w: number; h: number }): OverlayItem {
  return {
    id: "a",
    scene_id: "scene-1",
    type: "text_widget",
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    design_w: rect.w,
    design_h: rect.h,
    crop_top: 0,
    crop_right: 0,
    crop_bottom: 0,
    crop_left: 0,
    anchor_x: "left",
    anchor_y: "top",
    z_index: 1,
    rotation: 0,
    flip_h: false,
    flip_v: false,
    opacity: 1,
    is_visible: true,
    is_locked: false,
    label: "Text",
    config: {} as OverlayItem["config"],
  };
}

const hd = { width: 1920, height: 1080 };
const qhd = { width: 2560, height: 1440 };

test("a uniform change scales by the ratio on both axes", () => {
  expect(resolutionScale(hd, qhd)).toBeCloseTo(4 / 3, 5);
});

test("a non-uniform change takes the tighter ratio so nothing overflows", () => {
  // 1920x1080 into 1080x1920: width is the constraint at 0.5625.
  expect(resolutionScale(hd, { width: 1080, height: 1920 })).toBeCloseTo(0.5625, 5);
});

test("1080p to 1440p keeps the layout proportionally identical", () => {
  const items = [makeItem({ x: 960, y: 540, w: 400, h: 200 })];
  const [scaled] = rescaleItemsForResolution(items, hd, qhd);

  expect(scaled!.x).toBe(1280);
  expect(scaled!.y).toBe(720);
  expect(scaled!.w).toBe(533);
  expect(scaled!.h).toBe(267);
});

test("an item at the origin stays at the origin on a uniform change", () => {
  const [scaled] = rescaleItemsForResolution([makeItem({ x: 0, y: 0, w: 100, h: 100 })], hd, qhd);
  expect(scaled!.x).toBe(0);
  expect(scaled!.y).toBe(0);
});

test("a landscape layout is centred when the scene becomes portrait", () => {
  const [scaled] = rescaleItemsForResolution(
    [makeItem({ x: 0, y: 0, w: 1920, h: 1080 })],
    hd,
    { width: 1080, height: 1920 }
  );
  // Scaled to 1080x607, so the vertical gap is split above and below.
  expect(scaled!.x).toBe(0);
  expect(scaled!.y).toBe(Math.round((1920 - 1080 * 0.5625) / 2));
  expect(scaled!.w).toBe(1080);
});

test("shrinking keeps everything inside the new canvas", () => {
  const items = [makeItem({ x: 1520, y: 880, w: 400, h: 200 })];
  const [scaled] = rescaleItemsForResolution(items, hd, { width: 960, height: 540 });
  expect(scaled!.x + scaled!.w).toBeLessThanOrEqual(960);
  expect(scaled!.y + scaled!.h).toBeLessThanOrEqual(540);
});

test("the summary warns that keeping positions can strand items off-canvas", () => {
  const text = describeResolutionChange("keep", hd, { width: 960, height: 540 });
  expect(text).toContain("outside the canvas");
});

test("the summary names the scale factor", () => {
  expect(describeResolutionChange("scale", hd, qhd)).toContain("133%");
});

test("a no-op change says so", () => {
  expect(describeResolutionChange("scale", hd, hd)).toContain("already");
});

test("a bottom-right pinned item stays in the corner through a uniform change", () => {
  const item = makeItem({ x: 0, y: 0, w: 400, h: 200 });
  const pinned = { ...item, anchor_x: "right" as const, anchor_y: "bottom" as const };
  const [scaled] = rescaleItemsForResolution([pinned], hd, qhd);

  // Offsets scale (0 stays 0); the resolved rect is flush with the new corner.
  expect(scaled!.x).toBe(0);
  expect(scaled!.y).toBe(0);
  expect(scaled!.w).toBe(533);
  expect(scaled!.h).toBe(267);
  expect(resolveAnchoredPosition(scaled!, qhd)).toEqual({ x: 2560 - 533, y: 1440 - 267 });
});

test("a pinned item keeps its scaled gap to the edge", () => {
  const item = makeItem({ x: 40, y: 20, w: 400, h: 200 });
  const pinned = { ...item, anchor_x: "right" as const, anchor_y: "bottom" as const };
  const [scaled] = rescaleItemsForResolution([pinned], hd, { width: 960, height: 540 });

  expect(scaled!.x).toBe(20);
  expect(scaled!.y).toBe(10);
});

test("pinning lands on the same pixel as the default for a uniform change", () => {
  // Same absolute rect, expressed from the top-left and from the bottom-right.
  const topLeft = makeItem({ x: 1500, y: 870, w: 400, h: 200 });
  const bottomRight = {
    ...makeItem({ x: 20, y: 10, w: 400, h: 200 }),
    anchor_x: "right" as const,
    anchor_y: "bottom" as const,
  };
  const [a, b] = rescaleItemsForResolution([topLeft, bottomRight], hd, qhd);

  expect(resolveAnchoredPosition(b!, qhd)).toEqual({ x: a!.x, y: a!.y });
});

test("a bottom-right pinned item is still bottom-right when the scene goes portrait", () => {
  const pinned = {
    ...makeItem({ x: 0, y: 0, w: 400, h: 200 }),
    anchor_x: "right" as const,
    anchor_y: "bottom" as const,
  };
  const portrait = { width: 1080, height: 1920 };
  const [scaled] = rescaleItemsForResolution([pinned], hd, portrait);
  const position = resolveAnchoredPosition(scaled!, portrait);

  expect(position.x + scaled!.w).toBe(1080);
  expect(position.y + scaled!.h).toBe(1920);
});
