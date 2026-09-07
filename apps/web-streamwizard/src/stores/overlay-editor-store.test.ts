import { beforeEach, expect, test } from "bun:test";
import { useOverlayStore } from "./overlay-editor-store";
import type { OverlayItem, OverlaySceneWithItems } from "@/types/overlays";
import { resolveAnchoredPosition } from "@repo/ui/overlay";

function makeItem(id: string, config: Record<string, unknown>): OverlayItem {
  return {
    id,
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
    label: "Text",
    config: config as unknown as OverlayItem["config"],
  };
}

function makeScene(items: OverlayItem[]): OverlaySceneWithItems {
  return {
    id: "scene-1",
    user_id: "user-1",
    name: "Scene",
    slug: "scene",
    subscriber_token: "token",
    width: 1920,
    height: 1080,
    is_active: true,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    items,
  };
}

/** Lets a burst's same-tick guard clear without waiting out the time window. */
const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  // setScene is the real entry point: it clears history and ends any edit
  // burst, so each test starts from the same place.
  useOverlayStore.setState({ selectedItemIds: [], isDirty: false });
  useOverlayStore
    .getState()
    .setScene(makeScene([makeItem("a", { title: "one", color: "#fff" })]));
});

test("a config edit records an undo step", async () => {
  const { updateItem } = useOverlayStore.getState();
  updateItem("a", { config: { title: "two", color: "#fff" } as never });

  expect(useOverlayStore.getState().history.past).toHaveLength(1);

  useOverlayStore.getState().undo();
  const item = useOverlayStore.getState().scene!.items[0]!;
  expect((item.config as unknown as { title: string }).title).toBe("one");
  await nextTick();
});

test("typing in one field collapses into a single step", async () => {
  const values = ["o", "on", "one!"];
  for (const title of values) {
    useOverlayStore.getState().updateItem("a", { config: { title, color: "#fff" } as never });
    await nextTick();
  }
  expect(useOverlayStore.getState().history.past).toHaveLength(1);
});

test("a different field starts its own step", async () => {
  useOverlayStore.getState().updateItem("a", { config: { title: "two", color: "#fff" } as never });
  await nextTick();
  useOverlayStore.getState().updateItem("a", { config: { title: "two", color: "#000" } as never });
  await nextTick();
  expect(useOverlayStore.getState().history.past).toHaveLength(2);
});

test("a write that changes nothing records no step", async () => {
  useOverlayStore.getState().updateItem("a", { config: { title: "one", color: "#fff" } as never });
  await nextTick();
  expect(useOverlayStore.getState().history.past).toHaveLength(0);
});

test("history:false keeps a load-time patch out of the stack", async () => {
  useOverlayStore
    .getState()
    .updateItem("a", { config: { title: "adopted", color: "#fff" } as never }, { history: false });
  await nextTick();
  expect(useOverlayStore.getState().history.past).toHaveLength(0);
});

test("two items written in one tick stay one step", async () => {
  useOverlayStore
    .getState()
    .setScene(makeScene([makeItem("a", { stackOrder: 0 }), makeItem("b", { stackOrder: 1 })]));

  const { updateItem } = useOverlayStore.getState();
  updateItem("a", { config: { stackOrder: 1 } as never });
  updateItem("b", { config: { stackOrder: 0 } as never });
  await nextTick();

  expect(useOverlayStore.getState().history.past).toHaveLength(1);
});

test("setScene without an id map starts a fresh history", () => {
  useOverlayStore.getState().updateItem("a", { config: { title: "two", color: "#fff" } as never });
  expect(useOverlayStore.getState().history.past).toHaveLength(1);

  useOverlayStore.getState().setScene(makeScene([makeItem("a", { title: "two" })]));
  expect(useOverlayStore.getState().history.past).toHaveLength(0);
});

test("setScene with an id map keeps history and rewrites temp ids", () => {
  useOverlayStore.getState().setScene(makeScene([makeItem("temp-1", { title: "one" })]));
  useOverlayStore.setState({
    history: {
      past: [{ items: [makeItem("temp-1", { title: "before" })], width: 1920, height: 1080 }],
      future: [],
    },
  });

  useOverlayStore
    .getState()
    .setScene(makeScene([makeItem("db-1", { title: "one" })]), { idMap: { "temp-1": "db-1" } });

  const past = useOverlayStore.getState().history.past;
  expect(past).toHaveLength(1);
  expect(past[0]!.items[0]!.id).toBe("db-1");
});

test("a clip child's parent ref follows the remap", () => {
  const child = makeItem("temp-c", { parentClipItemId: "temp-p", fieldKey: "title" });
  useOverlayStore.getState().setScene(makeScene([]));
  useOverlayStore.setState({
    history: {
      past: [{ items: [makeItem("temp-p", {}), child], width: 1920, height: 1080 }],
      future: [],
    },
  });

  useOverlayStore.getState().setScene(makeScene([]), {
    idMap: { "temp-p": "db-p", "temp-c": "db-c" },
  });

  const restored = useOverlayStore.getState().history.past[0]!.items;
  expect(restored[0]!.id).toBe("db-p");
  expect(
    (restored[1]!.config as unknown as { parentClipItemId: string }).parentClipItemId
  ).toBe("db-p");
});

test("aligning a lone item to the right pins it there", () => {
  const { alignSelected } = useOverlayStore.getState();
  useOverlayStore.setState({ selectedItemIds: ["a"] });
  alignSelected("right");
  const item = useOverlayStore.getState().scene!.items[0]!;
  expect(item.anchor_x).toBe("right");
  expect(item.x).toBe(0);
  // It is really on the right edge of the 1920-wide scene.
  expect(resolveAnchoredPosition(item, { width: 1920, height: 1080 }).x).toBe(1820);
  expect(useOverlayStore.getState().history.past).toHaveLength(1);
});

test("nudging a right-pinned item moves it the way the arrow points", () => {
  const { updateItem, nudgeSelected } = useOverlayStore.getState();
  updateItem("a", { anchor_x: "right", x: 100 });
  useOverlayStore.setState({ selectedItemIds: ["a"] });
  const before = resolveAnchoredPosition(useOverlayStore.getState().scene!.items[0]!, {
    width: 1920,
    height: 1080,
  });
  nudgeSelected(10, 0);
  const item = useOverlayStore.getState().scene!.items[0]!;
  expect(resolveAnchoredPosition(item, { width: 1920, height: 1080 }).x).toBe(before.x + 10);
  // Stored as a smaller gap to the right edge.
  expect(item.x).toBe(90);
});

test("a geometry patch never resolves outside the scene, whatever the anchor", () => {
  const { updateItem } = useOverlayStore.getState();
  updateItem("a", { anchor_x: "right", anchor_y: "bottom", x: 5000, y: -5000 });
  const item = useOverlayStore.getState().scene!.items[0]!;
  const position = resolveAnchoredPosition(item, { width: 1920, height: 1080 });
  expect(position).toEqual({ x: 0, y: 980 });
});

test("flipping a multi-selection is one undo step and skips locked items", () => {
  const { setScene } = useOverlayStore.getState();
  setScene(makeScene([makeItem("a", {}), { ...makeItem("b", {}), is_locked: true }]));
  useOverlayStore.setState({ selectedItemIds: ["a", "b"] });

  useOverlayStore.getState().flipSelected("horizontal");
  const byId = (id: string) => useOverlayStore.getState().scene!.items.find((i) => i.id === id)!;
  expect(byId("a").flip_h).toBe(true);
  expect(byId("b").flip_h).toBe(false);
  expect(byId("a").flip_v).toBe(false);
  expect(useOverlayStore.getState().history.past).toHaveLength(1);

  useOverlayStore.getState().undo();
  expect(byId("a").flip_h).toBe(false);
});

test("flipping only locked items writes nothing, not even an undo step", () => {
  const { setScene } = useOverlayStore.getState();
  setScene(makeScene([{ ...makeItem("a", {}), is_locked: true }]));
  useOverlayStore.setState({ selectedItemIds: ["a"] });
  useOverlayStore.getState().flipSelected("vertical");
  expect(useOverlayStore.getState().scene!.items[0]!.flip_v).toBe(false);
  expect(useOverlayStore.getState().history.past).toHaveLength(0);
});
