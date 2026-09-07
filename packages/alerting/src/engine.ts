import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/core";
import { z } from "zod";
import { supabase as supabaseAdmin } from "@repo/supabase";
import {
  fetchAlertTickSnapshot,
  persistAlertTick,
  type AlertEventInsert,
  type AlertState,
  type AlertStateUpsert,
} from "@repo/supabase/queries/alerts";
import { alertConfig } from "./config";
import { homeEnv } from "./home-env";
import { queryLatestObsNodeFields, queryLatestHostSystemFields } from "@repo/metrics";
import { buildRules } from "./rules";
import { runProbes } from "./probes";
import { computeTransitions } from "./state";
import { dispatchNotifications, resolveRoute, type EnvRoute } from "./notify";
import type {
  AlertNotification,
  AlertRule,
  Breach,
  Env,
  EnvContext,
  ProbeResult,
  Registry,
  RuleOverrides,
} from "./types";

const LOCK_NAME = "alert-worker";
// Above the worst legitimate pass (10s probes + 15s rule timeout + persistence)
// so a running pass is never stolen; low enough that a crashed pass only
// blocks a couple of 15s ticks.
const LOCK_TTL_SECONDS = 35;
const RULE_TIMEOUT_MS = 15_000;

export interface EnvTickSummary {
  env: Env;
  rulesEvaluated: number;
  ruleErrors: number;
  breaches: number;
  fired: number;
  resolved: number;
  notifyFailures: number;
  durationMs: number;
}

export interface TickSummary {
  skipped: boolean;
  reason?: string;
  envs: EnvTickSummary[];
  durationMs: number;
}

// Env resolution lives in ./home-env — web-admin re-exports it for the
// layout badge, so the UI can never disagree with what the engine evaluates.

/** Services expected to write http_request continuously. ws-server and the
 * web apps don't run metricsMiddleware — their liveness comes from probes. */
const EXPECTED_HTTP_SERVICES = ["rest-api"];

// ── Tick snapshot ────────────────────────────────────────────────────────────
// Everything the pass needs arrives in one RPC payload (lock + registry +
// configs + previous state — see the alert_worker_tick_rpcs migration). The
// shape is validated here at the boundary: the dangerous failure mode is a
// malformed payload being swallowed by a catch and quietly emptying the
// registry, leaving the worker looking healthy while alerting on nothing.
// A validation failure is treated exactly like the RPC failing — fail open.

const snapshotNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  maintenance: z.boolean(),
  created_at: z.string(),
  api_url: z.string().nullish(),
  tailscale_ip: z.string().nullish(),
});

const tickSnapshotSchema = z.object({
  locked: z.literal(true),
  obs_nodes: z.array(snapshotNodeSchema),
  ingest_nodes: z.array(snapshotNodeSchema),
  live_ingest_sessions: z.array(z.object({ id: z.string(), started_at: z.string() })),
  any_channel_live: z.boolean(),
  rule_configs: z.array(
    z.object({
      rule_id: z.string(),
      enabled: z.boolean(),
      warn: z.number().nullable(),
      crit: z.number().nullable(),
      for_ticks: z.number().nullable(),
      envs: z.array(z.string()).nullable(),
    }),
  ),
  notification_config: z
    .object({
      discord_channel_id: z.string().nullable(),
      discord_target: z.string(),
      discord_severity: z.string(),
      telegram_chat_id: z.string().nullable(),
      telegram_severity: z.string(),
    })
    .nullable(),
  alert_states: z.array(
    z.object({
      id: z.string(),
      rule_id: z.string(),
      env: z.string(),
      entity_id: z.string(),
      status: z.string(),
      severity: z.string().nullable(),
      consecutive_breaches: z.number(),
      first_fired_at: z.string().nullable(),
      last_notified_at: z.string().nullable(),
      silenced_until: z.string().nullable(),
      notify_failed: z.boolean(),
      last_value: z.number().nullable(),
      message: z.string().nullable(),
      updated_at: z.string(),
    }),
  ),
});

type TickSnapshot = z.infer<typeof tickSnapshotSchema>;

const notLockedSchema = z.object({ locked: z.literal(false) });

/** "not-locked" is the contested-lock miniature payload — the server skips
 * building the registry when the pass won't run anyway. Anything else must
 * be a full, well-formed snapshot or this throws. */
export function parseTickSnapshot(raw: unknown): TickSnapshot | "not-locked" {
  if (notLockedSchema.safeParse(raw).success) return "not-locked";
  return tickSnapshotSchema.parse(raw);
}

export function registryFromSnapshot(snapshot: TickSnapshot): Registry {
  return {
    obsNodes: snapshot.obs_nodes.map((n) => ({
      id: n.id,
      name: n.name,
      status: n.status,
      maintenance: n.maintenance,
      createdAt: n.created_at,
      apiUrl: n.api_url ?? null,
    })),
    ingestNodes: snapshot.ingest_nodes.map((n) => ({
      id: n.id,
      name: n.name,
      status: n.status,
      maintenance: n.maintenance,
      createdAt: n.created_at,
      tailscaleIp: n.tailscale_ip ?? null,
    })),
    services: EXPECTED_HTTP_SERVICES,
    liveIngestSessions: snapshot.live_ingest_sessions.map((s) => ({
      sessionId: s.id,
      startedAt: s.started_at,
    })),
    anyChannelLive: snapshot.any_channel_live,
  };
}

export function overridesFromSnapshot(snapshot: TickSnapshot): RuleOverrides {
  return Object.fromEntries(
    snapshot.rule_configs.map((row) => [
      row.rule_id,
      {
        enabled: row.enabled,
        warn: row.warn,
        crit: row.crit,
        forTicks: row.for_ticks,
        envs: row.envs as Env[] | null,
      },
    ]),
  );
}

// In-memory fallback so a Supabase outage degrades alerting instead of
// killing it: the mirror is refreshed on every successful read/write and
// used when Supabase throws. Dedup state survives within the process only —
// after a deploy mid-outage, alerts may re-fire once. Acceptable.
const stateMirror = new Map<Env, Map<string, AlertState>>();

function mirrorKey(row: { rule_id: string; entity_id?: string | null }): string {
  return `${row.rule_id} ${row.entity_id ?? ""}`;
}

function updateMirror(alertEnv: Env, upserts: AlertStateUpsert[], now: Date): void {
  const envMirror = stateMirror.get(alertEnv) ?? new Map<string, AlertState>();
  for (const up of upserts) {
    const prev = envMirror.get(mirrorKey(up));
    envMirror.set(mirrorKey(up), {
      id: prev?.id ?? randomUUID(),
      rule_id: up.rule_id,
      env: up.env,
      entity_id: up.entity_id ?? "",
      status: up.status ?? "ok",
      severity: up.severity ?? null,
      consecutive_breaches: up.consecutive_breaches ?? 0,
      first_fired_at: up.first_fired_at ?? null,
      last_notified_at: up.last_notified_at ?? null,
      silenced_until: up.silenced_until ?? null,
      notify_failed: up.notify_failed ?? false,
      last_value: up.last_value ?? null,
      message: up.message ?? null,
      updated_at: now.toISOString(),
    });
  }
  stateMirror.set(alertEnv, envMirror);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

/** Node entity ids are registry uuids; give notifications the node's name,
 * address, and last-known resource stats so a Discord alert reads like a
 * status card instead of a bare uuid. Fail-soft: stats lookups must never
 * block the notification itself. */
async function enrichNodeNotifications(
  notifications: AlertNotification[],
  registry: Registry,
  bucket: string,
): Promise<void> {
  const findNode = (entityId: string) => {
    const obs = registry.obsNodes.find((x) => x.id === entityId);
    if (obs) return { kind: "obs" as const, name: obs.name, address: obs.apiUrl ?? undefined };
    const ingest = registry.ingestNodes.find((x) => x.id === entityId);
    if (ingest) return { kind: "ingest" as const, name: ingest.name, address: ingest.tailscaleIp ?? undefined };
    return undefined;
  };

  const nodeTargets = notifications
    .map((n) => ({ n, node: n.entityId ? findNode(n.entityId) : undefined }))
    .filter((t): t is { n: AlertNotification; node: NonNullable<ReturnType<typeof findNode>> } => !!t.node);
  if (nodeTargets.length === 0) return;

  // Last samples within the hour — a node that just went silent still shows
  // what it looked like right before it disappeared.
  let obsFields = new Map<string, Record<string, number>>();
  let hostFields = new Map<string, Record<string, number>>();
  try {
    const [obs, hosts] = await Promise.all([
      queryLatestObsNodeFields("1h", { bucket }),
      queryLatestHostSystemFields("1h", { bucket }),
    ]);
    obsFields = new Map(obs.map((x) => [x.nodeId, x.fields]));
    hostFields = new Map(hosts.map((x) => [x.nodeId, x.fields]));
  } catch (err) {
    Sentry.captureException(err, { tags: { stage: "notification-enrichment" } });
  }

  for (const { n, node } of nodeTargets) {
    n.entityLabel = node.address ? `${node.name} (${node.address})` : node.name;
    const f = (node.kind === "obs" ? obsFields : hostFields).get(n.entityId);
    n.node = {
      ...node,
      stats: f
        ? {
            cpuPct: f.cpu_pct,
            memUsedMb: node.kind === "obs" ? f.ram_used_mb : f.mem_used_mb,
            memTotalMb: node.kind === "obs" ? f.ram_total_mb : f.mem_total_mb,
            diskPct: f.disk_used_pct,
            bandwidthMbps:
              node.kind === "ingest" && (f.rx_bytes_per_sec !== undefined || f.tx_bytes_per_sec !== undefined)
                ? (((f.rx_bytes_per_sec ?? 0) + (f.tx_bytes_per_sec ?? 0)) * 8) / 1_000_000
                : undefined,
            gpuTempC: f.gpu_temp_c,
            vramUsedMb: f.vram_used_mb,
            vramTotalMb: f.vram_total_mb,
            runningInstances: f.running_instance_count,
            maxInstances: f.max_instances,
          }
        : undefined,
    };
  }
}

// A fully-down node trips two rules at once: its *_silent absence rule (crit,
// the authoritative "node is gone" signal) and probe.node_unreachable (warn,
// the health-endpoint probe). They answer different questions — the probe
// still fires on its own when a node serves metrics but its health endpoint is
// down — but for a plain node-down they're redundant. Drop the probe breach
// while the node is owned by the crit silence path so an operator gets one
// crit alert, not a warn+crit pair. probe.node_unreachable's forTicks is tuned
// above the silence threshold (see rules.ts) so the probe can't reach its fire
// threshold before this gate engages, which is what keeps it from firing a
// warn and then resolving it seconds later.
const NODE_SILENT_RULE_IDS = ["ingest.node_silent", "obs.node_silent"] as const;

export function suppressRedundantNodeProbes(
  breachesByRule: Map<string, Breach[]>,
  prev: AlertState[],
  registry: Registry,
): void {
  const probeBreaches = breachesByRule.get("probe.node_unreachable");
  if (!probeBreaches || probeBreaches.length === 0) return;

  // Node ids whose silence rule is breaching this tick or already firing.
  const downNodeIds = new Set<string>();
  for (const ruleId of NODE_SILENT_RULE_IDS) {
    for (const b of breachesByRule.get(ruleId) ?? []) downNodeIds.add(b.entityId);
  }
  for (const s of prev) {
    if ((NODE_SILENT_RULE_IDS as readonly string[]).includes(s.rule_id) && s.status === "firing") {
      downNodeIds.add(s.entity_id);
    }
  }
  if (downNodeIds.size === 0) return;

  // Probe ids are `ingest-node:<name>` / `obs-node:<name>`; the silence rules
  // key on the node uuid, so map probe id back to node id via the registry.
  const nodeIdByProbeId = new Map<string, string>();
  for (const n of registry.ingestNodes) nodeIdByProbeId.set(`ingest-node:${n.name}`, n.id);
  for (const n of registry.obsNodes) nodeIdByProbeId.set(`obs-node:${n.name}`, n.id);

  const kept = probeBreaches.filter((b) => {
    const nodeId = nodeIdByProbeId.get(b.entityId);
    return !(nodeId && downNodeIds.has(nodeId));
  });
  if (kept.length === 0) breachesByRule.delete("probe.node_unreachable");
  else breachesByRule.set("probe.node_unreachable", kept);
}

/** What the pass carries from the snapshot phase into evaluation: previous
 * state, whether Supabase answered (and therefore whether to persist), the
 * derived supabase probe result, and the lease to release. */
interface TickContext {
  prev: AlertState[];
  supabaseHealthy: boolean;
  supabaseProbe: ProbeResult;
  lockName: string | null;
  owner: string;
}

async function evaluateEnv(
  alertEnv: Env,
  bucket: string,
  registry: Registry,
  now: Date,
  overrides: RuleOverrides,
  notifyRoute: EnvRoute,
  tick: TickContext,
): Promise<EnvTickSummary> {
  const started = performance.now();
  // Disabled rules skip evaluation but stay in the state machine (zero
  // breaches), so a firing alert resolves cleanly when its rule is turned off.
  const rules = buildRules(overrides).filter((r) => !r.envs || r.envs.includes(alertEnv));
  const activeRules = rules.filter((r) => r.enabled !== false);

  const probeResults = await runProbes(alertEnv, registry);
  // The supabase probe is derived from the snapshot RPC rather than an HTTP
  // target (see runEvaluationPass); injected here so probe rules see it
  // exactly as if runProbes had produced it. The id must stay "supabase".
  probeResults.set(tick.supabaseProbe.id, tick.supabaseProbe);
  const ctx: EnvContext = { env: alertEnv, bucket, now, supabase: supabaseAdmin, registry, probeResults };

  // One broken query must never kill the whole tick.
  const evaluations = await Promise.allSettled(
    activeRules.map((rule: AlertRule) => withTimeout(rule.evaluate(ctx), RULE_TIMEOUT_MS, `rule ${rule.id}`)),
  );
  const breachesByRule = new Map<string, Breach[]>();
  let ruleErrors = 0;
  evaluations.forEach((result, i) => {
    const rule = activeRules[i];
    if (!rule) return;
    if (result.status === "fulfilled") {
      if (result.value.length > 0) breachesByRule.set(rule.id, result.value);
    } else {
      ruleErrors++;
      Sentry.captureException(result.reason, { tags: { alertRule: rule.id, alertEnv } });
    }
  });

  // Node-down dedup: needs both this tick's breaches and prev firing state.
  suppressRedundantNodeProbes(breachesByRule, tick.prev, registry);

  const { upserts, events, notifications } = computeTransitions(alertEnv, tick.prev, breachesByRule, rules, now);

  // Mirror before dispatch: if the process dies mid-dispatch, the next tick's
  // fallback state already counts this tick's transitions, which is what
  // bounds the double-notify window of persisting after dispatch.
  updateMirror(alertEnv, upserts, now);

  await enrichNodeNotifications(notifications, registry, bucket);

  const { failed } = await dispatchNotifications(notifications, notifyRoute);

  // Fold notify-failed flags into this tick's own rows so the persist RPC is
  // the pass's only write. The failed (ruleId, entityId) pairs came out of
  // `upserts` via computeTransitions, so the lookup cannot miss.
  const failedKeys = new Set(failed.map((f) => `${f.ruleId} ${f.entityId}`));
  const stateRows = upserts.map((u) =>
    failedKeys.has(`${u.rule_id} ${u.entity_id ?? ""}`) ? { ...u, notify_failed: true } : u,
  );
  const eventRows: AlertEventInsert[] = [
    ...events,
    ...failed.map((f) => ({
      rule_id: f.ruleId,
      env: alertEnv,
      entity_id: f.entityId,
      event_type: "notify_failed" as const,
      message: "Notification not delivered: all channels failed or none configured",
    })),
  ];

  // One write round trip: state upsert + history events + lock release.
  // Skipped when the snapshot failed (nothing acquired, nothing reachable —
  // the mirror carries the state), and when a lockless tick has nothing to
  // write, so an all-quiet pass costs zero write requests.
  if (tick.supabaseHealthy && (stateRows.length > 0 || eventRows.length > 0 || tick.lockName !== null)) {
    try {
      await persistAlertTick(supabaseAdmin, {
        states: stateRows,
        events: eventRows,
        lockName: tick.lockName,
        owner: tick.owner,
      });
    } catch (err) {
      // The lease, if held, expires on its own within LOCK_TTL_SECONDS.
      Sentry.captureException(err, { tags: { alertEnv, stage: "persist-state" } });
    }
  }

  return {
    env: alertEnv,
    rulesEvaluated: activeRules.length,
    ruleErrors,
    breaches: [...breachesByRule.values()].reduce((sum, b) => sum + b.length, 0),
    fired: notifications.filter((n) => n.kind === "fired").length,
    resolved: notifications.filter((n) => n.kind === "resolved").length,
    notifyFailures: failed.length,
    durationMs: Math.round(performance.now() - started),
  };
}

export async function runEvaluationPass(): Promise<TickSummary> {
  const started = performance.now();
  const now = new Date();
  const owner = randomUUID();
  const alertEnv = homeEnv();
  // The overlap lock rides the snapshot RPC, so keeping it costs zero extra
  // requests. ALERT_LOCK_ENABLED=false is the escape hatch; default on — it
  // guards against Dokploy accidentally scaling the worker to two replicas.
  const lockName = alertConfig.lockEnabled ? LOCK_NAME : null;

  let snapshot: TickSnapshot | null = null;
  let snapshotLatencyMs = 0;
  try {
    const raw = await fetchAlertTickSnapshot(supabaseAdmin, {
      env: alertEnv,
      lockName,
      lockTtlSeconds: LOCK_TTL_SECONDS,
      owner,
    });
    snapshotLatencyMs = performance.now() - started;
    const parsed = parseTickSnapshot(raw);
    if (parsed === "not-locked") {
      return { skipped: true, reason: "another evaluation pass holds the lock", envs: [], durationMs: 0 };
    }
    snapshot = parsed;
  } catch (err) {
    snapshotLatencyMs = performance.now() - started;
    Sentry.captureException(err, { tags: { stage: "tick-snapshot" } });
    // If the RPC succeeded but validation failed, the lease was acquired and
    // would block the next couple of ticks — release it best-effort. When the
    // RPC itself failed the function's transaction rolled back, so this
    // deletes nothing and its own failure is ignorable.
    if (lockName) {
      try {
        await persistAlertTick(supabaseAdmin, { states: [], events: [], lockName, owner });
      } catch {
        // The lease expires on its own within LOCK_TTL_SECONDS.
      }
    }
  }

  // Fail open on any snapshot failure: empty registry, code-default
  // overrides, env-default notification route, mirror state — and run the
  // pass anyway. A Supabase outage must never silence alerting.
  const registry: Registry = snapshot
    ? registryFromSnapshot(snapshot)
    : {
        obsNodes: [],
        ingestNodes: [],
        services: EXPECTED_HTTP_SERVICES,
        liveIngestSessions: [],
        anyChannelLive: false,
      };
  const overrides: RuleOverrides = snapshot ? overridesFromSnapshot(snapshot) : {};
  const notifyRoute = resolveRoute(alertEnv, snapshot?.notification_config ?? null);
  const prev: AlertState[] = snapshot
    ? (snapshot.alert_states as AlertState[])
    : [...(stateMirror.get(alertEnv)?.values() ?? [])];
  if (snapshot) stateMirror.set(alertEnv, new Map(prev.map((s) => [mirrorKey(s), s])));

  // The counts stay in every tick's log line on purpose: a payload quietly
  // emptying the registry is exactly the failure the zod boundary exists to
  // catch, and this line is how a human notices if it ever slips through.
  console.log(
    `[alerting] snapshot ok=${snapshot !== null} obs=${registry.obsNodes.length} ingest=${registry.ingestNodes.length} states=${prev.length}`,
  );

  // The old /rest/v1/ HTTP probe sent no apikey, always got a 401, and
  // okBelowStatus scored that healthy — it would have reported green through
  // a total Postgres outage. The snapshot RPC already proves gateway +
  // PostgREST + Postgres + schema, so the probe result derives from it. The
  // id "supabase" must stay identical or alert_state entity ids change and
  // the probe alert resolves-then-refires across the deploy.
  const supabaseProbe: ProbeResult = snapshot
    ? { id: "supabase", ok: true, latencyMs: snapshotLatencyMs }
    : { id: "supabase", ok: false, error: "tick snapshot RPC failed", latencyMs: snapshotLatencyMs };

  const summary = await evaluateEnv(alertEnv, alertConfig.influxdbBucket, registry, now, overrides, notifyRoute, {
    prev,
    supabaseHealthy: snapshot !== null,
    supabaseProbe,
    lockName: snapshot ? lockName : null,
    owner,
  });
  return { skipped: false, envs: [summary], durationMs: Math.round(performance.now() - started) };
}
