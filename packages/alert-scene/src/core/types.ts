/**
 * Alert scene document, version 1.
 *
 * Everything in here is plain data: no DOM, no React, no classes. The
 * renderer and the editor both read it through `evaluate()`, which is what
 * keeps the editor preview and the live overlay identical.
 *
 * Time is milliseconds. Keyframe times are absolute scene time, not relative
 * to the clip: moving a clip shifts its keyframes, trimming an edge does not.
 */

export const SCENE_VERSION = 1 as const;

export const LAYER_TYPES = ["text", "image", "video", "audio", "shape"] as const;
export type LayerType = (typeof LAYER_TYPES)[number];

/** Every animatable property. `base` holds the value when a clip has no track for it. */
export const PROP_NAMES = [
  "x",
  "y",
  "width",
  "height",
  "scaleX",
  "scaleY",
  "rotation",
  "opacity",
  "anchorX",
  "anchorY",
  "volume",
] as const;
export type PropName = (typeof PROP_NAMES)[number];

export type BaseProps = Record<PropName, number>;

/** CSS-style cubic bezier: control points for the segment leaving a keyframe. */
export interface CubicBezierEasing {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type Easing = "linear" | "hold" | CubicBezierEasing;

export interface Keyframe {
  id: string;
  /** Absolute scene time in ms. */
  time: number;
  value: number;
  /** How the value travels from this keyframe to the next one. */
  easing: Easing;
}

export interface KeyframeTrack {
  property: PropName;
  /** Sorted by `time`, unique times. */
  keyframes: Keyframe[];
}

export type FontWeight = 400 | 500 | 600 | 700;
export type TextAlign = "left" | "center" | "right";
export const TEXT_PRESETS = ["none", "typewriter", "stagger"] as const;
export type TextPreset = (typeof TEXT_PRESETS)[number];
export const MEDIA_FITS = ["contain", "cover", "fill"] as const;
export type MediaFit = (typeof MEDIA_FITS)[number];
export const SHAPE_KINDS = ["rect", "ellipse"] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

export interface TextSource {
  kind: "text";
  /** May contain `{tokens}`; substituted by the renderer per alert. */
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: FontWeight;
  color: string;
  align: TextAlign;
  lineHeight: number;
  letterSpacing: number;
  shadow: boolean;
  /** Animate in: how the text arrives over the first `presetDurationMs` of the clip. */
  preset: TextPreset;
  presetDurationMs: number;
  /** Animate out: how the text leaves over the last `presetOutDurationMs` of the clip. */
  presetOut: TextPreset;
  presetOutDurationMs: number;
}

export interface ImageSource {
  kind: "image";
  url: string;
  fit: MediaFit;
}

export interface VideoSource {
  kind: "video";
  url: string;
  loop: boolean;
  fit: MediaFit;
}

export interface AudioSource {
  kind: "audio";
  url: string;
}

export interface ShapeSource {
  kind: "shape";
  shape: ShapeKind;
  fill: string;
  stroke: string;
  strokeWidth: number;
  /** Corner radius for `rect`; ignored by `ellipse`. */
  radius: number;
}

export type ClipSource = TextSource | ImageSource | VideoSource | AudioSource | ShapeSource;

export const BLEND_MODES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "lighten",
  "darken",
  "difference",
] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

/** Static per-clip effects. Not keyframable in v1. */
export interface ClipEffects {
  blendMode: BlendMode;
  shadow: { x: number; y: number; blur: number; color: string } | null;
  /** px */
  blur: number;
  tint: { color: string; amount: number } | null;
}

export interface Clip {
  id: string;
  /** Scene ms. Active while `start <= t < end`. */
  start: number;
  end: number;
  /** ms into the source media where playback begins. 0 for non-media clips. */
  trimIn: number;
  /** ms cut from the end of the source media. 0 for non-media clips. */
  trimOut: number;
  source: ClipSource;
  base: BaseProps;
  tracks: Partial<Record<PropName, KeyframeTrack>>;
  effects: ClipEffects;
}

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  muted: boolean;
  /** Sorted by `start`, non-overlapping. Usually one per layer for an alert. */
  clips: Clip[];
}

export interface AlertScene {
  version: typeof SCENE_VERSION;
  id: string;
  name: string;
  /** ms */
  duration: number;
  /** Scene px. Defaults to the alert box's design size. */
  width: number;
  height: number;
  /** Editor frame snapping only. Evaluation is continuous. */
  fps: number;
  /** z-order: index 0 is the bottom. */
  layers: Layer[];
}

/** One clip resolved at a point in time. */
export interface RenderNode {
  layerId: string;
  clipId: string;
  type: LayerType;
  source: ClipSource;
  effects: ClipEffects;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  anchorX: number;
  anchorY: number;
  /** Already 0 on a muted layer. */
  volume: number;
  /** ms since the clip started. */
  localTime: number;
  /** ms into the source media (`trimIn + localTime`). */
  mediaTime: number;
  clipDuration: number;
}

export interface RenderState {
  time: number;
  width: number;
  height: number;
  /** Active clips of visible layers, bottom first. */
  nodes: RenderNode[];
}
