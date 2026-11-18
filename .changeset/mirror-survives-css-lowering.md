---
"@hussmartinez/ui": patch
---

Mirrored icons, such as `UndoIcon`, `RangeStartIcon` and those added in 0.14.3, now flip in right-to-left text whatever builds your CSS. They used `:dir(rtl)`, which Vite's default build target and Next.js lower for older browsers to a list of `:lang()` values. So on a `dir="rtl"` page without a right-to-left `lang`, nothing mirrored. They now follow the nearest `dir` attribute on an ancestor, up to three nested levels, such as left-to-right text inside a right-to-left page and right-to-left text inside that. `dir="auto"` isn't followed: set `dir="rtl"` or `dir="ltr"` on an element around the icons. Nothing changes in the API.
