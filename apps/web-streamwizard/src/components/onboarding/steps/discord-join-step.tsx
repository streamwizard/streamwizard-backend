"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, PartyPopper } from "lucide-react";
import { FaDiscord } from "react-icons/fa";
import { Button } from "@repo/ui";
import { discordInviteLink } from "@/lib/constant";

export function DiscordJoinStep({ status }: { status: "verified" | "not_member" }) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  const handleCheckAgain = () => {
    setChecking(true);
    router.refresh();
  };

  if (status === "verified") {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">You&apos;re in.</h2>
          <p className="text-sm text-muted-foreground">Your Verified Member role is live in the StreamWizard Discord.</p>
        </div>
        <div className="relative rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <PartyPopper className="h-4 w-4 text-emerald-400" />
            </span>
            <div>
              <p className="text-sm font-medium">StreamWizard Discord</p>
              <p className="text-xs text-muted-foreground">Open a ticket, meet other streamers, line up a collab.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Now join the server.</h2>
        <p className="text-sm text-muted-foreground">
          Account&apos;s linked. Hop into the Discord and your Verified Member role shows up on its own.
        </p>
      </div>

      <div className="relative rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-[#5865F2]/40 to-transparent" />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/20">
              <FaDiscord className="h-4 w-4 text-[#5865F2]" />
            </span>
            <div>
              <p className="text-sm font-medium">StreamWizard Discord</p>
              <p className="text-xs text-muted-foreground">The official server.</p>
            </div>
          </div>
          <Button
            asChild
            size="sm"
            className="shrink-0 ml-3 bg-[#5865F2] text-white transition-transform hover:bg-[#4752C4] active:scale-95"
          >
            <a href={discordInviteLink} target="_blank" rel="noopener noreferrer">
              Join
            </a>
          </Button>
        </div>
      </div>

      <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5865F2]" />
          Your linked account only unlocks the role once you&apos;re actually in the server
        </li>
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5865F2]" />
          Trade clips and find collab partners among other streamers
        </li>
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5865F2]" />
          First to know when new features ship
        </li>
      </ul>

      <button
        type="button"
        onClick={handleCheckAgain}
        disabled={checking}
        className="text-xs text-muted-foreground underline underline-offset-4 disabled:opacity-50 self-start"
      >
        {checking ? "Checking…" : "Already joined? Check again"}
      </button>
    </div>
  );
}
