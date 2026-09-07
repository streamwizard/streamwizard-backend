import { expect, test } from "bun:test";
import { parseNumberFieldValue } from "./number-field";

test("a plain number parses", () => {
  expect(parseNumberFieldValue("500")).toBe(500);
  expect(parseNumberFieldValue("-40")).toBe(-40);
});

test("an empty field commits nothing rather than zero", () => {
  expect(parseNumberFieldValue("")).toBeNull();
  expect(parseNumberFieldValue("   ")).toBeNull();
});

test("junk commits nothing", () => {
  expect(parseNumberFieldValue("abc")).toBeNull();
  expect(parseNumberFieldValue("12px")).toBeNull();
});

test("a value under the field's own minimum is refused", () => {
  expect(parseNumberFieldValue("0", { min: 1 })).toBeNull();
  expect(parseNumberFieldValue("-3", { min: 0 })).toBeNull();
  expect(parseNumberFieldValue("1", { min: 1 })).toBe(1);
});

test("a value over the maximum is refused", () => {
  expect(parseNumberFieldValue("361", { max: 360 })).toBeNull();
  expect(parseNumberFieldValue("360", { max: 360 })).toBe(360);
});

test("zero is fine where the field allows it", () => {
  expect(parseNumberFieldValue("0", { min: 0 })).toBe(0);
  expect(parseNumberFieldValue("0")).toBe(0);
});

test("a partially typed negative sign commits nothing", () => {
  expect(parseNumberFieldValue("-")).toBeNull();
});
