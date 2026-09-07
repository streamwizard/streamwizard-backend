import { describe, expect, it, mock } from "bun:test";
import type { AlertState } from "@repo/supabase/queries/alerts";

// Point every backing service at a closed local port so any code path that
// slips past the mocks fails fast instead of hanging on a real network call.
process.env.ALERT_ENV = "staging";
process.env.INFLUXDB_URL = "http://127.0.0.1:1";
process.env.INFLUXDB_TOKEN = "test";
process.env.INFLUXDB_ORG = "test";
process.env.INFLUXDB_BUCKET = "test-bucket";
process.env.SUPABASE_URL = "http://127.0.0.1:1";
process.env.SUPABASE_SECRET_KEY = "test";

// The RPC boundary is the thing under test — stub it with per-test handlers.
let snapshotResult: () => unknown = () => {
  throw new Error("snapshot handler not set");
};
const snapshotCalls: unknown[] = [];
const persistCalls: {
  states: Record<string, unknown>[];
  events: Record<string, unknown>[];
  lockName: string | null;
  owner: string;
}[] = [];

mock.module("@repo/supabase/queries/alerts", () => ({
  fetchAlertTickSnapshot: async (_client: unknown, params: unknown) => {
    snapshotCalls.push(params);
    return snapshotResult();
  },
  persistAlertTick: async (_client: unknown, params: (typeof persistCalls)[number]) => {
    persistCalls.push(params);
  },
}));

// Real probes would fetch the staging site and node health URLs. rules/probes
// imports checkSslExpiry from the same module, so it must be stubbed too.
mock.module("./probes", () => ({
  runProbes: async () => new Map(),
  checkSslExpiry: async () => [],
  SSL_HOSTNAMES: [],
}));

const { runEvaluationPass, parseTickSnapshot, registryFromSnapshot, overridesFromSnapshot } =
  await import("./engine");
const { buildRules } = await import("./rules");

// Disabling every rule via the snapshot's rule_configs keeps evaluation from
// touching @repo/metrics/Influx at all — the disabled rules stay in the state
// machine, which is exactly the lever the resolve/notify tests use.
const disableAllRules = buildRules().map((r) => ({
  rule_id: r.id,
  enabled: false,
  warn: null,
  crit: null,
  for_ticks: null,
  envs: null,
}));

function makeSnapshot(over: Partial<Record<string, unknown>> = {}) {
  return {
    locked: true,
    obs_nodes: [
      {
        id: "obs-uuid-1",
        name: "obs-node-1",
        status: "linked",
        maintenance: false,
        created_at: "2026-08-01T00:00:00+00:00",
        api_url: "http://10.0.0.1:8080",
      },
    ],
    ingest_nodes: [],
    live_ingest_sessions: [{ id: "sess-1", started_at: "2026-08-16T00:00:00+00:00" }],
    any_channel_live: true,
    rule_configs: disableAllRules,
    notification_config: null,
    alert_states: [] as unknown[],
    ...over,
  };
}

function firingState(ruleId: string, entityId: string): Record<string, unknown> {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    rule_id: ruleId,
    env: "staging",
    entity_id: entityId,
    status: "firing",
    severity: "crit",
    consecutive_breaches: 3,
    first_fired_at: "2026-08-16T00:00:00+00:00",
    last_notified_at: "2026-08-16T00:00:00+00:00",
    silenced_until: null,
    notify_failed: false,
    last_value: 99,
    message: "it burns",
    updated_at: "2026-08-16T00:00:00+00:00",
  };
}

describe("parseTickSnapshot", () => {
  it("accepts a full snapshot and the contested-lock miniature", () => {
    expect(parseTickSnapshot(makeSnapshot())).toMatchObject({ locked: true });
    expect(parseTickSnapshot({ locked: false })).toBe("not-locked");
  });

  it("throws on a malformed payload instead of quietly emptying the registry", () => {
    expect(() => parseTickSnapshot(makeSnapshot({ obs_nodes: "nope" }))).toThrow();
    expect(() => parseTickSnapshot(null)).toThrow();
    expect(() => parseTickSnapshot({})).toThrow();
  });

  it("maps registry and overrides field-for-field", () => {
    const parsed = parseTickSnapshot(
      makeSnapshot({
        rule_configs: [
          { rule_id: "gpu.temp_high", enabled: true, warn: 70, crit: null, for_ticks: 3, envs: ["prod"] },
        ],
      }),
    );
    if (parsed === "not-locked") throw new Error("unexpected");

    const registry = registryFromSnapshot(parsed);
    expect(registry.obsNodes).toEqual([
      {
        id: "obs-uuid-1",
        name: "obs-node-1",
        status: "linked",
        maintenance: false,
        createdAt: "2026-08-01T00:00:00+00:00",
        apiUrl: "http://10.0.0.1:8080",
      },
    ]);
    expect(registry.liveIngestSessions).toEqual([
      { sessionId: "sess-1", startedAt: "2026-08-16T00:00:00+00:00" },
    ]);
    expect(registry.anyChannelLive).toBe(true);

    expect(overridesFromSnapshot(parsed)).toEqual({
      "gpu.temp_high": { enabled: true, warn: 70, crit: null, forTicks: 3, envs: ["prod"] },
    });
  });
});

/**
 * The pass tests share the engine's module-global state mirror and run in
 * declaration order — the fail-open test goes first while the mirror is
 * still empty. Do not reorder.
 */
describe("runEvaluationPass", () => {
  it("fails open when the snapshot RPC dies: the pass still runs, nothing persists", async () => {
    snapshotResult = () => {
      throw new Error("supabase is down");
    };
    persistCalls.length = 0;

    const summary = await runEvaluationPass();

    expect(summary.skipped).toBe(false);
    expect(summary.envs).toHaveLength(1);
    // The best-effort lock release is skipped too — persistAlertTick IS the
    // release, and it would just fail against a dead Supabase. One attempt
    // is made and swallowed:
    expect(persistCalls).toHaveLength(1);
    expect(persistCalls[0]).toMatchObject({ states: [], events: [], lockName: "alert-worker" });
  });

  it("skips the pass when another worker holds the lock", async () => {
    snapshotResult = () => ({ locked: false });
    persistCalls.length = 0;

    const summary = await runEvaluationPass();

    expect(summary.skipped).toBe(true);
    expect(summary.reason).toContain("lock");
    expect(summary.envs).toHaveLength(0);
    expect(persistCalls).toHaveLength(0);
  });

  it("a healthy quiet tick evaluates nothing and spends exactly one write releasing the lock", async () => {
    snapshotResult = () => makeSnapshot();
    persistCalls.length = 0;

    const summary = await runEvaluationPass();

    expect(summary.skipped).toBe(false);
    expect(summary.envs[0]?.rulesEvaluated).toBe(0); // every rule disabled
    expect(summary.envs[0]?.ruleErrors).toBe(0);
    expect(persistCalls).toHaveLength(1);
    expect(persistCalls[0]).toMatchObject({ states: [], events: [], lockName: "alert-worker" });
    expect(persistCalls[0]?.owner).toMatch(/[0-9a-f-]{36}/);
  });

  it("releases the lease after a malformed payload, then fails open without persisting state", async () => {
    snapshotResult = () => makeSnapshot({ alert_states: "corrupt" });
    persistCalls.length = 0;

    const summary = await runEvaluationPass();

    expect(summary.skipped).toBe(false);
    // Exactly one persist call: the empty best-effort lock release. The
    // pass's own state write is skipped because the snapshot was unusable.
    expect(persistCalls).toHaveLength(1);
    expect(persistCalls[0]).toMatchObject({ states: [], events: [], lockName: "alert-worker" });
  });

  it("resolves a firing alert whose rule was disabled, and folds notify_failed into the same persist", async () => {
    // staging's default route wants Discord for warn+crit, but no channel or
    // token is configured in this test env — dispatch reports the resolved
    // notification as failed, which must land as notify_failed=true on the
    // SAME persist call, plus a notify_failed history event.
    snapshotResult = () => makeSnapshot({ alert_states: [firingState("gpu.temp_high", "obs-uuid-1")] });
    persistCalls.length = 0;

    const summary = await runEvaluationPass();

    expect(summary.envs[0]?.resolved).toBe(1);
    expect(summary.envs[0]?.notifyFailures).toBe(1);
    expect(persistCalls).toHaveLength(1);

    const call = persistCalls[0]!;
    expect(call.states).toHaveLength(1);
    expect(call.states[0]).toMatchObject({
      rule_id: "gpu.temp_high",
      entity_id: "obs-uuid-1",
      status: "ok",
      notify_failed: true,
    });
    const eventTypes = call.events.map((e) => e.event_type).sort();
    expect(eventTypes).toEqual(["notify_failed", "resolved"]);
  });

  it("falls back to the in-memory mirror when the next snapshot fails", async () => {
    // The previous test's tick mirrored the resolved row. With the snapshot
    // dead, prev comes from the mirror — already ok, so nothing re-resolves
    // and no duplicate notification fires.
    snapshotResult = () => {
      throw new Error("supabase is down again");
    };
    persistCalls.length = 0;

    const summary = await runEvaluationPass();

    expect(summary.skipped).toBe(false);
    expect(summary.envs[0]?.resolved).toBe(0);
    expect(summary.envs[0]?.fired).toBe(0);
  });
});
