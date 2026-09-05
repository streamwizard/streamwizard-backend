import { describe, expect, it } from "bun:test";
import { createClip, createDefaultBase, createDefaultSource, createEmptyScene, createLayer, parseAlertScene } from "./schema";
import { addClip, addLayer } from "./scene-ops";

function built() {
  let scene = createEmptyScene({ width: 600, height: 400, duration: 4000, name: "Follow" });
  const layer = createLayer("text", "Title");
  scene = addLayer(scene, layer);
  scene = addClip(
    scene,
    layer.id,
    createClip({ start: 0, end: 2000, source: createDefaultSource("text"), base: createDefaultBase(scene, { width: 300, height: 80 }) })
  );
  return scene;
}

describe("parseAlertScene", () => {
  it("round-trips a built scene through JSON", () => {
    const scene = built();
    expect(parseAlertScene(JSON.parse(JSON.stringify(scene)))).toEqual(scene);
  });

  it("returns null for junk instead of throwing", () => {
    expect(parseAlertScene(null)).toBeNull();
    expect(parseAlertScene("nope")).toBeNull();
    expect(parseAlertScene({ version: 2 })).toBeNull();
  });

  it("fills defaults for fields added after a scene was saved", () => {
    const scene = built();
    const raw = JSON.parse(JSON.stringify(scene));
    delete raw.layers[0].clips[0].effects;
    delete raw.layers[0].clips[0].source.preset;
    delete raw.layers[0].clips[0].source.presetOut;
    delete raw.layers[0].clips[0].source.presetOutDurationMs;
    delete raw.fps;
    const parsed = parseAlertScene(raw)!;
    expect(parsed.fps).toBe(60);
    expect(parsed.layers[0]!.clips[0]!.effects.blendMode).toBe("normal");
    expect(parsed.layers[0]!.clips[0]!.source).toMatchObject({ preset: "none", presetOut: "none", presetOutDurationMs: 800 });
  });

  it("rejects overlapping clips, reversed clips and mismatched kinds", () => {
    const scene = built();
    const raw = JSON.parse(JSON.stringify(scene));
    const clip = raw.layers[0].clips[0];
    raw.layers[0].clips.push({ ...clip, id: "c2", start: 1000, end: 3000 });
    expect(parseAlertScene(raw)).toBeNull();

    const reversed = JSON.parse(JSON.stringify(scene));
    reversed.layers[0].clips[0].end = -1;
    expect(parseAlertScene(reversed)).toBeNull();

    const wrongKind = JSON.parse(JSON.stringify(scene));
    wrongKind.layers[0].type = "image";
    expect(parseAlertScene(wrongKind)).toBeNull();
  });

  it("sorts clips and keyframes and drops duplicate keyframe times", () => {
    const scene = built();
    const raw = JSON.parse(JSON.stringify(scene));
    const clip = raw.layers[0].clips[0];
    raw.layers[0].clips = [{ ...clip, id: "late", start: 3000, end: 3500 }, clip];
    clip.tracks = {
      x: {
        property: "x",
        keyframes: [
          { id: "b", time: 500, value: 1, easing: "linear" },
          { id: "a", time: 0, value: 0, easing: "hold" },
          { id: "dup", time: 500, value: 9, easing: "linear" },
        ],
      },
    };
    const parsed = parseAlertScene(raw)!;
    expect(parsed.layers[0]!.clips.map((c) => c.id)).toEqual([clip.id, "late"]);
    expect(parsed.layers[0]!.clips[0]!.tracks.x!.keyframes.map((k) => k.id)).toEqual(["a", "b"]);
  });

  it("caps duration and size", () => {
    const raw = JSON.parse(JSON.stringify(built()));
    raw.duration = 999_999;
    expect(parseAlertScene(raw)).toBeNull();
  });
});
