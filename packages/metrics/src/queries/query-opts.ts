// Shared options for query builders. The alert-worker evaluates every environment
// in one pass, so builders must accept an explicit bucket instead of always
// reading the process-wide INFLUXDB_BUCKET.
export interface QueryOpts {
  bucket?: string;
}

export function resolveBucket(opts?: QueryOpts): string {
  return opts?.bucket ?? process.env.INFLUXDB_BUCKET ?? "streamwizard";
}
