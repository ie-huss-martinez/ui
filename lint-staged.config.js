import preset from "@hussmartinez/sdk-config/lint-staged";

/** Tests and stories, which React's lint leaves out (sdk-core ADR 0063). */
const NOT_LINTED = /\.(test|stories)\.[cm]?tsx?$/;

export default {
  ...preset,
  // React's lint for published source. Given a file it leaves out by path,
  // it reports that the file is ignored and fails, so those are filtered here.
  "packages/ui/src/**/*.{ts,tsx}": (files) => {
    const linted = files.filter((file) => !NOT_LINTED.test(file));
    return linted.length > 0
      ? [`hm-lint-react ${linted.map((file) => JSON.stringify(file)).join(" ")}`]
      : [];
  },
};
