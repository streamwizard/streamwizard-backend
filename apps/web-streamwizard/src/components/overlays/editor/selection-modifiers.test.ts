import { expect, test } from "bun:test";
import { extendsSelection } from "./selection-modifiers";

const click = (mods: Partial<{ shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }> = {}) => ({
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  ...mods,
});

test("a plain click replaces the selection", () => {
  expect(extendsSelection(click(), false)).toBe(false);
  expect(extendsSelection(click(), true)).toBe(false);
});

test("shift extends on every platform", () => {
  expect(extendsSelection(click({ shiftKey: true }), false)).toBe(true);
  expect(extendsSelection(click({ shiftKey: true }), true)).toBe(true);
});

test("Ctrl extends on Windows and Linux", () => {
  expect(extendsSelection(click({ ctrlKey: true }), false)).toBe(true);
});

test("Cmd extends on macOS", () => {
  expect(extendsSelection(click({ metaKey: true }), true)).toBe(true);
});

test("Ctrl does not extend on macOS: that click is a right-click", () => {
  // Accepting it would toggle the selection and open the context menu at once.
  expect(extendsSelection(click({ ctrlKey: true }), true)).toBe(false);
});

test("Cmd does not extend off macOS, where it is the Windows key", () => {
  expect(extendsSelection(click({ metaKey: true }), false)).toBe(false);
});
