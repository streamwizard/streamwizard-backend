import type { IngestNodeBandwidthPayload } from "@repo/types";

export interface MonitorEnvelope {
  ts: number;
  kind: "message" | "connect" | "disconnect" | "room" | "snapshot";
  direction: "inbound" | "outbound" | "system";
  role: "publisher" | "subscriber" | "bot" | "consumer";
  roomId: string;
  eventType?: string;
  payload?: unknown;
  /** Bot self-declared identity ("ingest-node:<id>"), when the sender is a bot. */
  source?: string;
  meta?: {
    subscriberCount?: number;
    hasPublisher?: boolean;
    durationMs?: number;
    sessionId?: string;
    /**
     * For bot messages: whether a room existed and the message actually
     * reached subscribers. Mirrored envelopes are sent to monitors either way
     * so ops can see stats for streams nobody is watching.
     */
    delivered?: boolean;
  };
}

export interface ConnectionSnapshot {
  connId: string;
  role: "publisher" | "subscriber";
  connectedAt: number;
  channels: string[];
}

export interface RoomSnapshot {
  roomId: string;
  hasPublisher: boolean;
  subscriberCount: number;
  sessionId: string;
  streamId: string | null;
  connections: ConnectionSnapshot[];
}

export interface BotSnapshot {
  connected: boolean;
  connId: string | null;
  connectedAt: number | null;
}

export interface BotConnSnapshot {
  connId: string;
  connectedAt: number;
  source: string;
}

export interface ConsumerConnSnapshot {
  connId: string;
  connectedAt: number;
  source: string;
  /** Message-type filter the consumer subscribed with (empty = everything). */
  types: string[];
}

/** Latest non-stale bandwidth reading for one ingest node. */
export interface IngestNodeLive {
  nodeId: string;
  /** Sample timestamp from the node (epoch ms). */
  ts: number;
  rxBps: number;
  txBps: number;
  tsRxBps: number;
  tsTxBps: number;
}

export interface MonitorSnapshot {
  ts: number;
  kind: "snapshot";
  rooms: RoomSnapshot[];
  totalConnections: number;
  /** Legacy single-bot view, derived from `bots` — kept for older monitor UIs. */
  bot: BotSnapshot;
  bots: BotConnSnapshot[];
  consumers: ConsumerConnSnapshot[];
  ingestNodes: IngestNodeLive[];
  ingestFleet: { rxBps: number; txBps: number; nodeCount: number };
}

/** Live per-node bandwidth forward — no roomId, so no masking applies. */
export interface MonitorNodeBandwidth {
  ts: number;
  kind: "node_bandwidth";
  source?: string;
  payload: IngestNodeBandwidthPayload;
}

export type MonitorMessage = MonitorEnvelope | MonitorSnapshot | MonitorNodeBandwidth;
