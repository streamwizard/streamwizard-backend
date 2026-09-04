import { describe, expect, it } from "bun:test";
import type { NodeBox } from "../anchor-math";
import { angleDeg, containsPoint, hitTest, localToWorld, nodeCorners, resizeFromCorner, rotationFromPointer, upVector, worldToLocal } from "./stage-geometry";

const plain: NodeBox = { x: 100, y: 50, width: 200, height: 100, scaleX: 1, scaleY: 1, rotation: 0, anchorX: 0, anchorY: 0 };
const fancy: NodeBox = { x: 300, y: 200, width: 200, height: 100, scaleX: 1.5, scaleY: 0.5, rotation: 30, anchorX: 0.5, anchorY: 0.5 };

const close = (a: { x: number; y: number }, b: { x: number; y: number }, digits = 6) => {
  expect(a.x).toBeCloseTo(b.x, digits);
  expect(a.y).toBeCloseTo(b.y, digits);
};

describe("local ↔ world", () => {
  it("puts the anchor on x/y and round-trips", () => {
    close(localToWorld(fancy, 100, 50), { x: 300, y: 200 });
    for (const p of [{ x: 0, y: 0 }, { x: 200, y: 100 }, { x: 37, y: 91 }]) {
      const w = localToWorld(fancy, p.x, p.y);
      close(worldToLocal(fancy, w.x, w.y), p);
    }
  });

  it("corners of an unrotated top-left anchored box are where css puts them", () => {
    const c = nodeCorners(plain);
    close(c.tl, { x: 100, y: 50 });
    close(c.tr, { x: 300, y: 50 });
    close(c.br, { x: 300, y: 150 });
    close(c.bl, { x: 100, y: 150 });
  });
});

describe("hit testing", () => {
  it("respects rotation and picks the topmost node", () => {
    const rotated: NodeBox = { ...plain, x: 200, y: 100, anchorX: 0.5, anchorY: 0.5, rotation: 45 };
    // Straight up from the centre, 60px: inside the rotated box (half-diagonal reach) but outside its unrotated height.
    expect(containsPoint(rotated, { x: 200, y: 40 })).toBe(true);
    expect(containsPoint({ ...rotated, rotation: 0 }, { x: 200, y: 40 })).toBe(false);
    const under = { ...plain, id: "under" };
    const over = { ...plain, id: "over" };
    expect(hitTest([under, over], { x: 150, y: 100 })?.id).toBe("over");
    expect(hitTest([under, over], { x: 5, y: 5 })).toBeNull();
  });
});

describe("resizeFromCorner", () => {
  it("keeps the opposite corner pinned through rotation, scale and a centre anchor", () => {
    const before = nodeCorners(fancy);
    for (const [corner, pinned] of [["br", "tl"], ["tl", "br"], ["tr", "bl"], ["bl", "tr"]] as const) {
      const pointer = localToWorld(fancy, corner === "tl" || corner === "bl" ? -40 : 260, corner === "tl" || corner === "tr" ? -20 : 130);
      const next = { ...fancy, ...resizeFromCorner(fancy, corner, pointer) };
      close(nodeCorners(next)[pinned], before[pinned]);
      expect(next.width).toBeCloseTo(corner === "tl" || corner === "bl" ? 240 : 260, 6);
      expect(next.height).toBeCloseTo(corner === "tl" || corner === "tr" ? 120 : 130, 6);
      close(nodeCorners(next)[corner], pointer);
    }
  });

  it("keeps the aspect ratio with shift and never collapses", () => {
    const next = resizeFromCorner(plain, "br", { x: 400, y: 60 }, { keepAspect: true });
    expect(next.width / next.height).toBeCloseTo(2, 6);
    expect(next.width).toBeCloseTo(300, 6);
    const tiny = resizeFromCorner(plain, "br", { x: -500, y: -500 });
    expect(tiny.width).toBe(1);
    expect(tiny.height).toBe(1);
    close({ x: tiny.x, y: tiny.y }, { x: 100, y: 50 });
  });
});

describe("rotation", () => {
  it("adds the swept angle and snaps to 15° with shift", () => {
    const c = { x: 0, y: 0 };
    expect(angleDeg(c, { x: 0, y: -10 })).toBeCloseTo(-90, 6);
    const start = angleDeg(c, { x: 0, y: -10 });
    expect(rotationFromPointer(0, start, c, { x: 10, y: 0 })).toBeCloseTo(90, 6);
    expect(rotationFromPointer(10, start, c, { x: 10, y: 1 }, { snap: true })).toBe(105);
    expect(rotationFromPointer(0, start, c, { x: 10, y: 0.3 })).toBeCloseTo(91.7, 6);
  });

  it("upVector follows the box rotation", () => {
    close(upVector(plain), { x: 0, y: -1 });
    close(upVector({ ...plain, rotation: 90 }), { x: 1, y: 0 });
  });
});
