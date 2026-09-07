import { SectionView } from "@/components/public/analytics/section-view";
import { Reveal } from "@/components/public/home/reveal";
import { TrackedLink } from "@/components/public/analytics/tracked-link";
import { OriginTrace } from "./origin-trace";
import { OriginClips } from "./origin-clips";

const linkClass =
  "text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground";

/*
 * The origin story, with receipts: channel point chaos in 2023, an IRL
 * overlay, then the clip hunt that became StreamWizard's first feature. The
 * trace beside it walks the same milestones; the clip cards below are real
 * Twitch clips from those projects.
 */
export function OriginSection() {
  return (
    <section className="py-20">
      <SectionView section="origin" className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            It started with channel points.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Chat spawned the creepers. It went downhill from there.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl items-center gap-8 md:grid-cols-2">
          <Reveal direction="left" className="space-y-4 text-muted-foreground">
            <p>
              In 2023 this was a Minecraft integration for{" "}
              <TrackedLink
                href="https://twitch.tv/coenmeteenc"
                cta="coen_channel"
                section="origin"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                coenmeteenc
              </TrackedLink>
              . Viewers spent channel points on natural disasters and mob spawns, and the streamer
              dealt with the consequences. After that came a simple IRL overlay for{" "}
              <TrackedLink
                href="https://twitch.tv/xpudu"
                cta="xpudu_channel"
                section="origin"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                xPudu
              </TrackedLink>
              : speed, distance and weather at the bottom of the stream. One guy behind the scenes
              who would rather build the tool than be on camera.
            </p>
            <p>
              StreamWizard itself started with a clip. Someone in the Discord call said remember
              that clip, and two hours later nobody had found it. So clip filters and folders
              became the first feature. The same friends now file their clips into folders and post
              them as Shorts, TikToks and Reels.
            </p>
          </Reveal>
          <Reveal direction="right">
            <OriginTrace />
          </Reveal>
        </div>

        <Reveal className="mx-auto mt-10 max-w-5xl">
          <OriginClips />
        </Reveal>
      </SectionView>
    </section>
  );
}
