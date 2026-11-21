/**
 * Fails when the package's tarball holds a type declaration that no entry
 * reaches: a `.d.ts` that `exports` doesn't name, and that no declaration
 * it names imports. Such a file is dead weight at best, and at worst a second
 * copy of an entry's types that drifts from it.
 *
 *   node scripts/check-packed-types.ts
 *
 * It packs the package with pnpm, as a release does, into a temporary
 * folder, reads the list of packed files, and removes the tarball.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import { fileURLToPath } from "node:url";

/** Every string in an `exports` map, or in a top-level `types`, that names a declaration. */
function declaredEntries(manifest: { exports?: unknown; types?: unknown }): string[] {
  const found: string[] = [];
  const visit = (value: unknown): void => {
    if (typeof value === "string") {
      if (value.endsWith(".d.ts")) {
        found.push(posix.normalize(value));
      }
    } else if (value && typeof value === "object") {
      for (const inner of Object.values(value)) {
        visit(inner);
      }
    }
  };
  visit(manifest.exports);
  visit(manifest.types);
  return found;
}

/** The relative files a declaration refers to: imports, re-exports, `import()` types and references. */
function references(text: string): string[] {
  const specifiers = [
    ...text.matchAll(/\bfrom\s+["'](\.{1,2}\/[^"']+)["']/g),
    ...text.matchAll(/\bimport\s*\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g),
    ...text.matchAll(/\bimport\s+["'](\.{1,2}\/[^"']+)["']/g),
    ...text.matchAll(/\/\/\/\s*<reference\s+path=["']([^"']+)["']/g),
  ];
  return specifiers.map(([, specifier]) => specifier as string);
}

/** The declaration files a relative specifier can mean, from the file that uses it. */
function candidates(from: string, specifier: string): string[] {
  const target = posix.normalize(posix.join(posix.dirname(from), specifier));
  if (target.endsWith(".d.ts")) {
    return [target];
  }
  const bare = target.replace(/\.(m|c)?js$/, "");
  return [`${bare}.d.ts`, `${target}.d.ts`, posix.join(target, "index.d.ts")];
}

/**
 * The packed `.d.ts` files that no entry reaches, starting from those
 * `exports` and `types` name and following relative references between
 * declarations.
 *
 * @param packed - The packed files' paths, relative to the package, as `pnpm pack --json` lists them.
 * @param manifest - The package's `package.json`.
 * @param read - Reads a packed file by its path.
 * @returns The unreached declarations, sorted.
 */
export function unreachableDeclarations(
  packed: readonly string[],
  manifest: { exports?: unknown; types?: unknown },
  read: (path: string) => string,
): string[] {
  const files = new Set(packed.map((path) => posix.normalize(path)));
  const reached = new Set<string>();
  const queue = declaredEntries(manifest).filter((path) => files.has(path));
  for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
    if (reached.has(path)) {
      continue;
    }
    reached.add(path);
    for (const specifier of references(read(path))) {
      const next = candidates(path, specifier).find((candidate) => files.has(candidate));
      if (next) {
        queue.push(next);
      }
    }
  }
  return [...files].filter((path) => path.endsWith(".d.ts") && !reached.has(path)).sort();
}

if (import.meta.main) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const destination = mkdtempSync(join(tmpdir(), "hm-ui-pack-"));
  try {
    const output = execFileSync("pnpm", ["pack", "--json", "--pack-destination", destination], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const { files } = JSON.parse(output) as { files: { path: string }[] };
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const stray = unreachableDeclarations(
      files.map((file) => file.path),
      manifest,
      (path) => readFileSync(join(root, path), "utf8"),
    );
    if (stray.length > 0) {
      process.stderr.write(
        `The tarball holds type declarations that no entry in package.json's exports reaches:\n${stray.map((path) => `  ${path}`).join("\n")}\nStop the build emitting them, or leave them out of "files".\n`,
      );
      process.exit(1);
    }
    process.stdout.write(
      `Every packed declaration is reached from exports (${files.filter((file) => file.path.endsWith(".d.ts")).length} files).\n`,
    );
  } finally {
    rmSync(destination, { recursive: true, force: true });
  }
}
