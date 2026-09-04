import { describe, expect, it } from "bun:test";
import { addClip, addLayer, createClip, createDefaultBase, createDefaultSource, createEmptyScene, createLayer } from "@repo/alert-scene";
import { moveClipCommand, removeLayerCommand, setKeyframeCommand, setSceneMetaCommand } from "./commands";
import { COALESCE_WINDOW_MS, createTimelineStore, isDirty, visibleScene } from "./timeline-store";

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

  it("clamps the playhead to the scene", () => {
    const { scene } = fixture();
    const store = createTimelineStore(scene);
    store.getState().setPlayhead(-10);
    expect(store.getState().playhead).toBe(0);
    store.getState().setPlayhead(99_999);
    expect(store.getState().playhead).toBe(10_000);
  });
});
