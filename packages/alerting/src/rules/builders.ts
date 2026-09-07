import {
  queryLatestObsNodeFields,
  queryLatestHostSystemFields,
  queryIngestStreamActivity,
  queryHttpErrorRateByService,
  queryHttpP95ByService,
  queryLastWriteByTag,
  queryBucketPointCount,
  queryObsInstanceEvents,
  queryWsEventTotal,
  queryDbQueryErrorRate,
  queryEventsubLastEvent,
  querySupabaseDbCpuPct,
  querySupabaseDbDiskPct,
  querySupabaseDbConnections,
  querySupabaseMaxConnections,
  querySupabaseLastScrape,
  type PlatformPoint,
  type QueryOpts,
} from "@repo/metrics";
import type { AlertRule, Breach, Env, EnvContext, RuleKnob, RuleOverrides, Severity } from "../types";

/** Rule constructors shared by every rule group: they apply admin overrides,
 *  attach catalog metadata, and turn a fetch+compare into an AlertRule. */

export interface ThresholdSample {
  entityId: string;
  value: number;
}

export function thresholdRule(
  opts: {
    id: string;
    title: string;
    forTicks: number;
    envs?: Env[];
    fetch: (ctx: EnvContext) => Promise<ThresholdSample[]>;
    warn?: number;
    crit?: number;
    direction?: "above" | "below";
    /** Unit label for the rules UI (e.g. "%", "°C", "ms"). */
    unit?: string;
    /** false = thresholds are structural (not meaningful to edit) — the UI
     * hides them and overrides are ignored. */
    tunable?: boolean;
    format: (entityId: string, value: number, t: { warn?: number; crit?: number }) => string;
  },
  overrides: RuleOverrides,
): AlertRule {
  const o = overrides[opts.id] ?? {};
  const direction = opts.direction ?? "above";
  const tunable = opts.tunable ?? true;
  const warn = (tunable ? o.warn : null) ?? opts.warn;
  const crit = (tunable ? o.crit : null) ?? opts.crit;
  const t = { warn, crit };
  return {
    id: opts.id,
    title: opts.title,
    envs: o.envs ?? opts.envs,
    forTicks: o.forTicks ?? opts.forTicks,
    enabled: o.enabled ?? true,
    meta: {
      warn: tunable && opts.warn !== undefined ? { default: opts.warn, unit: opts.unit ?? "", direction } : undefined,
      crit: tunable && opts.crit !== undefined ? { default: opts.crit, unit: opts.unit ?? "", direction } : undefined,
      defaultForTicks: opts.forTicks,
      defaultEnvs: opts.envs,
    },
    async evaluate(ctx) {
      const samples = await opts.fetch(ctx);
      const breaches: Breach[] = [];
      for (const sample of samples) {
        const breachesCrit =
          crit !== undefined && (direction === "above" ? sample.value > crit : sample.value < crit);
        const breachesWarn =
          warn !== undefined && (direction === "above" ? sample.value > warn : sample.value < warn);
        if (!breachesCrit && !breachesWarn) continue;
        breaches.push({
          entityId: sample.entityId,
          severity: breachesCrit ? "crit" : "warn",
          value: sample.value,
          message: opts.format(sample.entityId, sample.value, t),
        });
      }
      return breaches;
    },
  };
}

export function absenceRule(
  opts: {
    id: string;
    title: string;
    measurement: string;
    tag: string;
    /** Registry entities expected to be writing. entityId is the stable
     * state key (node uuid); label is what humans see in alert messages. */
    expected: (ctx: EnvContext) => { entityId: string; label?: string }[];
    silentAfterMs: number;
  },
  overrides: RuleOverrides,
): AlertRule {
  const o = overrides[opts.id] ?? {};
  const defaultEnvs: Env[] = ["prod", "staging"]; // absence detection is disabled for dev
  // The tunable knob is exposed in minutes (crit column), stored default is ms.
  const silentAfterMs = o.crit != null ? o.crit * 60_000 : opts.silentAfterMs;
  return {
    id: opts.id,
    title: opts.title,
    envs: o.envs ?? defaultEnvs,
    forTicks: o.forTicks ?? 2,
    enabled: o.enabled ?? true,
    meta: {
      crit: { default: opts.silentAfterMs / 60_000, unit: "min", direction: "above" },
      defaultForTicks: 2,
      defaultEnvs,
    },
    async evaluate(ctx) {
      const lastWrites = await queryLastWriteByTag(opts.measurement, opts.tag, "24h", { bucket: ctx.bucket });
      const lastSeenByEntity = new Map(lastWrites.map((w) => [w.tagValue, new Date(w.lastSeen).getTime()]));
      const breaches: Breach[] = [];
      for (const entity of opts.expected(ctx)) {
        const lastSeen = lastSeenByEntity.get(entity.entityId);
        // 24h prior-report requirement: an entity that never wrote in the
        // last day is a provisioning problem, not a fresh outage. This also
        // keeps freshly registered nodes quiet until their first report.
        if (lastSeen === undefined) continue;
        const silentForMs = ctx.now.getTime() - lastSeen;
        if (silentForMs < silentAfterMs) continue;
        breaches.push({
          entityId: entity.entityId,
          severity: "crit",
          value: Math.round(silentForMs / 1000),
          message: `${opts.title}: ${entity.label ?? entity.entityId} last reported ${Math.round(silentForMs / 60000)}m ago`,
        });
      }
      return breaches;
    },
  };
}

export function probeRule(
  opts: {
    id: string;
    title: string;
    forTicks: number;
    envs?: Env[];
    /** Which probe results this rule owns. */
    match: (probeId: string) => boolean;
    severity: (probeId: string, env: Env) => Severity;
  },
  overrides: RuleOverrides,
): AlertRule {
  const o = overrides[opts.id] ?? {};
  return {
    id: opts.id,
    title: opts.title,
    envs: o.envs ?? opts.envs,
    forTicks: o.forTicks ?? opts.forTicks,
    enabled: o.enabled ?? true,
    meta: { defaultForTicks: opts.forTicks, defaultEnvs: opts.envs },
    async evaluate(ctx) {
      const breaches: Breach[] = [];
      for (const probe of ctx.probeResults.values()) {
        if (!opts.match(probe.id) || probe.ok) continue;
        breaches.push({
          entityId: probe.id,
          severity: opts.severity(probe.id, ctx.env),
          value: probe.statusCode,
          message: `Probe ${probe.id} failed: ${probe.statusCode ?? probe.error ?? "unknown error"}`,
        });
      }
      return breaches;
    },
  };
}

/** Rules with bespoke evaluate logic still get override resolution and knob
 * metadata; evaluate receives the effective thresholds as `t`. */
export function customRule(
  opts: {
    id: string;
    title: string;
    forTicks: number;
    envs?: Env[];
    warn?: RuleKnob;
    crit?: RuleKnob;
    evaluate: (ctx: EnvContext, t: { warn: number; crit: number }) => Promise<Breach[]>;
  },
  overrides: RuleOverrides,
): AlertRule {
  const o = overrides[opts.id] ?? {};
  const t = {
    warn: o.warn ?? opts.warn?.default ?? NaN,
    crit: o.crit ?? opts.crit?.default ?? NaN,
  };
  return {
    id: opts.id,
    title: opts.title,
    envs: o.envs ?? opts.envs,
    forTicks: o.forTicks ?? opts.forTicks,
    enabled: o.enabled ?? true,
    meta: { warn: opts.warn, crit: opts.crit, defaultForTicks: opts.forTicks, defaultEnvs: opts.envs },
    evaluate: (ctx) => opts.evaluate(ctx, t),
  };
}

// --- Fetch helpers shared by threshold rules ---

/** Latest value of a Supabase platform series as a single "supabase" entity;
 * empty when Telegraf hasn't written the series recently. */
export async function supabaseLatest(
  query: (fluxRange: string, window: string, opts?: QueryOpts) => Promise<PlatformPoint[]>,
  ctx: EnvContext,
): Promise<ThresholdSample[]> {
  const series = await query("15m", "5m", { bucket: ctx.bucket });
  const latest = series.at(-1);
  return latest === undefined ? [] : [{ entityId: "supabase", value: latest.value }];
}

export async function obsNodeField(
  ctx: EnvContext,
  pick: (fields: Record<string, number>) => number | undefined,
): Promise<ThresholdSample[]> {
  const nodes = await queryLatestObsNodeFields("10m", { bucket: ctx.bucket });
  return nodes.flatMap((node) => {
    const value = pick(node.fields);
    return value === undefined || Number.isNaN(value) ? [] : [{ entityId: node.nodeId, value }];
  });
}

export async function hostSystemField(
  ctx: EnvContext,
  pick: (fields: Record<string, number>) => number | undefined,
): Promise<ThresholdSample[]> {
  const hosts = await queryLatestHostSystemFields("10m", { bucket: ctx.bucket });
  return hosts.flatMap((host) => {
    const value = pick(host.fields);
    return value === undefined || Number.isNaN(value) ? [] : [{ entityId: host.nodeId, value }];
  });
}

export const pct = (used?: number, total?: number): number | undefined =>
  used !== undefined && total !== undefined && total > 0 ? (used / total) * 100 : undefined;

// --- The catalog ---
