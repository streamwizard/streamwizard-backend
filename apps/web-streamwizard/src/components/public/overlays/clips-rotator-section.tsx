import { ArrowRight } from "lucide-react";
import { Button } from "@repo/ui";
import { productSectionLinks } from "@/lib/constant";
import { getRotatorClips } from "@/lib/showcase-clips";
import { getShowcaseClipVideos } from "@/lib/showcase-clip-videos";
import { SectionView } from "../analytics/section-view";
import { TrackedLink } from "../analytics/tracked-link";
import { CheckItem } from "../layout/check-item";
import { Reveal } from "../home/reveal";
import { ClipsRotatorDemo } from "./clips-rotator-demo";

/*
 * The clips rotator, shown doing its job. The demo puts the source panel next
 * to the frame it fills, so picking a folder visibly changes what plays: an
 * earlier version drew the panel on its own, which explained the settings to
 * people who did not yet know what the widget was.
 *
 * The clips are the real ones, from the same hourly get_showcase_clips RPC
 * the landing page marquee runs on, so the titles and view counts in the
 * frame are not invented.
 *
 * The list below only carries what the demo cannot show: the buffering, the
 * random ordering rule, the display fields as layers, the audio. Folders come
 * from the clips page, and the link is the door to it.
 */
/** Enough clips to read as a rotation, few enough that the progress dots still do. */
const MAX_ROTATION = 12;

export async function ClipsRotatorSection() {
  const clips = await getRotatorClips();
  const videos = await getShowcaseClipVideos(clips.map((clip) => clip.id));

  /* A rotator that stops on a still contradicts the section it sits in, so
     the demo runs on the clips Twitch actually signed. If too few came back
     to make a rotation, every clip goes in and the unsigned ones show their
     thumbnail. Capped so the rotation stays a rotation and not a wall of
     progress dots. */
  const playable = clips.filter((clip) => videos[clip.id]);
  const demoClips = (playable.length >= 4 ? playable : clips).slice(0, MAX_ROTATION);

  return (
    <section id="clips-rotator" className="scroll-mt-24 py-20">
      <SectionView section="clips_rotator" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">Clips rotator</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Your clips, playing while you&apos;re away.</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Put it on your starting or BRB screen and it plays clips from your channel back to back. Which clips is a
            setting, not luck.
          </p>
        </div>

        <Reveal direction="scale">
          <ClipsRotatorDemo clips={demoClips} videos={videos} />
        </Reveal>

        <Reveal>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Pick a source on the left. The rotation follows.
          </p>
        </Reveal>

        <Reveal>
          <div className="mx-auto mt-12 max-w-4xl">
            <ul className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
              <CheckItem>
                Clips play to their end, and the next one is already buffered behind the one on screen. No black frame,
                no loading spinner between them.
              </CheckItem>
              <CheckItem>
                Random pushes what just played to the back of the pile instead of dropping it, so a folder with three
                clips in it still rotates.
              </CheckItem>
              <CheckItem>
                Title, creator, game, date, views and duration are each their own layer. Drag them, resize them, hide
                them, lock them.
              </CheckItem>
              <CheckItem>
                Muted for the browser, or audible in OBS with its own volume. A clip Twitch deleted gets skipped instead
                of stalling the rotation.
              </CheckItem>
            </ul>
          </div>
        </Reveal>

        <Reveal>
          <div className="mt-10 flex justify-center">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="gap-2 border-purple-400/30 bg-purple-400/[0.06] px-7 text-purple-200 shadow-md transition-transform duration-200 hover:-translate-y-0.5 hover:bg-purple-400/[0.12] hover:text-purple-100"
            >
              <TrackedLink href={productSectionLinks.clipsFolders} cta="see_clips_page" section="clips_rotator">
                Folders live on the clips page
                <ArrowRight className="size-4" aria-hidden="true" />
              </TrackedLink>
            </Button>
          </div>
        </Reveal>
      </SectionView>
    </section>
  );
}
