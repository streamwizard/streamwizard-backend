import { z } from "zod";
import { resolve, dirname } from "path";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";

// Load .env file from monorepo root
const loadEnvFile = () => {
  // Get the directory of this file
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // Try to find the .env file in the monorepo root
  // Go up from packages/env/src to the root
  const envPath = resolve(__dirname, "../../../.env");

  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, "utf-8");

    // Parse and set environment variables
    envContent.split("\n").forEach((line) => {
      // Skip empty lines and comments
      if (!line || line.trim().startsWith("#")) return;

      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim();
        // Only set if not already set (allows override)
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value;
        }
      }
    });
  }
};

// Load environment variables before validation
loadEnvFile();

/**
 * Environment variables schema
 * These are validated at runtime and must be present for the app to start
 */
const envSchema = z.object({
  // Twitch API Configuration
  TWITCH_CLIENT_ID: z.string().min(1, "TWITCH_CLIENT_ID is required"),
  TWITCH_CLIENT_SECRET: z.string().min(1, "TWITCH_CLIENT_SECRET is required"),
  TWITCH_WEBHOOK_SECRET: z.string().min(1, "TWITCH_WEBHOOK_SECRET is required"),

  // Encryption Configuration
  TOKEN_ENCRYPTION_KEY: z.string().min(1, "TOKEN_ENCRYPTION_KEY is required"),

  // Supabase Configuration
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),
  SUPABASE_SECRET_KEY: z.string().min(1, "SUPABASE_SECRET_KEY is required"),

  // Environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Minecraft WebSocket
  MINECRAFT_WS_AUTH_TOKEN: z.string().min(1, "MINECRAFT_WS_AUTH_TOKEN is required"),

  // InfluxDB Configuration (optional - metrics disabled if not set)
  INFLUXDB_URL: z.string().url().optional(),
  INFLUXDB_TOKEN: z.string().optional(),
  INFLUXDB_ORG: z.string().optional(),
  INFLUXDB_BUCKET: z.string().optional(),
});

/**
 * Validates and parses environment variables
 * Throws an error with detailed message if validation fails
 */
function validateEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    throw new Error("Invalid environment variables");
  }

  return parsed.data;
}

/**
 * Validated environment variables
 * Type-safe and guaranteed to be present
 *
 * @example
 * import { env } from "@repo/env";
 *
 * const clientId = env.TWITCH_CLIENT_ID;
 * const supabaseUrl = env.SUPABASE_URL;
 */
export const env = validateEnv();

/**
 * Type of the environment variables
 * Useful for dependency injection or testing
 */
export type Env = z.infer<typeof envSchema>;
