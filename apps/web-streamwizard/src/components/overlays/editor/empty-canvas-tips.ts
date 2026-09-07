/**
 * The handful of shortcuts worth showing on an empty canvas, one at a time.
 *
 * Each tip names a shortcut by its `action` in `EDITOR_SHORTCUT_GROUPS` and
 * borrows the key chips from there, so a rebinding only has to be fixed in one
 * place. A tip whose action no longer exists silently drops out of the
 * rotation; the test pins the list so that can't happen unnoticed.
 */

import {
  EDITOR_SHORTCUT_GROUPS,
  SHORTCUTS_DIALOG_KEY,
  type EditorShortcutGroup,
} from "./editor-shortcuts";

interface EmptyCanvasTipBase {
  /** Read ahead of the chips: "Nudge a widget 1px" [↑][↓][←][→]. */
  text: string;
  /** Clicking the tip opens the shortcuts reference. */
  opensShortcuts?: boolean;
}

export type EmptyCanvasTip = EmptyCanvasTipBase &
  (
    | { /** The shortcut's `action` in `EDITOR_SHORTCUT_GROUPS`. */ action: string }
    | { /** Chips written out, for the one key that lives outside the groups. */ keys: string[] }
  );

export interface ResolvedEmptyCanvasTip {
  text: string;
  /** The shortcut's first combo; alternates would only crowd the line. */
  keys: string[];
  opensShortcuts: boolean;
}

export const EMPTY_CANVAS_TIPS: EmptyCanvasTip[] = [
  { text: "See every shortcut", keys: [SHORTCUTS_DIALOG_KEY], opensShortcuts: true },
  { text: "Nudge a widget 1px", action: "Nudge by 1 pixel" },
  { text: "Nudge 10px at a time", action: "Nudge by 10 pixels" },
  { text: "Fit the whole scene on screen", action: "Fit the scene on screen" },
  { text: "Zoom back to 100%", action: "Zoom back to 100%" },
  { text: "Snap to other widgets", action: "Snap to other widgets, on and off" },
  { text: "Duplicate the selection", action: "Duplicate what's selected" },
  { text: "Toggle the grid", action: "Show or hide the grid" },
  { text: "Undo, as often as you like", action: "Undo" },
  { text: "Crop instead of resize", action: "Crop instead of resize" },
];

/** How long each tip stays up. Long enough to read twice, short enough to feel alive. */
export const EMPTY_CANVAS_TIP_INTERVAL_MS = 6000;

export function resolveEmptyCanvasTips(
  groups: EditorShortcutGroup[] = EDITOR_SHORTCUT_GROUPS,
  tips: EmptyCanvasTip[] = EMPTY_CANVAS_TIPS
): ResolvedEmptyCanvasTip[] {
  const byAction = new Map(
    groups.flatMap((group) => group.shortcuts).map((shortcut) => [shortcut.action, shortcut])
  );
  return tips.flatMap((tip) => {
    const keys = "keys" in tip ? tip.keys : byAction.get(tip.action)?.combos[0];
    return keys ? [{ text: tip.text, keys, opensShortcuts: tip.opensShortcuts ?? false }] : [];
  });
}

export function nextTipIndex(current: number, count: number): number {
  if (count <= 0) return 0;
  return (current + 1) % count;
}
