/**
 * The timeline modal's shortcut list, written out by hand for the reference
 * dialog. Nothing here is derived: the bindings live in
 * `use-timeline-shortcuts.ts` and the drag modifiers in `clip-block.tsx`,
 * `keyframe-marker.tsx` and `preview/stage-overlay.tsx`. Change one of those,
 * change this.
 */

import { MOD_KEY_TOKEN, type EditorShortcutGroup } from "@/components/overlays/editor/editor-shortcuts";

export const TIMELINE_SHORTCUT_GROUPS: EditorShortcutGroup[] = [
  {
    title: "Transport",
    description: "Moving through the alert.",
    shortcuts: [
      { action: "Play or pause", combos: [["Space"]] },
      { action: "Test: play once from the start with the sample alert", combos: [["T"]] },
      { action: "Jump to the start or the end", combos: [["Home"], ["End"]] },
      { action: "Step one frame (nothing selected)", combos: [["←", "→"]] },
      { action: "Step ten frames", combos: [["Shift", "←", "→"]] },
      { action: "Previous or next keyframe on the selected clip", combos: [["J"], ["K"]] },
      { action: "Loop, on and off", combos: [["L"]] },
    ],
  },
  {
    title: "Editing",
    description: "Work anywhere in the timeline, except while you're typing in a field.",
    shortcuts: [
      { action: "Save to the alert box", combos: [[MOD_KEY_TOKEN, "S"]] },
      { action: "Undo", combos: [[MOD_KEY_TOKEN, "Z"]] },
      { action: "Redo", combos: [[MOD_KEY_TOKEN, "Shift", "Z"], [MOD_KEY_TOKEN, "Y"]] },
      { action: "Split the selected clip at the playhead", combos: [["S"]] },
      { action: "Duplicate the selected clip or layer", combos: [[MOD_KEY_TOKEN, "D"]] },
      { action: "Delete the selected keyframe, clip or layer", combos: [["Delete"], ["Backspace"]] },
      { action: "Delete the clip and close the gap it leaves", combos: [["Shift", "Delete"]] },
      { action: "Nudge the selected clip by a frame", combos: [["←", "→"]] },
      { action: "Nudge by ten frames", combos: [["Shift", "←", "→"]] },
      { action: "Hold while dragging to flip snapping for that drag", combos: [["Alt", "Drag"]] },
      { action: "Cancel the drag you are in", combos: [["Esc"]] },
    ],
  },
  {
    title: "View",
    description: "The timeline itself.",
    shortcuts: [
      { action: "Zoom in and out", combos: [["+"], ["-"]] },
      { action: "Zoom around the cursor", combos: [[MOD_KEY_TOKEN, "Scroll"]] },
      { action: "Fit the whole alert", combos: [["Shift", "0"]] },
      { action: "Park the playhead on a keyframe", combos: [["Double-click a keyframe"]] },
    ],
  },
  {
    title: "Stage",
    description: "Dragging things on the preview.",
    shortcuts: [
      { action: "Move along one axis only", combos: [["Shift", "Drag"]] },
      { action: "Keep the shape while resizing", combos: [["Shift", "Drag a corner"]] },
      { action: "Rotate in 15° steps", combos: [["Shift", "Drag the rotate handle"]] },
    ],
  },
];
