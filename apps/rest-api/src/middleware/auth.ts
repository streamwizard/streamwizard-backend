// middleware/auth.ts
import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Context, MiddlewareHandler, Next } from "hono";
import { setCookie } from "hono/cookie";
import { env } from "../lib/env";
import type { Database } from "../types/supabase";

declare module "hono" {
  interface ContextVariableMap {
    supabase: SupabaseClient;
    user: {
      id: string;
      email?: string;
      [key: string]: any;
    } | null;
  }
}

/**
 * Get the Supabase client from context
 * Must be used after supabaseMiddleware() has been applied
 */
export const getSupabase = (c: Context) => {
  return c.get("supabase");
};

/**
 * Supabase SSR Middleware
 * 
 * Creates a Supabase client with proper cookie and Authorization header handling.
 * This middleware should be applied before routes that need Supabase.
 * 
 * Handles authentication from:
 * - Authorization: Bearer <token> headers
 * - Cookies (for SSR)
 * 
 * Usage:
 * ```typescript
 * app.use("/api/*", supabaseMiddleware());
 * ```
 */
export const supabaseMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseAnonKey = env.SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL missing!");
    }

    if (!supabaseAnonKey) {
      throw new Error("SUPABASE_ANON_KEY missing!");
    }

    // Create SSR client with cookie handling
    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return parseCookieHeader(c.req.header("Cookie") ?? "");
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value, options }) => setCookie(c, name, value, options));
        },
      },
      // Important: Configure auth to work with Authorization headers
      global: {
        headers: {
          Authorization: c.req.header("Authorization") ?? "",
        },
      },
    });

    c.set("supabase", supabase as any);

    await next();
  };
};

/**
 * Authentication Middleware
 * 
 * Verifies that the user is authenticated and sets the user in context.
 * Must be used after supabaseMiddleware().
 * 
 * Works with both Authorization headers and cookies.
 * 
 * Usage:
 * ```typescript
 * app.post("/api/clips/sync", supabaseMiddleware(), supabaseAuth(), async (c) => {
 *   const user = c.get("user");
 *   // user is guaranteed to exist here
 * });
 * ```
 */
export const supabaseAuth = (): MiddlewareHandler => {
  return async (c: Context, next: Next) => {
    const supabase = c.get("supabase");

    if (!supabase) {
      return c.json(
        {
          error: "Supabase client not initialized",
          message: "Internal server error",
        },
        500
      );
    }

    try {
      // Get user - SSR client will automatically use Authorization header or cookies
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error("Auth error:", error.message, error.status);
        return c.json(
          {
            error: "Unauthorized",
            message: "Please sign in to access this resource",
            details: error.message,
          },
          401
        );
      }

      if (!user) {
        console.error("No user found in session");
        return c.json(
          {
            error: "Unauthorized",
            message: "Please sign in to access this resource",
          },
          401
        );
      }

      // Set user in context
      c.set("user", user);

      await next();
    } catch (error) {
      console.error("Authentication error:", error);
      return c.json(
        {
          error: "Authentication failed",
          message: "Unable to verify authentication",
        },
        500
      );
    }
  };
};
