import { SectionView } from "../analytics/section-view";
import { Reveal } from "../home/reveal";
import { ClipCreationDemo } from "./clip-creation-demo";

/*
 * The mechanics of clip creation, staged. The interactive version lives in
 * the shared band at the top of the page (VodTimelineDemo); this section
 * plays the three steps on a loop instead, with the numbered rail tracking
 * the phase. The step copy lives in ClipCreationDemo next to the animation
 * that acts it out.
 */

export function VodsClipCreationSection() {
  return (
    <section className="py-20">
      <SectionView section="vods_clip_creation" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-amber-300 uppercase">Create clip</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Two handles, a loop, and a name.</h2>
          <p className="mt-4 text-muted-foreground">
            No editor, no export queue. Cutting a clip out of a four hour VOD is three steps, and you
            hear the cut before you commit to it.
          </p>
        </div>

        <Reveal className="mx-auto max-w-5xl">
          <ClipCreationDemo />
        </Reveal>
      </SectionView>
    </section>
  );
}
