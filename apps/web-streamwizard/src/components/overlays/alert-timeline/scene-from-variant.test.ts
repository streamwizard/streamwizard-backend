import { describe, expect, it } from "bun:test";
import { evaluate, parseAlertScene } from "@repo/alert-scene";
import { createDefaultAlertVariantConfig } from "@repo/ui/overlay";
import { createTimelineFromVariant, SEED_IN_MS } from "./scene-from-variant";

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

  it("ignores video media in this phase", () => {
    const variant = { ...createDefaultAlertVariantConfig("raid"), mediaKind: "video" as const, mediaUrl: "https://cdn/x.webm" };
    const scene = createTimelineFromVariant(variant, { width: 600, height: 400, name: "Raid" });
    expect(scene.layers.every((l) => l.type === "text")).toBe(true);
  });
});
