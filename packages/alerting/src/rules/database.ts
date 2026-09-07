import type { AlertRule, RuleOverrides } from "../types";
import {
  queryBucketPointCount,
  queryDbQueryErrorRate,
  querySupabaseDbConnections,
  querySupabaseDbCpuPct,
  querySupabaseDbDiskPct,
  querySupabaseLastScrape,
  querySupabaseMaxConnections,
} from "@repo/metrics";
import {
  DB_ERROR_MIN_QUERIES,
  DB_ERROR_RATE_PCT,
  SUPABASE_DB_CONN_CRIT_PCT,
  SUPABASE_DB_CONN_WARN_PCT,
  SUPABASE_DB_CPU_CRIT_PCT,
  SUPABASE_DB_CPU_WARN_PCT,
  SUPABASE_DB_DISK_CRIT_PCT,
  SUPABASE_DB_DISK_WARN_PCT,
  SUPABASE_SCRAPE_SILENT_MIN,
} from "./thresholds";
import {
  customRule,
  supabaseLatest,
  thresholdRule,
} from "./builders";

/** Database, Supabase platform and pipeline rules. */
export function databaseRules(overrides: RuleOverrides): AlertRule[] {
  return [
    customRule(
      {
        id: "db.query_error_rate",
        title: "Supabase query error rate high",
        forTicks: 2,
        crit: { default: DB_ERROR_RATE_PCT, unit: "%", direction: "above" },
        async evaluate(ctx, t) {
          const { total, errors } = await queryDbQueryErrorRate("5m", { bucket: ctx.bucket });
          if (total < DB_ERROR_MIN_QUERIES) return [];
          const rate = (errors / total) * 100;
          if (rate <= t.crit) return [];
          return [
            {
              entityId: "",
              severity: "crit",
              value: rate,
              message: `${rate.toFixed(1)}% of Supabase queries failing (${errors}/${total} in 5m)`,
            },
          ];
        },
      },
      overrides,
    ),
    // Meta
    customRule(
      {
        id: "meta.pipeline_silent",
        title: "Metrics pipeline silent",
        forTicks: 2,
        envs: ["prod"],
        async evaluate(ctx) {
          const points = await queryBucketPointCount("5m", { bucket: ctx.bucket });
          if (points > 0) return [];
          return [
            {
              entityId: "",
              severity: "crit",
              value: 0,
              message: `No points written to ${ctx.bucket} in 5m — the whole metrics write path is down`,
            },
          ];
        },
      },
      overrides,
    ),
    // Supabase platform (rules 25–28) — data comes from Telegraf scraping the
    // per-project privileged metrics endpoint. When Telegraf hasn't written
    // recently the fetchers return no samples, so these stay quiet instead of
    // false-firing; scrape_silent is what notices that condition.
    thresholdRule(
      {
        id: "supabase.db_cpu",
        title: "Supabase DB CPU high",
        forTicks: 3,
        warn: SUPABASE_DB_CPU_WARN_PCT,
        crit: SUPABASE_DB_CPU_CRIT_PCT,
        unit: "%",
        fetch: (ctx) => supabaseLatest(querySupabaseDbCpuPct, ctx),
        format: (_e, v, t) => `Supabase DB CPU at ${v.toFixed(0)}% (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "supabase.connections",
        title: "Supabase connections near limit",
        forTicks: 2,
        warn: SUPABASE_DB_CONN_WARN_PCT,
        crit: SUPABASE_DB_CONN_CRIT_PCT,
        unit: "%",
        fetch: async (ctx) => {
          const [series, max] = await Promise.all([
            querySupabaseDbConnections("15m", "5m", { bucket: ctx.bucket }),
            querySupabaseMaxConnections({ bucket: ctx.bucket }),
          ]);
          const latest = series.at(-1);
          if (latest === undefined || max === null || max === 0) return [];
          return [{ entityId: "supabase", value: (latest.value / max) * 100 }];
        },
        format: (_e, v, t) => `Supabase at ${v.toFixed(0)}% of max_connections (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "supabase.db_disk",
        title: "Supabase DB disk filling",
        forTicks: 2,
        warn: SUPABASE_DB_DISK_WARN_PCT,
        crit: SUPABASE_DB_DISK_CRIT_PCT,
        unit: "%",
        fetch: (ctx) => supabaseLatest(querySupabaseDbDiskPct, ctx),
        format: (_e, v, t) => `Supabase DB disk at ${v.toFixed(0)}% (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    customRule(
      {
        id: "supabase.scrape_silent",
        title: "Supabase metrics scrape silent",
        forTicks: 2,
        envs: ["prod", "staging"],
        warn: { default: SUPABASE_SCRAPE_SILENT_MIN, unit: "min", direction: "above" },
        async evaluate(ctx, t) {
          const lastScrape = await querySupabaseLastScrape({ bucket: ctx.bucket });
          // Never scraped in 24h = Telegraf not set up for this env yet — a
          // provisioning gap, not an outage (same policy as the absence rules).
          if (lastScrape === null) return [];
          const silentForMs = ctx.now.getTime() - new Date(lastScrape).getTime();
          if (silentForMs < t.warn * 60_000) return [];
          return [
            {
              entityId: "supabase",
              severity: "warn",
              value: Math.round(silentForMs / 1000),
              message: `Supabase platform metrics last scraped ${Math.round(silentForMs / 60000)}m ago — DB rules are blind`,
            },
          ];
        },
      },
      overrides,
    ),
  ];
}
