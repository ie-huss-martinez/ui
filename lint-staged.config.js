import preset from "@hussmartinez/sdk-config/lint-staged";
import { ESLint } from "eslint";

export default {
  ...preset,
  // React's lint for published source (sdk-core ADR 0063). Given a file its
  // configuration ignores, such as a test, a story or a fixture, it reports
  // that the file is ignored and fails, so ESLint's own answer, from the same
  // eslint.config.js, filters those out first.
  "packages/ui/src/**/*.{ts,tsx}": async (files) => {
    const eslint = new ESLint();
    const linted = [];
    for (const file of files) {
      if (!(await eslint.isPathIgnored(file))) {
        linted.push(file);
      }
    }
    return linted.length > 0
      ? [`hm-lint-react ${linted.map((file) => JSON.stringify(file)).join(" ")}`]
      : [];
  },
};
