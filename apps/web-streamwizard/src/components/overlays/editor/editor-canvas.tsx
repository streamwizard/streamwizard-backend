"use client";

import type { OverlayItem, RootOverlayItemType } from "@/types/overlays";
import { asClipDisplayFieldConfig } from "@/types/overlays";
import {
  getRootOverlayWidgetDefinition,
  isRootLayerType,
} from "../registry/overlay-widget-registry";
import { LayerContextMenu } from "./layer-context-menu";
import { selectPrimarySelectedId, useOverlayStore } from "@/stores/overlay-editor-store";
import { useCanvasGestures } from "@/hooks/overlays/use-canvas-gestures";
import { useCanvasViewport } from "@/hooks/overlays/use-canvas-viewport";
import { CanvasRulers } from "./canvas-rulers";
import { CANVAS_BACKGROUND_STYLES } from "./canvas-background";
import { EmptyCanvasHint } from "./empty-canvas-hint";
import { useEditorClipPlayback } from "@/hooks/overlays/use-editor-clip-playback";
import {
  WidgetScaleFrame,
  getItemScale,
  itemFlipTransform,
  resolveAnchoredPosition,
} from "@repo/ui/overlay";

/** On-screen size of a resize handle; divided by zoom because the canvas is scaled. */
const HANDLE_SIZE_PX = 8;

const RESIZE_HINT =
  "Drag to resize the whole widget, contents included. Hold Alt to crop instead.";
const REFLOW_HINT =
  "Drag to resize the frame only — text keeps its size (Shift on a corner for both, Alt to crop)";
const CROP_HINT =
  "Drag to crop this edge away. Then resize normally to stretch what's left back out.";

interface EditorCanvasProps {
  /** The pane the canvas floats in; wheel zoom and panning are bound to it. */
  paneRef: React.RefObject<HTMLDivElement | null>;
  /** Where the empty canvas sends someone looking for a widget. */
  onAddWidget: () => void;
  onOpenShortcuts: () => void;
}

export function EditorCanvas({ paneRef, onAddWidget, onOpenShortcuts }: EditorCanvasProps) {
  const { scene, selectedItemIds, zoom, panX, panY, canvasBackground, grid, rulersVisible, rulerCursorVisible, selectItem, selectClipDisplayFieldForEdit, updateItem, setRenameRequestId } = useOverlayStore();

  const primarySelectedId = selectPrimarySelectedId({ selectedItemIds });

  const editorClipPlayback = useEditorClipPlayback();

  const {
    canvasRef,
    cropping,
    dragState,
    guides,
    marqueeRect,
    gaps,
    handleItemMouseDown,
    handleBackgroundMouseDown,
    handleMouseMove,
    handleMouseUp,
  } = useCanvasGestures();

  const { panReady, panning, handlePanMouseDown } = useCanvasViewport({ paneRef });

  if (!scene) return null;

  const sortedItems = [...scene.items]
    .filter((i): i is typeof i & { type: RootOverlayItemType } =>
      isRootLayerType(i.type),
    )
    .sort((a, b) => a.z_index - b.z_index);

  const selected = scene.items.find((i) => i.id === primarySelectedId);

  const resizeHandles = ["nw", "ne", "sw", "se", "n", "s", "e", "w"];
  const handleHints: Record<string, string> = {
    nw: RESIZE_HINT,
    ne: RESIZE_HINT,
    sw: RESIZE_HINT,
    se: RESIZE_HINT,
    n: REFLOW_HINT,
    s: REFLOW_HINT,
    e: REFLOW_HINT,
    w: REFLOW_HINT,
  };
  const handleCursors: Record<string, string> = {
    nw: "nwse-resize",
    ne: "nesw-resize",
    sw: "nesw-resize",
    se: "nwse-resize",
    n: "ns-resize",
    s: "ns-resize",
    e: "ew-resize",
    w: "ew-resize",
  };

  function getHandlePosition(handle: string, z: number) {
    const off = `${-(HANDLE_SIZE_PX / 2) / z}px`;
    const positions: Record<
      string,
      {
        top?: string;
        bottom?: string;
        left?: string;
        right?: string;
        transform: string;
      }
    > = {
      nw: { top: off, left: off, transform: "none" },
      ne: { top: off, right: off, transform: "none" },
      sw: { bottom: off, left: off, transform: "none" },
      se: { bottom: off, right: off, transform: "none" },
      n: { top: off, left: "50%", transform: "translateX(-50%)" },
      s: { bottom: off, left: "50%", transform: "translateX(-50%)" },
      e: { top: "50%", right: off, transform: "translateY(-50%)" },
      w: { top: "50%", left: off, transform: "translateY(-50%)" },
    };
    return positions[handle] ?? { transform: "none" };
  }

  return (
    <div
      className="absolute inset-0"
      style={{ cursor: panning ? "grabbing" : panReady ? "grab" : undefined }}
      onMouseMove={(e) => {
        // Panning owns the gesture while it runs; item drags never see it.
        if (panning) return;
        handleMouseMove(e);
      }}
      onMouseUp={() => handleMouseUp()}
      onMouseLeave={() => handleMouseUp()}
      onMouseDown={(e) => {
        if (handlePanMouseDown(e)) return;
        handleBackgroundMouseDown(e);
      }}
    >
      {/*
        The canvas floats in the pane at the pan offset; nothing here scrolls.
        A transform rather than left/top so a drag never triggers layout.
      */}
      <div
        ref={canvasRef}
        className="absolute left-0 top-0 border border-border/50"
        style={{
          width: scene.width * zoom,
          height: scene.height * zoom,
          transform: `translate(${panX}px, ${panY}px)`,
          ...CANVAS_BACKGROUND_STYLES[canvasBackground],
        }}
      >
        {rulersVisible && (
          <CanvasRulers
            width={scene.width}
            height={scene.height}
            zoom={zoom}
            canvasRef={canvasRef}
            showCursor={rulerCursorVisible}
          />
        )}
        {/* The rulers say the same thing more precisely, and the toolbar carries
            the size as its own button, so this stands down when they are on. */}
        {!rulersVisible && (
          <div className="absolute -top-6 left-0 text-xs text-muted-foreground">
            {scene.width} x {scene.height}
          </div>
        )}

        {/*
          Everything inside renders in raw scene px and is scaled once here, so
          the editor is a true-to-size preview of the live overlay. Selection
          chrome divides its px by `zoom` to stay a constant size on screen.
        */}
        <div
          className="relative"
          style={{
            width: scene.width,
            height: scene.height,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
          }}
        >
          {grid.visible && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                // Thickness is divided by zoom so a 1px line stays 1px on screen
                // rather than growing with the canvas.
                backgroundImage: `
              linear-gradient(${grid.color} ${grid.lineWidth / zoom}px, transparent ${grid.lineWidth / zoom}px),
              linear-gradient(90deg, ${grid.color} ${grid.lineWidth / zoom}px, transparent ${grid.lineWidth / zoom}px)
            `,
                backgroundSize: `${grid.size}px ${grid.size}px`,
              }}
            />
          )}

          {sortedItems.map((item) => {
            if (!item.is_visible) return null;

            const def = getRootOverlayWidgetDefinition(item.type);
            const Canvas = def.CanvasContent;

            const childOfThis =
              selected?.type === "clip_display_field" &&
              asClipDisplayFieldConfig(selected.config).parentClipItemId ===
                item.id;
            const isSelected =
              selectedItemIds.includes(item.id) || !!childOfThis;
            const showHandles =
              isSelected &&
              !item.is_locked &&
              (selectedItemIds.length <= 1 || !!childOfThis);
            // The same resolution the live overlay uses, so the editor is a
            // faithful preview of where an anchored item ends up.
            const position = resolveAnchoredPosition(item, scene);

            return (
              <LayerContextMenu
                key={item.id}
                item={item}
                onRename={() => {
                  selectItem(item.id);
                  setRenameRequestId(item.id);
                }}
              >
                <div
                  className="absolute group"
                  style={{
                    left: position.x,
                    top: position.y,
                    width: item.w,
                    height: item.h,
                    zIndex: item.z_index,
                    opacity: item.opacity,
                    transform:
                      item.rotation !== 0
                        ? `rotate(${item.rotation}deg)`
                        : undefined,
                    // While a drag would pan, the hand from the pane shows through.
                    cursor: panReady ? undefined : item.is_locked ? "not-allowed" : "move",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  onContextMenu={() => {
                    if (!selectedItemIds.includes(item.id)) selectItem(item.id);
                  }}
                  onMouseDown={(e) => {
                    // Space turns the whole canvas into a pan surface, widgets
                    // included, or holding it over one would drag it instead.
                    if (handlePanMouseDown(e)) return;
                    handleItemMouseDown(e, item.id, "move");
                  }}
                >
                  <div
                    className={`
                    w-full h-full border-solid transition-colors overflow-hidden
                    ${isSelected ? "border-primary" : "border-white/20 hover:border-white/40"}
                  `}
                    style={{
                      borderWidth: 2 / zoom,
                      borderRadius: 4 / zoom,
                      // Mirrored in here, inside the rotated wrapper, so the
                      // resize handles stay where the cursor expects them.
                      // Same maths as the live renderer's rotate-then-scale.
                      transform: itemFlipTransform(item),
                    }}
                  >
                    {Canvas ? (
                      <WidgetScaleFrame item={item}>
                        <Canvas
                          item={item}
                          scene={scene}
                          screenScale={zoom * getItemScale(item)}
                          selectedItemId={primarySelectedId}
                          selected={selected}
                          selectItem={selectItem}
                          selectClipDisplayFieldForEdit={
                            selectClipDisplayFieldForEdit
                          }
                          updateItem={updateItem}
                          editorClipPlayback={editorClipPlayback}
                        />
                      </WidgetScaleFrame>
                    ) : (
                      <div
                        className="w-full h-full flex flex-col items-center justify-center"
                        style={{
                          background: "rgba(99, 102, 241, 0.15)",
                          backdropFilter: "blur(4px)",
                        }}
                      >
                        <div
                          className="text-white/80 text-center px-2"
                          style={{ fontSize: Math.max(10 / zoom, 14) }}
                        >
                          <div className="font-medium truncate">
                            {item.label}
                          </div>
                          <div
                            className="text-white/50 mt-0.5"
                            style={{ fontSize: Math.max(8 / zoom, 10) }}
                          >
                            {item.type}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {showHandles && (
                    <>
                      {resizeHandles.map((handle) => {
                        const pos = getHandlePosition(handle, zoom);
                        return (
                          <div
                            key={handle}
                            className={`absolute border-solid border-primary-foreground ${
                              cropping ? "bg-amber-400" : "bg-primary"
                            }`}
                            style={{
                              ...pos,
                              width: HANDLE_SIZE_PX / zoom,
                              height: HANDLE_SIZE_PX / zoom,
                              borderWidth: 1 / zoom,
                              borderRadius: cropping ? 0 : 2 / zoom,
                              cursor: panReady ? undefined : handleCursors[handle],
                              zIndex: 10,
                            }}
                            title={cropping ? CROP_HINT : handleHints[handle]}
                            onMouseDown={(e) => {
                              if (handlePanMouseDown(e)) return;
                              handleItemMouseDown(e, item.id, "resize", handle);
                            }}
                          />
                        );
                      })}
                    </>
                  )}
                </div>
              </LayerContextMenu>
            );
          })}

          {gaps.map((gap, idx) => {
            // Drawn in scene px but sized by 1/zoom, so the marker and its
            // number stay the same size on screen at any zoom -- same trick the
            // selection chrome uses.
            const thickness = 1 / zoom;
            const tick = 5 / zoom;
            const horizontal = gap.axis === "x";
            return (
              <div
                key={`gap-${gap.axis}-${gap.start}-${gap.end}-${idx}`}
                className="absolute pointer-events-none flex items-center justify-center"
                style={
                  horizontal
                    ? {
                        left: gap.start,
                        top: gap.cross - tick,
                        width: Math.max(gap.distance, 0),
                        height: tick * 2,
                        zIndex: 9999,
                      }
                    : {
                        top: gap.start,
                        left: gap.cross - tick,
                        height: Math.max(gap.distance, 0),
                        width: tick * 2,
                        zIndex: 9999,
                      }
                }
              >
                <span
                  className="absolute bg-primary"
                  style={
                    horizontal
                      ? { left: 0, right: 0, height: thickness }
                      : { top: 0, bottom: 0, width: thickness }
                  }
                />
                {/* End caps, so a gap of a few px still reads as a measurement. */}
                <span
                  className="absolute bg-primary"
                  style={
                    horizontal
                      ? { left: 0, top: 0, bottom: 0, width: thickness }
                      : { top: 0, left: 0, right: 0, height: thickness }
                  }
                />
                <span
                  className="absolute bg-primary"
                  style={
                    horizontal
                      ? { right: 0, top: 0, bottom: 0, width: thickness }
                      : { bottom: 0, left: 0, right: 0, height: thickness }
                  }
                />
                <span
                  className="relative rounded bg-primary px-1 font-medium text-primary-foreground tabular-nums"
                  style={{
                    fontSize: 10 / zoom,
                    lineHeight: 1.4,
                    paddingInline: 3 / zoom,
                    borderRadius: 3 / zoom,
                  }}
                >
                  {Math.round(gap.distance)}
                </span>
              </div>
            );
          })}

          {guides.map((guide, idx) => (
            <div
              key={`${guide.orientation}-${guide.position}-${idx}`}
              className="absolute bg-primary/70 pointer-events-none"
              style={
                guide.orientation === "v"
                  ? {
                      left: guide.position,
                      top: 0,
                      width: 1 / zoom,
                      height: "100%",
                      zIndex: 9999,
                    }
                  : {
                      top: guide.position,
                      left: 0,
                      height: 1 / zoom,
                      width: "100%",
                      zIndex: 9999,
                    }
              }
            />
          ))}

          {marqueeRect && (
            <div
              className="absolute border-solid border-primary bg-primary/10 pointer-events-none"
              style={{
                left: marqueeRect.x,
                top: marqueeRect.y,
                width: marqueeRect.w,
                height: marqueeRect.h,
                borderWidth: 1 / zoom,
                zIndex: 9999,
              }}
            />
          )}
        </div>

        {/* Outside the scaled layer on purpose: the copy reads at screen size
            whatever the zoom. Hidden layers still count as something on the
            canvas; the layers panel is the place that explains those. */}
        {sortedItems.length === 0 && (
          <EmptyCanvasHint
            background={canvasBackground}
            screenWidth={scene.width * zoom}
            screenHeight={scene.height * zoom}
            onAddWidget={onAddWidget}
            onOpenShortcuts={onOpenShortcuts}
          />
        )}
      </div>
    </div>
  );
}
