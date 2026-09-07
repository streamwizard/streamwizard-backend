import { Feather, Radio, Server } from "lucide-react";
import { SectionView } from "@/components/public/analytics/section-view";
import { Reveal, RevealGroup } from "@/components/public/home/reveal";

/*
 * The reasoning behind the split, so "why is this one paid" is answered on
 * the page rather than in a Discord thread. Three cards: two for what Cloud
 * OBS burns, one for why the rest does not. No claim about idle servers being
 * reserved: instances start when you start them.
 */

const REASONS = [
  {
    icon: Server,
    title: "An OBS per channel.",
    body: "Every Cloud OBS is its own instance, encoding your stream for the whole broadcast. That is CPU time you would otherwise be buying in a PC.",
  },
  {
    icon: Radio,
    title: "Ingest traffic both ways.",
    body: "SRTLA bonds your mobile connections into the ingest server, and the server pushes the result to Twitch. Bandwidth is metered on both legs.",
  },
  {
    icon: Feather,
    title: "The free tools are cheap to run.",
    body: "Clips, overlays and analytics are a web app talking to Twitch's API. The cost stays near zero, so the price does too.",
  },
] as const;

export function WhyPaidSection() {
  return (
    <section className="py-20">
      <SectionView section="pricing_why" className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Why Cloud OBS costs money.</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            The free tools are a web app and Twitch&apos;s API. Cloud OBS is hardware.
          </p>
        </div>

        <RevealGroup
          className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3"
          items={REASONS.map((reason) => ({
            node: (
              <div className="h-full rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10">
                  <reason.icon className="h-5 w-5 text-purple-300" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{reason.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{reason.body}</p>
              </div>
            ),
          }))}
        />

        <Reveal className="mx-auto mt-10 max-w-2xl text-center">
          <p className="text-lg text-muted-foreground">
            Most of it free. The parts that burn server money cost money. That is the whole pricing
            model.
          </p>
        </Reveal>
      </SectionView>
    </section>
  );
}
