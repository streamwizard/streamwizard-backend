import { expect, test } from "bun:test";
import {
  alignUpdates,
  distributeUpdates,
  flipUpdates,
  matchSizeUpdates,
  selectionBounds,
} from "./selection-layout";
import type { OverlayItem } from "@/types/overlays";

function makeItem(
  id: string,
  rect: { x: number; y: number; w: number; h: number },
  extra: Partial<OverlayItem> = {}
): OverlayItem {
  return {
    id,
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
    label: id,
    config: {} as OverlayItem["config"],
    ...extra,
  };
}

test("bounds cover every item", () => {
  const bounds = selectionBounds([
    makeItem("a", { x: 100, y: 50, w: 100, h: 100 }),
    makeItem("b", { x: 300, y: 200, w: 50, h: 50 }),
  ]);
  expect(bounds).toEqual({ x: 100, y: 50, w: 250, h: 200 });
});

test("an empty selection has no bounds", () => {
  expect(selectionBounds([])).toBeNull();
});

test("align left puts every item on the selection's left edge", () => {
  const items = [
    makeItem("a", { x: 100, y: 0, w: 100, h: 100 }),
    makeItem("b", { x: 300, y: 0, w: 50, h: 50 }),
  ];
  const updates = alignUpdates(items, "left", selectionBounds(items)!);
  expect(updates.map((u) => u.updates.x)).toEqual([100, 100]);
});

test("align right lines up trailing edges, not leading ones", () => {
  const items = [
    makeItem("a", { x: 100, y: 0, w: 100, h: 100 }),
    makeItem("b", { x: 300, y: 0, w: 50, h: 50 }),
  ];
  const updates = alignUpdates(items, "right", selectionBounds(items)!);
  // The selection ends at 350, so a 100-wide item starts at 250.
  expect(updates.map((u) => u.updates.x)).toEqual([250, 300]);
});

test("aligning one item to the scene still sends it to the edge", () => {
  const item = makeItem("a", { x: 640, y: 360, w: 200, h: 100 });
  const scene = { x: 0, y: 0, w: 1920, h: 1080 };
  expect(alignUpdates([item], "left", scene)[0]?.updates.x).toBe(0);
  expect(alignUpdates([item], "right", scene)[0]?.updates.x).toBe(1720);
  expect(alignUpdates([item], "vcenter", scene)[0]?.updates.y).toBe(490);
});

test("a locked item is never moved", () => {
  const items = [
    makeItem("a", { x: 100, y: 0, w: 100, h: 100 }),
    makeItem("locked", { x: 300, y: 0, w: 100, h: 100 }, { is_locked: true }),
  ];
  const updates = alignUpdates(items, "left", selectionBounds(items)!);
  expect(updates.map((u) => u.id)).toEqual(["a"]);
});

test("distributing four items gives equal gaps and leaves the ends alone", () => {
  const items = [
    makeItem("a", { x: 0, y: 0, w: 100, h: 10 }),
    makeItem("b", { x: 150, y: 0, w: 100, h: 10 }),
    makeItem("c", { x: 400, y: 0, w: 100, h: 10 }),
    makeItem("d", { x: 700, y: 0, w: 100, h: 10 }),
  ];
  const updates = distributeUpdates(items, "horizontal");

  // Span 0..800 holds 400px of item, so each of the three gaps is 400/3.
  expect(updates.map((u) => u.id)).toEqual(["b", "c"]);
  const placed = new Map(updates.map((u) => [u.id, u.updates.x!]));
  const gapAfterA = placed.get("b")! - 100;
  const gapAfterB = placed.get("c")! - (placed.get("b")! + 100);
  const gapAfterC = 700 - (placed.get("c")! + 100);
  expect(Math.abs(gapAfterA - gapAfterB)).toBeLessThanOrEqual(1);
  expect(Math.abs(gapAfterB - gapAfterC)).toBeLessThanOrEqual(1);
});

test("distributing works off position, not selection order", () => {
  const items = [
    makeItem("c", { x: 400, y: 0, w: 100, h: 10 }),
    makeItem("a", { x: 0, y: 0, w: 100, h: 10 }),
    makeItem("b", { x: 150, y: 0, w: 100, h: 10 }),
  ];
  expect(distributeUpdates(items, "horizontal").map((u) => u.id)).toEqual(["b"]);
});

test("distributing needs three items", () => {
  const items = [
    makeItem("a", { x: 0, y: 0, w: 100, h: 10 }),
    makeItem("b", { x: 400, y: 0, w: 100, h: 10 }),
  ];
  expect(distributeUpdates(items, "horizontal")).toEqual([]);
});

test("a locked middle item keeps its slot but is not written", () => {
  const items = [
    makeItem("a", { x: 0, y: 0, w: 100, h: 10 }),
    makeItem("locked", { x: 150, y: 0, w: 100, h: 10 }, { is_locked: true }),
    makeItem("c", { x: 400, y: 0, w: 100, h: 10 }),
    makeItem("d", { x: 700, y: 0, w: 100, h: 10 }),
  ];
  const updates = distributeUpdates(items, "horizontal");
  expect(updates.map((u) => u.id)).toEqual(["c"]);
  // Gaps are 400/3 wide, so c lands at 467 -- the slot it would have had if the
  // locked item had moved. The locked one stays at 150, so the run looks uneven;
  // that is the cost of not touching it.
  expect(updates[0]!.updates.x).toBe(467);
});

test("match width scales the others without distorting them", () => {
  const items = [
    makeItem("primary", { x: 0, y: 0, w: 400, h: 200 }),
    makeItem("other", { x: 0, y: 0, w: 100, h: 50 }),
  ];
  const updates = matchSizeUpdates(items, "primary", "width");
  expect(updates).toHaveLength(1);
  expect(updates[0]!.updates.w).toBe(400);
  // 100x50 scaled by 4 keeps its 2:1 shape.
  expect(updates[0]!.updates.h).toBe(200);
});

test("match height drives off the other axis", () => {
  const items = [
    makeItem("primary", { x: 0, y: 0, w: 400, h: 200 }),
    makeItem("other", { x: 0, y: 0, w: 100, h: 50 }),
  ];
  expect(matchSizeUpdates(items, "primary", "height")[0]!.updates.h).toBe(200);
});

test("matching both fits inside the primary rather than stretching", () => {
  const items = [
    makeItem("primary", { x: 0, y: 0, w: 400, h: 100 }),
    makeItem("other", { x: 0, y: 0, w: 100, h: 100 }),
  ];
  const updates = matchSizeUpdates(items, "primary", "both");
  // Height is the tighter constraint, so scale is 1, not 4.
  expect(updates[0]!.updates.w).toBe(100);
  expect(updates[0]!.updates.h).toBe(100);
});

test("match size skips the primary and any locked item", () => {
  const items = [
    makeItem("primary", { x: 0, y: 0, w: 400, h: 200 }),
    makeItem("locked", { x: 0, y: 0, w: 100, h: 50 }, { is_locked: true }),
  ];
  expect(matchSizeUpdates(items, "primary", "width")).toEqual([]);
});

test("match size accounts for crop when scaling", () => {
  const items = [
    makeItem("primary", { x: 0, y: 0, w: 200, h: 100 }),
    makeItem(
      "cropped",
      { x: 0, y: 0, w: 100, h: 100 },
      { design_w: 200, design_h: 100, crop_left: 50, crop_right: 50 }
    ),
  ];
  const updates = matchSizeUpdates(items, "primary", "width");
  // Source is 100 wide after the crop, so matching 200 means scale 2.
  expect(updates[0]!.updates.w).toBe(200);
  expect(updates[0]!.updates.h).toBe(200);
});

test("flipping toggles each item's own flag and skips locked ones", () => {
  const updates = flipUpdates(
    [
      makeItem("a", { x: 0, y: 0, w: 10, h: 10 }),
      makeItem("b", { x: 20, y: 0, w: 10, h: 10 }, { flip_h: true }),
      makeItem("c", { x: 40, y: 0, w: 10, h: 10 }, { is_locked: true }),
    ],
    "horizontal"
  );
  expect(updates).toEqual([
    { id: "a", updates: { flip_h: true } },
    { id: "b", updates: { flip_h: false } },
  ]);
});

test("flipping vertically leaves the horizontal flag alone", () => {
  const updates = flipUpdates(
    [makeItem("a", { x: 0, y: 0, w: 10, h: 10 }, { flip_h: true })],
    "vertical"
  );
  expect(updates).toEqual([{ id: "a", updates: { flip_v: true } }]);
});
