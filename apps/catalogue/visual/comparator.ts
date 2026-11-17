/**
 * How the visual tests compare a screenshot with its baseline: with no
 * tolerance (sdk-core ADR 0048). The image is pinned, so the same code
 * renders the same pixels, and any difference is a change.
 *
 * pixelmatch has three tolerances, and each is off:
 *
 * - **No differing pixel is allowed.**
 * - **`threshold: 0`.** The default, 0.1, passes a colour close to the one
 *   before. A sunken surface gone missing from a light page is that close:
 *   the timeline's background moved by ten pixels, and the tests passed.
 * - **`includeAA: true`.** The default ignores pixels it takes for
 *   anti-aliasing, such as the edge of a thin line that moved.
 *
 * `comparator.test.ts` fails if one of them is loosened.
 */
export const strictComparator = {
  comparatorName: "pixelmatch",
  comparatorOptions: {
    allowedMismatchedPixelRatio: 0,
    threshold: 0,
    includeAA: true,
  },
} as const;
