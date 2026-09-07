import { ArrowRight } from "lucide-react";
import { Button } from "@repo/ui";
import { productSectionLinks } from "@/lib/constant";
import { SectionView } from "../analytics/section-view";
import { TrackedLink } from "../analytics/tracked-link";
import { Reveal } from "../home/reveal";
import { ClipCollageLoop } from "./clip-collage-loop";

/*
 * Cross-sell band, kept small on purpose: folders, filters and downloads get
 * their full story on /clips (which links back here through its own vods
 * door). This is the door, not a second copy of the room; ClipCollageLoop
 * drops the freshly cut clip onto the stack. Purple, because it points at
 * the clips pillar.
 */

export function ClipLibrarySection() {
  return (
    <section className="py-20">
      <SectionView section="clip_library" className="container mx-auto px-4">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <ClipCollageLoop />
            <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">After the cut</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Saved. It&apos;s in your clip library now.</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              The clip you just cut lands next to everything chat clipped: folders you name, filters
              that stack, downloads in landscape and portrait, and a URL to copy from the clip&apos;s
              own menu.
            </p>
            <div className="mt-8">
              <Button
                asChild
                variant="outline"
                size="lg"
                className="gap-2 border-purple-400/30 bg-purple-400/[0.06] px-7 text-purple-200 shadow-md transition-transform duration-200 hover:-translate-y-0.5 hover:bg-purple-400/[0.12] hover:text-purple-100"
              >
                <TrackedLink href={productSectionLinks.clipsLibrary} cta="see_clips_page" section="clip_library">
                  See the clip library
                  <ArrowRight className="size-4" aria-hidden="true" />
                </TrackedLink>
              </Button>
            </div>
          </div>
        </Reveal>
      </SectionView>
    </section>
  );
}
