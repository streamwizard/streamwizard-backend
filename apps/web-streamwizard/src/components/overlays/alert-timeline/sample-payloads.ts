/**
 * Named sample alerts for the timeline preview: a few shapes per event so a
 * streamer sees the small cheer and the 10,000-bit one, a message that wraps,
 * an anonymous gifter, every sub tier. Each one starts from the shared test
 * fixture (`buildTestAlertSocketMessage`) and edits the payload, so the tokens
 * come out of `alertInstanceFromSocketMessage` exactly as a real alert would.
 *
 * The chosen sample is editor session state; nothing here is stored.
 */

import {
  alertInstanceFromSocketMessage,
  alertTokensFromInstance,
  buildTestAlertSocketMessage,
  type AlertEventType,
} from "@repo/ui/overlay";

export interface AlertSocketMessage {
  type: string;
  payload: Record<string, unknown>;
}

type Payload = Record<string, unknown>;

export interface AlertSample {
  id: string;
  /** Shown in the chooser; says what is different about this one. */
  label: string;
  /** Display name of the fake viewer; the fixture default when omitted. */
  userName?: string;
  /** Edits the freshly built fixture payload in place. */
  patch?: (payload: Payload) => void;
}

export const DEFAULT_SAMPLE_ID = "default";

/** Long enough to wrap twice in a 600px alert and overflow a one-line box. */
export const LONG_NAME = "TheGreatSandwichLord_2024";
export const LONG_MESSAGE =
  "Been lurking since the first stream and finally caught one live. The clip where the chair broke mid-sentence lives rent-free in my head, keep doing what you do and drink some water!";

const LONG_TITLE = "A reward name so long it will wrap onto a second line in most alert boxes";
const LONG_QUESTION = "Is a hot dog a sandwich, a taco, or its own thing entirely and why is chat so angry about it?";

function chatText(payload: Payload, text: string): void {
  payload.message = { text, fragments: text ? [{ type: "text", text }] : [] };
}

function block(payload: Payload, key: string): Payload {
  const b = payload[key];
  if (!b || typeof b !== "object") throw new Error(`sample: fixture has no "${key}" block`);
  return b as Payload;
}

const ANONYMOUS_GIFTER_BLOCK = {
  gifter_is_anonymous: true,
  gifter_user_id: null,
  gifter_user_login: null,
  gifter_user_name: null,
};

const plain = (label: string): AlertSample => ({ id: DEFAULT_SAMPLE_ID, label });
const longName = (label = "Long name"): AlertSample => ({ id: "long-name", label, userName: LONG_NAME });

export const ALERT_SAMPLES: Record<AlertEventType, readonly AlertSample[]> = {
  follow: [plain("Follow"), longName()],
  redemption: [
    plain("Reward with a message"),
    {
      id: "long",
      label: "Long reward name, long message",
      patch: (p) => {
        p.user_input = LONG_MESSAGE;
        block(p, "reward").title = LONG_TITLE;
        block(p, "reward").cost = 50_000;
      },
    },
    { id: "no-message", label: "No message", patch: (p) => (p.user_input = "") },
  ],
  watch_streak: [
    plain("5 streams"),
    { id: "50", label: "50 streams", patch: (p) => (block(p, "watch_streak").consecutive_months = 50) },
  ],
  modiversary: [plain("Modiversary"), longName()],
  sub: [
    plain("Tier 1"),
    { id: "tier2", label: "Tier 2", patch: (p) => (block(p, "sub").sub_plan = "2000") },
    { id: "tier3", label: "Tier 3", patch: (p) => (block(p, "sub").sub_plan = "3000") },
    { id: "prime", label: "Prime", patch: (p) => (block(p, "sub").sub_plan = "Prime") },
  ],
  resub: [
    plain("6 months, Tier 1, message"),
    {
      id: "long",
      label: "36 months, Tier 3, long message",
      patch: (p) => {
        block(p, "resub").cumulative_months = 36;
        block(p, "resub").sub_plan = "3000";
        chatText(p, LONG_MESSAGE);
      },
    },
    {
      id: "no-message",
      label: "2 months, no message",
      patch: (p) => {
        block(p, "resub").cumulative_months = 2;
        chatText(p, "");
      },
    },
  ],
  gift_sub: [
    plain("Tier 1 gift"),
    { id: "tier3", label: "Tier 3 gift", patch: (p) => (block(p, "sub_gift").sub_plan = "3000") },
    { id: "100", label: "100 lifetime gifts", patch: (p) => (block(p, "sub_gift").cumulative_total = 100) },
    { id: "anonymous", label: "Anonymous gifter", patch: (p) => (p.chatter_is_anonymous = true) },
  ],
  community_gift: [
    plain("5 subs"),
    {
      id: "100",
      label: "100 subs, Tier 2",
      patch: (p) => {
        block(p, "community_sub_gift").total = 100;
        block(p, "community_sub_gift").sub_plan = "2000";
        block(p, "community_sub_gift").cumulative_total = 500;
      },
    },
    {
      id: "anonymous",
      label: "Anonymous, 20 subs",
      patch: (p) => {
        p.chatter_is_anonymous = true;
        block(p, "community_sub_gift").total = 20;
      },
    },
  ],
  gift_upgrade: [
    plain("Named gifter"),
    { id: "anonymous", label: "Anonymous gifter", patch: (p) => Object.assign(block(p, "gift_paid_upgrade"), ANONYMOUS_GIFTER_BLOCK) },
    longName(),
  ],
  prime_upgrade: [
    plain("Tier 1"),
    { id: "tier3", label: "Tier 3", patch: (p) => (block(p, "prime_paid_upgrade").sub_plan = "3000") },
  ],
  pay_it_forward: [
    plain("Named gifter"),
    { id: "anonymous", label: "Anonymous gifter", patch: (p) => Object.assign(block(p, "pay_it_forward"), ANONYMOUS_GIFTER_BLOCK) },
    longName(),
  ],
  cheer: [
    plain("500 bits, message"),
    {
      id: "big",
      label: "10,000 bits, long message",
      patch: (p) => {
        p.bits = 10_000;
        p.message = LONG_MESSAGE;
      },
    },
    {
      id: "small",
      label: "1 bit, no message",
      patch: (p) => {
        p.bits = 1;
        p.message = "";
      },
    },
    {
      id: "anonymous",
      label: "Anonymous, 250 bits",
      patch: (p) => {
        p.is_anonymous = true;
        p.bits = 250;
      },
    },
  ],
  bits_badge: [
    plain("10,000 bits badge"),
    { id: "1000", label: "1,000 bits badge", patch: (p) => (block(p, "bits_badge_tier").tier = 1000) },
    { id: "100000", label: "100,000 bits badge", patch: (p) => (block(p, "bits_badge_tier").tier = 100_000) },
  ],
  charity_donation: [
    plain("$25.00, message"),
    {
      id: "big",
      label: "$1,000.00, long message",
      patch: (p) => {
        block(p, "charity_donation").amount = { value: 100_000, decimal_places: 2, currency: "USD" };
        chatText(p, LONG_MESSAGE);
      },
    },
    {
      id: "eur",
      label: "€5.00, no message",
      patch: (p) => {
        block(p, "charity_donation").amount = { value: 500, decimal_places: 2, currency: "EUR" };
        chatText(p, "");
      },
    },
  ],
  hype_train_start: [plain("Level 1"), { id: "5", label: "Level 5", patch: (p) => (p.level = 5) }],
  hype_train_end: [plain("Level 4"), { id: "5", label: "Level 5", patch: (p) => (p.level = 5) }],
  raid: [
    plain("42 viewers"),
    { id: "big", label: "1,500 viewers", patch: (p) => (block(p, "raid").viewer_count = 1500) },
    { id: "one", label: "1 viewer", patch: (p) => (block(p, "raid").viewer_count = 1) },
    { ...longName(), patch: (p) => (block(p, "raid").user_name = LONG_NAME) },
  ],
  shoutout_received: [plain("128 viewers"), { id: "big", label: "4,200 viewers", patch: (p) => (p.viewer_count = 4200) }],
  shoutout_sent: [plain("128 viewers"), { id: "big", label: "4,200 viewers", patch: (p) => (p.viewer_count = 4200) }],
  announcement: [plain("Short announcement"), { id: "long", label: "Long announcement", patch: (p) => chatText(p, LONG_MESSAGE) }],
  ad_break: [
    plain("60 seconds"),
    { id: "30", label: "30 seconds", patch: (p) => (p.duration_seconds = 30) },
    { id: "180", label: "180 seconds", patch: (p) => (p.duration_seconds = 180) },
  ],
  poll_start: [plain("Short question"), { id: "long", label: "Long question", patch: (p) => (p.title = LONG_QUESTION) }],
  poll_winner: [
    plain("140 votes"),
    { id: "big", label: "9,999 votes", patch: (p) => ((p.choices as Payload[])[0]!.votes = 9999) },
    { id: "long", label: "Long winning choice", patch: (p) => ((p.choices as Payload[])[0]!.title = LONG_TITLE) },
  ],
};

export function samplesForEvent(event: AlertEventType): readonly AlertSample[] {
  return ALERT_SAMPLES[event];
}

/** The sample with this id, or the event's first one when the id is unknown. */
export function findSample(event: AlertEventType, id: string): AlertSample {
  const list = ALERT_SAMPLES[event];
  return list.find((s) => s.id === id) ?? list[0]!;
}

/** A fresh socket message for the sample; ids and timestamps differ per call. */
export function buildSampleMessage(event: AlertEventType, id: string): AlertSocketMessage {
  const sample = findSample(event, id);
  const message = buildTestAlertSocketMessage(event, sample.userName);
  sample.patch?.(message.payload);
  return message;
}

/** The `{token}` values the preview renders for this sample. */
export function sampleTokens(event: AlertEventType, id: string): Record<string, string> {
  const alert = alertInstanceFromSocketMessage(buildSampleMessage(event, id));
  return alert ? alertTokensFromInstance(alert) : {};
}
