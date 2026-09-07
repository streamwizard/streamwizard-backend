"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useSessionStore } from "@/stores/session-store";
import { completeOnboarding } from "@/actions/supabase/user/settings";
import { WelcomeStep } from "./steps/welcome-step";
import { MemesStep } from "./steps/memes-step";
import { SyncClipsStep } from "./steps/sync-clips-step";
import { StreamStatsStep } from "./steps/stream-stats-step";
import { SyncNowStep } from "./steps/sync-now-step";
import { DiscordLinkStep } from "./steps/discord-link-step";
import { DiscordJoinStep } from "./steps/discord-join-step";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui";
import { Button } from "@repo/ui";
import { captureEvent } from "@repo/posthog";

interface OnboardingValues {
  memes_enabled: boolean;
  sync_clips_on_end: boolean;
  show_stream_stats: boolean;
}

const STEP_IDS = [
  "welcome",
  "sync-clips",
  "memes",
  "stream-stats",
  "sync-now",
  "discord-link",
  "discord-join",
] as const;
const DISCORD_LINK_STEP_INDEX = STEP_IDS.indexOf("discord-link");
const DISCORD_JOIN_STEP_INDEX = STEP_IDS.indexOf("discord-join");

// Rendered only while the modal is actually shown, so mounting IS the event.
function OnboardingStartedTracker() {
  useEffect(() => {
    captureEvent("onboarding_started");
  }, []);
  return null;
}

export function OnboardingModal({
  clipCount,
  discordStatus,
  initialOnboardingCompleted,
}: {
  clipCount: number;
  discordStatus: "verified" | "not_member" | "not_linked";
  // Server-fetched truth. The client store's onboarding_completed defaults to
  // false and only hydrates in a later effect, so it can't gate analytics —
  // a mount effect would false-fire for every user already past onboarding.
  initialOnboardingCompleted: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { preferences, setPreferences } = useSessionStore();
  const [step, setStep] = useState(() => {
    const marker = searchParams.get("onboarding");
    if (marker === "discord-join-step") return DISCORD_JOIN_STEP_INDEX;
    if (marker === "discord-link-step") return DISCORD_LINK_STEP_INDEX;
    return 0;
  });
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<OnboardingValues>({
    memes_enabled: preferences.memes_enabled,
    sync_clips_on_end: preferences.sync_clips_on_end,
    show_stream_stats: preferences.show_stream_stats,
  });

  // Resuming at a discord step after the OAuth round trip — strip the
  // marker so a refresh doesn't re-trigger the jump.
  useEffect(() => {
    const marker = searchParams.get("onboarding");
    if (marker === "discord-join-step" || marker === "discord-link-step") {
      router.replace("/dashboard/clips");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Captured in the initializer because the strip-marker effect above rewrites
  // the URL right after mount, and a mount-effect check would then see no
  // marker and miscount the OAuth resume as a fresh onboarding start.
  const [resumedMidFlow] = useState(() => !!searchParams.get("onboarding"));

  const handleChange = useCallback((partial: Partial<OnboardingValues>) => {
    setValues((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleNext = useCallback(() => {
    setStep((s) => s + 1);
  }, []);

  const isLast = step === STEP_IDS.length - 1;

  // Render the current step by referencing the imported components directly so
  // their identity stays stable across re-renders. Building these inline inside
  // an array (and rendering via a dynamic `CurrentStep` variable) gives each
  // step a new function identity every render, which remounts the subtree and
  // wipes a step's local state — e.g. SyncNowStep losing its synced state when
  // a server action refreshes the route.
  function renderStep() {
    switch (STEP_IDS[step]) {
      case "welcome":
        return <WelcomeStep />;
      case "sync-clips":
        return (
          <SyncClipsStep value={values.sync_clips_on_end} onChange={(v) => handleChange({ sync_clips_on_end: v })} />
        );
      case "memes":
        return <MemesStep value={values.memes_enabled} onChange={(v) => handleChange({ memes_enabled: v })} />;
      case "stream-stats":
        return (
          <StreamStatsStep
            value={values.show_stream_stats}
            onChange={(v) => handleChange({ show_stream_stats: v })}
          />
        );
      case "sync-now":
        return <SyncNowStep clipCount={clipCount} />;
      case "discord-link":
        return <DiscordLinkStep linked={discordStatus !== "not_linked"} values={values} />;
      case "discord-join":
        return <DiscordJoinStep status={discordStatus === "not_linked" ? "not_member" : discordStatus} />;
      default:
        return null;
    }
  }

  const handleFinish = useCallback(async () => {
    setSaving(true);
    const ok = await completeOnboarding(values);
    setSaving(false);
    if (!ok) return;
    captureEvent("onboarding_completed");
    setPreferences({ ...preferences, ...values, onboarding_completed: true });
    router.push("/dashboard/clips");
  }, [values, preferences, setPreferences, router]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      if (isLast) {
        if (!saving) handleFinish();
      } else {
        handleNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isLast, saving, handleFinish, handleNext]);

  if (preferences.onboarding_completed) return null;

  return (
    <Dialog open>
      {!initialOnboardingCompleted && !resumedMidFlow && <OnboardingStartedTracker />}
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="sr-only">Get set up</DialogTitle>
        </DialogHeader>

        <div className="min-h-[180px] py-2 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex gap-1.5 py-1">
          {STEP_IDS.map((id, i) => (
            <div
              key={id}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
          >
            Back
          </Button>
          {isLast ? (
            <Button onClick={handleFinish} disabled={saving}>
              {saving ? "Saving..." : "Take me to my clips"}
            </Button>
          ) : (
            <Button onClick={handleNext}>Next</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
