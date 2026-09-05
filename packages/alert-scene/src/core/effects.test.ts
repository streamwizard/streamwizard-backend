import { describe, expect, it } from "bun:test";
import { effectsFilterList, hasTint, tintArithmetic, tintFilterId } from "./effects";
import { createDefaultEffects } from "./schema";

describe("effects", () => {
  it("no effects, no filter", () => {
    expect(effectsFilterList(createDefaultEffects(), "t")).toEqual([]);
  });

  it("orders tint, then shadow, then blur", () => {
    const fx = { ...createDefaultEffects(), tint: { color: "#ff0000", amount: 0.5 }, shadow: { x: 1, y: 2, blur: 3, color: "#000000" }, blur: 4 };
    expect(effectsFilterList(fx, tintFilterId("s1", "clip_a"))).toEqual(["url(#sw-tint-s1-clip_a)", "drop-shadow(1px 2px 3px #000000)", "blur(4px)"]);
  });

  it("a zero-amount tint is no tint", () => {
    const fx = { ...createDefaultEffects(), tint: { color: "#ff0000", amount: 0 } };
    expect(hasTint(fx)).toBe(false);
    expect(effectsFilterList(fx, "t")).toEqual([]);
    expect(hasTint({ ...fx, tint: { color: "#ff0000", amount: 0.01 } })).toBe(true);
  });

  it("mixes source and colour by amount, clamped", () => {
    expect(tintArithmetic(0.25)).toEqual({ k2: 0.75, k3: 0.25 });
    expect(tintArithmetic(2)).toEqual({ k2: 0, k3: 1 });
    expect(tintArithmetic(-1)).toEqual({ k2: 1, k3: 0 });
  });
});
