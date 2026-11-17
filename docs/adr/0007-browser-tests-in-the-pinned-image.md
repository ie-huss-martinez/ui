# 0007. Every browser test runs in the pinned image, through `sdk-config`

- **Status:** Accepted
- **Date:** 2026-11-15
- **Refines:** [0002](0002-visual-regression-in-a-pinned-container.md), whose own container runner is replaced by `sdk-config`'s, and [0004](0004-one-browser-test-image.md), whose unit tests of the image are replaced by `sdk-config`'s check

## Context

[ADR 0002](0002-visual-regression-in-a-pinned-container.md) ran only the visual tests in the pinned Playwright image, with this repository's own runner, `scripts/test-visual.mjs`. The other browser tests ran on the host locally: Vitest's browser mode for the package and the catalogue's stories, and the end-to-end suite. Two things broke that:

- **The host's libraries drifted.** An Ubuntu upgrade replaced ICU 74 with ICU 78, and Playwright's WebKit no longer launches on the host.
- **The host's network changes.** Chromium aborts in-flight requests with `ERR_NETWORK_CHANGED` whenever Docker adds or removes a network interface, which happens constantly on a machine shared with other repositories, so local runs failed at random.

The family decided that local browser tests run in the pinned image, as CI's do ([ADR 0049](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0049-local-browser-tests-in-the-pinned-image.md), in `sdk-core`), and that Playwright's packages are pinned exactly to the image's version ([ADR 0025](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0025-one-browser-test-image-in-one-place.md), as amended). `sdk-config` provides the tools: `hm-in-image`, `hm-test-visual` and `hm-check-playwright-image`. This record says how `ui` adopts them.

## Decision

- **Every browser step runs through `hm-in-image`:** `test:browser` and `test:browser:all` in the package and the catalogue, `test:visual` and `test:visual:update` in the catalogue, and `test:e2e`. Outside the image, it builds an image from `ci/Dockerfile`'s `FROM` line and runs the command in a container with its own `node_modules` volumes. In CI's verify jobs, which already run in the image and set `HM_VISUAL_CONTAINER=1`, it runs the command directly.
- **The visual tests stay on Vitest.** `hm-test-visual` runs Playwright Test specs against an SDK's built example page ([ADR 0048](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0048-visual-regression-for-sdk-editors.md), in `sdk-core`). `ui`'s visual tests render every catalogue story from Storybook's own index, in Vitest's browser mode, and check each render with axe, as ADR 0002 decided. So `test:visual` is `hm-in-image vitest run --project visual`, with the same tests and baselines as before. The visual project still refuses to run outside the image.
- **This repository's runner is removed:** `scripts/test-visual.mjs`, its workspace helper and their tests. `hm-in-image` does the same work, including a `node_modules` volume for every workspace package and handing written files back, and `sdk-config` tests it.
- **`ci/Dockerfile` is only the `FROM` line.** `hm-in-image` adds the repository's pnpm itself, from tarballs checked against the integrity in `pnpm-lock.yaml`, and sets the variable that marks the image.
- **Playwright is pinned exactly** to the image tag's version in the pnpm catalog, and `hm-check-playwright-image` checks it in `verify` and `verify:fast`. It replaces `test/ci-image.test.js`. That test's last case, that no workflow has an image of its own, is `sdk-ci`'s `check-workflows`.
- **Dependabot proposes Playwright's packages as one group,** apart from the rest, to be merged with the image update.

## Alternatives considered

- **Moving the visual tests to `hm-test-visual`:** one runner for the family, but it would rewrite the visual tests as Playwright Test specs against a built Storybook, re-take every baseline, and lose the per-render axe check or reimplement it. The runner isn't what makes screenshots match; the image is, and that's shared.
- **Keeping `scripts/test-visual.mjs` for the visual tests:** two container runners in one repository, with two images and two sets of volumes, and a copy of code that `sdk-config` already tests.
- **Fixing the host,** by installing the libraries WebKit needs: it wouldn't stop the network aborts, and every contributor's machine would need the same fix.

## Consequences

- Docker is a prerequisite of local `pnpm verify` for every browser step, not only for `test:visual`. Without it, the first browser step fails with a one-line message saying how to fix it.
- Local Firefox and WebKit runs (`test:browser:all`) use the same browsers as CI, and nobody installs Playwright's browsers on the host.
- Each browser step starts a container, a few seconds each once the image and volumes are warm. The first run builds the image and installs the dependencies into the volumes.
- The image and volumes are named `hm-browser-ui-workspace`. The old `hm-ui-visual` image and `hm-ui-visual-*` volumes are no longer used and can be removed.
- Updating Playwright means updating the catalog's two exact versions and `ci/Dockerfile`'s tag and digest in one pull request.
