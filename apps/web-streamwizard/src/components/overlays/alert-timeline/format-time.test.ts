import { describe, expect, it } from "bun:test";
import { formatRulerLabel, formatSeconds, formatTimecode } from "./format-time";

describe("formatTimecode", () => {
  it("pads seconds and millis", () => {
    expect(formatTimecode(0)).toBe("0:00.000");
    expect(formatTimecode(1250)).toBe("0:01.250");
    expect(formatTimecode(61_005)).toBe("1:01.005");
    expect(formatTimecode(-5)).toBe("0:00.000");
  });
});

describe("formatRulerLabel", () => {
  it("uses ms under a second and trims trailing zeros above", () => {
    expect(formatRulerLabel(0)).toBe("0s");
    expect(formatRulerLabel(250)).toBe("250ms");
    expect(formatRulerLabel(1000)).toBe("1s");
    expect(formatRulerLabel(1500)).toBe("1.5s");
    expect(formatRulerLabel(1250)).toBe("1.25s");
    expect(formatRulerLabel(12_000)).toBe("12s");
  });
});

describe("formatSeconds", () => {
  it("trims", () => {
    expect(formatSeconds(5000)).toBe("5s");
    expect(formatSeconds(4200)).toBe("4.2s");
  });
});
