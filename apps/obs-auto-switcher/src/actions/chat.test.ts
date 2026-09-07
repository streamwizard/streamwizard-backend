import { test, expect, beforeEach, mock, setSystemTime } from "bun:test";
import type { SendChatMessageResponse } from "@repo/twitch-api";

// The whole notice path is network-shaped, and every way it fails is silent from
// the streamer's side, so the gates in front of the send are stubbed out here
// rather than left to a live stream to discover.

const USER = "user-1";

let sentMessages: string[] = [];
let broadcasterLookups = 0;
let linkedBroadcasterId: string | null = "12345";
let nextResponse: SendChatMessageResponse = { data: [{ message_id: "m1", is_sent: true }] };
let throwOnSend = false;
let reported: { context: string; extra?: Record<string, unknown> }[] = [];

mock.module("@repo/supabase", () => ({ supabase: {} }));

mock.module("@repo/supabase/queries/user", () => ({
  getTwitchUserIdByUserIdMaybe: async () => {
    broadcasterLookups++;
    return linkedBroadcasterId;
  },
}));

mock.module("@repo/twitch-api", () => ({
  TwitchApi: class {
    chat = {
      sendMessage: async ({ message }: { message: string }) => {
        if (throwOnSend) throw new Error("twitch 500");
        sentMessages.push(message);
        return nextResponse;
      },
    };
  },
}));

mock.module("@repo/sentry", () => ({
  reportError: (_err: unknown, context: string, extra?: Record<string, unknown>) => {
    reported.push({ context, extra });
  },
}));

const { renderChatTemplate, sendChatNotice, clearChatCaches } = await import("./chat");

const T0 = new Date("2026-08-17T12:00:00.000Z").getTime();

function advance(ms: number): void {
  setSystemTime(new Date(T0 + ms));
}

beforeEach(() => {
  sentMessages = [];
  broadcasterLookups = 0;
  linkedBroadcasterId = "12345";
  nextResponse = { data: [{ message_id: "m1", is_sent: true }] };
  throwOnSend = false;
  reported = [];
  setSystemTime(new Date(T0));
  clearChatCaches(USER);
});

// ── rendering ────────────────────────────────────────────────────────────────

test("fills in every placeholder", () => {
  expect(
    renderChatTemplate("{scene}: {bitrate} kbps, {rtt} ms, {loss}%", {
      bitrate: 5999.6,
      rtt: 42.4,
      loss: 1.25,
      scene: "Backup",
    }),
  ).toBe("Backup: 6000 kbps, 42 ms, 1.3%");
});

test("renders ? for metrics a protocol never reports", () => {
  // RTMP carries throughput only.
  expect(renderChatTemplate("{bitrate} kbps, {rtt} ms, {loss}%, {scene}", { bitrate: 4000 })).toBe(
    "4000 kbps, ? ms, ?%, ?",
  );
});

test("clamps to Helix's 500-character cap", () => {
  // Templates are capped at 400 by the schema, but {scene} is an arbitrary OBS
  // scene name, so expansion can still cross the cap and Helix rejects the whole
  // request rather than truncating it.
  const rendered = renderChatTemplate(`${"x".repeat(400)}{scene}`, { scene: "y".repeat(200) });
  expect(rendered).toHaveLength(500);
  expect(rendered.startsWith("x".repeat(400))).toBe(true);
});

// ── the send gates ───────────────────────────────────────────────────────────

test("the recovery notice is not blocked by the fallback that preceded it", async () => {
  await sendChatNotice(USER, "degraded", "quality dropped", {});
  advance(8_000);
  await sendChatNotice(USER, "recovered", "back live", {});

  // One window per user meant a link that came back inside 30s left "quality
  // dropped" as chat's last word on a stream that was already fine.
  expect(sentMessages).toEqual(["quality dropped", "back live"]);
});

test("the same notice is rate limited, and allowed again after the window", async () => {
  await sendChatNotice(USER, "degraded", "first", {});
  advance(29_000);
  await sendChatNotice(USER, "degraded", "second", {});
  expect(sentMessages).toEqual(["first"]);

  advance(31_000);
  await sendChatNotice(USER, "degraded", "third", {});
  expect(sentMessages).toEqual(["first", "third"]);
});

test("a cleared template sends nothing and costs no lookup", async () => {
  // Empty is valid config — the schema has no minimum — and Helix 400s on it.
  await sendChatNotice(USER, "offline", "   ", {});
  expect(sentMessages).toEqual([]);
  expect(broadcasterLookups).toBe(0);
});

test("no Twitch link means no notice, and the miss is re-checked", async () => {
  linkedBroadcasterId = null;
  await sendChatNotice(USER, "degraded", "hello", {});
  expect(sentMessages).toEqual([]);
  expect(broadcasterLookups).toBe(1);

  // A permanently cached null pinned "this user has no Twitch" for the life of
  // the process, so linking Twitch after the worker booted never took effect.
  linkedBroadcasterId = "12345";
  advance(61_000);
  await sendChatNotice(USER, "degraded", "hello", {});
  expect(broadcasterLookups).toBe(2);
  expect(sentMessages).toEqual(["hello"]);
});

test("a resolved broadcaster id is cached across notices", async () => {
  await sendChatNotice(USER, "degraded", "one", {});
  advance(31_000);
  await sendChatNotice(USER, "degraded", "two", {});
  expect(sentMessages).toHaveLength(2);
  expect(broadcasterLookups).toBe(1);
});

test("an AutoMod hold is reported and does not cost the full window", async () => {
  nextResponse = {
    data: [{ message_id: "m1", is_sent: false, drop_reason: { code: "automod_held", message: "held" } }],
  };
  await sendChatNotice(USER, "degraded", "held one", {});
  expect(reported.map((r) => r.context)).toEqual(["chat.notice"]);
  expect(reported[0]!.extra).toMatchObject({ userId: USER, kind: "degraded" });

  // Helix answers 200 on a hold, so this used to read as a success and silence
  // the next 30s of notices.
  nextResponse = { data: [{ message_id: "m2", is_sent: true }] };
  advance(6_000);
  await sendChatNotice(USER, "degraded", "next one", {});
  expect(sentMessages).toEqual(["held one", "next one"]);
});

test("a failed send is reported and retried on the short window", async () => {
  throwOnSend = true;
  await sendChatNotice(USER, "offline", "boom", {});
  expect(sentMessages).toEqual([]);
  expect(reported).toHaveLength(1);

  throwOnSend = false;
  advance(6_000);
  await sendChatNotice(USER, "offline", "boom", {});
  expect(sentMessages).toEqual(["boom"]);
});
