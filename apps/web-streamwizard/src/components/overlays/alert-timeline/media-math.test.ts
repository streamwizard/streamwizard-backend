import { describe, expect, it } from "bun:test";
import type { ClipSource } from "@repo/alert-scene";
import { clampTrimIn, fitBox, footageEndMs, isMediaClip, mediaLoops, mediaTrimLimits } from "./media-math";

const video = (loop = false): ClipSource => ({ kind: "video", url: "https://cdn.test/a.webm", loop, fit: "contain" });
const audio: ClipSource = { kind: "audio", url: "https://cdn.test/a.mp3" };
const text: ClipSource = { kind: "text", text: "", fontFamily: "Inter", fontSize: 48, fontWeight: 700, color: "#fff", align: "center", lineHeight: 1.2, letterSpacing: 0, shadow: true, preset: "none", presetDurationMs: 800, presetOut: "none", presetOutDurationMs: 800 };

const clip = (source: ClipSource, trimIn = 0) => ({ start: 1000, end: 3000, trimIn, source });

describe("media-math", () => {
  it("knows which clips carry footage", () => {
    expect(isMediaClip(clip(video()))).toBe(true);
    expect(isMediaClip(clip(audio))).toBe(true);
    expect(isMediaClip(clip(text))).toBe(false);
    expect(mediaLoops(video(true))).toBe(true);
    expect(mediaLoops(video())).toBe(false);
    expect(mediaLoops(audio)).toBe(false);
  });

  it("mediaTrimLimits bounds the start by the offset and the end by the footage", () => {
    expect(mediaTrimLimits(clip(text), 5000)).toEqual({});
    expect(mediaTrimLimits(clip(video(), 400), 5000)).toEqual({ minStart: 600, maxEnd: 5600 });
    expect(mediaTrimLimits(clip(audio), null)).toEqual({ minStart: 1000 });
    expect(mediaTrimLimits(clip(video(true), 400), 5000)).toEqual({ minStart: 600 });
    // Already past the source: the end may shrink but never grow.
    expect(mediaTrimLimits(clip(audio, 0), 1500)).toEqual({ minStart: 1000, maxEnd: 3000 });
  });

  it("footageEndMs marks where a clip outruns its source", () => {
    expect(footageEndMs(clip(audio), 1500)).toBe(2500);
    expect(footageEndMs(clip(audio, 500), 1500)).toBe(2000);
    expect(footageEndMs(clip(audio), 2000)).toBeNull();
    expect(footageEndMs(clip(audio), null)).toBeNull();
    expect(footageEndMs(clip(video(true)), 500)).toBeNull();
    expect(footageEndMs(clip(text), 500)).toBeNull();
  });

  it("clampTrimIn keeps the offset inside the source", () => {
    expect(clampTrimIn(clip(audio), 700.4, 5000)).toBe(700);
    expect(clampTrimIn(clip(audio), 4000, 5000)).toBe(3000);
    expect(clampTrimIn(clip(audio), -5, 5000)).toBe(0);
    expect(clampTrimIn(clip(audio), 4000, 1500)).toBe(0);
    expect(clampTrimIn(clip(audio), 4000, null)).toBe(4000);
    expect(clampTrimIn(clip(video(true)), 9000, 1500)).toBe(9000);
  });

  it("fitBox scales down proportionally and never up", () => {
    expect(fitBox({ width: 1920, height: 1080 }, { width: 360, height: 240 })).toEqual({ width: 360, height: 203 });
    expect(fitBox({ width: 100, height: 50 }, { width: 360, height: 240 })).toEqual({ width: 100, height: 50 });
    expect(fitBox({ width: 1, height: 4000 }, { width: 360, height: 240 })).toEqual({ width: 1, height: 240 });
  });
});
