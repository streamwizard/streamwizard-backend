import { beforeEach, expect, test } from "bun:test";
import {
  DEFAULT_OVERLAY_SORT,
  OVERLAY_SORT_STORAGE_KEY,
  filterScenes,
  isOverlaySortKey,
  readOverlaySort,
  saveOverlaySort,
  sortScenes,
  subscribeOverlaySort,
  type ListableScene,
} from "./overlay-list";

function scene(name: string, overrides: Partial<Omit<ListableScene, "name">> = {}): ListableScene & { id: string } {
  return {
    id: name,
    name,
    created_at: "2026-01-01T00:00:00.000+00:00",
    updated_at: "2026-01-01T00:00:00.000+00:00",
    is_favourite: false,
    ...overrides,
  };
}

function names(scenes: ListableScene[]): string[] {
  return scenes.map((s) => s.name);
}

function installLocalStorage() {
  const rows = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: {
      getItem: (key: string) => rows.get(key) ?? null,
      setItem: (key: string, value: string) => void rows.set(key, value),
      removeItem: (key: string) => void rows.delete(key),
    },
  };
  return rows;
}

beforeEach(() => {
  installLocalStorage();
});

// --- filter ---

test("an empty or whitespace query keeps every scene, same array", () => {
  const scenes = [scene("Main"), scene("Starting soon")];
  expect(filterScenes(scenes, "")).toBe(scenes);
  expect(filterScenes(scenes, "   ")).toBe(scenes);
});

test("filter matches anywhere in the name, ignoring case and surrounding spaces", () => {
  const scenes = [scene("Main stream"), scene("Starting soon"), scene("BRB screen")];
  expect(names(filterScenes(scenes, "STREAM"))).toEqual(["Main stream"]);
  expect(names(filterScenes(scenes, "  soon "))).toEqual(["Starting soon"]);
  expect(names(filterScenes(scenes, "s"))).toEqual(["Main stream", "Starting soon", "BRB screen"]);
  expect(filterScenes(scenes, "nope")).toEqual([]);
});

// --- sort ---

test("updated sort puts the most recently edited first", () => {
  const scenes = [
    scene("old", { updated_at: "2026-01-01T00:00:00.000+00:00" }),
    scene("new", { updated_at: "2026-03-01T00:00:00.000+00:00" }),
    scene("mid", { updated_at: "2026-02-01T00:00:00.000+00:00" }),
  ];
  expect(names(sortScenes(scenes, "updated"))).toEqual(["new", "mid", "old"]);
});

test("created sort puts the newest first", () => {
  const scenes = [
    scene("first", { created_at: "2026-01-01T00:00:00.000+00:00" }),
    scene("third", { created_at: "2026-03-01T00:00:00.000+00:00" }),
    scene("second", { created_at: "2026-02-01T00:00:00.000+00:00" }),
  ];
  expect(names(sortScenes(scenes, "created"))).toEqual(["third", "second", "first"]);
});

test("name sort is alphabetical, case-insensitive and numeric-aware", () => {
  const scenes = [scene("overlay 10"), scene("Overlay 2"), scene("brb"), scene("Alerts")];
  expect(names(sortScenes(scenes, "name"))).toEqual(["Alerts", "brb", "Overlay 2", "overlay 10"]);
});

test("favourites come first under every sort, then the chosen order inside each group", () => {
  const scenes = [
    scene("c", { updated_at: "2026-03-01T00:00:00.000+00:00" }),
    scene("a", { updated_at: "2026-01-01T00:00:00.000+00:00", is_favourite: true }),
    scene("b", { updated_at: "2026-02-01T00:00:00.000+00:00" }),
    scene("d", { updated_at: "2026-04-01T00:00:00.000+00:00", is_favourite: true }),
  ];
  expect(names(sortScenes(scenes, "updated"))).toEqual(["d", "a", "c", "b"]);
  expect(names(sortScenes(scenes, "name"))).toEqual(["a", "d", "b", "c"]);
});

test("sorting does not mutate the input and keeps ties in their incoming order", () => {
  const scenes = [scene("x"), scene("y"), scene("z")];
  const sorted = sortScenes(scenes, "updated");
  expect(sorted).not.toBe(scenes);
  expect(names(sorted)).toEqual(["x", "y", "z"]);
  expect(names(scenes)).toEqual(["x", "y", "z"]);
});

test("an unparseable timestamp sorts last instead of throwing", () => {
  const scenes = [scene("broken", { updated_at: "not a date" }), scene("fine")];
  expect(names(sortScenes(scenes, "updated"))).toEqual(["fine", "broken"]);
});

// --- preference ---

test("sort key guard accepts only the three known keys", () => {
  expect(isOverlaySortKey("updated")).toBe(true);
  expect(isOverlaySortKey("name")).toBe(true);
  expect(isOverlaySortKey("created")).toBe(true);
  expect(isOverlaySortKey("favourite")).toBe(false);
  expect(isOverlaySortKey(null)).toBe(false);
  expect(isOverlaySortKey(1)).toBe(false);
});

test("sort preference defaults, round-trips, and ignores junk in storage", () => {
  const rows = installLocalStorage();
  expect(readOverlaySort()).toBe(DEFAULT_OVERLAY_SORT);

  saveOverlaySort("name");
  expect(rows.get(OVERLAY_SORT_STORAGE_KEY)).toBe("name");
  expect(readOverlaySort()).toBe("name");

  rows.set(OVERLAY_SORT_STORAGE_KEY, "by-vibes");
  expect(readOverlaySort()).toBe(DEFAULT_OVERLAY_SORT);
});

test("sort preference survives a browser that refuses storage for the rest of the visit", () => {
  (globalThis as { window?: unknown }).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    },
  };
  expect(() => saveOverlaySort("created")).not.toThrow();
  expect(readOverlaySort()).toBe("created");
});

test("saving the sort notifies subscribers until they unsubscribe", () => {
  let calls = 0;
  const unsubscribe = subscribeOverlaySort(() => {
    calls += 1;
  });
  saveOverlaySort("name");
  expect(calls).toBe(1);
  unsubscribe();
  saveOverlaySort("created");
  expect(calls).toBe(1);
});
