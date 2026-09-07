"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useInView } from "motion/react";
import {
  AUTO_SWITCHER_PRESET_THRESHOLDS,
  PRESET_COPY,
  type AutoSwitcherSensitivityPreset,
  type AutoSwitcherStatus,
  type AutoSwitcherThresholds,
} from "@repo/schemas";
import { Badge, Button, Card, CardContent, Input, cn } from "@repo/ui";
import { ChatMessage, EMPTY_CHAT_ASSETS } from "@repo/ui/chat";
import {
  Check,
  Hand,
  LayoutGrid,
  Loader2,
  MessageSquare,
  PencilLine,
  Radio,
  Repeat,
  RotateCw,
  Send,
  SlidersHorizontal,
  Square,
} from "lucide-react";
import { ChoiceCards, SettingSection, StepperRow, SwitchRow } from "@/components/deck/setting-row";
import { SwitcherStatusStrip } from "@/components/deck/switcher-status-strip";
import {
  AMBIENT_CHAT,
  BADGES,
  CATEGORIES,
  DECK_SCENES,
  DEFAULT_TITLE,
  REPLIES,
  TITLE_SAVED,
  boxArtUrl,
  text,
  type MockCategory,
} from "./obs-demo-data";
import { handoffKey, useObsDemo } from "./obs-demo-store";
import { useDemoTracking } from "../analytics/use-demo-tracking";

/*
 * A playable stand-in for /deck: all four tabs, the same shapes, the same
 * sensitivity controls (imported straight from the deck) and chat through the
 * same `@repo/ui/chat` renderer. What a visitor taps here is what they get
 * after logging in.
 *
 * Nothing talks to OBS or Twitch. The stream it drives lives in the section's
 * shared store (`obs-demo-store`), so a scene switched here also moves in the
 * OBS window beside it — wiring the deck's real websocket hooks up to fake
 * transports would put demo branches in the code path a live IRL stream depends
 * on.
 */

const MAX_TITLE_LENGTH = 140;
// The real deck's touch targets, one notch down: this frame is a phone drawn at
// roughly 80% scale, so its 96px buttons would read as oversized here.
const deckButtonClass = "h-20 rounded-2xl text-base font-semibold";

const TABS = [
  { value: "deck", label: "Deck", Icon: LayoutGrid },
  { value: "chat", label: "Chat", Icon: MessageSquare },
  { value: "stream", label: "Stream info", Icon: PencilLine },
  { value: "switcher", label: "Sensitivity", Icon: SlidersHorizontal },
] as const;

type MockTab = (typeof TABS)[number]["value"];

const TAB_TITLES: Record<MockTab, string> = {
  deck: "Stream Deck",
  chat: "Chat",
  stream: "Stream info",
  switcher: "Sensitivity",
};

/**
 * A status frame shaped like the engine's, so the deck's own status strip can
 * render it unchanged. `lastSwitchAt` stays null until the visitor switches a
 * scene — a timestamp baked at module load would differ between server and
 * client render.
 */
function mockStatus(
  thresholds: AutoSwitcherThresholds,
  held: string | null,
  lastSwitch: { at: number; to: string } | null,
): AutoSwitcherStatus {
  return {
    state: held ? "override" : "live",
    armed: true,
    override: held ? { scene_uuid: "demo", scene_name: held, expires_at: null } : null,
    selected_session: null,
    streaks: { bitrate: { bad: 0, good: 42 }, rtt: { bad: 0, good: 42 }, loss: { bad: 0, good: 42 } },
    thresholds,
    warning_shown: false,
    latest: { kbps: 6200, rtt_ms: 38, loss_pct: 0, at: 0 },
    last_switch: lastSwitch
      ? {
          at: lastSwitch.at,
          from_scene: null,
          to_scene: lastSwitch.to,
          reason: "override",
          detail: "Held from the deck",
          session_id: null,
          label: null,
        }
      : null,
    last_error: null,
    offline_since: null,
    auto_stop_deadline: null,
  };
}

export function DeckMock() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "-64px" });

  const {
    currentScene,
    switchingTo,
    sceneChangedAt,
    heldScene,
    releasing,
    streaming,
    togglingStream,
    lastSwitch,
    handoff,
    chat,
    unread,
    switchScene,
    releaseHold,
    toggleStream,
    appendChat,
    setChatOpen,
  } = useObsDemo();
  // OBS just changed something: ring the control here that followed.
  const fromObs = handoff?.from === "obs" ? handoff : null;
  const ring = "ring-2 ring-purple-400/80 ring-offset-2 ring-offset-background";

  const [tab, setTab] = useState<MockTab>("deck");
  const track = useDemoTracking("cloud_obs");

  // Chat tab.
  const [draft, setDraft] = useState("");

  // Stream info tab.
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [category, setCategory] = useState<MockCategory>(CATEGORIES[0]!);
  const [savedStream, setSavedStream] = useState({ title: DEFAULT_TITLE, categoryId: CATEGORIES[0]!.id });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reloading, setReloading] = useState(false);

  // Sensitivity tab.
  const [preset, setPreset] = useState<AutoSwitcherSensitivityPreset>("balanced");
  const [advanced, setAdvanced] = useState(false);
  const [thresholds, setThresholds] = useState<AutoSwitcherThresholds>(AUTO_SWITCHER_PRESET_THRESHOLDS.balanced);
  const [savedSwitcher, setSavedSwitcher] = useState({
    preset: "balanced" as AutoSwitcherSensitivityPreset,
    advanced: false,
    thresholds: AUTO_SWITCHER_PRESET_THRESHOLDS.balanced,
  });

  const [saving, setSaving] = useState(false);

  const ambientRef = useRef(0);
  const replyRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Every fake delay goes through here, so nothing fires after unmount.
  const later = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms));
  }, []);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  // Chat only ticks while the section is on screen. Off screen it is a timer
  // nobody is watching.
  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => {
      appendChat(AMBIENT_CHAT[ambientRef.current % AMBIENT_CHAT.length]!);
      ambientRef.current += 1;
    }, 3400);
    return () => clearInterval(id);
  }, [inView, appendChat]);

  // The store counts unread chat, so it needs to know whether this tab is the
  // one on screen.
  useEffect(() => {
    setChatOpen(tab === "chat");
    return () => setChatOpen(false);
  }, [tab, setChatOpen]);

  useEffect(() => {
    if (tab !== "chat") return;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [tab, chat.length]);

  const send = (event: FormEvent) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message) return;
    track("deck_chat_sent");
    setDraft("");
    appendChat({
      name: "You",
      login: "you",
      color: "#9147FF",
      badges: [BADGES.broadcaster],
      fragments: [text(message)],
    });
    later(() => {
      appendChat(REPLIES[replyRef.current % REPLIES.length]!);
      replyRef.current += 1;
    }, 1400);
  };

  const reloadFromTwitch = () => {
    if (reloading) return;
    setReloading(true);
    later(() => {
      setReloading(false);
      setTitle(savedStream.title);
      setCategory(CATEGORIES.find((item) => item.id === savedStream.categoryId) ?? CATEGORIES[0]!);
    }, 800);
  };

  const streamDirty = title !== savedStream.title || category.id !== savedStream.categoryId;
  const switcherDirty =
    preset !== savedSwitcher.preset ||
    advanced !== savedSwitcher.advanced ||
    (advanced && thresholds !== savedSwitcher.thresholds);
  const dirty = (tab === "stream" && streamDirty) || (tab === "switcher" && switcherDirty);

  const save = () => {
    if (saving) return;
    track(`deck_${tab}_saved`);
    setSaving(true);
    const savingTab = tab;
    later(() => {
      setSaving(false);
      if (savingTab === "stream") {
        setSavedStream({ title: title.trim(), categoryId: category.id });
        setTitle(title.trim());
        appendChat(TITLE_SAVED);
      } else {
        setSavedSwitcher({ preset, advanced, thresholds });
      }
    }, 800);
  };

  const discard = () => {
    if (tab === "stream") {
      setTitle(savedStream.title);
      setCategory(CATEGORIES.find((item) => item.id === savedStream.categoryId) ?? CATEGORIES[0]!);
      return;
    }
    setPreset(savedSwitcher.preset);
    setAdvanced(savedSwitcher.advanced);
    setThresholds(savedSwitcher.thresholds);
  };

  const setThreshold = (key: keyof AutoSwitcherThresholds, next: number) => {
    setThresholds((prev) => ({ ...prev, [key]: next }));
  };

  const remaining = MAX_TITLE_LENGTH - title.length;

  return (
    <div ref={rootRef} className="mx-auto w-fit">
      <div
        data-handoff={handoffKey("deck", "frame")}
        className="w-[320px] rounded-[2rem] border border-white/[0.1] bg-white/[0.03] p-2 shadow-[0_16px_48px_-16px_rgba(158,122,255,0.25)]"
      >
        <div
          role="group"
          aria-label="Interactive demo of the StreamWizard mobile deck"
          className="flex h-[620px] select-none flex-col overflow-hidden rounded-[1.5rem] bg-background [touch-action:manipulation]"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-5 pb-3">
            <h3 className="text-lg font-semibold">{TAB_TITLES[tab]}</h3>
            <Badge variant="default" className="gap-1.5">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
              OBS Connected
            </Badge>
          </div>

          {tab === "deck" ? (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
              <Button
                variant={streaming ? "destructive" : "default"}
                disabled={togglingStream}
                onClick={() => toggleStream("deck")}
                data-handoff={handoffKey("deck", "stream")}
                className={cn(deckButtonClass, "w-full", fromObs?.kind === "stream" && ring)}
              >
                {togglingStream ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : streaming ? (
                  <Square className="mr-2 h-4 w-4" />
                ) : (
                  <Radio className="mr-2 h-4 w-4" />
                )}
                {togglingStream ? "Working…" : streaming ? "End stream" : "Go live"}
              </Button>

              <Card>
                <CardContent className="space-y-1 py-4">
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Current scene</p>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-green-500" />
                    <p className="truncate text-lg font-semibold text-primary">{currentScene}</p>
                  </div>
                  {sceneChangedAt && (
                    <p className="text-xs tabular-nums text-muted-foreground">
                      Updated {sceneChangedAt.toLocaleTimeString()}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* The deck's hold card: tapping a scene pauses auto switching
                  until it is released. */}
              <Card>
                <CardContent className="space-y-3 py-4">
                  <div className="flex items-center gap-3">
                    {heldScene ? (
                      <Hand className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <Repeat className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      {heldScene ? (
                        <>
                          <p className="truncate text-sm font-medium">Holding {heldScene}</p>
                          <p className="text-xs text-muted-foreground">Auto switching is paused.</p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Auto switching is on. Tap a scene to hold it.</p>
                      )}
                    </div>
                  </div>
                  {heldScene && (
                    <Button
                      variant="outline"
                      className="h-12 w-full rounded-xl"
                      onClick={releaseHold}
                      disabled={releasing}
                    >
                      {releasing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Repeat className="mr-2 h-4 w-4" />
                      )}
                      Resume auto switching
                    </Button>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-3">
                {DECK_SCENES.map(({ name: scene }) => {
                  const isActive = scene === currentScene;
                  const isSwitching = switchingTo === scene;
                  return (
                    <Button
                      key={scene}
                      variant={isActive ? "default" : "outline"}
                      disabled={switchingTo !== null}
                      onClick={() => switchScene(scene, { from: "deck", hold: true })}
                      data-handoff={handoffKey("deck", { scene })}
                      className={cn(
                        deckButtonClass,
                        "relative",
                        fromObs?.kind === "scene" && fromObs.scene === scene && ring,
                      )}
                    >
                      {isActive && (
                        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border border-background bg-green-500" />
                      )}
                      {isSwitching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <span className="truncate">{isSwitching ? "Switching…" : scene}</span>
                    </Button>
                  );
                })}
              </div>

              <Card>
                <CardContent className="flex items-center justify-between py-3">
                  <p className="text-sm text-muted-foreground">Stream</p>
                  <div
                    className={cn(
                      "flex items-center gap-1.5 text-sm font-medium",
                      streaming ? "text-red-400" : "text-muted-foreground",
                    )}
                  >
                    <Radio className={cn("h-3.5 w-3.5", streaming && "animate-pulse")} />
                    {streaming ? "Live" : "Offline"}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : tab === "chat" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2">
                {chat.map((entry) => (
                  <ChatMessage
                    key={entry.id}
                    fragments={entry.fragments}
                    chatterName={entry.name}
                    chatterLogin={entry.login}
                    color={entry.color}
                    badges={entry.badges}
                    assets={EMPTY_CHAT_ASSETS}
                  />
                ))}
              </div>

              <form onSubmit={send} className="flex shrink-0 items-center gap-2 border-t bg-card/80 px-3 py-2">
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Send a message"
                  maxLength={200}
                  enterKeyHint="send"
                  className="h-11 flex-1 rounded-xl"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-xl"
                  disabled={draft.trim().length === 0}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          ) : tab === "stream" ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
              <div>
                <label
                  htmlFor="deck-mock-title"
                  className="mb-1.5 block text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
                >
                  Title
                </label>
                <textarea
                  id="deck-mock-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value.slice(0, MAX_TITLE_LENGTH))}
                  rows={3}
                  maxLength={MAX_TITLE_LENGTH}
                  placeholder="What are you streaming?"
                  disabled={saving || reloading}
                  className={cn(
                    "w-full resize-none rounded-2xl border bg-card p-3 text-sm leading-relaxed",
                    "placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    (saving || reloading) && "opacity-60",
                  )}
                />
                <p
                  className={cn(
                    "mt-1 text-right text-[11px] tabular-nums",
                    remaining <= 15 ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {remaining} left
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Category</p>
                {pickerOpen ? (
                  <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card">
                    {CATEGORIES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setCategory(item);
                          setPickerOpen(false);
                        }}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left active:bg-accent"
                      >
                        {/* Plain img: Twitch's box art CDN is already allowed by
                            the CSP, and these are fixed 52px thumbnails. */}
                        <img
                          src={boxArtUrl(item.id)}
                          alt=""
                          width={39}
                          height={52}
                          loading="lazy"
                          className="h-13 w-[39px] shrink-0 rounded object-cover"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
                        {item.id === category.id ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                    <img
                      src={boxArtUrl(category.id)}
                      alt=""
                      width={39}
                      height={52}
                      loading="lazy"
                      className="h-13 w-[39px] shrink-0 rounded object-cover"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{category.name}</span>
                    <Button variant="outline" className="h-10 shrink-0 rounded-xl" onClick={() => setPickerOpen(true)}>
                      Change
                    </Button>
                  </div>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                className="h-11 w-full rounded-xl text-muted-foreground"
                onClick={reloadFromTwitch}
                disabled={saving || reloading}
              >
                {reloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCw className="mr-2 h-4 w-4" />}
                Reload from Twitch
              </Button>
            </div>
          ) : (
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4">
              <SwitcherStatusStrip status={mockStatus(thresholds, heldScene, lastSwitch)} enabled />

              <SettingSection
                title="Sensitivity"
                description="How quickly the auto switcher reacts when your IRL signal gets rough. Scenes and everything else stay on the dashboard."
              >
                <SwitchRow
                  label="Advanced mode"
                  description="Tune every threshold yourself instead of using a preset."
                  checked={advanced}
                  onCheckedChange={setAdvanced}
                />

                {advanced ? (
                  <div className="divide-y divide-border">
                    <p className="px-4 py-3 text-xs text-muted-foreground">
                      One sample arrives per second. Trigger and recover are how many seconds in a row a value must be
                      bad (or good) before the switcher acts.
                    </p>
                    <StepperRow
                      label="Drops below"
                      unit="kbps"
                      value={thresholds.bitrate_min_kbps}
                      min={0}
                      max={100_000}
                      step={100}
                      onChange={(next) => setThreshold("bitrate_min_kbps", next)}
                    />
                    <StepperRow
                      label="Trigger"
                      description="Seconds bad before it switches away"
                      unit="seconds"
                      value={thresholds.bitrate_trigger_polls}
                      min={1}
                      max={120}
                      onChange={(next) => setThreshold("bitrate_trigger_polls", next)}
                    />
                    <StepperRow
                      label="Recover"
                      description="Seconds good before it switches back"
                      unit="seconds"
                      value={thresholds.bitrate_recover_polls}
                      min={1}
                      max={300}
                      onChange={(next) => setThreshold("bitrate_recover_polls", next)}
                    />
                  </div>
                ) : (
                  <ChoiceCards
                    value={preset}
                    onChange={(next) => {
                      setPreset(next);
                      setThresholds(AUTO_SWITCHER_PRESET_THRESHOLDS[next]);
                    }}
                    options={(Object.keys(PRESET_COPY) as AutoSwitcherSensitivityPreset[]).map((key) => ({
                      value: key,
                      title: PRESET_COPY[key].title,
                      blurb: PRESET_COPY[key].blurb,
                    }))}
                  />
                )}
              </SettingSection>
            </div>
          )}

          {/* Save bar, same stack position as the real deck: directly above the
              tab bar, only while something is unsaved. */}
          {dirty || saving ? (
            <div className="shrink-0 border-t bg-card/95 px-4 py-3">
              <div className="flex items-center gap-3">
                <p className="min-w-0 flex-1 text-xs text-muted-foreground">Unsaved changes.</p>
                <Button variant="ghost" className="h-11 rounded-xl" onClick={discard} disabled={saving}>
                  Discard
                </Button>
                <Button className="h-11 rounded-xl px-6" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </div>
          ) : null}

          <nav aria-label="Deck sections" className="shrink-0 border-t bg-card/95">
            <div className="grid grid-cols-4">
              {TABS.map(({ value, label, Icon }) => {
                const active = value === tab;
                const showDot = value === "chat" && unread > 0 && !active;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      track(`deck_tab_${value}`);
                      setTab(value);
                    }}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 transition-colors active:bg-accent",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {active ? <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary" /> : null}
                    <span className="relative">
                      <Icon className="h-5 w-5" />
                      {showDot ? (
                        <span className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full border border-card bg-primary" />
                      ) : null}
                    </span>
                    <span className="w-full truncate px-1 text-center text-[11px] font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
