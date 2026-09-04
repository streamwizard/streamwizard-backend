import { describe, expect, it } from "bun:test";
import { createMediaSyncState, syncMedia, type MediaSyncOptions } from "./media-sync";

/** Just enough of HTMLMediaElement for syncMedia; no DOM needed. */
interface Stub {
  duration: number;
  currentTime: number;
  paused: boolean;
  ended: boolean;
  seeking: boolean;
  readyState: number;
  loop: boolean;
  volume: number;
  muted: boolean;
  playCalls: number;
  pauseCalls: number;
  listeners: Record<string, Array<() => void>>;
  play(): Promise<void>;
  pause(): void;
  addEventListener(type: string, fn: () => void): void;
  removeEventListener(type: string, fn: () => void): void;
  fire(type: string): void;
}

function stub(over: Partial<Stub> = {}): Stub {
  const el: Stub = {
    duration: 2,
    currentTime: 0,
    paused: true,
    ended: false,
    seeking: false,
    readyState: 4,
    loop: false,
    volume: 1,
    muted: false,
    playCalls: 0,
    pauseCalls: 0,
    listeners: {},
    play() {
      this.playCalls += 1;
      this.paused = false;
      this.ended = false;
      return Promise.resolve();
    },
    pause() {
      this.pauseCalls += 1;
      this.paused = true;
    },
    addEventListener(type, fn) {
      (this.listeners[type] ??= []).push(fn);
    },
    removeEventListener(type, fn) {
      this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== fn);
    },
    fire(type) {
      for (const fn of this.listeners[type] ?? []) fn();
    },
    ...over,
  };
  return el;
}

const asElement = (el: Stub) => el as unknown as HTMLMediaElement;

function opts(over: Partial<MediaSyncOptions>): MediaSyncOptions {
  return { mediaTimeMs: 0, playing: false, volume: 1, muted: false, loop: false, ...over };
}

describe("syncMedia while playing", () => {
  it("starts the element and only seeks once it has drifted", () => {
    const el = stub({ currentTime: 0.5 });
    const state = createMediaSyncState(asElement(el));
    syncMedia(asElement(el), state, opts({ playing: true, mediaTimeMs: 520 }), 1000);
    expect(el.playCalls).toBe(1);
    expect(el.currentTime).toBe(0.5);
    syncMedia(asElement(el), state, opts({ playing: true, mediaTimeMs: 900 }), 1300);
    expect(el.currentTime).toBe(0.9);
  });

  it("holds the last frame past the end of a non-looping source", () => {
    const el = stub({ currentTime: 1.9, paused: true, ended: true });
    const state = createMediaSyncState(asElement(el));
    syncMedia(asElement(el), state, opts({ playing: true, mediaTimeMs: 2500 }), 1000);
    expect(el.playCalls).toBe(0);
    expect(el.currentTime).toBe(2);
    syncMedia(asElement(el), state, opts({ playing: true, mediaTimeMs: 2600 }), 1016);
    expect(el.playCalls).toBe(0);
    expect(el.currentTime).toBe(2);
  });

  it("does not restart an element that ended a hair before the clock did", () => {
    const el = stub({ currentTime: 1.95, paused: true, ended: true });
    const state = createMediaSyncState(asElement(el));
    syncMedia(asElement(el), state, opts({ playing: true, mediaTimeMs: 1900 }), 1000);
    expect(el.playCalls).toBe(0);
  });

  it("wraps a looping source instead of holding it", () => {
    const el = stub({ currentTime: 0.5, paused: true, ended: true });
    const state = createMediaSyncState(asElement(el));
    syncMedia(asElement(el), state, opts({ playing: true, loop: true, mediaTimeMs: 2500 }), 1000);
    expect(el.playCalls).toBe(1);
    expect(el.loop).toBe(true);
    expect(el.currentTime).toBe(0.5);
  });

  it("leaves a source with unknown duration alone", () => {
    const el = stub({ duration: Infinity, currentTime: 3 });
    const state = createMediaSyncState(asElement(el));
    syncMedia(asElement(el), state, opts({ playing: true, mediaTimeMs: 3000 }), 1000);
    expect(el.playCalls).toBe(1);
    expect(el.currentTime).toBe(3);
  });
});

describe("syncMedia while paused", () => {
  it("pauses, seeks frame-accurately and defers a seek until metadata arrives", () => {
    const el = stub({ paused: false, currentTime: 1, readyState: 0 });
    const state = createMediaSyncState(asElement(el));
    syncMedia(asElement(el), state, opts({ mediaTimeMs: 1500 }), 1000);
    expect(el.pauseCalls).toBe(1);
    expect(el.currentTime).toBe(1);
    expect(state.pendingSeek).toBe(1.5);
    el.readyState = 1;
    el.fire("loadedmetadata");
    expect(el.currentTime).toBe(1.5);
    expect(state.pendingSeek).toBeNull();
  });

  it("writes volume and mute only when they change, and mutes at zero volume", () => {
    const el = stub();
    const state = createMediaSyncState(asElement(el));
    syncMedia(asElement(el), state, opts({ volume: 0.4 }), 0);
    expect(el.volume).toBe(0.4);
    expect(el.muted).toBe(false);
    syncMedia(asElement(el), state, opts({ volume: 0 }), 16);
    expect(el.muted).toBe(true);
    syncMedia(asElement(el), state, opts({ volume: 0.4, muted: true }), 32);
    expect(el.muted).toBe(true);
  });
});
