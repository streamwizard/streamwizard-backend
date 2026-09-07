import { describe, expect, test } from "bun:test";
import { suppressRedundantNodeProbes } from "./engine";
import type { AlertState } from "@repo/supabase/queries/alerts";
import type { Breach, Registry, RegistryNode } from "./types";

// A fully-down node trips both its *_silent absence rule (crit) and
// probe.node_unreachable (warn). suppressRedundantNodeProbes drops the probe
// breach while the node is owned by the crit silence path, so an operator gets
// one crit alert instead of a warn+crit pair.

const ingestNode = (over: Partial<RegistryNode> = {}): RegistryNode => ({
  id: "node-uuid-1",
  name: "test",
  status: "linked",
  maintenance: false,
  createdAt: new Date().toISOString(),
  tailscaleIp: "100.71.15.32",
  ...over,
});

const registry = (over: Partial<Registry> = {}): Registry => ({
  obsNodes: [],
  ingestNodes: [ingestNode()],
  services: [],
  liveIngestSessions: [],
  anyChannelLive: false,
  ...over,
});

const probeBreach = (): Breach => ({
  entityId: "ingest-node:test",
  severity: "warn",
  message: "Probe ingest-node:test failed: Unable to connect",
});

const silentBreach = (): Breach => ({
  entityId: "node-uuid-1",
  severity: "crit",
  value: 74,
  message: "Ingest node gone silent: test (100.71.15.32) last reported 1m ago",
});

const firingSilentState = (): AlertState => ({
  id: "s1",
  rule_id: "ingest.node_silent",
  env: "dev",
  entity_id: "node-uuid-1",
  status: "firing",
  severity: "crit",
  consecutive_breaches: 3,
  first_fired_at: new Date().toISOString(),
  last_notified_at: new Date().toISOString(),
  silenced_until: null,
  notify_failed: false,
  last_value: 74,
  message: "Ingest node gone silent",
  updated_at: new Date().toISOString(),
});

describe("suppressRedundantNodeProbes", () => {
  test("drops the probe breach when the node's silence rule is breaching this tick", () => {
    const byRule = new Map<string, Breach[]>([
      ["probe.node_unreachable", [probeBreach()]],
      ["ingest.node_silent", [silentBreach()]],
    ]);
    suppressRedundantNodeProbes(byRule, [], registry());
    expect(byRule.has("probe.node_unreachable")).toBe(false);
    expect(byRule.get("ingest.node_silent")).toHaveLength(1);
  });

  test("drops the probe breach when the silence rule is already firing (prev state)", () => {
    const byRule = new Map<string, Breach[]>([["probe.node_unreachable", [probeBreach()]]]);
    suppressRedundantNodeProbes(byRule, [firingSilentState()], registry());
    expect(byRule.has("probe.node_unreachable")).toBe(false);
  });

  test("keeps the probe breach when the node still reports metrics (health endpoint down only)", () => {
    const byRule = new Map<string, Breach[]>([["probe.node_unreachable", [probeBreach()]]]);
    suppressRedundantNodeProbes(byRule, [], registry());
    expect(byRule.get("probe.node_unreachable")).toHaveLength(1);
  });

  test("only suppresses the down node, not other nodes' probes", () => {
    const other = ingestNode({ id: "node-uuid-2", name: "other", tailscaleIp: "100.71.15.99" });
    const byRule = new Map<string, Breach[]>([
      [
        "probe.node_unreachable",
        [probeBreach(), { entityId: "ingest-node:other", severity: "warn", message: "Probe ingest-node:other failed" }],
      ],
      ["ingest.node_silent", [silentBreach()]],
    ]);
    suppressRedundantNodeProbes(byRule, [], registry({ ingestNodes: [ingestNode(), other] }));
    const kept = byRule.get("probe.node_unreachable");
    expect(kept).toHaveLength(1);
    expect(kept?.[0]?.entityId).toBe("ingest-node:other");
  });

  test("leaves non-node probes (rest-api, ws-server) untouched", () => {
    const byRule = new Map<string, Breach[]>([
      [
        "probe.node_unreachable",
        [{ entityId: "ingest-node:test", severity: "warn", message: "x" }],
      ],
    ]);
    // rest-api / ws-server belong to probe.fail, not probe.node_unreachable, so
    // they never enter this map key — nothing to assert beyond node mapping,
    // but confirm an unmapped probe id is kept (defensive).
    byRule.set("probe.node_unreachable", [{ entityId: "ingest-node:unknown", severity: "warn", message: "x" }]);
    suppressRedundantNodeProbes(byRule, [firingSilentState()], registry());
    expect(byRule.get("probe.node_unreachable")).toHaveLength(1);
  });
});
