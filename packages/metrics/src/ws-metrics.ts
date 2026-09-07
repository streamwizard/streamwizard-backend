import { Point } from "@influxdata/influxdb-client";
import { pushPoint } from "./influx-client";

export function trackWsConnection(
  role: "publisher" | "subscriber" | "bot" | "consumer",
  event: "open" | "close",
  durationMs?: number,
  source?: string,
): void {
  const point = new Point("ws_connection")
    .tag("service", "ws-server")
    .tag("role", role)
    .tag("event", event)
    .intField("count", 1);

  // Bot self-declared identity ("ingest-node:<id>") — bounded cardinality:
  // one value per node/bot process.
  if (source !== undefined) {
    point.tag("source", source);
  }
  if (durationMs !== undefined) {
    point.floatField("duration_ms", durationMs);
  }

  pushPoint(point);
}

export function trackWsMessage(role: "publisher" | "subscriber" | "bot" | "consumer", messageType: string, source?: string): void {
  const point = new Point("ws_message")
    .tag("service", "ws-server")
    .tag("role", role)
    .tag("message_type", messageType)
    .intField("count", 1);

  if (source !== undefined) {
    point.tag("source", source);
  }

  pushPoint(point);
}

export function trackWsAuthFailure(
  role: "publisher" | "subscriber" | "bot" | "consumer" | "unknown",
  reason: "rate_limited" | "invalid_token" | "missing_token" | "invalid_role" | "invalid_bot_key" | "upgrade_failed",
): void {
  pushPoint(
    new Point("ws_auth_failure")
      .tag("service", "ws-server")
      .tag("role", role)
      .tag("reason", reason)
      .intField("count", 1),
  );
}

export function trackWsMessageDrop(
  role: "publisher" | "subscriber" | "bot",
  reason: "room_not_found" | "malformed_json" | "malformed_node_metrics" | "not_primary",
): void {
  pushPoint(
    new Point("ws_message_drop")
      .tag("service", "ws-server")
      .tag("role", role)
      .tag("reason", reason)
      .intField("count", 1),
  );
}

export function trackWsRoomEvent(
  event: "created" | "deleted" | "publisher_joined" | "publisher_left" | "publisher_replaced",
): void {
  pushPoint(
    new Point("ws_room")
      .tag("service", "ws-server")
      .tag("event", event)
      .intField("count", 1),
  );
}
