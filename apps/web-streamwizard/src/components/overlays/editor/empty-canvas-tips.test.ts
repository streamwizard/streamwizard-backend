import { expect, test } from "bun:test";
import {
  EMPTY_CANVAS_TIPS,
  nextTipIndex,
  resolveEmptyCanvasTips,
} from "./empty-canvas-tips";
import type { EditorShortcutGroup } from "./editor-shortcuts";

test("every tip points at a shortcut that still exists", () => {
  const resolved = resolveEmptyCanvasTips();
  expect(resolved.map((tip) => tip.text)).toEqual(EMPTY_CANVAS_TIPS.map((tip) => tip.text));
  for (const tip of resolved) expect(tip.keys.length).toBeGreaterThan(0);
});

test("a tip whose action was renamed drops out rather than showing blank chips", () => {
  const groups: EditorShortcutGroup[] = [
    {
      title: "Test",
      description: "",
      shortcuts: [{ action: "Undo", combos: [["Mod", "Z"], ["Mod", "U"]] }],
    },
  ];
  const resolved = resolveEmptyCanvasTips(groups, [
    { text: "Undo", action: "Undo" },
    { text: "Gone", action: "No such action" },
  ]);
  expect(resolved).toEqual([{ text: "Undo", keys: ["Mod", "Z"], opensShortcuts: false }]);
});

test("the shortcuts reference is in the rotation with its own key", () => {
  const tip = resolveEmptyCanvasTips().find((t) => t.opensShortcuts);
  expect(tip?.keys).toEqual(["?"]);
});

test("nextTipIndex wraps and survives an empty list", () => {
  expect(nextTipIndex(0, 3)).toBe(1);
  expect(nextTipIndex(2, 3)).toBe(0);
  expect(nextTipIndex(5, 0)).toBe(0);
});
