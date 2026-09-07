import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";
import { VodClipping } from "@/components/public/home/vod-clipping-section";
import { VodsLibrarySection } from "@/components/public/vods/vods-library-section";
import { VodsEventsSection } from "@/components/public/vods/vods-events-section";
import { SceneSwitchesSection } from "@/components/public/vods/scene-switches-section";
import { VodsClipCreationSection } from "@/components/public/vods/vods-clip-creation-section";
import { ClipLibrarySection } from "@/components/public/vods/clip-library-section";
import { VodsFaqSection } from "@/components/public/vods/vods-faq-section";
import { FinalCta } from "@/components/public/home/final-cta";

/*
 * The VODs product page: hero, the landing page's band as the overview (its
 * demo carries the interaction), then the deep dives in the order a streamer
 * meets them: the library, the timeline and its events, the scene-switch band
 * as the door to /cloud-obs, the clip mechanics, the door to /clips (which
 * links back here), and the FAQ with the honest caveat about pre-signup VODs.
 */
export const metadata: Metadata = {
  title: "Clip from your Twitch VODs",
  description:
    "Every follow, sub, raid and ad break marked on your VOD timeline. Click an event to jump there, zoom in to 20x, and drag a 5 to 60 second selection into a real Twitch clip.",
  alternates: { canonical: absoluteUrl("/vods") },
};

export default function VodsPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <section className="pt-16 md:pt-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-amber-300">VODs</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              The clip button <br /> nobody pressed.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Open the VOD, find the moment on a timeline that marks every follow, sub and raid, and
              cut it yourself.
            </p>
            {/* A quiet timeline motif: four amber marks breathing out of phase. */}
            <div className="mx-auto mt-8 max-w-xs" aria-hidden="true">
              <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                {["12%", "38%", "57%", "83%"].map((left, index) => (
                  <span
                    key={left}
                    className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-amber-400/60 animate-pulse motion-reduce:animate-none"
                    style={{ left, animationDelay: `${index * 0.45}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <VodClipping showProductLink={false} showHeader={false} />
      <VodsLibrarySection />
      <VodsEventsSection />
      <SceneSwitchesSection />
      <VodsClipCreationSection />
      <ClipLibrarySection />
      <VodsFaqSection />
      <FinalCta />
    </div>
  );
}
