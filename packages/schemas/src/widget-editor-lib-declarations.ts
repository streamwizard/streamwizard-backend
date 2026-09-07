// Hand-written Monaco extra-lib declarations for the widget editor, covering
// the libraries and globals the srcdoc sandbox injects (see buildWidgetSrcdoc
// in @repo/ui). The Twitch event catalog lives in widget-editor-declarations.ts
// (generated - do not merge these into that file, it gets overwritten).

export const GSAP_DECLARATIONS = `
interface GSAPTweenVars {
  duration?: number;
  delay?: number;
  ease?: string;
  opacity?: number;
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  width?: number | string;
  height?: number | string;
  backgroundColor?: string;
  color?: string;
  fontSize?: number | string;
  repeat?: number;
  yoyo?: boolean;
  stagger?: number | object;
  onComplete?: () => void;
  onStart?: () => void;
  onUpdate?: () => void;
  [key: string]: any;
}

interface GSAPTimeline {
  to(targets: any, vars: GSAPTweenVars, position?: number | string): GSAPTimeline;
  from(targets: any, vars: GSAPTweenVars, position?: number | string): GSAPTimeline;
  fromTo(targets: any, fromVars: GSAPTweenVars, toVars: GSAPTweenVars, position?: number | string): GSAPTimeline;
  add(child: any, position?: number | string): GSAPTimeline;
  play(): GSAPTimeline;
  pause(): GSAPTimeline;
  reverse(): GSAPTimeline;
  restart(): GSAPTimeline;
  kill(): void;
  duration(): number;
  progress(value?: number): GSAPTimeline | number;
  repeat(value?: number): GSAPTimeline | number;
  delay(value?: number): GSAPTimeline | number;
}

interface GSAP {
  to(targets: any, vars: GSAPTweenVars): object;
  from(targets: any, vars: GSAPTweenVars): object;
  fromTo(targets: any, fromVars: GSAPTweenVars, toVars: GSAPTweenVars): object;
  set(targets: any, vars: GSAPTweenVars): object;
  timeline(vars?: GSAPTweenVars): GSAPTimeline;
  registerPlugin(...plugins: any[]): void;
  killTweensOf(targets: any): void;
  delayedCall(delay: number, callback: () => void): object;
  utils: {
    clamp(min: number, max: number, value: number): number;
    mapRange(inMin: number, inMax: number, outMin: number, outMax: number, value: number): number;
    interpolate(start: any, end: any, progress: number): any;
  };
}

declare const gsap: GSAP;

interface TextPlugin {
  text?: string | { value: string; delimiter?: string };
}
`;

export const STREAMWIZARD_RUNTIME_DECLARATIONS = `
interface StreamWizardSession {
  subscriberToken: string;
  overlayItemId: string;
}

interface StreamWizardStateApi {
  /**
   * Loads this widget instance's persisted state (or null when nothing was
   * saved yet). Only available when the widget is placed on an overlay -
   * throws in the editor preview.
   */
  get(): Promise<any | null>;
  /**
   * Persists this widget instance's state. Overwrites the previous value;
   * spread the old state if you want to merge. Only available when the
   * widget is placed on an overlay - throws in the editor preview.
   */
  set(state: Record<string, any>): Promise<void>;
}

/**
 * Channel-wide state, shared by every widget on the channel and written by the
 * server too - unlike StreamWizard.state, which is private to this one placed
 * widget. Use it for anything that should outlive the overlay being closed, or
 * that another surface needs to see.
 *
 * Keys are 1-64 characters of a-z, 0-9 or _. Keys beginning "sys." are written
 * by StreamWizard itself and are read-only here:
 *
 *   sys.stream_id          current Twitch stream id, or null when offline
 *   sys.stream_started_at  ISO timestamp the stream started
 *   sys.is_live            boolean
 */
interface StreamWizardUserStateApi {
  /** Reads one key. Resolves to null when it has never been set. */
  get(key: string): Promise<any | null>;
  /** Reads every key for the channel as one object. */
  getAll(): Promise<Record<string, any>>;
  /**
   * Writes one key. Rejects "sys." keys, values over 8KB, and keys outside the
   * allowed character set. Only available when the widget is placed on an
   * overlay - throws in the editor preview.
   */
  set(key: string, value: any): Promise<void>;
  /**
   * Adds amount (default 1; may be negative) to a numeric key atomically on
   * the server and resolves to the new value. Two increments racing both
   * count - use this for counters instead of get-then-set. A key that does
   * not exist yet starts from 0. Rejects non-numeric stored values.
   */
  increment(key: string, amount?: number): Promise<number>;
  /** Removes one key. Subscribers receive null. */
  delete(key: string): Promise<void>;
  /**
   * Fires callback whenever ANY channel-state key changes - your own writes,
   * other widgets', or the server's (sys. keys included). Safe to register
   * anywhere; in the editor preview it simply never fires. Returns an
   * unsubscribe function.
   */
  onChange(callback: (key: string, value: any | null, updatedAt: string | null) => void): () => void;
  /** Like onChange, filtered to one key. Returns an unsubscribe function. */
  subscribe(key: string, callback: (value: any | null, updatedAt: string | null) => void): () => void;
}

interface TwitchBadgeImage {
  url_1x: string;
  url_2x: string;
  url_4x: string;
  title: string;
  description: string;
}

/** set_id -> version -> image. The channel's own badges override global ones. */
type TwitchBadgeMap = Record<string, Record<string, TwitchBadgeImage>>;

interface TwitchCheermoteTier {
  min_bits: number;
  id: string;
  color: string;
  /** theme -> format -> scale -> url, e.g. images.dark.animated["4"]. */
  images: Record<string, Record<string, Record<string, string>>>;
}

/** Lowercased prefix -> tiers, sorted by min_bits descending. */
type TwitchCheermoteMap = Record<string, { prefix: string; tiers: TwitchCheermoteTier[] }>;

interface TwitchPublicUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
}

interface TwitchPublicGame {
  id: string;
  name: string;
  /** Template URL - replace {width} and {height} before using it. */
  box_art_url: string;
}

interface TwitchStreamInfo {
  is_live: boolean;
  viewer_count: number;
  game_id: string | null;
  game_name: string | null;
  title: string | null;
  started_at: string | null;
  thumbnail_url: string | null;
}

interface TwitchThirdPartyEmote {
  id: string;
  name: string;
  provider: "7tv" | "bttv" | "ffz";
  url_1x: string;
  url_2x: string;
  url_4x: string;
}

/**
 * Twitch lookups. EventSub payloads carry ids, not pictures - this turns an id
 * into a URL without the widget ever holding a Twitch credential.
 *
 * Two kinds of call, and the difference matters:
 *
 * - Assets (badges, cheermotes, users, game, emotes) are cached server-side and
 *   memoised in the page. Cheap to call, safe to call often.
 * - Live values (followerTotal, subTotal, stream) are never cached anywhere.
 *   Every call is a fresh read, so a goal widget that reloads mid-stream comes
 *   back with the true number.
 *
 * Only available when the widget is placed on an overlay - throws in the
 * editor preview.
 */
interface StreamWizardTwitchApi {
  /** Base URL of the raw lookup API; prefer the methods below. */
  twitchUrl: string | null;
  /**
   * Fetches the badge and cheermote maps and keeps them for badgeUrl() and
   * cheermoteUrl(). Call once at load, then render each message synchronously.
   */
  ready(): Promise<{ badges: TwitchBadgeMap; cheermotes: TwitchCheermoteMap }>;
  badges(): Promise<TwitchBadgeMap>;
  cheermotes(): Promise<TwitchCheermoteMap>;
  /** Batched and memoised per id - repeat chatters cost no request. */
  users(ids: string[]): Promise<Record<string, TwitchPublicUser>>;
  user(id: string): Promise<TwitchPublicUser | undefined>;
  game(id: string): Promise<TwitchPublicGame | null>;
  thirdPartyEmotes(provider: "7tv" | "bttv" | "ffz"): Promise<Record<string, TwitchThirdPartyEmote>>;
  /**
   * Current follower total, read fresh. Pattern: fetch at load, adjust from
   * events, and re-fetch every minute or so - events can drop or replay across
   * a reconnect, so an only-incremented counter drifts.
   */
  followerTotal(): Promise<number>;
  /** Current subscriber total, read fresh. Same pattern as followerTotal. */
  subTotal(): Promise<number>;
  /** Live stream state including viewer_count, read fresh. */
  stream(): Promise<TwitchStreamInfo>;
  /**
   * Resolves an EventSub badges[] entry to an image URL. Synchronous, no
   * network - requires ready() (or badges()) to have resolved first.
   */
  badgeUrl(badge: { set_id: string; id: string }, scale?: "1x" | "2x" | "4x"): string | undefined;
  /**
   * Resolves a message fragment's .cheermote to an image URL. Synchronous, no
   * network - requires ready() (or cheermotes()) to have resolved first.
   */
  cheermoteUrl(
    cheermote: { prefix: string; bits: number; tier: number },
    options?: { theme?: "dark" | "light"; format?: "animated" | "static"; scale?: "1" | "1.5" | "2" | "3" | "4" }
  ): string | undefined;
}

interface StreamWizardGlobal {
  /** Base URL of the raw state API; prefer StreamWizard.state.get/set. */
  stateUrl: string | null;
  /** Base URL of the raw channel-state API; prefer StreamWizard.userState. */
  userStateUrl: string | null;
  /** Set from onWidgetLoad; null until then or in the editor preview. */
  session: StreamWizardSession | null;
  /** This widget instance's own private state. */
  state: StreamWizardStateApi;
  /** Channel-wide state, shared with other widgets and the server. */
  userState: StreamWizardUserStateApi;
  twitch: StreamWizardTwitchApi;
}

declare const StreamWizard: StreamWizardGlobal;

interface Window {
  StreamWizard: StreamWizardGlobal;
}
`;

/** All hand-written extra libs, ready to feed to Monaco alongside the generated event catalog. */
export const WIDGET_EDITOR_LIB_DECLARATIONS = GSAP_DECLARATIONS + STREAMWIZARD_RUNTIME_DECLARATIONS;
