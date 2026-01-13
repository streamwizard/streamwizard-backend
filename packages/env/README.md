# @repo/env

Centralized, type-safe environment variable validation using Zod for server-side applications.

## Features

- ✅ **Type-safe**: TypeScript infers types from Zod schema
- ✅ **Validated**: Fails fast with helpful errors if env vars are missing/invalid
- ✅ **Centralized**: Single source of truth for all environment variables
- ✅ **Server-only**: Optimized for backend services (no client/server separation needed)

## Usage

### In any package or app

```typescript
import { env } from "@repo/env";

// TypeScript knows the exact type and it's guaranteed to exist
const clientId = env.TWITCH_CLIENT_ID;
const clientSecret = env.TWITCH_CLIENT_SECRET;
const supabaseUrl = env.SUPABASE_URL;
```

### Adding new environment variables

1. Open `packages/env/index.ts`
2. Add to `envSchema`:

```typescript
const envSchema = z.object({
  // ... existing vars
  NEW_API_KEY: z.string().min(1, "NEW_API_KEY is required"),

  // Optional with default
  PORT: z.coerce.number().default(3000),

  // URL validation
  WEBHOOK_URL: z.string().url("Must be a valid URL"),
});
```

3. TypeScript will automatically infer the new type!

## Required Environment Variables

- `TWITCH_CLIENT_ID` - Your Twitch application client ID
- `TWITCH_CLIENT_SECRET` - Your Twitch application client secret
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SECRET_KEY` - Your Supabase secret/service role key
- `NODE_ENV` - Environment (development/production/test) - defaults to "development"

## Setting Up Your .env File

1. Copy `.env.example` to `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

2. Fill in your actual values:

   ```env
   TWITCH_CLIENT_ID=abc123xyz...
   TWITCH_CLIENT_SECRET=secret123...
   SUPABASE_URL=https://yourproject.supabase.co
   SUPABASE_SECRET_KEY=eyJhbG...
   NODE_ENV=development
   ```

3. Never commit `.env.local` (it's in `.gitignore`)

## Error Messages

If validation fails, you'll see helpful error messages:

```
❌ Invalid environment variables:
{
  "TWITCH_CLIENT_ID": {
    "_errors": ["TWITCH_CLIENT_ID is required"]
  }
}
```

## Best Practices

1. **Always use the `env` object** - Never use `process.env` directly in your code
2. **Add validation** - Use Zod's built-in validators (`.url()`, `.email()`, `.min()`, etc.)
3. **Use defaults wisely** - Only for truly optional variables
4. **Document new vars** - Update this README when adding new environment variables

## Advanced Zod Features

```typescript
const envSchema = z.object({
  // Coerce string to number
  PORT: z.coerce.number().positive().default(3000),

  // Email validation
  ADMIN_EMAIL: z.string().email(),

  // Enum (limited choices)
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Transform (e.g., comma-separated to array)
  ALLOWED_ORIGINS: z.string().transform((s) => s.split(",")),

  // Optional (can be undefined)
  OPTIONAL_KEY: z.string().optional(),
});
```

## Testing

For tests, you can mock the env:

```typescript
import type { Env } from "@repo/env";

const mockEnv: Env = {
  TWITCH_CLIENT_ID: "test-id",
  TWITCH_CLIENT_SECRET: "test-secret",
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_SECRET_KEY: "test-key",
  NODE_ENV: "test",
};
```
