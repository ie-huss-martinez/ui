import { describe, expect, it } from "vitest";
import config from "../vitest.config.js";
import { strictComparator } from "./comparator.js";

describe("the visual tests' comparison", () => {
  it("has no tolerance: no differing pixel, no colour threshold, no ignored anti-aliasing", () => {
    expect(strictComparator).toEqual({
      comparatorName: "pixelmatch",
      comparatorOptions: { allowedMismatchedPixelRatio: 0, threshold: 0, includeAA: true },
    });
  });

  it("is what the visual project uses", async () => {
    const resolved = await (typeof config === "function"
      ? config({ mode: "test", command: "serve" })
      : config);
    const projects = (resolved.test?.projects ?? []) as {
      test?: { name?: string; browser?: { expect?: { toMatchScreenshot?: unknown } } };
    }[];
    const visual = projects.find((project) => project.test?.name === "visual");
    expect(visual?.test?.browser?.expect?.toMatchScreenshot).toBe(strictComparator);
  });
});
