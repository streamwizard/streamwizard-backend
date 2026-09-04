import { describe, expect, it } from "bun:test";
import { anchorIsOnCell, anchorToCell, cellToAnchor, reanchorNode, type NodeBox } from "./anchor-math";

/** World position of the box's top-left, the thing reanchoring must keep still. */
function topLeft(b: NodeBox): { x: number; y: number } {
  const ox = b.anchorX * b.width * b.scaleX;
  const oy = b.anchorY * b.height * b.scaleY;
  const r = (b.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { x: b.x - (ox * cos - oy * sin), y: b.y - (ox * sin + oy * cos) };
}

describe("reanchorNode", () => {
  const base: NodeBox = { x: 300, y: 200, width: 200, height: 100, scaleX: 1, scaleY: 1, rotation: 0, anchorX: 0.5, anchorY: 0.5 };

  it("keeps the box still when moving the anchor without rotation", () => {
    const next = reanchorNode(base, 0, 0);
    expect(next).toEqual({ x: 200, y: 150, anchorX: 0, anchorY: 0 });
    expect(topLeft({ ...base, ...next })).toEqual(topLeft(base));
  });

  it("keeps the box still with rotation and scale", () => {
    const rotated: NodeBox = { ...base, rotation: 37, scaleX: 1.5, scaleY: 0.5 };
    const before = topLeft(rotated);
    const next = reanchorNode(rotated, 1, 0.25);
    const after = topLeft({ ...rotated, ...next });
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });

  it("is the identity for the same anchor", () => {
    expect(reanchorNode(base, 0.5, 0.5)).toEqual({ x: 300, y: 200, anchorX: 0.5, anchorY: 0.5 });
  });
});

describe("picker adapter", () => {
  it("maps cells both ways and flags off-grid anchors", () => {
    expect(cellToAnchor({ x: "right", y: "top" })).toEqual({ anchorX: 1, anchorY: 0 });
    expect(anchorToCell(1, 0)).toEqual({ x: "right", y: "top" });
    expect(anchorToCell(0.4, 0.9)).toEqual({ x: "center", y: "bottom" });
    expect(anchorIsOnCell(0.5, 0.5)).toBe(true);
    expect(anchorIsOnCell(0.4, 0.5)).toBe(false);
  });
});
