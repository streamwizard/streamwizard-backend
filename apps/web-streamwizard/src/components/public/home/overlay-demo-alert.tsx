"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

/*
 * The alert box as it fires in the overlay demos: a title in the shape of the
 * real templates, entering with one of the real in-animations.
 * Shared by the general overlay demo on the landing page and the IRL one on
 * the cloud OBS page, so both show the same alerts the same way.
 */

export type AlertAnim = "fade" | "zoom" | "bounce" | "slide_up" | "slide_down";

export interface DemoAlert {
  /** Short tag drawn above the title: the notice type, in words. */
  kind: string;
  /** The {name} part of the template, drawn in the accent colour like the real alert box does. */
  name: string;
  rest: string;
  message?: string;
  anim: AlertAnim;
  /** The title template as it reads in the alert box settings, placeholders and all. */
  template: string;
  /**
   * The second-line template, for the events that carry what the viewer typed.
   * Empty on the events Twitch gives no message for, same as the real settings
   * where the field is left blank to hide the line.
   */
  messageTemplate?: string;
  /** The media file the settings sketch shows for this event. */
  media: string;
}

/*
 * One alert per notice type in Twitch's channel.chat.notification payload
 * (sub, resub, sub_gift, community_sub_gift, gift_paid_upgrade,
 * prime_paid_upgrade, pay_it_forward, raid, announcement,
 * bits_badge_tier, charity_donation, watch_streak, modiversary), plus follow
 * and cheer, which arrive on their own subscriptions; unraid is left out, a
 * cancelled raid is nothing to celebrate. Titles follow Twitch's
 * own system messages; the names are the same chatters who sit in the deck
 * demo. Ordered so the notices other alert tools skip show up early.
 */
export const ALERTS: DemoAlert[] = [
  {
    kind: "Follow",
    name: "pixelgremlin",
    rest: " just followed!",
    anim: "zoom",
    template: "{name} just followed!",
    media: "follow.webm",
  },
  {
    kind: "Watch streak",
    name: "toastcrumb",
    rest: " is on a 5 stream watch streak!",
    anim: "slide_up",
    template: "{name} is on a {amount} stream watch streak!",
    media: "streak.webm",
  },
  {
    kind: "Community gift",
    name: "sandwichlord",
    rest: " is gifting 5 subs to the community!",
    anim: "bounce",
    template: "{name} is gifting {amount} subs to the community!",
    media: "gift-bomb.webm",
  },
  {
    kind: "Charity donation",
    name: "ninetoad",
    rest: " donated $25 to the charity stream!",
    message: "for the cause, and the hydration",
    anim: "fade",
    template: "{name} donated {amount} to the charity stream!",
    messageTemplate: "{message}",
    media: "charity.webm",
  },
  {
    kind: "Bits badge",
    name: "pixelgremlin",
    rest: " just earned the 10,000 bits badge!",
    anim: "zoom",
    template: "{name} just earned the {amount} bits badge!",
    media: "badge.webm",
  },
  {
    kind: "Pay it forward",
    name: "toastcrumb",
    // The notification payload names the original gifter (gifter_user_name,
    // null when anonymous), so the alert can credit both ends of the chain.
    rest: " is paying sandwichlord's gift sub forward!",
    anim: "slide_down",
    template: "{name} is paying {gifter}'s gift sub forward!",
    media: "forward.webm",
  },
  {
    kind: "Modiversary",
    name: "ModMothra",
    rest: " has been a mod for 1 year!",
    anim: "bounce",
    template: "{name} has been a mod for {amount} year!",
    media: "sword.webm",
  },
  {
    kind: "Prime upgrade",
    name: "ninetoad",
    rest: " converted their Prime sub to Tier 1!",
    anim: "slide_up",
    template: "{name} converted their Prime sub to Tier 1!",
    media: "upgrade.webm",
  },
  {
    kind: "Resub",
    name: "sandwichlord",
    rest: " subscribed for 6 months in a row!",
    message: "six months, still here",
    anim: "zoom",
    template: "{name} subscribed for {amount} months in a row!",
    messageTemplate: "{message}",
    media: "resub.webm",
  },
  {
    kind: "Sub",
    name: "pixelgremlin",
    rest: " subscribed with Prime!",
    anim: "fade",
    template: "{name} subscribed with Prime!",
    media: "sub.webm",
  },
  {
    kind: "Raid",
    name: "ModMothra",
    rest: " is raiding with 42 viewers!",
    anim: "zoom",
    template: "{name} is raiding with {amount} viewers!",
    media: "raid.webm",
  },
  {
    kind: "Gift sub",
    name: "toastcrumb",
    rest: " gifted a sub to ninetoad!",
    anim: "slide_down",
    template: "{name} gifted a sub!",
    media: "gift.webm",
  },
  {
    kind: "Gift upgrade",
    name: "ninetoad",
    rest: " is continuing their gift sub!",
    anim: "bounce",
    template: "{name} is continuing their gift sub!",
    media: "upgrade.webm",
  },
  {
    kind: "Announcement",
    name: "ModMothra",
    rest: " made an announcement",
    message: "clip contest ends at midnight",
    anim: "slide_up",
    template: "{name} made an announcement",
    messageTemplate: "{message}",
    media: "announce.webm",
  },
  {
    kind: "Cheer",
    name: "sandwichlord",
    rest: " cheered 500 bits!",
    message: "drink some water",
    anim: "zoom",
    template: "{name} cheered {amount} bits!",
    messageTemplate: "{message}",
    media: "cheer.webm",
  },
];

const ALERT_IN: Record<AlertAnim, { opacity: number; scale?: number; y?: number }> = {
  fade: { opacity: 0 },
  zoom: { opacity: 0, scale: 0.6 },
  bounce: { opacity: 0, scale: 0.4 },
  slide_up: { opacity: 0, y: 28 },
  slide_down: { opacity: 0, y: -28 },
};

const ALERT_TRANSITION: Record<AlertAnim, object> = {
  fade: { duration: 0.45, ease: "easeOut" },
  zoom: { duration: 0.35, ease: "easeOut" },
  bounce: { type: "spring", stiffness: 420, damping: 14 },
  slide_up: { duration: 0.4, ease: "easeOut" },
  slide_down: { duration: 0.4, ease: "easeOut" },
};

const ALERT_SHOW_MS = 4200;
const ALERT_GAP_MS = 3800;

/*
 * The alert currently on screen, shared with whatever else on the page wants
 * to follow along or take over: the alert box card in the widget grid
 * highlights the event that just fired, and clicking one of its chips fires
 * that alert in the frame. Holds the last fired index rather than null during
 * the gap between alerts, so followers do not flicker back to nothing.
 */
interface FireRequest {
  idx: number;
  /** Changes per click so the same event can be fired twice in a row. */
  n: number;
}

interface DemoAlertContextValue {
  current: number;
  setCurrent: (idx: number) => void;
  request: FireRequest | null;
  /** Play `idx` in the frame now and keep cycling from there. */
  fire: (idx: number) => void;
  /** Registers the frame element, so `fire` can bring it into view when it has scrolled off. */
  setFrame: (el: HTMLElement | null) => void;
  /** In-animations picked on the card, per event; the ALERTS default stands until one is set. */
  anims: Partial<Record<number, AlertAnim>>;
  setAnim: (idx: number, anim: AlertAnim) => void;
}

const DemoAlertContext = createContext<DemoAlertContextValue | null>(null);

export function DemoAlertProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState(0);
  const [request, setRequest] = useState<FireRequest | null>(null);
  const [anims, setAnims] = useState<Partial<Record<number, AlertAnim>>>({});
  const setAnim = useCallback((idx: number, anim: AlertAnim) => {
    setAnims((prev) => ({ ...prev, [idx]: anim }));
  }, []);
  const nonce = useRef(0);
  const frame = useRef<HTMLElement | null>(null);
  const setFrame = useCallback((el: HTMLElement | null) => {
    frame.current = el;
  }, []);

  const fire = useCallback((idx: number) => {
    setCurrent(idx);
    setRequest({ idx, n: ++nonce.current });
    const el = frame.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const onScreen = r.top >= 0 && r.bottom <= window.innerHeight;
    if (onScreen) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, []);

  return (
    <DemoAlertContext.Provider value={{ current, setCurrent, request, fire, setFrame, anims, setAnim }}>
      {children}
    </DemoAlertContext.Provider>
  );
}

/** Index into ALERTS of the alert that fired most recently (0 before the first one). */
export function useCurrentDemoAlert() {
  return useContext(DemoAlertContext)?.current ?? 0;
}

/** Fires an alert in the frame from outside it. No-op without a provider. */
export function useFireDemoAlert() {
  return useContext(DemoAlertContext)?.fire ?? null;
}

/** The in-animation an alert plays with: whatever the card picked, else its default. */
export function useDemoAlertAnim(idx: number | null): AlertAnim {
  const picked = useContext(DemoAlertContext)?.anims;
  if (idx === null) return "fade";
  return picked?.[idx] ?? ALERTS[idx].anim;
}

/** Sets the in-animation for one event. Null without a provider, which disables the picker. */
export function useSetDemoAlertAnim() {
  return useContext(DemoAlertContext)?.setAnim ?? null;
}

const noop = () => {};

/** Ref callback for the frame element, so `fire` can scroll to it. */
export function useDemoAlertFrameRef() {
  return useContext(DemoAlertContext)?.setFrame ?? noop;
}

/** What the frame is playing right now. */
export interface DemoAlertPlay {
  /** Index into ALERTS, or null in the gap between two alerts. */
  idx: number | null;
  /**
   * Bumped on every show. The box keys on it, so firing the same event twice —
   * which is what picking an animation does — still remounts and replays the
   * entrance, instead of Framer cancelling the exit and blinking it back in.
   */
  n: number;
}

const NOTHING_PLAYING: DemoAlertPlay = { idx: null, n: 0 };

/**
 * Cycles through ALERTS while `active`: show one, rest, show the next. Cleared
 * when the demo scrolls away so it never fires into a hidden frame. Publishes
 * each alert to the DemoAlertProvider above it, if there is one, and jumps to
 * whatever the provider asks for.
 */
export function useDemoAlerts(active: boolean, firstDelayMs = 1400): DemoAlertPlay {
  const [play, setPlay] = useState<DemoAlertPlay>(NOTHING_PLAYING);
  const nextAlert = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctx = useContext(DemoAlertContext);
  const publish = ctx?.setCurrent;
  const request = ctx?.request;

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  /** Start (or restart) the loop at `startIdx`, first alert after `delay`. */
  const run = useCallback(
    (startIdx: number, delay: number) => {
      stop();
      nextAlert.current = startIdx;
      const show = () => {
        const idx = nextAlert.current;
        setPlay((p) => ({ idx, n: p.n + 1 }));
        publish?.(idx);
        nextAlert.current = (idx + 1) % ALERTS.length;
        timer.current = setTimeout(hide, ALERT_SHOW_MS);
      };
      const hide = () => {
        setPlay((p) => ({ idx: null, n: p.n }));
        timer.current = setTimeout(show, ALERT_GAP_MS);
      };
      // Take down whatever is up (nothing, on a cold start), then show after `delay`.
      timer.current = setTimeout(() => {
        setPlay((p) => ({ idx: null, n: p.n }));
        timer.current = setTimeout(show, delay);
      }, 0);
    },
    [publish, stop],
  );

  useEffect(() => {
    if (!active) return;
    run(nextAlert.current, firstDelayMs);
    return () => {
      stop();
      setPlay((p) => ({ idx: null, n: p.n }));
    };
  }, [active, firstDelayMs, run, stop]);

  // A click on the card: drop whatever is up, play theirs, carry on from there.
  // Off screen, queue it as the next one for when the frame comes back. Each
  // request is handled once, so scrolling away and back does not replay it.
  const handled = useRef(0);
  useEffect(() => {
    if (!request || request.n === handled.current) return;
    handled.current = request.n;
    if (!active) {
      nextAlert.current = request.idx;
      return;
    }
    run(request.idx, 200);
  }, [request, active, run]);

  return play;
}

/** The alert itself. Render inside a positioned wrapper; sizes follow the frame's container queries. */
export function DemoAlertBox({ play }: { play: DemoAlertPlay }) {
  const alert = play.idx === null ? null : ALERTS[play.idx];
  const anim = useDemoAlertAnim(play.idx);
  return (
    <AnimatePresence mode="wait">
      {alert ? (
        <motion.div
          key={play.n}
          initial={ALERT_IN[anim]}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          transition={ALERT_TRANSITION[anim]}
          className="max-w-full text-center"
        >
          <p className="mb-0.5 text-[6px] font-semibold uppercase tracking-[0.22em] text-[#b9b9c6] @md:text-[8px] @3xl:mb-1 @3xl:text-[10px]">
            {alert.kind}
          </p>
          <p className="line-clamp-2 text-balance text-[11px] font-bold leading-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] @md:text-sm @xl:text-base @3xl:text-2xl">
            <span className="text-[#9e7aff]">{alert.name}</span>
            {alert.rest}
          </p>
          {alert.message ? (
            <p className="mt-0.5 truncate text-[8px] text-[#d4d4d8] drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] @md:text-[10px] @3xl:text-sm">
              {alert.message}
            </p>
          ) : null}
          <span className="mx-auto mt-1 block h-0.5 w-8 rounded-full bg-[#9e7aff] @3xl:mt-1.5 @3xl:w-12" />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
