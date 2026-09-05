import { beforeEach, expect, test } from "bun:test";
import {
  CLIP_VOLUME_HINT_KEY,
  claimOneTimeHint,
  resetOneTimeHintsForTest,
} from "./one-time-hints";

function installLocalStorage(rows = new Map<string, string>()) {
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => rows.get(key) ?? null,
      setItem: (key: string, value: string) => void rows.set(key, value),
      removeItem: (key: string) => void rows.delete(key),
    },
  };
  return rows;
}

function installRefusingLocalStorage() {
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    },
  };
}

beforeEach(() => {
  resetOneTimeHintsForTest();
  installLocalStorage();
});

test("a hint is claimed once and never again in the same load", () => {
  expect(claimOneTimeHint(CLIP_VOLUME_HINT_KEY)).toBe(true);
  expect(claimOneTimeHint(CLIP_VOLUME_HINT_KEY)).toBe(false);
});

test("a hint stays claimed after a reload", () => {
  const rows = installLocalStorage();
  claimOneTimeHint(CLIP_VOLUME_HINT_KEY);

  resetOneTimeHintsForTest();
  installLocalStorage(rows);

  expect(claimOneTimeHint(CLIP_VOLUME_HINT_KEY)).toBe(false);
});

test("hints are tracked per key", () => {
  expect(claimOneTimeHint(CLIP_VOLUME_HINT_KEY)).toBe(true);
  expect(claimOneTimeHint("some-other-hint")).toBe(true);
});

test("a browser refusing storage still shows the hint once per load", () => {
  installRefusingLocalStorage();

  expect(claimOneTimeHint(CLIP_VOLUME_HINT_KEY)).toBe(true);
  expect(claimOneTimeHint(CLIP_VOLUME_HINT_KEY)).toBe(false);
});
