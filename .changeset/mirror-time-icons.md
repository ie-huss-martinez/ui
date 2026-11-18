---
"@hussmartinez/ui": patch
---

Icons that point along time now mirror in right-to-left text, as the `Timeline` does: `ChevronLeftIcon` and `ChevronRightIcon`, `TrimStartIcon` and `TrimEndIcon`, `FadeInIcon` and `FadeOutIcon`, and `SkipBackIcon` and `SkipForwardIcon`. Before, they pointed against the track's direction there; "to the start" now points right, where a right-to-left timeline starts. `PlayIcon` still doesn't mirror, so a transport reads as it does in left-to-right text. Nothing changes in left-to-right text or in the API. If you mirrored any of these yourself in right-to-left text, remove that, or they'll flip back.
