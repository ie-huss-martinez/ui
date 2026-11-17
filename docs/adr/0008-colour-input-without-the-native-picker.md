# 0008. A colour input without the browser's picker

- **Status:** Accepted
- **Date:** 2026-11-17

## Context

image-sdk's text and shape tools need a colour for fill, stroke and text, and a redaction colour later. The other SDKs will want the same control, so it belongs in `ui`.

The obvious control is `<input type="color">`. It doesn't fit the family's rules:

- **It differs in every engine.** Chromium, Firefox and WebKit each open their own picker, or the operating system's, with different keyboard support. [sdk-core ADR 0014](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0014-accessibility-and-translatable-text.md) wants one tested keyboard path.
- **It can't be themed or translated.** The picker's text is the browser's, in the browser's language, and its look ignores the tokens.
- **Tests can't reach it.** The picker is outside the page, so axe and the visual tests see only the closed swatch.

Showing a colour is a second problem. A strict Content Security Policy blocks `style` attributes in server-rendered markup ([sdk-core ADR 0012](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0012-hostile-input-and-no-network.md)), and a colour the user chose can't be a class.

## Decision

- **`ColorField` is a hex input, a preview and optional swatches, all in the page.** It never opens the browser's picker.
  - The input takes `#rrggbb` or `#rgb`, with or without the `#`. It commits on Enter or blur, goes back to the last value for text that isn't a colour, and Escape throws the typing away, as `NumberField` does.
  - The swatches are a radio group with one Tab stop, where arrow keys move and select, as `SegmentedControl` does. Each has a `label` from the host's messages as its accessible name.
- **The value is one format: lowercase `#rrggbb`.** Every input, from props, typing or swatches, goes through one parser, and anything else is rejected.
- **Colours are drawn as SVG `fill` attributes,** not styles. A presentation attribute is in the server-rendered markup and allowed by a strict policy. Only the parser's output reaches it.
- **Every colour has a border,** and the checked swatch has a ring in the text colour, so neither depends on the colour itself having contrast with the surface (WCAG 1.4.11).
- **The swatch group is named after the field,** such as "Fill swatches", so two colour fields on one page have distinct groups. `Field` gives its label an `id`, and shares it through a context of its own, apart from the props hosts spread onto a native control.
- **It's inline, not in a popover.** `ui` has no `Popover` yet ([ADR 0006](0006-overlays-in-the-top-layer.md)); a swatch button that opens this content can be added when it does, without changing `ColorField`.

## Alternatives considered

- **`<input type="color">` alone, or as an extra "more colours" button:** rejected for the reasons above. As an extra, it would still be an untested, untranslated path in three variants.
- **A full picker, with a saturation area and a hue slider:** it's much more code and two more two-dimensional keyboard interactions, for editors that mostly need a few preset colours and an exact value. It can be added to the same component later.
- **The colour as a custom property set through the CSSOM after hydration:** the server-rendered page would show no colours until scripts run, and a failed hydration would leave them blank.
- **Other formats, such as `rgb()`, `hsl()` or alpha:** each SDK would have to parse every format. An alpha channel is a real need for some tools; it would be a new prop and an eight-digit value, in its own record.

## Consequences

- SDKs get the same colour control, with the same keys, text and look on every engine, covered by axe and the visual tests.
- Users can't pick a colour by eye beyond the swatches; they type a hex value. Hosts choose swatches that suit their tool.
- There's no alpha and no eyedropper yet.
- `Field`'s label has an `id`, which other composite controls can use to name their parts.
