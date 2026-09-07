import posthog from "posthog-js";

// One place for every custom event name. Add here first, then capture.
export type AppEvent =
  | "login_clicked"
  | "login_completed"
  | "onboarding_started"
  | "onboarding_completed"
  | "clips_synced"
  | "clip_folder_created"
  | "overlay_created"
  | "overlay_favourite_toggled"
  | "widget_added"
  | "cloud_obs_launched"
  | "discord_linked"
  | "discord_guild_joined"
  // Public marketing pages. `$pathname` is on every event, so none of these
  // carry the page; `section` / `cta` say where on the page.
  | "cta_clicked"
  | "section_viewed"
  | "demo_interacted"
  | "faq_opened";

export function captureEvent(event: AppEvent, properties?: Record<string, unknown>) {
  posthog.capture(event, properties);
}
