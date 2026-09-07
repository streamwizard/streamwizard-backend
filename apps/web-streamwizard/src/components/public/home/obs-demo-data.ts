import type { ChatBadge, ChatFragment } from "@repo/ui/chat";

/*
 * The canned material behind the playable deck: chat script, scenes, and the
 * categories its stream-info tab offers. Kept out of the component so the demo
 * reads as a script someone wrote rather than as logic.
 */

export interface DemoSource {
  name: string;
  kind: string;
}

export interface DemoScene {
  name: string;
  /** Divider rows exist in a real scene list; they are not selectable. */
  divider?: boolean;
  sources?: DemoSource[];
  preview?: "empty" | "irl" | "starting" | "brb" | "ending" | "lost";
}

/** One scene collection, shared by the OBS window and the deck. */
export const DEMO_SCENES: DemoScene[] = [
  { name: "Starting Soon", preview: "starting", sources: [{ name: "Countdown", kind: "Browser source" }] },
  {
    name: "IRL",
    preview: "irl",
    sources: [
      { name: "Incoming feed", kind: "Media source" },
      { name: "Alerts", kind: "Browser source" },
      { name: "Walking stats", kind: "Browser source" },
    ],
  },
  { name: "Connection Lost", preview: "lost" },
  { name: "BRB", preview: "brb", sources: [{ name: "BRB card", kind: "Image" }] },
  { name: "Ending", preview: "ending", sources: [{ name: "Outro", kind: "Browser source" }] },
  { name: "--------------", divider: true },
  { name: "_incoming-sources", preview: "empty" },
  { name: "_alerts", preview: "empty" },
];

/** What the deck offers: production hides scenes whose name starts with - or _. */
export const DECK_SCENES = DEMO_SCENES.filter((scene) => !/^[-_]/.test(scene.name));

const badge = (setId: string, uuid: string): ChatBadge => ({
  set_id: setId,
  id: "1",
  url_2x: `https://static-cdn.jtvnw.net/badges/v1/${uuid}/2`,
});

export const BADGES = {
  broadcaster: badge("broadcaster", "5527c58c-fb7d-422d-b71b-f309dcb85cc1"),
  moderator: badge("moderator", "3267646d-33f0-4b17-b3df-f923a41db1d0"),
  vip: badge("vip", "b817aba4-fad8-49e2-b88a-7cc744dfa6ec"),
  subscriber: badge("subscriber", "5d9f2208-5dd8-11e7-8513-2ff4adfae661"),
};

export const text = (value: string): ChatFragment => ({ type: "text", text: value });

// Global Twitch emotes render straight from their id, no asset prefetch needed.
const emote = (name: string, id: string): ChatFragment => ({
  type: "emote",
  text: name,
  emote: { id, emote_set_id: "0" },
});

export interface MockMessage {
  name: string;
  login: string;
  color: string;
  badges: ChatBadge[];
  fragments: ChatFragment[];
}

export const SEED_CHAT: MockMessage[] = [
  {
    name: "pixelgremlin",
    login: "pixelgremlin",
    color: "#00D4AA",
    badges: [BADGES.subscriber],
    fragments: [text("wait you're streaming from a phone??")],
  },
  {
    name: "ModMothra",
    login: "modmothra",
    color: "#FF7F50",
    badges: [BADGES.moderator],
    fragments: [text("no PC in the bag. just vibes "), emote("SeemsGood", "64138")],
  },
  {
    name: "toastcrumb",
    login: "toastcrumb",
    color: "#9146FF",
    badges: [],
    fragments: [text("my whole setup weighs 40kg and this man has pockets "), emote("LUL", "425618")],
  },
];

export const AMBIENT_CHAT: MockMessage[] = [
  {
    name: "bitrate_gremlin",
    login: "bitrate_gremlin",
    color: "#1E90FF",
    badges: [BADGES.vip],
    fragments: [text("bitrate holding better than my home wifi")],
  },
  {
    name: "sandwichlord",
    login: "sandwichlord",
    color: "#FF69B4",
    badges: [],
    fragments: [text("walk toward the ducks. chat demands ducks")],
  },
  {
    name: "ninetoad",
    login: "ninetoad",
    color: "#00FF7F",
    badges: [BADGES.subscriber],
    fragments: [text("the tunnel is coming. brace "), emote("NotLikeThis", "58765")],
  },
  {
    name: "ModMothra",
    login: "modmothra",
    color: "#FF7F50",
    badges: [BADGES.moderator],
    fragments: [text("scene swapped itself when the signal died, nobody panic")],
  },
  {
    name: "quietlurker",
    login: "quietlurker",
    color: "#B22222",
    badges: [],
    fragments: [text("been lurking 40 minutes, still no PC in sight "), emote("Kappa", "25")],
  },
  {
    name: "pixelgremlin",
    login: "pixelgremlin",
    color: "#00D4AA",
    badges: [BADGES.subscriber],
    fragments: [text("streaming a whole city from a pocket is unfair")],
  },
  {
    name: "toastcrumb",
    login: "toastcrumb",
    color: "#9146FF",
    badges: [],
    fragments: [text("4head moment incoming "), emote("4Head", "354")],
  },
];

export const SCENE_REACTIONS: Record<string, MockMessage> = {
  IRL: {
    name: "sandwichlord",
    login: "sandwichlord",
    color: "#FF69B4",
    badges: [],
    fragments: [text("WE'RE OUTSIDE")],
  },
  BRB: {
    name: "quietlurker",
    login: "quietlurker",
    color: "#B22222",
    badges: [],
    fragments: [text("brb he says. see you in 40 minutes "), emote("ResidentSleeper", "245")],
  },
  "Connection Lost": {
    name: "ModMothra",
    login: "modmothra",
    color: "#FF7F50",
    badges: [BADGES.moderator],
    fragments: [text("signal died. hold tight, it comes back on its own")],
  },
  "Starting Soon": {
    name: "ninetoad",
    login: "ninetoad",
    color: "#00FF7F",
    badges: [BADGES.subscriber],
    fragments: [text("here we go here we go")],
  },
  Ending: {
    name: "pixelgremlin",
    login: "pixelgremlin",
    color: "#00D4AA",
    badges: [BADGES.subscriber],
    fragments: [text("good walk. same time tomorrow?")],
  },
};

export const WENT_LIVE: MockMessage = {
  name: "pixelgremlin",
  login: "pixelgremlin",
  color: "#00D4AA",
  badges: [BADGES.subscriber],
  fragments: [text("HE'S LIVE from a phone "), emote("SeemsGood", "64138")],
};

export const WENT_OFFLINE: MockMessage = {
  name: "toastcrumb",
  login: "toastcrumb",
  color: "#9146FF",
  badges: [],
  fragments: [text("ended the stream with a thumb. incredible")],
};

export const REPLIES: MockMessage[] = [
  {
    name: "ModMothra",
    login: "modmothra",
    color: "#FF7F50",
    badges: [BADGES.moderator],
    fragments: [text("he types back while walking, absolute unit")],
  },
  {
    name: "bitrate_gremlin",
    login: "bitrate_gremlin",
    color: "#1E90FF",
    badges: [BADGES.vip],
    fragments: [text("chat is being answered from a pocket "), emote("Kappa", "25")],
  },
];

export const TITLE_SAVED: MockMessage = {
  name: "ninetoad",
  login: "ninetoad",
  color: "#00FF7F",
  badges: [BADGES.subscriber],
  fragments: [text("title changed mid walk, we love to see it")],
};

export interface MockCategory {
  id: string;
  name: string;
}

/** Real Twitch category ids, so the box art loads from Twitch's own CDN. */
export const CATEGORIES: MockCategory[] = [
  { id: "509658", name: "Just Chatting" },
  { id: "509672", name: "IRL" },
  { id: "1469308723", name: "Software and Game Development" },
  { id: "509660", name: "Art" },
];

/**
 * A scene preview can play a real clip from the R2 CDN instead of the drawn
 * fallback. Values are either absolute URLs or paths under NEXT_PUBLIC_CDN_URL.
 * Landing-page clips live on the production CDN only (the staging bucket does
 * not mirror them), so they are absolute and the host is allowed in media-src
 * explicitly; see LANDING_CDN_URL in lib/csp.ts.
 *
 * Any scene left out here keeps its drawn preview, and a clip that fails to
 * load falls back to the same drawing, so a missing upload degrades quietly.
 */
export const SCENE_VIDEOS: Record<string, string> = {
  IRL: "https://cdn.streamwizard.org/public/vods/irl-preview-480p.webm",
};

/** Absolute CDN URL for a scene's clip, or null when it has none. */
export function sceneVideoUrl(scene: string): string | null {
  const path = SCENE_VIDEOS[scene];
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const base = process.env.NEXT_PUBLIC_CDN_URL;
  return base ? `${base}${path}` : null;
}

export const DEFAULT_TITLE = "Late night walk through the city, come vibe";

export function boxArtUrl(id: string) {
  return `https://static-cdn.jtvnw.net/ttv-boxart/${id}-104x144.jpg`;
}
