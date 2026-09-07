import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getAlertRuleConfigs, type AlertRuleConfig } from "@repo/supabase/queries/alert-rule-config";
import { getRuleCatalog } from "@repo/alerting/rules";
import { PageHeader } from "@/components/widgets/page-header";
import { RulesEditor, type RuleView } from "@/components/alerts/rules-editor";

export const dynamic = "force-dynamic";

type EnvName = "prod" | "staging" | "dev";

export default async function AlertRulesPage() {
  let configs: AlertRuleConfig[] = [];
  try {
    configs = await getAlertRuleConfigs(supabaseAdmin);
  } catch {
    // Table unreachable — page still renders the catalog on code defaults.
  }
  const configById = new Map(configs.map((c) => [c.rule_id, c]));

  const rules: RuleView[] = getRuleCatalog().map((entry) => {
    const cfg = configById.get(entry.id);
    return {
      id: entry.id,
      title: entry.title,
      group: entry.group,
      defaultForTicks: entry.defaultForTicks,
      defaultEnvs: entry.defaultEnvs,
      warn: entry.warn,
      crit: entry.crit,
      config: cfg
        ? {
            enabled: cfg.enabled,
            warn: cfg.warn,
            crit: cfg.crit,
            forTicks: cfg.for_ticks,
            envs: cfg.envs as EnvName[] | null,
          }
        : null,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alert rules"
        description="Overrides of the code defaults — empty fields fall back to the default shown. The engine applies changes on its next tick (≤60s)."
      />
      <RulesEditor rules={rules} />
    </div>
  );
}
