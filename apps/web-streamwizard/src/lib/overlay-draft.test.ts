import { beforeEach, expect, test } from "bun:test";
import {
  clearOverlayDraft,
  isDraftNewerThan,
  parseOverlayDraft,
  readOverlayDraft,
  writeOverlayDraft,
  type OverlayDraft,
} from "./overlay-draft";
import type { OverlayItem } from "@/types/overlays";

/** The helpers only touch getItem/setItem/removeItem, so this is enough of one. */
function installLocalStorage() {
  const rows = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => rows.get(key) ?? null,
      setItem: (key: string, value: string) => void rows.set(key, value),
      removeItem: (key: string) => void rows.delete(key),
    },
  };
  return rows;
}

function makeItem(label: string): OverlayItem {
  return {
    id: "item-1",
    scene_id: "scene-1",
    type: "text_widget",
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
    anchor_x: "left",
    anchor_y: "top",
    z_index: 1,
    rotation: 0,
    flip_h: false,
    flip_v: false,
    opacity: 1,
    is_visible: true,
    is_locked: false,
    label,
    config: {} as OverlayItem["config"],
  };
}

let rows: Map<string, string>;
beforeEach(() => {
  rows = installLocalStorage();
});

test("a written draft reads back with its items", () => {
  writeOverlayDraft("scene-1", [makeItem("Hello")]);
  const draft = readOverlayDraft("scene-1");
  expect(draft?.items).toHaveLength(1);
  expect(draft?.items[0]?.label).toBe("Hello");
});

test("clearing removes the draft", () => {
  writeOverlayDraft("scene-1", [makeItem("Hello")]);
  clearOverlayDraft("scene-1");
  expect(readOverlayDraft("scene-1")).toBeNull();
});

test("drafts are scoped per scene", () => {
  writeOverlayDraft("scene-1", [makeItem("Hello")]);
  expect(readOverlayDraft("scene-2")).toBeNull();
});

test("a draft claiming another scene is refused", () => {
  const foreign = JSON.stringify({ sceneId: "scene-9", items: [], savedAt: "2026-09-01T00:00:00Z" });
  expect(parseOverlayDraft(foreign, "scene-1")).toBeNull();
});

test("junk in storage parses as no draft", () => {
  expect(parseOverlayDraft("{not json", "scene-1")).toBeNull();
  expect(parseOverlayDraft(JSON.stringify({ sceneId: "scene-1" }), "scene-1")).toBeNull();
});

test("a draft bigger than the cap is not stored", () => {
  writeOverlayDraft("scene-1", [makeItem("x".repeat(2_100_000))]);
  expect(rows.size).toBe(0);
});

test("an oversized write clears a draft that was already there", () => {
  writeOverlayDraft("scene-1", [makeItem("small")]);
  writeOverlayDraft("scene-1", [makeItem("x".repeat(2_100_000))]);
  expect(readOverlayDraft("scene-1")).toBeNull();
});

const draftAt = (savedAt: string): OverlayDraft => ({ sceneId: "scene-1", items: [], savedAt });

test("a draft newer than the server copy is worth offering", () => {
  expect(isDraftNewerThan(draftAt("2026-09-01T12:00:00Z"), "2026-09-01T11:00:00Z")).toBe(true);
});

test("a draft older than the server copy is stale", () => {
  expect(isDraftNewerThan(draftAt("2026-09-01T10:00:00Z"), "2026-09-01T11:00:00Z")).toBe(false);
});

test("an unreadable timestamp never offers", () => {
  expect(isDraftNewerThan(draftAt("whenever"), "2026-09-01T11:00:00Z")).toBe(false);
});
