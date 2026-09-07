import { supabase } from "@repo/supabase";
import { reportError } from "@repo/sentry";
import {
  autoSwitcherConfigSchema,
  resolveAutoSwitcherThresholds,
  type AutoSwitcherConfig,
  type AutoSwitcherThresholds,
} from "@repo/schemas";
import { selectEnabledAutoSwitcherConfigs } from "@repo/supabase/queries/auto-switcher";
import { env } from "./lib/env";

export interface EffectiveConfig {
  row: AutoSwitcherConfig;
  thresholds: AutoSwitcherThresholds;
}

export type ConfigChangeHandler = (userId: string, config: EffectiveConfig | null) => void;

// In-memory view of obs_auto_switcher_configs (enabled rows only). The DB is
// the source of truth: boot + periodic reconciliation load it wholesale;
// between reconciliations, streamwizard.auto_switcher_config pushes off the
// consumer feed (sent by the web server actions through /internal/broadcast)
// apply the same row within ~1s. There is deliberately NO Supabase realtime here.
//
// The interval is tuned for egress, not latency: a config change that lands
// normally is applied in ~1s by the push, so this poll only exists to heal a
// dropped one. At 60s it was re-reading the whole table 1,440x/day to catch an
// event that essentially never happens; 5 minutes costs the same correctness
// and a fifth of the requests. Override with CONFIG_RECONCILE_INTERVAL_MS.
const RECONCILE_INTERVAL_MS = env.CONFIG_RECONCILE_INTERVAL_MS;

export class ConfigStore {
  private configs = new Map<string, EffectiveConfig>();
  private onChange: ConfigChangeHandler;
  private reconcileTimer: ReturnType<typeof setInterval> | null = null;

  constructor(onChange: ConfigChangeHandler) {
    this.onChange = onChange;
  }

  get(userId: string): EffectiveConfig | undefined {
    return this.configs.get(userId);
  }

  get size(): number {
    return this.configs.size;
  }

  userIds(): string[] {
    return [...this.configs.keys()];
  }

  async start(): Promise<void> {
    await this.reconcile();
    this.reconcileTimer = setInterval(() => {
      // Only the message was logged before, which drops the stack — and a
      // reconcile that keeps failing means the in-memory config silently
      // drifts from the DB for as long as the process lives.
      this.reconcile().catch((err) => reportError(err, "config-store.reconcile"));
    }, RECONCILE_INTERVAL_MS);
  }

  stop(): void {
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
  }

  /** A config row pushed over the consumer feed. */
  applyPush(payload: unknown): void {
    const parsed = autoSwitcherConfigSchema.safeParse(payload);
    if (!parsed.success) {
      console.warn("[config-store] dropping malformed config push:", parsed.error.message);
      return;
    }
    this.applyRow(parsed.data);
  }

  private applyRow(row: AutoSwitcherConfig): void {
    if (!row.enabled) {
      if (this.configs.delete(row.user_id)) {
        console.log(`[config-store] disabled user=${row.user_id}`);
        this.onChange(row.user_id, null);
      } else {
        // Still forward: an override write on a disabled row is a no-op, but
        // the monitor may exist from a not-yet-reconciled enable.
        this.onChange(row.user_id, null);
      }
      return;
    }
    const effective: EffectiveConfig = { row, thresholds: resolveAutoSwitcherThresholds(row) };
    this.configs.set(row.user_id, effective);
    this.onChange(row.user_id, effective);
  }

  private async reconcile(): Promise<void> {
    const { data, error } = await selectEnabledAutoSwitcherConfigs(supabase);
    if (error) throw error;

    const seen = new Set<string>();
    for (const raw of data ?? []) {
      const parsed = autoSwitcherConfigSchema.safeParse(raw);
      if (!parsed.success) {
        console.warn(`[config-store] skipping malformed config row user=${(raw as { user_id?: string }).user_id}:`, parsed.error.message);
        continue;
      }
      seen.add(parsed.data.user_id);
      const prev = this.configs.get(parsed.data.user_id);
      // Cheap change detection is fine at reconcile cadence; pushes handle
      // the latency-sensitive path.
      if (!prev || JSON.stringify(prev.row) !== JSON.stringify(parsed.data)) {
        this.applyRow(parsed.data);
      }
    }
    for (const userId of this.configs.keys()) {
      if (!seen.has(userId)) {
        this.configs.delete(userId);
        this.onChange(userId, null);
      }
    }
  }
}
