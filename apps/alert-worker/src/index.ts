import { Sentry } from "./sentry";
import { flushSentry, reportFatal } from "@repo/sentry";
import { env } from "./lib/env";
import { runEvaluationPass } from "@repo/alerting/engine";
import { homeEnv } from "@repo/alerting/home-env";

// The alert engine's ticker: run an evaluation pass, report the outcome to
// healthchecks.io, sleep, repeat. Replaces the old curl sidecar + web-admin
// /api/alerts/evaluate route. The loop is sequential on purpose — a pass can
// legitimately take ~35s, and running them back-to-back can never self-overlap.
// The engine's own Supabase lock guards against a second alert-worker process.

process.on("uncaughtException", (err) => {
  reportFatal(err, "alert-worker");
});
process.on("unhandledRejection", (reason) => {
  console.error("[alert-worker] unhandledRejection", reason);
  Sentry.captureException(reason);
});

let stopped = false;
let wakeFromSleep: (() => void) | undefined;

function requestStop(signal: string): void {
  if (stopped) {
    console.error(`[alert-worker] second ${signal} — exiting without finishing the pass`);
    process.exit(1);
  }
  stopped = true;
  console.log(`[alert-worker] ${signal} received — stopping after the current pass`);
  wakeFromSleep?.();
}
process.on("SIGTERM", () => requestStop("SIGTERM"));
process.on("SIGINT", () => requestStop("SIGINT"));

/** Sleep that a shutdown signal can cut short. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      wakeFromSleep = undefined;
      resolve();
    }, ms);
    wakeFromSleep = () => {
      clearTimeout(timer);
      wakeFromSleep = undefined;
      resolve();
    };
  });
}

/** Dead-man's switch ping; best effort, never throws. */
async function ping(suffix = ""): Promise<void> {
  if (!env.HEALTHCHECKS_PING_URL) return;
  try {
    await fetch(env.HEALTHCHECKS_PING_URL + suffix, { signal: AbortSignal.timeout(10_000) });
  } catch {
    // A missed ping is what healthchecks.io exists to notice.
  }
}

// Sentry cron monitor: the counterpart to the healthchecks.io ping above, for
// environments where HEALTHCHECKS_PING_URL isn't set (staging today). The
// monitor is created on the first check-in, so there is nothing to configure
// in the Sentry UI. Check-ins carry the SDK's environment, so staging and
// production report separately.
const MONITOR_SLUG = "alert-worker-tick";
let lastHealthyCheckIn = 0;

function reportCheckIn(ok: boolean): void {
  // The loop ticks every 15s but the tightest schedule Sentry can express is
  // one minute, so healthy check-ins are throttled to match. Failures always
  // report — a missed failure is the whole point of the monitor.
  const now = Date.now();
  if (ok && now - lastHealthyCheckIn < 60_000) return;
  if (ok) lastHealthyCheckIn = now;

  Sentry.captureCheckIn(
    { monitorSlug: MONITOR_SLUG, status: ok ? "ok" : "error" },
    {
      schedule: { type: "interval", value: 1, unit: "minute" },
      // Two missed minutes before alerting: one tick can legitimately take
      // ~35s, and a single slow pass shouldn't page anyone.
      checkinMargin: 2,
      maxRuntime: 5,
      timezone: "Etc/UTC",
    },
  );
}

async function tick(): Promise<boolean> {
  try {
    const summary = await runEvaluationPass();
    console.log(`[alert-worker] ${new Date().toISOString()} ok ${JSON.stringify(summary)}`);
    await ping();
    reportCheckIn(true);
    return true;
  } catch (err) {
    // runEvaluationPass is fail-open internally; reaching here means the
    // whole pass died (e.g. a bug, not a dependency outage).
    console.error(`[alert-worker] ${new Date().toISOString()} FAILED`, err);
    Sentry.captureException(err);
    await ping("/fail");
    reportCheckIn(false);
    return false;
  }
}

const once = process.argv.includes("--once");
console.log(`[alert-worker] starting env=${homeEnv()} tick=${env.TICK_SECONDS}s${once ? " (single pass)" : ""}`);

// forTicks is counted in ticks, not seconds, so changing TICK_SECONDS
// rescales every rule's debounce. Print the derived wall-clock fire latency
// once at boot so a tick change can never silently reshape alerting.
{
  const { buildRules } = await import("@repo/alerting/rules");
  const latencies = buildRules()
    .map((r) => `${r.id}=${r.forTicks * env.TICK_SECONDS}s`)
    .join(" ");
  console.log(`[alert-worker] rule fire latency at this tick: ${latencies}`);
}

if (once) {
  const ok = await tick();
  await Sentry.flush(2_000).catch(() => {});
  process.exit(ok ? 0 : 1);
}

while (!stopped) {
  await tick();
  if (!stopped) await sleep(env.TICK_SECONDS * 1000);
}
console.log("[alert-worker] stopped");
// The --once path above already flushes; this is the SIGTERM exit, where a
// failed final pass would otherwise never reach Sentry.
await flushSentry();
