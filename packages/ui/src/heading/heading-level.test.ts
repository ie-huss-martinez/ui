import { afterEach, describe, expect, it, vi } from "vitest";
import { nestedHeadingLevel, toHeadingLevel } from "./heading-level.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("toHeadingLevel", () => {
  it("takes the five levels, as numbers or as an attribute's text", () => {
    for (const level of [2, 3, 4, 5, 6] as const) {
      expect(toHeadingLevel(level)).toBe(level);
      expect(toHeadingLevel(String(level))).toBe(level);
    }
    expect(toHeadingLevel(" 4 ")).toBe(4);
  });

  it("treats a missing value as 2, without a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(toHeadingLevel(undefined)).toBe(2);
    expect(toHeadingLevel(null)).toBe(2);
    expect(warn).not.toHaveBeenCalled();
  });

  it("treats anything else as 2, with a development warning that names the value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    for (const value of [1, 7, 2.5, 0, Number.NaN, "1", "h3", "", "3.0", true, {}, 10n]) {
      expect(toHeadingLevel(value), String(value)).toBe(2);
    }
    expect(warn).toHaveBeenCalledTimes(12);
    expect(warn).toHaveBeenCalledWith(
      '[@hussmartinez/ui] "h3" isn\'t a heading level: use 2, 3, 4, 5 or 6. Using 2.',
    );
    expect(warn).toHaveBeenCalledWith(
      "[@hussmartinez/ui] 7 isn't a heading level: use 2, 3, 4, 5 or 6. Using 2.",
    );
  });

  it("never throws while describing a value it can't print", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(toHeadingLevel(Object.create(null))).toBe(2);
    expect(warn).toHaveBeenCalledWith(
      "[@hussmartinez/ui] object isn't a heading level: use 2, 3, 4, 5 or 6. Using 2.",
    );
  });
});

describe("nestedHeadingLevel", () => {
  it("goes one level down by default, and depth levels down when given", () => {
    expect(nestedHeadingLevel(2)).toBe(3);
    expect(nestedHeadingLevel(3, 2)).toBe(5);
    expect(nestedHeadingLevel(4, 0)).toBe(4);
  });

  it("never passes 6 (sdk-core ADR 0058)", () => {
    expect(nestedHeadingLevel(6)).toBe(6);
    expect(nestedHeadingLevel(5, 3)).toBe(6);
  });

  it("ignores a depth that isn't a positive whole number", () => {
    expect(nestedHeadingLevel(3, -1)).toBe(3);
    expect(nestedHeadingLevel(3, 1.5)).toBe(3);
    expect(nestedHeadingLevel(3, Number.NaN)).toBe(3);
  });
});
