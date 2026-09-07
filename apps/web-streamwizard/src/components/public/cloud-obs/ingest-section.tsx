import { Antenna, Layers } from "lucide-react";
import { SectionView } from "@/components/public/analytics/section-view";
import { TrackedLink } from "@/components/public/analytics/tracked-link";
import { Reveal } from "@/components/public/home/reveal";
import { CheckItem } from "@/components/public/layout/check-item";
import { docsLink } from "@/lib/constant";
import { SignalPath } from "./signal-path";

/*
 * The ingest server. The one thing a streamer has to decide here is SRT or
 * SRTLA, so the two cards are written as that choice and nothing else: no
 * transport internals, no buffer, no packets. Whoever wants the mechanics is
 * reading the docs, and the buffer gets explained where it earns its keep, in
 * the presets section.
 */

const PROTOCOLS = [
  {
    icon: Antenna,
    name: "SRT",
    port: "8888",
    tagline: "One connection. Start here.",
    body: "A phone with one SIM, a phone on wifi, or a single encoder. Point it at the SRT URL, paste your key in as the stream ID, and you are live. This is what most IRL streamers use and it needs nothing you do not already own.",
    bullets: [
      "Any app or encoder that speaks SRT.",
      "Made for connections that come and go, so a rough patch stays a rough patch instead of a dead stream.",
    ],
  },
  {
    icon: Layers,
    name: "SRTLA",
    port: "5000",
    tagline: "Several connections at once.",
    body: "Two connections or ten, arriving as one stream. Two SIMs, a SIM and wifi, or everything you can get your hands on. When one of them walks into a dead spot the others carry you, so pick this if one connection does not cover where you stream.",
    bullets: [
      "Belabox, Moblin, IRLToolkit and anything else that speaks SRTLA.",
      "A connection can drop and come back without your stream noticing.",
    ],
  },
];

export function IngestSection() {
  return (
    <section className="py-20">
      <SectionView section="ingest" className="container mx-auto px-4">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Your phone streams in. <br /> The cloud stays on air.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Whatever you stream with connects to a StreamWizard ingest server, and your cloud OBS picks the feed up from
            there. One thing to decide: how many connections you are streaming over.
          </p>
        </div>

        <Reveal>
          <SignalPath />
        </Reveal>

        <Reveal className="mt-16">
          <p className="text-center font-mono text-xs tracking-widest text-muted-foreground uppercase">Pick one</p>
        </Reveal>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {PROTOCOLS.map(({ icon: Icon, name, port, tagline, body, bullets }, i) => (
            <Reveal key={name} delay={i * 0.05}>
              <div className="h-full rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10">
                    <Icon className="h-4 w-4 text-purple-300" aria-hidden="true" />
                  </span>
                  <h3 className="text-xl font-semibold">{name}</h3>
                  <span className="ml-auto font-mono text-[11px] text-muted-foreground">port {port}</span>
                </div>
                <p className="mt-4 text-sm font-medium text-foreground">{tagline}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                <ul className="mt-5 space-y-3">
                  {bullets.map((bullet) => (
                    <CheckItem key={bullet}>{bullet}</CheckItem>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-4">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8">
            <h3 className="text-xl font-semibold">One key, two URLs</h3>
            <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <dl className="space-y-3 rounded-lg border border-white/[0.07] bg-black/40 p-4">
                  {[
                    { label: "SRT", value: "srt://your-ingest:8888" },
                    { label: "SRTLA", value: "srtla://your-ingest:5000" },
                    { label: "Stream ID", value: "4f2a…c91b" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">{label}</dt>
                      <dd className="mt-0.5 overflow-x-auto font-mono text-xs whitespace-nowrap text-foreground/90">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">
                  Copy them from the dashboard, or have the key sent to you as a Discord DM so you are not typing 64
                  characters on a phone.
                </p>
              </div>
              <ul className="space-y-3">
                <CheckItem>
                  Rotate the key whenever you want. The old one stops working the second the new one appears.
                </CheckItem>
                <CheckItem>
                  Your OBS boots with a scene called IRL and a source called StreamWizard Ingest, already pointed at
                  your feed. Nothing to wire up.
                </CheckItem>
                <CheckItem>
                  Plain RTMP works too, but the auto switcher only sees your bitrate on it, not your ping or your
                  dropped packets.
                </CheckItem>
              </ul>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Setting yours up for the first time?{" "}
              <TrackedLink
                href={`${docsLink}/irl/overview`}
                cta="read_irl_docs"
                section="ingest"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-300 transition-colors hover:text-purple-200"
              >
                Read the IRL docs
              </TrackedLink>
              .
            </p>
          </div>
        </Reveal>
      </SectionView>
    </section>
  );
}
