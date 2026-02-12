import { InfluxDB, Point, WriteApi } from "@influxdata/influxdb-client";
import { env } from "@repo/env";

/**
 * Twitch API metrics tracker using InfluxDB.
 * Uses a buffered, fire-and-forget pattern to ensure zero impact on request performance.
 *
 * - Metrics are added to an in-memory buffer synchronously
 * - Background interval flushes buffer to InfluxDB every 10 seconds
 * - Failures are silently dropped (never blocks API requests)
 */

interface MetricPoint {
  method: string;
  endpoint: string;
  status: string;
  app: string;
  timestamp: Date;
}

// In-memory buffer for metrics
const buffer: MetricPoint[] = [];

// InfluxDB write client (lazy initialized)
let writeApi: WriteApi | null = null;
let isConfigured = false;
let flushInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Initialize the InfluxDB client if configured.
 * Called lazily on first metric track.
 */
function initializeClient(): void {
  if (isConfigured) return;
  isConfigured = true;

  const { INFLUXDB_URL, INFLUXDB_TOKEN, INFLUXDB_ORG, INFLUXDB_BUCKET } = env;

  // Skip if not configured
  if (!INFLUXDB_URL || !INFLUXDB_TOKEN || !INFLUXDB_ORG || !INFLUXDB_BUCKET) {
    return;
  }

  try {
    const client = new InfluxDB({
      url: INFLUXDB_URL,
      token: INFLUXDB_TOKEN,
    });

    writeApi = client.getWriteApi(INFLUXDB_ORG, INFLUXDB_BUCKET, "ms", {
      batchSize: 100,
      flushInterval: 10000, // 10 seconds
      maxRetries: 2,
      retryJitter: 200,
    });

    // Set default tags
    writeApi.useDefaultTags({ service: "twitch-tools" });

    // Start background flush interval
    flushInterval = setInterval(() => {
      flushBuffer();
    }, 10000);
  } catch {
    // Silently fail - metrics are optional
    writeApi = null;
  }
}

/**
 * Flush buffered metrics to InfluxDB.
 * Called by background interval.
 */
function flushBuffer(): void {
  if (!writeApi || buffer.length === 0) return;

  try {
    // Drain buffer
    const points = buffer.splice(0, buffer.length);

    for (const metric of points) {
      const point = new Point("twitch_api_request")
        .tag("method", metric.method)
        .tag("endpoint", metric.endpoint)
        .tag("status", metric.status)
        .tag("app", metric.app)
        .intField("count", 1)
        .timestamp(metric.timestamp);

      writeApi.writePoint(point);
    }
  } catch {
    // Silently fail - never block on metrics
  }
}

/**
 * Track a Twitch API request.
 * This function is SYNCHRONOUS and will never throw.
 *
 * @param method - HTTP method (GET, POST, etc.)
 * @param endpoint - Normalized endpoint path
 * @param status - HTTP status code or "ERROR"
 * @param app - Application name (e.g., "rest-api", "streamwizard-bot")
 */
export function trackTwitchApiRequest(method: string, endpoint: string, status: string, app: string = "unknown"): void {
  try {
    // Lazy initialization
    initializeClient();

    // Add to buffer (sync operation)
    buffer.push({
      method: method.toUpperCase(),
      endpoint,
      status,
      app,
      timestamp: new Date(),
    });

    // Keep buffer bounded to prevent memory issues
    if (buffer.length > 1000) {
      buffer.splice(0, 500);
    }
  } catch {
    // Never throw from metrics code
  }
}

/**
 * Gracefully close the InfluxDB connection.
 * Call this on process shutdown.
 */
export async function closeMetrics(): Promise<void> {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }

  if (writeApi) {
    try {
      flushBuffer();
      await writeApi.close();
    } catch {
      // Ignore close errors
    }
    writeApi = null;
  }
}

/**
 * Check if metrics are enabled (InfluxDB is configured).
 */
export function isMetricsEnabled(): boolean {
  const { INFLUXDB_URL, INFLUXDB_TOKEN, INFLUXDB_ORG, INFLUXDB_BUCKET } = env;
  return !!(INFLUXDB_URL && INFLUXDB_TOKEN && INFLUXDB_ORG && INFLUXDB_BUCKET);
}
