import { describe, expect, it } from "bun:test";
import {
  ALERT_AMOUNT_LABELS,
  ALERT_DEFAULT_ON_EVENTS,
  ALERT_EVENT_CATEGORIES,
  ALERT_EVENT_LABELS,
  ALERT_EVENT_SUBSCRIPTION_TYPES,
  ALERT_EVENT_TYPES,
  ALERT_NAME_LABELS,
  DEFAULT_ALERT_VARIANT_TITLES,
  alertInstanceFromSocketMessage,
  alertSkipReason,
  buildTestAlertSocketMessage,
  createDefaultAlertVariantConfig,
  createDefaultAlertWidgetConfig,
  normalizeAlertWidgetConfig,
  renderAlertTemplate,
  type AlertEventType,
} from "./alert-widget-config";
import { buildWidgetTestEvent } from "@repo/schemas";

/** A `channel.chat.notification` payload with one notice block populated. */
function notice(
  noticeType: string,
  blocks: Record<string, unknown> = {},
  extra: Record<string, unknown> = {}
) {
  return {
    type: "channel.chat.notification",
    payload: {
      chatter_user_name: "toastcrumb",
      chatter_is_anonymous: false,
      notice_type: noticeType,
      message: { text: "hello", fragments: [] },
      ...blocks,
      ...extra,
    },
  };
}

describe("alert event tables", () => {
  // Adding an event means touching five tables. Miss one and the editor renders
  // `undefined` at a streamer rather than failing anywhere a developer looks.
  for (const event of ALERT_EVENT_TYPES) {
    it(`${event} is described in every table`, () => {
      expect(ALERT_EVENT_LABELS[event]).toBeTruthy();
      expect(ALERT_NAME_LABELS[event]).toBeTruthy();
      expect(DEFAULT_ALERT_VARIANT_TITLES[event]).toBeTruthy();
      expect(ALERT_EVENT_SUBSCRIPTION_TYPES[event]?.type).toBeTruthy();
      expect(event in ALERT_AMOUNT_LABELS).toBe(true);
    });
  }

  it("has no event in two categories", () => {
    const flat = ALERT_EVENT_CATEGORIES.flatMap((c) => c.events);
    expect(new Set(flat).size).toBe(flat.length);
  });

  it("only uses {amount} in a default title when the event carries one", () => {
    for (const event of ALERT_EVENT_TYPES) {
      if (DEFAULT_ALERT_VARIANT_TITLES[event].includes("{amount}")) {
        expect(ALERT_AMOUNT_LABELS[event]).toBeTruthy();
      }
    }
  });
});

describe("test alerts round-trip", () => {
  /*
   * The strongest guard on the whole feature: every Test button in the editor
   * must produce an event the widget maps back to the alert the streamer
   * pressed. A wrong variant name or a fixture whose notice_type drifted shows
   * up here instead of as a dead Test button.
   */
  for (const event of ALERT_EVENT_TYPES) {
    it(`${event} test fixture maps back to ${event}`, () => {
      const msg = buildTestAlertSocketMessage(event);
      const alert = alertInstanceFromSocketMessage(msg);
      expect(alert?.event).toBe(event);
    });
  }
});

describe("dedupe: the chat notice is the single source", () => {
  // These five arrive twice -- once on their own subscription, once as a chat
  // notice. The dedicated one is dropped so one celebration is one alert.
  const DOUBLED = [
    "channel.subscribe",
    "channel.subscription.message",
    "channel.subscription.gift",
    "channel.raid",
  ];

  for (const type of DOUBLED) {
    it(`${type} does not fire an alert`, () => {
      expect(alertInstanceFromSocketMessage({ type, payload: {} })).toBeNull();
    });
  }

  it("skips the per-recipient notices inside a gift bomb", () => {
    // A 100-sub bomb sends one community_sub_gift plus 100 sub_gift notices.
    const inBomb = alertInstanceFromSocketMessage(
      notice("sub_gift", {
        sub_gift: { cumulative_total: 12, community_gift_id: "bomb-1" },
      })
    );
    expect(inBomb).toBeNull();

    const lone = alertInstanceFromSocketMessage(
      notice("sub_gift", { sub_gift: { cumulative_total: 12, community_gift_id: null } })
    );
    expect(lone?.event).toBe("gift_sub");
  });

  it("ignores notices relayed from another channel's shared chat", () => {
    expect(alertInstanceFromSocketMessage(notice("shared_chat_sub"))).toBeNull();
    expect(
      alertInstanceFromSocketMessage(notice("sub", {}, { is_source_only: true }))
    ).toBeNull();
  });

  it("ignores unraid and notice types it has never heard of", () => {
    expect(alertInstanceFromSocketMessage(notice("unraid"))).toBeNull();
    expect(alertInstanceFromSocketMessage(notice("unknown"))).toBeNull();
    expect(alertInstanceFromSocketMessage(notice("something_new_2027"))).toBeNull();
  });

  it("holds when the demo bar sends a raw message instead of an alert type", () => {
    // The demo bar fires whatever the picker holds down the same local path as
    // the inspector's Test button. Its "Sub" button is wired to the chat notice
    // for exactly this reason -- the dedicated subscription still drops.
    const { type, variant } = ALERT_EVENT_SUBSCRIPTION_TYPES.sub;
    expect(
      alertInstanceFromSocketMessage(buildWidgetTestEvent(type, undefined, variant))?.event
    ).toBe("sub");
    expect(
      alertInstanceFromSocketMessage(buildWidgetTestEvent("channel.subscribe"))
    ).toBeNull();
  });

  it("still fires follow and cheer from their own subscriptions", () => {
    expect(
      alertInstanceFromSocketMessage({
        type: "channel.follow",
        payload: { user_name: "pixelgremlin" },
      })?.event
    ).toBe("follow");
    expect(
      alertInstanceFromSocketMessage({
        type: "channel.cheer",
        payload: { user_name: "sandwichlord", bits: 500, message: "hi" },
      })?.amount
    ).toBe(500);
  });
});

describe("one celebration, one alert", () => {
  /*
   * The end-to-end check on the dedupe rules. Every message below really does
   * arrive at the widget -- the bot forwards every conduit event to the room
   * with no server-side filtering -- so counting the alerts a whole sequence
   * produces is the only honest test of "does a gift bomb fire once".
   */
  const fired = (msgs: { type: string; payload: unknown }[]) =>
    msgs.map(alertInstanceFromSocketMessage).filter((a) => a !== null);

  it("fires once for a 5-sub gift bomb, not twelve times", () => {
    const bombId = "bomb-1";
    const alerts = fired([
      // The dedicated subscription, carrying the whole bomb.
      { type: "channel.subscription.gift", payload: { user_name: "sandwichlord", total: 5 } },
      // The bomb's own notice.
      notice("community_sub_gift", { community_sub_gift: { id: bombId, total: 5 } }),
      // One notice per recipient, each tagged with the bomb id.
      ...Array.from({ length: 5 }, (_, i) =>
        notice("sub_gift", {
          sub_gift: { community_gift_id: bombId, recipient_user_name: `viewer${i}` },
        })
      ),
      // And a dedicated subscribe per recipient.
      ...Array.from({ length: 5 }, () => ({
        type: "channel.subscribe",
        payload: { user_name: "viewer", is_gift: true },
      })),
    ]);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.event).toBe("community_gift");
    expect(alerts[0]!.amount).toBe(5);
  });

  it("fires once for a single gift sub", () => {
    const alerts = fired([
      { type: "channel.subscription.gift", payload: { user_name: "toastcrumb", total: 1 } },
      notice("sub_gift", {
        sub_gift: { community_gift_id: null, recipient_user_name: "ninetoad", cumulative_total: 12 },
      }),
      { type: "channel.subscribe", payload: { user_name: "ninetoad", is_gift: true } },
    ]);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.event).toBe("gift_sub");
  });

  it("fires once for a plain sub, a resub and a raid", () => {
    expect(
      fired([
        { type: "channel.subscribe", payload: { user_name: "pixelgremlin", is_gift: false } },
        notice("sub", { sub: { sub_plan: "1000", is_gift: false } }),
      ])
    ).toHaveLength(1);

    expect(
      fired([
        {
          type: "channel.subscription.message",
          payload: { user_name: "sandwichlord", cumulative_months: 6 },
        },
        notice("resub", { resub: { cumulative_months: 6 } }),
      ])
    ).toHaveLength(1);

    expect(
      fired([
        { type: "channel.raid", payload: { from_broadcaster_user_name: "ModMothra", viewers: 42 } },
        notice("raid", { raid: { user_name: "ModMothra", viewer_count: 42 } }),
      ])
    ).toHaveLength(1);
  });

  it("stays silent through a shared chat session's relayed subs", () => {
    expect(
      fired([
        notice("shared_chat_sub", {}),
        notice("shared_chat_community_sub_gift", {}),
        notice("sub", { sub: { sub_plan: "1000" } }, { is_source_only: true }),
      ])
    ).toHaveLength(0);
  });
});

describe("notice payloads", () => {
  it("reads the resub month count and what the viewer typed", () => {
    const alert = alertInstanceFromSocketMessage(
      notice("resub", { resub: { cumulative_months: 6 } })
    );
    expect(alert?.event).toBe("resub");
    expect(alert?.amount).toBe(6);
    expect(alert?.message).toBe("hello");
  });

  it("reads a gift bomb's size", () => {
    const alert = alertInstanceFromSocketMessage(
      notice("community_sub_gift", { community_sub_gift: { total: 5 } })
    );
    expect(alert?.event).toBe("community_gift");
    expect(alert?.amount).toBe(5);
  });

  it("counts a watch streak in streams", () => {
    const alert = alertInstanceFromSocketMessage(
      notice("watch_streak", { watch_streak: { consecutive_months: 25 } })
    );
    expect(alert?.amount).toBe(25);
  });

  it("takes the raider and viewer count off the notice's raid block", () => {
    const alert = alertInstanceFromSocketMessage(
      notice("raid", { raid: { user_name: "ModMothra", viewer_count: 42 } })
    );
    expect(alert?.name).toBe("ModMothra");
    expect(alert?.amount).toBe(42);
  });

  it("formats a charity donation as money, and still compares as a number", () => {
    const alert = alertInstanceFromSocketMessage(
      notice("charity_donation", {
        charity_donation: {
          charity_name: "Cats With Hats",
          amount: { value: 2500, decimal_places: 2, currency: "USD" },
        },
      })
    );
    // The threshold check runs on `amount`, so it has to be the real number.
    expect(alert?.amount).toBe(25);
    expect(alert?.amountText).toContain("25");
    expect(alert?.detail).toBe("Cats With Hats");
    expect(renderAlertTemplate("{name} gave {amount} to {charity}!", alert!)).toBe(
      `toastcrumb gave ${alert!.amountText} to Cats With Hats!`
    );
  });

  it("names the original gifter, and says so when they were anonymous", () => {
    const named = alertInstanceFromSocketMessage(
      notice("pay_it_forward", {
        pay_it_forward: { gifter_is_anonymous: false, gifter_user_name: "sandwichlord" },
      })
    );
    expect(named?.gifter).toBe("sandwichlord");

    const anon = alertInstanceFromSocketMessage(
      notice("pay_it_forward", {
        pay_it_forward: { gifter_is_anonymous: true, gifter_user_name: null },
      })
    );
    expect(anon?.gifter).toBe("an anonymous gifter");
    expect(renderAlertTemplate("paying {gifter}'s sub forward", anon!)).toBe(
      "paying an anonymous gifter's sub forward"
    );
  });
});

describe("dedicated subscriptions the alert box still owns", () => {
  it("reads a redemption's reward and cost", () => {
    const alert = alertInstanceFromSocketMessage({
      type: "channel.channel_points_custom_reward_redemption.add",
      payload: {
        user_name: "ninetoad",
        user_input: "glug glug",
        reward: { title: "Hydrate", cost: 500 },
      },
    });
    expect(alert?.event).toBe("redemption");
    expect(alert?.amount).toBe(500);
    expect(alert?.detail).toBe("Hydrate");
    expect(renderAlertTemplate("{name} redeemed {reward}!", alert!)).toBe(
      "ninetoad redeemed Hydrate!"
    );
  });

  it("reads the ad break duration, typed or stringly", () => {
    // Real payloads carry an integer (verified against logged ad breaks and
    // the Twitch CLI), but the schema claimed string for years -- so accept
    // both rather than render "Ads for 0 seconds" if it ever comes back.
    for (const duration of [60, "60"]) {
      const alert = alertInstanceFromSocketMessage({
        type: "channel.ad_break.begin",
        payload: { broadcaster_user_name: "Broadcaster", duration_seconds: duration },
      });
      expect(alert?.amount).toBe(60);
    }
  });

  it("credits the top contributor on a hype train, or the crowd", () => {
    const withTop = alertInstanceFromSocketMessage({
      type: "channel.hype_train.end",
      payload: { level: 4, top_contributions: [{ user_name: "toastcrumb" }] },
    });
    expect(withTop?.name).toBe("toastcrumb");
    expect(withTop?.amount).toBe(4);

    const empty = alertInstanceFromSocketMessage({
      type: "channel.hype_train.begin",
      payload: { level: 1, top_contributions: [] },
    });
    expect(empty?.name).toBe("Chat");
  });

  it("announces the winning poll choice, and stays quiet on a cancelled poll", () => {
    const choices = [
      { title: "Hard socks", votes: 140 },
      { title: "Absolutely not", votes: 62 },
    ];
    const won = alertInstanceFromSocketMessage({
      type: "channel.poll.end",
      payload: { status: "completed", choices },
    });
    expect(won?.name).toBe("Hard socks");
    expect(won?.amount).toBe(140);

    expect(
      alertInstanceFromSocketMessage({
        type: "channel.poll.end",
        payload: { status: "terminated", choices },
      })
    ).toBeNull();
  });
});

describe("defaults", () => {
  it("ships only the alerts every other provider ships as standard", () => {
    const cfg = createDefaultAlertWidgetConfig();
    for (const event of ALERT_EVENT_TYPES) {
      expect(cfg.variants[event].enabled).toBe(ALERT_DEFAULT_ON_EVENTS.includes(event));
    }
  });

  it("holds every alert for its own set time until asked otherwise", () => {
    const cfg = createDefaultAlertWidgetConfig();
    for (const event of ALERT_EVENT_TYPES) {
      expect(cfg.variants[event].durationMode).toBe("fixed");
    }
  });

  it("keeps the six the widget already fired switched on", () => {
    for (const event of ["follow", "sub", "resub", "gift_sub", "cheer", "raid"] as const) {
      expect(ALERT_DEFAULT_ON_EVENTS).toContain(event);
    }
    // Gift bombs fired before too, as part of the old gift_sub alert.
    expect(ALERT_DEFAULT_ON_EVENTS).toContain("community_gift");
  });
});

describe("the gate a test alert still has to clear", () => {
  const cheer = alertInstanceFromSocketMessage({
    type: "channel.cheer",
    payload: { user_name: "sandwichlord", bits: 100, message: "hi" },
  })!;

  it("lets a live variant through", () => {
    expect(alertSkipReason(cheer, createDefaultAlertVariantConfig("cheer"))).toBeNull();
  });

  it("names a switched-off variant so the editor can say why nothing played", () => {
    const off = { ...createDefaultAlertVariantConfig("cheer"), enabled: false };
    expect(alertSkipReason(cheer, off)).toBe("disabled");
  });

  it("names a minimum the test didn't reach", () => {
    const gated = { ...createDefaultAlertVariantConfig("cheer"), minAmount: 500 };
    expect(alertSkipReason(cheer, gated)).toBe("below-minimum");

    // The boundary is inclusive: a 100-bit cheer clears a 100-bit minimum.
    expect(
      alertSkipReason(cheer, { ...createDefaultAlertVariantConfig("cheer"), minAmount: 100 })
    ).toBeNull();
  });

  it("reports the switch before the minimum -- fixing the switch comes first", () => {
    const both = {
      ...createDefaultAlertVariantConfig("cheer"),
      enabled: false,
      minAmount: 500,
    };
    expect(alertSkipReason(cheer, both)).toBe("disabled");
  });
});

describe("config migration", () => {
  it("defaults every new event on a config saved before they existed", () => {
    const cfg = normalizeAlertWidgetConfig({
      gapSeconds: 2,
      masterVolume: 0.5,
      variants: { follow: { enabled: false } },
    });
    for (const event of ALERT_EVENT_TYPES) {
      expect(cfg.variants[event]).toBeDefined();
    }
    expect(cfg.variants.follow.enabled).toBe(false);
    expect(cfg.gapSeconds).toBe(2);
  });

  it("does not switch on a single new alert when an old config is loaded", () => {
    // The upgrade guarantee: a streamer who saved this config before any of
    // these events existed must not find ad breaks and polls on their overlay.
    const cfg = normalizeAlertWidgetConfig({
      variants: {
        follow: { enabled: true },
        sub: { enabled: true },
        resub: { enabled: true },
        gift_sub: { enabled: true },
        cheer: { enabled: true },
        raid: { enabled: true },
      },
    });
    for (const event of ALERT_EVENT_TYPES) {
      if (event === "community_gift") continue; // inherits the old gift_sub
      const wasConfigured = ["follow", "sub", "resub", "gift_sub", "cheer", "raid"].includes(
        event
      );
      expect(cfg.variants[event].enabled).toBe(wasConfigured);
    }
  });

  it("carries a disabled gift_sub's off state onto gift bombs", () => {
    const cfg = normalizeAlertWidgetConfig({
      variants: { gift_sub: { enabled: false } },
    });
    expect(cfg.variants.community_gift.enabled).toBe(false);
  });

  it("hands a saved gift_sub's bomb setup to the new gift bomb alert", () => {
    // gift_sub used to BE the gift bomb, so the media and wording a streamer
    // picked belong to community_gift now.
    const cfg = normalizeAlertWidgetConfig({
      variants: {
        gift_sub: {
          enabled: true,
          mediaUrl: "https://cdn.example/gift-bomb.webm",
          mediaKind: "video",
          titleTemplate: "{name} gifted {amount} subs!",
        },
      },
    });
    expect(cfg.variants.community_gift.mediaUrl).toBe("https://cdn.example/gift-bomb.webm");
    expect(cfg.variants.community_gift.titleTemplate).toBe("{name} gifted {amount} subs!");
    // ...and the single-gift alert goes back to wording that is true of it.
    expect(cfg.variants.gift_sub.titleTemplate).toBe(DEFAULT_ALERT_VARIANT_TITLES.gift_sub);
  });

  it("leaves a hand-written gift_sub title alone", () => {
    const cfg = normalizeAlertWidgetConfig({
      variants: { gift_sub: { titleTemplate: "{name} is generous!" } },
    });
    expect(cfg.variants.gift_sub.titleTemplate).toBe("{name} is generous!");
  });

  it("leaves alerts saved before video matching existed on a set time", () => {
    const cfg = normalizeAlertWidgetConfig({
      variants: {
        follow: { mediaUrl: "https://cdn.example/pop.webm", mediaKind: "video" },
      },
    });
    expect(cfg.variants.follow.durationMode).toBe("fixed");
  });

  it("keeps a saved video-matched alert matched", () => {
    const cfg = normalizeAlertWidgetConfig({
      variants: {
        follow: {
          mediaUrl: "https://cdn.example/pop.webm",
          mediaKind: "video",
          durationMode: "media",
        },
      },
    });
    expect(cfg.variants.follow.durationMode).toBe("media");
  });

  it("falls back to a set time when the saved mode is junk", () => {
    const cfg = normalizeAlertWidgetConfig({
      variants: { follow: { durationMode: "as-long-as-it-takes" } },
    });
    expect(cfg.variants.follow.durationMode).toBe("fixed");
  });

  it("keeps a config that already has both alerts", () => {
    const cfg = normalizeAlertWidgetConfig({
      variants: {
        gift_sub: { titleTemplate: "{name} gifted {amount} subs!" },
        community_gift: { titleTemplate: "bomb!" },
      },
    });
    expect(cfg.variants.community_gift.titleTemplate).toBe("bomb!");
    expect(cfg.variants.gift_sub.titleTemplate).toBe("{name} gifted {amount} subs!");
  });
});

describe("alert type coverage", () => {
  it("configures 23 alerts", () => {
    // 29 in the public catalog minus the six that need an OAuth scope
    // StreamWizard does not request yet (ban, VIP, mod, 2x prediction, goal).
    expect(ALERT_EVENT_TYPES.length).toBe(23);
  });

  it("still ships the six the widget started with", () => {
    const original: AlertEventType[] = ["follow", "sub", "resub", "gift_sub", "cheer", "raid"];
    for (const event of original) {
      expect(ALERT_EVENT_TYPES).toContain(event);
    }
  });
});
