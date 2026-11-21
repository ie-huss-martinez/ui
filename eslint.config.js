// React's lint for ui's published source (sdk-core ADR 0063): what a
// component does while it renders, and hook dependency lists. Biome stays
// the linter and formatter for everything else. Every rule is on.
import { defineReactLint } from "@hussmartinez/sdk-config/eslint-react";

export default await defineReactLint({
  files: ["packages/ui/src/**/*.{ts,tsx}"],
});
