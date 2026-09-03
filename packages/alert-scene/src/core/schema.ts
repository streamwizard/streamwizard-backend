import { z } from "zod";
import { createId } from "./ids";
import {
  BLEND_MODES,
  LAYER_TYPES,
  MEDIA_FITS,
  PROP_NAMES,
  SCENE_VERSION,
  SHAPE_KINDS,
  TEXT_PRESETS,
  type AlertScene,
  type BaseProps,
  type Clip,
  type ClipEffects,
  type ClipSource,
  type Layer,
  type LayerType,
} from "./types";

export const MIN_SCENE_DURATION_MS = 100;
export const MAX_SCENE_DURATION_MS = 120_000;
export const MAX_SCENE_SIZE = 8000;
export const MAX_LAYERS = 50;
export const MAX_CLIPS_PER_LAYER = 100;
export const MAX_KEYFRAMES_PER_TRACK = 500;
export const MAX_URL_LENGTH = 2000;
export const MAX_TEXT_LENGTH = 500;
/** Shortest clip the editor lets you trim to. */
export const MIN_CLIP_MS = 50;

export const DEFAULT_SCENE_SIZE = { width: 600, height: 400 } as const;
export const DEFAULT_SCENE_DURATION_MS = 5000;
export const DEFAULT_FPS = 60;
export const DEFAULT_FONT_FAMILY = "Inter";

const hexColor = z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
const cssColor = z.string().min(1).max(64);
const url = z.string().max(MAX_URL_LENGTH);
const ms = z.number().finite();
const nonNegMs = ms.min(0);

const bezierSchema = z.object({
  x1: z.number().min(0).max(1),
  y1: z.number().min(-2).max(3),
  x2: z.number().min(0).max(1),
  y2: z.number().min(-2).max(3),
});

export const easingSchema = z.union([z.literal("linear"), z.literal("hold"), bezierSchema]);

export const keyframeSchema = z.object({
  id: z.string().min(1).max(64),
  time: nonNegMs,
  value: z.number().finite(),
  easing: easingSchema.default("linear"),
});

export const keyframeTrackSchema = z.object({
  property: z.enum(PROP_NAMES),
  keyframes: z.array(keyframeSchema).max(MAX_KEYFRAMES_PER_TRACK),
});

const textSourceSchema = z.object({
  kind: z.literal("text"),
  text: z.string().max(MAX_TEXT_LENGTH).default(""),
  fontFamily: z.string().min(1).max(100).default(DEFAULT_FONT_FAMILY),
  fontSize: z.number().min(4).max(400).default(48),
  fontWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]).default(700),
  color: cssColor.default("#ffffff"),
  align: z.enum(["left", "center", "right"]).default("center"),
  lineHeight: z.number().min(0.5).max(3).default(1.2),
  letterSpacing: z.number().min(-20).max(100).default(0),
  shadow: z.boolean().default(true),
  preset: z.enum(TEXT_PRESETS).default("none"),
  presetDurationMs: z.number().min(0).max(MAX_SCENE_DURATION_MS).default(800),
});

const imageSourceSchema = z.object({
  kind: z.literal("image"),
  url: url.default(""),
  fit: z.enum(MEDIA_FITS).default("contain"),
});

const videoSourceSchema = z.object({
  kind: z.literal("video"),
  url: url.default(""),
  loop: z.boolean().default(false),
  fit: z.enum(MEDIA_FITS).default("contain"),
});

const audioSourceSchema = z.object({
  kind: z.literal("audio"),
  url: url.default(""),
});

const shapeSourceSchema = z.object({
  kind: z.literal("shape"),
  shape: z.enum(SHAPE_KINDS).default("rect"),
  fill: cssColor.default("#9e7aff"),
  stroke: cssColor.default("transparent"),
  strokeWidth: z.number().min(0).max(100).default(0),
  radius: z.number().min(0).max(1000).default(0),
});

export const clipSourceSchema = z.discriminatedUnion("kind", [
  textSourceSchema,
  imageSourceSchema,
  videoSourceSchema,
  audioSourceSchema,
  shapeSourceSchema,
]);

export const clipEffectsSchema = z.object({
  blendMode: z.enum(BLEND_MODES).default("normal"),
  shadow: z
    .object({
      x: z.number().min(-200).max(200),
      y: z.number().min(-200).max(200),
      blur: z.number().min(0).max(200),
      color: cssColor,
    })
    .nullable()
    .default(null),
  blur: z.number().min(0).max(100).default(0),
  tint: z.object({ color: hexColor, amount: z.number().min(0).max(1) }).nullable().default(null),
});

const basePropsSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().min(0).max(MAX_SCENE_SIZE),
  height: z.number().min(0).max(MAX_SCENE_SIZE),
  scaleX: z.number().finite().default(1),
  scaleY: z.number().finite().default(1),
  rotation: z.number().finite().default(0),
  opacity: z.number().min(0).max(1).default(1),
  anchorX: z.number().min(0).max(1).default(0.5),
  anchorY: z.number().min(0).max(1).default(0.5),
  volume: z.number().min(0).max(1).default(1),
});

export const clipSchema = z
  .object({
    id: z.string().min(1).max(64),
    start: nonNegMs,
    end: nonNegMs,
    trimIn: nonNegMs.default(0),
    trimOut: nonNegMs.default(0),
    source: clipSourceSchema,
    base: basePropsSchema,
    tracks: z.partialRecord(z.enum(PROP_NAMES), keyframeTrackSchema).default({}),
    effects: clipEffectsSchema.default({ blendMode: "normal", shadow: null, blur: 0, tint: null }),
  })
  .refine((c) => c.end > c.start, { message: "clip end must be after start" });

export const layerSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(100).default(""),
  type: z.enum(LAYER_TYPES),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  muted: z.boolean().default(false),
  clips: z.array(clipSchema).max(MAX_CLIPS_PER_LAYER).default([]),
});

export const alertSceneSchema = z.object({
  version: z.literal(SCENE_VERSION),
  id: z.string().min(1).max(64),
  name: z.string().max(100).default(""),
  duration: z.number().min(MIN_SCENE_DURATION_MS).max(MAX_SCENE_DURATION_MS),
  width: z.number().min(1).max(MAX_SCENE_SIZE),
  height: z.number().min(1).max(MAX_SCENE_SIZE),
  fps: z.number().min(1).max(240).default(DEFAULT_FPS),
  layers: z.array(layerSchema).max(MAX_LAYERS).default([]),
});

export type AlertSceneInput = z.input<typeof alertSceneSchema>;

function sortClips(clips: Clip[]): Clip[] {
  return [...clips].sort((a, b) => a.start - b.start);
}

function clipsOverlap(clips: Clip[]): boolean {
  for (let i = 1; i < clips.length; i++) {
    if (clips[i]!.start < clips[i - 1]!.end) return true;
  }
  return false;
}

function sortTracks(clip: Clip): Clip {
  const tracks: Clip["tracks"] = {};
  for (const key in clip.tracks) {
    const track = clip.tracks[key as keyof typeof clip.tracks];
    if (!track) continue;
    const seen = new Set<number>();
    const keyframes = [...track.keyframes]
      .sort((a, b) => a.time - b.time)
      .filter((k) => (seen.has(k.time) ? false : (seen.add(k.time), true)));
    if (keyframes.length > 0) tracks[track.property] = { property: track.property, keyframes };
  }
  return { ...clip, tracks };
}

/**
 * Validates and normalises a stored scene. Returns null instead of throwing:
 * a bad row must never take the overlay down, it just plays the legacy alert.
 * Also guarantees the invariants `evaluate()` relies on: clips sorted and
 * disjoint per layer, keyframes sorted with unique times, source kind matching
 * the layer type.
 */
export function parseAlertScene(raw: unknown): AlertScene | null {
  const result = alertSceneSchema.safeParse(raw);
  if (!result.success) return null;
  const scene = result.data as AlertScene;
  const layers: Layer[] = [];
  for (const layer of scene.layers) {
    const clips = sortClips(layer.clips.map(sortTracks));
    if (clipsOverlap(clips)) return null;
    if (clips.some((c) => c.source.kind !== layer.type)) return null;
    layers.push({ ...layer, clips });
  }
  return { ...scene, layers };
}

export function createEmptyScene(init: {
  width?: number;
  height?: number;
  duration?: number;
  name?: string;
}): AlertScene {
  return {
    version: SCENE_VERSION,
    id: createId("scene"),
    name: init.name ?? "",
    duration: init.duration ?? DEFAULT_SCENE_DURATION_MS,
    width: init.width ?? DEFAULT_SCENE_SIZE.width,
    height: init.height ?? DEFAULT_SCENE_SIZE.height,
    fps: DEFAULT_FPS,
    layers: [],
  };
}

export function createDefaultEffects(): ClipEffects {
  return { blendMode: "normal", shadow: null, blur: 0, tint: null };
}

/** A box centred in the scene, anchored at its own centre. */
export function createDefaultBase(scene: Pick<AlertScene, "width" | "height">, box: { width: number; height: number }): BaseProps {
  return {
    x: scene.width / 2,
    y: scene.height / 2,
    width: box.width,
    height: box.height,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 1,
    anchorX: 0.5,
    anchorY: 0.5,
    volume: 1,
  };
}

export function createDefaultSource(type: LayerType): ClipSource {
  switch (type) {
    case "text":
      return textSourceSchema.parse({ kind: "text" });
    case "image":
      return imageSourceSchema.parse({ kind: "image" });
    case "video":
      return videoSourceSchema.parse({ kind: "video" });
    case "audio":
      return audioSourceSchema.parse({ kind: "audio" });
    case "shape":
      return shapeSourceSchema.parse({ kind: "shape" });
  }
}

export function createClip(init: {
  start: number;
  end: number;
  source: ClipSource;
  base: BaseProps;
  trimIn?: number;
  trimOut?: number;
}): Clip {
  return {
    id: createId("clip"),
    start: init.start,
    end: init.end,
    trimIn: init.trimIn ?? 0,
    trimOut: init.trimOut ?? 0,
    source: init.source,
    base: init.base,
    tracks: {},
    effects: createDefaultEffects(),
  };
}

export function createLayer(type: LayerType, name: string, clips: Clip[] = []): Layer {
  return { id: createId("layer"), name, type, visible: true, locked: false, muted: false, clips };
}
