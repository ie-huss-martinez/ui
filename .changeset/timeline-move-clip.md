---
"@hussmartinez/ui": minor
---

Clips on a `Timeline` can now be moved by dragging, and between lanes with the keyboard.

- `onDrop(keys, { by, lane })`: with it, a clip is dragged with a mouse or a pen, along time and to the lane under the pointer. Its start or end snaps to the other clips, on any lane, and the playhead, unless Alt is held. It's reported once, on release; Escape cancels. A selected clip takes the rest of the timeline's selection with it. The timeline scrolls while a clip is held near either end of the view. On a touch screen a drag scrolls, and clips move with your buttons.
- `canDrop(keys, { by, lane })` is asked as a clip is dragged. Where it says no, the clip shows it, and letting go reports nothing.
- `onMoveLane(keys, direction)`: Alt+↑ and Alt+↓ (Option on macOS) move clips to the lane above or below. In a lane they're always taken, with or without `onMoveLane`, so the page doesn't scroll. Focus follows a clip to its new lane.
- `moveHandle`: `"clip"`, the default, or `"title"`, where only a clip's title is the handle and a press on the rest reaches the layer under it.
- Between clips, a press now reaches what's under the track, such as a layer, rather than the clip track.

`TimelineClipDrop` is exported. It adds two component tokens: `--hm-timeline-clip-moving-shadow` and `--hm-timeline-clip-refused-border-color`.
