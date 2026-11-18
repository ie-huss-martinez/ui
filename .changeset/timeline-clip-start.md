---
"@hussmartinez/ui": minor
---

Clips on a `Timeline` can now have a start, so a track can have room between its clips.

- `TimelineClip` gains `at`, the unit the clip starts on. Give it to every clip of a `TimelineClips`, in time order and without overlap, and each is placed at its start; give it to none, and they lie back to back, as before. A track warns in development when clips overlap, are out of order, or only some have `at`.
- The two kinds of track share a timeline, one per lane: a video lane back to back over audio lanes with positions, for instance.
- Every lane's clip edges are snap targets for the whole timeline, so a clip's edge snaps to another lane's clips.
- While an edge is dragged on a track with positions, the clip's other edge and its neighbours stay where they are.
- `Timeline` gains `extent`, for clips that run past `length`: the track is drawn that far, the playhead still ends at `length`, and a clip that passes it carries `data-hm-past-end`. `useTimelineScale()` gains `extent`, and `unitAt` and `visibleRange` now reach as far as it.
