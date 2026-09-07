import { SectionView } from "../analytics/section-view";
import { CheckItem } from "../layout/check-item";
import { Reveal } from "../home/reveal";
import { EditorCanvasSketch } from "./editor-canvas-sketch";

/*
 * The editor tour: the list carries the tools a static picture cannot show
 * moving, the sketch anchors what the canvas looks like.
 */

export function EditorSection() {
  return (
    <section className="py-20">
      <SectionView section="overlay_editor" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">The editor</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">An editor, not a settings form.</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Drag widgets on a canvas, snap them to guides, lock what should stay put, undo the mistake.
          </p>
        </div>

        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal direction="left">
            <h3 className="text-xl font-semibold">The tools you expect from a canvas</h3>
            <ul className="mt-6 space-y-3">
              <CheckItem>Layers with lock and hide, multi-select, duplicate, and undo when it goes wrong.</CheckItem>
              <CheckItem>Snapping with alignment guides, so the countdown is actually centered.</CheckItem>
              <CheckItem>
                Shrink a widget and its text scales with it instead of cropping. Crop it on purpose when you want to.
              </CheckItem>
              <CheckItem>Google Fonts on any text, and your own gifs and sounds from the media library.</CheckItem>
              <CheckItem>Rotation, opacity and z-index on every widget. No mode switch to find them.</CheckItem>
              <CheckItem>
                Fire fake follows, cheers and a simulated walk through Amsterdam to test it before you go live.
              </CheckItem>
            </ul>
          </Reveal>
          <Reveal direction="right">
            <EditorCanvasSketch />
          </Reveal>
        </div>

      </SectionView>
    </section>
  );
}
