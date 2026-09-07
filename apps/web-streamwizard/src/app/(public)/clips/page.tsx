import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";
import { ClipsVods } from "@/components/public/home/clips-vods";
import { ClipsSyncSection } from "@/components/public/clips/clips-sync-section";
import { ClipsFoldersSection } from "@/components/public/clips/clips-folders-section";
import { ClipsFiltersSection } from "@/components/public/clips/clips-filters-section";
import { OverlayRotatorSection } from "@/components/public/clips/overlay-rotator-section";
import { ClipsDownloadsSection } from "@/components/public/clips/clips-downloads-section";
import { VodTimelineSection } from "@/components/public/clips/vod-timeline-section";
import { FinalCta } from "@/components/public/home/final-cta";

/*
 * The clips product page: hero, the landing page's library section as the
 * overview, then the deep dives the mock cannot carry. Sync first because
 * clips arrive before anyone organizes them, folders as the depth story,
 * the filter inventory (streamer filter carries its synced-clips caveat),
 * the rotator band as the door to /overlays (which links back here), and
 * the vods band last: if the clip does not exist yet, /vods is where it
 * comes from.
 */
export const metadata: Metadata = {
  title: "Twitch clip manager with folders",
  description:
    "Every clip from your Twitch channel, synced the moment your stream ends and filed into folders and subfolders you create. Stack filters by title, category, or who clipped it, then point an overlay at a folder and let it rotate on stream.",
  alternates: { canonical: absoluteUrl("/clips") },
};

export default function ClipsPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <section className="pt-16 md:pt-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-purple-300">Clips</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              One endless pile of clips. <br /> Not any more.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Your channel&apos;s clips sync themselves, then go where you put them. Folders you
              name, filters that stack, downloads in both shapes.
            </p>
          </div>
        </div>
      </section>
      <ClipsVods showProductLink={false} showHeader={false} />
      <ClipsSyncSection />
      <ClipsFoldersSection />
      <ClipsFiltersSection />
      <OverlayRotatorSection />
      <ClipsDownloadsSection />
      <VodTimelineSection />
      <FinalCta />
    </div>
  );
}
