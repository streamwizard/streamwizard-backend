import { describe, expect, it } from "bun:test";
import { addClip, addLayer, createClip, createDefaultBase, createDefaultSource, createEmptyScene, createLayer, setKeyframe } from "@repo/alert-scene";
import { ROW_HEIGHT_PX } from "./timeline-constants";
import { buildTimelineRows, clipTracks, layerHasTracks, PROPERTY_ROW_HEIGHT_PX, rowsHeight } from "./timeline-rows";

function fixture() {
  let scene = createEmptyScene({ duration: 5000 });
  const bottom = createLayer("image", "Bottom");
  const top = createLayer("text", "Top");
  scene = addLayer(scene, bottom);
  scene = addLayer(scene, top);
  const clip = createClip({ start: 0, end: 4000, source: createDefaultSource("text"), base: createDefaultBase(scene, { width: 1, height: 1 }) });
  scene = addClip(scene, top.id, clip);
  scene = setKeyframe(scene, clip.id, "opacity", { time: 0, value: 0 });
  scene = setKeyframe(scene, clip.id, "x", { time: 0, value: 0 });
  return { scene, bottom, top, clip };
}

describe("buildTimelineRows", () => {
  it("lists layers top-first and only unfolds expanded layers with tracks", () => {
    const { scene, bottom, top } = fixture();
    expect(buildTimelineRows(scene, {}).map((r) => r.key)).toEqual([top.id, bottom.id]);
    const rows = buildTimelineRows(scene, { [top.id]: true, [bottom.id]: true });
    expect(rows.map((r) => (r.kind === "layer" ? r.layer.name : r.prop))).toEqual(["Top", "x", "opacity", "Bottom"]);
    expect(rowsHeight(rows)).toBe(ROW_HEIGHT_PX * 2 + PROPERTY_ROW_HEIGHT_PX * 2);
  });

  it("orders tracks by the inspector order and reports emptiness", () => {
    const { scene, top, bottom } = fixture();
    const topLayer = scene.layers.find((l) => l.id === top.id)!;
    expect(clipTracks(topLayer.clips[0]!).map((t) => t.property)).toEqual(["x", "opacity"]);
    expect(layerHasTracks(topLayer)).toBe(true);
    expect(layerHasTracks(scene.layers.find((l) => l.id === bottom.id)!)).toBe(false);
  });
});
