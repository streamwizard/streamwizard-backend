import type { AlertRule, Env, RuleKnob, RuleOverrides } from "./types";
import { apiRules } from "./rules/api";
import { databaseRules } from "./rules/database";
import { ingestRules } from "./rules/ingest";
import { obsNodeRules } from "./rules/obs-nodes";
import { probeRules } from "./rules/probes";
import { websocketRules } from "./rules/websocket";

// The rule catalog (monitoring plan v2.2 §4) lives in ./rules, one module per
// domain. The thresholds there are CODE DEFAULTS; admins can override
// warn/crit/forTicks/envs/enabled per rule via the alert_rule_config table
// (edited on /alerts/rules), which the engine passes into buildRules() on every
// tick. Query logic and rule identity stay in code — only the numbers are
// database-tunable.

export * from "./rules/thresholds";

export function buildRules(overrides: RuleOverrides = {}): AlertRule[] {
  return [
    ...obsNodeRules(overrides),
    ...ingestRules(overrides),
    ...apiRules(overrides),
    ...websocketRules(overrides),
    ...databaseRules(overrides),
    ...probeRules(overrides),
  ];
}

// --- Serializable catalog for the rules UI ---

const RULE_GROUPS: Record<string, string> = {
  gpu: "OBS / GPU nodes",
  obs: "OBS / GPU nodes",
  ingest: "Ingest nodes",
  api: "HTTP / API",
  eventsub: "EventSub",
  ws: "WebSocket",
  db: "Database",
  supabase: "Supabase platform",
  meta: "Meta",
  probe: "Probes",
};

export interface RuleCatalogEntry {
  id: string;
  title: string;
  group: string;
  defaultForTicks: number;
  defaultEnvs: Env[];
  warn?: RuleKnob;
  crit?: RuleKnob;
}

/** Code defaults for every rule, without evaluate closures — safe to hand to
 * client components on /alerts/rules. */
export function getRuleCatalog(): RuleCatalogEntry[] {
  return buildRules().map((rule) => ({
    id: rule.id,
    title: rule.title,
    group: RULE_GROUPS[rule.id.split(".")[0] ?? ""] ?? "Other",
    defaultForTicks: rule.meta?.defaultForTicks ?? rule.forTicks,
    defaultEnvs: rule.meta?.defaultEnvs ?? ["prod", "staging", "dev"],
    warn: rule.meta?.warn,
    crit: rule.meta?.crit,
  }));
}
