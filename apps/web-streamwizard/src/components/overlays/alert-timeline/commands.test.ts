import { describe, expect, it } from "bun:test";
import {
  addClip,
  addLayer,
  createClip,
  createDefaultBase,
  createDefaultSource,
  createEmptyScene,
  createLayer,
  findClip,
  setKeyframe,
  type AlertScene,
} from "@repo/alert-scene";
import {
  addClipCommand,
  addLayerCommand,
  clearTrackCommand,
  compositeCommand,
  deleteKeyframeCommand,
  moveClipCommand,
  moveKeyframeCommand,
  moveLayerCommand,
  removeClipCommand,
  removeKeyframeCommand,
  removeLayerCommand,
  setBasePropCommand,
  setKeyframeCommand,
  setKeyframeEasingCommand,
  setSceneMetaCommand,
  setTrackCommand,
  splitClipCommand,
  stopwatchOffCommand,
  stopwatchOnCommand,
  trimClipCommand,
  updateClipCommand,
  updateLayerCommand,
  writePropCommand,
  writePropsCommand,
  type Command,
} from "./commands";

function fixture() {
  let scene = createEmptyScene({ duration: 10_000 });
  const a = createLayer("text", "A");
  const b = createLayer("video", "B");
  scene = addLayer(scene, a);
  scene = addLayer(scene, b);
  const clip = createClip({ start: 1000, end: 3000, trimIn: 200, source: createDefaultSource("video"), base: createDefaultBase(scene, { width: 100, height: 100 }) });
  scene = addClip(scene, b.id, clip);
  scene = setKeyframe(scene, clip.id, "x", { time: 1000, value: 0 });
  scene = setKeyframe(scene, clip.id, "x", { time: 3000, value: 100 });
  return { scene, a, b, clip };
}

function roundTrips(scene: AlertScene, cmd: Command) {
  const after = cmd.apply(scene);
  expect(after).not.toEqual(scene);
  expect(cmd.invert(after)).toEqual(scene);
  // redo reproduces the same result
  expect(cmd.apply(cmd.invert(after))).toEqual(after);
  return after;
}

describe("commands invert exactly", () => {
  it("scene meta", () => {
    const { scene } = fixture();
    roundTrips(scene, setSceneMetaCommand(scene, { duration: 4000, name: "x" }));
  });

  it("layers", () => {
    const { scene, a, b } = fixture();
    roundTrips(scene, addLayerCommand(createLayer("image", "C"), 0));
    roundTrips(scene, removeLayerCommand(scene, a.id)!);
    roundTrips(scene, moveLayerCommand(scene, b.id, 0)!);
    roundTrips(scene, updateLayerCommand(scene, a.id, { visible: false, name: "AA" })!);
  });

  it("clips", () => {
    const { scene, b, clip } = fixture();
    const extra = createClip({ start: 5000, end: 6000, source: createDefaultSource("video"), base: clip.base });
    roundTrips(scene, addClipCommand(b.id, extra));
    roundTrips(scene, removeClipCommand(scene, clip.id)!);
    roundTrips(scene, moveClipCommand(clip.id, 500));
    roundTrips(scene, trimClipCommand(scene, clip.id, "start", 1500)!);
    roundTrips(scene, trimClipCommand(scene, clip.id, "end", 2500)!);
    roundTrips(scene, updateClipCommand(scene, clip.id, { trimIn: 900, base: { ...clip.base, opacity: 0.5 } })!);
    roundTrips(scene, setBasePropCommand(scene, clip.id, "rotation", 45)!);
  });

  it("trim start restores trimIn even when the clamp hit zero", () => {
    const { scene, clip } = fixture();
    // trimIn is 200; dragging the start 500ms earlier would clamp trimIn at 0.
    const cmd = trimClipCommand(scene, clip.id, "start", 500)!;
    const after = cmd.apply(scene);
    expect(findClip(after, clip.id)!.clip.trimIn).toBe(0);
    expect(cmd.invert(after)).toEqual(scene);
  });

  it("split is deterministic across redo", () => {
    const { scene, clip } = fixture();
    const cmd = splitClipCommand(scene, clip.id, 2000)!;
    const once = cmd.apply(scene);
    const twice = cmd.apply(cmd.invert(once));
    expect(twice).toEqual(once);
    expect(cmd.invert(once)).toEqual(scene);
    expect(once.layers[1]!.clips.length).toBe(2);
  });

  it("keyframes", () => {
    const { scene, clip } = fixture();
    const kfs = findClip(scene, clip.id)!.clip.tracks.x!.keyframes;
    roundTrips(scene, setKeyframeCommand(scene, clip.id, "x", { time: 2000, value: 50 })!);
    roundTrips(scene, setKeyframeCommand(scene, clip.id, "x", { time: 1000, value: 5 })!); // replaces
    roundTrips(scene, removeKeyframeCommand(scene, clip.id, "x", kfs[0]!.id)!);
    roundTrips(scene, moveKeyframeCommand(scene, clip.id, "x", kfs[0]!.id, 2000)!);
    roundTrips(scene, moveKeyframeCommand(scene, clip.id, "x", kfs[0]!.id, 3000)!); // displaces the other
    roundTrips(scene, setKeyframeEasingCommand(scene, clip.id, "x", kfs[0]!.id, "hold")!);
  });

  it("tracks: clear, set and the stopwatch pair", () => {
    const { scene, clip } = fixture();
    roundTrips(scene, clearTrackCommand(scene, clip.id, "x")!);
    roundTrips(scene, setTrackCommand(scene, clip.id, "x", [{ id: "n", time: 1500, value: 7, easing: "hold" }])!);
    roundTrips(scene, setTrackCommand(scene, clip.id, "opacity", [{ id: "o", time: 1500, value: 0.5, easing: "linear" }])!);
    roundTrips(scene, stopwatchOnCommand(scene, clip.id, "opacity", 1200)!);
    roundTrips(scene, stopwatchOffCommand(scene, clip.id, "x", 2000)!);
    expect(stopwatchOnCommand(scene, clip.id, "x", 0)).toBeNull();
    expect(stopwatchOffCommand(scene, clip.id, "opacity", 0)).toBeNull();
    expect(clearTrackCommand(scene, clip.id, "opacity")).toBeNull();
  });

  it("stopwatch off settles the value that was showing", () => {
    const { scene, clip } = fixture();
    const after = stopwatchOffCommand(scene, clip.id, "x", 2000)!.apply(scene);
    const c = findClip(after, clip.id)!.clip;
    expect(c.tracks.x).toBeUndefined();
    expect(c.base.x).toBe(50);
  });

  it("deleting the last keyframe settles its value into base", () => {
    const { scene, clip } = fixture();
    const [first, second] = findClip(scene, clip.id)!.clip.tracks.x!.keyframes;
    const one = roundTrips(scene, deleteKeyframeCommand(scene, clip.id, "x", first!.id, 1000)!);
    expect(findClip(one, clip.id)!.clip.tracks.x!.keyframes.length).toBe(1);
    const none = roundTrips(one, deleteKeyframeCommand(one, clip.id, "x", second!.id, 0)!);
    const c = findClip(none, clip.id)!.clip;
    expect(c.tracks.x).toBeUndefined();
    expect(c.base.x).toBe(100);
    expect(deleteKeyframeCommand(scene, clip.id, "x", "nope", 0)).toBeNull();
    expect(deleteKeyframeCommand(scene, clip.id, "opacity", "nope", 0)).toBeNull();
  });

  it("writeProp goes to a keyframe when animated and to base when not", () => {
    const { scene, clip } = fixture();
    const kf = writePropCommand(scene, clip.id, "x", 25, 2000.4)!;
    const afterKf = roundTrips(scene, kf);
    expect(findClip(afterKf, clip.id)!.clip.tracks.x!.keyframes.map((k) => k.time)).toEqual([1000, 2000, 3000]);
    const base = writePropCommand(scene, clip.id, "y", 25, 2000)!;
    const afterBase = roundTrips(scene, base);
    expect(findClip(afterBase, clip.id)!.clip.base.y).toBe(25);
    expect(findClip(afterBase, clip.id)!.clip.tracks.y).toBeUndefined();
    const both = writePropsCommand(scene, clip.id, { x: 1, y: 2 }, 2000, "Move")!;
    const afterBoth = roundTrips(scene, both);
    expect(findClip(afterBoth, clip.id)!.clip.base.y).toBe(2);
    expect(findClip(afterBoth, clip.id)!.clip.tracks.x!.keyframes.length).toBe(3);
    expect(writePropsCommand(scene, clip.id, {}, 0)).toBeNull();
  });

  it("composite applies in order and inverts in reverse", () => {
    const { scene, clip, a } = fixture();
    const cmd = compositeCommand("both", [moveClipCommand(clip.id, 500), removeLayerCommand(scene, a.id)!]);
    roundTrips(scene, cmd);
  });

  it("returns null for unknown targets", () => {
    const { scene } = fixture();
    expect(removeClipCommand(scene, "nope")).toBeNull();
    expect(removeLayerCommand(scene, "nope")).toBeNull();
    expect(splitClipCommand(scene, "nope", 10)).toBeNull();
  });
});
