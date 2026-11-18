---
"@hussmartinez/ui": minor
---

`Timeline` can now hold several lanes, for an editor with several tracks. A timeline without lanes works as before.

- `TimelineLane` is a track: a named group with its own layers and its own `TimelineClips`, under one playhead. Lanes stack in the order you render them.
- `header` is the lane's controls, such as its name, Mute and Solo and a gain slider. The lane renders them as a toolbar, one Tab stop, in a column that stays in view while the timeline scrolls. Below 720 px of the timeline's width, each header sits above its lane.
- ↑ and ↓ on a clip go to the clip nearest in time on the next lane with clips; with Ctrl or ⌘, without selecting.
- **`selectedKeys` is the timeline's selection.** Give every lane's `TimelineClips` the same array: a plain selection replaces it on every lane, and adding, removing or extending keeps the other lanes' clips. `onMove` now reports every selected clip, on any lane, when the focused one is selected. With one clip track, nothing changes.
- A `TimelineLayer` written outside the lanes covers all of them, and `useTimelineLanes()` gives it the lanes' ids and the lane under a pointer.
- Give the timeline a maximum height and the lanes scroll under the playhead's slider.

```tsx
<Timeline label={t("timeline.label")} length={frames}>
  <TimelinePlayhead … />
  {tracks.map((track) => (
    <TimelineLane key={track.key} id={track.key} label={t("track.label", track)} header={<TrackControls track={track} />}>
      <TimelineLayer><Waveform track={track} /></TimelineLayer>
      <TimelineClips label={t("track.clips", track)} clips={…} selectedKeys={selected} onSelectedKeysChange={setSelected} />
    </TimelineLane>
  ))}
</Timeline>
```

It adds three component tokens: `--hm-timeline-header-max-width`, `--hm-timeline-header-bg` and `--hm-timeline-lane-border-color`.
