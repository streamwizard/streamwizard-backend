import { Download } from "lucide-react";
import { SectionView } from "../analytics/section-view";
import { RevealGroup } from "../home/reveal";

/*
 * Downloads close the page: the clip leaves the dashboard the same way it
 * came in, straight from Twitch. Portrait is honest about availability;
 * Twitch only renders that cut for some clips, so the copy says "when".
 */

const SHAPES = [
  {
    key: "landscape",
    label: "16:9",
    title: "Landscape",
    body: "The clip as it aired, straight from Twitch with no re-encoding. Ready for YouTube or your editor.",
    frame: "aspect-video w-56 sm:w-64",
  },
  {
    key: "portrait",
    label: "9:16",
    title: "Portrait",
    body: "When Twitch made a portrait cut, it sits right next to the landscape one. Ready for Shorts and TikTok without opening an editor.",
    frame: "aspect-[9/16] w-24 sm:w-28",
  },
];

export function ClipsDownloadsSection() {
  return (
    <section className="py-20">
      <SectionView section="clips_downloads" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">Downloads</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Download from the dashboard, in both shapes.</h2>
          <p className="mt-4 text-muted-foreground">
            Every clip&apos;s menu has a download button. No copy-pasting links into a sketchy
            downloader site.
          </p>
        </div>

        <RevealGroup
          className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2"
          items={SHAPES.map(({ key, label, title, body, frame }) => ({
            node: (
              <div key={key} className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
                <div className="flex h-40 items-center justify-center">
                  <div
                    className={`flex items-center justify-center rounded-lg border border-purple-400/30 bg-purple-400/[0.06] ${frame}`}
                    aria-hidden="true"
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <Download className="size-4 text-purple-300" />
                      <span className="font-mono text-[10px] text-muted-foreground">{label}</span>
                    </div>
                  </div>
                </div>
                <h3 className="mt-4 text-sm font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ),
          }))}
        />
      </SectionView>
    </section>
  );
}
