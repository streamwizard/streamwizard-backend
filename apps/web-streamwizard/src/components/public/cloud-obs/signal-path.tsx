"use client";

import { Fragment, type ComponentType } from "react";
import { MotionConfig, motion } from "motion/react";
import { MonitorPlay, Radio, Smartphone } from "lucide-react";
import { FaTwitch } from "react-icons/fa";

/*
 * Where the picture goes: phone, ingest, cloud OBS, Twitch. Four stops instead
 * of the overlays section's three, same idiom on purpose, with a packet
 * travelling each wire so the direction reads without a caption.
 */

interface Stop {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  title: string;
  body: string;
}

const STOPS: Stop[] = [
  {
    icon: Smartphone,
    title: "Your phone or encoder",
    body: "Whatever you already stream with. It sends out over SRT or SRTLA.",
  },
  {
    icon: Radio,
    title: "StreamWizard ingest",
    body: "Catches your feed and keeps an eye on how it is doing, once a second.",
  },
  {
    icon: MonitorPlay,
    title: "Your cloud OBS",
    body: "Pulls that feed into the IRL scene it set up for you on first boot.",
  },
  {
    icon: FaTwitch,
    title: "Twitch",
    body: "OBS streams out from the cloud, so your phone is not the thing on air.",
  },
];

function Wire({ delay }: { delay: number }) {
  return (
    <div aria-hidden="true" className="relative mt-4 hidden h-px w-10 shrink-0 bg-white/[0.1] md:block lg:w-16">
      <MotionConfig reducedMotion="user">
        <motion.span
          className="absolute -top-[3px] left-0 h-[7px] w-[7px] rounded-full bg-purple-400 shadow-[0_0_8px_rgba(158,122,255,0.9)]"
          animate={{ left: ["0%", "100%"], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.6, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.6, delay }}
        />
      </MotionConfig>
    </div>
  );
}

export function SignalPath() {
  return (
    <div className="flex flex-col items-start justify-center gap-6 md:flex-row md:items-start md:gap-3">
      {STOPS.map(({ icon: Icon, title, body }, i) => (
        <Fragment key={title}>
          <div className="flex min-w-0 flex-1 flex-col items-center text-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10">
              <Icon className="h-4 w-4 text-purple-300" aria-hidden="true" />
            </span>
            <p className="mt-2 text-sm font-semibold">{title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
          </div>
          {i < STOPS.length - 1 ? <Wire delay={i * 0.5} /> : null}
        </Fragment>
      ))}
    </div>
  );
}
