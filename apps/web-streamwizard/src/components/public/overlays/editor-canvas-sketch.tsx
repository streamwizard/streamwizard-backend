import { Eye, Lock } from "lucide-react";

/*
 * The editor at a glance, drawn: canvas with a widget snapped to the centre
 * guide, the layers panel, and a slim inspector. A bigger cousin of the small
 * sketch in the home page bento, which is module-private over there and half
 * this size. Purely presentational, so the section stays a server component.
 */

const LAYERS: { name: string; active?: boolean; locked?: boolean }[] = [
  { name: "Alert box" },
  { name: "Clips rotator", active: true },
  { name: "Countdown" },
  { name: "Walking stats" },
  { name: "Camera frame", locked: true },
];

const INSPECTOR_FIELDS: { label: string; value: string }[] = [
  { label: "X", value: "640" },
  { label: "Y", value: "238" },
  { label: "W", value: "640" },
  { label: "H", value: "360" },
  { label: "Opacity", value: "100%" },
  { label: "Font", value: "Inter" },
];

export function EditorCanvasSketch() {
  return (
    <div
      role="img"
      aria-label="The overlay editor: a canvas with the clips widget selected and snapped to the centre line, the layers panel with a locked camera frame, and the inspector with position, size, opacity and font"
      className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 shadow-[0_16px_48px_-16px_rgba(158,122,255,0.25)]"
    >
      <div aria-hidden="true">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Scene · Starting soon</p>
          <div className="flex gap-1 font-mono text-[9px] uppercase tracking-widest">
            <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-muted-foreground">Simple</span>
            <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-purple-300">Pro</span>
          </div>
        </div>

        <div className="flex gap-2">
          {/* The canvas */}
          <div className="relative aspect-video min-w-0 flex-1 overflow-hidden rounded-lg border border-white/[0.07] bg-black">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:16px_16px]" />
            {/* Snap guides: the selected widget sits on the centre line */}
            <div className="absolute inset-y-0 left-1/2 w-px bg-purple-400/70" />
            <div className="absolute inset-x-0 top-[22%] h-px bg-purple-400/40" />
            {/* Selected widget */}
            <div className="absolute left-[30%] right-[30%] top-[22%] aspect-video rounded border-2 border-dashed border-purple-400/80 bg-purple-500/10">
              <span className="absolute -left-1 -top-1 h-2 w-2 border border-purple-400 bg-background" />
              <span className="absolute -right-1 -top-1 h-2 w-2 border border-purple-400 bg-background" />
              <span className="absolute -bottom-1 -left-1 h-2 w-2 border border-purple-400 bg-background" />
              <span className="absolute -bottom-1 -right-1 h-2 w-2 border border-purple-400 bg-background" />
              <span className="absolute -top-5 left-0 rounded bg-purple-500/20 px-1 font-mono text-[8px] text-purple-200">
                640 × 360
              </span>
            </div>
            {/* Unselected widgets: the clock and the stats bar */}
            <div className="absolute right-[5%] top-[7%] rounded border border-white/[0.15] bg-white/[0.05] px-1.5 py-0.5 font-mono text-[8px] text-muted-foreground">
              19:42:05
            </div>
            <div className="absolute inset-x-[8%] bottom-[7%] flex items-center justify-between rounded-full border border-white/[0.12] bg-black/50 px-2.5 py-1 font-mono text-[7px] text-muted-foreground">
              <span>4.7 km/h</span>
              <span>12.3 km</span>
              <span>Amsterdam</span>
              <span>18°C</span>
            </div>
          </div>

          {/* Layers */}
          <div className="flex w-24 shrink-0 flex-col gap-1 sm:w-28">
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
                {locked ? (
                  <Lock className="ml-1 h-2.5 w-2.5 shrink-0" />
                ) : (
                  <Eye className="ml-1 h-2.5 w-2.5 shrink-0 opacity-40" />
                )}
              </div>
            ))}
          </div>

          {/* Inspector, hidden on the narrowest cards */}
          <div className="hidden w-24 shrink-0 flex-col gap-1 sm:flex">
            <p className="px-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Clips rotator</p>
            {INSPECTOR_FIELDS.map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-md border border-white/[0.07] bg-white/[0.03] px-1.5 py-1 text-[10px]"
              >
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono text-foreground/80">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
