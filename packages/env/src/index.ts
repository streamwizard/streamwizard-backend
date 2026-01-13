import { z } from "zod";

/**
 * Environment variables schema
 * These are validated at runtime and must be present for the app to start
 */
const envSchema = z.object({
    // Twitch API Configuration
    TWITCH_CLIENT_ID: z.string().min(1, "TWITCH_CLIENT_ID is required"),
    TWITCH_CLIENT_SECRET: z.string().min(1, "TWITCH_CLIENT_SECRET is required"),

    // Supabase Configuration
    SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
    SUPABASE_SECRET_KEY: z.string().min(1, "SUPABASE_SECRET_KEY is required"),

    // Environment
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
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
