import { z } from "zod";

export const OverlayGeoPayloadSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  altitude: z.number().nullable(),
  speed: z.number().nullable(),
  heading: z.number().nullable(),
  accuracy: z.number(),
  timestamp: z.number(),
});

export const OverlayGeoEventSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("connected"), payload: OverlayGeoPayloadSchema }),
  // No `payload` key at all: that's what ws-server sends when the publisher
  // drops. Declaring it as z.undefined() made the key *required* under zod 4,
  // so the real offline frame failed to parse.
  z.object({ status: z.literal("offline") }),
]);

export const OverlayStatusPayloadSchema = z.object({
  status: z.literal("offline"),
});

/**
 * Pushed by the obs-instance-manager whenever a user's Cloud OBS container
 * transitions. "starting"/"stopping" are transitional (leading-edge, no DB
 * status) so other devices can show an honest "Starting…"/"Stopping…" during
 * the wait; the terminal "started"/"stopped"/"error" follows. "deleted" is an
 * action, not a DB status -- the row is removed on delete. The manager keeps a
 * matching local literal (it's a standalone repo that doesn't import this
 * package); keep the two in sync.
 */
export const ObsInstanceLifecyclePayloadSchema = z.object({
  instanceId: z.string(),
  action: z.enum(["starting", "started", "stopping", "stopped", "error", "deleted"]),
  /** ISO timestamp the manager observed the transition. */
  at: z.string(),
});

/**
 * The Cloud OBS container's program scene changed. Observed, not commanded: the
 * obs-instance-manager holds a node-side obs-websocket connection per running
 * instance and forwards CurrentProgramSceneChanged, so this fires for switches
 * made by the auto-switcher, the browser panel, the streamer in OBS over VNC,
 * or a hotkey alike -- and keeps firing with the streamer's own machine off.
 * Also emitted once per (re)connect with the then-current scene, since
 * ws-server has no replay for a browser source that loads mid-stream. Same
 * keep-in-sync caveat as ObsInstanceLifecyclePayloadSchema above.
 */
export const ObsSceneChangedPayloadSchema = z.object({
  instanceId: z.string(),
  sceneName: z.string(),
  /** obs-websocket v5 scene UUID -- stable across renames, unlike sceneName. */
  sceneUuid: z.string(),
  /** ISO timestamp the manager observed the change. */
  at: z.string(),
});

/**
 * Full raw + derived stat set broadcast by ingest-control's session-stats
 * handler. Everything below session identity is optional because RTMP only
 * reports throughput -- the SRT/SRTLA transport fields simply never appear.
 *
 * Deliberately `.loose()`: ingest-control ships independently and adds fields
 * ahead of this package, and this schema doubles as the validator for
 * hand-edited demo payloads. A strict object would reject a payload carrying a
 * field the real producer already emits.
 */
export const IngestStatsPayloadSchema = z
  .object({
    session_id: z.string(),
    protocol: z.enum(["rtmp", "srt", "srtla"]),
    /** Ingest node this session landed on (INGEST_NODE_ID). */
    node_id: z.string().optional(),
    /** Durable "camera" identity the session was authorized under. */
    stream_key_id: z.string().optional(),
    /** Human label of that stream key ("Camera 1"). */
    label: z.string().optional(),
    // Throughput
    kbps: z.number().optional(),
    mbps_recv_rate: z.number().optional(),
    mbps_bandwidth: z.number().optional(),
    mbps_max_bw: z.number().optional(),
    rtt_ms: z.number().optional(),
    // Window counters (since last sample)
    pkt_recv: z.number().optional(),
    pkt_recv_loss: z.number().optional(),
    pkt_recv_drop: z.number().optional(),
    pkt_recv_retrans: z.number().optional(),
    pkt_recv_belated: z.number().optional(),
    pkt_recv_undecrypt: z.number().optional(),
    pkt_reorder_distance: z.number().optional(),
    // Receiver buffer health
    ms_rcv_buf: z.number().optional(),
    byte_rcv_buf: z.number().optional(),
    pkt_flight_size: z.number().optional(),
    // Session totals
    pkt_recv_loss_total: z.number().optional(),
    pkt_recv_drop_total: z.number().optional(),
    pkt_recv_undecrypt_total: z.number().optional(),
    byte_recv_total: z.number().optional(),
    // Derived percentages (loss/drop/retrans over packets expected this window)
    loss_pct: z.number().optional(),
    drop_pct: z.number().optional(),
    retrans_pct: z.number().optional(),
  })
  .loose();

/**
 * One user_states key changed. Emitted by whichever process applied the
 * mutation (bot, rest-api, or the web-overlay widget route) right after the
 * database write, one message per key, into the owning user's room. `value` is
 * the full new value -- state is last-write-wins, so a late or dropped frame
 * is corrected by the next one and readers never need a diff. `null` means the
 * key was deleted.
 */
export const UserStateUpdatePayloadSchema = z.object({
  key: z.string(),
  value: z.unknown().nullable(),
  /** ISO timestamp of the database write. */
  updatedAt: z.string().nullable(),
});

export type OverlayGeoPayload = z.infer<typeof OverlayGeoPayloadSchema>;
export type OverlayGeoEvent = z.infer<typeof OverlayGeoEventSchema>;
export type OverlayStatusPayload = z.infer<typeof OverlayStatusPayloadSchema>;
export type ObsInstanceLifecyclePayload = z.infer<typeof ObsInstanceLifecyclePayloadSchema>;
export type ObsSceneChangedPayload = z.infer<typeof ObsSceneChangedPayloadSchema>;
export type IngestStatsPayload = z.infer<typeof IngestStatsPayloadSchema>;
export type UserStateUpdatePayload = z.infer<typeof UserStateUpdatePayloadSchema>;
