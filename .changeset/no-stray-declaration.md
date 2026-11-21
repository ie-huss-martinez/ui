---
"@hussmartinez/ui": patch
---

The package no longer ships `dist/ui.d.ts`, a copy of the `./react` entry's types that no entry point exported. Nothing imports it through `exports`, so nothing changes for you; a deep import of `@hussmartinez/ui/dist/ui.d.ts`, which `exports` never allowed, no longer resolves.
