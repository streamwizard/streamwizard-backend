import { describe, expect, it } from "bun:test";
import { overlayItemFromDbRow, type OverlayItemDbRow } from "./item";

const legacyRow: OverlayItemDbRow = {
  id: "item-1",
  scene_id: "scene-1",
  type: "text_widget",
  x: 10,
  y: 20,
  w: 100,
  h: 50,
  z_index: 1,
  rotation: 0,
  opacity: 1,
  is_visible: true,
  is_locked: false,
  label: "Text",
  config: {},
};

describe("overlayItemFromDbRow", () => {
  it("renders a row from before flipping existed unflipped", () => {
    const item = overlayItemFromDbRow(legacyRow);
    expect(item.flip_h).toBe(false);
    expect(item.flip_v).toBe(false);
  });

  it("keeps a stored flip", () => {
    const item = overlayItemFromDbRow({ ...legacyRow, flip_h: true, flip_v: null });
    expect(item.flip_h).toBe(true);
    expect(item.flip_v).toBe(false);
  });
});
