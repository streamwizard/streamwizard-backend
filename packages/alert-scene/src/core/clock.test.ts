import { describe, expect, it } from "bun:test";
import { createSceneClock } from "./clock";

function harness(duration: number, loop = false) {
  let t = 0;
  let pending: ((ts: number) => void) | null = null;
  let nextId = 1;
  const frames: number[] = [];
  let ended = 0;
  const clock = createSceneClock({
    duration,
    loop,
    now: () => t,
    raf: (cb) => {
      pending = cb;
      return nextId++;
    },
    caf: () => {
      pending = null;
    },
    onFrame: (ms) => frames.push(ms),
    onEnded: () => ended++,
  });
  const step = (ms: number) => {
    t += ms;
    const cb = pending;
    pending = null;
    cb?.(t);
  };
  return { clock, step, frames, ended: () => ended, hasPending: () => pending !== null };
}

describe("createSceneClock", () => {
  it("advances with the injected clock and ends exactly once", () => {
    const h = harness(1000);
    h.clock.play();
    expect(h.clock.isPlaying()).toBe(true);
    h.step(400);
    h.step(400);
    expect(h.frames).toEqual([400, 800]);
    h.step(400);
    expect(h.frames).toEqual([400, 800, 1000]);
    expect(h.ended()).toBe(1);
    expect(h.clock.isPlaying()).toBe(false);
    expect(h.hasPending()).toBe(false);
    h.step(100);
    expect(h.ended()).toBe(1);
  });

  it("pauses and resumes from the same time", () => {
    const h = harness(1000);
    h.clock.play();
    h.step(300);
    h.clock.pause();
    expect(h.clock.getTime()).toBe(300);
    h.step(500); // wall clock moves, scene time does not
    expect(h.clock.getTime()).toBe(300);
    h.clock.play();
    h.step(100);
    expect(h.frames.at(-1)).toBe(400);
  });

  it("seek while paused renders one frame; seek while playing rebases", () => {
    const h = harness(1000);
    h.clock.seek(250);
    expect(h.frames).toEqual([250]);
    h.clock.play();
    h.clock.seek(600);
    h.step(100);
    expect(h.frames.at(-1)).toBe(700);
  });

  it("wraps when looping instead of ending", () => {
    const h = harness(1000, true);
    h.clock.play();
    h.step(1200);
    expect(h.frames).toEqual([200]);
    expect(h.ended()).toBe(0);
    expect(h.clock.isPlaying()).toBe(true);
  });

  it("play at the end restarts from zero", () => {
    const h = harness(1000);
    h.clock.seek(1000);
    h.clock.play();
    h.step(10);
    expect(h.frames.at(-1)).toBe(10);
  });

  it("dispose cancels the pending frame and goes quiet", () => {
    const h = harness(1000);
    h.clock.play();
    h.clock.dispose();
    expect(h.hasPending()).toBe(false);
    h.clock.seek(100);
    h.clock.play();
    expect(h.frames).toEqual([]);
  });
});
