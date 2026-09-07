import { AUTO_SWITCHER_CHAT_TEMPLATE_DEFAULTS } from "@repo/schemas";
import { SectionView } from "@/components/public/analytics/section-view";
import { Reveal } from "@/components/public/home/reveal";
import { ChatNoticeFeed } from "./chat-notice-feed";

/*
 * Chat notices. The templates are the shipped defaults, imported rather than
 * retyped, and the feed beside them is rendering those same strings with the
 * demo walk's numbers. The three rules underneath are the ones that separate
 * this from a bot command: it is you talking, once per switch, and it never
 * says "back live" to a chat that was never told anything was wrong.
 */

const TEMPLATES = [
  { when: "Quality dropped", template: AUTO_SWITCHER_CHAT_TEMPLATE_DEFAULTS.degraded },
  { when: "Signal lost", template: AUTO_SWITCHER_CHAT_TEMPLATE_DEFAULTS.offline },
  { when: "Back live", template: AUTO_SWITCHER_CHAT_TEMPLATE_DEFAULTS.recovered },
];

const PLACEHOLDERS = [
  { token: "{bitrate}", body: "The bitrate arriving when it switched, in kbps." },
  { token: "{rtt}", body: "The round trip time to your phone, in milliseconds." },
  { token: "{loss}", body: "Dropped packets as a percentage, the number it judged." },
  { token: "{scene}", body: "The scene it moved you to." },
];

const RULES = [
  {
    title: "It posts as you",
    body: "Not as a bot in your mod list. Chat reads it as the streamer saying something, because that is what it is.",
  },
  {
    title: "Once per switch, not once per second",
    body: "The switcher can watch a metric flap for a minute. Chat hears about the switch, and nothing else.",
  },
  {
    title: "No all clear out of nowhere",
    body: "Back live only goes out if chat was told about a problem first, and only within ten minutes of it. Start a stream cold and it says nothing at all.",
  },
];

export function ChatNoticesSection() {
  return (
    <section className="py-20">
      <SectionView section="chat_notices" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Chat hears what happened. <br /> You do not type a word.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Three messages you write once. The switcher fills in the numbers behind the switch and posts them in your
            channel while your hands are busy holding a camera.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <Reveal direction="left">
            <div className="h-full rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8">
              <h3 className="text-xl font-semibold">The three you write</h3>
              <p className="mt-2 text-sm text-muted-foreground">These are the defaults. Change them to your voice.</p>
              <div className="mt-5 space-y-4">
                {TEMPLATES.map(({ when, template }) => (
                  <div key={when}>
                    <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">{when}</p>
                    <p className="mt-1.5 rounded-lg border border-white/[0.07] bg-black/30 px-3 py-2 font-mono text-xs leading-relaxed break-words text-foreground/90">
                      {template}
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-6 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Four things it fills in
              </p>
              <dl className="mt-3 space-y-2">
                {PLACEHOLDERS.map(({ token, body }) => (
                  <div key={token} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <dt className="rounded border border-purple-400/25 bg-purple-400/10 px-1.5 py-0.5 font-mono text-[11px] text-purple-200">
                      {token}
                    </dt>
                    <dd className="min-w-0 flex-1 text-xs text-muted-foreground">{body}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>

          <Reveal direction="right">
            <ChatNoticeFeed />
          </Reveal>
        </div>

        <div className="mx-auto mt-4 grid max-w-5xl gap-4 md:grid-cols-3">
          {RULES.map(({ title, body }, i) => (
            <Reveal key={title} delay={i * 0.05}>
              <div className="h-full rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </SectionView>
    </section>
  );
}
