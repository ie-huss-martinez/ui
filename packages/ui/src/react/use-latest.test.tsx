import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { renderToString } from "react-dom/server";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { useLatest } from "./use-latest.js";

const require = createRequire(import.meta.url);
const packageRoot = (name: string) => dirname(require.resolve(`${name}/package.json`));

afterEach(() => {
  vi.restoreAllMocks();
});

function WithLatest() {
  useLatest(() => undefined);
  return <span>Ready</span>;
}

describe("useLatest on the server", () => {
  it("renders with React 19 without a warning", () => {
    const logged = [vi.spyOn(console, "error"), vi.spyOn(console, "warn")];
    expect(renderToString(<WithLatest />)).toBe("<span>Ready</span>");
    for (const spy of logged) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});

/**
 * React 18.3, the oldest React ui supports, warns on the server about a
 * layout effect, and React 19 doesn't. `react-18` and `react-dom-18` are
 * those versions; React DOM's own `react` would resolve to the workspace's
 * React 19, so the check bundles the hook with esbuild, which sends every
 * `react` import in the bundle, React DOM's included, to React 18.3.1.
 */
const directory = await mkdtemp(join(tmpdir(), "hm-ui-react18-"));
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

type Rendered = { version: string; html: string };
type React18 = { renderLatest: () => Rendered; renderLayoutEffect: () => Rendered };

async function loadReact18(): Promise<React18> {
  const hook = fileURLToPath(new URL("./use-latest.ts", import.meta.url));
  const result = await build({
    stdin: {
      contents: `
        import { createElement, useLayoutEffect, version } from "react";
        import { renderToString } from "react-dom/server";
        import { useLatest } from ${JSON.stringify(hook)};
        function WithLatest() { useLatest(() => undefined); return createElement("span", null, "Ready"); }
        function WithLayoutEffect() { useLayoutEffect(() => undefined); return createElement("span", null, "Ready"); }
        export const renderLatest = () => ({ version, html: renderToString(createElement(WithLatest)) });
        export const renderLayoutEffect = () => ({ version, html: renderToString(createElement(WithLayoutEffect)) });
      `,
      resolveDir: directory,
      loader: "js",
    },
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    alias: { react: packageRoot("react-18"), "react-dom": packageRoot("react-dom-18") },
    // React's development build, which is the one that warns.
    define: { "process.env.NODE_ENV": '"development"' },
    banner: {
      js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
    },
    logLevel: "silent",
  });
  const file = join(directory, "react18.mjs");
  await writeFile(file, result.outputFiles[0]?.text ?? "");
  return (await import(/* @vite-ignore */ pathToFileURL(file).href)) as React18;
}

const react18 = await loadReact18();

describe("useLatest on the server with React 18.3", () => {
  it("renders without a warning", () => {
    const logged = [vi.spyOn(console, "error"), vi.spyOn(console, "warn")];
    expect(react18.renderLatest()).toEqual({ version: "18.3.1", html: "<span>Ready</span>" });
    for (const spy of logged) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("would warn with a layout effect instead, so the check can see a warning", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(react18.renderLayoutEffect().version).toBe("18.3.1");
    expect(error).toHaveBeenCalled();
    expect(String(error.mock.calls[0]?.[0])).toContain(
      "useLayoutEffect does nothing on the server",
    );
  });
});
