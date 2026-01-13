# Environment Variables Setup Guide

## Overview

Your Turborepo monorepo now uses a centralized, type-safe environment variable system using **Zod** for validation.

## Architecture

```
@repo/env (validates env vars)
    ↓
@repo/supabase (uses env.SUPABASE_URL, env.SUPABASE_SECRET_KEY)
    ↓
@repo/twitch-api (uses env.TWITCH_CLIENT_ID, env.TWITCH_CLIENT_SECRET + @repo/supabase)
    ↓
Your apps (import and use everything)
```

## How It Works

### 1. **Single Source of Truth** - `@repo/env`

The `@repo/env` package defines and validates ALL environment variables:

```typescript
// packages/env/index.ts
import { z } from "zod";

const envSchema = z.object({
  TWITCH_CLIENT_ID: z.string().min(1),
  TWITCH_CLIENT_SECRET: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export const env = validateEnv(); // Validates on import!
```

### 2. **Usage in Packages**

All packages import from `@repo/env`:

```typescript
// packages/supabase/index.ts
import { env } from "@repo/env";

export const supabase = createClient(
  env.SUPABASE_URL, // ✅ Type-safe
  env.SUPABASE_SECRET_KEY // ✅ Validated
);
```

```typescript
// packages/twitch-api/base-client.ts
import { env } from "@repo/env";

config.headers["Client-Id"] = env.TWITCH_CLIENT_ID; // ✅ Type-safe & validated
```

### 3. **Setting Up Your Environment**

**Step 1**: Copy the example file

```bash
cp .env.example .env.local
```

**Step 2**: Fill in your actual values

```env
# .env.local (DO NOT COMMIT!)
TWITCH_CLIENT_ID=your_actual_client_id
TWITCH_CLIENT_SECRET=your_actual_secret
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_SECRET_KEY=your_service_role_key
NODE_ENV=development
```

**Step 3**: That's it! The env vars are automatically validated when any package loads.

## Benefits of This Approach

### ✅ Type Safety

```typescript
const id = env.TWITCH_CLIENT_ID; // TypeScript knows this is a string
const url = env.SUPABASE_URL; // TypeScript knows this is a URL
```

### ✅ Validation at Startup

If an env var is missing or invalid, your app won't even start:

```
❌ Invalid environment variables:
{
  "TWITCH_CLIENT_ID": {
    "_errors": ["TWITCH_CLIENT_ID is required"]
  }
}
Error: Invalid environment variables
```

### ✅ No Runtime Errors

You'll never get `undefined` errors because validation happens at import time:

```typescript
// ❌ Old way - can be undefined!
const id = process.env.TWITCH_CLIENT_ID;

// ✅ New way - guaranteed to exist and be valid
const id = env.TWITCH_CLIENT_ID;
```

### ✅ Centralized Management

Add a new env var once in `@repo/env`, use it everywhere:

```typescript
// 1. Add to packages/env/index.ts
const envSchema = z.object({
  // ... existing vars
  DISCORD_BOT_TOKEN: z.string().min(1),
});

// 2. Use anywhere
import { env } from "@repo/env";
const token = env.DISCORD_BOT_TOKEN; // ✅ Auto-completed in VS Code!
```

## Advanced Zod Validation Examples

### Custom Validation Messages

```typescript
TWITCH_CLIENT_ID: z
  .string()
  .min(30, "Twitch Client ID must be at least 30 characters")
  .regex(/^[a-z0-9]+$/, "Must be lowercase alphanumeric"),
```

### Transform Values

```typescript
// Comma-separated string → array
ALLOWED_IPS: z
  .string()
  .transform(s => s.split(',').map(ip => ip.trim())),

// Usage: env.ALLOWED_IPS → ['127.0.0.1', '192.168.1.1']
```

### Coerce Types

```typescript
// String "3000" → number 3000
PORT: z.coerce.number().positive().default(3000),

// String "true" → boolean true
DEBUG: z.coerce.boolean().default(false),
```

### Optional Values

```typescript
// Can be undefined
OPTIONAL_WEBHOOK_URL: z.string().url().optional(),

// With fallback
LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
```

## Common Patterns

### Pattern 1: Different Envs for Different Environments

Create multiple env files:

```bash
.env.development    # Development defaults
.env.production     # Production config
.env.local          # Local overrides (gitignored)
```

Bun/Node automatically loads the right one based on `NODE_ENV`.

### Pattern 2: Validate Related Vars Together

```typescript
const envSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    DATABASE_POOL_SIZE: z.coerce.number().positive().default(10),
  })
  .refine(
    (data) => {
      // Custom validation: if prod, pool size must be > 20
      if (data.NODE_ENV === "production" && data.DATABASE_POOL_SIZE < 20) {
        return false;
      }
      return true;
    },
    { message: "Production must have pool size >= 20" }
  );
```

### Pattern 3: Computed/Derived Values

```typescript
export const env = validateEnv();

// Derived values (not in schema)
export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
export const logLevel = isProduction ? "error" : "debug";
```

## Troubleshooting

### Error: "Cannot find module '@repo/env'"

Run `bun install` at the root:

```bash
cd /path/to/twitch-tools
bun install
```

### Error: "Invalid environment variables"

Check that all required vars are in your `.env.local` file.

### VS Code Not Auto-Completing

Restart the TypeScript server:

- CMD/Ctrl + Shift + P
- "TypeScript: Restart TS Server"

## Next Steps

1. ✅ **You're all set!** The env system is working
2. Create your `.env.local` file with actual values
3. Start building your apps that use these packages
4. Add more env vars as needed in `packages/env/index.ts`

## Quick Reference

```typescript
// Import
import { env } from "@repo/env";

// Use
env.TWITCH_CLIENT_ID; // string
env.TWITCH_CLIENT_SECRET; // string
env.SUPABASE_URL; // string (validated as URL)
env.SUPABASE_SECRET_KEY; // string
env.NODE_ENV; // "development" | "production" | "test"
```

That's it! Type-safe, validated, centralized environment variables for your entire monorepo. 🎉
