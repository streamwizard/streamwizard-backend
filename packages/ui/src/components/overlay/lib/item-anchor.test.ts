import { describe, expect, it } from "bun:test";
import {
  getAnchor,
  isAnchored,
  resolveAnchoredPosition,
  toAnchoredOffset,
  withAbsolutePosition,
} from "./item-anchor";

const scene = { width: 1920, height: 1080 };

describe("getAnchor", () => {
  it("defaults to top-left for rows written before anchors existed", () => {
    expect(getAnchor({})).toEqual({ x: "left", y: "top" });
    expect(getAnchor({ anchor_x: null as never, anchor_y: undefined })).toEqual({
      x: "left",
      y: "top",
    });
  });

  it("ignores values it does not know", () => {
    expect(getAnchor({ anchor_x: "middle" as never, anchor_y: "bottom" })).toEqual({
      x: "left",
      y: "bottom",
    });
  });

  it("reports whether an item left the default", () => {
    expect(isAnchored({})).toBe(false);
    expect(isAnchored({ anchor_x: "left", anchor_y: "top" })).toBe(false);
    expect(isAnchored({ anchor_y: "bottom" })).toBe(true);
  });
});

describe("resolveAnchoredPosition", () => {
  it("is the identity for the top-left default", () => {
    expect(resolveAnchoredPosition({ x: 100, y: 50, w: 400, h: 200 }, scene)).toEqual({
      x: 100,
      y: 50,
    });
  });

  it("measures right and bottom offsets inward from that edge", () => {
    const item = { x: 20, y: 10, w: 400, h: 200, anchor_x: "right", anchor_y: "bottom" } as const;
    expect(resolveAnchoredPosition(item, scene)).toEqual({ x: 1500, y: 870 });
  });

  it("puts a zero centred offset dead centre", () => {
    const item = { x: 0, y: 0, w: 400, h: 200, anchor_x: "center", anchor_y: "center" } as const;
    expect(resolveAnchoredPosition(item, scene)).toEqual({ x: 760, y: 440 });
  });

  it("moves a centred item right and down for positive offsets", () => {
    const item = { x: 40, y: -40, w: 400, h: 200, anchor_x: "center", anchor_y: "center" } as const;
    expect(resolveAnchoredPosition(item, scene)).toEqual({ x: 800, y: 400 });
  });

  it("keeps a corner item in the corner at any scene size", () => {
    const item = { x: 0, y: 0, w: 400, h: 200, anchor_x: "right", anchor_y: "bottom" } as const;
    expect(resolveAnchoredPosition(item, { width: 1280, height: 720 })).toEqual({
      x: 880,
      y: 520,
    });
    expect(resolveAnchoredPosition(item, { width: 1080, height: 1920 })).toEqual({
      x: 680,
      y: 1720,
    });
  });
});

describe("toAnchoredOffset", () => {
  it("inverts resolveAnchoredPosition for every anchor", () => {
    for (const anchor_x of ["left", "center", "right"] as const) {
      for (const anchor_y of ["top", "center", "bottom"] as const) {
        const item = { x: 37, y: -12, w: 333, h: 111, anchor_x, anchor_y };
        const absolute = resolveAnchoredPosition(item, scene);
        expect(toAnchoredOffset(absolute, item, scene)).toEqual({ x: 37, y: -12 });
      }
    }
  });

  it("reports a plain zero on the edge itself, never -0", () => {
    const frame = { w: 400, h: 200, anchor_x: "right", anchor_y: "bottom" } as const;
    const offset = toAnchoredOffset({ x: 1520, y: 880 }, frame, scene);
    expect(Object.is(offset.x, 0)).toBe(true);
    expect(Object.is(offset.y, 0)).toBe(true);
  });

  it("gives a right-anchored item its distance from the right edge", () => {
    const frame = { w: 400, h: 200, anchor_x: "right", anchor_y: "top" } as const;
    expect(toAnchoredOffset({ x: 1500, y: 30 }, frame, scene)).toEqual({ x: 20, y: 30 });
  });

  it("uses the frame's own size, so a resize keeps the anchored edge honest", () => {
    // Same absolute left edge, wider box: it now reaches further right, so the
    // gap to the right edge shrinks.
    expect(
      toAnchoredOffset({ x: 1500, y: 0 }, { w: 400, h: 200, anchor_x: "right" }, scene).x
    ).toBe(20);
    expect(
      toAnchoredOffset({ x: 1500, y: 0 }, { w: 410, h: 200, anchor_x: "right" }, scene).x
    ).toBe(10);
  });
});

describe("withAbsolutePosition", () => {
  it("swaps only x and y and leaves the rest of the item alone", () => {
    const item = {
      id: "a",
      x: 0,
      y: 0,
      w: 400,
      h: 200,
      anchor_x: "right" as const,
      anchor_y: "bottom" as const,
      label: "Thing",
    };
    expect(withAbsolutePosition(item, scene)).toEqual({ ...item, x: 1520, y: 880 });
  });
});
