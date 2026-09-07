import { connect as tlsConnect } from "node:tls";
import { alertConfig } from "./config";
import type { Env, ProbeResult, Registry } from "./types";

// Synthetic (black-box) probes, run once per env per tick. Probe ids are
// stable strings — probe rules in rules.ts reference them and they become
// alert_state entity ids.

const PROBE_TIMEOUT_MS = 10_000;

interface ProbeTarget {
  id: string;
  url: string;
  /** Any HTTP status below this counts as reachable (Supabase REST answers
   * 401 without a key — still proof the service is up). */
  okBelowStatus?: number;
}

/** The ws-server /health endpoint is plain HTTP on the same host/port the
 * websocket URL points at: ws(s)://host[/ws] → http(s)://host/health. */
function wsServerHealthUrl(): string | undefined {
  const wsUrl = alertConfig.wsServerUrl;
  if (!wsUrl) return undefined;
  const base = wsUrl.replace(/^ws/, "http").replace(/\/ws\/?$/, "").replace(/\/$/, "");
  return `${base}/health`;
}

function publicTargets(alertEnv: Env): ProbeTarget[] {
  const wsHealth = wsServerHealthUrl();
  const serviceTargets: ProbeTarget[] = [
    ...(alertConfig.streamwizardApiUrl ? [{ id: "rest-api", url: `${alertConfig.streamwizardApiUrl.replace(/\/$/, "")}/health` }] : []),
    ...(wsHealth ? [{ id: "ws-server", url: wsHealth }] : []),
  ];
  switch (alertEnv) {
    case "prod":
      return [
        { id: "site", url: "https://streamwizard.org" },
        { id: "overlay", url: "https://overlay.streamwizard.org" },
        ...serviceTargets,
      ];
    case "staging":
      return [{ id: "site", url: "https://staging.streamwizard.org" }, ...serviceTargets];
    case "dev":
      return serviceTargets;
  }
}

async function probeHttp(target: ProbeTarget): Promise<ProbeResult> {
  const started = performance.now();
  try {
    const res = await fetch(target.url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: "no-store",
    });
    const ok = target.okBelowStatus ? res.status < target.okBelowStatus : res.ok;
    return { id: target.id, ok, statusCode: res.status, latencyMs: performance.now() - started };
  } catch (err) {
    return {
      id: target.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: performance.now() - started,
    };
  }
}

export async function runProbes(alertEnv: Env, registry: Registry): Promise<Map<string, ProbeResult>> {
  const targets: ProbeTarget[] = [...publicTargets(alertEnv)];

  // This deployment's own backing services. Supabase is deliberately NOT an
  // HTTP target here: the old /rest/v1/ probe sent no apikey, always got a
  // 401, and okBelowStatus scored that healthy. The engine now derives the
  // "supabase" probe result from whether the tick snapshot RPC succeeded and
  // injects it into this map — same id, so alert_state entity ids are stable.
  targets.push({ id: "influxdb", url: `${alertConfig.influxdbUrl.replace(/\/$/, "")}/health` });

  // Fleet nodes from the registry: OBS nodes expose /health on api_url,
  // ingest boxes on port 8090 over the tailnet.
  for (const node of registry.obsNodes) {
    if (node.status !== "linked" || node.maintenance || !node.apiUrl) continue;
    targets.push({ id: `obs-node:${node.name}`, url: `${node.apiUrl.replace(/\/$/, "")}/health` });
  }
  for (const node of registry.ingestNodes) {
    if (node.status !== "linked" || node.maintenance || !node.tailscaleIp) continue;
    targets.push({ id: `ingest-node:${node.name}`, url: `http://${node.tailscaleIp}:8090/health` });
  }

  const results = await Promise.all(targets.map(probeHttp));
  return new Map(results.map((r) => [r.id, r]));
}

// --- SSL expiry (hourly, prod hostnames only) ---

export interface SslExpiry {
  hostname: string;
  daysRemaining: number;
}

function checkCertificate(hostname: string): Promise<SslExpiry> {
  return new Promise((resolve, reject) => {
    const socket = tlsConnect({ host: hostname, port: 443, servername: hostname, timeout: PROBE_TIMEOUT_MS }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      if (!cert || !cert.valid_to) {
        reject(new Error(`No certificate returned for ${hostname}`));
        return;
      }
      const daysRemaining = (new Date(cert.valid_to).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      resolve({ hostname, daysRemaining });
    });
    socket.on("error", reject);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error(`TLS handshake with ${hostname} timed out`));
    });
  });
}

export const SSL_HOSTNAMES = ["streamwizard.org", "staging.streamwizard.org", "overlay.streamwizard.org"];

let lastSslCheckAt = 0;
let lastSslResults: SslExpiry[] = [];

/** Cert expiry, refreshed at most hourly (the tick runs every 60s). Failures
 * are skipped here — unreachability is the probe rule's job, not this one's. */
export async function checkSslExpiry(now: Date): Promise<SslExpiry[]> {
  if (now.getTime() - lastSslCheckAt < 60 * 60 * 1000) return lastSslResults;
  const results = await Promise.allSettled(SSL_HOSTNAMES.map(checkCertificate));
  lastSslCheckAt = now.getTime();
  lastSslResults = results.filter((r): r is PromiseFulfilledResult<SslExpiry> => r.status === "fulfilled").map((r) => r.value);
  return lastSslResults;
}
