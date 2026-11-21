---
"@hussmartinez/ui": patch
---

`Dialog` and `Toolbar` share one helper to merge their own ref with the one you forward, and `useTimelineLanes` reads the track only when `laneAt` is called. Nothing changes in what they render or how refs reach you: a ref you pass to `Dialog` or `Toolbar` still receives the element, whether it's an object or a callback. With these, every rule of React's lint passes on ui's source (sdk-core ADR 0063).
