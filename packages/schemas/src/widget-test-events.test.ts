import { describe, expect, it } from "bun:test";
import {
  WIDGET_TEST_EVENTS,
  WIDGET_TEST_EVENT_TYPES,
  buildWidgetTestEvent,
  isWidgetTestEventType,
} from "./widget-test-events";

describe("widget test events", () => {
  // The whole point of centralising the fixtures: if a Twitch payload shape
  // changes and the zod schema is updated, the stale fixture fails here rather
  // than silently lying to widget authors in the editor.
  for (const type of WIDGET_TEST_EVENT_TYPES) {
    it(`${type} builds a payload matching its schema`, () => {
      const { payload } = buildWidgetTestEvent(type);
      const result = WIDGET_TEST_EVENTS[type].schema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  }

  it("builds fresh values per call", () => {
    const a = buildWidgetTestEvent("channel.chat.message");
    const b = buildWidgetTestEvent("channel.chat.message");
    expect(a.payload.message_id).not.toBe(b.payload.message_id);
  });

  // Demo mode has to emit what production emits, enrichment included. Without
  // this, an author writes avatar-rendering code against a demo payload that
  // has no avatar in it -- or worse, the reverse: works in the editor, blank on
  // stream. The list mirrors AVATAR_EVENTS in the bot's enrichOverlayEvent.
  const AVATAR_EVENTS = [
    "channel.follow",
    "channel.subscribe",
    "channel.subscription.gift",
    "channel.subscription.message",
    "channel.cheer",
    "channel.raid",
    "channel.chat.message",
  ] as const;

  for (const type of AVATAR_EVENTS) {
    it(`${type} carries the enriched profile image`, () => {
      const { payload } = buildWidgetTestEvent(type);
      expect(typeof payload.user_profile_image_url).toBe("string");
      expect(payload.user_profile_image_url).toContain("https://");
    });
  }

  it("chat messages carry resolved badge URLs", () => {
    const { payload } = buildWidgetTestEvent("channel.chat.message");
    const badges = payload.badges as Array<Record<string, unknown>>;
    expect(badges.length).toBeGreaterThan(0);
    for (const badge of badges) {
      // The EventSub fields must survive untouched -- widgets already read them.
      expect(typeof badge.set_id).toBe("string");
      expect(typeof badge.id).toBe("string");
      // ...and the added ones, including the StreamElements-compatible alias.
      expect(badge.url).toBe(badge.url_2x);
      expect(String(badge.url_4x)).toContain("static-cdn.jtvnw.net/badges/");
    }
  });

  it("rejects unknown types", () => {
    expect(isWidgetTestEventType("channel.follow")).toBe(true);
    expect(isWidgetTestEventType("channel.definitely_not_real")).toBe(false);
    expect(isWidgetTestEventType("constructor")).toBe(false);
  });
});
