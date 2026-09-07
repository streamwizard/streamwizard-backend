import { z } from "zod";
import {
  IngestStatsPayloadSchema,
  ObsInstanceLifecyclePayloadSchema,
  ObsSceneChangedPayloadSchema,
  OverlayGeoEventSchema,
} from "./streamwizard";
import {
  AUTO_SWITCHER_PRESET_THRESHOLDS,
  autoSwitcherConfigSchema,
  autoSwitcherStatusSchema,
  type AutoSwitcherStatus,
} from "./auto-switcher";
import {
  WIDGET_TEST_EVENTS,
  type WidgetTestEventDef,
  type WidgetTestEventOptions,
} from "./widget-test-events";

/**
 * The demo catalogue: every event a widget can be fed from the editor without
 * a real stream behind it. This is `WIDGET_TEST_EVENTS` (the Twitch EventSub
 * fixtures) plus the StreamWizard-internal events, which the EventSub-shaped
 * map couldn't hold -- they aren't Twitch payloads and one of them needs two
 * payloads under a single listener.
 *
 * Widget authors used to build their own demo mode to work around this gap
 * (a `demoMode` field plus a fake data loop inside the widget's own script).
 * Everything here exists so they don't have to.
 */

export type DemoEventGroup =
  | WidgetTestEventDef["group"]
  | "IRL / Geo"
  | "Ingest"
  | "Auto switcher"
  | "Cloud OBS";

export interface DemoEventDef {
  /** Human label for buttons and pickers. */
  label: string;
  group: DemoEventGroup;
  /** The zod schema the built payload must satisfy. */
  schema: z.ZodType;
  /**
   * Builds the value delivered to the widget as `detail.event` -- i.e. the
   * `payload` field of the wire frame `{type, payload}`. For `streamwizard.geo`
   * that is the whole `{status, payload}` envelope, NOT a bare GeoPayload.
   *
   * A thunk, not a literal, so timestamps and ids are fresh on every fire.
   */
  build: (opts?: WidgetTestEventOptions) => Record<string, unknown>;
  /**
   * Alternate payloads for the same listener. Geo needs this: "connected" and
   * "offline" are one listener with two shapes, and giving each its own map key
   * would put a listener string in the catalogue that ws-server would reject --
   * `OverlayEventType` has no `streamwizard.geo:offline` member.
   */
  variants?: Record<
    string,
    { label: string; build: (opts?: WidgetTestEventOptions) => Record<string, unknown> }
  >;
}

const DEMO_SESSION_ID = "demo-session";

/** Amsterdam. Same start point the hand-rolled demo modes used. */
const DEMO_LAT = 52.3676;
const DEMO_LON = 4.9041;

const ZERO_STREAK = { bad: 0, good: 0 } as const;

/**
 * Builds a complete, schema-valid `AutoSwitcherStatus` from a partial override,
 * so every demo variant and the `switcher.degrade` simulator describe only what
 * they actually change. Shared rather than copied because the payload has ten
 * required fields -- a hand-written fixture per variant drifts the moment the
 * schema grows one more.
 */
export function buildDemoSwitcherStatus(patch: Partial<AutoSwitcherStatus> = {}): AutoSwitcherStatus {
  return {
    state: "live",
    armed: true,
    override: null,
    selected_session: { session_id: DEMO_SESSION_ID, label: "Camera 1" },
    streaks: {
      bitrate: { bad: 0, good: 12 },
      rtt: { bad: 0, good: 12 },
      loss: { bad: 0, good: 12 },
    },
    thresholds: AUTO_SWITCHER_PRESET_THRESHOLDS.balanced,
    warning_shown: false,
    latest: { kbps: 6000, rtt_ms: 42, loss_pct: 0.2, at: Date.now() },
    last_switch: null,
    last_error: null,
    offline_since: null,
    auto_stop_deadline: null,
    ...patch,
  };
}

/** `build` thunks must return a plain record; the status is structurally one. */
function switcherStatus(patch: Partial<AutoSwitcherStatus>): Record<string, unknown> {
  return buildDemoSwitcherStatus(patch) as unknown as Record<string, unknown>;
}

/** Stamps `at` so variants only spell out the numbers they care about. */
function sample(kbps: number, rtt_ms: number, loss_pct: number): AutoSwitcherStatus["latest"] {
  return { kbps, rtt_ms, loss_pct, at: Date.now() };
}

export const STREAMWIZARD_DEMO_EVENTS = {
  "streamwizard.geo": {
    label: "GPS fix",
    group: "IRL / Geo",
    schema: OverlayGeoEventSchema,
    build: () => ({
      status: "connected",
      payload: {
        latitude: DEMO_LAT,
        longitude: DEMO_LON,
        altitude: 6,
        speed: 9,
        heading: 45,
        accuracy: 8,
        timestamp: Date.now(),
      },
    }),
    variants: {
      offline: {
        label: "GPS offline",
        // No `payload` key at all -- the schema's offline arm requires it to be
        // undefined, matching what ws-server sends when the publisher drops.
        build: () => ({ status: "offline" }),
      },
    },
  },
  "streamwizard.ingest_stats": {
    label: "Ingest stats",
    group: "Ingest",
    schema: IngestStatsPayloadSchema,
    build: () => ({
      session_id: DEMO_SESSION_ID,
      protocol: "srt",
      node_id: "demo-node",
      stream_key_id: "demo-key",
      label: "Camera 1",
      kbps: 6000,
      mbps_recv_rate: 6,
      mbps_bandwidth: 20,
      rtt_ms: 42,
      pkt_recv: 1500,
      pkt_recv_loss: 3,
      ms_rcv_buf: 1200,
      loss_pct: 0.2,
      drop_pct: 0,
      retrans_pct: 0.1,
    }),
  },
  "streamwizard.auto_switcher_status": {
    label: "Auto switcher: live",
    group: "Auto switcher",
    schema: autoSwitcherStatusSchema,
    build: () => switcherStatus({}),
    // One-shot buttons for each visual state a status widget has to handle.
    // For a bar that actually *fills*, use the `switcher.degrade` simulator --
    // a single fixture can't show progress.
    variants: {
      degrading: {
        label: "Auto switcher: degrading",
        // Bitrate two polls into a three-poll trigger: the "about to switch"
        // frame, which is the one the engine never used to publish.
        build: () =>
          switcherStatus({
            streaks: { bitrate: { bad: 2, good: 0 }, rtt: ZERO_STREAK, loss: ZERO_STREAK },
            warning_shown: true,
            latest: sample(780, 96, 0.4),
          }),
      },
      degraded: {
        label: "Auto switcher: degraded",
        build: () =>
          switcherStatus({
            state: "degraded",
            streaks: { bitrate: { bad: 0, good: 8 }, rtt: { bad: 0, good: 8 }, loss: { bad: 0, good: 8 } },
            latest: sample(1120, 240, 1.8),
            last_switch: {
              at: Date.now(),
              from_scene: "Live",
              to_scene: "Connection Lost",
              reason: "auto_fallback",
              detail: "bitrate 780 kbps < 1000 kbps",
              session_id: DEMO_SESSION_ID,
              label: "Camera 1",
            },
          }),
      },
      startup: {
        label: "Auto switcher: starting up",
        build: () =>
          switcherStatus({
            state: "startup",
            streaks: { bitrate: { bad: 0, good: 2 }, rtt: { bad: 0, good: 2 }, loss: { bad: 0, good: 2 } },
            latest: sample(5200, 48, 0),
          }),
      },
      offline: {
        label: "Auto switcher: offline",
        build: () =>
          switcherStatus({
            state: "offline",
            // Offline means the watched session stopped delivering, so there is
            // nothing being watched and no current reading -- the engine reports
            // all three of these together.
            armed: false,
            selected_session: null,
            streaks: { bitrate: ZERO_STREAK, rtt: ZERO_STREAK, loss: ZERO_STREAK },
            latest: null,
            offline_since: Date.now() - 12_000,
          }),
      },
      override: {
        label: "Auto switcher: manual override",
        // Override masks the phase entirely and freezes the streaks, so a
        // widget must render it as its own state rather than drawing stale bars.
        build: () =>
          switcherStatus({
            state: "override",
            override: { scene_uuid: "demo-scene-brb", scene_name: "BRB", expires_at: null },
          }),
      },
      disarmed: {
        label: "Auto switcher: no stream",
        build: () =>
          switcherStatus({
            state: "idle",
            armed: false,
            selected_session: null,
            streaks: { bitrate: ZERO_STREAK, rtt: ZERO_STREAK, loss: ZERO_STREAK },
            latest: null,
          }),
      },
    },
  },
  "streamwizard.obs_scene_changed": {
    label: "OBS scene changed",
    group: "Cloud OBS",
    schema: ObsSceneChangedPayloadSchema,
    build: () => ({
      instanceId: "demo-instance",
      sceneName: "Live",
      sceneUuid: "demo-scene-live",
      at: new Date().toISOString(),
    }),
    variants: {
      brb: {
        label: "OBS scene changed: BRB",
        build: () => ({
          instanceId: "demo-instance",
          sceneName: "BRB",
          sceneUuid: "demo-scene-brb",
          at: new Date().toISOString(),
        }),
      },
      connectionLost: {
        label: "OBS scene changed: Connection Lost",
        build: () => ({
          instanceId: "demo-instance",
          sceneName: "Connection Lost",
          sceneUuid: "demo-scene-offline",
          at: new Date().toISOString(),
        }),
      },
    },
  },
  "streamwizard.auto_switcher_config": {
    label: "Auto switcher config",
    group: "Auto switcher",
    schema: autoSwitcherConfigSchema,
    build: () => ({
      user_id: "00000000-0000-4000-8000-000000000000",
      enabled: true,
      mode: "simple",
      scene_model: "three",
      scene_live_uuid: "demo-scene-live",
      scene_live_name: "Live",
      scene_degraded_uuid: "demo-scene-degraded",
      scene_degraded_name: "Degraded",
      scene_offline_uuid: "demo-scene-offline",
      scene_offline_name: "Offline",
      sensitivity_preset: "balanced",
      advanced_thresholds: null,
      pinned_stream_key_label: null,
      log_events_enabled: true,
      chat_notices_enabled: false,
      chat_template_degraded: "Connection is struggling, hang tight.",
      chat_template_offline: "Lost the signal — back shortly.",
      chat_template_recovered: "Back to normal.",
      warning_source_enabled: false,
      warning_source_uuid: null,
      warning_source_name: null,
      auto_stop_enabled: false,
      auto_stop_minutes: 10,
      override_scene_uuid: null,
      override_scene_name: null,
      override_expires_at: null,
    }),
  },
  "streamwizard.obs_instance_lifecycle": {
    label: "Cloud OBS started",
    group: "Cloud OBS",
    schema: ObsInstanceLifecyclePayloadSchema,
    build: () => ({
      instanceId: "demo-instance",
      action: "started",
      at: new Date().toISOString(),
    }),
    variants: {
      stopped: {
        label: "Cloud OBS stopped",
        build: () => ({
          instanceId: "demo-instance",
          action: "stopped",
          at: new Date().toISOString(),
        }),
      },
      error: {
        label: "Cloud OBS error",
        build: () => ({
          instanceId: "demo-instance",
          action: "error",
          at: new Date().toISOString(),
        }),
      },
    },
  },
} as const satisfies Record<string, DemoEventDef>;

export const DEMO_EVENTS = {
  ...WIDGET_TEST_EVENTS,
  ...STREAMWIZARD_DEMO_EVENTS,
} satisfies Record<string, DemoEventDef>;

export type DemoEventType = keyof typeof DEMO_EVENTS;

export const DEMO_EVENT_TYPES = Object.keys(DEMO_EVENTS) as DemoEventType[];

/**
 * `DEMO_EVENTS` keeps its literal types so each entry's label is known at the
 * call site, but that means indexing it yields a union where only some members
 * declare `variants`. Consumers iterating the catalogue want the common shape.
 */
export const DEMO_EVENT_DEFS = DEMO_EVENTS as Record<DemoEventType, DemoEventDef>;

/**
 * Doubles as the allowlist for the server action that broadcasts a demo event
 * into a live room -- never let a client-supplied event type through unchecked.
 */
export function isDemoEventType(value: string): value is DemoEventType {
  return Object.prototype.hasOwnProperty.call(DEMO_EVENTS, value);
}

/** Builds a `{type, payload}` socket message for one demo event. */
export function buildDemoEvent(
  type: DemoEventType,
  opts?: WidgetTestEventOptions,
  variant?: string
): { type: DemoEventType; payload: Record<string, unknown> } {
  const def: DemoEventDef = DEMO_EVENTS[type];
  const build = variant ? def.variants?.[variant]?.build : def.build;
  if (!build) {
    throw new Error(`Unknown variant "${variant}" for demo event "${type}"`);
  }
  return { type, payload: build(opts) };
}
