import { describe, expect, it } from "bun:test";
import { beginDrag, cancelActiveDrag, isDragging } from "./drag-registry";

describe("drag registry", () => {
  it("tracks one drag and cancels it", () => {
    let cancelled = 0;
    expect(isDragging()).toBe(false);
    beginDrag(() => cancelled++);
    expect(isDragging()).toBe(true);
    expect(cancelActiveDrag()).toBe(true);
    expect(cancelled).toBe(1);
    expect(isDragging()).toBe(false);
    expect(cancelActiveDrag()).toBe(false);
  });

  it("a released drag can no longer be cancelled, and a newer drag wins", () => {
    let first = 0;
    let second = 0;
    const release = beginDrag(() => first++);
    release();
    expect(isDragging()).toBe(false);
    const releaseA = beginDrag(() => first++);
    beginDrag(() => second++);
    releaseA(); // stale release must not clear the newer drag
    expect(isDragging()).toBe(true);
    cancelActiveDrag();
    expect(first).toBe(0);
    expect(second).toBe(1);
  });
});
