---
"@hussmartinez/ui": minor
---

Add three icons for editing time: `RangeStartIcon` and `RangeEndIcon`, for setting where a selected range starts and ends, and `RippleIcon`, for closing the gap a deletion leaves. Their `IconName`s are `range-start`, `range-end` and `ripple`. The range icons follow the reading direction, mirrored in right-to-left text.

Lucide has no glyph for a range's start and end, so ui draws those two itself, on Lucide's grid and stroke so they sit with the rest. `RippleIcon` is Lucide's `fold-horizontal`.
