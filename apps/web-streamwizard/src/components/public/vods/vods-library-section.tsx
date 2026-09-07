import { RefreshCw, Radio, Trash2 } from "lucide-react";
import { SectionView } from "../analytics/section-view";
import { Reveal } from "../home/reveal";
import { VodLibraryDemo } from "./vod-library-demo";

/*
 * The list view's claims live here and nowhere else: the demo above and the
 * timeline sections below are all about one open VOD, this section is about
 * the archive as a whole. The looped list vignette acts out the batch-delete
 * claim; the rail beside it keeps the words.
 */

const FEATURES = [
  {
    icon: RefreshCw,
    title: "Synced from Twitch",
    body: "Every archived broadcast Twitch kept, pulled straight from your channel. Hit refresh after a stream and the new VOD sits at the top, with pages going back through your history.",
  },
  {
    icon: Radio,
    title: "Live shows as live",
    body: "The stream you are running right now is already in the list, wearing a Live badge with the duration still counting.",
  },
  {
    icon: Trash2,
    title: "Clean up, five at a time",
    body: "Select the test streams and the dead VODs, delete them in batches of five. The five is Twitch's limit, not ours.",
  },
];

export function VodsLibrarySection() {
  return (
    <section className="py-20">
      <SectionView section="vods_library" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-amber-300 uppercase">The library</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Every VOD Twitch kept, in one list.</h2>
          <p className="mt-4 text-muted-foreground">
            Sign in with Twitch and your archive is just there. Nothing to upload, nothing to import.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
          <Reveal>
            <VodLibraryDemo />
          </Reveal>
          <Reveal>
            <div className="grid gap-6">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-amber-400" aria-hidden="true" />
                    <h3 className="text-sm font-semibold">{title}</h3>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </SectionView>
    </section>
  );
}
