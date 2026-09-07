import { SectionView } from "../analytics/section-view";
import { CheckItem } from "../layout/check-item";
import { Reveal } from "../home/reveal";
import { AlertBoxPlayground } from "./alert-box-playground";

/*
 * The special-treatment section for the alert box: the playground shows the
 * events and the layout, entrance and milestone settings, the list below
 * carries the depth a demo cannot: thresholds, queueing, the gift sub rule,
 * testing. The media block closes it out: every alert is somebody's file, so
 * the formats get named. No docs link yet; SW-199 publishes the media docs.
 */

const MEDIA_GROUPS: { label: string; items: string[]; note: string }[] = [
  {
    label: "Video",
    items: ["WebM", "MP4"],
    note: "WebM with a transparent background: motion, alpha, small files.",
  },
  {
    label: "Images",
    items: ["WebP", "PNG", "GIF", "AVIF"],
    note: "WebP first: same picture, smaller file. GIF works too.",
  },
  {
    label: "Sound",
    items: ["OGG", "MP3", "WAV"],
    note: "OGG first: smallest of the three. Keep it short.",
  },
];
export function AlertBoxSection() {
  return (
    <section className="py-20">
      <SectionView section="alert_box" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">Alert box</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
            Follows, subs, cheers, raids. <br /> Each one gets your media.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            29 events, including the ones most alert tools skip: watch streaks, modiversaries, shoutouts, the
            banhammer. Every one with its own media, its own sound, and a line you wrote. Fire a few below: the layout
            and entrance you pick are the same settings the editor has.
          </p>
        </div>

        <Reveal direction="scale">
          <AlertBoxPlayground />
        </Reveal>

        <Reveal>
          <div className="mx-auto mt-12 max-w-4xl">
            <ul className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
              <CheckItem>
                Set a minimum per event, and milestones above it at whatever breakpoints you type. Month 1, month 2 and
                month 12 of a resub can each be their own alert. Same for raid size, bits, streak length: a 3 viewer
                raid and a 300 viewer raid deserve different sounds.
              </CheckItem>
              <CheckItem>
                Write the title and message with <code className="font-mono text-xs">{"{name}"}</code>,{" "}
                <code className="font-mono text-xs">{"{amount}"}</code> and{" "}
                <code className="font-mono text-xs">{"{message}"}</code>. Your words, their name.
              </CheckItem>
              <CheckItem>
                Alerts queue instead of stacking. A raid mid gift bomb waits its turn, with a quiet gap you set between
                them.
              </CheckItem>
              <CheckItem>
                A gift bomb fires one gift alert, not one per recipient. The per-seat sub events are skipped on purpose.
              </CheckItem>
              <CheckItem>
                Per event duration, from 1 to 60 seconds, and a master volume over all of it for the sounds and video
                audio.
              </CheckItem>
              <CheckItem>
                Google Fonts, colors, an accent on the name and amount, and a text shadow so it reads on any scene.
              </CheckItem>
              <CheckItem>
                Test every event from the editor before anyone shows up: in the preview, or pushed through the real
                server into OBS.
              </CheckItem>
              <CheckItem>
                Every setting here is per event. Your raid alert can scream while your follow alert stays polite.
              </CheckItem>
            </ul>
          </div>
        </Reveal>

        <Reveal>
          <div className="mx-auto mt-12 max-w-4xl rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8">
            <div className="mx-auto max-w-xl text-center">
              <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">Your media</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Upload once to the media library, pick it in any alert or widget. Our recommendation: WebM, WebP and
                OGG. Smallest files, so the alert loads before the hype is over. 10MB max per file, 100MB of storage
                free.
              </p>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {MEDIA_GROUPS.map((group) => (
                <div key={group.label} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-purple-300">{group.label}</p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {group.items.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-xs text-foreground"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{group.note}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </SectionView>
    </section>
  );
}
