import { expect, test } from "bun:test";
import {
  OVERLAY_EXPORT_KIND,
  OVERLAY_EXPORT_SCHEMA_VERSION,
  overlayExportDocumentSchema,
} from "./overlay-export";

function item(ref: string, type: string, config: Record<string, unknown> = {}) {
  return {
    ref,
    type,
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    design_w: 100,
    design_h: 100,
    crop_top: 0,
    crop_right: 0,
    crop_bottom: 0,
    crop_left: 0,
    z_index: 1,
    rotation: 0,
    flip_h: false,
    flip_v: false,
    opacity: 1,
    is_visible: true,
    is_locked: false,
    label: "Thing",
    config,
  };
}

const doc = {
  kind: OVERLAY_EXPORT_KIND,
  schemaVersion: OVERLAY_EXPORT_SCHEMA_VERSION,
  exportedAt: "2026-09-01T12:00:00.000Z",
  scene: { name: "My overlay", width: 1920, height: 1080, render_mode: "obs" },
  items: [
    item("item-0", "clips_widget", { folderIds: ["f1"], sort: "newest" }),
    item("item-1", "clip_display_field", { parentClipItemId: "item-0" }),
  ],
  widgets: [],
};

test("a well-formed document parses", () => {
  expect(overlayExportDocumentSchema.safeParse(doc).success).toBe(true);
});

test("widgets defaults to an empty list", () => {
  const withoutWidgets = { ...doc, widgets: undefined };
  expect(overlayExportDocumentSchema.parse(withoutWidgets).widgets).toEqual([]);
});

test("a file from somewhere else is rejected on kind", () => {
  expect(
    overlayExportDocumentSchema.safeParse({ ...doc, kind: "something.else" }).success
  ).toBe(false);
});

test("a truncated document is rejected", () => {
  const { items, ...truncated } = doc;
  void items;
  expect(overlayExportDocumentSchema.safeParse(truncated).success).toBe(false);
});

test("a file from before anchors existed reads as top-left", () => {
  // `item()` deliberately carries no anchor fields.
  const parsed = overlayExportDocumentSchema.parse(doc);
  expect(parsed.items[0]).toMatchObject({ anchor_x: "left", anchor_y: "top" });
});

test("a file from before flipping existed reads as unflipped", () => {
  const legacy: Record<string, unknown> = { ...item("item-0", "text_widget") };
  delete legacy.flip_h;
  delete legacy.flip_v;
  const parsed = overlayExportDocumentSchema.parse({ ...doc, items: [legacy] });
  expect(parsed.items[0]).toMatchObject({ flip_h: false, flip_v: false });
});

test("an anchor the renderer does not know is rejected", () => {
  const broken = { ...doc, items: [{ ...doc.items[0], anchor_x: "middle" }] };
  expect(overlayExportDocumentSchema.safeParse(broken).success).toBe(false);
});

test("a hand-edited item is rejected, not coerced", () => {
  const broken = { ...doc, items: [{ ...doc.items[0], w: "wide" }] };
  expect(overlayExportDocumentSchema.safeParse(broken).success).toBe(false);
});

test("a newer schema version does not parse as this one", () => {
  expect(
    overlayExportDocumentSchema.safeParse({
      ...doc,
      schemaVersion: OVERLAY_EXPORT_SCHEMA_VERSION + 1,
    }).success
  ).toBe(false);
});

test("an absurd item count is refused", () => {
  const many = {
    ...doc,
    items: Array.from({ length: 501 }, (_, i) => item(`item-${i}`, "text_widget")),
  };
  expect(overlayExportDocumentSchema.safeParse(many).success).toBe(false);
});
