"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Switch, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
import { saveRuleConfig, resetRuleConfig } from "@/actions/alert-rules";

type EnvName = "prod" | "staging" | "dev";
const ALL_ENVS: EnvName[] = ["prod", "staging", "dev"];

export interface RuleKnobView {
  default: number;
  unit: string;
  direction: "above" | "below";
}

export interface RuleConfigView {
  enabled: boolean;
  warn: number | null;
  crit: number | null;
  forTicks: number | null;
  envs: EnvName[] | null;
}

export interface RuleView {
  id: string;
  title: string;
  group: string;
  defaultForTicks: number;
  defaultEnvs: EnvName[];
  warn?: RuleKnobView;
  crit?: RuleKnobView;
  /** Existing override row, null when the rule runs on code defaults. */
  config: RuleConfigView | null;
}

const sameEnvs = (a: EnvName[], b: EnvName[]) => a.length === b.length && a.every((e) => b.includes(e));

function ThresholdInput({
  knob,
  value,
  onChange,
  disabled,
}: {
  knob?: RuleKnobView;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  if (!knob) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-xs text-muted-foreground">{knob.direction === "above" ? ">" : "<"}</span>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={String(knob.default)}
        disabled={disabled}
        className="h-8 w-20 text-right tabular-nums"
      />
      <span className="text-xs text-muted-foreground">{knob.unit}</span>
    </span>
  );
}

function RuleRow({ rule }: { rule: RuleView }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const initial: RuleConfigView = rule.config ?? { enabled: true, warn: null, crit: null, forTicks: null, envs: null };
  const [enabled, setEnabled] = useState(initial.enabled);
  const [warnText, setWarnText] = useState(initial.warn?.toString() ?? "");
  const [critText, setCritText] = useState(initial.crit?.toString() ?? "");
  const [ticksText, setTicksText] = useState(initial.forTicks?.toString() ?? "");
  const [envs, setEnvs] = useState<EnvName[] | null>(initial.envs);

  const parse = (text: string): number | null => (text.trim() === "" ? null : Number(text));

  const dirty =
    enabled !== initial.enabled ||
    parse(warnText) !== initial.warn ||
    parse(critText) !== initial.crit ||
    parse(ticksText) !== initial.forTicks ||
    (envs === null) !== (initial.envs === null) ||
    (envs !== null && initial.envs !== null && !sameEnvs(envs, initial.envs));

  const effectiveEnvs = envs ?? rule.defaultEnvs;

  const toggleEnv = (env: EnvName) => {
    const next = effectiveEnvs.includes(env) ? effectiveEnvs.filter((e) => e !== env) : [...effectiveEnvs, env];
    if (next.length === 0) return; // a rule must run somewhere; use the switch to disable it
    setEnvs(sameEnvs(next, rule.defaultEnvs) ? null : next);
  };

  const save = () =>
    startTransition(async () => {
      setError(null);
      try {
        await saveRuleConfig({
          ruleId: rule.id,
          enabled,
          warn: parse(warnText),
          crit: parse(critText),
          forTicks: parse(ticksText),
          envs,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save");
      }
    });

  const reset = () =>
    startTransition(async () => {
      setError(null);
      try {
        await resetRuleConfig(rule.id);
        setEnabled(true);
        setWarnText("");
        setCritText("");
        setTicksText("");
        setEnvs(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't reset");
      }
    });

  return (
    <TableRow className={enabled ? undefined : "opacity-50"}>
      <TableCell>
        <div className="font-medium">{rule.title}</div>
        <div className="flex items-center gap-2">
          <code className="font-mono text-xs text-muted-foreground">{rule.id}</code>
          {rule.config !== null && (
            <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
              customized
            </Badge>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          {ALL_ENVS.map((env) => (
            <button
              key={env}
              type="button"
              onClick={() => toggleEnv(env)}
              disabled={isPending}
              className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase transition-colors ${
                effectiveEnvs.includes(env)
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground/50 line-through"
              }`}
            >
              {env}
            </button>
          ))}
        </div>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={ticksText}
          onChange={(e) => setTicksText(e.target.value)}
          placeholder={String(rule.defaultForTicks)}
          disabled={isPending}
          className="h-8 w-14 text-right tabular-nums"
        />
      </TableCell>
      <TableCell>
        <ThresholdInput knob={rule.warn} value={warnText} onChange={setWarnText} disabled={isPending} />
      </TableCell>
      <TableCell>
        <ThresholdInput knob={rule.crit} value={critText} onChange={setCritText} disabled={isPending} />
      </TableCell>
      <TableCell>
        <Switch checked={enabled} onCheckedChange={setEnabled} disabled={isPending} aria-label="Rule enabled" />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          {dirty && (
            <Button size="sm" className="h-7" onClick={save} disabled={isPending}>
              Save
            </Button>
          )}
          {rule.config !== null && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={reset}
              disabled={isPending}
              title="Reset to code defaults"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function RulesEditor({ rules }: { rules: RuleView[] }) {
  const groups = useMemo(() => {
    const byGroup = new Map<string, RuleView[]>();
    for (const rule of rules) {
      const list = byGroup.get(rule.group) ?? [];
      list.push(rule);
      byGroup.set(rule.group, list);
    }
    return [...byGroup.entries()];
  }, [rules]);

  return (
    <div className="space-y-6">
      {groups.map(([group, groupRules]) => (
        <Card key={group}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{group}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Envs</TableHead>
                  <TableHead>For ticks</TableHead>
                  <TableHead>Warn</TableHead>
                  <TableHead>Crit</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupRules.map((rule) => (
                  <RuleRow key={rule.id} rule={rule} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
