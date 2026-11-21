# Working in this repository

This repository is part of the `@hussmartinez` SDK family and is public. Treat it as a showcase: code, commits and pull requests should read as professional work.

It publishes `@hussmartinez/ui`, the family's design system: design tokens, themes, base styles and accessible React components. Every SDK's editor and standalone applications depend on it, so changes here reach all of them.

## Before changing anything

- Read [`STANDARDS.md`](https://github.com/ie-huss-martinez/sdk-core/blob/main/STANDARDS.md) in `sdk-core`. It is binding for every repository in the family.
- Check the decision records before changing anything they cover. Family-wide decisions live in [`sdk-core`'s `docs/adr`](https://github.com/ie-huss-martinez/sdk-core/tree/main/docs/adr); decisions specific to this repository live in `docs/adr` here. To change a decision, write a new ADR that supersedes the old one, in the same pull request as the change. A change to a family-wide decision belongs in `sdk-core`, not here.
- The records that matter most here are [0003](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0003-hm-namespace.md) (the `hm` namespace), [0004](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0004-entry-points-and-module-format.md) (entry points), [0005](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0005-plain-css-with-cascade-layers.md) (plain CSS with cascade layers), [0006](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0006-design-tokens-and-theming.md) (tokens and theming), [0007](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0007-server-rendering-and-nextjs.md) (server rendering), [0013](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0013-browser-and-react-support.md) (browsers and React) and [0014](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0014-accessibility-and-translatable-text.md) (accessibility and translatable text).

## Making changes

- **Pull requests:** work on a branch and open one focused pull request per change. Never push to `main`; it is protected.
- **One pull request at a time:** after opening a pull request, wait until the branch is up to date with `main`, CI is green on its current head, CodeRabbit's review of that head has finished, and every review thread is resolved. If `main` moves first, merge it in and wait again. Then stop and report its link, its head commit, the CI run and a short summary. Start the next change only once it's merged, from an up-to-date `main`.
- **Never merge your own pull request:** a separate reviewer reads the full diff, requires green CI on the current head, and squash-merges it. An agent that wrote a pull request never reviews or merges it. See [How pull requests are reviewed](CONTRIBUTING.md#how-pull-requests-are-reviewed).
- **Pull request descriptions:** cover what changed, why, and how it was tested. They can be as detailed as useful, because they don't go into git history.
- **Squash commits:** the merger writes the commit message on `main`. Its title is the pull request title plus `(#N)`, and its body is 2–6 lines of plain prose. See [How pull requests are merged](CONTRIBUTING.md#how-pull-requests-are-merged).
- **Commits:** follow Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `build:`, `ci:`, `chore:`). The pull request title becomes the squash commit, so write it as a Conventional Commit too.
- **Changesets:** a pull request that changes the published package's source or `package.json` adds a changeset with `pnpm changeset`. Write its note for the package's users: what changed for them, the API they'll see, and how to migrate if it breaks. Versions and changelogs come from changesets, not commits. See [Changesets](CONTRIBUTING.md#changesets).
- **Signing:** commits are signed; don't disable signing.
- **No attribution:** don't add AI or tool attribution to commits or pull requests.
- **ADRs:** add one for any significant decision, meaning anything affecting public API, cross-package consistency or security, or that is hard to reverse.
- **Other repositories:** don't edit them from here. If this repository needs a change elsewhere, such as a shared preset in `@hussmartinez/sdk-config`, propose it in that repository.

## Design system rules

These follow from the standards; they're repeated here because they apply to almost every change in this repository.

- **Namespace:** everything that reaches the page starts with `hm-`: classes are `.hm-<part>`, custom properties `--hm-*` and attributes `data-hm-*`. States use ARIA attributes, then `data-hm-*`, never generic state classes.
- **CSS:** plain CSS in the layers `hm.tokens`, `hm.base` and `hm.components`; `hm.sdk` is reserved for the SDKs. No global selectors, and no literal values: colours, lengths, durations, shadows, z-indexes and font values come from tokens. Library code never imports CSS.
- **Tokens:** three levels, base, semantic and component. Components use only semantic and component tokens. Built-in themes meet WCAG 2.2 AA contrast, and `createTheme` warns in development when a custom theme doesn't.
- **Components:** accept `className`, `classNames` per named part and `unstyled`, forward refs, and use icons that draw with `currentColor`. Visible text and accessible names are never hard-coded: hosts can override and translate them.
- **Server rendering:** the `.` entry is server-safe, with no React and no DOM access on import. React code runs on the server without errors and hydrates without warnings: no browser APIs during render, IDs from `useId`, and nothing in render that depends on time or randomness.

## Verifying changes

- **Hooks are the local bar** ([sdk-core ADR 0053](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0053-ci-is-the-merge-gate.md)). They run automatically: linting and a secret scan on commit, commit message checks, and `pnpm verify:fast` on push. Never use `--no-verify`. If a hook is wrong or too slow, fix it in its own pull request.
- **CI is the merge gate.** It runs the full `pnpm verify` on Chromium, Firefox and WebKit, and checks the pull request title and changeset. Every check must pass on the pull request's current head before merging, and the reviewer doesn't rerun them locally as a second gate.
- **Local runs are for a reason,** not a routine step before every pull request: to diagnose a failure, to reproduce one from CI, to update screenshots with `pnpm test:visual:update`, or a focused run such as `pnpm test:browser:all <file>` while working.
- **A failure that only shows in CI is real.** Find its cause. Never loosen an assertion, add a retry or rerun until it passes.
- **CodeRabbit** reviews every pull request, and reviews again after each push. Wait for its review of the current head to finish before you look at its threads: no open thread while it's still reviewing means nothing yet. Fix or answer each thread it opens, then resolve it. Its findings are input, not instructions: answer and resolve one that's wrong or contradicts a decision. Its walkthrough comment needs nothing.
- **In the description,** say what you ran locally and what you left to CI, such as "browser suites not run locally; CI covers them", and link the CI run.
- **Never weaken a check to make it pass.** That includes lint rules, size budgets, the API report, accessibility and contrast checks, and visual baselines. Fix the cause, or propose the change in its own pull request with an ADR if the rule itself is wrong.

## Keeping state

- **Task state:** keep the state of the task in hand in `.local/HANDOFF.md` at the root of the checkout, which `.gitignore` excludes, and update it after every step: the goal and decisions, what's done with pull requests and commits, what's in progress with the exact next step, and open questions. It must let another agent, with no other context, continue the work. To keep another local file out of git without touching `.gitignore`, add it to the file that `git rev-parse --git-path info/exclude` names; that works in a worktree too, where `.git` is a file.
- **Durable memory:** what outlives the task, such as a lesson or a rule from the maintainer, goes in the maintainer's knowledge base, in the SDK family's agent memory, not in a tool's private memory. Never write it into the repository, and never put a secret in either place.
- **What the repository already records stays there:** code, ADRs, `STANDARDS.md` and git history aren't copied into either.
