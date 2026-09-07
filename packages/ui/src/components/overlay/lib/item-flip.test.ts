import { describe, expect, it } from "bun:test";
import { itemFlipTransform, itemTransform } from "./item-flip";

describe("itemFlipTransform", () => {
  it("is absent for an unflipped item, so no transform is added for nothing", () => {
    expect(itemFlipTransform({ flip_h: false, flip_v: false })).toBeUndefined();
  });

  it("mirrors one axis at a time", () => {
    expect(itemFlipTransform({ flip_h: true, flip_v: false })).toBe("scaleX(-1) scaleY(1)");
    expect(itemFlipTransform({ flip_h: false, flip_v: true })).toBe("scaleX(1) scaleY(-1)");
    expect(itemFlipTransform({ flip_h: true, flip_v: true })).toBe("scaleX(-1) scaleY(-1)");
  });
});

describe("itemTransform", () => {
  it("is just the rotation when nothing is flipped", () => {
    expect(itemTransform({ rotation: 30, flip_h: false, flip_v: false })).toBe("rotate(30deg)");
  });

  it("rotates first and mirrors second, so a tilted item stays tilted the same way", () => {
    expect(itemTransform({ rotation: 30, flip_h: true, flip_v: false })).toBe(
      "rotate(30deg) scaleX(-1) scaleY(1)"
    );
  });
});
