# 0012. Size budgets for what applications import, beside each entry's

- **Status:** Accepted, 2026-11-18, with its four open decisions ruled as recommended
- **Date:** 2026-11-18

## Context

[sdk-core ADR 0015](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0015-verification-and-releases.md) makes `size-limit`, per entry point, part of every repository's verification. `ui` has three budgets in `packages/ui/.size-limit.js`. Each measures the brotli size of an entry with every shared chunk it loads, unminified:

| Entry | Budget | Measures |
|---|---|---|
| Server-safe (`.`) | 12 kB | 11.43 kB |
| React (`./react`) | 24 kB | 23.96 kB |
| Stylesheet (`./styles.css`) | 9.5 kB | 9.05 kB |

The React entry's budget went from 18 kB to 24 kB in two days. Seven pull requests raised it: the timeline's six steps (#80 to #89) and the Slider's `onValueCommit` (#91). The rule from review is that a pull request raises the budget it needs, to its measurement rounded up to the next 0.5 kB, with a table. After the icons for a range, 0.04 kB is left.

That budget measures the wrong thing for the React entry. **No application ships the whole entry.** The entry is a set of independent components with no side effects, and a host's bundler keeps only what it imports. `build.test.ts` already checks *which* code an import ships, with Rolldown and esbuild, but not how much. So the budget behaves like this:

- **It grows with every addition, whoever uses it.** The timeline's 8.6 kB counts against an application that only shows a dialog.
- **It can't tell a regression from growth.** A change that made every component pull in the timeline's code would cost the whole entry nothing, because that code is already in it. The budget wouldn't move, and every application would grow by kilobytes.
- **Its raises are routine,** so review can't learn much from them.

### What applications ship today

Each scenario is an application's import from the built React entry, bundled and minified as a host's bundler would, with React and `sdk-core` external, then compressed with brotli at quality 11. It's the method `build.test.ts` uses, measured at `main` 6dae5f4 (0.14.0). The SDK scenarios are each SDK's runtime imports from `@hussmartinez/ui/react` on its `main` that day.

| Scenario | esbuild | Rolldown |
|---|---|---|
| `Button` | 0.76 kB | 0.60 kB |
| `IconButton` with one icon | 1.09 kB | 0.94 kB |
| `Slider` | 1.52 kB | 1.38 kB |
| `Dialog` | 1.90 kB | 1.77 kB |
| `ReorderableList` | 2.55 kB | 2.46 kB |
| The timeline with lanes: `Timeline`, `TimelineClips`, `TimelinePlayhead`, `TimelineLane` | 8.56 kB | 8.78 kB |
| Every icon (62) | 3.31 kB | 3.24 kB |
| learn-sdk's imports (12) | 2.51 kB | 2.46 kB |
| pdf-sdk's imports (18) | 2.88 kB | 2.85 kB |
| image-sdk's imports (32) | 7.60 kB | 7.80 kB |
| video-sdk's imports (38) | 7.99 kB | 8.21 kB |
| audio-sdk's imports (47, with the timeline) | 9.31 kB | 9.62 kB |
| The editor scenario proposed below (26 exports) | 7.33 kB | 7.48 kB |
| Everything (97 exports) | 19.35 kB | 20.02 kB |

What this shows:

- **The largest editor, audio-sdk's, ships 9.3 kB: 39% of the 23.96 kB the entry budget counts.** The others ship between 2.5 kB and 8 kB.
- **The timeline is the largest single cost, at 8.6 kB,** and only audio-sdk uses it so far. Under the entry budget, every application pays for it in review.
- **An icon costs about 0.05 kB,** and only to the application that imports it. All 62 together cost 3.3 kB.
- **esbuild and Rolldown agree within 0.31 kB in every scenario.** Neither is consistently larger: esbuild is larger for small imports, and Rolldown for large ones. One bundler is enough for a budget.
- **Bundled and minified, the whole entry is 19.4 kB,** against the 23.96 kB the budget measures unminified.

## Decision

**Add budgets for what applications import, and judge size changes by them.** The entry budgets stay, as ADR 0015 requires, as the upper bound.

1. **Scenarios, in `.size-limit.js`, measured with `@size-limit/esbuild`** through its `import` option, minified, with `react`, `react-dom` and `@hussmartinez/sdk-core` ignored. The first set:
   - **The floor:** `Button`, and `IconButton` with one icon. These catch a leak into everything, such as a module that stops being free of side effects, or shared code a simple component starts to need. These are the regressions the entry budget can't see.
   - **Each heavy component on its own:** the timeline with lanes, `ReorderableList` and `Dialog`. A new component over about 2 kB adds a scenario of its own in the pull request that adds it.
   - **Every icon,** to keep a glyph's cost in view, since glyphs are added the most often.
   - **An editor:** a fixed set of the components and icons that at least three of the five SDKs import. That's `AnnouncerProvider`, `UiMessagesProvider`, `Button`, `IconButton`, `Toolbar`, `ToolbarGroup`, `Dialog`, `Field`, `NumberField`, `TextField`, `Slider`, `SegmentedControl`, `FileDropZone`, `ProgressBar`, and twelve icons: undo, redo, zoom in, zoom out, fit, close, open, download, delete, rotate left, rotate right and chevron left. It measures 7.33 kB. **It isn't any one SDK's import list.** That list changes in another repository, without a pull request here, and a budget here can't follow it.
2. **The same rule raises every budget:** in the pull request that needs it, to the measurement rounded up to the next 0.5 kB. The description has a table of the changed scenarios, before and after, and the reason. **A scenario budget is never raised for code that the scenario doesn't import.** If a component's change moves the floor, that's the regression to fix.
3. **The entry budgets keep their rule, but review reads the scenarios.** When a component's pull request raises the React entry's budget and no scenario that leaves the component out moves, the raise is the expected growth, and the table says so. That replaces the two-number table for the React entry. The stylesheet keeps its two-number table, because every application loads the whole stylesheet and its budget is a real cost.
4. **`build.test.ts` keeps checking which code ships, with both bundlers.** The size budgets don't replace it: a scenario can stay within budget while shipping the wrong code.

The server-safe entry and the stylesheet get no scenarios. Each is loaded whole: the stylesheet by every application, and the server-safe entry's heavy parts only through `createTheme`, which `build.test.ts` already checks applications drop when they use the built-in themes.

### Open decisions

Each had a recommendation, which the Decision above follows. Review ruled all four as recommended on 2026-11-18.

1. **Does the scenario table replace the React entry's two-number table in review?** Recommended: yes. The minified whole-entry number has the same blind spot as the unminified one. The stylesheet keeps its two-number table.
2. **`size-limit` with esbuild, or size assertions in `build.test.ts`?** Recommended: `size-limit`. It's the family's tool and report, and the cost is one package from the same maintainer.
3. **What goes in the editor scenario?** Recommended: the fixed set above, of what at least three of the five SDKs import. Review changes it when the family's editors change shape, not each time one SDK adds an import.
4. **When does a component get a scenario of its own?** Recommended: over about 2 kB on its own, the size of `Dialog`. Below that, the floor and the editor scenario cover it.

## Alternatives considered

- **Keep raising the entry budget alone.** That's simple, but it measures nothing an application ships, and it can't see a leak into every component. It grows by about 1 kB for every timeline-sized feature.
- **A larger step for the entry budget,** such as 2 kB at a time. It would mean fewer raises, but the same blind spot.
- **Measure each SDK's own imports here.** They're the most honest numbers, but they'd go stale: an SDK's imports change in its own repository. Each SDK's budgets belong to that SDK, under ADR 0015, where they already measure what it ships.
- **Size assertions in `build.test.ts`,** which already bundles with Rolldown and esbuild. That avoids a dependency, but it hides the budgets in a test file. `size-limit` is the family's tool, and its report is already part of `pnpm verify`, so the budgets stay in one place.
- **Measure with Rolldown as well.** The two bundlers agree within 0.31 kB, so a second measurement would double the time for no decision it could change.

## Consequences

- **A new dev dependency, `@size-limit/esbuild`,** at size-limit's version. It's from the same maintainer as `size-limit`, and its only dependency is esbuild, which `ui` already installs at the same range. esbuild's install script stays blocked, as it is now.
- **`pnpm check:size` takes a few seconds longer:** about a dozen esbuild bundles of a built package.
- **The React entry's budget is still raised by the next component,** since 0.04 kB is left, and by most components after it. Those raises stop being the evidence: the scenarios are.
- **A size regression in a simple component is visible for the first time,** and each budget stays small enough to catch one. The `Button` scenario, for example, would be 1 kB.
- **If it works, it's worth proposing to the family.** The other SDKs have the same shape: an element entry and a React entry, each with independent parts. A change to ADR 0015 belongs in `sdk-core`.

### Implementation

Built in the pull request that accepted this record:

- **`@size-limit/esbuild` 14.3.0,** in the catalog beside `@size-limit/file`. Its peer dependency pins `size-limit` exactly, so the two move together. Its only dependency is esbuild 0.28.2, the copy the workspace already has, and esbuild's install script stays blocked.
- **The entry budgets opt out of bundling** with `disablePlugins: ["@size-limit/esbuild"]`, so they measure the files in dist exactly as before.
- **Each scenario** imports from `dist/react.js`, and is bundled as an ES module with `process.env.NODE_ENV` set to `"production"`, as a host's production build does. `react`, `react-dom` and `@hussmartinez/sdk-core` are left out. The icon list is read from the built entry's exports, so a new icon joins the scenario without an edit.

The scenarios as `size-limit` measures them:

| Scenario | Measures | Budget |
|---|---|---|
| `Button` | 0.73 kB | 1 kB |
| `IconButton` with one icon | 1.05 kB | 1.5 kB |
| `Dialog` | 1.86 kB | 2 kB |
| `ReorderableList` | 2.51 kB | 3 kB |
| The timeline with lanes | 8.52 kB | 9 kB |
| Every icon (62) | 3.00 kB | 3.5 kB |
| An editor (26) | 7.17 kB | 7.5 kB |

They're 0.03 kB to 0.31 kB under the script's esbuild figures above. `size-limit` subtracts the cost of an empty esbuild bundle, and its entry passes the imports to `console.log` rather than exporting them, which saves their names; the more names, the larger the gap. The React entry measures 23.99 kB of its 24 kB budget after #90's dependency updates.
