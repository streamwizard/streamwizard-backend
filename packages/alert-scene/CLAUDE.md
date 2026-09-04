# @repo/alert-scene

Timeline alert scenes: the document format, the evaluator and the renderer that both the overlay editor's
preview and the live OBS overlay use. Editor UI lives in
`apps/web-streamwizard/src/components/overlays/alert-timeline/`.

## Layers, strictly

```
src/core/      pure TS + zod. No DOM, no React, no timers except the injectable ones in clock.ts. Unit tested (bun test).
src/renderer/  React + DOM. SceneStage owns the nodes; applyRenderState writes one frame; media-sync keeps <video>/<audio> honest.
editor (app)   the modal. Talks to core through scene-ops, never mutates a scene in place.
```

Import paths: `@repo/alert-scene` (core), `@repo/alert-scene/renderer` (React).

## The determinism rule

Visual state at time `t` is `evaluate(scene, t)`. Nothing else. No CSS `transition`/`animation` in the stage,
no `setTimeout` chains, no state carried between frames. One rAF loop (`createSceneClock`) reads the clock and
calls `stage.render(t)`. Scrubbing backwards, pausing mid-alert and previewing a single keyframe all depend on this.

## Scene document (v1)

- `AlertScene { version: 1, id, name, duration, width, height, fps, layers[] }`. z-order = array order, index 0 bottom.
- `Layer { id, name, type: text|image|video|audio|shape, visible, locked, muted, clips[] }`. Clips sorted, non-overlapping.
- `Clip { id, start, end, trimIn, trimOut, source, base, tracks, effects }`. Active while `start <= t < end`.
- `source` is a discriminated union on `kind`, which must equal the layer type.
- `base: Record<PropName, number>` is the value of every animatable property when it has no track.
- `tracks: Partial<Record<PropName, { property, keyframes[] }>>`. Keyframes sorted, unique times.
- `Keyframe { id, time, value, easing }`. **Times are absolute scene ms.** Moving a clip shifts them, trimming does not.
- `easing` describes the segment *leaving* the keyframe: `"linear"`, `"hold"`, or `{ x1, y1, x2, y2 }` (CSS cubic-bezier).
- `x`/`y` position the anchor point in scene px; `anchorX`/`anchorY` are 0..1 of the box; `rotation` degrees.
- `effects` (blend, shadow, blur, tint) are static per clip in v1.

Evaluation rules (`evaluateTrack`): no track → base; one keyframe → constant; outside the keyframe range → clamped to
the nearest end; between two → leading keyframe's easing.

Changing this shape is a schema decision. Add fields with zod `.default()` so stored scenes keep parsing. Never
rename or repurpose a field without a `version` bump and a migration in `parseAlertScene`.

## Persistence

A scene is stored inline as `AlertVariantConfig.timeline` (jsonb in `overlay_items.config`), one per alert event.
`packages/ui/src/overlay-schemas.ts` embeds `alertSceneSchema`; `normalizeAlertVariant` runs `parseAlertScene`
and drops anything invalid so a bad row plays the legacy alert instead of breaking the overlay.

## Conventions

- `scene-ops` functions return a new scene and share untouched layers/clips by reference. Range-changing ops
  throw on overlap; the editor clamps first (`timeline-math.ts`).
- Tokens: `substituteTokens(text, values)` is generic. The alert vocabulary (`{name} {amount} {message} {gifter}
  {reward} {charity} {tier}`) is built by `alertTokensFromInstance` in `packages/ui`.
- Tests: co-located `*.test.ts`, `import { describe, it, expect } from "bun:test"`. Core only; the renderer has no
  DOM test harness.
- Media URLs are plain CDN strings from the media library. No asset ids, no signing at read time.

## Editor conventions (keyframes)

- **Auto-keyframe rule.** Every value edit goes through `prop-writer.ts` (`writeProp`/`writeProps`, and the
  `writePropCommand`/`writePropsCommand` wrappers): a property with a track gets a keyframe at the playhead
  (added or updated, whole-ms times via `keyframeTime`), a property without one changes `base`. Inspector
  fields, the anchor picker and the stage overlay all use it, so they cannot disagree.
- **Stopwatch.** On = one keyframe at the playhead holding the current value (`stopwatchOnCommand`, also
  unfolds the layer). Off = drop the track and settle the value evaluated at the playhead into `base`
  (`stopwatchOffCommand`, one undo step). Deleting the last keyframe (`deleteKeyframeCommand`) is the
  stopwatch going off, so the value never snaps back to a stale base.
- **Drafts.** A gesture calls `setDraft(fn(committedScene))` on every move and `commitDraft(command)` on
  release; Escape (`drag-registry`) commits `null`. Gesture context must capture what it needs at pointer-down
  (`from`, the committed scene, the box) because props re-render with the draft mid-drag.
- **Selectors return stable slices.** `useTimeline` is `useSyncExternalStore`; a selector that builds a new
  object per read loops forever. Select the scene/playhead/ids and derive with `useMemo` in render.
- **Rows.** `timeline-rows.ts` builds one flat list that both timeline columns render; an expanded layer adds a
  26px row per animated property. Folded clips draw mini diamonds instead.
- **Stage overlay.** `preview/stage-geometry.ts` mirrors the renderer's transform (origin at the anchor, then
  rotate, then scale): hit-test in local space, resize with the opposite corner pinned, rotate around the anchor.
  The hit layer covers the whole preview pane because content may sit outside the scene box.
- **Anchor changes keep the box still**: `reanchorNode` compensates `x`/`y` in local space (`anchor-math.ts`).

## Media

- **`trimIn` is the source offset**: the clip shows its file from `trimIn` ms onward, so `mediaTime = trimIn +
  (t − start)`. Trimming a media clip's start edge shifts `trimIn` by the same amount (the footage stays put);
  `splitClip` gives the right half `trimIn + (cut − start)`; the inspector's "Source offset" field slides the
  footage under a clip that stays put. **`trimOut` is reserved**: parsed, defaulted to 0, read by nothing. Clip
  length is `end − start`. Do not "fix" it without a schema decision.
- **Source length is probed, never stored.** The editor asks a throwaway element (`media-info.ts`, cached per URL
  for the session) and derives trim limits from it (`media-math.ts`): the start edge cannot reveal footage before
  the file starts, the end edge cannot reach past it unless the video loops, and an edge already over the line is
  never yanked back. Unknown length = no end limit. The renderer needs none of this; it reads its own element.
- **Past the end of a non-looping file the stage holds the last frame.** `media-sync` clamps the target to
  `el.duration` and takes the paused path there; an element that ended reports `paused`, and calling `play()` on
  it would restart from 0. The editor hatches that tail on the clip.
- **Volume** is a normal keyframable prop (`base.volume`, 0..1), multiplied by the host's master volume
  (`SceneStage volume`, the alert box's slider × the widget's master) and zeroed by `Layer.muted` inside
  `evaluate`. `previewMuted` in the editor store is session state and never reaches the scene.
- **Waveforms are editor-only** (`waveform/`): fetched with CORS, decoded through an 8 kHz `OfflineAudioContext`,
  folded to 500 peaks/s and cached per URL. A file with no audio, one over 30 MB or a CDN without a CORS
  allowlist entry for the app origin draws a quiet centre line, not an error.
- **Seeding** (`scene-from-variant.ts`): the legacy variant's video lands on the bottom layer (looping for a
  fixed-length alert, played once for a video-length one, `volume` 0 when a separate sound exists), the sound on a
  top layer at full volume, both over the whole scene.

