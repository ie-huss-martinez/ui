---
"@hussmartinez/ui": patch
---

`Timeline` keeps its callbacks and settings in refs updated during the commit, with `useLatest`, instead of writing them while it renders, which React's purity rules forbid (sdk-core ADR 0063). Nothing changes in what it renders or reports: `onMaxZoomChange`, `onVisibleRangeChange`, snapping and keyboard movement between lanes behave as before. A render that React throws away, as concurrent rendering can, no longer leaves a callback or setting from that render behind.
