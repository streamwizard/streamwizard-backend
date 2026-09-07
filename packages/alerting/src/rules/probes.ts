import type { AlertRule, RuleOverrides } from "../types";
import { alertConfig } from "../config";
import { checkSslExpiry } from "../probes";
import type { Breach } from "../types";
import {
  NODE_SILENT_AFTER_MS,
  SSL_CRIT_DAYS,
  SSL_WARN_DAYS,
} from "./thresholds";
import {
  customRule,
  probeRule,
} from "./builders";

/** Synthetic probe rules. */
export function probeRules(overrides: RuleOverrides): AlertRule[] {
  return [
    // Probes
    probeRule(
      {
        id: "probe.fail",
        title: "Black-box probe failing",
        forTicks: 2,
        match: (id) => !id.startsWith("obs-node:") && !id.startsWith("ingest-node:"),
        severity: (_id, alertEnv) => (alertEnv === "prod" ? "crit" : "warn"),
      },
      overrides,
    ),
    probeRule(
      {
        id: "probe.node_unreachable",
        title: "Node health endpoint unreachable",
        // Deliberately slower than the *_silent absence rules (NODE_SILENT_AFTER_MS
        // = 45s): a fully-down node must be caught by the crit silence path,
        // with the engine suppressing this probe before it can fire a redundant
        // warn (see suppressRedundantNodeProbes). That only holds if this rule
        // needs MORE consecutive ticks than silence needs to start breaching —
        // worst case, a node dies just after a tick, so silence first breaches
        // ceil(45s/tick)+1 ticks later while this probe has been failing since
        // tick one. forTicks therefore derives from the tick length: 4 at the
        // 15s default, 2 at the 60s production setting. A node that serves
        // metrics but whose health endpoint is down still fires here, one tick
        // after the suppression window would have engaged.
        forTicks: Math.min(10, Math.ceil(NODE_SILENT_AFTER_MS / 1000 / alertConfig.tickSeconds) + 1),
        envs: ["prod", "staging"],
        match: (id) => id.startsWith("obs-node:") || id.startsWith("ingest-node:"),
        severity: () => "warn", // the *_silent absence rules own the crit path
      },
      overrides,
    ),
    customRule(
      {
        id: "probe.ssl_expiry",
        title: "TLS certificate expiring",
        forTicks: 1,
        envs: ["prod"],
        warn: { default: SSL_WARN_DAYS, unit: "days", direction: "below" },
        crit: { default: SSL_CRIT_DAYS, unit: "days", direction: "below" },
        async evaluate(ctx, t) {
          const certs = await checkSslExpiry(ctx.now);
          const breaches: Breach[] = [];
          for (const cert of certs) {
            if (cert.daysRemaining >= t.warn) continue;
            breaches.push({
              entityId: cert.hostname,
              severity: cert.daysRemaining < t.crit ? "crit" : "warn",
              value: cert.daysRemaining,
              message: `Certificate for ${cert.hostname} expires in ${cert.daysRemaining.toFixed(1)} days`,
            });
          }
          return breaches;
        },
      },
      overrides,
    ),
  ];
}
