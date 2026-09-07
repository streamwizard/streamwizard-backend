import { InfluxDB, QueryApi } from "@influxdata/influxdb-client";

let queryApi: QueryApi | null = null;

function getQueryApi(): QueryApi {
  if (queryApi) return queryApi;

  const { INFLUXDB_URL, INFLUXDB_TOKEN, INFLUXDB_ORG } = process.env;
  if (!INFLUXDB_URL || !INFLUXDB_TOKEN || !INFLUXDB_ORG) {
    throw new Error("InfluxDB env vars not configured (INFLUXDB_URL, INFLUXDB_TOKEN, INFLUXDB_ORG required)");
  }

  const client = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
  queryApi = client.getQueryApi(INFLUXDB_ORG);
  return queryApi;
}

// Flux duration literal: an integer followed by a single unit (ns/us/ms/s/m/h/d/w/y).
// Query builders interpolate range/window strings directly into Flux source
// (this client has no parameterized-query support), so anything reaching them
// from a request (e.g. ?range=, ?window=) must be validated against this
// shape first — otherwise it's a Flux injection point.
const FLUX_DURATION_RE = /^\d{1,5}(ns|us|µs|ms|s|m|h|d|w|y)$/;

export function assertValidFluxDuration(value: string, label: string): string {
  if (!FLUX_DURATION_RE.test(value)) {
    throw new Error(`Invalid ${label}: "${value}" is not a valid Flux duration`);
  }
  return value;
}

export async function runFluxQuery<T>(
  query: string,
  rowMapper: (row: Record<string, string>) => T
): Promise<T[]> {
  const api = getQueryApi();
  const results: T[] = [];

  await new Promise<void>((resolve, reject) => {
    api.queryRows(query, {
      next(row, tableMeta) {
        const obj = tableMeta.toObject(row) as Record<string, string>;
        results.push(rowMapper(obj));
      },
      error: reject,
      complete: resolve,
    });
  });

  return results;
}
