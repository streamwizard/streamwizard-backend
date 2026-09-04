import type { LayerType } from "@repo/alert-scene";

/** One hue per layer type, used by clips and the header icon tint. */
export const LAYER_CLIP_CLASSES: Record<LayerType, string> = {
  text: "bg-violet-500/25 border-violet-400/60 text-violet-100",
  image: "bg-sky-500/25 border-sky-400/60 text-sky-100",
  video: "bg-emerald-500/25 border-emerald-400/60 text-emerald-100",
  audio: "bg-amber-500/25 border-amber-400/60 text-amber-100",
  shape: "bg-pink-500/25 border-pink-400/60 text-pink-100",
};

export const LAYER_ICON_CLASSES: Record<LayerType, string> = {
  text: "text-violet-400",
  image: "text-sky-400",
  video: "text-emerald-400",
  audio: "text-amber-400",
  shape: "text-pink-400",
};

export const LAYER_TYPE_LABELS: Record<LayerType, string> = {
  text: "Text",
  image: "Image",
  video: "Video",
  audio: "Sound",
  shape: "Shape",
};
