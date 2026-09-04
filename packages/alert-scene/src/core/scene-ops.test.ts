import { describe, expect, it } from "bun:test";
import { evaluateTrack } from "./evaluate";
import { createClip, createDefaultBase, createDefaultSource, createEmptyScene, createLayer } from "./schema";
import {
  addClip,
  addLayer,
  canPlaceClip,
  clearTrack,
  cloneClip,
  findClip,
  moveClip,
  moveKeyframe,
  moveLayer,
  removeClip,
  removeKeyframe,
  removeLayer,
  sceneContentEnd,
  setKeyframe,
  setKeyframeEasing,
  setTrack,
  splitClip,
  trimClip,
  updateLayer,
} from "./scene-ops";
import type { AlertScene } from "./types";

function fixture(type: "text" | "video" = "text") {
  let scene = createEmptyScene({ duration: 10_000 });
  const layer = createLayer(type, "L");
  scene = addLayer(scene, layer);
  const clip = createClip({
    start: 1000,
    end: 3000,
    trimIn: type === "video" ? 500 : 0,
    source: createDefaultSource(type),
    base: createDefaultBase(scene, { width: 100, height: 100 }),
  });
  scene = addClip(scene, layer.id, clip);
  return { scene, layer, clip };
}

function kfTimes(scene: AlertScene, clipId: string, prop: "x" | "opacity" = "x") {
  return findClip(scene, clipId)!.clip.tracks[prop]?.keyframes.map((k) => k.time) ?? [];
}

describe("layers", () => {
  it("adds on top by default, removes and reorders", () => {
    let scene = createEmptyScene({});
    const a = createLayer("text", "a");
    const b = createLayer("text", "b");
    scene = addLayer(scene, a);
    scene = addLayer(scene, b);
    expect(scene.layers.map((l) => l.name)).toEqual(["a", "b"]);
    scene = moveLayer(scene, b.id, 0);
    expect(scene.layers.map((l) => l.name)).toEqual(["b", "a"]);
    scene = updateLayer(scene, a.id, { visible: false, name: "A!" });
    expect(scene.layers[1]).toMatchObject({ visible: false, name: "A!" });
    scene = removeLayer(scene, a.id);
    expect(scene.layers.map((l) => l.name)).toEqual(["b"]);
  });

  it("shares untouched layers by reference", () => {
    const { scene, layer } = fixture();
    const other = createLayer("text", "other");
    const next = addLayer(scene, other);
    expect(next.layers[0]).toBe(scene.layers[0]);
    expect(updateLayer(next, other.id, { name: "x" }).layers[0]).toBe(scene.layers[0]);
    expect(layer.clips.length).toBe(0); // the original layer object was never mutated
  });
});

describe("clips", () => {
  it("refuses overlapping and wrong-kind clips", () => {
    const { scene, layer } = fixture();
    const overlapping = createClip({ start: 2000, end: 4000, source: createDefaultSource("text"), base: createDefaultBase(scene, { width: 1, height: 1 }) });
    expect(() => addClip(scene, layer.id, overlapping)).toThrow(/overlaps/);
    const wrongKind = createClip({ start: 5000, end: 6000, source: createDefaultSource("image"), base: createDefaultBase(scene, { width: 1, height: 1 }) });
    expect(() => addClip(scene, layer.id, wrongKind)).toThrow(/image clip on a text layer/);
    expect(canPlaceClip(scene.layers[0]!, 3000, 4000)).toBe(true);
    expect(canPlaceClip(scene.layers[0]!, 2999, 4000)).toBe(false);
    expect(canPlaceClip(scene.layers[0]!, 500, 1000)).toBe(true);
  });

  it("keeps clips sorted by start", () => {
    let { scene, layer } = fixture();
    const early = createClip({ start: 0, end: 500, source: createDefaultSource("text"), base: createDefaultBase(scene, { width: 1, height: 1 }) });
    scene = addClip(scene, layer.id, early);
    expect(scene.layers[0]!.clips.map((c) => c.start)).toEqual([0, 1000]);
    expect(sceneContentEnd(scene)).toBe(3000);
    scene = removeClip(scene, early.id);
    expect(scene.layers[0]!.clips.length).toBe(1);
  });

  it("moveClip shifts the clip and every keyframe", () => {
    let { scene, clip } = fixture();
    scene = setKeyframe(scene, clip.id, "x", { time: 1000, value: 0 });
    scene = setKeyframe(scene, clip.id, "x", { time: 2500, value: 10 });
    scene = moveClip(scene, clip.id, 700);
    const moved = findClip(scene, clip.id)!.clip;
    expect([moved.start, moved.end]).toEqual([1700, 3700]);
    expect(kfTimes(scene, clip.id)).toEqual([1700, 3200]);
    expect(() => moveClip(scene, clip.id, -5000)).toThrow(/before scene start/);
  });

  it("moveClip refuses to land on a neighbour", () => {
    let { scene, layer, clip } = fixture();
    scene = addClip(scene, layer.id, createClip({ start: 4000, end: 5000, source: createDefaultSource("text"), base: clip.base }));
    expect(() => moveClip(scene, clip.id, 1500)).toThrow(/overlaps/);
    expect(moveClip(scene, clip.id, 1000).layers[0]!.clips[0]!.end).toBe(4000);
  });

  it("trimClip moves one edge and leaves keyframes where they are", () => {
    let { scene, clip } = fixture();
    scene = setKeyframe(scene, clip.id, "x", { time: 1500, value: 5 });
    scene = trimClip(scene, clip.id, "start", 1400);
    scene = trimClip(scene, clip.id, "end", 2600);
    const c = findClip(scene, clip.id)!.clip;
    expect([c.start, c.end, c.trimIn]).toEqual([1400, 2600, 0]);
    expect(kfTimes(scene, clip.id)).toEqual([1500]);
    expect(() => trimClip(scene, clip.id, "start", 2580)).toThrow(/too short/);
  });

  it("trimming a media clip's start keeps the footage in place", () => {
    let { scene, clip } = fixture("video");
    scene = trimClip(scene, clip.id, "start", 1300);
    expect(findClip(scene, clip.id)!.clip.trimIn).toBe(800);
    scene = trimClip(scene, clip.id, "start", 1000);
    expect(findClip(scene, clip.id)!.clip.trimIn).toBe(500);
  });

  it("splitClip partitions keyframes and pins the value at the cut", () => {
    let { scene, clip } = fixture("video");
    scene = setKeyframe(scene, clip.id, "x", { time: 1000, value: 0 });
    scene = setKeyframe(scene, clip.id, "x", { time: 3000, value: 100 });
    scene = setKeyframe(scene, clip.id, "opacity", { time: 2500, value: 0.5 });
    const res = splitClip(scene, clip.id, 2000)!;
    const left = findClip(res.scene, res.leftId)!.clip;
    const right = findClip(res.scene, res.rightId)!.clip;
    expect([left.start, left.end]).toEqual([1000, 2000]);
    expect([right.start, right.end]).toEqual([2000, 3000]);
    expect(right.trimIn).toBe(500 + 1000);
    expect(kfTimes(res.scene, res.leftId)).toEqual([1000, 2000]);
    expect(kfTimes(res.scene, res.rightId)).toEqual([2000, 3000]);
    expect(evaluateTrack(left.tracks.x, 0, 2000)).toBe(50);
    expect(evaluateTrack(right.tracks.x, 0, 2000)).toBe(50);
    // opacity only had a keyframe on the right side: nothing pinned on the left
    expect(kfTimes(res.scene, res.leftId, "opacity")).toEqual([]);
    expect(kfTimes(res.scene, res.rightId, "opacity")).toEqual([2500]);
    expect(res.scene.layers[0]!.clips.map((c) => c.id)).toEqual([res.leftId, res.rightId]);
  });

  it("splitClip refuses cuts that leave a sliver or fall outside", () => {
    const { scene, clip } = fixture();
    expect(splitClip(scene, clip.id, 1010)).toBeNull();
    expect(splitClip(scene, clip.id, 500)).toBeNull();
    expect(splitClip(scene, clip.id, 3000)).toBeNull();
  });
});

describe("keyframes", () => {
  it("setKeyframe inserts sorted and replaces at the same time", () => {
    let { scene, clip } = fixture();
    scene = setKeyframe(scene, clip.id, "x", { time: 2000, value: 1 });
    scene = setKeyframe(scene, clip.id, "x", { time: 1000, value: 2, easing: "hold" });
    scene = setKeyframe(scene, clip.id, "x", { time: 2000, value: 3 });
    const kfs = findClip(scene, clip.id)!.clip.tracks.x!.keyframes;
    expect(kfs.map((k) => [k.time, k.value, k.easing])).toEqual([
      [1000, 2, "hold"],
      [2000, 3, "linear"],
    ]);
    const idBefore = kfs[1]!.id;
    scene = setKeyframe(scene, clip.id, "x", { time: 2000, value: 4 });
    expect(findClip(scene, clip.id)!.clip.tracks.x!.keyframes[1]!.id).toBe(idBefore);
  });

  it("removeKeyframe drops the track when it empties", () => {
    let { scene, clip } = fixture();
    scene = setKeyframe(scene, clip.id, "x", { time: 2000, value: 1 });
    const id = findClip(scene, clip.id)!.clip.tracks.x!.keyframes[0]!.id;
    scene = removeKeyframe(scene, clip.id, "x", id);
    expect(findClip(scene, clip.id)!.clip.tracks.x).toBeUndefined();
  });

  it("moveKeyframe re-sorts and replaces a keyframe it lands on", () => {
    let { scene, clip } = fixture();
    scene = setKeyframe(scene, clip.id, "x", { time: 1000, value: 1 });
    scene = setKeyframe(scene, clip.id, "x", { time: 2000, value: 2 });
    const first = findClip(scene, clip.id)!.clip.tracks.x!.keyframes[0]!;
    scene = moveKeyframe(scene, clip.id, "x", first.id, 2500);
    expect(kfTimes(scene, clip.id)).toEqual([2000, 2500]);
    scene = moveKeyframe(scene, clip.id, "x", first.id, 2000);
    const kfs = findClip(scene, clip.id)!.clip.tracks.x!.keyframes;
    expect(kfs.map((k) => [k.time, k.value])).toEqual([[2000, 1]]);
  });

  it("setKeyframeEasing and clearTrack", () => {
    let { scene, clip } = fixture();
    scene = setKeyframe(scene, clip.id, "x", { time: 1000, value: 1 });
    const id = findClip(scene, clip.id)!.clip.tracks.x!.keyframes[0]!.id;
    scene = setKeyframeEasing(scene, clip.id, "x", id, { x1: 0, y1: 0, x2: 1, y2: 1 });
    expect(findClip(scene, clip.id)!.clip.tracks.x!.keyframes[0]!.easing).toEqual({ x1: 0, y1: 0, x2: 1, y2: 1 });
    scene = clearTrack(scene, clip.id, "x");
    expect(findClip(scene, clip.id)!.clip.tracks.x).toBeUndefined();
  });

  it("setTrack replaces a track, sorts, dedupes and removes when empty", () => {
    let { scene, clip } = fixture();
    scene = setKeyframe(scene, clip.id, "x", { time: 2500, value: 9 });
    scene = setTrack(scene, clip.id, "x", [
      { id: "b", time: 2000, value: 2, easing: "linear" },
      { id: "a", time: 1000, value: 1, easing: "hold" },
      { id: "dup", time: 2000, value: 3, easing: "linear" },
    ]);
    const kfs = findClip(scene, clip.id)!.clip.tracks.x!.keyframes;
    expect(kfs.map((k) => [k.id, k.time, k.value])).toEqual([
      ["a", 1000, 1],
      ["dup", 2000, 3],
    ]);
    scene = setTrack(scene, clip.id, "x", []);
    expect(findClip(scene, clip.id)!.clip.tracks.x).toBeUndefined();
  });

  it("cloneClip gives fresh ids, keeps values and slides keyframes with the clip", () => {
    let { scene, clip } = fixture("video");
    scene = setKeyframe(scene, clip.id, "x", { time: 1000, value: 0 });
    scene = setKeyframe(scene, clip.id, "x", { time: 3000, value: 100, easing: "hold" });
    const source = findClip(scene, clip.id)!.clip;
    const copy = cloneClip(source, { deltaMs: 2000 });
    expect(copy.id).not.toBe(source.id);
    expect([copy.start, copy.end, copy.trimIn]).toEqual([3000, 5000, 500]);
    expect(copy.tracks.x!.keyframes.map((k) => [k.time, k.value, k.easing])).toEqual([
      [3000, 0, "linear"],
      [5000, 100, "hold"],
    ]);
    const ids = new Set(source.tracks.x!.keyframes.map((k) => k.id));
    expect(copy.tracks.x!.keyframes.some((k) => ids.has(k.id))).toBe(false);
    expect(copy.source).toBe(source.source);
    expect(cloneClip(source).start).toBe(1000);
    expect(kfTimes(scene, clip.id)).toEqual([1000, 3000]);
  });

  it("never mutates the input scene", () => {
    const { scene, clip } = fixture();
    const snapshot = JSON.stringify(scene);
    setKeyframe(scene, clip.id, "x", { time: 1000, value: 1 });
    moveClip(scene, clip.id, 100);
    trimClip(scene, clip.id, "end", 2500);
    splitClip(scene, clip.id, 2000);
    removeClip(scene, clip.id);
    expect(JSON.stringify(scene)).toBe(snapshot);
  });
});
