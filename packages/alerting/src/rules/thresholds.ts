// The rule catalog (monitoring plan v2.2 §4). The constants below are CODE
// DEFAULTS; admins can override warn/crit/forTicks/envs/enabled per rule via
// the alert_rule_config table (edited on /alerts/rules), which the engine
// passes into buildRules() on every tick. Query logic and rule identity stay
// here — only the numbers are database-tunable.

// --- Default thresholds ---
export const GPU_TEMP_WARN_C = 83;
export const GPU_TEMP_CRIT_C = 90;
export const VRAM_USED_WARN_PCT = 92;
export const NVENC_FPS_LOW = 28;
/** NVENC ASIC busy % — the true saturation signal for a streaming box
 *  (utilization.gpu is time-occupancy and excludes the encoder). */
export const ENCODER_UTIL_WARN_PCT = 90;
export const NODE_CPU_WARN_PCT = 90;
export const NODE_RAM_WARN_PCT = 92;
export const INGEST_BANDWIDTH_WARN_PCT = 80;
/** NIC capacity assumed for ingest boxes until it's self-reported. */
export const INGEST_NIC_CAPACITY_MBPS = 1000;
export const API_5XX_RATE_PCT = 5;
export const API_5XX_MIN_REQUESTS = 20;
export const API_P95_WARN_MS = 1500;
export const WS_AUTH_FAILURE_SPIKE = 30;
export const DB_ERROR_RATE_PCT = 5;
export const DB_ERROR_MIN_QUERIES = 20;
export const DISK_WARN_PCT = 85;
export const DISK_CRIT_PCT = 95;
export const SSL_WARN_DAYS = 14;
export const SSL_CRIT_DAYS = 3;
export const SUPABASE_DB_CPU_WARN_PCT = 80;
export const SUPABASE_DB_CPU_CRIT_PCT = 95;
export const SUPABASE_DB_CONN_WARN_PCT = 80;
export const SUPABASE_DB_CONN_CRIT_PCT = 95;
export const SUPABASE_DB_DISK_WARN_PCT = 80;
export const SUPABASE_DB_DISK_CRIT_PCT = 90;
export const SUPABASE_SCRAPE_SILENT_MIN = 10;
/** Node agents write every 10s; 45s (4.5 missed samples) is decisively dead
 * without false-firing on a single hiccup. */
export const NODE_SILENT_AFTER_MS = 45 * 1000;
export const SERVICE_SILENT_AFTER_MIN = 5;
/** How long a single-crash alert stays visible after the crash. */
export const INSTANCE_CRASH_WINDOW_MIN = 10;
export const INSTANCE_CRASH_LOOP_COUNT = 3;
export const INSTANCE_CRASH_LOOP_WINDOW_MIN = 30;
export const EVENTSUB_SILENCE_MIN = 30;
export const INGEST_STALL_MIN_SESSION_AGE_MS = 2 * 60 * 1000;

// --- Rule constructors ---
// Each takes the full overrides record and resolves its own row by opts.id:
// effective value = override ?? code default. meta carries the defaults and
// units so the rules UI can render inputs without duplicating this file.
