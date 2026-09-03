import { describe, expect, it } from "bun:test";
import { extractTokens, substituteTokens } from "./tokens";

describe("substituteTokens", () => {
  it("replaces known tokens and leaves unknown ones visible", () => {
    expect(substituteTokens("{name} sent {amount} bits {nope}", { name: "Ada", amount: "500" })).toBe(
      "Ada sent 500 bits {nope}"
    );
  });

  it("returns the template untouched when it has no braces", () => {
    const s = "plain text";
    expect(substituteTokens(s, { name: "x" })).toBe(s);
  });

  it("does not read inherited object keys", () => {
    expect(substituteTokens("{constructor}", {})).toBe("{constructor}");
  });
});

describe("extractTokens", () => {
  it("lists distinct tokens in order", () => {
    expect(extractTokens("{name} {amount} {name} {tier}")).toEqual(["name", "amount", "tier"]);
  });
});
