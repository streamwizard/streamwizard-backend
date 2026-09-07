import { expect, test } from "bun:test";
import { filterLibraryWidgets } from "./widget-search";

const widgets = [
  { type: "text_widget", library: { title: "Text", description: "Any words you like" } },
  { type: "clips_widget", library: { title: "Clips", description: "Play your Twitch clips" } },
  { type: "alert_widget", library: { title: "Alert box", description: "Follows, subs and clips" } },
  { type: "clock_widget", library: { title: "Clock", description: "The time, on screen" } },
  { type: "bare_widget" },
];

test("an empty query returns everything in registry order", () => {
  expect(filterLibraryWidgets(widgets, "").map((w) => w.type)).toEqual(
    widgets.map((w) => w.type)
  );
  expect(filterLibraryWidgets(widgets, "   ")).toHaveLength(5);
});

test("a title match wins over a description match", () => {
  // "Clips" is a title; the alert box only mentions clips in its description.
  expect(filterLibraryWidgets(widgets, "clip").map((w) => w.type)).toEqual([
    "clips_widget",
    "alert_widget",
  ]);
});

test("a title that starts with the query comes first", () => {
  const ranked = filterLibraryWidgets(
    [
      { type: "b", library: { title: "Box alert" } },
      { type: "a", library: { title: "Alert box" } },
    ],
    "alert"
  );
  expect(ranked.map((w) => w.type)).toEqual(["a", "b"]);
});

test("searching is case-insensitive and ignores surrounding space", () => {
  expect(filterLibraryWidgets(widgets, "  ALERT ").map((w) => w.type)).toEqual([
    "alert_widget",
  ]);
});

test("a widget with no library metadata is matched on its type", () => {
  expect(filterLibraryWidgets(widgets, "bare").map((w) => w.type)).toEqual(["bare_widget"]);
});

test("no matches returns nothing rather than everything", () => {
  expect(filterLibraryWidgets(widgets, "zzzz")).toEqual([]);
});

test("ties keep registry order", () => {
  const ranked = filterLibraryWidgets(
    [
      { type: "first", library: { title: "Timer" } },
      { type: "second", library: { title: "Time zone" } },
    ],
    "tim"
  );
  expect(ranked.map((w) => w.type)).toEqual(["first", "second"]);
});
