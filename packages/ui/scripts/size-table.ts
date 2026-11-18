/**
 * Prints the size table a pull request carries (docs/adr/0012): every size
 * check whose size or budget differs between a base, `origin/main` by
 * default, and the working tree.
 *
 *   pnpm --filter @hussmartinez/ui size:table [--base=<ref>] [--all]
 *
 * It builds the working tree, then checks the base out into a temporary git
 * worktree of this repository, installs it from the local store, builds and
 * measures it there, and removes the worktree, whatever happens. Each side is
 * measured with its own `.size-limit.js`, so a check one side lacks shows as
 * new or removed. Progress goes to stderr, and the table to stdout.
 *
 * **`--base` must name a ref you trust.** Building and measuring it runs that
 * ref's own code: its Vite config, its `.size-limit.js` and its build. That's
 * fine for `origin/main` and your own branches. Don't point it at a branch
 * from someone you wouldn't let run code on this machine.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";
import type { SizeResult } from "./size-table-format.js";

const PACKAGE = "packages/ui";
const here = fileURLToPath(new URL("../", import.meta.url));

const args = process.argv.slice(2);
const unknown = args.filter((arg) => arg !== "--all" && !arg.startsWith("--base="));
if (unknown.length > 0) {
  process.stderr.write(`Unknown argument ${unknown.join(" ")}. Use --base=<ref> and --all.\n`);
  process.exit(2);
}
const ref = args.find((arg) => arg.startsWith("--base="))?.slice("--base=".length) || "origin/main";

const run = (command: string, commandArgs: string[], cwd: string): string =>
  execFileSync(command, commandArgs, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

/** Builds the package in `root` and measures it with that tree's own budgets. */
function measure(root: string): SizeResult[] {
  const cwd = join(root, PACKAGE);
  run("pnpm", ["exec", "vite", "build"], cwd);
  let json: string;
  try {
    json = run("pnpm", ["exec", "size-limit", "--json"], cwd);
  } catch (error) {
    // size-limit exits with 1 when a check is over its budget, and still
    // prints every result: the table is how the over-budget one gets raised.
    json = (error as { stdout?: string }).stdout ?? "";
    if (!json.trim().startsWith("[")) {
      throw error;
    }
  }
  return JSON.parse(json) as SizeResult[];
}

const top = run("git", ["rev-parse", "--show-toplevel"], here).trim();
// A full commit hash, so nothing else in the reference reaches git below.
let base: string;
try {
  base = run("git", ["rev-parse", "--verify", `${ref}^{commit}`], top).trim();
} catch {
  process.stderr.write(`${ref} isn't a commit here. Fetch it, or pass --base=<ref>.\n`);
  process.exit(2);
}

process.stderr.write("Measuring the working tree…\n");
const after = measure(top);

const worktree = mkdtempSync(join(tmpdir(), "hm-ui-size-base-"));
let before: SizeResult[];
try {
  const label = base.startsWith(ref) ? base.slice(0, 7) : `${ref} (${base.slice(0, 7)})`;
  process.stderr.write(`Measuring ${label} in a temporary worktree…\n`);
  run("git", ["worktree", "add", "--detach", worktree, base], top);
  run("pnpm", ["install", "--frozen-lockfile", "--prefer-offline", "--ignore-scripts"], worktree);
  before = measure(worktree);
} finally {
  try {
    run("git", ["worktree", "remove", "--force", worktree], top);
  } catch {
    // It was never added; the folder is removed below either way.
  }
  rmSync(worktree, { recursive: true, force: true });
}

// Vite's module runner loads the TypeScript source, as for the icons and tokens.
const { module } = await runnerImport<typeof import("./size-table-format.js")>(
  fileURLToPath(new URL("size-table-format.ts", import.meta.url)),
);
process.stdout.write(`${module.sizeTable(before, after, { all: args.includes("--all") })}\n`);
