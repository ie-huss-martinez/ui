---
"@hussmartinez/ui": minor
---

In a `Timeline` with lanes, a press on a lane's empty space, or on a clip's body when `moveHandle="title"`, now reaches a layer under the lanes, so an editor can select a range of time by dragging across tracks. Before, the lanes stopped it.

- **Write the layer that takes those presses before the lanes:** it's under them, and `useTimelineScale().unitAt` and `useTimelineLanes().laneAt` tell it where the press was. Draw what must show over the clips, such as the selected range, in a second layer written after the lanes, with `pointer-events: none`.
- **A `TimelineLayer` inside a `TimelineLane` no longer takes presses by default.** If yours handles presses itself, add the new `interactive` prop to keep it doing so: `<TimelineLayer interactive>`. Layers that only draw need nothing.
- Lane headers, clips, a clip's title and its edges keep their presses, and with `seekOnPress` a press still moves the playhead.

A timeline without lanes is unchanged.
