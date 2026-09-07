/**
 * Twitch OAuth scopes requested at sign-in (`actions/auth/login.ts`).
 * Each scope maps to a product surface; do not add scopes without a corresponding feature.
 *
 * @see https://dev.twitch.tv/docs/authentication/scopes
 */
export const TWITCH_SCOPES = [
  // Identity & account
  "openid",
  "user:read:email",
  "user:read:follows",
  "user:edit",
  // Chat & bot
  "user:bot",
  "user:read:chat",
  "user:write:chat",
  "channel:bot",
  // Broadcast & stream state
  "user:read:broadcast",
  "channel:manage:broadcast",
  "channel:read:hype_train",
  // Moderation tools
  "moderator:manage:shoutouts",
  "moderator:manage:shield_mode",
  "moderator:read:followers",
  "moderator:read:chatters",
  // Channel engagement (subs, raids, polls, redemptions, ads, bits)
  "channel:read:subscriptions",
  "channel:manage:redemptions",
  "channel:manage:raids",
  "channel:manage:polls",
  "channel:manage:ads",
  "channel:read:ads",
  "bits:read",
  // Clips (clip management & sync)
  "editor:manage:clips",
  "channel:manage:clips",

  // channel
  "channel:read:stream_key",
] as const;

export const discordInviteLink = "https://discord.gg/29Eq659egv";
export const discordDocsLink = "https://docs.streamwizard.org/discord";
export const githubLink = "https://github.com/streamwizard/streamwizard";
export const twitchChannelLink = "https://twitch.tv/jochemwhite";

/**
 * The IRL streamer whose footage the cloud OBS demo plays. The scene previews
 * and the away screens' clip rotator are their streams, not stock video, so
 * the demo credits them where it runs.
 */
export const xpuduChannelLink = "https://twitch.tv/xpudu";

/**
 * The official StreamWizard profiles, in the order the header and footer show
 * them. Icons stay in the components: this file is imported from server-only
 * paths, so it must not pull in React.
 */
export const socialLinks = [
  { name: "Discord", href: discordInviteLink, cta: "discord" },
  { name: "GitHub", href: githubLink, cta: "github" },
  { name: "Twitch", href: twitchChannelLink, cta: "twitch" },
] as const;

// Hardcoded like the links above rather than read from NEXT_PUBLIC_DOCS_URL,
// which is optional in the env schema and so can be undefined at render time.
export const docsLink = "https://docs.streamwizard.org";
export const docsClipsLink = "https://docs.streamwizard.org/clips/overview";

/**
 * Public product pages, one per pillar. The home page links to these instead of
 * to the docs: a visitor who wants to know more about clips should land on the
 * clips page, not in the manual.
 */
export const productLinks = {
  cloudObs: "/cloud-obs",
  overlays: "/overlays",
  clips: "/clips",
  vods: "/vods",
  analytics: "/analytics",
} as const;

/**
 * Deep links for the cross-page doors. A band that names one section on another
 * page ("see the clips rotator") should land on that section, not on the top of
 * the page and a second scroll.
 *
 * Each id here lives on the target section's own `<section>` element, together
 * with `scroll-mt-24` so the sticky header does not cover the heading. Renaming
 * an id means renaming it in both places.
 */
export const productSectionLinks = {
  overlaysClipsRotator: "/overlays#clips-rotator",
  clipsLibrary: "/clips#clip-library",
  clipsFolders: "/clips#clip-folders",
  vodsTimeline: "/vods#vod-timeline",
  cloudObsAutoSwitcher: "/cloud-obs#auto-switcher",
  cloudObsIrlOverlays: "/cloud-obs#irl-overlays",
} as const;
