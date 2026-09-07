import { buildWidgetTestEvent, type WidgetTestEventType } from "@repo/schemas";
import {
  DEFAULT_GOOGLE_FONT_FAMILY,
  resolvedTextWidgetFontFamily,
  type GoogleFontFamily,
  type OverlayItemConfig,
} from "../../types";

// ─── Event types ────────────────────────────────────────────────────────────

/**
 * Alert categories a streamer can configure independently, grouped and ordered
 * the way the public /overlays catalog groups them so the marketing page and
 * the settings panel read as the same product.
 *
 * Six more events from that catalog are missing on purpose -- ban, VIP added,
 * mod added, both predictions and goal achieved each need an OAuth scope
 * StreamWizard does not request yet, so shipping them means re-consent for
 * every existing user. They are tracked separately.
 */
export const ALERT_EVENT_CATEGORIES = [
  {
    id: "community",
    label: "Community",
    events: ["follow", "redemption", "watch_streak", "modiversary"],
  },
  {
    // Everything paid lives here, subs included -- same call the catalog makes.
    id: "money",
    label: "Money",
    events: [
      "sub",
      "resub",
      "gift_sub",
      "community_gift",
      "gift_upgrade",
      "prime_upgrade",
      "pay_it_forward",
      "cheer",
      "bits_badge",
      "charity_donation",
      "hype_train_start",
      "hype_train_end",
    ],
  },
  {
    id: "channel",
    label: "Channel",
    events: [
      "raid",
      "shoutout_received",
      "shoutout_sent",
      "announcement",
      "ad_break",
      "poll_start",
      "poll_winner",
    ],
  },
] as const;

export type AlertEventCategoryId = (typeof ALERT_EVENT_CATEGORIES)[number]["id"];

export const ALERT_EVENT_TYPES = ALERT_EVENT_CATEGORIES.flatMap(
  (c) => c.events
) as unknown as readonly (typeof ALERT_EVENT_CATEGORIES)[number]["events"][number][];

export type AlertEventType = (typeof ALERT_EVENT_TYPES)[number];

export const ALERT_EVENT_LABELS: Record<AlertEventType, string> = {
  follow: "Follow",
  redemption: "Reward redeemed",
  watch_streak: "Watch streak",
  modiversary: "Modiversary",
  sub: "Sub",
  resub: "Resub",
  gift_sub: "Gift sub",
  community_gift: "Gift bomb",
  gift_upgrade: "Gift upgrade",
  prime_upgrade: "Prime upgrade",
  pay_it_forward: "Pay it forward",
  cheer: "Cheer",
  bits_badge: "Bits badge",
  charity_donation: "Charity donation",
  hype_train_start: "Hype train start",
  hype_train_end: "Hype train end",
  raid: "Raid",
  shoutout_received: "Shoutout received",
  shoutout_sent: "Shoutout sent",
  announcement: "Announcement",
  ad_break: "Ad break",
  poll_start: "Poll start",
  poll_winner: "Poll winner",
};

/**
 * What `{amount}` means per event (used for threshold labels and template
 * hints in the editor). `null` for the events Twitch sends no number with.
 */
export const ALERT_AMOUNT_LABELS: Record<AlertEventType, string | null> = {
  follow: null,
  redemption: "points",
  watch_streak: "streams",
  // Twitch documents the modiversary notice but ships no payload object with
  // it, so there is no year to put in {amount}.
  modiversary: null,
  sub: null,
  resub: "months",
  gift_sub: "lifetime gifts",
  community_gift: "subs",
  gift_upgrade: null,
  prime_upgrade: null,
  pay_it_forward: null,
  cheer: "bits",
  bits_badge: "bits",
  charity_donation: "donation size",
  hype_train_start: "level",
  hype_train_end: "level",
  raid: "viewers",
  shoutout_received: "viewers",
  shoutout_sent: "viewers",
  announcement: null,
  ad_break: "seconds",
  poll_start: null,
  poll_winner: "votes",
};

/**
 * What `{name}` holds per event. It is the viewer on most of them, but a poll
 * has no viewer and a raid's subject is the raider -- the editor has to say
 * which, or half these templates read like a bug.
 */
export const ALERT_NAME_LABELS: Record<AlertEventType, string> = {
  follow: "the viewer",
  redemption: "the viewer",
  watch_streak: "the viewer",
  modiversary: "the mod",
  sub: "the viewer",
  resub: "the viewer",
  gift_sub: "the gifter",
  community_gift: "the gifter",
  gift_upgrade: "the viewer",
  prime_upgrade: "the viewer",
  pay_it_forward: "the viewer",
  cheer: "the viewer",
  bits_badge: "the viewer",
  charity_donation: "the donor",
  hype_train_start: "the top contributor",
  hype_train_end: "the top contributor",
  raid: "the raider",
  shoutout_received: "who shouted you out",
  shoutout_sent: "who you shouted out",
  announcement: "who announced it",
  ad_break: "your channel",
  poll_start: "the poll question",
  poll_winner: "the winning choice",
};

/**
 * The alerts that are on out of the box: the set every other alert provider
 * ships as standard. Everything else is off until the streamer turns it on.
 *
 * Two reasons. A new box should behave like the one a streamer is switching
 * from, not fire an ad-break notice nobody asked for. And a saved config from
 * before these events existed has no `enabled` for them, so it falls through
 * to this default -- an upgrade must not start firing sixteen new alerts at a
 * live stream.
 */
export const ALERT_DEFAULT_ON_EVENTS: readonly AlertEventType[] = [
  "follow",
  "sub",
  "resub",
  "gift_sub",
  "community_gift",
  "cheer",
  "raid",
];

/** Events whose payload carries something the viewer typed, for `{message}`. */
export const ALERT_MESSAGE_EVENTS: readonly AlertEventType[] = [
  "cheer",
  "resub",
  "announcement",
  "charity_donation",
  "redemption",
];

/**
 * Events that fill `{gifter}` with the ORIGINAL gifter's name. Both are gift
 * chains: the payload names who gave the sub being continued or passed on.
 */
export const ALERT_GIFTER_EVENTS: readonly AlertEventType[] = [
  "pay_it_forward",
  "gift_upgrade",
];

/**
 * Events that fill the `detail` field, and the token that reads it. One field,
 * two names: only ever one of them applies to a given event, and `{reward}` on
 * a charity alert would read like a bug.
 */
export const ALERT_DETAIL_TOKENS: Partial<Record<AlertEventType, "reward" | "charity">> = {
  redemption: "reward",
  charity_donation: "charity",
};

// ─── Config ─────────────────────────────────────────────────────────────────

export const ALERT_MEDIA_KINDS = ["", "image", "video"] as const;
export type AlertMediaKind = (typeof ALERT_MEDIA_KINDS)[number];

export const ALERT_DURATION_MODES = ["fixed", "media"] as const;
/** fixed: `durationSeconds` on screen · media: as long as the video itself runs */
export type AlertDurationMode = (typeof ALERT_DURATION_MODES)[number];

export const ALERT_LAYOUTS = ["stacked", "row", "overlay"] as const;
/** stacked: media above text · row: media beside text · overlay: text over media */
export type AlertLayout = (typeof ALERT_LAYOUTS)[number];

export const ALERT_ANIMATIONS_IN = [
  "fade",
  "slide_up",
  "slide_down",
  "zoom",
  "bounce",
] as const;
export type AlertAnimationIn = (typeof ALERT_ANIMATIONS_IN)[number];

export const ALERT_ANIMATIONS_OUT = ["fade", "slide_down", "zoom"] as const;
export type AlertAnimationOut = (typeof ALERT_ANIMATIONS_OUT)[number];

/** Everything about one alert type — media, copy, timing and look & feel. */
export interface AlertVariantConfig {
  enabled: boolean;
  /** CDN URL from the media library. Empty = no media. */
  mediaUrl: string;
  mediaKind: AlertMediaKind;
  /** CDN URL from the media library. Empty = no sound. */
  soundUrl: string;
  /** 0–1. Applies to both the sound file and video audio for this event. */
  volume: number;
  /** e.g. `{name} just followed!` */
  titleTemplate: string;
  /** Secondary line; empty = hidden. `{message}` shows the viewer's message. */
  messageTemplate: string;
  /** Seconds on screen. Ignored while `durationMode` is `media`. */
  durationSeconds: number;
  /**
   * `media` holds the alert for the video's own length instead of
   * `durationSeconds`, and falls back to it when there is no video or its
   * length never resolves.
   */
  durationMode: AlertDurationMode;
  /** Minimum bits / viewers / gifts / months before this alert fires. 0 = all. */
  minAmount: number;

  layout: AlertLayout;
  animationIn: AlertAnimationIn;
  animationOut: AlertAnimationOut;

  fontFamily: GoogleFontFamily;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  align: "left" | "center" | "right";
  titleColor: string;
  messageColor: string;
  /** Highlights `{name}` and `{amount}` inside the title. */
  accentColor: string;
  textShadow: boolean;
}

export interface AlertWidgetItemConfig {
  /** Quiet gap between queued alerts. */
  gapSeconds: number;
  /** Master volume 0–1, multiplied with each variant's volume. */
  masterVolume: number;

  variants: Record<AlertEventType, AlertVariantConfig>;
}

export const DEFAULT_ALERT_VARIANT_TITLES: Record<AlertEventType, string> = {
  follow: "{name} just followed!",
  redemption: "{name} redeemed {reward}!",
  watch_streak: "{name} is on a {amount} stream watch streak!",
  modiversary: "{name} is celebrating their modiversary!",
  sub: "{name} just subscribed!",
  resub: "{name} subscribed for {amount} months in a row!",
  // A lone gift to one viewer. Gift bombs are `community_gift`.
  gift_sub: "{name} gifted a sub!",
  community_gift: "{name} is gifting {amount} subs to the community!",
  gift_upgrade: "{name} is continuing {gifter}'s gift sub!",
  prime_upgrade: "{name} converted their Prime sub to Tier 1!",
  pay_it_forward: "{name} is paying {gifter}'s gift sub forward!",
  cheer: "{name} cheered {amount} bits!",
  bits_badge: "{name} just earned the {amount} bits badge!",
  charity_donation: "{name} donated {amount} to {charity}!",
  hype_train_start: "{name} started a hype train!",
  hype_train_end: "Hype train ended at level {amount}!",
  raid: "{name} is raiding with {amount} viewers!",
  shoutout_received: "{name} shouted you out to {amount} viewers!",
  shoutout_sent: "Go follow {name}.",
  announcement: "{name} made an announcement",
  ad_break: "Ads for {amount} seconds. Stretch.",
  poll_start: "New poll: {name}",
  poll_winner: "{name} won the poll with {amount} votes!",
};

const DEFAULT_ALERT_VARIANT_MESSAGES: Record<AlertEventType, string> = {
  follow: "",
  redemption: "{message}",
  watch_streak: "",
  modiversary: "",
  sub: "",
  resub: "{message}",
  gift_sub: "",
  community_gift: "",
  gift_upgrade: "",
  prime_upgrade: "",
  pay_it_forward: "",
  cheer: "{message}",
  bits_badge: "",
  charity_donation: "{message}",
  hype_train_start: "",
  hype_train_end: "",
  raid: "",
  shoutout_received: "",
  shoutout_sent: "",
  announcement: "{message}",
  ad_break: "",
  poll_start: "",
  poll_winner: "",
};

export function createDefaultAlertVariantConfig(
  event: AlertEventType
): AlertVariantConfig {
  return {
    enabled: ALERT_DEFAULT_ON_EVENTS.includes(event),
    mediaUrl: "",
    mediaKind: "",
    soundUrl: "",
    volume: 0.8,
    titleTemplate: DEFAULT_ALERT_VARIANT_TITLES[event],
    messageTemplate: DEFAULT_ALERT_VARIANT_MESSAGES[event],
    durationSeconds: 6,
    durationMode: "fixed",
    minAmount: 0,
    layout: "stacked",
    animationIn: "zoom",
    animationOut: "fade",
    fontFamily: DEFAULT_GOOGLE_FONT_FAMILY,
    fontSize: 32,
    fontWeight: 700,
    align: "center",
    titleColor: "#ffffff",
    messageColor: "#d4d4d8",
    accentColor: "#9e7aff",
    textShadow: true,
  };
}

export function createDefaultAlertWidgetConfig(): AlertWidgetItemConfig {
  return {
    gapSeconds: 1,
    masterVolume: 0.8,
    variants: Object.fromEntries(
      ALERT_EVENT_TYPES.map((e) => [e, createDefaultAlertVariantConfig(e)])
    ) as Record<AlertEventType, AlertVariantConfig>,
  };
}

/** What `gift_sub` defaulted to while it also covered gift bombs. */
const LEGACY_GIFT_BOMB_TITLE = "{name} gifted {amount} subs!";

const clamp01 = (n: unknown, fallback: number) =>
  typeof n === "number" && Number.isFinite(n)
    ? Math.min(1, Math.max(0, n))
    : fallback;

const oneOf = <T extends string>(
  options: readonly string[],
  value: unknown,
  fallback: T
): T => ((options as readonly string[]).includes(value as string) ? (value as T) : fallback);

/**
 * Look & feel used to live on the widget instead of per event type. Older saved
 * configs still carry it there, so each variant inherits those values as its
 * base before its own overrides apply.
 */
function variantBaseFromLegacy(
  event: AlertEventType,
  legacy: Record<string, unknown>
): AlertVariantConfig {
  const base = createDefaultAlertVariantConfig(event);
  return {
    ...base,
    mediaUrl: typeof legacy.mediaUrl === "string" ? legacy.mediaUrl : base.mediaUrl,
    mediaKind:
      legacy.mediaKind === "image" || legacy.mediaKind === "video"
        ? legacy.mediaKind
        : base.mediaKind,
    soundUrl: typeof legacy.soundUrl === "string" ? legacy.soundUrl : base.soundUrl,
    durationSeconds:
      typeof legacy.durationSeconds === "number" && Number.isFinite(legacy.durationSeconds)
        ? Math.min(60, Math.max(1, Math.round(legacy.durationSeconds)))
        : base.durationSeconds,
    layout: oneOf(ALERT_LAYOUTS, legacy.layout, base.layout),
    animationIn: oneOf(ALERT_ANIMATIONS_IN, legacy.animationIn, base.animationIn),
    animationOut: oneOf(ALERT_ANIMATIONS_OUT, legacy.animationOut, base.animationOut),
    fontFamily:
      typeof legacy.fontFamily === "string"
        ? resolvedTextWidgetFontFamily(legacy as { fontFamily?: string })
        : base.fontFamily,
    fontSize:
      typeof legacy.fontSize === "number" && legacy.fontSize >= 8 && legacy.fontSize <= 200
        ? Math.round(legacy.fontSize)
        : base.fontSize,
    fontWeight:
      legacy.fontWeight === 400 ||
      legacy.fontWeight === 500 ||
      legacy.fontWeight === 600 ||
      legacy.fontWeight === 700
        ? legacy.fontWeight
        : base.fontWeight,
    align: oneOf(["left", "center", "right"], legacy.align, base.align),
    titleColor: typeof legacy.titleColor === "string" ? legacy.titleColor : base.titleColor,
    messageColor:
      typeof legacy.messageColor === "string" ? legacy.messageColor : base.messageColor,
    accentColor:
      typeof legacy.accentColor === "string" ? legacy.accentColor : base.accentColor,
    textShadow:
      typeof legacy.textShadow === "boolean" ? legacy.textShadow : base.textShadow,
  };
}

function normalizeAlertVariant(
  raw: unknown,
  event: AlertEventType,
  legacy: Record<string, unknown> = {}
): AlertVariantConfig {
  const base = variantBaseFromLegacy(event, legacy);
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<AlertVariantConfig> & Record<string, unknown>;
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : base.enabled,
    // Media is per event now; an empty variant URL means "no media", except on
    // legacy configs where the shared media becomes this variant's base.
    mediaUrl: typeof r.mediaUrl === "string" && r.mediaUrl ? r.mediaUrl : base.mediaUrl,
    mediaKind:
      typeof r.mediaUrl === "string" && r.mediaUrl
        ? r.mediaKind === "image" || r.mediaKind === "video"
          ? r.mediaKind
          : ""
        : base.mediaKind,
    soundUrl: typeof r.soundUrl === "string" && r.soundUrl ? r.soundUrl : base.soundUrl,
    volume: clamp01(r.volume, base.volume),
    titleTemplate:
      typeof r.titleTemplate === "string" && r.titleTemplate.length <= 200
        ? r.titleTemplate
        : base.titleTemplate,
    messageTemplate:
      typeof r.messageTemplate === "string" && r.messageTemplate.length <= 200
        ? r.messageTemplate
        : base.messageTemplate,
    // 0 used to mean "inherit the widget duration" — keep those alerts sane.
    durationSeconds:
      typeof r.durationSeconds === "number" &&
      Number.isFinite(r.durationSeconds) &&
      r.durationSeconds > 0
        ? Math.min(60, Math.max(1, Math.round(r.durationSeconds)))
        : base.durationSeconds,
    durationMode: oneOf(ALERT_DURATION_MODES, r.durationMode, base.durationMode),
    minAmount:
      typeof r.minAmount === "number" && Number.isFinite(r.minAmount)
        ? Math.max(0, Math.round(r.minAmount))
        : base.minAmount,
    layout: oneOf(ALERT_LAYOUTS, r.layout, base.layout),
    animationIn: oneOf(ALERT_ANIMATIONS_IN, r.animationIn, base.animationIn),
    animationOut: oneOf(ALERT_ANIMATIONS_OUT, r.animationOut, base.animationOut),
    fontFamily:
      typeof r.fontFamily === "string"
        ? resolvedTextWidgetFontFamily(r as { fontFamily?: string })
        : base.fontFamily,
    fontSize:
      typeof r.fontSize === "number" && r.fontSize >= 8 && r.fontSize <= 200
        ? Math.round(r.fontSize)
        : base.fontSize,
    fontWeight:
      r.fontWeight === 400 ||
      r.fontWeight === 500 ||
      r.fontWeight === 600 ||
      r.fontWeight === 700
        ? r.fontWeight
        : base.fontWeight,
    align: oneOf(["left", "center", "right"], r.align, base.align),
    titleColor: typeof r.titleColor === "string" ? r.titleColor : base.titleColor,
    messageColor:
      typeof r.messageColor === "string" ? r.messageColor : base.messageColor,
    accentColor:
      typeof r.accentColor === "string" ? r.accentColor : base.accentColor,
    textShadow: typeof r.textShadow === "boolean" ? r.textShadow : base.textShadow,
  };
}

/** Coerce persisted / partial config to a complete, safe shape. */
export function normalizeAlertWidgetConfig(
  config: OverlayItemConfig | Record<string, unknown> | null | undefined
): AlertWidgetItemConfig {
  const base = createDefaultAlertWidgetConfig();
  if (!config || typeof config !== "object") return base;
  const r = config as Partial<AlertWidgetItemConfig> & Record<string, unknown>;

  const variantsRaw = (r.variants ?? {}) as Record<string, unknown>;

  /*
   * `gift_sub` used to cover gift bombs as well: it was driven by
   * channel.subscription.gift, whose `total` is the whole bomb. Bombs are
   * their own alert now, so a saved gift_sub holds the streamer's bomb media,
   * sound and wording -- hand that to community_gift instead of dropping it,
   * and put gift_sub back on its single-gift default if it was never edited
   * off the old shared one.
   */
  const giftSubRaw = variantsRaw.gift_sub;
  const legacyGiftSub =
    giftSubRaw && typeof giftSubRaw === "object"
      ? (giftSubRaw as Record<string, unknown>)
      : null;
  const rawFor = (event: AlertEventType): unknown => {
    if (event === "community_gift") return variantsRaw.community_gift ?? giftSubRaw;
    if (
      event === "gift_sub" &&
      legacyGiftSub &&
      variantsRaw.community_gift === undefined &&
      legacyGiftSub.titleTemplate === LEGACY_GIFT_BOMB_TITLE
    ) {
      return { ...legacyGiftSub, titleTemplate: DEFAULT_ALERT_VARIANT_TITLES.gift_sub };
    }
    return variantsRaw[event];
  };

  return {
    gapSeconds:
      typeof r.gapSeconds === "number" && Number.isFinite(r.gapSeconds)
        ? Math.min(30, Math.max(0, Math.round(r.gapSeconds)))
        : base.gapSeconds,
    masterVolume: clamp01(r.masterVolume, base.masterVolume),
    variants: Object.fromEntries(
      ALERT_EVENT_TYPES.map((e) => [
        e,
        normalizeAlertVariant(rawFor(e), e, r as Record<string, unknown>),
      ])
    ) as Record<AlertEventType, AlertVariantConfig>,
  };
}

// ─── Incoming event mapping ─────────────────────────────────────────────────

/** Normalized alert instance the renderer plays. */
export interface AlertInstance {
  event: AlertEventType;
  name: string;
  /** bits / viewers / gifts / months / …; 0 when the event has no amount. */
  amount: number;
  /**
   * What `{amount}` prints when the raw number would read wrong -- a charity
   * donation is "$25.00", not "25". Empty means "print `amount`". Thresholds
   * still compare against `amount`, so a minimum stays a plain number.
   */
  amountText: string;
  /** Viewer-typed message (cheer / resub / announcement / …); empty otherwise. */
  message: string;
  /** The ORIGINAL gifter on a gift chain; empty when anonymous or n/a. */
  gifter: string;
  /** Reward title or charity name — read by `{reward}` / `{charity}`. */
  detail: string;
}

/** An anonymous gifter has no name in the payload; the alert still needs one. */
const ANONYMOUS_GIFTER = "an anonymous gifter";

function baseInstance(event: AlertEventType, name: string): AlertInstance {
  return { event, name, amount: 0, amountText: "", message: "", gifter: "", detail: "" };
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Twitch sends money as minor units plus a decimal place count and a currency. */
function formatCurrency(amount: Record<string, unknown>): { value: number; text: string } {
  const places = num(amount.decimal_places);
  const value = num(amount.value) / 10 ** places;
  const currency = str(amount.currency) || "USD";
  try {
    return {
      value,
      text: new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value),
    };
  } catch {
    // Intl throws on a currency code it doesn't know. Still show the number.
    return { value, text: `${value.toFixed(places)} ${currency}` };
  }
}

/**
 * The gifter name off a pay_it_forward / gift_paid_upgrade block. Both fields
 * are nullable and anonymity is its own flag, so the fallback is not optional.
 */
function gifterName(block: Record<string, unknown> | null): string {
  if (!block) return ANONYMOUS_GIFTER;
  if (block.gifter_is_anonymous === true) return ANONYMOUS_GIFTER;
  return str(block.gifter_user_name) || ANONYMOUS_GIFTER;
}

/**
 * Map a `channel.chat.notification` payload to an alert instance.
 *
 * This subscription is the source of truth for every celebration it carries,
 * including the ones that also arrive on a dedicated subscription (sub, resub,
 * sub_gift, community_sub_gift, raid) -- those dedicated types are skipped
 * below so nothing fires twice. One notice type, one alert.
 */
function alertInstanceFromChatNotice(p: Record<string, unknown>): AlertInstance | null {
  const noticeType = str(p.notice_type);

  /*
   * During a shared chat session Twitch relays the other channel's notices
   * into this one. Firing them would celebrate someone else's subs on your
   * overlay, so both the relayed subtypes and anything flagged source-only are
   * dropped.
   */
  if (noticeType.startsWith("shared_chat_") || p.is_source_only === true) return null;

  const chatter = p.chatter_is_anonymous === true ? "Anonymous" : str(p.chatter_user_name);
  const message = str((p.message as Record<string, unknown> | undefined)?.text);
  const block = (key: string) => (p[key] ?? null) as Record<string, unknown> | null;

  switch (noticeType) {
    case "sub":
      return baseInstance("sub", chatter);
    case "resub": {
      const resub = block("resub");
      return {
        ...baseInstance("resub", chatter),
        amount: num(resub?.cumulative_months),
        message,
      };
    }
    case "sub_gift": {
      const gift = block("sub_gift");
      // Every recipient of a gift bomb gets their own sub_gift notice, tagged
      // with the bomb's id. The bomb already fires as community_sub_gift, so a
      // 100-sub bomb must not also fire 100 single-gift alerts.
      if (gift?.community_gift_id) return null;
      return {
        ...baseInstance("gift_sub", chatter),
        amount: num(gift?.cumulative_total),
        detail: str(gift?.recipient_user_name),
      };
    }
    case "community_sub_gift": {
      const bomb = block("community_sub_gift");
      return { ...baseInstance("community_gift", chatter), amount: num(bomb?.total) };
    }
    case "gift_paid_upgrade":
      return {
        ...baseInstance("gift_upgrade", chatter),
        gifter: gifterName(block("gift_paid_upgrade")),
      };
    case "prime_paid_upgrade":
      return baseInstance("prime_upgrade", chatter);
    case "pay_it_forward":
      return {
        ...baseInstance("pay_it_forward", chatter),
        gifter: gifterName(block("pay_it_forward")),
      };
    case "raid": {
      const raid = block("raid");
      return {
        ...baseInstance("raid", str(raid?.user_name) || chatter),
        amount: num(raid?.viewer_count),
      };
    }
    case "announcement":
      return { ...baseInstance("announcement", chatter), message };
    case "bits_badge_tier": {
      const badge = block("bits_badge_tier");
      return { ...baseInstance("bits_badge", chatter), amount: num(badge?.tier) };
    }
    case "charity_donation": {
      const donation = block("charity_donation");
      const money = formatCurrency((donation?.amount ?? {}) as Record<string, unknown>);
      return {
        ...baseInstance("charity_donation", chatter),
        amount: money.value,
        amountText: money.text,
        message,
        detail: str(donation?.charity_name),
      };
    }
    case "watch_streak": {
      const streak = block("watch_streak");
      // Twitch names the field consecutive_months; it counts streams watched.
      return {
        ...baseInstance("watch_streak", chatter),
        amount: num(streak?.consecutive_months),
      };
    }
    case "modiversary":
      // No payload object exists for this notice, so there is no year to read.
      return baseInstance("modiversary", chatter);
    default:
      // unraid (a cancelled raid is nothing to celebrate), unknown, and any
      // notice type Twitch adds after this was written.
      return null;
  }
}

/**
 * Map a raw overlay socket message (EventSub shape) to an alert instance.
 * Returns null for message types the alert box doesn't handle.
 */
export function alertInstanceFromSocketMessage(msg: {
  type?: string;
  payload?: unknown;
}): AlertInstance | null {
  const p = (msg.payload ?? {}) as Record<string, unknown>;

  switch (msg.type) {
    case "channel.chat.notification":
      return alertInstanceFromChatNotice(p);

    // Subs, resubs, gifts and raids all arrive as chat notices too, with a
    // richer payload. The notice is the single source; these are dropped so
    // one celebration is one alert.
    case "channel.subscribe":
    case "channel.subscription.message":
    case "channel.subscription.gift":
    case "channel.raid":
      return null;

    case "channel.follow":
      return baseInstance("follow", str(p.user_name));

    case "channel.cheer":
      return {
        ...baseInstance(
          "cheer",
          p.is_anonymous === true ? "Anonymous" : str(p.user_name) || "Anonymous"
        ),
        amount: num(p.bits),
        message: str(p.message),
      };

    case "channel.channel_points_custom_reward_redemption.add": {
      const reward = (p.reward ?? {}) as Record<string, unknown>;
      return {
        ...baseInstance("redemption", str(p.user_name)),
        amount: num(reward.cost),
        message: str(p.user_input),
        detail: str(reward.title),
      };
    }

    case "channel.hype_train.begin":
    case "channel.hype_train.end": {
      const top = Array.isArray(p.top_contributions)
        ? (p.top_contributions[0] as Record<string, unknown> | undefined)
        : undefined;
      return {
        ...baseInstance(
          msg.type === "channel.hype_train.begin" ? "hype_train_start" : "hype_train_end",
          // Nobody starts a train alone: credit the top contributor when there
          // is one, and the crowd that did it when there isn't.
          str(top?.user_name) || "Chat"
        ),
        amount: num(p.level),
      };
    }

    case "channel.shoutout.receive":
      return {
        ...baseInstance("shoutout_received", str(p.from_broadcaster_user_name)),
        amount: num(p.viewer_count),
      };

    case "channel.shoutout.create":
      return {
        ...baseInstance("shoutout_sent", str(p.to_broadcaster_user_name)),
        amount: num(p.viewer_count),
      };

    case "channel.ad_break.begin":
      return {
        ...baseInstance("ad_break", str(p.broadcaster_user_name)),
        // Number(), not num(): this arrives as an integer, but Twitch's docs
        // described it as a string for long enough that the schema did too.
        // Parsing both costs nothing and beats an alert reading "0 seconds".
        amount: Math.round(Number(p.duration_seconds)) || 0,
      };

    case "channel.poll.begin":
      return baseInstance("poll_start", str(p.title));

    case "channel.poll.end": {
      // An archived or terminated poll has no winner worth announcing.
      if (p.status !== "completed") return null;
      const choices = Array.isArray(p.choices)
        ? (p.choices as Record<string, unknown>[])
        : [];
      const winner = choices.reduce<Record<string, unknown> | null>(
        (best, c) => (!best || num(c.votes) > num(best.votes) ? c : best),
        null
      );
      if (!winner) return null;
      return {
        ...baseInstance("poll_winner", str(winner.title)),
        amount: num(winner.votes),
      };
    }

    default:
      return null;
  }
}

/** What `{amount}` prints: the pre-formatted text when there is one. */
export function alertAmountText(alert: AlertInstance): string {
  return alert.amountText || String(alert.amount);
}

/** Renders every template token inside a title or message template. */
export function renderAlertTemplate(
  template: string,
  alert: AlertInstance
): string {
  return template
    .replaceAll("{name}", alert.name)
    .replaceAll("{amount}", alertAmountText(alert))
    .replaceAll("{message}", alert.message)
    .replaceAll("{gifter}", alert.gifter)
    .replaceAll("{reward}", alert.detail)
    .replaceAll("{charity}", alert.detail);
}

// ─── Test events ────────────────────────────────────────────────────────────

/** Why a configured variant would swallow an alert instead of playing it. */
export type AlertSkipReason = "disabled" | "below-minimum";

/**
 * The renderer's own gate, pulled out so a caller can ask the question before
 * firing a test. A test that lands on a switched-off alert looks identical to
 * a test that never arrived, so the editor needs to be able to say which.
 */
export function alertSkipReason(
  alert: AlertInstance,
  variant: AlertVariantConfig
): AlertSkipReason | null {
  if (!variant.enabled) return "disabled";
  if (variant.minAmount > 0 && alert.amount < variant.minAmount) return "below-minimum";
  return null;
}

/**
 * Maps a configurable alert category onto the event that drives it. Most are a
 * subscription type on their own; the dozen chat notices share
 * `channel.chat.notification` and pick their notice type with `variant`, the
 * same mechanism the geo demo uses for its two shapes.
 */
export const ALERT_EVENT_SUBSCRIPTION_TYPES: Record<
  AlertEventType,
  { type: WidgetTestEventType; variant?: string }
> = {
  follow: { type: "channel.follow" },
  redemption: { type: "channel.channel_points_custom_reward_redemption.add" },
  watch_streak: { type: "channel.chat.notification", variant: "watch_streak" },
  modiversary: { type: "channel.chat.notification", variant: "modiversary" },
  sub: { type: "channel.chat.notification", variant: "sub" },
  // resub is the notification fixture's default build, not a variant.
  resub: { type: "channel.chat.notification" },
  gift_sub: { type: "channel.chat.notification", variant: "sub_gift" },
  community_gift: { type: "channel.chat.notification", variant: "community_sub_gift" },
  gift_upgrade: { type: "channel.chat.notification", variant: "gift_paid_upgrade" },
  prime_upgrade: { type: "channel.chat.notification", variant: "prime_paid_upgrade" },
  pay_it_forward: { type: "channel.chat.notification", variant: "pay_it_forward" },
  cheer: { type: "channel.cheer" },
  bits_badge: { type: "channel.chat.notification", variant: "bits_badge_tier" },
  charity_donation: { type: "channel.chat.notification", variant: "charity_donation" },
  hype_train_start: { type: "channel.hype_train.begin" },
  hype_train_end: { type: "channel.hype_train.end" },
  raid: { type: "channel.chat.notification", variant: "raid" },
  shoutout_received: { type: "channel.shoutout.receive" },
  shoutout_sent: { type: "channel.shoutout.create" },
  announcement: { type: "channel.chat.notification", variant: "announcement" },
  ad_break: { type: "channel.ad_break.begin" },
  poll_start: { type: "channel.poll.begin" },
  poll_winner: { type: "channel.poll.end" },
};

/**
 * Synthetic EventSub payload for a test alert. The message `type` matches the
 * real subscription type so custom widgets react to tests exactly like SE.
 * Used by the editor's local preview and the send-to-stream server action.
 *
 * Payloads live in `@repo/schemas` alongside every other test fixture, where a
 * test asserts each one still parses against its zod schema.
 */
export function buildTestAlertSocketMessage(
  event: AlertEventType,
  userName = "StreamWizard"
): { type: string; payload: Record<string, unknown> } {
  const { type, variant } = ALERT_EVENT_SUBSCRIPTION_TYPES[event];
  return buildWidgetTestEvent(type, { userName }, variant);
}

/**
 * Browser event the editor uses to fire a local-only test alert into canvas
 * previews (no server round-trip). detail: `{ sceneId, message }`.
 */
export const ALERT_TEST_BROWSER_EVENT = "streamwizard:test-alert";

export interface AlertTestBrowserEventDetail {
  sceneId: string;
  /**
   * The socket message to replay, already built. Carrying the message rather
   * than an `AlertEventType` lets the demo bar send any raw demo payload down
   * the same path -- one that isn't an alert simply maps to null.
   */
  message: { type: string; payload: Record<string, unknown> };
}
