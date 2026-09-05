import { describe, expect, it } from "bun:test";
import { WIDGET_TEST_EVENTS, type WidgetTestEventType } from "@repo/schemas";
import { ALERT_EVENT_TYPES, alertInstanceFromSocketMessage, alertTokensForEvent } from "@repo/ui/overlay";
import { ALERT_SAMPLES, DEFAULT_SAMPLE_ID, LONG_MESSAGE, LONG_NAME, buildSampleMessage, findSample, sampleTokens } from "./sample-payloads";

describe("sample payloads", () => {
  it("covers every event, starts with the default fixture and keeps ids unique", () => {
    for (const event of ALERT_EVENT_TYPES) {
      const list = ALERT_SAMPLES[event];
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list[0]!.id).toBe(DEFAULT_SAMPLE_ID);
      expect(new Set(list.map((s) => s.id)).size).toBe(list.length);
    }
  });

  // A patched fixture that no longer matches Twitch's shape would preview
  // tokens a real alert never produces.
  for (const event of ALERT_EVENT_TYPES) {
    for (const sample of ALERT_SAMPLES[event]) {
      it(`${event} / ${sample.id} still matches the EventSub schema and maps to an alert`, () => {
        const message = buildSampleMessage(event, sample.id);
        const schema = WIDGET_TEST_EVENTS[message.type as WidgetTestEventType].schema;
        expect(schema.safeParse(message.payload).success).toBe(true);
        const alert = alertInstanceFromSocketMessage(message);
        expect(alert?.event).toBe(event);
        // Every token the event can fill is non-empty on at least the default sample.
        if (sample.id === DEFAULT_SAMPLE_ID) {
          const tokens = sampleTokens(event, sample.id);
          for (const token of alertTokensForEvent(event)) expect(tokens[token]).not.toBe("");
        }
      });
    }
  }

  it("the patches change what they say they change", () => {
    expect(sampleTokens("cheer", "big")).toMatchObject({ amount: "10000", message: LONG_MESSAGE });
    expect(sampleTokens("cheer", "small")).toMatchObject({ amount: "1", message: "" });
    expect(sampleTokens("cheer", "anonymous")).toMatchObject({ name: "Anonymous", amount: "250" });
    expect(sampleTokens("sub", "tier3").tier).toBe("Tier 3");
    expect(sampleTokens("sub", "prime").tier).toBe("Prime");
    expect(sampleTokens("resub", "long")).toMatchObject({ amount: "36", tier: "Tier 3", message: LONG_MESSAGE });
    expect(sampleTokens("resub", "no-message").message).toBe("");
    expect(sampleTokens("gift_sub", "anonymous").name).toBe("Anonymous");
    expect(sampleTokens("community_gift", "100")).toMatchObject({ amount: "100", tier: "Tier 2" });
    expect(sampleTokens("gift_upgrade", "anonymous").gifter).toBe("an anonymous gifter");
    expect(sampleTokens("pay_it_forward", "default").gifter).toBe("sandwichlord");
    expect(sampleTokens("charity_donation", "eur")).toMatchObject({ charity: "Cats With Hats", message: "" });
    expect(sampleTokens("charity_donation", "big").amount).toContain("1,000");
    expect(sampleTokens("raid", "big").amount).toBe("1500");
    expect(sampleTokens("raid", "long-name").name).toBe(LONG_NAME);
    expect(sampleTokens("follow", "long-name").name).toBe(LONG_NAME);
    expect(sampleTokens("poll_winner", "big").amount).toBe("9999");
    expect(sampleTokens("ad_break", "180").amount).toBe("180");
    expect(sampleTokens("redemption", "no-message").message).toBe("");
  });

  it("falls back to the first sample for an unknown id", () => {
    expect(findSample("cheer", "nope").id).toBe(DEFAULT_SAMPLE_ID);
    expect(sampleTokens("cheer", "nope").amount).toBe("500");
  });

  it("builds a fresh payload each time and never mutates a shared fixture", () => {
    const a = buildSampleMessage("cheer", "big");
    const b = buildSampleMessage("cheer", "default");
    expect(a.payload.bits).toBe(10_000);
    expect(b.payload.bits).toBe(500);
  });
});
