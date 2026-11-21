import { describe, expect, it } from "vitest";
import { unreachableDeclarations } from "./check-packed-types.js";

const manifest = {
  exports: {
    ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
    "./react": { types: "./dist/react.d.ts", default: "./dist/react.js" },
    "./styles.css": "./dist/styles.css",
  },
};

function check(files: Record<string, string>, packageJson: object = manifest): string[] {
  return unreachableDeclarations(Object.keys(files), packageJson, (path) => files[path] ?? "");
}

describe("unreachableDeclarations", () => {
  it("finds a declaration that no entry names, such as an API Extractor rollup left behind", () => {
    expect(
      check({
        "dist/index.d.ts": "export declare const a: 1;",
        "dist/react.d.ts": "export declare const b: 2;",
        "dist/ui.d.ts": "export declare const b: 2;",
        "dist/index.js": "",
      }),
    ).toEqual(["dist/ui.d.ts"]);
  });

  it("follows imports, re-exports, import() types and references from the entries", () => {
    expect(
      check({
        "dist/index.d.ts":
          'export * from "./shared/a.js";\n/// <reference path="./globals.d.ts" />',
        "dist/react.d.ts":
          'import type { B } from "./shared/b";\nexport type C = import("./shared/c.js").C;',
        "dist/shared/a.d.ts": 'export { D } from "../deep/index.js";',
        "dist/shared/b.d.ts": "",
        "dist/shared/c.d.ts": "",
        "dist/deep/index.d.ts": "",
        "dist/globals.d.ts": "",
        "dist/orphan.d.ts": 'export * from "./shared/a.js";',
      }),
    ).toEqual(["dist/orphan.d.ts"]);
  });

  it("starts from a top-level types field too, and ignores packages' own imports", () => {
    expect(
      check(
        { "dist/main.d.ts": 'import { Messages } from "@hussmartinez/sdk-core";' },
        { types: "./dist/main.d.ts" },
      ),
    ).toEqual([]);
  });

  it("reports every declaration when exports names none of them", () => {
    expect(check({ "dist/a.d.ts": "", "dist/b.d.ts": "" }, { exports: "./dist/a.js" })).toEqual([
      "dist/a.d.ts",
      "dist/b.d.ts",
    ]);
  });
});
