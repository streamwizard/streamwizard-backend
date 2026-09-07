/** Unwrap a settled promise, logging and falling back when it rejected.
 *  The dashboards fan out to many independent Influx queries; a single broken
 *  one must blank its own panel only — with Promise.all it took down every
 *  chart on the page, and a bare catch made that look like an outage. */
export function settled<T>(result: PromiseSettledResult<T>, fallback: T, label: string): T {
  if (result.status === "fulfilled") return result.value;
  console.error(`[${label}]`, result.reason);
  return fallback;
}
