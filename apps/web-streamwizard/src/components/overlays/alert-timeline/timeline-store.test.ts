import { describe, expect, it } from "bun:test";
import { addClip, addLayer, createClip, createDefaultBase, createDefaultSource, createEmptyScene, createLayer } from "@repo/alert-scene";
import { deleteClipCommand, duplicateClipCommand, moveClipCommand, removeLayerCommand, setBasePropCommand, setKeyframeCommand, setSceneMetaCommand } from "./commands";
import { COALESCE_WINDOW_MS, HISTORY_LIMIT, createTimelineStore, isDirty, visibleScene } from "./timeline-store";

function fixture() {
  let scene = createEmptyScene({ duration: 10_000 });
  const layer = createLayer("text", "T");
  scene = addLayer(scene, layer);
  const clip = createClip({ start: 1000, end: 2000, source: createDefaultSource("text"), base: createDefaultBase(scene, { width: 1, height: 1 }) });
  scene = addClip(scene, layer.id, clip);
  return { scene, layer, clip };
}

describe("timeline store", () => {
  it("execute / undo / redo and dirty tracking", () => {
    const { scene, clip } = fixture();
    const store = createTimelineStore(scene);
    expect(isDirty(store.getState())).toBe(false);
    store.getState().execute(moveClipCommand(clip.id, 500));
    expect(store.getState().scene.layers[0]!.clips[0]!.start).toBe(1500);
    expect(isDirty(store.getState())).toBe(true);
    store.getState().undo();
    expect(store.getState().scene).toEqual(scene);
    expect(isDirty(store.getState())).toBe(false);
    store.getState().redo();
    expect(store.getState().scene.layers[0]!.clips[0]!.start).toBe(1500);
    store.getState().markSaved();
    expect(isDirty(store.getState())).toBe(false);
  });

  it("a new command after undo drops the redo stack", () => {
    const { scene, clip } = fixture();
    const store = createTimelineStore(scene);
    store.getState().execute(moveClipCommand(clip.id, 500));
    store.getState().undo();
    store.getState().execute(moveClipCommand(clip.id, 100));
    expect(store.getState().future).toEqual([]);
    store.getState().redo();
    expect(store.getState().scene.layers[0]!.clips[0]!.start).toBe(1100);
  });

  it("coalesces same-key commands inside the window into one undo step", () => {
    const { scene } = fixture();
    let t = 0;
    const store = createTimelineStore(scene, { now: () => t });
    const s = () => store.getState();
    s().execute(setSceneMetaCommand(s().scene, { duration: 5000 }, "duration"));
    t += 100;
    s().execute(setSceneMetaCommand(s().scene, { duration: 5500 }, "duration"));
    t += 100;
    s().execute(setSceneMetaCommand(s().scene, { duration: 5550 }, "duration"));
    expect(s().past.length).toBe(1);
    expect(s().scene.duration).toBe(5550);
    s().undo();
    expect(s().scene.duration).toBe(10_000);
    s().redo();
    expect(s().scene.duration).toBe(5550);
    t += COALESCE_WINDOW_MS + 1;
    s().execute(setSceneMetaCommand(s().scene, { duration: 6000 }, "duration"));
    expect(s().past.length).toBe(2);
  });

  it("merges on the window's last millisecond and not one later", () => {
    const { scene } = fixture();
    let t = 0;
    const store = createTimelineStore(scene, { now: () => t });
    const s = () => store.getState();
    s().execute(setSceneMetaCommand(s().scene, { duration: 5000 }, "duration"));
    t += COALESCE_WINDOW_MS;
    s().execute(setSceneMetaCommand(s().scene, { duration: 5100 }, "duration"));
    expect(s().past.length).toBe(1);
    t += COALESCE_WINDOW_MS + 1;
    s().execute(setSceneMetaCommand(s().scene, { duration: 5200 }, "duration"));
    expect(s().past.length).toBe(2);
  });

  it("never merges edits to different props or different clips", () => {
    let { scene } = fixture();
    const { clip } = fixture();
    const other = createClip({ start: 4000, end: 5000, source: createDefaultSource("text"), base: createDefaultBase(scene, { width: 1, height: 1 }) });
    scene = addClip(scene, scene.layers[0]!.id, other);
    const a = scene.layers[0]!.clips[0]!;
    let t = 0;
    const store = createTimelineStore(scene, { now: () => t });
    const s = () => store.getState();
    s().execute(setBasePropCommand(s().scene, a.id, "x", 1, `base:${a.id}:x`)!);
    t += 10;
    s().execute(setBasePropCommand(s().scene, a.id, "y", 1, `base:${a.id}:y`)!);
    t += 10;
    s().execute(setBasePropCommand(s().scene, other.id, "x", 1, `base:${other.id}:x`)!);
    expect(s().past.length).toBe(3);
    expect(s().past.map((e) => e.command.label)).toEqual(["Set X", "Set Y", "Set X"]);
    void clip;
  });

  it("caps the history and still reads dirty once the saved state has fallen off", () => {
    const { scene, clip } = fixture();
    const store = createTimelineStore(scene);
    const s = () => store.getState();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) s().execute(moveClipCommand(clip.id, i % 2 === 0 ? 1 : -1));
    expect(s().past.length).toBe(HISTORY_LIMIT);
    for (let i = 0; i < HISTORY_LIMIT; i++) s().undo();
    expect(s().past.length).toBe(0);
    // Five moves of ±1 that can no longer be undone: net +1 from the saved scene.
    expect(s().scene.layers[0]!.clips[0]!.start).toBe(1001);
    expect(isDirty(s())).toBe(true);
  });

  it("undo of a delete reselects the clip; redo drops the selection again", () => {
    const { scene, layer, clip } = fixture();
    const store = createTimelineStore(scene);
    const s = () => store.getState();
    s().select({ layerId: layer.id, clipId: clip.id });
    s().execute(deleteClipCommand(s().scene, clip.id)!);
    expect(s().selection.clipId).toBeNull();
    s().undo();
    expect(s().selection).toEqual({ layerId: layer.id, clipId: clip.id, keyframe: null });
    s().redo();
    expect(s().selection).toEqual({ layerId: null, clipId: null, keyframe: null });
  });

  it("undo of a duplicate goes back to the original; redo returns to the copy", () => {
    const { scene, layer, clip } = fixture();
    const store = createTimelineStore(scene);
    const s = () => store.getState();
    s().select({ layerId: layer.id, clipId: clip.id });
    const dup = duplicateClipCommand(s().scene, clip.id)!;
    s().execute(dup.command);
    s().select({ layerId: dup.layerId, clipId: dup.clipId, keyframe: null });
    s().undo();
    expect(s().selection.clipId).toBe(clip.id);
    s().redo();
    expect(s().selection.clipId).toBe(dup.clipId);
  });

  it("undoing a value edit keeps the clip picked since, and a coalesced run remembers its first start", () => {
    const { scene, layer, clip } = fixture();
    let t = 0;
    const store = createTimelineStore(scene, { now: () => t });
    const s = () => store.getState();
    s().select({ layerId: layer.id, clipId: null });
    s().execute(setBasePropCommand(s().scene, clip.id, "x", 1, "k")!);
    s().select({ layerId: layer.id, clipId: clip.id });
    t += 10;
    s().execute(setBasePropCommand(s().scene, clip.id, "x", 2, "k")!);
    expect(s().past.length).toBe(1);
    expect(s().past[0]!.before.clipId).toBeNull();
    s().undo();
    expect(s().selection.clipId).toBe(clip.id);
  });

  it("drafts preview a gesture and commit as one command", () => {
    const { scene, clip } = fixture();
    const store = createTimelineStore(scene);
    const s = () => store.getState();
    const preview = moveClipCommand(clip.id, 300).apply(scene);
    s().setDraft(preview);
    expect(visibleScene(s())).toBe(preview);
    expect(s().scene).toBe(scene);
    expect(s().past.length).toBe(0);
    s().commitDraft(moveClipCommand(clip.id, 300));
    expect(s().draft).toBeNull();
    expect(s().scene.layers[0]!.clips[0]!.start).toBe(1300);
    expect(s().past.length).toBe(1);
    s().setDraft(preview);
    s().commitDraft(null);
    expect(s().draft).toBeNull();
    expect(s().past.length).toBe(1);
  });

  it("prunes a selection that undo or delete removed", () => {
    const { scene, layer, clip } = fixture();
    const store = createTimelineStore(scene);
    const s = () => store.getState();
    s().select({ layerId: layer.id, clipId: clip.id });
    s().execute(removeLayerCommand(s().scene, layer.id)!);
    expect(s().selection).toEqual({ layerId: null, clipId: null, keyframe: null });
    s().undo();
    s().select({ clipId: clip.id });
    s().redo();
    expect(s().selection.clipId).toBeNull();
  });

  it("a never-saved timeline starts dirty and stays dirty until saved", () => {
    const { scene } = fixture();
    const store = createTimelineStore(scene, { saved: false });
    expect(isDirty(store.getState())).toBe(true);
    store.getState().markSaved();
    expect(isDirty(store.getState())).toBe(false);
  });

  it("selectKeyframe selects the clip and layer too, and pruning drops a vanished keyframe", () => {
    const { scene, layer, clip } = fixture();
    const store = createTimelineStore(scene);
    const s = () => store.getState();
    s().execute(setKeyframeCommand(s().scene, clip.id, "x", { time: 1500, value: 1 })!);
    const kf = s().scene.layers[0]!.clips[0]!.tracks.x!.keyframes[0]!;
    s().selectKeyframe(clip.id, "x", kf.id);
    expect(s().selection).toEqual({ layerId: layer.id, clipId: clip.id, keyframe: { clipId: clip.id, prop: "x", keyframeId: kf.id } });
    s().undo();
    expect(s().selection.keyframe).toBeNull();
    expect(s().selection.clipId).toBe(clip.id);
  });

  it("expands and collapses layers", () => {
    const { scene, layer } = fixture();
    const store = createTimelineStore(scene);
    const s = () => store.getState();
    s().toggleLayerExpanded(layer.id);
    expect(s().expandedLayerIds).toEqual({ [layer.id]: true });
    s().toggleLayerExpanded(layer.id);
    expect(s().expandedLayerIds).toEqual({});
    s().setLayerExpanded(layer.id, true);
    s().setLayerExpanded(layer.id, true);
    expect(s().expandedLayerIds).toEqual({ [layer.id]: true });
  });

  it("preview mute is session state, not an edit", () => {
    const { scene } = fixture();
    const store = createTimelineStore(scene);
    expect(store.getState().previewMuted).toBe(false);
    store.getState().setPreviewMuted(true);
    expect(store.getState().previewMuted).toBe(true);
    expect(isDirty(store.getState())).toBe(false);
    expect(store.getState().past.length).toBe(0);
  });

  it("the event and the chosen sample are session state, not edits", () => {
    const { scene } = fixture();
    const store = createTimelineStore(scene, { event: "cheer" });
    expect(store.getState().event).toBe("cheer");
    expect(store.getState().sampleId).toBe("default");
    store.getState().setSample("big");
    expect(store.getState().sampleId).toBe("big");
    expect(isDirty(store.getState())).toBe(false);
    expect(store.getState().past.length).toBe(0);
    expect(createTimelineStore(scene).getState().event).toBe("follow");
  });

  it("a test run ends when playback stops for any reason", () => {
    const { scene } = fixture();
    const store = createTimelineStore(scene);
    const s = () => store.getState();
    s().setTestRun(true);
    s().setPlaying(true);
    expect(s().testRun).toBe(true);
    s().setPlaying(false);
    expect(s().testRun).toBe(false);
    expect(isDirty(s())).toBe(false);
  });

  it("clamps the playhead to the scene", () => {
    const { scene } = fixture();
    const store = createTimelineStore(scene);
    store.getState().setPlayhead(-10);
    expect(store.getState().playhead).toBe(0);
    store.getState().setPlayhead(99_999);
    expect(store.getState().playhead).toBe(10_000);
  });
});
