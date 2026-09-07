"use client";

import Image from "next/image";
import { Clapperboard, Search, Zap } from "lucide-react";
import { useSession } from "@/providers/session-provider";

export function WelcomeStep() {
  const user = useSession();
  const name = user.user_metadata?.full_name ?? user.user_metadata?.preferred_username ?? "streamer";
  const avatar = user.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        {avatar ? (
          <Image
            src={avatar}
            alt={name}
            width={52}
            height={52}
            className="shrink-0 rounded-full border border-white/10"
          />
        ) : (
          <div className="h-13 w-13 shrink-0 rounded-full bg-purple-500/20 border border-purple-500/30" />
        )}
        <div>
          <h2 className="text-xl font-semibold">Welcome, {name}.</h2>
          <p className="text-sm text-muted-foreground">Let&apos;s get three things sorted.</p>
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {[
          { icon: Clapperboard, text: "Your clips, finally organized." },
          { icon: Zap, text: "Sync after every stream, automatically." },
          { icon: Search, text: "Actually find the moment you're looking for." },
        ].map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 text-sm text-foreground/80">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20">
              <Icon className="h-3.5 w-3.5 text-purple-400" />
            </span>
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}
