import { describe, expect, it } from "bun:test";
import { MAX_TEXT_LENGTH } from "@repo/alert-scene";
import { insertToken } from "./token-insert";

describe("insertToken", () => {
  it("inserts at the caret and lands the caret after the token", () => {
    expect(insertToken("Hi  there", "name", 3, 3)).toEqual({ text: "Hi {name} there", caret: 9 });
  });

  it("replaces a selection, whichever way round it was made", () => {
    expect(insertToken("Hi bob there", "name", 3, 6)).toEqual({ text: "Hi {name} there", caret: 9 });
    expect(insertToken("Hi bob there", "name", 6, 3)).toEqual({ text: "Hi {name} there", caret: 9 });
  });

  it("appends when the caret sits at the end and clamps a stale caret", () => {
    expect(insertToken("Hi", "amount", 2, 2)).toEqual({ text: "Hi{amount}", caret: 10 });
    expect(insertToken("Hi", "amount", 99, 99)).toEqual({ text: "Hi{amount}", caret: 10 });
  });

  it("refuses rather than truncates past the text limit", () => {
    const full = "x".repeat(MAX_TEXT_LENGTH - 3);
    expect(insertToken(full, "name", 5, 5)).toEqual({ text: full, caret: 5 });
    const room = "x".repeat(MAX_TEXT_LENGTH - 6);
    expect(insertToken(room, "name", 0, 0).text.length).toBe(MAX_TEXT_LENGTH);
  });
});
