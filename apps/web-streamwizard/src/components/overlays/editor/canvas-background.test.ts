import { expect, test } from "bun:test";
import {
  CANVAS_BACKGROUND_INK,
  CANVAS_BACKGROUND_STYLES,
  canvasInk,
  relativeLuminance,
} from "./canvas-background";
import type { CanvasBackground } from "./canvas-preferences";

const ALL_BACKGROUNDS: CanvasBackground[] = ["dark", "checker", "light", "grey", "green"];

test("relativeLuminance runs from black to white", () => {
  expect(relativeLuminance("#000000")).toBe(0);
  expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  expect(relativeLuminance("#808080")).toBeCloseTo(0.2159, 3);
});

test("dark canvases get light ink, light canvases get dark ink", () => {
  expect(canvasInk("dark")).toBe("light");
  expect(canvasInk("checker")).toBe("light");
  expect(canvasInk("light")).toBe("dark");
  // Mid grey and chroma green both read better under black than white.
  expect(canvasInk("grey")).toBe("dark");
  expect(canvasInk("green")).toBe("dark");
});

test("every background has a style and an ink", () => {
  for (const background of ALL_BACKGROUNDS) {
    expect(CANVAS_BACKGROUND_STYLES[background]).toBeDefined();
    expect(CANVAS_BACKGROUND_INK[background]).toBe(canvasInk(background));
  }
});
