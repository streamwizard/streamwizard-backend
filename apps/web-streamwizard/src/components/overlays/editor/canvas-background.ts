import type { CSSProperties } from "react";
import type { CanvasBackground } from "./canvas-preferences";

const CHECKER_LIGHT = "#5a5a5a";
const CHECKER_DARK = "#3f3f3f";
const CHECKER_TILE_PX = 16;

const DARK = "#000000";
const LIGHT = "#f4f4f5";
const GREY = "#808080";
// Streamers key against this, so it doubles as a chroma preview.
const GREEN = "#00b140";

/**
 * What sits behind the widgets while designing. Purely an editor aid — the live
 * overlay is always transparent.
 *
 * The checkerboard is the one that earns its place: against a flat colour a
 * transparent PNG's soft edges are invisible, and a halo only shows up once it
 * is over something with contrast in it.
 */
export const CANVAS_BACKGROUND_STYLES: Record<CanvasBackground, CSSProperties> = {
  // Opaque, not rgba(...,0.9): a translucent fill composites with whatever is
  // behind it, so the canvas ends up a slightly different black to everything
  // around it instead of one flat colour.
  dark: { background: DARK },
  light: { background: LIGHT },
  grey: { background: GREY },
  green: { background: GREEN },
  checker: {
    backgroundColor: CHECKER_DARK,
    backgroundImage: `
      linear-gradient(45deg, ${CHECKER_LIGHT} 25%, transparent 25%),
      linear-gradient(-45deg, ${CHECKER_LIGHT} 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, ${CHECKER_LIGHT} 75%),
      linear-gradient(-45deg, transparent 75%, ${CHECKER_LIGHT} 75%)
    `,
    backgroundSize: `${CHECKER_TILE_PX * 2}px ${CHECKER_TILE_PX * 2}px`,
    backgroundPosition: `0 0, 0 ${CHECKER_TILE_PX}px, ${CHECKER_TILE_PX}px -${CHECKER_TILE_PX}px, -${CHECKER_TILE_PX}px 0`,
  },
};

/**
 * The one flat colour each background reads as, for deciding what shows on
 * top of it. The checkerboard takes its darker tile: text has to clear the
 * worse of the two.
 */
const CANVAS_BACKGROUND_BASE: Record<CanvasBackground, string> = {
  dark: DARK,
  light: LIGHT,
  grey: GREY,
  green: GREEN,
  checker: CHECKER_DARK,
};

/** Which colour text is drawn in over the canvas: light ink on a dark canvas, dark ink on a light one. */
export type CanvasInk = "light" | "dark";

function channel(hex: string, offset: number): number {
  const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a `#rrggbb` colour, 0 for black to 1 for white. */
export function relativeLuminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

/**
 * White beats black on a background once its luminance drops under ~0.18:
 * that is where (1.05 / (L + 0.05)) and ((L + 0.05) / 0.05) cross.
 */
const LIGHT_INK_BELOW = 0.179;

export function canvasInk(background: CanvasBackground): CanvasInk {
  return relativeLuminance(CANVAS_BACKGROUND_BASE[background]) < LIGHT_INK_BELOW
    ? "light"
    : "dark";
}

/** Precomputed once: the backgrounds never change at runtime. */
export const CANVAS_BACKGROUND_INK: Record<CanvasBackground, CanvasInk> = {
  dark: canvasInk("dark"),
  light: canvasInk("light"),
  grey: canvasInk("grey"),
  green: canvasInk("green"),
  checker: canvasInk("checker"),
};
