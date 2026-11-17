# The browser test image (docs/adr/0004; ADR 0025 in sdk-core): Playwright's,
# with the browsers and their system libraries preinstalled. CI's verify
# jobs, in verify.yml and release.yml, run in it; both read it from the FROM
# line below, through sdk-ci's image action, so this is its only copy.
# Locally, sdk-config's hm-in-image builds its image from the FROM line, for
# the browser, visual and end-to-end tests (docs/adr/0007). Dependabot
# proposes digest and tag updates. playwright and @playwright/test are pinned
# exactly to the tag's version and move with it in the same pull request;
# hm-check-playwright-image checks that.
FROM mcr.microsoft.com/playwright:v1.65.1-noble@sha256:1507cbfc550a63a6b7396791ca4f00df17beb56342d2447b3f106c306f525579
