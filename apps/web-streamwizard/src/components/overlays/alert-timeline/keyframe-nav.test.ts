import { describe, expect, it } from "bun:test";
import { addClip, addLayer, createClip, createDefaultBase, createDefaultSource, createEmptyScene, createLayer, findClip, setKeyframe } from "@repo/alert-scene";
import { keyframeAt, keyframeTimesForClip, nextKeyframeTime, prevKeyframeTime } from "./keyframe-nav";

describe("keyframe navigation", () => {
  let scene = createEmptyScene({ duration: 5000 });
  const layer = createLayer("text", "T");
  scene = addLayer(scene, layer);
  const clip = createClip({ start: 0, end: 4000, source: createDefaultSource("text"), base: createDefaultBase(scene, { width: 1, height: 1 }) });
  scene = addClip(scene, layer.id, clip);
  scene = setKeyframe(scene, clip.id, "x", { time: 1000, value: 0 });
  scene = setKeyframe(scene, clip.id, "x", { time: 3000, value: 0 });
  scene = setKeyframe(scene, clip.id, "opacity", { time: 2000, value: 0 });
  scene = setKeyframe(scene, clip.id, "opacity", { time: 3000, value: 1 });
  const c = findClip(scene, clip.id)!.clip;

  it("merges times across tracks", () => {
    expect(keyframeTimesForClip(c)).toEqual([1000, 2000, 3000]);
  });

  it("prev/next skip the current time and stop at the ends", () => {
    const times = keyframeTimesForClip(c);
    expect(prevKeyframeTime(times, 2000)).toBe(1000);
    expect(prevKeyframeTime(times, 2000.3)).toBe(1000);
    expect(prevKeyframeTime(times, 500)).toBeNull();
    expect(nextKeyframeTime(times, 2000)).toBe(3000);
    expect(nextKeyframeTime(times, 3000)).toBeNull();
    expect(nextKeyframeTime(times, 0)).toBe(1000);
  });

  it("keyframeAt tolerates sub-millisecond playhead positions", () => {
    expect(keyframeAt(c.tracks.x, 1000.4)?.time).toBe(1000);
    expect(keyframeAt(c.tracks.x, 1001)).toBeNull();
    expect(keyframeAt(undefined, 1000)).toBeNull();
  });
});
