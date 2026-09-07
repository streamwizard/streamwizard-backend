import { Point } from "@influxdata/influxdb-client";
import { pushPoint } from "./influx-client";

// obs-auto-switcher engine counters. Cardinality is bounded: a handful of
// event kinds x switch reasons, never tagged by user.
export function trackAutoSwitcherEvent(
  event: "switch" | "switch_failed" | "auto_stop" | "feed_reconnect" | "config_push",
  reason?: string,
): void {
  const point = new Point("auto_switcher")
    .tag("service", "obs-auto-switcher")
    .tag("event", event)
    .intField("count", 1);
  if (reason !== undefined) {
    point.tag("reason", reason);
  }
  pushPoint(point);
}
