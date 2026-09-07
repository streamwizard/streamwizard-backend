import { TrackedLink } from "../analytics/tracked-link";
import { SectionView } from "../analytics/section-view";
import { ArrowRight } from "lucide-react";
import { Button } from "@repo/ui";
import { productLinks, xpuduChannelLink } from "@/lib/constant";
import { Reveal } from "./reveal";
import { DeckMock } from "./deck-mock";
import { ObsWindowMock } from "./obs-window-mock";
import { ObsDemoProvider } from "./obs-demo-store";
import { HandoffArrow } from "./handoff-arrow";
import { CheckItem } from "../layout/check-item";

/*
 * Cloud OBS is the IRL pillar: for streamers who want to go live away from a
 * PC, not a replacement for their own OBS. The deck is the USP, so both it and
 * the OBS window are playable rather than screenshots.
 */
export function CloudObsShowcase({
  showProductLink = true,
  showHeader = true,
}: { showProductLink?: boolean; showHeader?: boolean } = {}) {
  return (
    <section className="py-20">
      <SectionView section="cloud_obs" className="container mx-auto px-4">
        {showHeader && (
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Stream IRL without a PC.</h2>
            <p className="mt-4 text-muted-foreground">
              Cloud OBS is built for IRL streamers. StreamWizard runs a dedicated OBS for your channel in the cloud, and
              your phone streams into it. When you want to go live, the only thing you need is your phone.
            </p>
          </div>
        )}

        {/* Both rows are one demo: a scene switched in the OBS window moves on
            the deck, and the other way around. A change in either draws an arrow
            to the control that reacted in the other, so the relative wrapper
            spans both rows for the arrow to be positioned in. */}
        <ObsDemoProvider>
          <div className="relative">
            {/* Row A: text left, control room right */}
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <Reveal direction="left">
                <h3 className="text-xl font-semibold">Your stream setup, already running</h3>
                <ul className="mt-6 space-y-3">
                  <CheckItem>A dedicated OBS for your channel, booted in the cloud when you need it.</CheckItem>
                  <CheckItem>Your phone or encoder streams in over SRT or SRTLA.</CheckItem>
                  <CheckItem>
                    Signal drops mid stream? The auto switcher swaps to your connection-lost scene, tells chat, and
                    swaps back when the bitrate recovers.
                  </CheckItem>
                  <CheckItem>
                    Need eyes on OBS itself? Open the live OBS window in a browser on your PC, with CPU, memory, FPS,
                    and frame time next to it.
                  </CheckItem>
                </ul>
              </Reveal>
              <Reveal direction="right">
                <ObsWindowMock />
                {/* The scene previews and the away screens' clip rotator play
                    xpudu's streams. Credit sits with the component that shows
                    the footage, so it travels to /cloud-obs too. */}
                <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Real footage from{" "}
                  <TrackedLink
                    href={xpuduChannelLink}
                    cta="xpudu_channel"
                    section="cloud_obs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground/80 transition-colors hover:text-foreground"
                  >
                    xpudu
                  </TrackedLink>
                  &apos;s IRL streams
                </p>
              </Reveal>
            </div>

            {/* Row B: the deck, playable */}
            <div className="mt-20 grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <Reveal direction="left" className="order-2 lg:order-1">
                <DeckMock />
              </Reveal>
              <Reveal direction="right" className="order-1 lg:order-2">
                <h3 className="text-xl font-semibold">The mobile deck runs the show</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  The deck lives on your phone and installs like an app. No PC, no tech BS, just stream. Switch a scene
                  here and watch it land in the OBS window above.
                </p>
                <ul className="mt-6 space-y-3">
                  <CheckItem>Go live and end the stream from your pocket.</CheckItem>
                  <CheckItem>Switch scenes, or hold one while the auto switcher waits.</CheckItem>
                  <CheckItem>Edit your stream title and category between locations.</CheckItem>
                  <CheckItem>Read and send Twitch chat without leaving the deck.</CheckItem>
                </ul>
              </Reveal>
            </div>
            <HandoffArrow />
          </div>
        </ObsDemoProvider>

        <div className="mt-14 flex flex-col items-center gap-4">
          {showProductLink ? (
            <Button
              asChild
              variant="outline"
              size="lg"
              className="gap-2 border-purple-400/30 bg-purple-400/[0.06] px-7 text-purple-200 shadow-md transition-transform duration-200 hover:-translate-y-0.5 hover:bg-purple-400/[0.12] hover:text-purple-100"
            >
              <TrackedLink href={productLinks.cloudObs} cta="more_about_cloud_obs" section="cloud_obs">
                More about Cloud OBS
                <ArrowRight className="size-4" aria-hidden="true" />
              </TrackedLink>
            </Button>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Your own OBS stays yours. Cloud OBS is there for the streams your PC cannot follow.
          </p>
        </div>
      </SectionView>
    </section>
  );
}
