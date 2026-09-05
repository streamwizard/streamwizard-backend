import { describe, expect, it } from "bun:test";
import { STAGGER_LIFT_EM, graphemeFrame, hasTextAnimation, presetDuration, splitGraphemes, staggerProgress, typewriterRevealed, type TextAnimation } from "./text-preset";

const anim = (p: Partial<TextAnimation> = {}): TextAnimation => ({ preset: "none", presetDurationMs: 800, presetOut: "none", presetOutDurationMs: 800, ...p });

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

describe("graphemeFrame", () => {
  const n = 10;
  const clip = 4000;

  it("nothing set: every grapheme plain, and no spans needed", () => {
    expect(hasTextAnimation(anim())).toBe(false);
    expect(graphemeFrame(3, n, 2000, clip, anim())).toEqual({ visible: true, opacity: 1, lift: 0 });
  });

  it("typewriter in types left to right over the first 800ms", () => {
    const a = anim({ preset: "typewriter" });
    expect(hasTextAnimation(a)).toBe(true);
    expect(graphemeFrame(0, n, 0, clip, a).visible).toBe(false);
    expect(graphemeFrame(4, n, 400, clip, a).visible).toBe(true);
    expect(graphemeFrame(5, n, 400, clip, a).visible).toBe(false);
    expect(graphemeFrame(9, n, 800, clip, a).visible).toBe(true);
    expect(graphemeFrame(9, n, 3999, clip, a).visible).toBe(true);
  });

  it("typewriter out backspaces from the end over the last 800ms", () => {
    const a = anim({ presetOut: "typewriter" });
    expect(graphemeFrame(9, n, 3199, clip, a).visible).toBe(true);
    expect(graphemeFrame(9, n, 3201, clip, a).visible).toBe(false);
    expect(graphemeFrame(0, n, 3201, clip, a).visible).toBe(true);
    // 400ms in: ceil(10 × 0.5) = 5 removed → indexes 0..4 remain.
    expect(graphemeFrame(4, n, 3600, clip, a).visible).toBe(true);
    expect(graphemeFrame(5, n, 3600, clip, a).visible).toBe(false);
    expect(graphemeFrame(0, n, 4000, clip, a).visible).toBe(false);
  });

  it("stagger in lifts and fades in; stagger out drops and fades out; both in reading order", () => {
    const a = anim({ preset: "stagger", presetOut: "stagger" });
    expect(graphemeFrame(0, n, 0, clip, a)).toEqual({ visible: true, opacity: 0, lift: STAGGER_LIFT_EM });
    expect(graphemeFrame(9, n, 800, clip, a)).toEqual({ visible: true, opacity: 1, lift: 0 });
    expect(graphemeFrame(3, n, 2000, clip, a)).toEqual({ visible: true, opacity: 1, lift: 0 });
    const first = graphemeFrame(0, n, 3400, clip, a);
    const last = graphemeFrame(9, n, 3400, clip, a);
    expect(first.opacity).toBeLessThan(last.opacity);
    expect(first.lift).toBeGreaterThan(last.lift);
    expect(graphemeFrame(0, n, 4000, clip, a)).toEqual({ visible: true, opacity: 0, lift: STAGGER_LIFT_EM });
  });

  it("in and out can mix, and overlap on a short clip", () => {
    const mixed = anim({ preset: "typewriter", presetOut: "stagger" });
    expect(graphemeFrame(9, n, 100, clip, mixed)).toEqual({ visible: false, opacity: 1, lift: 0 });
    expect(graphemeFrame(0, n, 4000, clip, mixed)).toEqual({ visible: true, opacity: 0, lift: STAGGER_LIFT_EM });
    // 500ms clip, 800ms each way: both clamp to 500 and run at once.
    const short = anim({ preset: "typewriter", presetOut: "typewriter" });
    expect(graphemeFrame(0, n, 250, 500, short).visible).toBe(true);
    expect(graphemeFrame(9, n, 250, 500, short).visible).toBe(false);
    expect(graphemeFrame(4, n, 250, 500, short).visible).toBe(true);
    expect(graphemeFrame(5, n, 250, 500, short).visible).toBe(false);
  });
});
