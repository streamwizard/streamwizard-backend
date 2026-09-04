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

