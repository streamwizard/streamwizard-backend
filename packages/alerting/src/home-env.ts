import type { Env } from "./types";

/** Each deployment monitors its own environment. ALERT_ENV takes precedence
 * because Next's standalone server.js hard-sets NODE_ENV=production at
 * startup — without it, staging/dev containers would report as prod. */
export function homeEnv(): Env {
  const alertEnv = process.env.ALERT_ENV;
  if (alertEnv === "prod" || alertEnv === "staging" || alertEnv === "dev") return alertEnv;
  // Widen: under @types/node NODE_ENV is a literal union without "staging".
  const nodeEnv: string | undefined = process.env.NODE_ENV;
  switch (nodeEnv) {
    case "production":
      return "prod";
    case "staging":
      return "staging";
    default:
      return "dev";
  }
}
