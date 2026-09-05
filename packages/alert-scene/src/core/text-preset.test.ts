import { describe, expect, it } from "bun:test";
import { presetDuration, splitGraphemes, staggerProgress, typewriterRevealed } from "./text-preset";

describe("splitGraphemes", () => {
  it("counts what a person sees as one character", () => {
    expect(splitGraphemes("héllo")).toEqual(["h", "é", "l", "l", "o"]);
    expect(splitGraphemes("éa")).toEqual(["é", "a"]);
    expect(splitGraphemes("👩‍💻!")).toEqual(["👩‍💻", "!"]);
    expect(splitGraphemes("a\nb")).toEqual(["a", "\n", "b"]);
    expect(splitGraphemes("")).toEqual([]);
  });
});

describe("presetDuration", () => {
  it("never runs past the clip and never hits zero", () => {
    expect(presetDuration(800, 5000)).toBe(800);
    expect(presetDuration(800, 300)).toBe(300);
    expect(presetDuration(0, 300)).toBe(1);
  });
});

describe("typewriterRevealed", () => {
  it("shows nothing at 0, everything from the duration on, ceil in between", () => {
    expect(typewriterRevealed(10, 0, 1000)).toBe(0);
    expect(typewriterRevealed(10, 1, 1000)).toBe(1);
    expect(typewriterRevealed(10, 500, 1000)).toBe(5);
    expect(typewriterRevealed(10, 501, 1000)).toBe(6);
    expect(typewriterRevealed(10, 1000, 1000)).toBe(10);
    expect(typewriterRevealed(10, 5000, 1000)).toBe(10);
    expect(typewriterRevealed(10, -5, 1000)).toBe(0);
    expect(typewriterRevealed(0, 500, 1000)).toBe(0);
  });
});

describe("staggerProgress", () => {
  it("starts everything at 0, lands everything at the duration, in order", () => {
    const n = 5;
    for (let i = 0; i < n; i++) expect(staggerProgress(i, n, 0, 1000)).toBe(0);
    for (let i = 0; i < n; i++) expect(staggerProgress(i, n, 1000, 1000)).toBe(1);
    for (let i = 0; i < n; i++) expect(staggerProgress(i, n, 9000, 1000)).toBe(1);
    const mid = Array.from({ length: n }, (_, i) => staggerProgress(i, n, 500, 1000));
    for (let i = 1; i < n; i++) expect(mid[i]!).toBeLessThanOrEqual(mid[i - 1]!);
    expect(mid[0]).toBe(1);
    expect(mid[n - 1]).toBe(0);
  });

  it("is monotonic in time for one grapheme and handles a single grapheme", () => {
    let last = -1;
    for (let t = 0; t <= 1000; t += 50) {
      const p = staggerProgress(2, 5, t, 1000);
      expect(p).toBeGreaterThanOrEqual(last);
      last = p;
    }
    expect(staggerProgress(0, 1, 0, 1000)).toBe(0);
    expect(staggerProgress(0, 1, 400, 1000)).toBe(1);
  });
});
