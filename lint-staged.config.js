import preset, { isReactSource } from "@hussmartinez/sdk-config/lint-staged";

/**
 * The family's preset, with React's lint (sdk-core ADR 0063) as
 * `withReactLint` adds it: after Biome, over the whole of the source when a
 * staged file is React source, naming no file. `withReactLint` runs
 * `hm-lint-react` on `src` at the repository's root, and ui's source is in
 * `packages/ui/src`, so this runs `pnpm lint:react`, which says where.
 */
export default {
  ...preset,
  "!(*.css)": [
    ...preset["!(*.css)"],
    (files) => (files.some(isReactSource) ? ["pnpm lint:react"] : []),
  ],
};
