"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { useDemoTracking } from "@/components/public/analytics/use-demo-tracking";

/*
 * The receipts: real Twitch clips from the projects that came before
 * StreamWizard, with their real titles and thumbnails. Facade cards, so the
 * page loads no Twitch iframes until someone actually presses play; clicking
 * swaps the card for the embed with autoplay on.
 *
 * Thumbnails come from Twitch's CDN (static-cdn.jtvnw.net, allowed in both
 * next.config images and the CSP img-src). Keep EMBED_PARENTS in sync with
 * home/clips-marquee.tsx: Twitch refuses to embed unless the page host is
 * listed as a parent.
 */

const EMBED_PARENTS =
  "&parent=localhost&parent=streamwizard.org&parent=staging.streamwizard.org&autoplay=true";

const CLIPS = [
  {
    slug: "SincereEndearingDelicataANELE-QyAEEsLOUfyrFy8F",
    channel: "coenmeteenc",
    title: "Mo gaat naar de maan",
    thumbnail:
      "https://static-cdn.jtvnw.net/twitch-video-assets/twitch-vap-video-assets-prod-us-west-2/5f4e153c-4e54-4dc5-a66c-6de99f386283/landscape/thumb/thumb-0000000000-480x272.jpg",
  },
  {
    slug: "WittyViscousLouseOSfrog-vdlHG4QjThswjsnL",
    channel: "coenmeteenc",
    title: "poesie mo",
    thumbnail:
      "https://static-cdn.jtvnw.net/twitch-video-assets/twitch-vap-video-assets-prod-us-west-2/821f0476-099b-4a8a-9a60-5a574a1909f8/landscape/thumb/thumb-0000000000-480x272.jpg",
  },
  {
    slug: "DiligentCalmFriesCharlieBitMe-vmyYU079Hg3p2LC7",
    channel: "xpudu",
    title: "Pudu Karaoke sessie",
    thumbnail:
      "https://static-cdn.jtvnw.net/twitch-clips-thumbnails-prod/DiligentCalmFriesCharlieBitMe-vmyYU079Hg3p2LC7/c33f7a22-0a9d-4387-a811-e60849e65519/preview-480x272.jpg",
  },
] as const;

export function OriginClips({ className }: { className?: string }) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const track = useDemoTracking("origin_clips");

  return (
    <div className={className}>
      <div className="grid gap-4 sm:grid-cols-3">
        {CLIPS.map((clip) => (
          <div key={clip.slug}>
            <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
              {activeSlug === clip.slug ? (
                <iframe
                  src={`https://clips.twitch.tv/embed?clip=${clip.slug}${EMBED_PARENTS}`}
                  title={`${clip.channel}: ${clip.title}`}
                  allow="autoplay; fullscreen"
                  allowFullScreen
                  className="aspect-video w-full"
                />
              ) : (
                <button
                  type="button"
                  aria-label={`Play clip from ${clip.channel}: ${clip.title}`}
                  onClick={() => {
                    setActiveSlug(clip.slug);
                    track(`play_${clip.channel}`);
                  }}
                  className="group relative block aspect-video w-full"
                >
                  <Image
                    src={clip.thumbnail}
                    alt={`${clip.title}, clipped from ${clip.channel}`}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover"
                  />
                  <span className="absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/15" />
                  <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-purple-400/40 bg-black/60 transition-transform group-hover:scale-110 motion-reduce:transition-none">
                    <Play className="ml-0.5 h-5 w-5 text-purple-300" fill="currentColor" />
                  </span>
                </button>
              )}
            </div>
            <p className="mt-2 text-center font-mono text-xs text-muted-foreground">
              {clip.channel} · {clip.title}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
