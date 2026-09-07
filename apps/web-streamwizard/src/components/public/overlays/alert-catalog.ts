import { ALERTS, type DemoAlert } from "../home/overlay-demo-alert";

/*
 * The full 29-event alert catalog the playground cycles: the roadmap list from
 * SW-198's EventSub audit, grouped the way the tabs group them. The 15 events
 * the home demo already plays are picked from the shared ALERTS list by kind,
 * so their wording exists exactly once; the 14 others are demo entries in the
 * same shape, with the same cast. The home bento stays on the shared 15 on
 * purpose: its card has no room for 29 chips.
 */

export type AlertCategoryId = "community" | "money" | "channel" | "moderation";

export interface AlertCategory {
  id: AlertCategoryId;
  label: string;
  alerts: DemoAlert[];
}

const byKind = new Map(ALERTS.map((a) => [a.kind, a]));

/** An entry from the shared home-demo list; throws at module load if the kind drifts. */
function shared(kind: string): DemoAlert {
  const alert = byKind.get(kind);
  if (!alert) throw new Error(`Alert catalog references unknown shared alert kind: ${kind}`);
  return alert;
}

const REDEMPTION: DemoAlert = {
  kind: "Redemption",
  name: "ninetoad",
  rest: " redeemed Hydrate for 500 points!",
  message: "glug glug",
  anim: "zoom",
  template: "{name} redeemed {amount} points!",
  messageTemplate: "{message}",
  media: "redeem.webm",
};

const HYPE_TRAIN_START: DemoAlert = {
  kind: "Hype train start",
  name: "Chat",
  rest: " started a hype train!",
  anim: "bounce",
  template: "{name} started a hype train!",
  media: "train.webm",
};

const HYPE_TRAIN_END: DemoAlert = {
  kind: "Hype train end",
  name: "Chat",
  rest: " pushed the hype train to level 4!",
  anim: "zoom",
  template: "Hype train ended at level {amount}!",
  media: "train-end.webm",
};

const SHOUTOUT_RECEIVED: DemoAlert = {
  kind: "Shoutout received",
  name: "xpudu",
  rest: " shouted you out to 860 viewers!",
  anim: "bounce",
  template: "{name} shouted you out to {amount} viewers!",
  media: "shoutout.webm",
};

const SHOUTOUT_SENT: DemoAlert = {
  kind: "Shoutout sent",
  name: "sandwichlord",
  rest: " deserves a follow. Go.",
  anim: "slide_up",
  template: "Go follow {name}.",
  media: "so.webm",
};

const AD_BREAK: DemoAlert = {
  kind: "Ad break",
  name: "Ads",
  rest: " for 60 seconds. Stretch.",
  anim: "fade",
  template: "Ads for {amount} seconds. Stretch.",
  media: "ads.webm",
};

const POLL_START: DemoAlert = {
  kind: "Poll start",
  name: "New poll",
  rest: ": aren't shoes just hard socks?",
  message: "vote in chat",
  anim: "slide_up",
  template: "New poll: vote in chat",
  messageTemplate: "{message}",
  media: "poll.webm",
};

const POLL_WINNER: DemoAlert = {
  kind: "Poll winner",
  name: "Hard socks",
  rest: " won the poll with 140 votes!",
  anim: "zoom",
  template: "{name} won the poll with {amount} votes!",
  media: "poll-win.webm",
};

const PREDICTION_START: DemoAlert = {
  kind: "Prediction start",
  name: "Prediction",
  rest: " open: clutch or throw?",
  anim: "slide_down",
  template: "Prediction open: place your points",
  media: "prediction.webm",
};

const PREDICTION_RESULT: DemoAlert = {
  kind: "Prediction result",
  name: "Clutch",
  rest: " believers win 15,000 points!",
  anim: "bounce",
  template: "{name} wins the prediction!",
  media: "prediction-win.webm",
};

const GOAL_ACHIEVED: DemoAlert = {
  kind: "Goal achieved",
  name: "Sub goal",
  rest: " hit: 220 of 220!",
  anim: "zoom",
  template: "{name} hit: {amount}!",
  media: "goal.webm",
};

const BAN: DemoAlert = {
  kind: "Ban",
  name: "trollbot9000",
  rest: " met the banhammer.",
  anim: "slide_down",
  template: "{name} met the banhammer.",
  media: "hammer.webm",
};

const VIP_ADDED: DemoAlert = {
  kind: "VIP added",
  name: "toastcrumb",
  rest: " is a VIP now!",
  anim: "zoom",
  template: "{name} is a VIP now!",
  media: "vip.webm",
};

const MOD_ADDED: DemoAlert = {
  kind: "Mod added",
  name: "ninetoad",
  rest: " has the sword now.",
  anim: "bounce",
  template: "{name} has the sword now.",
  media: "mod.webm",
};

export const ALERT_CATALOG: AlertCategory[] = [
  {
    id: "community",
    label: "Community",
    alerts: [shared("Follow"), REDEMPTION, shared("Watch streak"), shared("Modiversary")],
  },
  {
    // Everything paid lives here, subs included: user's call.
    id: "money",
    label: "Money",
    alerts: [
      shared("Sub"),
      shared("Resub"),
      shared("Gift sub"),
      shared("Community gift"),
      shared("Gift upgrade"),
      shared("Prime upgrade"),
      shared("Pay it forward"),
      shared("Cheer"),
      shared("Bits badge"),
      shared("Charity donation"),
      HYPE_TRAIN_START,
      HYPE_TRAIN_END,
    ],
  },
  {
    id: "channel",
    label: "Channel",
    alerts: [
      shared("Raid"),
      SHOUTOUT_RECEIVED,
      SHOUTOUT_SENT,
      shared("Announcement"),
      AD_BREAK,
      POLL_START,
      POLL_WINNER,
      PREDICTION_START,
      PREDICTION_RESULT,
      GOAL_ACHIEVED,
    ],
  },
  {
    id: "moderation",
    label: "Mod",
    alerts: [BAN, VIP_ADDED, MOD_ADDED],
  },
];

/** The catalog flattened in cycle order: community, money, channel, moderation. */
export const CATALOG_ALERTS: DemoAlert[] = ALERT_CATALOG.flatMap((c) => c.alerts);

/** Category id per flat index, aligned with CATALOG_ALERTS. */
export const CATEGORY_OF_INDEX: AlertCategoryId[] = ALERT_CATALOG.flatMap((c) =>
  c.alerts.map(() => c.id),
);

/*
 * Milestones: the amount-based variations SW-198 adds on top of the per-event
 * config. Each breakpoint is its own full alert in the real widget; the demo
 * shows that as different text and media per tier, with the top tier flagged
 * `boost` so the playground can draw it louder. `base: true` marks the tier
 * whose wording matches the shared ALERTS entry, so the auto-cycle sounds the
 * same here as on the home page until someone picks a tier.
 */

export interface AlertTier {
  label: string;
  rest: string;
  message?: string;
  media: string;
  /** Top tier: the playground draws this one louder. */
  boost?: boolean;
  /** The tier whose wording matches the shared ALERTS entry. */
  base?: boolean;
}

export const ALERT_TIERS: Record<string, AlertTier[]> = {
  Resub: [
    { label: "1 month", rest: " subscribed for 1 month!", message: "month one", media: "resub.webm" },
    {
      label: "6 months",
      rest: " subscribed for 6 months in a row!",
      message: "six months, still here",
      media: "resub-6.webm",
      base: true,
    },
    {
      label: "1 year",
      rest: " subscribed for a full year!",
      message: "twelve months of this",
      media: "resub-legend.webm",
      boost: true,
    },
  ],
  "Watch streak": [
    { label: "5 streams", rest: " is on a 5 stream watch streak!", media: "streak.webm", base: true },
    { label: "25 streams", rest: " is on a 25 stream watch streak!", media: "streak-25.webm" },
    { label: "100 streams", rest: " hit a 100 stream watch streak!", media: "streak-legend.webm", boost: true },
  ],
  Raid: [
    { label: "5 viewers", rest: " is raiding with 5 viewers!", media: "raid.webm" },
    { label: "42 viewers", rest: " is raiding with 42 viewers!", media: "raid.webm", base: true },
    { label: "500 viewers", rest: " is raiding with 500 viewers!", media: "raid-legend.webm", boost: true },
  ],
  Cheer: [
    { label: "100 bits", rest: " cheered 100 bits!", message: "hi", media: "cheer.webm" },
    { label: "500 bits", rest: " cheered 500 bits!", message: "drink some water", media: "cheer.webm", base: true },
    {
      label: "10k bits",
      rest: " cheered 10,000 bits!",
      message: "buy a better mic",
      media: "cheer-legend.webm",
      boost: true,
    },
  ],
  Modiversary: [
    { label: "1 year", rest: " has been a mod for 1 year!", media: "sword.webm", base: true },
    { label: "5 years", rest: " has been a mod for 5 years!", media: "sword-legend.webm", boost: true },
  ],
  "Community gift": [
    { label: "5 subs", rest: " is gifting 5 subs to the community!", media: "gift-bomb.webm", base: true },
    { label: "100 subs", rest: " is gifting 100 subs to the community!", media: "gift-nuke.webm", boost: true },
  ],
};

/** Index of the tier a kind starts on: the one matching the shared wording. */
export function defaultTierIndex(tiers: AlertTier[]): number {
  return Math.max(
    0,
    tiers.findIndex((t) => t.base),
  );
}
