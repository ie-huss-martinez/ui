// React's lint for ui's published source (sdk-core ADR 0063): what a
// component does while it renders, and hook dependency lists. Biome stays
// the linter and formatter for everything else.
import { defineReactLint } from "@hussmartinez/sdk-config/eslint-react";

export default await defineReactLint({
  files: ["packages/ui/src/**/*.{ts,tsx}"],
  // Rules ui still has findings for. Each is off, never a warning, until the
  // pull request that fixes its findings turns it on.
  off: [
    // 4: Dialog's and Toolbar's useMergedRef write the forwarded ref in a ref
    // callback. One shared merged-ref helper the plugin accepts fixes both.
    "immutability",
    // 1: useTimelineLanes's useMemo, whose manual dependencies differ from
    // what the compiler infers.
    "preserve-manual-memoization",
  ],
});
