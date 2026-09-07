import { expect, test } from "bun:test";
import { computeSnap } from "./snapping";

const scene = { width: 1920, height: 1080 };
const rect = (x: number, y: number, w = 100, h = 100) => ({ x, y, w, h });

test("an edge still snaps to another item's edge", () => {
  const result = computeSnap(rect(303, 500), [rect(300, 200)], scene, 8);
  expect(result.x).toBe(300);
  expect(result.guides).toContainEqual({ orientation: "v", position: 300 });
});

test("scene edges and centre still snap", () => {
  expect(computeSnap(rect(4, 500), [], scene, 8).x).toBe(0);
  expect(computeSnap(rect(908, 500), [], scene, 8).x).toBe(910);
});

test("nothing in range leaves the rect alone and reports nothing", () => {
  const result = computeSnap(rect(500, 500), [rect(900, 900)], scene, 8);
  expect(result).toMatchObject({ x: 500, y: 500, guides: [], gaps: [] });
});

test("a snap to a neighbour reports the gap between them", () => {
  // Snaps to y=200; the two sit 150px apart horizontally.
  const result = computeSnap(rect(350, 203), [rect(100, 200)], scene, 8);
  const gap = result.gaps.find((g) => g.axis === "x");
  expect(gap?.distance).toBe(150);
  expect(gap?.start).toBe(200);
  expect(gap?.end).toBe(350);
});

test("overlapping rects report no gap to label", () => {
  const result = computeSnap(rect(150, 203), [rect(100, 200)], scene, 8);
  expect(result.gaps.find((g) => g.axis === "x")).toBeUndefined();
});

test("a third item drops into even spacing between two others", () => {
  // Targets at 0..100 and 500..600 leave 400 of room; a 100-wide item centres at 250.
  const result = computeSnap(rect(245, 0), [rect(0, 0), rect(500, 0)], scene, 8);
  expect(result.x).toBe(250);
});

test("even spacing shows both gaps, and they match", () => {
  const result = computeSnap(rect(245, 0), [rect(0, 0), rect(500, 0)], scene, 8);
  const distances = result.gaps.filter((g) => g.axis === "x").map((g) => g.distance);
  expect(distances).toHaveLength(2);
  expect(distances[0]).toBe(distances[1]!);
  expect(distances[0]).toBe(150);
});

test("even spacing ignores items that are not in the same row", () => {
  // Same x positions, but far below: not a row, so nothing to space against.
  const result = computeSnap(rect(245, 0), [rect(0, 900), rect(500, 900)], scene, 8);
  expect(result.x).toBe(245);
});

test("even spacing never beats a real edge alignment", () => {
  // 252 is within reach of both the even-spacing position (250) and target
  // edge 250... use an edge that is closer to make the precedence explicit.
  const result = computeSnap(rect(247, 0), [rect(0, 0), rect(500, 0), rect(245, 400)], scene, 8);
  expect(result.x).toBe(245);
  expect(result.guides).toContainEqual({ orientation: "v", position: 245 });
});

test("a gap too small for the item is not offered as a spacing slot", () => {
  // 50 of room for a 100-wide item, and far enough from every edge that plain
  // edge snapping does not fire either.
  const result = computeSnap(rect(112, 0), [rect(0, 0), rect(150, 0)], scene, 8);
  expect(result.x).toBe(112);
});

test("spacing works on the vertical axis too", () => {
  const result = computeSnap(rect(0, 245), [rect(0, 0), rect(0, 500)], scene, 8);
  expect(result.y).toBe(250);
  expect(result.gaps.filter((g) => g.axis === "y")).toHaveLength(2);
});

test("a disabled axis does not move, guide or measure", () => {
  const result = computeSnap(
    rect(303, 203),
    [rect(300, 200)],
    scene,
    8,
    { x: false, y: true }
  );
  expect(result.x).toBe(303);
  expect(result.y).toBe(200);
  expect(result.guides).toEqual([{ orientation: "h", position: 200 }]);
});

test("both axes off leaves the rect entirely alone", () => {
  const result = computeSnap(rect(303, 203), [rect(300, 200)], scene, 8, {
    x: false,
    y: false,
  });
  expect(result).toMatchObject({ x: 303, y: 203, guides: [], gaps: [] });
});

test("even spacing respects a disabled axis", () => {
  const result = computeSnap(rect(245, 0), [rect(0, 0), rect(500, 0)], scene, 8, {
    x: false,
    y: true,
  });
  expect(result.x).toBe(245);
});
