import { describe, expect, it } from "bun:test";
import { DEFAULT_TIMELINE_LAYOUT, parseTimelineLayout } from "./layout-preferences";

describe("parseTimelineLayout", () => {
  it("falls back on nothing, junk and bad numbers", () => {
    expect(parseTimelineLayout(null)).toEqual(DEFAULT_TIMELINE_LAYOUT);
    expect(parseTimelineLayout("{")).toEqual(DEFAULT_TIMELINE_LAYOUT);
    expect(parseTimelineLayout(JSON.stringify({ rows: { top: -5, timeline: 105 } }))).toEqual(DEFAULT_TIMELINE_LAYOUT);
    expect(parseTimelineLayout(JSON.stringify({ rows: { top: 50 } }))).toEqual(DEFAULT_TIMELINE_LAYOUT);
  });

  it("keeps a layout whose panels add up to 100", () => {
    const saved = { rows: { top: 55, timeline: 45 }, columns: { preview: 80, inspector: 20 } };
    expect(parseTimelineLayout(JSON.stringify(saved))).toEqual(saved);
  });

  it("validates rows and columns independently", () => {
    const parsed = parseTimelineLayout(JSON.stringify({ rows: { top: 55, timeline: 45 }, columns: { preview: 10, inspector: 10 } }));
    expect(parsed.rows).toEqual({ top: 55, timeline: 45 });
    expect(parsed.columns).toEqual(DEFAULT_TIMELINE_LAYOUT.columns);
  });
});
