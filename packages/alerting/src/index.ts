// The alert engine and its rule catalog, shared between apps/alert-worker (which
// runs runEvaluationPass on a tick loop) and apps/web-admin (whose /alerts
// UI renders the catalog and notification routes). Prefer the subpath
// exports (@repo/alerting/rules, /notify, …) so Next never bundles engine.ts.
export * from "./types";
export { runEvaluationPass, type TickSummary, type EnvTickSummary } from "./engine";
export { buildRules, getRuleCatalog, type RuleCatalogEntry } from "./rules";
export { defaultRoute, resolveRoute, dispatchNotifications, type EnvRoute, type DiscordTarget, type SeverityGate } from "./notify";
export { computeTransitions, RENOTIFY_INTERVAL_MS } from "./state";
export { homeEnv } from "./home-env";
