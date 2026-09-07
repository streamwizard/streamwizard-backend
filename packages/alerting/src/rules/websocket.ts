import type { AlertRule, RuleOverrides } from "../types";
import {
  queryWsEventTotal,
} from "@repo/metrics";
import {
  WS_AUTH_FAILURE_SPIKE,
} from "./thresholds";
import {
  customRule,
} from "./builders";

/** WebSocket rules. */
export function websocketRules(overrides: RuleOverrides): AlertRule[] {
  return [
    customRule(
      {
        id: "ws.auth_failure_spike",
        title: "WebSocket auth failures spiking",
        forTicks: 1,
        warn: { default: WS_AUTH_FAILURE_SPIKE, unit: "count / 5m", direction: "above" },
        async evaluate(ctx, t) {
          const count = await queryWsEventTotal("ws_auth_failure", "5m", { bucket: ctx.bucket });
          if (count <= t.warn) return [];
          return [
            {
              entityId: "",
              severity: "warn",
              value: count,
              message: `${count} WebSocket auth failures in 5m (warn > ${t.warn})`,
            },
          ];
        },
      },
      overrides,
    ),
    customRule(
      {
        id: "ws.message_drops",
        title: "WebSocket messages malformed",
        forTicks: 1,
        warn: { default: 0, unit: "count / 5m", direction: "above" },
        async evaluate(ctx, t) {
          // room_not_found is excluded on purpose: a bot broadcast for a user
          // with no open dashboard/overlay is normal operation (ingest stats
          // arrive every second whether or not anyone subscribed), so counting
          // it here made every unwatched stream page an operator. What's left
          // — malformed payloads — always indicates a protocol bug or version
          // skew between a bot client and ws-server, so the threshold stays 0.
          const count = await queryWsEventTotal("ws_message_drop", "5m", { bucket: ctx.bucket }, ["room_not_found"]);
          if (count <= t.warn) return [];
          return [
            {
              entityId: "",
              severity: "warn",
              value: count,
              message: `${count} malformed WebSocket messages dropped in 5m`,
            },
          ];
        },
      },
      overrides,
    ),
  ];
}
