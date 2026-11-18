/**
 * Formats size-limit's results before and after a change as the Markdown
 * table a pull request carries (docs/adr/0012, CONTRIBUTING.md). Pure, so it
 * can be tested without building anything; `size-table.ts` does the measuring.
 */

/** One check from `size-limit --json`. */
export interface SizeResult {
  readonly name: string;
  readonly size: number;
  readonly sizeLimit?: number | undefined;
}

export interface SizeTableOptions {
  /** Include the checks whose size and budget didn't change. */
  readonly all?: boolean | undefined;
}

const kB = (bytes: number | undefined): string =>
  bytes === undefined ? "–" : `${(bytes / 1000).toFixed(2)} kB`;

const budget = (bytes: number | undefined): string =>
  // Budgets are set in steps of 0.5 kB, so they print as written.
  bytes === undefined ? "–" : `${Number((bytes / 1000).toFixed(2))} kB`;

function change(before: number | undefined, after: number | undefined): string {
  if (before === undefined) {
    return "new";
  }
  if (after === undefined) {
    return "removed";
  }
  const delta = after - before;
  return delta === 0 ? "0" : `${delta > 0 ? "+" : "−"}${(Math.abs(delta) / 1000).toFixed(2)} kB`;
}

/**
 * The checks whose size or budget changed, in the order they're configured,
 * with checks only one side has marked "new" or "removed". With nothing
 * changed, says so in one line instead of an empty table.
 */
export function sizeTable(
  before: readonly SizeResult[],
  after: readonly SizeResult[],
  { all = false }: SizeTableOptions = {},
): string {
  const was = new Map(before.map((result) => [result.name, result]));
  const names = [
    ...after.map((result) => result.name),
    ...before.map((result) => result.name).filter((name) => !after.some((r) => r.name === name)),
  ];
  const is = new Map(after.map((result) => [result.name, result]));
  const rows = names.flatMap((name) => {
    const old = was.get(name);
    const now = is.get(name);
    const same = old?.size === now?.size && old?.sizeLimit === now?.sizeLimit;
    if (same && !all) {
      return [];
    }
    const limits =
      old?.sizeLimit === now?.sizeLimit
        ? budget(now?.sizeLimit)
        : `${budget(old?.sizeLimit)} → ${budget(now?.sizeLimit)}`;
    return [
      `| ${name} | ${kB(old?.size)} | ${kB(now?.size)} | ${change(old?.size, now?.size)} | ${limits} |`,
    ];
  });
  if (rows.length === 0) {
    return "No size or budget changed.";
  }
  return ["| Check | Before | After | Change | Budget |", "|---|---|---|---|---|", ...rows].join(
    "\n",
  );
}
