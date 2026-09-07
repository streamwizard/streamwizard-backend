import type { AlertRule, RuleOverrides } from "../types";
import {
  queryEventsubLastEvent,
  queryHttpErrorRateByService,
  queryHttpP95ByService,
  queryLastWriteByTag,
} from "@repo/metrics";
import type { Breach } from "../types";
import {
  API_5XX_MIN_REQUESTS,
  API_5XX_RATE_PCT,
  API_P95_WARN_MS,
  EVENTSUB_SILENCE_MIN,
  SERVICE_SILENT_AFTER_MIN,
} from "./thresholds";
import {
  customRule,
} from "./builders";

/** HTTP / API and EventSub rules. */
export function apiRules(overrides: RuleOverrides): AlertRule[] {
  return [
    // Application plane
    customRule(
      {
        id: "api.5xx_rate",
        title: "HTTP 5xx error rate high",
        forTicks: 1,
        crit: { default: API_5XX_RATE_PCT, unit: "%", direction: "above" },
        async evaluate(ctx, t) {
          const services = await queryHttpErrorRateByService("5m", { bucket: ctx.bucket });
          const breaches: Breach[] = [];
          for (const svc of services) {
            if (svc.total < API_5XX_MIN_REQUESTS) continue;
            const rate = (svc.errors5xx / svc.total) * 100;
            if (rate <= t.crit) continue;
            breaches.push({
              entityId: svc.service,
              severity: "crit",
              value: rate,
              message: `${svc.service} returning ${rate.toFixed(1)}% 5xx (${svc.errors5xx}/${svc.total} in 5m)`,
            });
          }
          return breaches;
        },
      },
      overrides,
    ),
    customRule(
      {
        id: "api.p95_latency",
        title: "HTTP p95 latency high",
        forTicks: 2,
        warn: { default: API_P95_WARN_MS, unit: "ms", direction: "above" },
        async evaluate(ctx, t) {
          const services = await queryHttpP95ByService("10m", { bucket: ctx.bucket });
          return services
            .filter((svc) => svc.p95Ms > t.warn)
            .map((svc) => ({
              entityId: svc.service,
              severity: "warn" as const,
              value: svc.p95Ms,
              message: `${svc.service} p95 latency ${svc.p95Ms.toFixed(0)}ms over 10m (warn > ${t.warn}ms)`,
            }));
        },
      },
      overrides,
    ),
    customRule(
      {
        id: "api.service_silent",
        title: "Service stopped reporting requests",
        forTicks: 2,
        envs: ["prod", "staging"],
        warn: { default: SERVICE_SILENT_AFTER_MIN, unit: "min", direction: "above" },
        async evaluate(ctx, t) {
          const lastWrites = await queryLastWriteByTag("http_request", "service", "24h", { bucket: ctx.bucket });
          const lastSeenByService = new Map(lastWrites.map((w) => [w.tagValue, new Date(w.lastSeen).getTime()]));
          const breaches: Breach[] = [];
          for (const service of ctx.registry.services) {
            const lastSeen = lastSeenByService.get(service);
            if (lastSeen === undefined) continue; // never wrote in 24h — provisioning, not an outage
            const silentForMs = ctx.now.getTime() - lastSeen;
            if (silentForMs < t.warn * 60_000) continue;
            // Escalate when the black-box probe agrees the service is down.
            const probeAlsoFailing = ctx.probeResults.get(service)?.ok === false;
            breaches.push({
              entityId: service,
              severity: probeAlsoFailing ? "crit" : "warn",
              value: Math.round(silentForMs / 1000),
              message: `${service} hasn't written http_request for ${Math.round(silentForMs / 60000)}m${probeAlsoFailing ? " and its health probe is failing" : ""}`,
            });
          }
          return breaches;
        },
      },
      overrides,
    ),
    customRule(
      {
        id: "eventsub.silence",
        title: "EventSub pipeline silent while channels are live",
        forTicks: 1,
        envs: ["prod", "staging"],
        crit: { default: EVENTSUB_SILENCE_MIN, unit: "min", direction: "above" },
        async evaluate(ctx, t) {
          if (!ctx.registry.anyChannelLive) return [];
          // Query range tracks the threshold so a raised limit still finds the last event.
          const rangeMin = Math.max(30, Math.ceil(t.crit));
          const lastEvent = await queryEventsubLastEvent(`${rangeMin}m`, { bucket: ctx.bucket });
          if (lastEvent && ctx.now.getTime() - new Date(lastEvent).getTime() < t.crit * 60_000) return [];
          return [
            {
              entityId: "",
              severity: "crit",
              message: `No EventSub events received in ${Math.round(t.crit)}m while at least one tracked channel is live`,
            },
          ];
        },
      },
      overrides,
    ),
  ];
}
