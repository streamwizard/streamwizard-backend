import { History, RadioTower, RefreshCw } from "lucide-react";
import { SectionView } from "../analytics/section-view";
import { Reveal } from "../home/reveal";
import { SyncTimeline } from "./sync-timeline";

/*
 * The sync story is the one thing the folders mock above cannot show: clips
 * arrive on their own. The vignette plays the stream-end trigger on loop,
 * the bullets carry the mechanics, including the once-an-hour honesty.
 */

const SYNC_FEATURES = [
  {
    icon: RadioTower,
    title: "Synced when you go offline",
    body: "The moment Twitch marks you offline, StreamWizard pulls every clip from the stream. On by default, a toggle if you want it off.",
  },
  {
    icon: History,
    title: "The whole backlog, first sync",
    body: "Your first sync walks your entire clip history, a hundred at a time. Years of backlog included.",
  },
  {
    icon: RefreshCw,
    title: "A Sync button for the impatient",
    body: "Need the mid-stream ace right now? Hit Sync in the filter bar. Once an hour, because Twitch has rate limits and so do we.",
  },
];

export function ClipsSyncSection() {
  return (
    <section className="py-20">
      <SectionView section="clips_sync" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">Auto sync</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Your stream ends. Your clips are already here.</h2>
          <p className="mt-4 text-muted-foreground">
            StreamWizard listens for the end of your stream and pulls every clip from it. Nothing to
            export, nothing to remember.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
          <Reveal direction="left">
            <SyncTimeline />
          </Reveal>
          <Reveal direction="right">
            <div className="space-y-6">
              {SYNC_FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-purple-400" aria-hidden="true" />
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
