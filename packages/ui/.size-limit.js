/**
 * Size budgets (docs/adr/0012). Two kinds:
 *
 * - **Per entry point** (sdk-core ADR 0015): the brotli size of each built
 *   entry, with the shared chunks it loads, unminified. An upper bound:
 *   applications ship less, because their bundler minifies and drops what
 *   they don't import.
 * - **Per import scenario**, for the React entry: what an application ships
 *   for one import, bundled and minified with esbuild, with React and
 *   sdk-core left out. These are the budgets review judges a change by. A
 *   scenario's budget is never raised for code the scenario doesn't import:
 *   if a component's change moves the floor, that's the regression to fix.
 *
 * Every budget is raised by the pull request that needs it, to its
 * measurement rounded up to the next 0.5 kB, with a table of what moved.
 * The floors are tighter (sdk-core ADR 0056): their measurement rounded up
 * to the next 0.1 kB, never raised, and the table shows them every time:
 * their names start with "the floor", which `size:table` looks for.
 *
 * The checks come from `@hussmartinez/sdk-config/size`, the family's
 * helpers for these budgets (sdk-core ADRs 0055 and 0056).
 */

import { readFileSync } from "node:fs";
import { entryBudget, exportNames, importBudget } from "@hussmartinez/sdk-config/size";

/** The React entry's exports, read from the build so no list goes stale. */
const EXPORTS = exportNames("dist/react.js");

/**
 * Every icon component, from the generated list of icon names: `zoom-in` is
 * `ZoomInIcon`. Each one ships only to the applications that import it.
 */
const ICONS = [
  ...readFileSync(new URL("src/icons/icon-name.generated.ts", import.meta.url), "utf8").matchAll(
    /^\s*\| "([a-z0-9-]+)";?$/gm,
  ),
].map(
  ([, name]) => `${name.replace(/(?:^|-)([a-z0-9])/g, (_, letter) => letter.toUpperCase())}Icon`,
);
// Both ways: every listed icon is checked against the build in scenario(),
// and every icon the build exports must be listed.
const UNLISTED = EXPORTS.filter((name) => /^[A-Z]\w*Icon$/.test(name) && !ICONS.includes(name));
if (ICONS.length === 0 || UNLISTED.length > 0) {
  throw new Error(
    `The icon scenario doesn't match the build: src/icons/icon-name.generated.ts lists ${ICONS.length} icons, and dist/react.js also exports ${UNLISTED.join(", ") || "nothing else"}.`,
  );
}

/**
 * An editor: the components and icons that at least three of the five SDKs
 * import (docs/adr/0012). Fixed, not any one SDK's list; review changes it
 * when the family's editors change shape.
 */
const EDITOR = [
  "AnnouncerProvider",
  "UiMessagesProvider",
  "Button",
  "IconButton",
  "Toolbar",
  "ToolbarGroup",
  "Dialog",
  "Field",
  "NumberField",
  "TextField",
  "Slider",
  "SegmentedControl",
  "FileDropZone",
  "ProgressBar",
  "UndoIcon",
  "RedoIcon",
  "ZoomInIcon",
  "ZoomOutIcon",
  "FitIcon",
  "CloseIcon",
  "OpenIcon",
  "DownloadIcon",
  "DeleteIcon",
  "RotateLeftIcon",
  "RotateRightIcon",
  "ChevronLeftIcon",
];

/**
 * One import from the React entry, as an application's production build
 * bundles it. `importBudget` leaves out React and the family's packages,
 * which are the host's own. It leaves esbuild's format and
 * `process.env.NODE_ENV` at size-limit's defaults, so this sets them as
 * sdk-core ADR 0056 describes the measure: an ES module, with development
 * checks dropped as they are for hosts.
 */
function scenario(name, names, limit) {
  // A name the parse missed would shrink the scenario and still pass, so fail
  // instead: the export list's format changed, or a component was renamed.
  const missing = names.filter((exported) => !EXPORTS.includes(exported));
  if (missing.length > 0) {
    throw new Error(`Size scenario "${name}": dist/react.js doesn't export ${missing.join(", ")}.`);
  }
  return {
    ...importBudget({
      name: `Import: ${name}`,
      entry: "dist/react.js",
      imports: `{ ${names.join(", ")} }`,
      limit,
    }),
    modifyEsbuildConfig: (config) => ({
      ...config,
      format: "esm",
      define: { "process.env.NODE_ENV": '"production"' },
    }),
  };
}

export default [
  entryBudget({
    name: "Server-safe entry (.), with the shared code it loads",
    entry: "dist/index.js",
    // 12 kB. It measures 11.6 kB with the button's component tokens. Each
    // module compressed on its own, in kB:
    //   theme/css-value.ts      2.6  the injection allowlist and type grammars
    //   tokens/definitions.ts   2.5  token metadata behind the `tokens` export;
    //                                it grows with every component's tokens
    //   theme/color.ts          1.6  colour parsing and WCAG contrast
    //   theme/css-writer.ts     1.5  the selector allowlist and CSS writer
    //   theme/create-theme.ts   1.5  validation, extends, built-in themes
    //   tokens/themes.ts        0.9  built-in semantic values
    //   tokens/base.ts          0.7  built-in base values
    //   the rest                1.2  contrast pairs and check, messages,
    //                                errors, registry, themeToCss
    // An application using only the built-in themes ships none of this: see
    // the ThemeProvider tree-shaking test in build.test.ts.
    limit: "12 kB",
  }),
  entryBudget({
    name: "React entry (./react), with the shared code it loads",
    entry: "dist/react.js",
    // 25 kB; 24.71 kB with Heading and HeadingLevelProvider (sdk-core ADR
    // 0058), which only the Dialog and editor scenarios import, through
    // Dialog's context for its content's headings. Every component counts here, though no
    // application ships them all, so a component's pull request raises it as
    // expected growth; review reads the import scenarios below to judge it.
    limit: "25 kB",
  }),
  entryBudget({
    name: "Stylesheet (./styles.css)",
    entry: "dist/styles.css",
    // 9.5 kB. It measures 9.05 kB with lanes that let presses through;
    // the lanes before them took it from 8.5 kB to 9 kB. Raised as the React
    // entry's is: to the measurement, rounded up to the next 0.5 kB. Every
    // application loads the whole stylesheet, so this one is the cost of
    // every component.
    limit: "9.5 kB",
  }),
  // A floor: 0.8 kB; 0.73 kB. A leak into every component shows here first.
  scenario("the floor, Button", ["Button"], "0.8 kB"),
  // A floor: 1.1 kB; 1.05 kB. The floor for a toolbar's buttons.
  scenario("the floor, IconButton with one icon", ["IconButton", "UndoIcon"], "1.1 kB"),
  // 2 kB; 1.86 kB.
  scenario("Dialog", ["Dialog"], "2 kB"),
  // 3 kB; 2.51 kB.
  scenario("ReorderableList", ["ReorderableList", "ReorderableListItem"], "3 kB"),
  // 9 kB; 8.52 kB. The largest component, which only audio-sdk uses so far.
  scenario(
    "the Timeline with lanes",
    ["Timeline", "TimelineClips", "TimelinePlayhead", "TimelineLane"],
    "9 kB",
  ),
  // 3.5 kB; 3.00 kB for 62 icons, about 0.05 kB each.
  scenario("every icon", ICONS, "3.5 kB"),
  // 7.5 kB; 7.17 kB.
  scenario("an editor", EDITOR, "7.5 kB"),
];
