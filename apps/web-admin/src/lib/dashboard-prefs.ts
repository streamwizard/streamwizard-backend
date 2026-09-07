// Persistence for the dashboard chrome settings (bandwidth unit, time range,
// refresh interval). Cookies rather than localStorage so the server layout can
// read the saved choice during render and hand it to the providers as their
// initial state — the first paint is already correct, with no post-hydration
// flash or mismatch.

export const DASHBOARD_COOKIE = {
  bandwidthUnit: "monitor.bandwidthUnit",
  timeRange: "monitor.timeRange",
  refreshInterval: "monitor.refreshInterval",
} as const;

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Client-side write. Runs only from event handlers in the providers, never
// during server render, so touching `document` here is safe.
export function writeDashboardCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}
