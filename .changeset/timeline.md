---
"@hussmartinez/ui": minor
---

Add the first part of a shared timeline for editors of audio and video: `Timeline`, `TimelineLayer`, `TimelinePlayhead` and `useTimelineScale`. The clip track comes in a later release.

- `Timeline` is a scrolling track over whole units, such as frames or samples, as wide as `length` at the current `zoom`. A zoom of 1 fits it to the width, and `onMaxZoomChange` says where zooming stops.
- `TimelinePlayhead` is a slider over the units, with a line at its `position`. A press on the track moves it, snapping to the timeline's `snapTargets` within 8 px unless Alt is held, and `following` keeps it in view.
- `TimelineLayer` holds your own drawing, such as a waveform. `useTimelineScale()` gives it `toPixels`, `unitAt`, `snap` and `visibleRange`, the same mapping the parts use.
- It formats no time and has no text of its own: pass `label`s and `formatValue`.

```tsx
<Timeline label={t("timeline.label")} length={frames} zoom={zoom} onMaxZoomChange={setMaxZoom}>
  <TimelineLayer>
    <Waveform />
  </TimelineLayer>
  <TimelinePlayhead label={t("timeline.playhead")} position={playhead} onPositionChange={seek} formatValue={formatTime} />
</Timeline>
```

It adds four component tokens, `--hm-timeline-*`.
