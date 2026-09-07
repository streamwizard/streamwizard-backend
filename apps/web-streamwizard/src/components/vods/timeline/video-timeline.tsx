"use client";

import { useRef, useEffect, useState } from "react";
import { parseDuration } from "@/types/twitch-video";
import { useVideoPlayerStore } from "@/stores/video-dialog-store";
import { secondsToPercent as toPercent, getSecondsFromPosition } from "./timeline-utils";
import { ZoomControls } from "./zoom-controls";
import { TimelineRuler } from "./timeline-ruler";
import { TimelineSegments } from "./timeline-segments";
import { ClipSelection } from "./clip-selection";
import { EventMarkers } from "./event-markers";
import { TimelineDisplay } from "./timeline-display";
import { TimelineLegend } from "./timeline-legend";
import { TimelineContextMenu } from "./timeline-context-menu";
import type { VideoTimelineProps, ClipSelection as ClipSelectionType } from "./types";

// Re-export types for consumers
export type { TimelineEvent, ClipSelection as ClipSelectionType, TimelineSegment, TimelineSegmentType, VideoTimelineProps } from "./types";

/**
 * Custom video timeline with event markers and optional clip selection
 *
 * Features:
 * - Shows current playback position
 * - Displays events as clickable markers
 * - Click anywhere to seek to that position
 * - Clip mode: Shows draggable brackets for clip selection with zoom
 */
export function VideoTimeline({
  duration,
  currentTime,
  events: eventsProp,
  disabled = false,
  isClipMode = false,
  clipSelection,
  onClipSelectionChange,
  minClipDuration = 5,
  maxClipDuration = 60,
}: VideoTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  // Use events from store if not provided via props
  const storeEvents = useVideoPlayerStore((state) => state.timelineEvents);
  const events = eventsProp ?? storeEvents;
  const { seek, setZoomLevel, viewOffset, zoomLevel, dragging, dragStartInfo, setViewOffset, setDragging, initializeZoomForClip, resetZoom, isSeekDisabled } = useVideoPlayerStore();

  // Local state for drag position - prevents re-renders via Zustand during drag
  // This is updated via refs and DOM manipulation, only committed on drag end
  const [localClipSelection, setLocalClipSelection] = useState<ClipSelectionType | null>(null);
  const pendingSelectionRef = useRef<ClipSelectionType | null>(null);

  // Use the in-flight drag position while a handle is held, otherwise the prop.
  const activeClipSelection = (dragging && localClipSelection) || clipSelection;

  // Track when we just finished dragging to prevent click from firing
  const justFinishedDraggingRef = useRef(false);
  // Track if actual movement occurred during drag (to distinguish click from drag)
  const hasDraggedRef = useRef(false);

  // Pan state — separate from clip-handle dragging
  const isPanningRef = useRef(false);
  const panStartXRef = useRef(0);
  const panStartOffsetRef = useRef(0);
  const hasPannedRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);

  // Pinch-to-zoom state (two-finger gesture on touch devices)
  const isPinchingRef = useRef(false);
  const pinchStartDistRef = useRef(0);
  const pinchStartZoomRef = useRef(1);
  const pinchAnchorTimeRef = useRef(0);
  const pinchAnchorFractionRef = useRef(0.5);

  // Parse duration to seconds if it's a string
  const totalSeconds = typeof duration === "number" ? duration : parseDuration(duration);

  // Calculate visible time range based on zoom
  const visibleDuration = totalSeconds / zoomLevel;
  const viewStart = viewOffset;
  const viewEnd = Math.min(viewOffset + visibleDuration, totalSeconds);

  // Stable refs for latest values so pan/pinch effect doesn't need them as deps.
  // Written after commit rather than during render — a render-phase write can be
  // thrown away and leaves the handlers reading a value that never shipped.
  const visibleDurationRef = useRef(visibleDuration);
  const totalSecondsRef = useRef(totalSeconds);
  const viewOffsetRef = useRef(viewOffset);
  const zoomLevelRef = useRef(zoomLevel);

  useEffect(() => {
    visibleDurationRef.current = visibleDuration;
    totalSecondsRef.current = totalSeconds;
    viewOffsetRef.current = viewOffset;
    zoomLevelRef.current = zoomLevel;
  });

  // Helper functions (no hooks needed with React Compiler)
  const secondsToPercent = (seconds: number): number => {
    return toPercent(seconds, viewStart, visibleDuration);
  };

  // Reset zoom when clip mode changes
  useEffect(() => {
    if (isClipMode && clipSelection) {
      initializeZoomForClip();
    } else {
      resetZoom();
    }
  }, [isClipMode]); // Only trigger on mode change

  /** Drops the in-flight drag position; the prop is the source of truth again. */
  const clearLocalSelection = () => {
    pendingSelectionRef.current = null;
    setLocalClipSelection(null);
  };

  // Handle clip handle drag - updates local state only (no Zustand = no re-render)
  const handleDrag = (clientX: number) => {
    if (!dragging || disabled || !clipSelection || !onClipSelectionChange) return;

    const currentSelection = pendingSelectionRef.current || clipSelection;

    let newStart = currentSelection.startTime;
    let newEnd = currentSelection.endTime;

    if (dragging === "middle" && dragStartInfo) {
      // Move the entire selection
      const deltaX = clientX - dragStartInfo.clientX;
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const deltaPercent = (deltaX / rect.width) * 100;
      const deltaSeconds = (deltaPercent / 100) * visibleDuration;

      const clipDuration = dragStartInfo.endTime - dragStartInfo.startTime;
      newStart = dragStartInfo.startTime + deltaSeconds;
      newEnd = dragStartInfo.endTime + deltaSeconds;

      // Clamp to valid range
      if (newStart < 0) {
        newStart = 0;
        newEnd = clipDuration;
      }
      if (newEnd > totalSeconds) {
        newEnd = totalSeconds;
        newStart = totalSeconds - clipDuration;
      }
    } else {
      const seconds = getSecondsFromPosition(clientX, trackRef.current, viewStart, visibleDuration);

      if (dragging === "start") {
        // Ensure start doesn't go past end - minDuration
        const maxStart = Math.max(0, currentSelection.endTime - minClipDuration);
        // Ensure we don't exceed maxDuration from end
        const minStart = Math.max(0, currentSelection.endTime - maxClipDuration);
        newStart = Math.max(minStart, Math.min(maxStart, seconds));
        newEnd = currentSelection.endTime;
      } else if (dragging === "end") {
        // Ensure end doesn't go before start + minDuration
        const minEnd = Math.min(totalSeconds, currentSelection.startTime + minClipDuration);
        // Ensure we don't exceed maxDuration from start
        const maxEnd = Math.min(totalSeconds, currentSelection.startTime + maxClipDuration);
        newEnd = Math.max(minEnd, Math.min(maxEnd, seconds));
        newStart = currentSelection.startTime;
      }
    }

    // Update ref and local state (minimal re-render, not going through Zustand)
    const newSelection = { startTime: Math.floor(newStart), endTime: Math.floor(newEnd) };
    pendingSelectionRef.current = newSelection;
    setLocalClipSelection(newSelection);
  };

  // Mouse event handlers for clip dragging
  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      hasDraggedRef.current = true;
      handleDrag(e.clientX);
    };

    const handleMouseUp = () => {
      // Commit the final position to Zustand
      if (pendingSelectionRef.current && onClipSelectionChange) {
        onClipSelectionChange(pendingSelectionRef.current.startTime, pendingSelectionRef.current.endTime);
      }

      // Only block the click if we actually moved during the drag
      if (hasDraggedRef.current) {
        justFinishedDraggingRef.current = true;
        setTimeout(() => {
          justFinishedDraggingRef.current = false;
        }, 0);
      }
      hasDraggedRef.current = false;
      clearLocalSelection();
      setDragging(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, dragStartInfo, disabled, clipSelection, onClipSelectionChange, totalSeconds, minClipDuration, maxClipDuration, visibleDuration, viewStart]);

  // Touch event handlers for clip dragging
  useEffect(() => {
    if (!dragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleDrag(e.touches[0].clientX);
      }
    };

    const handleTouchEnd = () => {
      // Commit the final position to Zustand
      if (pendingSelectionRef.current && onClipSelectionChange) {
        onClipSelectionChange(pendingSelectionRef.current.startTime, pendingSelectionRef.current.endTime);
      }

      justFinishedDraggingRef.current = true;
      clearLocalSelection();
      setDragging(null);
      setTimeout(() => {
        justFinishedDraggingRef.current = false;
      }, 0);
    };

    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [dragging, dragStartInfo, disabled, clipSelection, onClipSelectionChange, totalSeconds, minClipDuration, maxClipDuration, visibleDuration, viewStart]);

  // Wheel event handler for Shift + scroll zoom
  useEffect(() => {
    if (!trackRef.current) return;

    const handleWheel = (e: WheelEvent) => {
      // Only zoom if Shift is held
      if (!e.shiftKey) return;

      e.preventDefault();

      // Determine zoom direction: negative deltaY = scroll up = zoom in
      const zoomInDirection = e.deltaY < 0;
      const zoomFactor = 1.2;

      const newZoom = zoomInDirection ? Math.min(zoomLevel * zoomFactor, 20) : Math.max(zoomLevel / zoomFactor, 1);

      setZoomLevel(newZoom);

      // Keep the center of the view stable
      const sel = activeClipSelection;
      const centerPoint = sel ? (sel.startTime + sel.endTime) / 2 : currentTime;

      const newVisibleDuration = totalSeconds / newZoom;
      const newOffset = Math.max(0, centerPoint - newVisibleDuration / 2);
      setViewOffset(newZoom === 1 ? 0 : Math.min(newOffset, totalSeconds - newVisibleDuration));
    };

    const element = trackRef.current;
    element.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      element.removeEventListener("wheel", handleWheel);
    };
  }, [zoomLevel, clipSelection, localClipSelection, totalSeconds, currentTime, setZoomLevel, setViewOffset]);

  // Global listeners while panning — active only when isPanning is true
  useEffect(() => {
    if (!isPanning) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current || !trackRef.current) return;
      const deltaX = e.clientX - panStartXRef.current;
      if (Math.abs(deltaX) > 3) hasPannedRef.current = true;
      const rect = trackRef.current.getBoundingClientRect();
      const deltaSeconds = -(deltaX / rect.width) * visibleDurationRef.current;
      const maxOffset = Math.max(0, totalSecondsRef.current - visibleDurationRef.current);
      setViewOffset(Math.max(0, Math.min(panStartOffsetRef.current + deltaSeconds, maxOffset)));
    };

    const handleMouseUp = () => {
      if (hasPannedRef.current) {
        justFinishedDraggingRef.current = true;
        setTimeout(() => {
          justFinishedDraggingRef.current = false;
        }, 0);
      }
      isPanningRef.current = false;
      hasPannedRef.current = false;
      setIsPanning(false);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!trackRef.current) return;

      // Two-finger pinch → zoom, anchored on the point between the fingers
      if (isPinchingRef.current && e.touches.length >= 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        if (pinchStartDistRef.current <= 0) return;

        const newZoom = Math.max(1, Math.min((pinchStartZoomRef.current * dist) / pinchStartDistRef.current, 20));
        setZoomLevel(newZoom);

        const newVisibleDuration = totalSecondsRef.current / newZoom;
        const maxOffset = Math.max(0, totalSecondsRef.current - newVisibleDuration);
        const newOffset = pinchAnchorTimeRef.current - pinchAnchorFractionRef.current * newVisibleDuration;
        setViewOffset(newZoom === 1 ? 0 : Math.max(0, Math.min(newOffset, maxOffset)));
        return;
      }

      // Single-finger pan
      if (!isPanningRef.current || e.touches.length === 0) return;
      e.preventDefault();
      const deltaX = e.touches[0].clientX - panStartXRef.current;
      if (Math.abs(deltaX) > 3) hasPannedRef.current = true;
      const rect = trackRef.current.getBoundingClientRect();
      const deltaSeconds = -(deltaX / rect.width) * visibleDurationRef.current;
      const maxOffset = Math.max(0, totalSecondsRef.current - visibleDurationRef.current);
      setViewOffset(Math.max(0, Math.min(panStartOffsetRef.current + deltaSeconds, maxOffset)));
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Fingers dropped below two: end the pinch. If one finger remains and we're
      // zoomed in, hand off to panning so the gesture continues smoothly.
      if (isPinchingRef.current && e.touches.length < 2) {
        isPinchingRef.current = false;
        if (e.touches.length === 1 && zoomLevelRef.current > 1) {
          isPanningRef.current = true;
          panStartXRef.current = e.touches[0].clientX;
          panStartOffsetRef.current = viewOffsetRef.current;
        }
      }

      if (e.touches.length > 0) return;

      if (hasPannedRef.current) {
        justFinishedDraggingRef.current = true;
        setTimeout(() => {
          justFinishedDraggingRef.current = false;
        }, 0);
      }
      isPanningRef.current = false;
      isPinchingRef.current = false;
      hasPannedRef.current = false;
      setIsPanning(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isPanning, setViewOffset, setZoomLevel]);

  const handleTrackMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || disabled || zoomLevel <= 1) return;
    isPanningRef.current = true;
    panStartXRef.current = e.clientX;
    panStartOffsetRef.current = viewOffset;
    hasPannedRef.current = false;
    setIsPanning(true);
  };

  const handleTrackTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || e.touches.length === 0) return;

    // Two fingers → pinch to zoom (allowed at any zoom level, incl. 1x)
    if (e.touches.length >= 2 && trackRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const midX = (t1.clientX + t2.clientX) / 2;
      const rect = trackRef.current.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (midX - rect.left) / rect.width));

      isPinchingRef.current = true;
      isPanningRef.current = false;
      pinchStartDistRef.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      pinchStartZoomRef.current = zoomLevel;
      pinchAnchorFractionRef.current = fraction;
      pinchAnchorTimeRef.current = viewOffset + fraction * visibleDuration;
      hasPannedRef.current = true; // suppress the seek-click after a pinch
      setIsPanning(true);
      return;
    }

    // Single finger → pan (only meaningful when zoomed in)
    if (zoomLevel <= 1) return;
    isPanningRef.current = true;
    isPinchingRef.current = false;
    panStartXRef.current = e.touches[0].clientX;
    panStartOffsetRef.current = viewOffset;
    hasPannedRef.current = false;
    setIsPanning(true);
  };

  // Handle click on timeline
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent click from firing if we just finished dragging
    if (disabled || totalSeconds === 0 || dragging || justFinishedDraggingRef.current || isSeekDisabled) {
      return;
    }

    const seekTime = getSecondsFromPosition(e.clientX, trackRef.current, viewStart, visibleDuration);
    seek(Math.max(0, Math.min(totalSeconds, seekTime)));
  };

  // Calculate progress and clip percentages
  const progressPercent = secondsToPercent(currentTime);
  const clipStartPercent = activeClipSelection ? secondsToPercent(activeClipSelection.startTime) : 0;
  const clipEndPercent = activeClipSelection ? secondsToPercent(activeClipSelection.endTime) : 100;

  // Filter events to only show those in visible range
  const visibleEvents = events.filter((event) => event.offset >= viewStart && event.offset <= viewEnd);

  // Calculate clip center for zoom controls
  const clipCenterPoint = activeClipSelection ? (activeClipSelection.startTime + activeClipSelection.endTime) / 2 : undefined;

  return (
    <div className="w-full space-y-2">
      {/* Zoom controls */}
      <ZoomControls clipCenterPoint={clipCenterPoint} currentTime={currentTime} />

      {/* Timestamp ruler above timeline */}
      <TimelineRuler viewStart={viewStart} viewEnd={viewEnd} visibleDuration={visibleDuration} />

      {/* Timeline bar - always h-8, with context menu */}
      <TimelineContextMenu trackRef={trackRef} viewStart={viewStart} visibleDuration={visibleDuration} disabled={disabled}>
        <div
          ref={trackRef}
          className={`relative h-8 w-full rounded-md overflow-hidden bg-muted touch-none ${
            disabled
              ? "cursor-not-allowed opacity-50"
              : isPanning
              ? "cursor-grabbing"
              : zoomLevel > 1
              ? "cursor-grab"
              : "cursor-pointer"
          }`}
          onClick={handleTimelineClick}
          onMouseDown={handleTrackMouseDown}
          onTouchStart={handleTrackTouchStart}
        >
          {/* Progress bar */}
          {progressPercent >= 0 && progressPercent <= 100 && (
            <div className="absolute left-0 top-0 h-full bg-purple-600/60 transition-all duration-100" style={{ width: `${Math.max(0, Math.min(progressPercent, 100))}%` }} />
          )}

          {/* Timeline segments (muted, ad breaks, etc.) */}
          <TimelineSegments secondsToPercent={secondsToPercent} />

          {/* Playhead */}
          {progressPercent >= 0 && progressPercent <= 100 && (
            <div
              className="absolute top-1/2 h-6 w-1 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-white shadow-md transition-all duration-100"
              style={{ left: `${Math.max(0, Math.min(progressPercent, 100))}%` }}
            />
          )}

          {/* Clip mode overlay */}
          {isClipMode && activeClipSelection && <ClipSelection clipSelection={activeClipSelection} clipStartPercent={clipStartPercent} clipEndPercent={clipEndPercent} disabled={disabled} />}

          {/* Event markers */}
          <EventMarkers events={visibleEvents} secondsToPercent={secondsToPercent} disabled={disabled} />
        </div>
      </TimelineContextMenu>

      {/* Time display */}
      <TimelineDisplay
        isClipMode={isClipMode}
        clipSelection={activeClipSelection}
        viewStart={viewStart}
        viewEnd={viewEnd}
        currentTime={currentTime}
        minClipDuration={minClipDuration}
        maxClipDuration={maxClipDuration}
      />

      {/* Legend */}
      <TimelineLegend isClipMode={isClipMode} events={events} />
    </div>
  );
}
