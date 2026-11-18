# 0011. A shared timeline: clips, a playhead and layers over whole units

- **Status:** Proposed
- **Date:** 2026-11-17
- **Amended:** 2026-11-17, with the reviewer's rulings on the four open decisions, and with what the key tests do and don't prove; and again with step 1, as built: see "As built". On 2026-11-18, a proposed amendment for several lanes, clips with a start, and moving a clip by dragging: see "Proposed amendment"

## Context

video-sdk built a clip timeline as its own building block, `VideoTimeline`, and its [ADR 0007](https://github.com/ie-huss-martinez/video-sdk/blob/main/docs/adr/0007-editor-shell.md) named the trigger for moving it to `ui`: audio-sdk's editor needing a clip track. audio-sdk's [ADR 0005](https://github.com/ie-huss-martinez/audio-sdk/blob/main/docs/adr/0005-editor-shell.md) is that trigger. It asks `ui` for "a `Timeline` with the track of clips as a listbox, the playhead slider, snapping and zoom", with each SDK keeping what its media needs as layers the timeline hosts.

The two records already agree on most of the design, and `sdk-core` already holds the arithmetic ([ADR 0042](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0042-timeline-sequence-helpers.md)): `sequenceOffsets`, `locate` and `snap`, over whole units. What's left to decide here:

- **What is `ui`'s and what stays in each SDK.** `VideoTimeline` reads video-sdk's session, plan and messages directly. `ui` knows none of them.
- **Where they differ.** Video selects several clips; audio selects one, and a range of time. Video steps by a frame; audio by 10 ms.
- **How it fits `ui`'s rules,** which `VideoTimeline` didn't have to meet: no `style` attributes in server-rendered markup, a server-safe render, no text of its own, and a size budget.
- **How it stays fast.** The playhead moves on every animation frame while playing, and a timeline can hold thousands of clips.

audio-sdk has no timeline yet: its ADR says it will build one to this design if `ui`'s isn't ready. So `VideoTimeline` is the only implementation to learn from.

## Decision

### Units, and who does the arithmetic

- **Everything is in whole units,** as sdk-core ADR 0042 defines: output frames in video, samples in audio. The timeline never sees seconds, and never formats time.
- **`ui` calls `sequenceOffsets`, `locate` and `snap` itself,** from the `sdk-core` it already depends on, so the timeline, the SDKs' sessions and their tests agree at every boundary.
- **Text is the SDK's.** Each clip's accessible name ("Clip 2 of 5, 0:04.00 to 0:09.20, muted"), the playhead's value text and the parts' labels come from the SDK's catalogue as props. The timeline has no messages of its own beyond what its `ui` parts already have.

### The parts

A compound component, so that what changes every frame is its own small part:

```tsx
<Timeline label={t("timeline.label")} length={frames} zoom={zoom} snapping={snapping}>
  <TimelineLayer>{waveform}</TimelineLayer>
  <TimelineClips
    label={t("timeline.clips")}
    clips={clips}                     // { key, length, label, … } in order
    selectionMode="multiple"
    selectedKeys={selected}
    onSelectedKeysChange={setSelected}
    onMove={moveClips}
    onTrim={trimClip}
  />
  <TimelineLayer>{rangeSelection}</TimelineLayer>
  <TimelinePlayhead
    label={t("timeline.playhead")}
    position={playhead}
    onPositionChange={seek}
    step={1}
    largeStep={framesPerSecond}
    formatValue={formatTime}
  />
</Timeline>
```

- **`Timeline`** is a labelled region: a scrolling viewport, and inside it a track as wide as `length` at the current scale. It owns the scale and provides it to its parts.
- **`TimelineClips`** is the clip track: a horizontal listbox with one Tab stop.
- **`TimelinePlayhead`** is a `ui` `Slider` over `0…length`, and a line on the track at its position. Only it re-renders as the playhead moves.
- **`TimelineLayer`** is a box the size of the track, for an SDK's own drawing: audio's waveform canvas and range selection, video's waveform lane. Layers stack in the order written, under or over the clips.
- **`useTimelineScale()`** gives a layer what it needs to draw and to hit-test: the pixels per unit, the track's length, the visible range, and functions from a pointer's position to a unit and back, with and without snapping. It's the same mapping the clips and the playhead use, in either reading direction.

### The clip track

As `VideoTimeline` has it, which both SDKs' records describe:

- **A `listbox`, horizontal,** with roving focus: ← and → between clips, Home and End to the first and last. In right-to-left text they swap, as time runs leftward.
- **`selectionMode`:**
  - `"single"`, audio's: selection follows focus.
  - `"multiple"`, video's, with `aria-multiselectable`: selection follows focus; Shift extends from the last clip chosen; Ctrl or ⌘ moves focus without selecting; Space, or Ctrl or ⌘ with Space, adds or removes the focused clip; Shift+Space selects up to it; Ctrl or ⌘+A selects every clip. A click selects, a Shift-click extends, and a Ctrl- or ⌘-click toggles.
- **Clips are data:** `{ key, length, label }`, plus `content` for what a clip shows and `data` attributes for an SDK's states, such as muted. The listbox's options aren't the SDK's to render, so they can't break its semantics.
- **Every handled key has its default prevented,** and none is handled in a text field, as in `ReorderableList` ([ADR 0009](0009-reorderable-list.md)).

### Moving and trimming

The timeline detects the gesture and reports it; the SDK's session decides what happens, and renders the result. As with `ReorderableList`, the host owns the order.

| Gesture | Keys, on a focused clip | Callback |
|---|---|---|
| Move the selected clips before or after their neighbour | Alt+← / Alt+→ | `onMove(keys, direction)` |
| Set a clip's start or end to the playhead | `[` / `]` | `onTrim(key, edge, { to: playhead })` |
| Move an edge inward or outward by `trimStep` | Alt+`[` / Alt+`]`, and with Shift outward | `onTrim(key, edge, { by })` |
| Drag an edge | the keys above | `onTrim`, once, when the drag ends |

- **The bracket keys are matched by position,** `event.code`, as both SDKs do: Alt changes the character on Apple's layouts.
- **A drag previews through a callback,** `onTrimPreview`, and commits once, so it's one undo step. `limits` for an edge come from the SDK, which knows its sources' lengths. Escape cancels a drag.
- **Single-pointer alternatives stay the SDK's** (WCAG 2.5.7): its toolbar's trim and move buttons, which call the same session commands. The README requires them, as for `ReorderableList`.

### Snapping and zoom

- **Snapping** uses `snap`, with the clips' boundaries and the playhead as targets, within 8 CSS pixels at the current scale: `Math.round(8 × unitsPerPixel)`, as sdk-core ADR 0042 leaves to `ui`. `snapping` is a prop, so the SDK's snap button owns the state, and Alt while dragging turns it off for that drag. An SDK adds its own targets, such as markers, through `snapTargets`.
- **Zoom is the SDK's state,** changed by the family's `+`, `-` and `0` tools ([sdk-core ADR 0030](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0030-tools-and-keyboard-shortcuts.md)). `zoom` is a multiple of fitting `length` to the viewport, so `1` fits. `maxPixelsPerUnit` caps it, and `onZoomRangeChange` tells the SDK the range, so its tools know when to disable.
- **Scrolling** follows the playhead while `following` is set, as while playing, and the focused clip otherwise. After a zoom, the playhead is brought back into view.

### Sizes without `style` attributes

`VideoTimeline` sizes its track and clips with React's `style`, which becomes a `style` attribute when rendered on a server, and a strict Content Security Policy blocks those ([sdk-core ADR 0012](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0012-hostile-input-and-no-network.md)).

- **`ui`'s timeline sets sizes through the CSSOM,** in a layout effect, as `Tooltip` sets its position ([ADR 0006](0006-overlays-in-the-top-layer.md)). The server renders the clips with no sizes.
- **Before it has measured,** on a server and until the first layout effect, the track shows its clips at equal widths. The SDKs render their empty state on a server, so nobody sees it there.
- **Nothing in render reads the browser:** the viewport's width comes from a `ResizeObserver`, in an effect.

### Focus

- **The Tab order** is the clips' listbox, then the playhead slider: two Tab stops for the whole timeline.
- **Where focus goes after an edit is the SDK's rule,** because only its session knows what a command did. Both SDKs' records list theirs. The timeline gives them a ref handle: `focusClip(key)` and `focusPlayhead()`.
- **The timeline's own rule** is the one both SDKs found they needed: when the focused clip is removed, focus goes to the clip that took its place, or the one before, or the playhead, and only if focus was in the timeline or was dropped. It never takes focus from elsewhere, such as on a host's insert at load.

### In order

Each step is one pull request, and the timeline isn't announced as ready until the last.

1. **`Timeline`, `TimelineLayer`, `TimelinePlayhead` and `useTimelineScale`:** the region, the scale, zoom, scrolling, the slider and its line, and seeking with a click on the track.
2. **`TimelineClips`:** the listbox, both selection modes, and its focus rule.
3. **Moving and trimming:** the keys, the edge drag, and snapping.

Then each SDK replaces its own timeline in its own pull request: video-sdk's `VideoTimeline` becomes a thin binding of its session to these parts, and audio-sdk builds its waveform and range selection as layers.

### As built

**Step 1,** the region, the scale and the playhead:

- **The slider is on the track,** as wide as it, so its thumb is the playhead's handle and the line hangs from it. It isn't a separate control above the track, as in `VideoTimeline`. The track has two rows: the slider's, then the lane that layers and clips share. The viewport keeps half a thumb free at each end, so the thumb reaches the first and last units.
- **`following` is `TimelinePlayhead`'s prop, not `Timeline`'s.** Only the playhead knows its position, and the timeline mustn't render as it moves. The playhead also brings itself back to the middle after a zoom, and starts in view when the first zoom would leave it out.
- **`onMaxZoomChange(maxZoom)`** replaces the `onZoomRangeChange` sketched above: the least zoom is always 1.
- **`seekOnPress`** on the playhead turns off moving it with a press on the track, for an SDK whose layer handles presses itself, as audio-sdk's range selection does.
- **`onVisibleRangeChange`** on the timeline, and `visibleRange()` on the scale, for a layer that draws only what's in view, such as a waveform on a canvas. The range isn't React state, so scrolling renders nothing.
- **A track is at most eight million pixels wide.** Engines stop laying out boxes somewhere above sixteen million, so the zoom stops before `maxPixelsPerUnit` on a very long timeline.
- **Sizes are measured and set in ref callbacks,** which React runs when it commits, before the browser paints, and only in a browser. Step 1 used plain effects, which left one unsized frame; step 2 replaced them, with a test that the first frame committed is sized. The usual answer, `useLayoutEffect` in a browser and `useEffect` on a server, chooses between them by reading `typeof document` when the module loads, and this package reads nothing of the browser on import or in a server render; its server test fails on that read.

**Step 2,** the clip track:

- **The ref handle is the part's, not the timeline's:** `TimelineClips`' ref gives `focusClip(key)`, and the playhead's ref is its slider, which has `focus()`.
- **Ctrl or ⌘ moves focus without selecting in both modes,** not only with several clips, so a single-selection track can be explored without changing what the editor shows.
- **Each clip is a memoised option,** so a change of selection or focus renders only the clips it changes.
- **Alt with an arrow isn't taken yet.** The track takes it in step 3, with moving. Until then it's the browser's, as on any page.
- **A selected clip has a thicker border as well as a colour,** so selection isn't shown by colour alone.
- **Measured with 2,000 clips,** as the review asked, with React's development build, in the pinned image, on each engine: mounting takes 0.64 to 0.79 seconds, once; a key that moves focus and selection takes 19 to 51 milliseconds and changes two options. **Recommended: no windowing yet.** A press is within a few frames, and mounting happens once. It's worth revisiting when an SDK has a real document with several thousand clips, or if zooming, which resizes every clip, proves slow; neither is measured here.

**Step 3,** moving and trimming:

- **The callbacks are `onMove(keys, direction)`, `onTrim(key, edge, delta)` and `onTrimToPlayhead(key, edge)`,** not the one `onTrim` with a `to` or a `by` sketched above. `delta` is in units, positive for longer at that edge, from the keys and from a drag alike. The track doesn't know where the playhead is, so `[` and `]` only say which edge.
- **Alt with ← or → is taken on every clip, with or without `onMove`.** The risk it guards against, the browser going back out of an editor, doesn't depend on whether the host can move clips. `onMove` is called at the first and last clips too: the host knows whether a selection that isn't one block can still move.
- **A drag shows itself.** While an edge is dragged, the track draws its clip at the length it would have, without the host doing anything, and reports once when the drag ends, so it's one undo step. `trimLimits` bounds it, such as at a source's end; a clip never goes under one unit.
- **Focus after a move** goes back to the clip, when the browser dropped it as React put the clip in its new place and nothing else took it.
- **Clips narrower than 24 pixels.** A clip's width is its length at the zoom, so a short clip on a fitted timeline can be a pixel wide, under WCAG 2.5.8's 24 pixels. The track can't widen it without misplacing every clip after it. It relies on the criterion's **equivalent-control exception:** the same clip is reached and selected with the keyboard, in the same listbox, and by zooming in, where it's as wide as its length allows. So **an SDK that renders `TimelineClips` must offer zoom,** with the family's `+`, `-` and `0` tools ([sdk-core ADR 0030](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0030-tools-and-keyboard-shortcuts.md)) and buttons for them, and must offer buttons that move and trim the selected clips. The README says both. A clip's edges for dragging are a third of it at most, so its middle can still be pressed.
- **Zooming 2,000 clips,** which resizes every one, measured as the review asked, with React's development build, in the pinned image: 81 to 238 milliseconds on the three engines, including the layout it causes. That's several frames, once per zoom step, and the cost is the browser laying out 2,000 boxes, not React. **Still no windowing:** it would be the first thing to try if an SDK's real documents make zooming feel slow.

### Tests

- **Every key, on three engines,** with its default prevented, as for `ReorderableList`: the listbox's keys in both modes, the move and trim keys including at the first and last clips, none with other modifiers or in a text field, and right-to-left.
- **What those tests prove: `defaultPrevented`, and that the page doesn't scroll. Not that it doesn't navigate.** Back and Forward belong to the browser's own interface, which an automated browser doesn't have. In the pinned image, on a page with a history entry behind it, Alt+← leaves the page where it is in Chromium, Firefox and WebKit even when nothing prevents the key. So an assertion that the URL didn't change can't fail, and no test here makes one. A prevented default is what stops a real browser's shortcut, and that's what's asserted; the manual check below covers the rest.
- **The scale:** a pointer's unit and a unit's pixel agree in both directions, at several zooms and in both reading directions, and snapping picks what `snap` picks.
- **Rendering cost:** moving the playhead re-renders `TimelinePlayhead` only, counted in a test.
- **axe** on every story, with clips, a selection, a drag in progress and an empty track; visual baselines in every theme and density.
- **A server render and hydration without warnings,** and no `style` attribute in the markup.

## Decided in review

The reviewer ruled on the four questions this record first left open, on 2026-11-17.

1. **Alt+← and Alt+→ move clips,** with their default prevented everywhere in the track, including at the first and last clips. video-sdk uses them. pdf-sdk ADR 0008 lists them as Back and Forward in Chrome and Firefox on Windows and Linux, and chose not to use them; on a horizontal track there's no other natural key, and they match `ReorderableList`'s Alt with the arrow along its axis. The risk if prevention failed is leaving an editor with unsaved work, and the automated tests can't show that it holds (see Tests). So **a manual check in real Chrome and Firefox, on Windows or Linux, is a condition of this record becoming Accepted.** Move buttons stay required, as for `ReorderableList`.
2. **Range selection stays in audio-sdk,** as a layer, with `useTimelineScale` for its pointer mapping and snapping. It has one consumer today. If video-sdk builds a range tool, it moves to `ui` then, by the rule of two consumers.
3. **Both selection modes are in the first version,** because each SDK needs one.
4. **No windowing of clips in the first version.** Every clip is an option in the DOM. The first pull request measures a track of 2,000 clips, and the number decides whether options are then drawn only where visible, with `aria-setsize` and `aria-posinset`.

## Proposed amendment: lanes, clips with a start, and moving a clip

- **Status:** Proposed, 2026-11-18, with its open decisions ruled in review the same day. Nothing in this section is built. Like the rest of this record, it stays Proposed until the manual checks.

### Why

Both SDKs are becoming multitrack. audio-sdk's [ADR 0006](https://github.com/ie-huss-martinez/audio-sdk/pull/55) makes a recording several tracks of positioned clips, each with a name, mute, solo and gain. video-sdk's [ADR 0008](https://github.com/ie-huss-martinez/video-sdk/pull/67) keeps one video track, back to back, and adds up to eight audio tracks under it. The timeline as built can't show either:

- it has one lane, in which layers and clips stack;
- its clips lie back to back, so there's no silence between them;
- a clip moves only by keys, one neighbour at a time, never by dragging and never to another lane.

What they ask for is the same, with one difference that shapes the design: **video-sdk needs both kinds of lane in one timeline,** its video lane back to back as today, and audio lanes with positions under it.

### Lanes

```tsx
<Timeline label={t("timeline.label")} length={frames} zoom={zoom}>
  <TimelinePlayhead … />
  {tracks.map((track) => (
    <TimelineLane
      key={track.key}
      id={track.key}
      label={t("track.label", track)}       // "Track 2, Music, muted"
      header={<>… name, Mute, Solo, gain …</>}
    >
      <TimelineLayer><Waveform track={track} /></TimelineLayer>
      <TimelineClips label={t("track.clips", track)} clips={…} … />
    </TimelineLane>
  ))}
  <TimelineLayer>{rangeSelection}</TimelineLayer>   {/* over every lane */}
</Timeline>
```

- **`TimelineLane` is a `group`,** named by `label`, with the lane's own layers and clip track stacked in it, as the whole timeline's are today. Lanes stack downward in the order written; the SDK owns that order, and moves a track by rendering it elsewhere.
- **One playhead for all of them.** The slider stays in its row at the top, and the line runs down every lane.
- **The header doesn't scroll with time.** It's a column at the start of the track, held in place with `position: sticky`, so it needs no script. Every lane's header is as wide as the widest, through a subgrid, up to a token's width. The timeline measures that column and fits `length` to what's left, so `zoom={1}` still fits.
- **The header is a `ui` `Toolbar`,** rendered by the lane around the `header` content and named after the lane. So it's one Tab stop, with ← and → between its controls, and a gain `Slider` goes last, as `Slider` already asks in a toolbar.
- **Lanes past the timeline's height scroll,** when the SDK gives the timeline a maximum height. The slider's row stays at the top, as the headers stay at the start.
- **Below 720 pixels of the timeline's own width, each header sits above its lane,** by a container query on the timeline. That's both SDKs' breakpoint for their editors, and the timeline measures the header column either way, so the scale follows.
- **A layer written outside the lanes covers all of them,** for audio-sdk's range selection, which stays in audio-sdk. `useTimelineLanes()` tells it which lane is under a pointer: `laneAt(clientY)`, and the lanes' ids in order.

### A timeline without lanes is 0.11's

Parts written straight into `Timeline`, with no `TimelineLane`, behave exactly as in 0.11: one lane, no header column, the same markup, keys and focus. **The test is that every existing timeline test passes with no edit.** A single lane with no `header` looks the same too, inside one more `group`.

### Clips with a start

- **`TimelineClip` gains `at`,** the unit the clip starts on. A clip track is one of two kinds, decided by its clips:
  - **back to back,** when no clip has `at`: today's layout, where each clip starts where the one before ends. video-sdk's video lane stays this.
  - **positioned,** when every clip has `at`: each clip is placed at its start, with silence wherever no clip is. Clips are given in time order and don't overlap; the track warns in development when they aren't or do, and doesn't correct them.
  - Some clips with `at` and some without is a mistake, warned about in development.
- **The two kinds can share a timeline,** one per lane.
- **The listbox is unchanged:** one Tab stop a lane, ← and → between its clips in time order, the same selection keys.
- **Every lane's clip edges are snap targets for the whole timeline,** as one lane's are today. So an audio clip's edge snaps to the video lane's boundaries, to other lanes' clips and to the playhead, with no work from the SDK. A clip being dragged doesn't snap to its own edges.
- **Trimming** keeps its callback. On a positioned lane, the preview holds the clip's other edge still, since nothing after it moves; the SDK moves `at` with the start, as both SDKs' commands do.
- **A clip can end after `length`.** video-sdk's audio can run past the video's end. `Timeline` takes `extent`, at least `length`: the track is drawn that wide, the playhead's slider still ends at `length`, and a clip that starts or ends after `length` carries `data-hm-past-end`, so the SDK can dim it.
- **Before the timeline has measured itself,** as on a server, positioned clips share the lane equally in order, as back-to-back ones do.

### One selection for the timeline

`selectedKeys` is the timeline's selection, not a lane's. The SDK gives every lane the same array, and each lane reports the whole new selection:

- **a plain selection replaces it,** in every lane, so selecting a clip on one lane deselects the others;
- **adding or removing,** with Space or a Ctrl- or ⌘-click, keeps the other lanes' clips;
- **Shift extends within the lane** the focus is in.

With one lane this is what 0.11 does. It gives video-sdk one selection across its video and audio clips, and audio-sdk one selected clip at a time with `selectionMode="single"`.

### Focus and the Tab order

- **Two Tab stops a lane:** its header, then its clips. With the playhead written first, as both SDKs want, the order is playhead, then each lane. Sixteen tracks are thirty-two stops, so the arrows matter:
- **↑ and ↓ on a clip go to the clip nearest in time on the lane above or below,** skipping lanes with no clips. Selection follows, and Ctrl or ⌘ moves without selecting, as along a lane. They're taken on every clip of a timeline with more than one lane, at the top and bottom too, so the page never scrolls. In a timeline without lanes they aren't taken, as in 0.11.
- **`focusClip(key)` stays on each clip track's ref.** An SDK that adds a clip to a lane, as video-sdk does when it detaches audio, calls it on that lane's.
- **When the focused clip is removed,** focus goes to the clip that took its place on that lane, or the one before it there, or the playhead: 0.11's rule, a lane at a time.

### Moving a clip

| Gesture | Keys, on a focused clip | Callback |
|---|---|---|
| Earlier or later | Alt+← / Alt+→, as built | `onMove(keys, direction)` |
| To the lane above or below | **Alt+↑ / Alt+↓** | `onMoveLane(keys, direction)` |
| Drag a clip along time and across lanes | the keys above | `onDrop(keys, { by, lane })`, once, on release |

- **`onMove` keeps its meaning: a direction.** The SDK decides how far: before or after a neighbour on video-sdk's video lane, a frame on its audio lanes, 10 milliseconds in audio-sdk.
- **Alt+↑ and Alt+↓ move the clip to the next lane,** at the same time. They pass the key table of pdf-sdk ADR 0008, which chose them for moving in a list: no browser shortcut in Chrome or Firefox; Option+↑ and Option+↓ scroll the page in Safari and Firefox on macOS, which is a page default the focused clip prevents, and the browser tests showed unprevented Alt+↓ scrolling in Chromium and WebKit. They're taken on every clip, with or without `onMoveLane`, as Alt+← and Alt+→ are.
- **No Shift for a larger step.** video-sdk asked for Alt+Shift+← and → as a larger step. The same table rules Alt+Shift with an arrow out: Windows moves tiles with it, and Alt+Shift alone switches the keyboard layout. A larger move is the drag, the SDK's buttons, or a Start field in its inspector.
- **Dragging:** a press on a clip that moves more than a few pixels becomes a drag, so a click still selects. The clip follows the pointer along time and over the lanes. Its start or its end snaps to the timeline's targets, whichever is nearer, unless Alt is held. Near the viewport's edges the timeline scrolls. Escape cancels. It's reported once, on release, with the units moved and the lane's `id` when it changed, so it's one undo step. A selected clip takes the rest of the selection with it.
- **The SDK says where a clip may go.** `canDrop(keys, { by, lane })` is asked as the drag moves. Where it says no, the clip shows that it can't be dropped and release reports nothing. That's how audio-sdk refuses an overlap, and how video-sdk keeps clips from entering or leaving its video lane. Without it, every place is allowed, and the SDK may still ignore `onDrop`.
- **With a mouse or a pen, not by touch.** A finger dragged across the clips scrolls the timeline, and a drag that took it couldn't be told from a scroll. On a touch screen a clip moves with the buttons, which are required anyway.
- **Buttons stay required,** now for moving to another lane too, with `aria-keyshortcuts`.

### Where a drag starts: for audio-sdk to decide

audio-sdk's record has two drags that start in the same place: dragging across a track selects a range of time, and dragging a clip's body moves it. A track is usually covered by clips, so one press can't mean both.

`TimelineClips` therefore takes **`moveHandle`**: `"clip"`, the default, where a drag anywhere on the clip moves it, which suits video-sdk; or `"title"`, where only the strip that shows the clip's `content` moves it, and a press on the rest of the clip passes through to the layer under it. That's how audio editors with range selection usually separate the two. audio-sdk chooses; this record only makes both possible.

### Performance

Measured before any of this is built, with a stand-in: several clip tracks, layers and three-control headers in one timeline as built, on a 1,000-pixel timeline, with React's development build, in the pinned image. The range is across Chromium, Firefox and WebKit.

| Lanes × clips each | Clips | Mounting | One zoom step |
|---|---|---|---|
| 1 × 2,000 | 2,000 | 0.63 to 0.97 s | 0.31 to 0.35 s |
| 16 × 125 | 2,000 | 0.28 to 0.71 s | 0.15 to 0.34 s |
| 256 × 8 | 2,048 | 0.38 to 0.99 s | 0.16 to 0.32 s |
| 64 × 125 | 8,000 | 1.3 to 2.3 s | 0.42 to 1.25 s |
| 256 × 125 | 32,000 | 5.0 to 8.3 s | 1.9 to 3.6 s |

- **The cost follows the number of clips, not of lanes.** Two thousand clips cost the same on one lane, on sixteen or on 256.
- **Within both SDKs' limits, no windowing.** audio-sdk allows 16 tracks and 2,000 clips in a plan; video-sdk has nine lanes.
- **Past a few thousand clips, zooming is the first thing to slow:** at 8,000 a zoom step can pass a second. That's where drawing only the clips in view would start to pay, and it would be by clips in view, not by lanes.
- **The numbers are to be taken again on real lanes,** in the pull request that adds them, since a stand-in has no sticky headers or subgrid.

### In order

Three pull requests, each raising the size budgets from its measurement:

1. **Lanes:** `TimelineLane` with its header, the layout and its scrolling, `useTimelineLanes`, ↑ and ↓ between lanes, and one selection for the timeline. The measurements again.
2. **Clips with a start:** `at`, positioned lanes next to back-to-back ones, `extent` and `data-hm-past-end`, and the trim preview on a positioned lane.
3. **Moving a clip:** the drag, `onDrop` and `canDrop`, `moveHandle`, Alt+↑ and Alt+↓ with `onMoveLane`, and scrolling at the edges.

### As built

**Lanes,** the first of the three steps:

- **The headers' column is the viewport's own padding,** before the track, not a column of a subgrid as proposed. The track still starts at the first unit and is as wide as `length` at the zoom, so nothing that maps units to pixels changed, and every timeline test from before passes unedited. Each lane reaches back over that padding, so its header has a box to stay in.
- **Sticky insets are measured from inside a scrolling box's padding,** in all three engines. So a header's inset is the padding's width, negative, set through the CSSOM with its size.
- **The timeline measures the headers.** Each header's toolbar is as wide as its controls, up to `--hm-timeline-header-max-width`; the column is as wide as the widest, and a `ResizeObserver` follows them, on the next frame.
- **Headers go above their lanes below 720 pixels by measurement, not a container query.** The timeline has to know the column's width to fit `length` beside it, and a query can't tell it. It's still the timeline's own width and still no prop, as ruled.
- **Lanes say they're there when React commits,** as sizes are set, so the first frame has its rows. A server render has no lanes laid out, like its sizes.
- **`onMove` reports the timeline's whole selection,** this lane's clips in order and then the others', when the focused clip is selected.
- **Measured again, on real lanes,** with React's development build, in the pinned image, across the three engines: 16 lanes of 125 clips mount in 0.64 to 0.96 seconds and zoom in 0.23 to 0.58; 64 lanes of 125, which is 8,000 clips, mount in 1.75 to 2.09 seconds and zoom in 0.48 to 1.36. That's the stand-in's result again: the cost follows the clips, and nothing within either SDK's limits needs windowing.
- **No test asserts a time.** The scale tests first had loose time limits, and they failed when other work shared the machine: mounting 64 lanes took 10.7 seconds instead of two. They now assert what changes instead: a key among 2,000 clips, on one lane or sixteen, changes the two clips it moves between and nothing else. That found what a time limit hadn't, each lane writing its unchanged styles again at every render, which the parts no longer do.

**Clips with a start,** the second step:

- **A positioned clip is placed by a margin, not by absolute positioning.** Each clip's margin is the room between the end of the clip before and its own start, set through the CSSOM with its width. The clips stay in the lane's flow, so the lane is as tall as they are and the back-to-back layout is the same code with no margins.
- **`extent` fits, not `length`.** A zoom of 1 fits everything that's drawn, the part past `length` too. The playhead's slider is as wide as `length` at the zoom.
- **`unitAt` and `visibleRange` reach to `extent`,** and `TimelineScale` has `extent` beside `length`, so a layer can draw and hit-test past the length.
- **A clip past `length` is marked, not styled.** `data-hm-past-end` is on a clip that ends after `length`; how it looks is the SDK's.
- **Mistakes in the clips warn in development and aren't corrected:** clips that overlap or aren't in time order, an `at` that isn't a whole number, and a track where only some clips have one.

### Decided in review

The reviewer ruled on the six questions this amendment first left open, on 2026-11-18.

1. **`selectedKeys` is the timeline's selection,** given to every lane, rather than a selection per lane or a new prop on `Timeline`. It needs no new API and one lane is unchanged. An SDK that passed each lane only its own keys would lose the others on a toggle, so the README says to pass every lane the same array.
2. **No Alt+Shift with an arrow,** which video-sdk asked for as a larger step: the family's key table rules it out.
3. **A clip is dragged with a mouse or a pen, not by touch.** On a touch screen it moves with the required buttons, which is the single-pointer alternative WCAG 2.5.7 asks for.
4. **`moveHandle`, with `"clip"` as the default.** The reviewer recommends `"title"` to audio-sdk, so that range selection works across clips; the choice is audio-sdk's.
5. **Headers sit above their lanes below 720 pixels of the timeline's width,** by a container query in `ui`, with no prop.
6. **`extent` draws clips past `length`,** and `length` keeps meaning what the playhead can reach.

### What it costs

- `Timeline` becomes a two-dimensional layout, with sticky rows and columns, and its largest part, the drag across lanes, is still to write.
- **↑ and ↓ between lanes, Alt+↑ and Alt+↓, and the header as a toolbar are untried with a screen reader,** as the rest of this record is. A `group` per lane, holding a toolbar and a listbox, is a lot to hear; the manual pass that this record already waits for must cover a timeline with lanes.
- **The manual check of Alt with an arrow in real browsers now includes ↑ and ↓,** for scrolling rather than navigating.

## Alternatives considered

- **Moving `VideoTimeline` as it is:** it reads video-sdk's session, plan, frame rate and messages, and formats time. audio-sdk would need an adapter for each, and `ui` would depend on one SDK's model.
- **One `Timeline` component with every prop:** the playhead's position would re-render the clips on every frame, or the component would need internal subscriptions that hosts can't see. Parts keep each change local.
- **Clips as children the SDK renders:** flexible, but an option's role, name, selection state and edges are exactly what must not drift between SDKs.
- **Seconds or milliseconds as the unit:** both SDKs' plans and sdk-core ADR 0042 rule them out, because they drift and can't name an exact frame or sample.
- **The waveform in `ui`:** it needs each SDK's peaks and its own drawing rules, and audio's and video's differ. A layer costs `ui` nothing.
- **Sizes through `style` props:** blocked by a strict policy when rendered on a server.
- **A third-party timeline:** none fits whole units, the family's keys, `ui`'s tokens and a strict policy without as much adapting as writing it.

## Consequences

- audio-sdk and video-sdk get one clip track, with the same keys, names and focus rule, and each keeps its media's drawing and its session.
- **video-sdk's timeline changes when it adopts this:** its sizes move from `style` to the CSSOM, and its snap button and zoom become props it passes. Its keys and behaviour shouldn't change; its end-to-end tests are the check.
- **`ui` takes on its largest component,** in three pull requests, each raising the React entry's size budget from its measurement. It's 15.94 kB of 16 kB today.
- **Two manual checks stand between this record and Accepted:** the Alt and arrow keys in real Chrome and Firefox, above, and a pass with NVDA and VoiceOver, because nothing here has been tried with a screen reader, like `ReorderableList`.
- Only the parts an application imports are shipped, so an editor without a timeline pays nothing.
