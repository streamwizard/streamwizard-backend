// Thin re-export so the layout badge and alerts UI resolve the environment
// exactly like the alert engine in apps/alert-worker — the logic lives with the
// engine in @repo/alerting and can't drift.
export { homeEnv } from "@repo/alerting/home-env";
export type { Env as HomeEnv } from "@repo/alerting/types";
