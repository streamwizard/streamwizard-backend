import type { OverlayEventType } from "@repo/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ServerWebSocket<T = any> = import("bun").ServerWebSocket<T>;

export interface ConnectionData {
  role: "publisher" | "subscriber" | "bot" | "monitor" | "consumer";
  userId: string;
  session_id?: string;
  channels: Set<OverlayEventType>;
  connectedAt: number;
  connId: string;
  /**
   * Consumer-only: message types this consumer wants (from `?types=` CSV).
   * Empty/absent = every bot-routed type. Unlike subscriber `channels`, a
   * consumer sees ALL users' rooms — the role is gated on CONSUMER_SECRET.
   */
  consumerTypes?: Set<string>;
  /**
   * Self-declared identity of a bot connection ("ingest-node:<id>",
   * "streamwizard-bot"). Observability-only: every bot shares the same
   * secret, so a forged source can mislabel but not escalate.
   */
  source?: string;
}

export interface RoomData {
  publisher: ServerWebSocket<ConnectionData> | null;
  subscribers: Set<ServerWebSocket<ConnectionData>>;
  session_id: string;
  stream_id: string | null;
  /** epoch ms of the last irl_geo_track insert — gates DB write rate, not broadcasts */
  lastGeoInsertAt?: number;
  /**
   * epoch ms of the last geo message ACCEPTED from the primary publisher.
   * Lets a standby publisher take over when the primary goes silent (half-open
   * TCP, page killed without a close frame) instead of the room going dark.
   */
  lastGeoAt?: number;
}
