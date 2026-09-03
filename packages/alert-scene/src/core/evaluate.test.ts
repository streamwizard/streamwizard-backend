import { describe, expect, it } from "bun:test";
import { activeClipAt, evaluate, evaluateTrack } from "./evaluate";
import { createClip, createDefaultBase, createDefaultSource, createEmptyScene, createLayer } from "./schema";
import { addClip, addLayer, setKeyframe } from "./scene-ops";
import type { AlertScene, KeyframeTrack } from "./types";

function track(kfs: Array<[number, number, KeyframeTrack["keyframes"][number]["easing"]?]>): KeyframeTrack {
  return {
    property: "x",
    keyframes: kfs.map(([time, value, easing], i) => ({ id: `k${i}`, time, value, easing: easing ?? "linear" })),
  };
}

describe("evaluateTrack", () => {
  it("falls back to base with no track or an empty track", () => {
    expect(evaluateTrack(undefined, 7, 100)).toBe(7);
    expect(evaluateTrack({ property: "x", keyframes: [] }, 7, 100)).toBe(7);
  });

  it("holds a single keyframe's value everywhere", () => {
    const t = track([[500, 42]]);
    expect(evaluateTrack(t, 0, 0)).toBe(42);
    expect(evaluateTrack(t, 0, 500)).toBe(42);
    expect(evaluateTrack(t, 0, 99999)).toBe(42);
  });

  it("clamps before the first and after the last keyframe", () => {
    const t = track([
      [1000, 10],
      [2000, 20],
    ]);
    expect(evaluateTrack(t, 0, 0)).toBe(10);
    expect(evaluateTrack(t, 0, 3000)).toBe(20);
  });

  it("interpolates linearly between keyframes", () => {
    const t = track([
      [1000, 10],
      [2000, 20],
    ]);
    expect(evaluateTrack(t, 0, 1000)).toBe(10);
    expect(evaluateTrack(t, 0, 1500)).toBe(15);
    expect(evaluateTrack(t, 0, 1999)).toBeCloseTo(19.99, 6);
    expect(evaluateTrack(t, 0, 2000)).toBe(20);
  });

  it("uses the leading keyframe's easing per segment", () => {
    const t = track([
      [0, 0, "hold"],
      [1000, 100, "linear"],
      [2000, 200],
    ]);
    expect(evaluateTrack(t, 0, 999)).toBe(0);
    expect(evaluateTrack(t, 0, 1000)).toBe(100);
    expect(evaluateTrack(t, 0, 1500)).toBe(150);
  });

  it("applies a bezier curve", () => {
    const t = track([
      [0, 0, { x1: 0.42, y1: 0, x2: 1, y2: 1 }],
      [1000, 100],
    ]);
    // ease-in: well under halfway at the midpoint
    expect(evaluateTrack(t, 0, 500)).toBeLessThan(40);
    expect(evaluateTrack(t, 0, 500)).toBeGreaterThan(0);
  });

  it("picks the right segment among many keyframes", () => {
    const t = track([
      [0, 0],
      [100, 10],
      [200, 20],
      [300, 30],
      [400, 40],
    ]);
    expect(evaluateTrack(t, 0, 250)).toBe(25);
    expect(evaluateTrack(t, 0, 350)).toBe(35);
    expect(evaluateTrack(t, 0, 100)).toBe(10);
  });
});

function sceneWithText(): { scene: AlertScene; layerId: string; clipId: string } {
  let scene = createEmptyScene({ width: 600, height: 400, duration: 5000 });
  const layer = createLayer("text", "Title");
  scene = addLayer(scene, layer);
  const clip = createClip({
    start: 1000,
    end: 3000,
    source: { ...createDefaultSource("text"), text: "hi" } as never,
    base: createDefaultBase(scene, { width: 300, height: 80 }),
  });
  scene = addClip(scene, layer.id, clip);
  return { scene, layerId: layer.id, clipId: clip.id };
}

describe("activeClipAt", () => {
  it("is start-inclusive and end-exclusive", () => {
    const { scene } = sceneWithText();
    const layer = scene.layers[0]!;
    expect(activeClipAt(layer, 999)).toBeNull();
    expect(activeClipAt(layer, 1000)?.id).toBe(layer.clips[0]!.id);
    expect(activeClipAt(layer, 2999.9)?.id).toBe(layer.clips[0]!.id);
    expect(activeClipAt(layer, 3000)).toBeNull();
  });
});

describe("evaluate", () => {
  it("returns no nodes outside any clip, and the scene size", () => {
    const { scene } = sceneWithText();
    const state = evaluate(scene, 0);
    expect(state.nodes).toEqual([]);
    expect(state.width).toBe(600);
    expect(state.height).toBe(400);
    expect(state.time).toBe(0);
  });

  it("resolves base props, local time and media time", () => {
    const { scene, clipId } = sceneWithText();
    const node = evaluate(scene, 1500).nodes[0]!;
    expect(node.clipId).toBe(clipId);
    expect(node.x).toBe(300);
    expect(node.y).toBe(200);
    expect(node.width).toBe(300);
    expect(node.opacity).toBe(1);
    expect(node.localTime).toBe(500);
    expect(node.mediaTime).toBe(500);
    expect(node.clipDuration).toBe(2000);
  });

  it("animates a keyframed property and leaves the rest on base", () => {
    let { scene } = sceneWithText();
    const clipId = scene.layers[0]!.clips[0]!.id;
    scene = setKeyframe(scene, clipId, "opacity", { time: 1000, value: 0 });
    scene = setKeyframe(scene, clipId, "opacity", { time: 2000, value: 1 });
    expect(evaluate(scene, 1500).nodes[0]!.opacity).toBe(0.5);
    expect(evaluate(scene, 1500).nodes[0]!.x).toBe(300);
  });

  it("skips hidden layers and silences muted ones", () => {
    let { scene, layerId } = sceneWithText();
    scene = { ...scene, layers: scene.layers.map((l) => (l.id === layerId ? { ...l, muted: true } : l)) };
    expect(evaluate(scene, 1500).nodes[0]!.volume).toBe(0);
    scene = { ...scene, layers: scene.layers.map((l) => (l.id === layerId ? { ...l, visible: false } : l)) };
    expect(evaluate(scene, 1500).nodes).toEqual([]);
  });

  it("emits nodes in layer order, bottom first", () => {
    let scene = createEmptyScene({});
    const a = createLayer("shape", "A");
    const b = createLayer("shape", "B");
    scene = addLayer(scene, a);
    scene = addLayer(scene, b);
    const mk = () =>
      createClip({ start: 0, end: 1000, source: createDefaultSource("shape"), base: createDefaultBase(scene, { width: 10, height: 10 }) });
    scene = addClip(scene, a.id, mk());
    scene = addClip(scene, b.id, mk());
    expect(evaluate(scene, 10).nodes.map((n) => n.layerId)).toEqual([a.id, b.id]);
  });

  it("is a pure function of (scene, t)", () => {
    const { scene } = sceneWithText();
    const first = evaluate(scene, 1234);
    evaluate(scene, 4000);
    evaluate(scene, 0);
    expect(evaluate(scene, 1234)).toEqual(first);
  });
});
