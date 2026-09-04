import { describe, expect, it } from "bun:test";
import { fileNameFromUrl } from "./media-url";

describe("fileNameFromUrl", () => {
  it("returns the decoded last path segment", () => {
    expect(fileNameFromUrl("https://cdn.test/assets/u1/a1/My%20Sound.mp3")).toBe("My Sound.mp3");
    expect(fileNameFromUrl("https://cdn.test/assets/u1/a1/clip.webm?x=1#t")).toBe("clip.webm");
    expect(fileNameFromUrl("https://cdn.test/assets/u1/a1/clip.webm/")).toBe("clip.webm");
  });

  it("gives nothing for empty, inline or hostname-only urls", () => {
    expect(fileNameFromUrl("")).toBe("");
    expect(fileNameFromUrl("   ")).toBe("");
    expect(fileNameFromUrl("data:audio/wav;base64,UklGRg==")).toBe("");
    expect(fileNameFromUrl("blob:https://app.test/abc")).toBe("");
    expect(fileNameFromUrl("https://cdn.test")).toBe("");
  });

  it("survives a malformed escape", () => {
    expect(fileNameFromUrl("https://cdn.test/a/%E0%A4%A")).toBe("%E0%A4%A");
  });
});
