import type { AlertAnimationIn, AlertAnimationOut, AlertLayout } from "@repo/ui/overlay";

/** Human labels for the alert widget's layout and animation options. */

export const LAYOUT_LABELS: Record<AlertLayout, string> = {
  stacked: "Media above text",
  row: "Media beside text",
  overlay: "Text over media",
};

export const ANIMATION_IN_LABELS: Record<AlertAnimationIn, string> = {
  fade: "Fade in",
  slide_up: "Slide up",
  slide_down: "Slide down",
  zoom: "Zoom in",
  bounce: "Bounce in",
};

export const ANIMATION_OUT_LABELS: Record<AlertAnimationOut, string> = {
  fade: "Fade out",
  slide_down: "Slide down",
  zoom: "Zoom out",
};
