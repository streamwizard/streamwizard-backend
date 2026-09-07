import { MapPin, ShieldCheck, Wrench } from "lucide-react";
import { SectionView } from "@/components/public/analytics/section-view";
import { RevealGroup } from "@/components/public/home/reveal";

/*
 * How the thing gets built, as three short rules. Static cards on a stagger;
 * the animations live in the sections around this one, so this one stays
 * quiet on purpose. Pricing and the community goal deliberately live in the
 * goal section, not here, so nothing on the page says the same thing twice.
 */

const PRINCIPLES = [
  {
    icon: MapPin,
    title: "IRL first.",
    body: "Cloud OBS is aimed at the street. The deck on your phone runs it, and when the connection dies the auto switcher holds the stream instead of ending it.",
  },
  {
    icon: ShieldCheck,
    title: "Your data is not the product.",
    body: "Analytics are cookieless by default. The banner asks before anything else gets switched on.",
  },
  {
    icon: Wrench,
    title: "Small fixes, shipped fast.",
    body: "Bug reports get picked up while they are still fresh. No ticket portal, no tiers.",
  },
] as const;

export function PrinciplesSection() {
  return (
    <section className="py-20">
      <SectionView section="principles" className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it gets built.</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Three rules that survived contact with production.
          </p>
        </div>

        <RevealGroup
          className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3"
          items={PRINCIPLES.map((principle) => ({
            node: (
              <div className="h-full rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10">
                  <principle.icon className="h-5 w-5 text-purple-300" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{principle.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{principle.body}</p>
              </div>
            ),
          }))}
        />
      </SectionView>
    </section>
  );
}
