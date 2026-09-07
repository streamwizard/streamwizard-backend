import type { ReactNode } from "react";
import { productSectionLinks } from "@/lib/constant";
import { TrackedLink } from "../analytics/tracked-link";
import { Bell, Clapperboard, Code2, Layers, Lock, MapPin, Timer } from "lucide-react";
import { ClipsRotatorMini, CountdownMini, GoalsMini, SubathonMini, WalkingStatsMini } from "./overlay-widget-demos";
import { AlertBoxSketch } from "./alert-box-sketch";

/*
 * The widget library, one card each, with a small drawing of what the widget
 * puts on stream. Copy sticks to what the editor actually ships: the alert
 * events, the clips filters, the countdown modes, the IRL GPS widgets, the
 * custom widget sandbox, and the editor's own tools. Chat is not in here: it
 * plays in the live scene of the demo above instead.
 */

function Card({
  icon: Icon,
  title,
  body,
  footer,
  className,
  children,
}: {
  icon: typeof Bell;
  title: string;
  body: string;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={
        "flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 transition-colors hover:border-white/[0.12] sm:p-5 " +
        (className ?? "")
      }
    >
      <div>{children}</div>
      <div className="mt-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-purple-400" aria-hidden="true" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
      {footer ? <div className="mt-auto pt-3">{footer}</div> : null}
    </div>
  );
}

/** A few lines from a custom widget, and the field it exposes to the inspector. */
function CustomWidgetSketch() {
  return (
    <div
      role="img"
      aria-label="A custom widget's code next to the setting it exposes: a colour picker for the accent colour"
      className="space-y-2"
    >
      <pre
        aria-hidden="true"
        className="overflow-hidden rounded-lg border border-white/[0.07] bg-black/60 p-3 font-mono text-[11px] leading-relaxed"
      >
        <code>
          <span className="text-muted-foreground">{"<div "}</span>
          <span className="text-sky-300">class</span>
          <span className="text-muted-foreground">=</span>
          <span className="text-amber-200">{'"text-4xl font-bold"'}</span>
          <span className="text-muted-foreground">{">"}</span>
          {"\n"}
          <span className="text-muted-foreground">{"  <span "}</span>
          <span className="text-sky-300">id</span>
          <span className="text-muted-foreground">=</span>
          <span className="text-amber-200">{'"deaths"'}</span>
          <span className="text-muted-foreground">{">0</span>"}</span>
          {"\n"}
          <span className="text-muted-foreground">{"</div>"}</span>
          {"\n\n"}
          <span className="text-purple-300">StreamWizard</span>
          <span className="text-muted-foreground">.on(</span>
          <span className="text-green-300">{'"channel.cheer"'}</span>
          <span className="text-muted-foreground">, bump)</span>
        </code>
      </pre>
      <div
        aria-hidden="true"
        className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2"
      >
        <span className="text-xs text-muted-foreground">Accent colour</span>
        <span className="flex items-center gap-2 font-mono text-[11px] text-foreground">
          <span className="h-3.5 w-3.5 rounded-sm border border-white/20 bg-[#9e7aff]" />
          #9e7aff
        </span>
      </div>
    </div>
  );
}

const LAYERS = [
  { name: "Alert box" },
  { name: "Clips rotator", active: true },
  { name: "Countdown" },
  { name: "Camera frame", locked: true },
];

/** The editor: a selected widget snapping to the scene centre, and the layer list. */
function EditorSketch() {
  return (
    <div
      role="img"
      aria-label="The overlay editor: a canvas with the clips widget selected and snapped to the centre line, next to the layers panel"
      className="flex gap-2"
    >
      <div
        aria-hidden="true"
        className="relative aspect-video min-w-0 flex-1 overflow-hidden rounded-lg border border-white/[0.07] bg-black"
      >
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:16px_16px]" />
        {/* Snap guide: vertical centre line */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-purple-400/70" />
        {/* Selected widget, centred on the guide */}
        <div className="absolute left-[32%] right-[32%] top-[22%] aspect-video rounded border-2 border-dashed border-purple-400/80 bg-purple-500/10">
          <span className="absolute -left-1 -top-1 h-2 w-2 border border-purple-400 bg-background" />
          <span className="absolute -right-1 -top-1 h-2 w-2 border border-purple-400 bg-background" />
          <span className="absolute -bottom-1 -left-1 h-2 w-2 border border-purple-400 bg-background" />
          <span className="absolute -bottom-1 -right-1 h-2 w-2 border border-purple-400 bg-background" />
          <span className="absolute -top-5 left-0 rounded bg-purple-500/20 px-1 font-mono text-[8px] text-purple-200">
            640 × 360
          </span>
        </div>
        {/* Another widget, not selected */}
        <div className="absolute right-[6%] top-[8%] rounded border border-white/[0.15] bg-white/[0.05] px-1.5 py-0.5 font-mono text-[8px] text-muted-foreground">
          19:42:05
        </div>
      </div>
      <div aria-hidden="true" className="flex w-24 shrink-0 flex-col gap-1">
        <p className="px-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Layers</p>
        {LAYERS.map(({ name, active, locked }) => (
          <div
            key={name}
            className={
              "flex items-center justify-between truncate rounded-md border px-1.5 py-1 text-[10px] " +
              (active
                ? "border-purple-500/50 bg-purple-500/10 text-purple-300"
                : "border-white/[0.07] bg-white/[0.03] text-muted-foreground")
            }
          >
            <span className="truncate">{name}</span>
            {locked ? <Lock className="ml-1 h-2.5 w-2.5 shrink-0" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function OverlayWidgetCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
      <Card
        icon={Bell}
        title="Alert box, every Twitch event"
        body="Follows, subs, cheers, raids, and the notices most alert tools skip: watch streaks, modiversaries, charity donations, bits badges, pay it forward. Each one gets its own media, sound, a title you write, and a second line for what the viewer typed. Test it from the editor before anyone shows up."
        className="md:col-span-2 lg:col-span-6"
      >
        <AlertBoxSketch />
      </Card>

      <Card
        icon={Clapperboard}
        title="Clips rotator"
        body="Every clip from your channel, rotating on a BRB or starting screen. Pick a folder, a game, or shuffle all of them. Put the title, creator, and views where you want them."
        className="lg:col-span-2"
      >
        <ClipsRotatorMini />
      </Card>

      <Card
        icon={MapPin}
        title="Live GPS stats for IRL"
        body="Speed, distance, the city you are in, and the weather there, from the phone you stream from. No extra hardware. Latitude and longitude are in there too, so maybe do not dox yourself."
        footer={
          <TrackedLink
            href={productSectionLinks.cloudObsIrlOverlays}
            cta="see_irl_setup"
            section="overlays"
            className="text-sm text-purple-300 transition-colors hover:text-purple-200"
          >
            See the IRL setup
          </TrackedLink>
        }
        className="lg:col-span-2"
      >
        <WalkingStatsMini />
      </Card>

      <Card
        icon={Timer}
        title="Countdowns, goals, and the subathon clock"
        body="Count down a break or to a set date and time, on a clock in your time zone. Follower and sub goals that fill while you stream. A subathon timer that gains time on every sub, cheer, and gift."
        className="lg:col-span-2"
      >
        <div className="space-y-2">
          <CountdownMini />
          <SubathonMini />
          <GoalsMini />
        </div>
      </Card>

      <Card
        icon={Code2}
        title="Custom widgets"
        body="HTML, JavaScript, and Tailwind, with a live preview while you type. Add settings fields so you tweak it without opening the code. Start from a starter or the public library."
        className="lg:col-span-3"
      >
        <CustomWidgetSketch />
      </Card>

      <Card
        icon={Layers}
        title="A real editor"
        body="Layers, snapping, drag to resize, undo. Lock what should stay put. Fire fake follows and a simulated walk to test it before you go live."
        className="lg:col-span-3"
      >
        <EditorSketch />
      </Card>
    </div>
  );
}
