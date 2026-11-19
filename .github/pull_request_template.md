<!--
The title must be a Conventional Commit with a lowercase subject, such as
"fix: return focus when a dialog closes". It becomes the commit title
on main. See CONTRIBUTING.md for how pull requests are merged.
-->

## What

<!-- What changed, in a few bullet points. -->

## Why

<!-- The problem this solves, with links to issues or ADRs. -->

## How it was tested

<!-- Link the CI run, and say what you checked by hand or ran locally to diagnose. -->

## Checklist

- [ ] CI is green, and its run is linked above.
- [ ] Tests cover the change, next to the code.
- [ ] Exported APIs are typed and have TSDoc, and the API report is updated where the package has one.
- [ ] New dependencies are justified above.
- [ ] READMEs and docs are accurate.
- [ ] Components work with the keyboard, pass axe and have visible focus, where the change has UI.
- [ ] A changeset is added, if the change alters what the package publishes.
- [ ] Significant decisions are recorded as an ADR in `docs/adr`.
