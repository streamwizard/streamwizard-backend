import { expect, test } from "bun:test";
import {
  activatableControl,
  keepsSpace,
  movesFocus,
  type SpaceTarget,
} from "./space-activation";

/** A stand-in for a focused control, with the blur calls it received. */
function control() {
  const blurred: true[] = [];
  const el: SpaceTarget = {
    closest: (selector) => (selector.includes("button") ? el : null),
    blur: () => {
      blurred.push(true);
    },
  };
  return { el, blurred };
}

const canvasNode: SpaceTarget = { closest: () => null };

test("focus-moving keys are the ones that mark focus as keyboard-driven", () => {
  expect(movesFocus("Tab")).toBe(true);
  expect(movesFocus("ArrowLeft")).toBe(true);
  expect(movesFocus("Home")).toBe(true);
  expect(movesFocus(" ")).toBe(false);
  expect(movesFocus("a")).toBe(false);
});

test("the canvas keeps Space when nothing activatable is focused", () => {
  expect(keepsSpace(canvasNode, true)).toBe(false);
  expect(keepsSpace(null, true)).toBe(false);
  expect(keepsSpace(undefined, true)).toBe(false);
});

test("a control reached by keyboard keeps Space for itself", () => {
  expect(keepsSpace(control().el, true)).toBe(true);
});

test("a control clicked with the mouse gives Space back to the canvas", () => {
  // The zoom buttons: clicking one leaves it focused, so holding Space to pan
  // must not re-fire it on release.
  expect(keepsSpace(control().el, false)).toBe(false);
});

test("an open menu or dialog keeps Space however it was opened", () => {
  const inMenu: SpaceTarget = { closest: (selector) => (selector.includes("menu") ? inMenu : null) };
  expect(keepsSpace(inMenu, false)).toBe(true);
});

test("the focused control is found so the pan can blur it", () => {
  const { el, blurred } = control();
  activatableControl(el)?.blur?.();
  expect(blurred).toHaveLength(1);
  expect(activatableControl(canvasNode)).toBeNull();
  expect(activatableControl(null)).toBeNull();
});
