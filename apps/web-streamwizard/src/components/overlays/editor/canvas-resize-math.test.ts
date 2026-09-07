import { expect, test } from "bun:test";
import { resolveDragAxis } from "./canvas-resize-math";

const THRESHOLD = 4;

test("a short drag has not committed to an axis yet", () => {
  expect(resolveDragAxis(1, 1, 1, THRESHOLD)).toBeNull();
  expect(resolveDragAxis(-3, 2, 1, THRESHOLD)).toBeNull();
});

test("the dominant axis wins once the pointer has travelled", () => {
  expect(resolveDragAxis(40, 5, 1, THRESHOLD)).toBe("x");
  expect(resolveDragAxis(5, 40, 1, THRESHOLD)).toBe("y");
  expect(resolveDragAxis(-40, 5, 1, THRESHOLD)).toBe("x");
});

test("an exact diagonal goes horizontal rather than dithering", () => {
  expect(resolveDragAxis(20, 20, 1, THRESHOLD)).toBe("x");
});

test("the threshold measures pointer travel, not scene travel", () => {
  // Zoomed out to 25%, a 12-unit scene delta is only 3 real pixels of hand movement.
  expect(resolveDragAxis(12, 0, 0.25, THRESHOLD)).toBeNull();
  expect(resolveDragAxis(20, 0, 0.25, THRESHOLD)).toBe("x");
});
