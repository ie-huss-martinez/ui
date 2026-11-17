---
"@hussmartinez/ui": minor
---

Add the `hm-text` class, for text outside components. Put it on your editor's or application's root element, and the text inside takes ui's font family, size, weight, letter spacing, line height and text colour from the tokens, instead of the page's. It's opt-in and in the lowest-priority layer, so your own CSS, and an SDK's rules in `hm.sdk`, still win.

```html
<div class="hm-text my-editor">…</div>
```
