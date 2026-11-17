# 0010. An opt-in class for text outside components

- **Status:** Accepted
- **Date:** 2026-11-17

## Context

`ui`'s components each set their own font and colour from the tokens. Text an SDK renders itself doesn't: an editor's own labels, a transport's time, a status line. It inherits whatever the host page sets, and where the host sets nothing, the browser's default serif. pdf-sdk's screenshot tests showed exactly that.

Each SDK solved it alone, differently, or not at all:

- image-sdk sets `font-family` and `color` on `.hm-image-editor--styled`;
- video-sdk sets `font-family`, `font-size` and `line-height` on `.hm-video-editor`;
- audio-sdk and pdf-sdk set nothing.

`base.css` already sets `color` and `color-scheme` on themed roots, and nothing else. It can't set the font there: `data-hm-theme` is often on a host's `<html>`, and `ui` must never restyle a page that didn't ask ([sdk-core ADR 0005](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0005-plain-css-with-cascade-layers.md)).

## Decision

- **`ui` ships one opt-in class, `hm-text`,** in `hm.base`. It sets `font-family`, `font-size`, `font-weight`, `letter-spacing`, `line-height` and `color` from the semantic tokens, and everything inside inherits them.
- **An SDK puts it on its editor's root element,** next to its own class, and removes its own font rules. A standalone application can put it on its own root.
- **It's opt-in.** Nothing gets it unless its markup asks, so a host's page is never restyled.
- **It's in the lowest layer,** so an SDK's rules in `hm.sdk`, such as a smaller size for a dense panel, and any host CSS still win without `!important`.
- **It's only a class.** There's no component and no prop: an SDK's root element already exists, and a wrapper element would get in the way of its layout.

## Alternatives considered

- **Setting the font on `[data-hm-theme]`,** as the colour is: it would restyle host pages that theme their whole document.
- **`ThemeProvider` setting it:** its wrapper is `display: contents` around whatever the host puts inside, often the whole application, so it's the same problem.
- **Leaving it to each SDK:** four variants already exist, two of them missing, and each new token for type would need four changes.
- **A `Text` component:** more API for one class name, and it would add an element.

## Consequences

- An SDK's own text matches `ui`'s components with one class, and follows themes and density with them.
- **Follow-up, outside this repository:** each SDK adds `hm-text` to its editor's root and drops its own rules, and `STANDARDS.md` in sdk-core says so. The pull request that adds the class proposes the line.
- The stylesheet grows by one rule.
