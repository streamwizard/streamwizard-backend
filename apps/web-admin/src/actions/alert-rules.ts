"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { upsertAlertRuleConfig, deleteAlertRuleConfig } from "@repo/supabase/queries/alert-rule-config";
import { getRuleCatalog } from "@repo/alerting/rules";
import { assertAdmin } from "@/lib/assert-admin";
import type { Env } from "@repo/alerting/types";

const ALL_ENVS: Env[] = ["prod", "staging", "dev"];

export interface RuleConfigInput {
  ruleId: string;
  enabled: boolean;
  /** null = use the code default. */
  warn: number | null;
  crit: number | null;
  forTicks: number | null;
  envs: Env[] | null;
}

/** Persist a rule override; the engine picks it up on its next tick (≤60s). */
export async function saveRuleConfig(input: RuleConfigInput): Promise<void> {
  const userId = await assertAdmin();

  const entry = getRuleCatalog().find((r) => r.id === input.ruleId);
  if (!entry) throw new Error(`Unknown rule: ${input.ruleId}`);
  if (input.warn !== null && (entry.warn === undefined || !Number.isFinite(input.warn)))
    throw new Error(`Rule ${input.ruleId} has no editable warn threshold`);
  if (input.crit !== null && (entry.crit === undefined || !Number.isFinite(input.crit)))
    throw new Error(`Rule ${input.ruleId} has no editable crit threshold`);
  if (input.forTicks !== null && (!Number.isInteger(input.forTicks) || input.forTicks < 1 || input.forTicks > 10))
    throw new Error("For-ticks must be a whole number between 1 and 10");
  if (input.envs !== null && (input.envs.length === 0 || input.envs.some((e) => !ALL_ENVS.includes(e))))
    throw new Error("Envs must be a non-empty subset of prod/staging/dev");

  // An all-default override is the same as no override — keep the table clean.
  const isAllDefault =
    input.enabled && input.warn === null && input.crit === null && input.forTicks === null && input.envs === null;

  if (isAllDefault) {
    await deleteAlertRuleConfig(supabaseAdmin, input.ruleId);
  } else {
    await upsertAlertRuleConfig(supabaseAdmin, {
      rule_id: input.ruleId,
      enabled: input.enabled,
      warn: input.warn,
      crit: input.crit,
      for_ticks: input.forTicks,
      envs: input.envs,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    });
  }

  revalidatePath("/alerts/rules");
}

/** Back to code defaults = drop the override row. */
export async function resetRuleConfig(ruleId: string): Promise<void> {
  await assertAdmin();
  await deleteAlertRuleConfig(supabaseAdmin, ruleId);
  revalidatePath("/alerts/rules");
}
