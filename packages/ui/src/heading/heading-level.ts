import { warnInDevelopment } from "../internal/development.js";

declare const process: { readonly env: { readonly NODE_ENV?: string } };

/**
 * The level of a heading in a page `ui` doesn't own: `2` to `6`
 * (sdk-core ADR 0058). `1` isn't one, because a page's one `<h1>` names the
 * page, and that's the host's.
 *
 * An SDK's editor that renders headings takes `headingLevel?: HeadingLevel`,
 * the level of its top headings, and re-exports this type from its React
 * entry.
 *
 * @public
 */
export type HeadingLevel = 2 | 3 | 4 | 5 | 6;

/** The level an editor's top headings have when the host doesn't say. */
const DEFAULT_LEVEL: HeadingLevel = 2;

/** The value as a warning shows it; never throws, whatever a host passed. */
function describeValue(value: unknown): string {
  if (typeof value === "string") {
    return `"${value}"`;
  }
  try {
    return String(value);
  } catch {
    return typeof value;
  }
}

function isHeadingLevel(value: unknown): value is HeadingLevel {
  return value === 2 || value === 3 || value === 4 || value === 5 || value === 6;
}

/**
 * A host's heading level, as a {@link HeadingLevel}. It takes a number, or
 * the text of an element's `heading-level` attribute, such as `"3"`.
 *
 * Anything else is treated as `2`, the default (sdk-core ADR 0058): with a
 * development-only warning when a value was given, and silently when it's
 * `undefined` or `null`, as for an attribute that isn't set.
 *
 * @example
 * ```ts
 * const level = toHeadingLevel(element.getAttribute("heading-level"));
 * ```
 *
 * @param value - The host's value.
 * @returns The level, `2` to `6`.
 *
 * @public
 */
export function toHeadingLevel(value: unknown): HeadingLevel {
  const level = typeof value === "string" && /^\s*[2-6]\s*$/.test(value) ? Number(value) : value;
  if (isHeadingLevel(level)) {
    return level;
  }
  if (value !== undefined && value !== null) {
    if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
      warnInDevelopment(
        `${describeValue(value)} isn't a heading level: use 2, 3, 4, 5 or 6. Using 2.`,
      );
    }
  }
  return DEFAULT_LEVEL;
}

/**
 * The level of a heading `depth` steps below one at `level`: one level down
 * for each step, and never past 6 (sdk-core ADR 0058). HTML has nothing
 * deeper, so a heading that would pass 6 is an `<h6>`.
 *
 * @example
 * ```ts
 * nestedHeadingLevel(2); // 3
 * nestedHeadingLevel(5, 2); // 6
 * ```
 *
 * @param level - The level of the heading above.
 * @param depth - How many levels below it, a whole number. Defaults to `1`.
 * @returns The nested heading's level.
 *
 * @public
 */
export function nestedHeadingLevel(level: HeadingLevel, depth = 1): HeadingLevel {
  const steps = Number.isInteger(depth) && depth > 0 ? depth : 0;
  return Math.min(toHeadingLevel(level) + steps, 6) as HeadingLevel;
}
