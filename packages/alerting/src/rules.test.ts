import { describe, expect, test } from "bun:test";
import { buildRules, getRuleCatalog } from "./rules";

describe("rule overrides", () => {
  test("code defaults apply when no override exists", () => {
    const rule = buildRules().find((r) => r.id === "gpu.temp_high");
    expect(rule?.forTicks).toBe(2);
    expect(rule?.enabled).toBe(true);
  });

  test("override changes the effective rule but not the catalog defaults", () => {
    const rules = buildRules({ "gpu.temp_high": { forTicks: 5, enabled: false, envs: ["prod"] } });
    const rule = rules.find((r) => r.id === "gpu.temp_high");
    expect(rule?.forTicks).toBe(5);
    expect(rule?.enabled).toBe(false);
    expect(rule?.envs).toEqual(["prod"]);

    const entry = getRuleCatalog().find((r) => r.id === "gpu.temp_high");
    expect(entry?.defaultForTicks).toBe(2);
    expect(entry?.warn?.default).toBe(83);
  });

  test("null override columns fall back to defaults", () => {
    const rules = buildRules({ "obs.disk_full": { warn: null, crit: 99, forTicks: null, envs: null } });
    const rule = rules.find((r) => r.id === "obs.disk_full");
    expect(rule?.forTicks).toBe(2);
    expect(rule?.envs).toBeUndefined();
  });

  test("every rule has a group and non-empty default envs in the catalog", () => {
    for (const entry of getRuleCatalog()) {
      expect(entry.group).not.toBe("Other");
      expect(entry.defaultEnvs.length).toBeGreaterThan(0);
    }
  });

  test("structural thresholds are not exposed as knobs", () => {
    const entry = getRuleCatalog().find((r) => r.id === "gpu.nvenc_capacity");
    expect(entry?.warn).toBeUndefined();
    expect(entry?.crit).toBeUndefined();
  });

  test("instance crash rules ship in the OBS group with their defaults", () => {
    const catalog = getRuleCatalog();
    const crash = catalog.find((r) => r.id === "obs.instance_crash");
    expect(crash?.group).toBe("OBS / GPU nodes");
    expect(crash?.warn?.default).toBe(10);
    expect(crash?.defaultEnvs).toEqual(["prod", "staging"]);

    const loop = catalog.find((r) => r.id === "obs.instance_crash_loop");
    expect(loop?.crit?.default).toBe(3);
    expect(loop?.defaultEnvs).toEqual(["prod", "staging"]);
  });

  test("encoder saturation rule ships with its tunable default", () => {
    const rule = buildRules().find((r) => r.id === "gpu.encoder_util_high");
    expect(rule?.enabled).toBe(true);
    expect(rule?.forTicks).toBe(2);

    const entry = getRuleCatalog().find((r) => r.id === "gpu.encoder_util_high");
    expect(entry?.warn?.default).toBe(90);
  });
});
