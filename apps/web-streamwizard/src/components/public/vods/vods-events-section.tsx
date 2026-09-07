import { MousePointerClick, VolumeX, ZoomIn } from "lucide-react";
import { SectionView } from "../analytics/section-view";
import { Reveal, RevealGroup } from "../home/reveal";
import { EventStripDemo } from "./event-strip-demo";

/*
 * The timeline deep dive. The interactive demo in the shared band above is
 * about cutting one clip; this section inventories what the strip actually
 * marks, one event type at a time, through the auto-cycling strip in
 * EventStripDemo. The cards keep the claims the strip cannot carry.
 */

const FEATURES = [
  {
    icon: MousePointerClick,
    title: "Click an event, land on the moment",
    body: "The Stream Events panel sits next to the player. Click the raid and the player seeks to that exact second. Filters per event type keep 400 follows out of the way of the one raid you came for.",
  },
  {
    icon: VolumeX,
    title: "Muted audio, visible before you press play",
    body: "The stretches Twitch muted show as striped blocks on the track. You see the silence coming instead of finding it in the clip.",
  },
  {
    icon: ZoomIn,
    title: "Zoom to 20x",
    body: "Four hours is a lot of pixels. Zoom in until seconds have room, click anywhere to seek, and the watched part fills in behind the playhead.",
  },
];

export function VodsEventsSection() {
  return (
    <section id="vod-timeline" className="scroll-mt-24 py-20">
      <SectionView section="vods_events" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-amber-300 uppercase">The timeline</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Every follow, sub and raid, pinned to the second.</h2>
          <p className="mt-4 text-muted-foreground">
            StreamWizard records your stream&apos;s events while you are live, then lays them on the
            VOD&apos;s timeline as colored dots, along with the markers you or your editors drop
            mid-stream.
          </p>
        </div>

        <Reveal>
          <EventStripDemo />
        </Reveal>

        <RevealGroup
          className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3"
          items={FEATURES.map(({ icon: Icon, title, body }) => ({
            node: (
              <div className="h-full rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-amber-400" aria-hidden="true" />
                  <h3 className="text-sm font-semibold">{title}</h3>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ),
          }))}
        />
      </SectionView>
    </section>
  );
}
