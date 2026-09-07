import { redirect } from "next/navigation";
import { reportError } from "@repo/sentry";

// Next-specific wrapper around @repo/sentry's reportError — it stays in the
// app because next/navigation can't be a dependency of the shared package.
// Returns never (redirect throws), so callers keep TypeScript's narrowing
// after `if (error) reportAndRedirect(...)` guards, same as a bare redirect.
export function reportAndRedirect(error: unknown, destination: string): never {
  reportError(error, destination);
  redirect(destination);
}
