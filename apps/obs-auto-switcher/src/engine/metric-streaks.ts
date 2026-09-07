import type { AutoSwitcherThresholds } from "@repo/schemas";
import type { IngestStatsPayload } from "@repo/types";

/**
 * Consecutive-poll bookkeeping for the three link metrics the switcher judges.
 *
 * Every rule in the engine is "metric X has been bad/good for N polls in a
 * row", so the counters live here and the monitor asks questions of them
 * instead of hand-rolling the same `for (const key of METRICS)` loop six times.
 */

export type MetricKey = "bitrate" | "rtt" | "loss";
export const METRICS: MetricKey[] = ["bitrate", "rtt", "loss"];

export interface Streak {
  bad: number;
  good: number;
}

/** Which poll-count column of the thresholds to compare against. */
export type StreakGate = "trigger" | "recover" | "startup";

function emptyStreaks(): Record<MetricKey, Streak> {
  return {
    bitrate: { bad: 0, good: 0 },
    rtt: { bad: 0, good: 0 },
    loss: { bad: 0, good: 0 },
  };
}

export class MetricStreaks {
  private streaks = emptyStreaks();

  /** Snapshot for the published status payload. */
  snapshot(): Record<MetricKey, Streak> {
    return {
      bitrate: { ...this.streaks.bitrate },
      rtt: { ...this.streaks.rtt },
      loss: { ...this.streaks.loss },
    };
  }

  get(key: MetricKey): Streak {
    return this.streaks[key];
  }

  /** Back to square one — a new session, or a state the old counts can't inform. */
  reset(): void {
    this.streaks = emptyStreaks();
  }

  /** Keeps the bad counts, zeroes the good ones: recovery has to be re-earned. */
  resetGood(): void {
    for (const key of METRICS) this.streaks[key].good = 0;
  }

  /**
   * Folds one stats sample in. Missing metrics count as OK — RTMP sessions only
   * report kbps.
   *
   * The "loss" metric judges drop_pct, not loss_pct: raw loss is counted before
   * SRT retransmits, so a healthy cellular link fully recovered by the 4 s
   * ingest buffer still reports several percent of it. drop_pct is what the
   * receiver gave up on — the part the viewer sees. See the threshold notes in
   * @repo/schemas; the field names stay `loss_*` so stored advanced_thresholds
   * JSON keeps parsing.
   */
  update(payload: IngestStatsPayload, thresholds: AutoSwitcherThresholds): void {
    const ok: Record<MetricKey, boolean> = {
      bitrate: payload.kbps === undefined || payload.kbps >= thresholds.bitrate_min_kbps,
      rtt: payload.rtt_ms === undefined || payload.rtt_ms <= thresholds.rtt_max_ms,
      loss: payload.drop_pct === undefined || payload.drop_pct <= thresholds.loss_max_pct,
    };

    for (const key of METRICS) {
      const streak = this.streaks[key];
      if (ok[key]) {
        streak.good++;
        streak.bad = 0;
      } else {
        streak.bad++;
        streak.good = 0;
      }
    }
  }

  /** Metrics that have been bad long enough to count, per the given gate. */
  badMetrics(gate: Extract<StreakGate, "trigger" | "startup">, thresholds: AutoSwitcherThresholds): MetricKey[] {
    const limits = pollLimits(gate, thresholds);
    return METRICS.filter((key) => this.streaks[key].bad >= limits[key]);
  }

  /** True once every metric has been good long enough, per the given gate. */
  allRecovered(gate: Extract<StreakGate, "recover" | "startup">, thresholds: AutoSwitcherThresholds): boolean {
    const limits = pollLimits(gate, thresholds);
    return METRICS.every((key) => this.streaks[key].good >= limits[key]);
  }

  /** Any metric bad for at least `polls` in a row. */
  anyBadFor(polls: number): boolean {
    return METRICS.some((key) => this.streaks[key].bad >= polls);
  }

  /** Every metric good for at least `polls` in a row. */
  allGoodFor(polls: number): boolean {
    return METRICS.every((key) => this.streaks[key].good >= polls);
  }
}

export function pollLimits(
  gate: StreakGate,
  thresholds: AutoSwitcherThresholds,
): Record<MetricKey, number> {
  if (gate === "startup") {
    return {
      bitrate: thresholds.bitrate_startup_polls,
      rtt: thresholds.rtt_startup_polls,
      loss: thresholds.loss_startup_polls,
    };
  }
  if (gate === "trigger") {
    return {
      bitrate: thresholds.bitrate_trigger_polls,
      rtt: thresholds.rtt_trigger_polls,
      loss: thresholds.loss_trigger_polls,
    };
  }
  return {
    bitrate: thresholds.bitrate_recover_polls,
    rtt: thresholds.rtt_recover_polls,
    loss: thresholds.loss_recover_polls,
  };
}
