import { describe, expect, it } from "bun:test";
import { evaluate, evaluateTrack, MAX_SCENE_DURATION_MS, parseAlertScene, type Clip, type PropName } from "@repo/alert-scene";
import { createDefaultAlertVariantConfig, type AlertAnimationIn, type AlertAnimationOut, type AlertVariantConfig } from "@repo/ui/overlay";
import { createTimelineFromVariant, SEED_IN_MS, SEED_OUT_MS } from "./scene-from-variant";

const SIZE = { width: 600, height: 400, name: "Test" };

function seeded(patch: Partial<AlertVariantConfig>) {
  const variant = { ...createDefaultAlertVariantConfig("follow"), ...patch };
  const scene = createTimelineFromVariant(variant, SIZE);
  expect(parseAlertScene(scene)).toEqual(scene);
  const clip = scene.layers[0]!.clips[0]!;
  const at = (prop: PropName, t: number) => evaluateTrack(clip.tracks[prop], clip.base[prop], t);
  return { scene, clip, at };
}

function tracksOf(clip: Clip): string[] {
  return Object.keys(clip.tracks).sort();
}

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

  describe("entrance animations", () => {
    const y = (clip: Clip) => clip.base.y;

    it("fade: opacity only", () => {
      const { clip, at } = seeded({ animationIn: "fade" });
      expect(tracksOf(clip)).toEqual(["opacity"]);
      expect(at("opacity", 0)).toBe(0);
      expect(at("opacity", SEED_IN_MS / 2)).toBeGreaterThan(0.5);
      expect(at("opacity", SEED_IN_MS)).toBe(1);
    });

    it("slide_up: starts 32px below its resting y and fades", () => {
      const { clip, at } = seeded({ animationIn: "slide_up" });
      expect(tracksOf(clip)).toEqual(["opacity", "y"]);
      expect(at("y", 0)).toBe(y(clip) + 32);
      expect(at("y", SEED_IN_MS / 2)).toBeLessThan(y(clip) + 32);
      expect(at("y", SEED_IN_MS)).toBe(y(clip));
      expect(at("y", 3000)).toBe(y(clip));
      expect(at("opacity", 0)).toBe(0);
    });

    it("slide_down: starts 32px above", () => {
      const { clip, at } = seeded({ animationIn: "slide_down" });
      expect(at("y", 0)).toBe(y(clip) - 32);
      expect(at("y", SEED_IN_MS)).toBe(y(clip));
    });

    it("zoom: scale 0.8 to 1 on both axes and fades", () => {
      const { clip, at } = seeded({ animationIn: "zoom" });
      expect(tracksOf(clip)).toEqual(["opacity", "scaleX", "scaleY"]);
      expect(at("scaleX", 0)).toBe(0.8);
      expect(at("scaleY", 0)).toBe(0.8);
      expect(at("scaleX", SEED_IN_MS)).toBe(1);
      expect(at("scaleY", 3000)).toBe(1);
    });

    it("bounce: 0.6, overshoots to 1.08 at 60%, dips to 0.97 at 80%, lands at 1; opaque from 60%", () => {
      const { at } = seeded({ animationIn: "bounce" });
      expect(at("scaleX", 0)).toBe(0.6);
      expect(at("scaleX", 300)).toBe(1.08);
      expect(at("scaleX", 400)).toBe(0.97);
      expect(at("scaleY", 400)).toBe(0.97);
      expect(at("scaleX", SEED_IN_MS)).toBe(1);
      expect(at("opacity", 0)).toBe(0);
      expect(at("opacity", 300)).toBe(1);
      expect(at("opacity", 400)).toBe(1);
      expect(at("opacity", SEED_IN_MS)).toBe(1);
    });

    it("every entrance lands on the resting values and parses", () => {
      for (const animationIn of ["fade", "slide_up", "slide_down", "zoom", "bounce"] as AlertAnimationIn[]) {
        const { clip, at } = seeded({ animationIn });
        expect(at("opacity", SEED_IN_MS)).toBe(1);
        expect(at("y", SEED_IN_MS)).toBe(clip.base.y);
        expect(at("scaleX", SEED_IN_MS)).toBe(1);
      }
    });
  });

  describe("exit animations", () => {
    it("fade: opacity 1 at the out start, 0 at the end", () => {
      const { scene, at } = seeded({ animationOut: "fade" });
      const end = scene.duration;
      expect(at("opacity", end - SEED_OUT_MS)).toBe(1);
      expect(at("opacity", end - 1)).toBeLessThan(0.1);
      expect(at("opacity", end)).toBe(0);
    });

    it("slide_down: drops 24px while fading", () => {
      const { scene, clip, at } = seeded({ animationIn: "fade", animationOut: "slide_down" });
      const end = scene.duration;
      expect(tracksOf(clip)).toEqual(["opacity", "y"]);
      expect(at("y", 0)).toBe(clip.base.y);
      expect(at("y", end - SEED_OUT_MS)).toBe(clip.base.y);
      expect(at("y", end)).toBe(clip.base.y + 24);
      expect(at("opacity", end)).toBe(0);
    });

    it("zoom: shrinks to 0.85", () => {
      const { scene, clip, at } = seeded({ animationIn: "fade", animationOut: "zoom" });
      const end = scene.duration;
      expect(at("scaleX", end - SEED_OUT_MS)).toBe(1);
      expect(at("scaleX", end)).toBe(0.85);
      expect(at("scaleY", end)).toBe(0.85);
      expect(at("scaleX", 0)).toBe(clip.base.scaleX);
    });

    it("a track both sides touch rests in between", () => {
      const { scene, clip, at } = seeded({ animationIn: "slide_up", animationOut: "slide_down" });
      const end = scene.duration;
      expect(at("y", 0)).toBe(clip.base.y + 32);
      expect(at("y", SEED_IN_MS)).toBe(clip.base.y);
      expect(at("y", end / 2)).toBe(clip.base.y);
      expect(at("y", end - SEED_OUT_MS)).toBe(clip.base.y);
      expect(at("y", end)).toBe(clip.base.y + 24);
      const zoomBoth = seeded({ animationIn: "zoom", animationOut: "zoom" });
      expect(zoomBoth.at("scaleX", zoomBoth.scene.duration / 2)).toBe(1);
    });

    it("every exit ends fully faded and parses", () => {
      for (const animationOut of ["fade", "slide_down", "zoom"] as AlertAnimationOut[]) {
        const { scene, at } = seeded({ animationOut });
        expect(at("opacity", scene.duration)).toBe(0);
      }
    });

    it("applies to every visual clip and never to the sound", () => {
      const variant = { ...createDefaultAlertVariantConfig("sub"), mediaKind: "image" as const, mediaUrl: "https://cdn/x.png", soundUrl: "https://cdn/d.mp3", messageTemplate: "{message}", animationIn: "bounce" as const, animationOut: "zoom" as const };
      const scene = createTimelineFromVariant(variant, SIZE);
      expect(scene.layers.map((l) => l.type)).toEqual(["image", "text", "text", "audio"]);
      for (const layer of scene.layers.slice(0, 3)) expect(tracksOf(layer.clips[0]!)).toEqual(["opacity", "scaleX", "scaleY"]);
      expect(tracksOf(scene.layers[3]!.clips[0]!)).toEqual([]);
    });

    it("media-mode duration still wins: the exit sits at the video's end", () => {
      const variant = { ...createDefaultAlertVariantConfig("raid"), mediaKind: "video" as const, mediaUrl: "https://cdn/x.webm", durationMode: "media" as const, animationOut: "slide_down" as const };
      const scene = createTimelineFromVariant(variant, { ...SIZE, mediaDurationMs: 8000 });
      expect(scene.duration).toBe(8000 + SEED_OUT_MS);
      const video = scene.layers[0]!.clips[0]!;
      const y = video.tracks.y!.keyframes.map((k) => k.time);
      expect(y).toEqual([8000, 8350]);
      expect(evaluate(scene, 8000).nodes[0]!.opacity).toBe(1);
    });
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
