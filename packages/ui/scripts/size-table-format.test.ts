import { describe, expect, it } from "vitest";
import { sizeTable } from "./size-table-format.js";

const button = { name: "Import: Button", size: 731, sizeLimit: 1000 };
const react = { name: "React entry", size: 23_987, sizeLimit: 24_000 };

describe("sizeTable", () => {
  it("lists only the checks whose size or budget changed", () => {
    expect(
      sizeTable([button, react], [button, { ...react, size: 24_312, sizeLimit: 24_500 }]),
    ).toBe(`| Check | Before | After | Change | Budget |
|---|---|---|---|---|
| React entry | 23.99 kB | 24.31 kB | +0.33 kB | 24 kB → 24.5 kB |`);
  });

  it("lists every check with all, and shows a decrease with a minus sign", () => {
    expect(
      sizeTable([button, react], [{ ...button, size: 700 }, react], { all: true }),
    ).toBe(`| Check | Before | After | Change | Budget |
|---|---|---|---|---|
| Import: Button | 0.73 kB | 0.70 kB | −0.03 kB | 1 kB |
| React entry | 23.99 kB | 23.99 kB | 0 | 24 kB |`);
  });

  it("marks a check only one side has as new or removed", () => {
    const dialog = { name: "Import: Dialog", size: 1860, sizeLimit: 2000 };
    expect(sizeTable([button], [dialog])).toBe(`| Check | Before | After | Change | Budget |
|---|---|---|---|---|
| Import: Dialog | – | 1.86 kB | new | – → 2 kB |
| Import: Button | 0.73 kB | – | removed | 1 kB → – |`);
  });

  it("gives a change under 5 bytes in bytes, and a larger one in kilobytes", () => {
    expect(
      sizeTable(
        [button, react],
        [
          { ...button, size: 730 },
          { ...react, size: 23_993 },
        ],
      ),
    ).toBe(`| Check | Before | After | Change | Budget |
|---|---|---|---|---|
| Import: Button | 0.73 kB | 0.73 kB | −1 B | 1 kB |
| React entry | 23.99 kB | 23.99 kB | +0.01 kB | 24 kB |`);
  });

  it("always lists a floor, moved or not (sdk-core ADR 0056)", () => {
    const floor = { name: "Import: the floor, Button", size: 729, sizeLimit: 800 };
    expect(
      sizeTable([floor, react], [floor, react]),
    ).toBe(`| Check | Before | After | Change | Budget |
|---|---|---|---|---|
| Import: the floor, Button | 0.73 kB | 0.73 kB | 0 | 0.8 kB |`);
  });

  it("says so in one line when nothing changed", () => {
    expect(sizeTable([button, react], [button, react])).toBe("No size or budget changed.");
  });
});
