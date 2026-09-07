import { ArrowRight } from "lucide-react";
import { Button } from "@repo/ui";
import { docsLink } from "@/lib/constant";
import { SectionView } from "../analytics/section-view";
import { TrackedLink } from "../analytics/tracked-link";
import { Reveal } from "../home/reveal";
import { WidgetLibraryMock } from "./widget-library-mock";

/*
 * The library, told for the streamer who does not write code: browse, install,
 * tweak the fields. The dev story is one block at the bottom with a door to
 * the widget docs; the section does not try to teach the API.
 */

const LIBRARY_POINTS: { title: string; body: string }[] = [
  {
    title: "Install makes a copy",
    body: "Your install is your own widget, code and settings. The author shipping an update never changes yours mid-stream.",
  },
  {
    title: "Settings, not source",
    body: "Widgets expose fields: colors, text, toggles, your own media. You tweak those in the inspector and never see the code.",
  },
  {
    title: "Reviewed before listed",
    body: "Community widgets pass a human review before they show up in the library. No mystery scripts in your browser source.",
  },
];

export function WidgetLibrarySection() {
  return (
    <section className="py-20">
      <SectionView section="widget_library" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">Widget library</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Someone already built it.</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Browse widgets other streamers published, hit install, tweak the settings. No code anywhere in that
            sentence.
          </p>
        </div>

        <Reveal direction="scale">
          <WidgetLibraryMock />
        </Reveal>

        <Reveal>
          <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-3">
            {LIBRARY_POINTS.map((point) => (
              <div key={point.title} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
                <p className="text-sm font-semibold">{point.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{point.body}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal>
          <div className="mx-auto mt-12 max-w-2xl rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 text-center sm:p-8">
            <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">For the devs</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Built something? The widget editor takes HTML, JavaScript and Tailwind, previews it live while you type,
              and reacts to some 75 stream events, from cheers to hype trains to GPS. Give it fields so the streamer
              installing it never opens the code, then publish it back to the library.
            </p>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="mt-5 gap-2 border-purple-400/30 bg-purple-400/[0.06] px-7 text-purple-200 shadow-md transition-transform duration-200 hover:-translate-y-0.5 hover:bg-purple-400/[0.12] hover:text-purple-100"
            >
              <TrackedLink
                href={`${docsLink}/widgets/quickstart`}
                cta="read_widget_docs"
                section="widget_library"
                target="_blank"
                rel="noopener noreferrer"
              >
                Read the widget docs
                <ArrowRight className="size-4" aria-hidden="true" />
              </TrackedLink>
            </Button>
          </div>
        </Reveal>
      </SectionView>
    </section>
  );
}
