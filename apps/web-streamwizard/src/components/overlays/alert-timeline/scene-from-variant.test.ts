import { describe, expect, it } from "bun:test";
import { evaluate, MAX_SCENE_DURATION_MS, parseAlertScene } from "@repo/alert-scene";
import { createDefaultAlertVariantConfig } from "@repo/ui/overlay";
import { createTimelineFromVariant, SEED_IN_MS, SEED_OUT_MS } from "./scene-from-variant";

describe("createTimelineFromVariant", () => {
  it("seeds title + message for a default follow alert", () => {
    const variant = { ...createDefaultAlertVariantConfig("follow"), messageTemplate: "{message}" };
    const scene = createTimelineFromVariant(variant, { width: 600, height: 400, name: "Follow" });
    expect(parseAlertScene(scene)).toEqual(scene);
    expect(scene.duration).toBe(500 + 6000 + 350);
    expect(scene.layers.map((l) => l.type)).toEqual(["text", "text"]);
    const title = scene.layers[0]!.clips[0]!;
    expect(title.source).toMatchObject({ kind: "text", text: variant.titleTemplate });
    // fades in over SEED_IN_MS, holds, fades out at the end
    expect(evaluate(scene, 0).nodes[0]!.opacity).toBe(0);
    expect(evaluate(scene, SEED_IN_MS).nodes[0]!.opacity).toBe(1);
    expect(evaluate(scene, scene.duration / 2).nodes[0]!.opacity).toBe(1);
    expect(evaluate(scene, scene.duration - 1).nodes[0]!.opacity).toBeLessThan(0.1);
  });

  it("adds an image layer under the text when the variant has one", () => {
    const variant = { ...createDefaultAlertVariantConfig("cheer"), mediaKind: "image" as const, mediaUrl: "https://cdn/x.png", messageTemplate: "" };
    const scene = createTimelineFromVariant(variant, { width: 600, height: 400, name: "Cheer" });
    expect(scene.layers.map((l) => l.type)).toEqual(["image", "text"]);
    expect(scene.layers[0]!.clips[0]!.source).toMatchObject({ kind: "image", url: "https://cdn/x.png" });
  });

  it("seeds a looping video under the text for a fixed-length alert", () => {
    const variant = { ...createDefaultAlertVariantConfig("raid"), mediaKind: "video" as const, mediaUrl: "https://cdn/x.webm" };
    const scene = createTimelineFromVariant(variant, { width: 600, height: 400, name: "Raid" });
    expect(parseAlertScene(scene)).toEqual(scene);
    expect(scene.layers.map((l) => l.type)).toEqual(["video", "text"]);
    const video = scene.layers[0]!.clips[0]!;
    expect(video.source).toMatchObject({ kind: "video", url: "https://cdn/x.webm", loop: true, fit: "contain" });
    expect(video.base.volume).toBe(1);
    expect([video.start, video.end]).toEqual([0, scene.duration]);
    expect(video.tracks.opacity).toBeDefined();
  });

  it("puts the sound on top at full volume and silences a video that has a separate sound", () => {
    const variant = {
      ...createDefaultAlertVariantConfig("sub"),
      mediaKind: "video" as const,
      mediaUrl: "https://cdn/x.webm",
      soundUrl: "https://cdn/ding.mp3",
      volume: 0.3,
    };
    const scene = createTimelineFromVariant(variant, { width: 600, height: 400, name: "Sub" });
    expect(parseAlertScene(scene)).toEqual(scene);
    expect(scene.layers.map((l) => l.type)).toEqual(["video", "text", "audio"]);
    expect(scene.layers[0]!.clips[0]!.base.volume).toBe(0);
    const sound = scene.layers[2]!.clips[0]!;
    expect(sound.source).toEqual({ kind: "audio", url: "https://cdn/ding.mp3" });
    expect([sound.start, sound.end, sound.base.volume]).toEqual([0, scene.duration, 1]);
    expect(sound.tracks.opacity).toBeUndefined();
    // Sound without any picture still works.
    const plain = createTimelineFromVariant({ ...createDefaultAlertVariantConfig("follow"), soundUrl: "https://cdn/ding.mp3" }, { width: 600, height: 400, name: "Follow" });
    expect(plain.layers.map((l) => l.type)).toEqual(["text", "audio"]);
  });

  it("a video-length alert takes the video's length, plays it once and caps at the scene maximum", () => {
    const variant = { ...createDefaultAlertVariantConfig("raid"), mediaKind: "video" as const, mediaUrl: "https://cdn/x.webm", durationMode: "media" as const };
    const known = createTimelineFromVariant(variant, { width: 600, height: 400, name: "Raid", mediaDurationMs: 8000 });
    expect(known.duration).toBe(8000 + SEED_OUT_MS);
    expect(known.layers[0]!.clips[0]!.source).toMatchObject({ loop: false });
    expect(known.layers[0]!.clips[0]!.end).toBe(known.duration);
    const unknown = createTimelineFromVariant(variant, { width: 600, height: 400, name: "Raid", mediaDurationMs: null });
    expect(unknown.duration).toBe(500 + 6000 + 350);
    const long = createTimelineFromVariant(variant, { width: 600, height: 400, name: "Raid", mediaDurationMs: 400_000 });
    expect(long.duration).toBe(MAX_SCENE_DURATION_MS);
    // A fixed-length alert ignores the probe.
    const fixed = createTimelineFromVariant({ ...variant, durationMode: "fixed" }, { width: 600, height: 400, name: "Raid", mediaDurationMs: 8000 });
    expect(fixed.duration).toBe(500 + 6000 + 350);
  });
});
