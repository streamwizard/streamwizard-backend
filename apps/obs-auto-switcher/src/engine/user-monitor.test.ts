import { test, expect, beforeEach, setSystemTime } from "bun:test";
import { AUTO_SWITCHER_PRESET_THRESHOLDS, type AutoSwitcherConfig, type AutoSwitcherStatus } from "@repo/schemas";
import type { IngestStatsPayload } from "@repo/types";
import type { EffectiveConfig } from "../config-store";
import type { ChatNoticeKind, ChatTemplateVars } from "../actions/chat";
import { UserMonitor, type MonitorDeps } from "./user-monitor";
import { clearSwitchLog } from "./switch-log";

// The publish contract is what an overlay renders against: a status must land
// on every step of a streak that is moving, and must NOT land every second of a
// healthy stream. Both halves are easy to break with a one-line change to
// statusKey(), and neither is visible without a live degrading stream, so they
// are pinned here.

const USER = "user-1";
const THR = AUTO_SWITCHER_PRESET_THRESHOLDS.balanced; // trigger 4, recover 8, startup 6

let published: AutoSwitcherStatus[] = [];
let chatSent: { kind: ChatNoticeKind; template: string; vars: ChatTemplateVars }[] = [];

function makeDeps(): MonitorDeps {
  return {
    setScene: async () => ({ ok: true }),
    stopStream: async () => ({ ok: true }),
    resolveSceneItemId: async () => 1,
    setSceneItemEnabled: async () => ({ ok: true }),
    sendChat: async (_userId, kind, template, vars) => {
      chatSent.push({ kind, template, vars });
    },
    logEvent: async () => {},
    clearOverride: async () => {},
    publishStatus: (_userId, status) => {
      published.push(status);
    },
  };
}

function makeConfig(overrides: Partial<AutoSwitcherConfig> = {}): EffectiveConfig {
  return {
    row: {
      user_id: USER,
      enabled: true,
      mode: "simple",
      scene_model: "three",
      scene_live_uuid: "scene-live",
      scene_live_name: "Live",
      scene_degraded_uuid: "scene-degraded",
      scene_degraded_name: "Degraded",
      scene_offline_uuid: "scene-offline",
      scene_offline_name: "Offline",
      sensitivity_preset: "balanced",
      advanced_thresholds: null,
      pinned_stream_key_label: null,
      log_events_enabled: false,
      chat_notices_enabled: false,
      chat_template_degraded: "",
      chat_template_offline: "",
      chat_template_recovered: "",
      warning_source_enabled: false,
      warning_source_uuid: null,
      warning_source_name: null,
      auto_stop_enabled: false,
      auto_stop_minutes: 10,
      override_scene_uuid: null,
      override_scene_name: null,
      override_expires_at: null,
      ...overrides,
    } as AutoSwitcherConfig,
    thresholds: THR,
  };
}

// loss_pct is deliberately non-zero on the healthy sample: raw link loss is
// normal on cellular and the switcher must ignore it. drop_pct is the metric it
// actually judges.
const GOOD: Omit<IngestStatsPayload, "session_id"> = {
  protocol: "srt",
  kbps: 6000,
  rtt_ms: 40,
  loss_pct: 3,
  drop_pct: 0,
};

const BAD: Omit<IngestStatsPayload, "session_id"> = {
  protocol: "srt",
  kbps: 200,
  rtt_ms: 40,
  loss_pct: 3,
  drop_pct: 0,
};

let clock = 1_000_000;

/** One 1 Hz ingest sample. */
function sample(monitor: UserMonitor, stats: Omit<IngestStatsPayload, "session_id">): void {
  clock += 1_000;
  monitor.onStats({ session_id: "sess-1", ...stats } as IngestStatsPayload, clock);
}

function tick(monitor: UserMonitor): void {
  clock += 1_000;
  monitor.onTick(clock);
}

/** Runs enough good samples to clear the startup gate and reach `live`. */
function bringLive(monitor: UserMonitor): void {
  for (let i = 0; i < THR.bitrate_startup_polls; i++) sample(monitor, GOOD);
  expect(published.at(-1)!.state).toBe("live");
  published = [];
}

/**
 * Chat notices are dispatched from onSwitched, which runs once the setScene
 * promise resolves — so they land a microtask after the sample that triggered
 * them, not synchronously like the status publishes above.
 */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  published = [];
  chatSent = [];
  clock = 1_000_000;
  // The injected `clock` drives the engine, but a switch entry is stamped with
  // the wall clock, and that stamp is what the all-clear window is measured
  // against — so the tests below move both, and every other test gets the real
  // clock back here.
  setSystemTime();
  clearSwitchLog(USER);
});

test("publishes once on construction so a widget isn't blank for 5s", () => {
  new UserMonitor(USER, makeConfig(), makeDeps());
  expect(published).toHaveLength(1);
  expect(published[0]!.state).toBe("idle");
});

test("a healthy stream does not publish per sample", () => {
  const monitor = new UserMonitor(USER, makeConfig(), makeDeps());
  bringLive(monitor);

  // `good` climbs every second, but it is clamped at the recover threshold in
  // the key, so past that point nothing changes and nothing is published.
  for (let i = 0; i < THR.bitrate_recover_polls + 15; i++) sample(monitor, GOOD);

  // Only the samples still below the recover clamp may publish.
  expect(published.length).toBeLessThanOrEqual(THR.bitrate_recover_polls);

  const before = published.length;
  for (let i = 0; i < 10; i++) sample(monitor, GOOD);
  expect(published.length).toBe(before);
});

test("publishes on every step of a bad streak, before the switch fires", () => {
  const monitor = new UserMonitor(USER, makeConfig(), makeDeps());
  bringLive(monitor);

  // Every bad sample below the trigger: no phase change, so before this feature
  // these produced nothing at all.
  for (let i = 1; i < THR.bitrate_trigger_polls; i++) {
    sample(monitor, BAD);
    expect(published).toHaveLength(i);
    expect(published.at(-1)!.state).toBe("live");
    expect(published.at(-1)!.streaks.bitrate.bad).toBe(i);
  }

  // The last one crosses the trigger and switches.
  sample(monitor, BAD);
  expect(published.at(-1)!.state).toBe("degraded");
});

test("publishes on every step of recovery progress", () => {
  const monitor = new UserMonitor(USER, makeConfig(), makeDeps());
  bringLive(monitor);
  for (let i = 0; i < THR.bitrate_trigger_polls; i++) sample(monitor, BAD);
  expect(published.at(-1)!.state).toBe("degraded");
  published = [];

  // Recovery is what the green bar draws, so each good poll must be visible.
  for (let i = 0; i < 5; i++) sample(monitor, GOOD);
  expect(published).toHaveLength(5);
  expect(published.map((s) => s.streaks.bitrate.good)).toEqual([1, 2, 3, 4, 5]);
  expect(published.every((s) => s.state === "degraded")).toBe(true);
});

test("goes quiet when nothing is streaming", () => {
  const monitor = new UserMonitor(USER, makeConfig(), makeDeps());
  bringLive(monitor);
  clock += 1_000;
  monitor.onSessionEnded("sess-1", clock);

  // One honest resting frame, then silence -- a monitor exists per enabled
  // config, so beating here costs every enabled user 0.2 msg/s round the clock.
  expect(published.at(-1)!.armed).toBe(false);
  published = [];
  for (let i = 0; i < 30; i++) tick(monitor);
  expect(published).toHaveLength(0);
});

test("resumes publishing when a stream starts again", () => {
  const monitor = new UserMonitor(USER, makeConfig(), makeDeps());
  clock += 1_000;
  monitor.onSessionEnded("sess-1", clock);
  for (let i = 0; i < 10; i++) tick(monitor);
  published = [];

  sample(monitor, GOOD);
  expect(published.length).toBeGreaterThan(0);
  expect(published.at(-1)!.armed).toBe(true);
});

test("the heartbeat still fires on a healthy stream that publishes nothing", () => {
  const monitor = new UserMonitor(USER, makeConfig(), makeDeps());
  bringLive(monitor);
  for (let i = 0; i < THR.bitrate_recover_polls + 5; i++) sample(monitor, GOOD);
  published = [];

  // Keep the session fresh so this exercises the heartbeat rather than the
  // offline timeout — the samples themselves are past the `good` clamp and
  // publish nothing.
  for (let i = 0; i < 5; i++) {
    sample(monitor, GOOD);
    tick(monitor);
  }
  expect(published).toHaveLength(1);
});

test("carries warning_shown and the latest sample", () => {
  const monitor = new UserMonitor(USER, makeConfig(), makeDeps());
  bringLive(monitor);
  sample(monitor, BAD);

  const status = published.at(-1)!;
  expect(status.warning_shown).toBe(false); // warning source disabled in this config
  expect(status.latest).toEqual({ kbps: 200, rtt_ms: 40, loss_pct: 0, at: clock });
});

test("latest is null before any sample, and nulls absent RTMP metrics", () => {
  const monitor = new UserMonitor(USER, makeConfig(), makeDeps());
  expect(published[0]!.latest).toBeNull();

  // RTMP reports throughput only — rtt/drop genuinely never arrive.
  sample(monitor, { protocol: "rtmp", kbps: 4000 });
  const status = published.at(-1)!;
  expect(status.latest).toEqual({ kbps: 4000, rtt_ms: null, loss_pct: null, at: clock });
});

// Regression: the status used to contradict itself once a stream ended --
// `armed: true` (selectedSessionId is never cleared) next to
// `selected_session: null` (the tracker had dropped it), with a `latest` frozen
// at the last sample but stamped `at: now`, so a four-minute-old reading looked
// live. The deck's "Standby" badge is driven off `armed`, so it never appeared.
test("goes to standby when the watched session ends", () => {
  const monitor = new UserMonitor(USER, makeConfig(), makeDeps());
  bringLive(monitor);

  clock += 1_000;
  monitor.onSessionEnded("sess-1", clock);

  const status = published.at(-1)!;
  expect(status.state).toBe("offline");
  expect(status.armed).toBe(false);
  expect(status.selected_session).toBeNull();
  expect(status.latest).toBeNull();
});

test("goes to standby when the stream goes silent past the offline timeout", () => {
  const monitor = new UserMonitor(USER, makeConfig(), makeDeps());
  bringLive(monitor);

  // No stats at all for longer than offline_timeout_seconds.
  clock += THR.offline_timeout_seconds * 1_000 + 1_000;
  monitor.onTick(clock);

  const status = published.at(-1)!;
  expect(status.state).toBe("offline");
  expect(status.armed).toBe(false);
  expect(status.selected_session).toBeNull();
  expect(status.latest).toBeNull();
});

test("latest carries the sample's own arrival time, not the publish time", () => {
  const monitor = new UserMonitor(USER, makeConfig(), makeDeps());
  bringLive(monitor);
  sample(monitor, BAD);
  const sampledAt = clock;

  // A later heartbeat republishes the same reading; `at` must not drift forward
  // with it, or consumers can't tell a fresh sample from a held one.
  for (let i = 0; i < 5; i++) tick(monitor);
  expect(published.at(-1)!.latest!.at).toBe(sampledAt);
});

test("a config push publishes even when nothing else changed", () => {
  const monitor = new UserMonitor(USER, makeConfig(), makeDeps());
  published = [];
  monitor.applyConfig(makeConfig({ scene_live_name: "Main" }), clock);
  expect(published).toHaveLength(1);
});

// ── chat notices ─────────────────────────────────────────────────────────────

const CHAT_CONFIG = {
  chat_notices_enabled: true,
  chat_template_degraded: "dropped to {scene} ({bitrate} kbps, {loss}%)",
  chat_template_offline: "signal lost",
  chat_template_recovered: "back live",
} as const;

test("going live off the startup gate posts nothing to chat", async () => {
  const monitor = new UserMonitor(USER, makeConfig(CHAT_CONFIG), makeDeps());
  bringLive(monitor);
  await flush();

  // Chat never saw a problem, so there is nothing to reassure it about. This
  // used to hang off comparing the switch's detail string to a literal copy of
  // the sentence evaluate() writes, so rewording either copy would have started
  // announcing every go-live.
  expect(chatSent).toEqual([]);
});

test("a fallback and the recovery after it each post once", async () => {
  const monitor = new UserMonitor(USER, makeConfig(CHAT_CONFIG), makeDeps());
  bringLive(monitor);

  for (let i = 0; i < THR.bitrate_trigger_polls; i++) sample(monitor, BAD);
  await flush();
  expect(chatSent.map((c) => c.kind)).toEqual(["degraded"]);

  for (let i = 0; i < THR.bitrate_recover_polls; i++) sample(monitor, GOOD);
  await flush();
  expect(published.at(-1)!.state).toBe("live");
  // The all-clear is the whole point: a 30s window keyed on the user alone
  // swallowed it whenever the link came back inside half a minute.
  expect(chatSent.map((c) => c.kind)).toEqual(["degraded", "recovered"]);
  expect(chatSent[1]!.template).toBe(CHAT_CONFIG.chat_template_recovered);
});

// Regression: this is the flow a real IRL dropout takes, and it used to post
// exactly one of the three configured messages. A resumed session re-passes the
// startup gate (onStats), so the go-live carried the startup detail string and
// the old check suppressed the all-clear as if chat had never been told anything
// was wrong. Anyone whose link dies outright rather than degrading gradually
// therefore only ever saw "signal lost".
test("a signal loss and the reconnect after it each post once", async () => {
  const monitor = new UserMonitor(USER, makeConfig(CHAT_CONFIG), makeDeps());
  bringLive(monitor);

  clock += 1_000;
  monitor.onSessionEnded("sess-1", clock);
  await flush();
  expect(chatSent.map((c) => c.kind)).toEqual(["offline"]);

  // Stats resume: back through the startup gate, then live.
  for (let i = 0; i < THR.bitrate_startup_polls; i++) sample(monitor, GOOD);
  await flush();
  expect(published.at(-1)!.state).toBe("live");
  expect(chatSent.map((c) => c.kind)).toEqual(["offline", "recovered"]);
});

// Regression: with two scenes, degraded and offline are the same scene, so the
// drop to offline needed no OBS call — and requestSwitch returned before
// dispatching anything, swallowing the notice and the event-log entry with it.
test("in the 2-scene model the drop to offline still posts", async () => {
  const monitor = new UserMonitor(USER, makeConfig({ ...CHAT_CONFIG, scene_model: "two" }), makeDeps());
  bringLive(monitor);

  for (let i = 0; i < THR.bitrate_trigger_polls; i++) sample(monitor, BAD);
  await flush();
  expect(chatSent.map((c) => c.kind)).toEqual(["degraded"]);

  // Same scene it already switched to, one phase later.
  clock += THR.offline_timeout_seconds * 1_000 + 1_000;
  monitor.onTick(clock);
  await flush();
  expect(published.at(-1)!.state).toBe("offline");
  expect(chatSent.map((c) => c.kind)).toEqual(["degraded", "offline"]);
});

test("{loss} carries the metric the engine judged, not raw link loss", async () => {
  const monitor = new UserMonitor(USER, makeConfig(CHAT_CONFIG), makeDeps());
  bringLive(monitor);
  for (let i = 0; i < THR.bitrate_trigger_polls; i++) sample(monitor, BAD);
  await flush();

  // BAD carries loss_pct 3 / drop_pct 0 on purpose. Announcing loss_pct told
  // chat about link loss the switcher had deliberately ignored. (Literals, not
  // BAD.drop_pct: IngestStatsPayload is a loose zod object, so Omit<> over it
  // collapses every field to unknown.)
  expect(chatSent[0]!.vars.loss).toBe(0);
  expect(chatSent[0]!.vars.bitrate).toBe(200);
  expect(chatSent[0]!.vars.scene).toBe("Degraded");
});

// Wall-clock anchor for the all-clear window tests below.
const WALL = new Date("2026-08-18T20:00:00.000Z").getTime();

// Regression: the debt to chat used to be a boolean with no expiry. Ending a
// stream also ends the ingest session, which posts "signal lost" and left the
// debt standing for the life of the worker — so the next broadcast's startup
// gate greeted fresh chat with "back live" for a connection that was never
// broken. Switching from Starting Soon to the live scene is not a recovery.
test("an outage older than the all-clear window is not announced as recovered", async () => {
  setSystemTime(new Date(WALL));
  const monitor = new UserMonitor(USER, makeConfig(CHAT_CONFIG), makeDeps());
  bringLive(monitor);

  clock += 1_000;
  monitor.onSessionEnded("sess-1", clock);
  await flush();
  expect(chatSent.map((c) => c.kind)).toEqual(["offline"]);

  // That stream is over; the next one starts 20 minutes later.
  setSystemTime(new Date(WALL + 20 * 60_000));
  for (let i = 0; i < THR.bitrate_startup_polls; i++) sample(monitor, GOOD);
  await flush();
  expect(published.at(-1)!.state).toBe("live");
  expect(chatSent.map((c) => c.kind)).toEqual(["offline"]);
});

test("a dropout inside the window still gets its all-clear", async () => {
  setSystemTime(new Date(WALL));
  const monitor = new UserMonitor(USER, makeConfig(CHAT_CONFIG), makeDeps());
  bringLive(monitor);

  clock += 1_000;
  monitor.onSessionEnded("sess-1", clock);
  await flush();

  // A long dead zone is still the same broadcast, and the viewers who waited
  // it out are the ones the message is for.
  setSystemTime(new Date(WALL + 9 * 60_000));
  for (let i = 0; i < THR.bitrate_startup_polls; i++) sample(monitor, GOOD);
  await flush();
  expect(chatSent.map((c) => c.kind)).toEqual(["offline", "recovered"]);
});

test("a stream the switcher stopped itself owes chat nothing when it returns", async () => {
  setSystemTime(new Date(WALL));
  const monitor = new UserMonitor(
    USER,
    makeConfig({ ...CHAT_CONFIG, auto_stop_enabled: true, auto_stop_minutes: 2 }),
    makeDeps(),
  );
  bringLive(monitor);

  clock += 1_000;
  monitor.onSessionEnded("sess-1", clock);
  await flush();
  expect(chatSent.map((c) => c.kind)).toEqual(["offline"]);

  // Two offline minutes in, auto stop ends the broadcast — inside the window,
  // but there is no longer a stream for an all-clear to belong to.
  clock += 2 * 60_000;
  tick(monitor);
  await flush();

  setSystemTime(new Date(WALL + 3 * 60_000));
  for (let i = 0; i < THR.bitrate_startup_polls; i++) sample(monitor, GOOD);
  await flush();
  expect(chatSent.map((c) => c.kind)).toEqual(["offline"]);
});
