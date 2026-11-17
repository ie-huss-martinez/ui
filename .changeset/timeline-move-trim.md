---
"@hussmartinez/ui": minor
---

`TimelineClips` can now move and trim clips. It reports each edit, and you render the result.

- `onMove(keys, direction)`: Alt+← and Alt+→ (Option on macOS) move the selected clips, or the focused one when it isn't selected, earlier or later. Focus stays with the clip.
- `onTrim(key, edge, delta)`: Alt+`[` and Alt+`]` shorten a clip at its start or end by `trimStep`, and with Shift lengthen it. Dragging a clip's edge does the same: it snaps to the playhead and the clips' boundaries unless Alt is held, stops at `trimLimits`, shows the new length as it goes, and reports once on release. Escape cancels it.
- `onTrimToPlayhead(key, edge)`: `[` and `]` set a clip's start or end to the playhead.

**Alt+← and Alt+→ are now always taken while focus is on a clip,** with or without `onMove`, so the browser never goes back or forward instead.

Also render buttons that move and trim the selected clips, with `aria-keyshortcuts`, and offer zoom: the keys and the drag are additions, not the only way.

It adds the component token `--hm-timeline-clip-edge-size`.
