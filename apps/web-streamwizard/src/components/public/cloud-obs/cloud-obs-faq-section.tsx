import { SectionView } from "@/components/public/analytics/section-view";
import { Reveal } from "@/components/public/home/reveal";
import { FaqAccordion } from "@/components/public/home/faq-accordion";
import { PRICING_FAQ_LINK } from "@/lib/pricing";

/*
 * The page's FAQ, and the last stop before the beta note. It defines the
 * terms the page leans on (cloud OBS, IRL, SRT, SRTLA) and answers the
 * objections the sections above cannot: no PC at home, what you stream with,
 * whether a stopped container eats your scenes, and whether this is real OBS.
 * The cost answer is one sentence and points at /pricing (SW-303); the beta
 * note underneath carries the Discord route.
 * Its own section id so the funnel dashboard can tell it apart from the home
 * FAQ. CLOUD_OBS_FAQ_ITEMS also feeds the page's FAQPage JSON-LD, so answers
 * must stand on their own: AI answers quote them without the page around them.
 */

export const CLOUD_OBS_FAQ_ITEMS = [
  /* Four definitions first (SW-306): cloud OBS, IRL, SRT and SRTLA are used
   * all over this page and nowhere else on the web are they explained in
   * StreamWizard's terms. Each answer opens with the literal definition and
   * stands alone, so an answer engine can quote it without the page. */
  {
    question: "What is cloud OBS?",
    answer:
      "Cloud OBS is a real copy of OBS Studio running in a container on StreamWizard's servers instead of on a PC at home, and it is the thing streaming to Twitch. Your phone or encoder sends video to a StreamWizard ingest server, cloud OBS picks that feed up as a source, and OBS does the rest: scenes, overlays, browser sources and the encode to Twitch. You control it from the deck, a web app on your phone, or open the full OBS window in your browser. Because the encode happens on a machine with a wired connection, your side only has to get video to the ingest. If that link drops, the auto switcher moves OBS to a fallback scene and your channel stays live. Cloud OBS is the paid part of StreamWizard and is in invite-only beta right now.",
  },
  {
    question: "What is IRL streaming?",
    answer:
      "IRL streaming is broadcasting live from outside on a mobile connection, with a phone or a bonding encoder as the camera instead of a PC and a webcam. Walks, drives, markets, festivals: the stream goes wherever you go, which is the appeal and the problem. Mobile signal comes and goes. A tower handover, a tunnel or a crowd on the same cell can drop your bitrate for a few seconds, and on a normal setup that means a frozen frame or a dead stream. IRL setups deal with this in two places: an encoder that speaks SRT or SRTLA so a rough patch arrives as normal video, and something at the other end that covers for you when the connection fails. In StreamWizard that other end is cloud OBS with the auto switcher, so chat sees a fallback scene instead of a frozen face.",
  },
  {
    question: "Do I need a PC running at home?",
    answer:
      "No. OBS runs in a container in the cloud, on our machines, and it is the thing streaming to Twitch. Your phone only sends video to the ingest. It can drop to one bar, switch networks or run out of battery, and your Twitch stream stays up on the fallback scene.",
  },
  {
    question: "What do I stream from the street with?",
    answer:
      "Any app or encoder that speaks SRT or SRTLA. A streaming app on your phone, or a bonding encoder like Belabox, Moblin or IRLToolkit. One connection goes to the SRT URL, several at once go to the SRTLA one, and both use the same key.",
  },
  {
    question: "What is SRT?",
    answer:
      "SRT (Secure Reliable Transport) is a video transport protocol built for unreliable networks, which makes it the standard way to get an IRL stream from a phone to a server. It runs over UDP and keeps a latency buffer on both ends: your encoder holds the last few seconds of video, and when a packet goes missing the receiver asks for it again and gets it before it is due to play. On the usual defaults that buffer is 2.5 seconds on the encoder, and the StreamWizard ingest holds 4 more, which is why a tower handover arrives as normal video instead of a stutter. Almost every IRL app and encoder speaks SRT. With StreamWizard you point it at the SRT URL on port 8888, paste your key in as the stream ID, and cloud OBS picks the feed up.",
  },
  {
    question: "What is SRTLA?",
    answer:
      "SRTLA (SRT Live Ack) is an extension of SRT that bonds several internet connections into one stream, so two SIMs, a SIM and wifi, or everything you can get your hands on arrive at the ingest as a single SRT feed. Each connection carries a share of the packets and the receiver puts them back in order. When one connection walks into a dead spot the others carry the stream, and when it comes back it rejoins without your stream noticing. That is the difference from plain SRT: SRT survives a rough patch on one connection, SRTLA survives losing a connection. Bonding encoders like Belabox and Moblin speak it, and so does IRLToolkit. On StreamWizard the SRTLA URL uses port 5000, the SRT URL uses 8888, and both take the same key, so pick whichever matches how many connections you stream over.",
  },
  {
    question: "How long is the delay?",
    answer:
      "Around 10 seconds from your camera to a viewer's screen. Your encoder holds an SRT latency buffer, 2.5 seconds on the usual defaults, the ingest holds 4 more, and Twitch adds its own on top. That buffer is the point: it swallows the packets a tower handover loses, so a rough minute of walking arrives as normal video instead of a stutter, and the switcher still has good frames to play with while it decides.",
  },
  {
    question: "Is it real OBS, or your version of it?",
    answer:
      "Real OBS. You open a window in your browser and you are looking at the actual OBS running in your container, scene list and all. Browser sources from any alert provider work the same as they do at home, so bring the overlays you already use.",
  },
  {
    question: "Do I lose my scenes when I stop the container?",
    answer:
      "No. Scenes, sources and uploaded files live on your container and come back the next time you start it. Stop it between streams so it is not sitting there running while you sleep.",
  },
  {
    question: "What does it cost?",
    answer:
      "Cloud OBS, the ingest server and the deck are the paid part of StreamWizard, in invite-only beta right now, so access goes out by hand in Discord.",
    link: PRICING_FAQ_LINK,
  },
] as const;

export function CloudObsFaqSection() {
  return (
    <section className="py-20">
      <SectionView section="cloud_obs_faq" className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">FAQ</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Before you launch a container.</h2>
          <p className="mt-4 text-muted-foreground">
            What the words mean, what you need, what persists, and what it costs.
          </p>
        </div>

        <Reveal>
          <div className="mx-auto max-w-3xl">
            <FaqAccordion items={CLOUD_OBS_FAQ_ITEMS} />
          </div>
        </Reveal>
      </SectionView>
    </section>
  );
}
