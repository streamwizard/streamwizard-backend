import { describe, expect, it } from "bun:test";
import { bucketPeaks, foldPeaks } from "./waveform-peaks";

/** 1 kHz signal folded 100 times a second: ten samples per slice. */
function signal(): Float32Array {
  const s = new Float32Array(50);
  s[3] = 0.5;
  s[15] = -0.25;
  s[16] = 0.1;
  s[47] = 2; // clipped
  return s;
}

describe("foldPeaks", () => {
  it("keeps the extremes of each slice, clamped, and reports the length", () => {
    const peaks = foldPeaks([signal()], 1000, 100);
    expect(peaks.min.length).toBe(5);
    expect(peaks.durationMs).toBe(50);
    expect(Array.from(peaks.max)).toEqual([64, 13, 0, 0, 127]);
    expect(Array.from(peaks.min)).toEqual([0, -32, 0, 0, 0]);
  });

  it("takes the extremes across channels and pads a short one with silence", () => {
    const left = new Float32Array([0.2, 0.2, 0.2, 0.2]);
    const right = new Float32Array([-0.9, 0.9]);
    const peaks = foldPeaks([left, right], 1000, 500);
    expect(Array.from(peaks.max)).toEqual([114, 25]);
    expect(Array.from(peaks.min)).toEqual([-114, 0]);
  });

  it("handles a fractional slice size without dropping the tail", () => {
    const s = new Float32Array(10);
    s[9] = 1;
    const peaks = foldPeaks([s], 1000, 300); // 3.33 samples per slice
    expect(peaks.min.length).toBe(3);
    expect(peaks.max[2]).toBe(127);
  });
});

describe("bucketPeaks", () => {
  const peaks = foldPeaks([signal()], 1000, 100); // slices at 0,10,20,30,40 ms

  it("gives one [min, max] pair per bucket in -1..1", () => {
    const out = bucketPeaks(peaks, 0, 50, 5);
    expect(out.length).toBe(10);
    expect(out[0]).toBe(0);
    expect(out[1]).toBeCloseTo(64 / 127, 5);
    expect(out[2]).toBeCloseTo(-32 / 127, 5);
    expect(out[9]).toBe(1);
  });

  it("merges slices when zoomed out and repeats them when zoomed in", () => {
    const wide = bucketPeaks(peaks, 0, 50, 1);
    expect(wide[0]).toBeCloseTo(-32 / 127, 5);
    expect(wide[1]).toBe(1);
    const narrow = bucketPeaks(peaks, 0, 5, 5); // five columns inside the first slice
    for (let i = 0; i < 5; i++) expect(narrow[i * 2 + 1]).toBeCloseTo(64 / 127, 5);
  });

  it("reads silence outside the peaks and reuses a big enough buffer", () => {
    const buffer = new Float32Array(8);
    const out = bucketPeaks(peaks, 40, 80, 4, buffer);
    expect(out).toBe(buffer);
    expect(out[1]).toBe(1);
    expect(Array.from(out.slice(2))).toEqual([0, 0, 0, 0, 0, 0]);
    expect(Array.from(bucketPeaks(peaks, -20, -10, 2))).toEqual([0, 0, 0, 0]);
  });
});
