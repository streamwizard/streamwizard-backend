import { Point } from "@influxdata/influxdb-client";
import { pushPoint } from "./influx-client";

export function trackEventSubReceived(eventType: string, handled: boolean): void {
  pushPoint(
    new Point("eventsub_event")
      .tag("service", "rest-api")
      .tag("event_type", eventType)
      .tag("handled", String(handled))
      .intField("count", 1),
  );
}

export function trackEventSubRevocation(eventType: string): void {
  pushPoint(
    new Point("eventsub_revocation")
      .tag("service", "rest-api")
      .tag("event_type", eventType)
      .intField("count", 1),
  );
}

export function trackEventSubConnection(
  service: string,
  event: "connected" | "lost" | "reconnect_attempt",
  fields?: { downtimeMs?: number; attempt?: number },
): void {
  const point = new Point("eventsub_connection")
    .tag("service", service)
    .tag("event", event)
    .intField("count", 1);
  if (fields?.downtimeMs !== undefined) point.intField("downtime_ms", Math.round(fields.downtimeMs));
  if (fields?.attempt !== undefined) point.intField("attempt", fields.attempt);
  pushPoint(point);
}
