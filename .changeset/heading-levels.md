---
"@hussmartinez/ui": minor
---

Add heading levels for editors that sit in someone else's page (sdk-core ADR 0058).

- **`HeadingLevel`**, from both entries: `2 | 3 | 4 | 5 | 6`. An SDK's `headingLevel` prop takes it.
- **`toHeadingLevel(value)`**, from the root entry: turns a host's value, a number or an attribute's text such as `"3"`, into a level. Anything else is `2`, with a development warning that production builds drop. Use it for an element's `heading-level` attribute instead of writing your own parser.
- **`nestedHeadingLevel(level, depth = 1)`**, from the root entry: the level one or more steps down, never past 6.
- **`Heading`**, from `./react`: a native `<h2>` to `<h6>` at its `level`, or at the closest `HeadingLevelProvider`'s, or `2`. Other props, `id` included, reach the element, so a section can be labelled by it. It's styled as a title through the new `--hm-heading-font-size` token, and takes `className`, `classNames.root` and `unstyled`.
- **`HeadingLevelProvider`** and **`useHeadingLevel()`**, from `./react`: pass an editor's `headingLevel` to its own parts.

`Dialog`'s title stays an `<h2>`, and a `Heading` in its content or footer is now an `<h3>`, because a modal dialog is its own outline. Nothing a dialog renders today changes.

For the SDKs: audio-sdk will make `AudioHeadingLevel` a deprecated alias of `HeadingLevel` and render its inspector's title with `Heading`, and learn-sdk will give `LearnPlayer` a `headingLevel` prop in place of its fixed `<h2>`, defaulting to 2 as today. pdf-sdk, video-sdk and image-sdk change nothing until they render a heading.
