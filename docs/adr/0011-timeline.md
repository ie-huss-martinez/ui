# 0011. A shared timeline: clips, a playhead and layers over whole units

- **Status:** Proposed
- **Date:** 2026-11-17
- **Amended:** 2026-11-17, with the reviewer's rulings on the four open decisions, and with what the key tests do and don't prove; and again with step 1, as built: see "As built"

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
