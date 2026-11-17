---
"@hussmartinez/ui": minor
---

Add `TimelineClips`, the clip track of `Timeline`: a horizontal listbox with one Tab stop, where each clip is as wide as its length at the timeline's zoom.

- Clips are data: `{ key, length, label, content, attributes }`. Give each a `label` with its place and range, such as "Clip 2 of 5, 0:04.00 to 0:09.20".
- ← and → move between clips and select, and Home and End go to the first and last, following the reading direction. With `selectionMode="multiple"`, Shift extends the selection, Ctrl or ⌘ moves without changing it, Space adds or removes the focused clip, and Ctrl or ⌘+A selects all; clicks take the same modifiers.
- The selection is yours, through `selectedKeys` and `onSelectedKeysChange`. A ref gives `focusClip(key)`.
- The clips' boundaries are snap targets for the playhead and for `useTimelineScale().snap`.
- When the focused clip is removed, focus goes to the clip that took its place, or the one before, or the playhead.

`Timeline` and `TimelinePlayhead` now measure and size themselves before the first paint, so there's no unsized frame.

It adds seven component tokens, `--hm-timeline-clip-*`. Moving and trimming clips come in a later release.
