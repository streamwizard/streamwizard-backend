import { describe, expect, it } from "bun:test";
import { addClip, addLayer, createClip, createDefaultBase, createDefaultSource, createEmptyScene, createLayer, findClip, setKeyframe } from "@repo/alert-scene";
import { hasTrack, keyframeTime, stopwatchOff, stopwatchOn, valueAt, writeProp, writeProps } from "./prop-writer";

function fixture() {
  let scene = createEmptyScene({ duration: 5000 });
  const layer = createLayer("text", "T");
  scene = addLayer(scene, layer);
  const clip = createClip({ start: 0, end: 4000, source: createDefaultSource("text"), base: createDefaultBase(scene, { width: 100, height: 50 }) });
  scene = addClip(scene, layer.id, clip);
  return { scene, clip };
}

const track = (scene: ReturnType<typeof fixture>["scene"], clipId: string, prop: "x" | "opacity") => findClip(scene, clipId)!.clip.tracks[prop];

describe("writeProp", () => {
  it("changes base when there is no track", () => {
    const { scene, clip } = fixture();
    const next = writeProp(scene, clip.id, "x", 123, 1000);
    expect(findClip(next, clip.id)!.clip.base.x).toBe(123);
    expect(track(next, clip.id, "x")).toBeUndefined();
  });

  it("adds or updates a keyframe at the (rounded) playhead when a track exists", () => {
    const fx = fixture();
    const clip = fx.clip;
    let scene = fx.scene;
    scene = setKeyframe(scene, clip.id, "x", { time: 0, value: 0 });
    scene = writeProp(scene, clip.id, "x", 50, 1000.4);
    expect(track(scene, clip.id, "x")!.keyframes.map((k) => [k.time, k.value])).toEqual([[0, 0], [1000, 50]]);
    scene = writeProp(scene, clip.id, "x", 60, 1000);
    expect(track(scene, clip.id, "x")!.keyframes.map((k) => [k.time, k.value])).toEqual([[0, 0], [1000, 60]]);
    expect(findClip(scene, clip.id)!.clip.base.x).toBe(300);
  });

  it("writeProps routes each property by its own track", () => {
    const fx = fixture();
    const clip = fx.clip;
    let scene = fx.scene;
    scene = setKeyframe(scene, clip.id, "x", { time: 0, value: 0 });
    scene = writeProps(scene, clip.id, { x: 10, y: 20 }, 500);
    expect(track(scene, clip.id, "x")!.keyframes.map((k) => k.time)).toEqual([0, 500]);
    expect(findClip(scene, clip.id)!.clip.base.y).toBe(20);
  });

  it("keyframeTime rounds", () => {
    expect(keyframeTime(1234.6)).toBe(1235);
  });
});

describe("stopwatch", () => {
  it("on creates one keyframe holding base; off restores the evaluated value into base", () => {
    const fx = fixture();
    const clip = fx.clip;
    let scene = fx.scene;
    scene = stopwatchOn(scene, clip.id, "opacity", 700);
    expect(hasTrack(findClip(scene, clip.id)!.clip, "opacity")).toBe(true);
    expect(track(scene, clip.id, "opacity")!.keyframes).toMatchObject([{ time: 700, value: 1 }]);
    scene = setKeyframe(scene, clip.id, "opacity", { time: 2700, value: 0 });
    expect(valueAt(findClip(scene, clip.id)!.clip, "opacity", 1700)).toBe(0.5);
    scene = stopwatchOff(scene, clip.id, "opacity", 1700);
    expect(track(scene, clip.id, "opacity")).toBeUndefined();
    expect(findClip(scene, clip.id)!.clip.base.opacity).toBe(0.5);
  });

  it("are no-ops in the wrong state", () => {
    const { scene, clip } = fixture();
    expect(stopwatchOff(scene, clip.id, "x", 0)).toBe(scene);
    const on = stopwatchOn(scene, clip.id, "x", 0);
    expect(stopwatchOn(on, clip.id, "x", 100)).toBe(on);
  });
});
