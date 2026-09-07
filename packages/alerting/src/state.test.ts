import { describe, expect, test } from "bun:test";
import { computeTransitions, RENOTIFY_INTERVAL_MS } from "./state";
import type { AlertState } from "@repo/supabase/queries/alerts";
import type { AlertRule, Breach } from "./types";

// Pure state-machine semantics: for_ticks counting, fire-once, 30m crit
// renotify, warn→crit escalation, resolve messages, silencing, quiet reset.

const rule = (id: string, forTicks: number): AlertRule => ({
  id,
  title: id,
  forTicks,
  evaluate: async () => [],
});

const breach = (overrides: Partial<Breach> = {}): Breach => ({
  entityId: "node-1",
  severity: "warn",
  value: 91,
  message: "CPU high",
  ...overrides,
});

const existingState = (overrides: Partial<AlertState> = {}): AlertState => ({
  id: "s1",
  rule_id: "r",
  env: "prod",
  entity_id: "node-1",
  status: "ok",
  severity: null,
  consecutive_breaches: 0,
  first_fired_at: null,
  last_notified_at: null,
  silenced_until: null,
  notify_failed: false,
  last_value: null,
  message: null,
  updated_at: new Date().toISOString(),
  ...overrides,
});

const now = new Date("2026-07-05T12:00:00Z");

describe("computeTransitions", () => {
  test("first breach below forTicks counts but does not fire", () => {
    const result = computeTransitions("prod", [], new Map([["r", [breach()]]]), [rule("r", 2)], now);
    expect(result.notifications).toHaveLength(0);
    expect(result.events).toHaveLength(0);
    expect(result.upserts).toHaveLength(1);
    expect(result.upserts[0]).toMatchObject({ status: "ok", consecutive_breaches: 1 });
  });

  test("fires once consecutive breaches reach forTicks", () => {
    const prev = [existingState({ consecutive_breaches: 1 })];
    const result = computeTransitions("prod", prev, new Map([["r", [breach()]]]), [rule("r", 2)], now);
    expect(result.upserts[0]).toMatchObject({ status: "firing", consecutive_breaches: 2 });
    expect(result.events).toEqual([expect.objectContaining({ event_type: "fired" })]);
    expect(result.notifications).toEqual([expect.objectContaining({ kind: "fired", severity: "warn" })]);
  });

  test("forTicks=1 fires on the first breach", () => {
    const result = computeTransitions("prod", [], new Map([["r", [breach({ severity: "crit" })]]]), [rule("r", 1)], now);
    expect(result.notifications).toEqual([expect.objectContaining({ kind: "fired", severity: "crit" })]);
  });

  test("firing warn does not renotify", () => {
    const prev = [
      existingState({
        status: "firing",
        severity: "warn",
        consecutive_breaches: 5,
        first_fired_at: "2026-07-05T10:00:00Z",
        last_notified_at: "2026-07-05T10:00:00Z",
      }),
    ];
    const result = computeTransitions("prod", prev, new Map([["r", [breach()]]]), [rule("r", 2)], now);
    expect(result.notifications).toHaveLength(0);
    expect(result.upserts[0]).toMatchObject({ status: "firing", last_notified_at: "2026-07-05T10:00:00Z" });
  });

  test("firing crit renotifies after the 30m cooldown", () => {
    const lastNotified = new Date(now.getTime() - RENOTIFY_INTERVAL_MS - 1000).toISOString();
    const prev = [
      existingState({ status: "firing", severity: "crit", consecutive_breaches: 5, last_notified_at: lastNotified }),
    ];
    const result = computeTransitions("prod", prev, new Map([["r", [breach({ severity: "crit" })]]]), [rule("r", 2)], now);
    expect(result.notifications).toEqual([expect.objectContaining({ kind: "renotified" })]);
    expect(result.events).toEqual([expect.objectContaining({ event_type: "renotified" })]);
  });

  test("firing crit within the cooldown stays quiet", () => {
    const lastNotified = new Date(now.getTime() - RENOTIFY_INTERVAL_MS / 2).toISOString();
    const prev = [
      existingState({ status: "firing", severity: "crit", consecutive_breaches: 5, last_notified_at: lastNotified }),
    ];
    const result = computeTransitions("prod", prev, new Map([["r", [breach({ severity: "crit" })]]]), [rule("r", 2)], now);
    expect(result.notifications).toHaveLength(0);
  });

  test("warn→crit escalation notifies immediately", () => {
    const prev = [
      existingState({ status: "firing", severity: "warn", consecutive_breaches: 5, last_notified_at: now.toISOString() }),
    ];
    const result = computeTransitions("prod", prev, new Map([["r", [breach({ severity: "crit" })]]]), [rule("r", 2)], now);
    expect(result.notifications).toEqual([expect.objectContaining({ kind: "fired", severity: "crit" })]);
  });

  test("firing → no breach resolves with notification", () => {
    const prev = [
      existingState({ status: "firing", severity: "crit", consecutive_breaches: 5, message: "CPU high" }),
    ];
    const result = computeTransitions("prod", prev, new Map(), [rule("r", 2)], now);
    expect(result.upserts[0]).toMatchObject({ status: "ok", consecutive_breaches: 0 });
    expect(result.events).toEqual([expect.objectContaining({ event_type: "resolved" })]);
    expect(result.notifications).toEqual([expect.objectContaining({ kind: "resolved" })]);
  });

  test("broken streak below forTicks resets quietly", () => {
    const prev = [existingState({ consecutive_breaches: 1 })];
    const result = computeTransitions("prod", prev, new Map(), [rule("r", 3)], now);
    expect(result.upserts[0]).toMatchObject({ status: "ok", consecutive_breaches: 0 });
    expect(result.events).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
  });

  test("silenced alert records a silenced event but sends nothing", () => {
    const silencedUntil = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    const prev = [existingState({ consecutive_breaches: 1, silenced_until: silencedUntil })];
    const result = computeTransitions("prod", prev, new Map([["r", [breach()]]]), [rule("r", 2)], now);
    expect(result.notifications).toHaveLength(0);
    expect(result.events).toEqual([expect.objectContaining({ event_type: "silenced" })]);
    expect(result.upserts[0]).toMatchObject({ status: "firing" });
  });

  test("silenced resolve stays quiet", () => {
    const silencedUntil = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    const prev = [existingState({ status: "firing", severity: "warn", silenced_until: silencedUntil })];
    const result = computeTransitions("prod", prev, new Map(), [rule("r", 2)], now);
    expect(result.notifications).toHaveLength(0);
    expect(result.events).toEqual([expect.objectContaining({ event_type: "resolved" })]);
  });

  test("entities are tracked independently", () => {
    const prev = [existingState({ entity_id: "node-1", consecutive_breaches: 1 })];
    const breaches = [breach({ entityId: "node-1" }), breach({ entityId: "node-2" })];
    const result = computeTransitions("prod", prev, new Map([["r", breaches]]), [rule("r", 2)], now);
    const node1 = result.upserts.find((u) => u.entity_id === "node-1");
    const node2 = result.upserts.find((u) => u.entity_id === "node-2");
    expect(node1).toMatchObject({ status: "firing", consecutive_breaches: 2 });
    expect(node2).toMatchObject({ status: "ok", consecutive_breaches: 1 });
  });
});
