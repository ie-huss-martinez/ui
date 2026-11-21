# 0002. Visual regression in a pinned container

- **Status:** Accepted; the image's location is superseded by [0004](0004-one-browser-test-image.md), and the container runner is replaced by [0007](0007-browser-tests-in-the-pinned-image.md)
- **Date:** 2026-11-10
- **Amended:** 2026-11-17. "Pixel for pixel" wasn't true: the comparison allowed no differing pixel, but left pixelmatch's colour threshold and its anti-aliasing detection at their defaults, so a faint change passed. The timeline's background moved by ten pixels and no test failed. Both are now off, in `apps/catalogue/visual/comparator.ts`, with a test that fails if either is loosened. No baseline changed: all 523 already matched exactly
- **Amended:** 2026-11-21. ui stays stricter than the family's tolerance in [sdk-core ADR 0054](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0054-visual-comparison-tolerance.md). See [Stricter than the family's tolerance](#stricter-than-the-familys-tolerance)

## Context

[ADR 0022](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0022-storybook-for-the-component-catalogue.md) chooses Storybook for the catalogue, and requires visual regression in all three themes and both densities ([ADR 0006](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0006-design-tokens-and-theming.md)). Screenshots depend on more than the code: fonts, font rendering, graphics libraries and browser builds differ between machines and operating systems. Baselines taken on one machine fail on another, so either every check needs the same environment, or the check can't be part of `pnpm verify` and reviewers can't run it.

## Decision

- **One environment.** Visual tests run only inside the official Playwright image, pinned by tag and digest in `apps/catalogue/visual/Dockerfile`, locally and in CI. `pnpm test:visual` builds the image, runs the tests in it, and is a step of `pnpm verify`. `pnpm test:visual:update` writes new baselines the same way.
- **Docker is a prerequisite** for `pnpm verify`. Without it, `test:visual` fails with a one-line message saying how to fix it; it never skips. The visual Vitest project refuses to run outside the image, so baselines can't be created anywhere else.
- **Chromium only.** Visual tests catch values that don't follow the tokens, which is independent of the engine. Story tests and axe still run on Chromium, Firefox and WebKit. Three engines would triple the baselines for little extra signal.
- **Every story in light, dark and Poster, in both densities,** compared pixel for pixel. Each render is also checked with axe, so contrast holds in every theme, not just the default one. A guard test fails if the a11y add-on stops failing stories with violations.
- **The image moves with Playwright.** A unit test fails when the image's Playwright version differs from the installed package, or when the image isn't pinned by digest. Dependabot proposes image updates, with the same seven-day cooldown as everything else.
- **Isolation.** The container gets its own `node_modules` and pnpm store volumes, so host binaries never mix with the container's, and the files it writes are handed back to the calling user.

### Stricter than the family's tolerance

[sdk-core ADR 0054](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0054-visual-comparison-tolerance.md) gives `sdk-config`'s Playwright preset `threshold: 0.0038`, so that a pixel differing by 1/255 on every channel isn't counted. It rejected `threshold: 0` for the family because some baselines re-captured on an unchanged page differ from themselves. ui doesn't use that preset, and keeps its own comparator: `threshold: 0`, `allowedMismatchedPixelRatio: 0` and `includeAA: true`.

- **ui's comparison can be stricter, and is.** ui's visual tests use Vitest's `toMatchScreenshot`, whose pixelmatch options are all configurable. Playwright's comparison, which the preset wraps, always leaves out the pixels pixelmatch takes for anti-aliasing. ADR 0054 accepts that as a limit no threshold fixes. ui compares those pixels too, so a change confined to the edges of text or a rounded corner fails here. Taking 0.0038 would loosen the colour check and gain nothing on edges.
- **The noise ADR 0054 measured hasn't reached ui's checks.** Its history lists four pairs of ui baselines that differ on a single pixel each. They're commits that re-captured baselines, not failed runs. Since the strict comparator landed on 2026-11-17, ui's CI has run `verify` 154 times to completion: 152 passed, one was cancelled, and the one failure was a WebKit timing test (fixed in #108), not a screenshot. No visual test has failed on an unchanged page.
- **What would change this:** a visual test that fails on a page that didn't change, with the diff measured as rendering noise rather than a change. Then ui adopts `threshold: 0.0038`, in a new record that supersedes this section and says what was measured. It doesn't change by loosening one state, or by retrying.
- **What stays the same:** `comparator.test.ts` still fails if any of the three options is loosened, and baselines are still written only in the pinned image.

## Alternatives considered

- **Visual tests in CI only, with Docker for updating baselines:** reviewers' local `pnpm verify` would skip them, so a review could pass while CI fails.
- **Baselines per operating system:** many more images to review, and a change still can't be checked on an operating system nobody on the change uses.
- **A hosted visual testing service:** sends screenshots to a third party, costs money, and needs secrets in pull request workflows.
- **Bundling fonts to stabilise rendering:** fixes font choice but not rasterisation, which differs between operating systems and graphics stacks.

## Consequences

- Visual changes are reviewed as image diffs in pull requests, and every machine agrees on them.
- Contributors need Docker. The first run downloads the image, about 2 GB.
- The image uses its own Node version (26 in Playwright 1.65), which satisfies `engines`; only the browser renders the screenshots.
- Updating Playwright means updating the image's tag and digest in the same pull request.
