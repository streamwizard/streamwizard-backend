import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase/types/supabase";

export type Env = "prod" | "staging" | "dev";
export type Severity = "warn" | "crit";

/** One entity breaching one rule on this tick. entityId is "" for
 * fleet/env-wide rules so it maps onto alert_state's default. */
export interface Breach {
  entityId: string;
  severity: Severity;
  value?: number;
  message: string;
}

export interface ProbeResult {
  id: string;
  ok: boolean;
  statusCode?: number;
  error?: string;
  latencyMs: number;
}

/** The slice of an obs_nodes / ingest_nodes row the alert-worker needs. */
export interface RegistryNode {
  id: string;
  name: string;
  status: string;
  maintenance: boolean;
  createdAt: string;
  apiUrl?: string | null;
  tailscaleIp?: string | null;
}

export interface LiveIngestSession {
  sessionId: string;
  startedAt: string;
}

export interface Registry {
  obsNodes: RegistryNode[];
  ingestNodes: RegistryNode[];
  /** Services expected to write http_request continuously. */
  services: string[];
  liveIngestSessions: LiveIngestSession[];
  anyChannelLive: boolean;
}

export interface EnvContext {
  env: Env;
  bucket: string;
  now: Date;
  supabase: SupabaseClient<Database>;
  registry: Registry;
  probeResults: Map<string, ProbeResult>;
}

/** One editable numeric threshold on a rule. `default` is the code default;
 * the effective value may be overridden per rule via alert_rule_config. */
export interface RuleKnob {
  default: number;
  unit: string;
  direction: "above" | "below";
}

/** UI metadata: which knobs exist and what the code defaults are. */
export interface RuleMeta {
  warn?: RuleKnob;
  crit?: RuleKnob;
  defaultForTicks: number;
  /** undefined = all three envs by default. */
  defaultEnvs?: Env[];
}

/** A row of alert_rule_config mapped to engine terms. All-null (or a missing
 * record entirely) means the code default applies. */
export interface RuleOverride {
  enabled?: boolean;
  warn?: number | null;
  crit?: number | null;
  forTicks?: number | null;
  envs?: Env[] | null;
}

export type RuleOverrides = Record<string, RuleOverride>;

export interface AlertRule {
  id: string;
  title: string;
  /** Which environments the rule runs in; undefined = all three. */
  envs?: Env[];
  /** Consecutive breaching ticks before the alert fires. */
  forTicks: number;
  /** false = admin disabled via alert_rule_config; skipped at evaluation but
   * kept in the state machine so a firing alert resolves cleanly. */
  enabled?: boolean;
  meta?: RuleMeta;
  evaluate(ctx: EnvContext): Promise<Breach[]>;
}

/** Last-known resource stats for the node an alert is about; the engine
 * fills these from the latest Influx samples so a "node down" message can
 * show what the box looked like right before it went dark. */
export interface NodeStats {
  cpuPct?: number;
  memUsedMb?: number;
  memTotalMb?: number;
  diskPct?: number;
  /** rx+tx, ingest hosts only. */
  bandwidthMbps?: number;
  gpuTempC?: number;
  vramUsedMb?: number;
  vramTotalMb?: number;
  runningInstances?: number;
  maxInstances?: number;
}

export interface NodeInfo {
  kind: "obs" | "ingest";
  name: string;
  /** Ingest: tailscale IP. OBS: api URL. */
  address?: string;
  stats?: NodeStats;
}

/** What the notifier sends after state transitions are computed. */
export interface AlertNotification {
  kind: "fired" | "resolved" | "renotified";
  ruleId: string;
  ruleTitle: string;
  env: Env;
  entityId: string;
  /** Human-friendly entity name (e.g. "test (100.71.15.32)"); the engine
   * resolves it from the registry, entityId stays the stable key. */
  entityLabel?: string;
  /** Set when the entity is a registry node — name, address, last stats. */
  node?: NodeInfo;
  severity: Severity;
  value?: number;
  message: string;
  /** When the alert first started firing (for "firing since" rendering). */
  firedAt?: string | null;
}
