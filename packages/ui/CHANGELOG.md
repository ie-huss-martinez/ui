# @hussmartinez/ui

## 0.14.4

### Patch Changes

- [#114](https://github.com/ie-huss-martinez/ui/pull/114) [`0a94991`](https://github.com/ie-huss-martinez/ui/commit/0a94991160fdd9bff3624b3bd684304fdac43514) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Mirrored icons, such as `UndoIcon`, `RangeStartIcon` and those added in 0.14.3, now flip in right-to-left text whatever builds your CSS. They used `:dir(rtl)`, which Vite's default build target and Next.js lower for older browsers to a list of `:lang()` values. So on a `dir="rtl"` page without a right-to-left `lang`, nothing mirrored. They now follow the nearest `dir` attribute on an ancestor, up to three nested levels, such as left-to-right text inside a right-to-left page and right-to-left text inside that. `dir="auto"` isn't followed: set `dir="rtl"` or `dir="ltr"` on an element around the icons. Nothing changes in the API.

## 0.14.3

### Patch Changes

- [#111](https://github.com/ie-huss-martinez/ui/pull/111) [`20b72ee`](https://github.com/ie-huss-martinez/ui/commit/20b72ee6788eb703bd88da79aae78463cdeb0e07) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Icons that point along time now mirror in right-to-left text, as the `Timeline` does: `ChevronLeftIcon` and `ChevronRightIcon`, `TrimStartIcon` and `TrimEndIcon`, `FadeInIcon` and `FadeOutIcon`, and `SkipBackIcon` and `SkipForwardIcon`. Before, they pointed against the track's direction there; "to the start" now points right, where a right-to-left timeline starts. `PlayIcon` still doesn't mirror, so a transport reads as it does in left-to-right text. Nothing changes in left-to-right text or in the API. If you mirrored any of these yourself in right-to-left text, remove that, or they'll flip back.

## 0.14.2

### Patch Changes

- [#109](https://github.com/ie-huss-martinez/ui/pull/109) [`f7fb5f7`](https://github.com/ie-huss-martinez/ui/commit/f7fb5f7f106c8d7baca9349ee7cd3e782ee6bd9a) Thanks [@hussmartinez](https://github.com/hussmartinez)! - `useAnnounce` no longer loses messages sent in the same frame. Before, when two components announced in one commit, such as a child's effect and its parent's, only the last message was said. Now messages sent in the same frame with the same politeness are said together, in order, separated by a space, and the same message twice is said once. Polite and assertive messages stay separate, and a message in a later frame is said on its own, as before. End each message with its language's punctuation, so joined messages read as sentences. If you joined messages yourself to work around this, as `useJoinedAnnounce` in audio-sdk and video-sdk does, you can call `announce` directly again.

## 0.14.1

### Patch Changes

- [#105](https://github.com/ie-huss-martinez/ui/pull/105) [`eb7f663`](https://github.com/ie-huss-martinez/ui/commit/eb7f6634d9782c4539933a2d07ceaabf03b4bdb4) Thanks [@hussmartinez](https://github.com/hussmartinez)! - A focused control inside a `Dialog`'s body now shows its whole focus ring. The body scrolls, and a scrolling box clips what's drawn outside it, so a field as wide as the body, or at its end, showed its ring along one edge only. The body now keeps room for a ring at every edge, and its content stays where it was. Nothing changes in the API.

- [#107](https://github.com/ie-huss-martinez/ui/pull/107) [`4334fd7`](https://github.com/ie-huss-martinez/ui/commit/4334fd765d950a96f15640dacc785bf7a9bfe9de) Thanks [@hussmartinez](https://github.com/hussmartinez)! - The `Timeline`'s playhead now shows its whole focus ring. The timeline scrolls, and a scrolling box clips what's drawn outside it, so the thumb's ring lost its top edge, and at the first or last unit its outer side too. The slider's row is now tall enough for the thumb and its ring, and the timeline keeps room for the ring past each end. A timeline is a few pixels taller where the thumb and ring are larger than the target size, and its track is a few pixels narrower. Nothing changes in the API.

## 0.14.0

### Minor Changes

- [#98](https://github.com/ie-huss-martinez/ui/pull/98) [`0e4a8a9`](https://github.com/ie-huss-martinez/ui/commit/0e4a8a96cbc589f44d1faa16ba48f3aa21e0bfc3) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Add three icons for editing time: `RangeStartIcon` and `RangeEndIcon`, for setting where a selected range starts and ends, and `RippleIcon`, for closing the gap a deletion leaves. Their `IconName`s are `range-start`, `range-end` and `ripple`. The range icons follow the reading direction, mirrored in right-to-left text.
  
  Lucide has no glyph for a range's start and end, so ui draws those two itself, on Lucide's grid and stroke so they sit with the rest. `RippleIcon` is Lucide's `fold-horizontal`.

- [#96](https://github.com/ie-huss-martinez/ui/pull/96) [`4ab2aaa`](https://github.com/ie-huss-martinez/ui/commit/4ab2aaa633e16bec1cc8ef50a0f0717fb5e41efd) Thanks [@hussmartinez](https://github.com/hussmartinez)! - In a `Timeline` with lanes, a press on a lane's empty space, or on a clip's body when `moveHandle="title"`, now reaches a layer under the lanes, so an editor can select a range of time by dragging across tracks. Before, the lanes stopped it.
  
  - **Write the layer that takes those presses before the lanes:** it's under them, and `useTimelineScale().unitAt` and `useTimelineLanes().laneAt` tell it where the press was. Draw what must show over the clips, such as the selected range, in a second layer written after the lanes, with `pointer-events: none`.
  - **A `TimelineLayer` inside a `TimelineLane` no longer takes presses by default.** If yours handles presses itself, add the new `interactive` prop to keep it doing so: `<TimelineLayer interactive>`. Layers that only draw need nothing.
  - Lane headers, clips, a clip's title and its edges keep their presses, and with `seekOnPress` a press still moves the playhead.
  
  A timeline without lanes is unchanged.

## 0.13.0

### Minor Changes

- [#91](https://github.com/ie-huss-martinez/ui/pull/91) [`9c775d3`](https://github.com/ie-huss-martinez/ui/commit/9c775d3fcbaf10ecad9f9dc55bfe5d9beaa7ba1f) Thanks [@hussmartinez](https://github.com/hussmartinez)! - `Slider` gains `onValueCommit(value)`, called once when a gesture that changed the value ends, with the value it ended on:
  
  - when the pointer is let go, after a drag or a click on the track, wherever the pointer is by then;
  - when the last key held is let go, however many times it repeated;
  - when the slider loses focus before that.
  
  A gesture that leaves the value where it was calls nothing. Use it for what should happen once per gesture, such as an undo step, and `onValueChange` for what follows the value as it moves:
  
  ```tsx
  <Slider label={t("track.gain")} value={gain} onValueChange={preview} onValueCommit={(db) => session.setGain(track, db)} />
  ```

### Patch Changes

- [#95](https://github.com/ie-huss-martinez/ui/pull/95) [`ae10c02`](https://github.com/ie-huss-martinez/ui/commit/ae10c02ab50ffb662e0f8584dbbd3d52c06c74c6) Thanks [@hussmartinez](https://github.com/hussmartinez)! - `ReorderableList` now selects the row whose item receives focus however focus arrives: by Tab, a click, or your own `focus()`, as well as the arrow keys. Before, Tab onto a list with nothing selected focused the first row without selecting it, so tools acting on the selected row stayed disabled until an arrow key was pressed. `onSelectedChange` is called only on a real focus, and only when the selection changes. Focus on a row's control still never changes the selection, and Ctrl or ⌘ with an arrow still moves without selecting. It now behaves as `TimelineClips` does in single selection.

- [#94](https://github.com/ie-huss-martinez/ui/pull/94) [`913239f`](https://github.com/ie-huss-martinez/ui/commit/913239f3daffc6da11de6deb5bc697e6d6a21b90) Thanks [@hussmartinez](https://github.com/hussmartinez)! - `TimelineClips` with `selectionMode="single"` now keeps the selection on the focused clip however focus arrives, as its documentation said: by Tab, a click, your own `focus()`, or `focusClip`, as well as the arrow keys. Before, a clip reached by Tab or `focusClip` was focused but not selected, so tools acting on the selected clip stayed disabled until an arrow key was pressed. `onSelectedKeysChange` is called only on a real focus, and only when the selection changes, so a controlled host doesn't loop. Ctrl or ⌘ with an arrow still moves focus without selecting, and `selectionMode="multiple"` is unchanged.
  
  If you selected the focused clip yourself in an `onFocus` handler, you can remove it.

## 0.12.0

### Minor Changes

- [#88](https://github.com/ie-huss-martinez/ui/pull/88) [`a97298d`](https://github.com/ie-huss-martinez/ui/commit/a97298df700a77915cf694f2c4e5800eb96e503b) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Clips on a `Timeline` can now have a start, so a track can have room between its clips.
  
  - `TimelineClip` gains `at`, the unit the clip starts on. Give it to every clip of a `TimelineClips`, in time order and without overlap, and each is placed at its start; give it to none, and they lie back to back, as before. A track warns in development when clips overlap, are out of order, or only some have `at`.
  - The two kinds of track share a timeline, one per lane: a video lane back to back over audio lanes with positions, for instance.
  - Every lane's clip edges are snap targets for the whole timeline, so a clip's edge snaps to another lane's clips.
  - While an edge is dragged on a track with positions, the clip's other edge and its neighbours stay where they are.
  - `Timeline` gains `extent`, for clips that run past `length`: the track is drawn that far, the playhead still ends at `length`, and a clip that passes it carries `data-hm-past-end`. `useTimelineScale()` gains `extent`, and `unitAt` and `visibleRange` now reach as far as it.

- [#85](https://github.com/ie-huss-martinez/ui/pull/85) [`e04eeb9`](https://github.com/ie-huss-martinez/ui/commit/e04eeb995f0fe36b36d608475f8f4d481079867f) Thanks [@hussmartinez](https://github.com/hussmartinez)! - `Timeline` can now hold several lanes, for an editor with several tracks. A timeline without lanes works as before.
  
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

- [#89](https://github.com/ie-huss-martinez/ui/pull/89) [`1b8343f`](https://github.com/ie-huss-martinez/ui/commit/1b8343faf4e996db0bc45cc0bb5b4bc2afbadad9) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Clips on a `Timeline` can now be moved by dragging, and between lanes with the keyboard.
  
  - `onDrop(keys, { by, lane })`: with it, a clip is dragged with a mouse or a pen, along time and to the lane under the pointer. Its start or end snaps to the other clips, on any lane, and the playhead, unless Alt is held. It's reported once, on release; Escape cancels. A selected clip takes the rest of the timeline's selection with it. The timeline scrolls while a clip is held near either end of the view. On a touch screen a drag scrolls, and clips move with your buttons.
  - `canDrop(keys, { by, lane })` is asked as a clip is dragged. Where it says no, the clip shows it, and letting go reports nothing.
  - `onMoveLane(keys, direction)`: Alt+↑ and Alt+↓ (Option on macOS) move clips to the lane above or below. In a lane they're always taken, with or without `onMoveLane`, so the page doesn't scroll. Focus follows a clip to its new lane.
  - `moveHandle`: `"clip"`, the default, or `"title"`, where only a clip's title is the handle and a press on the rest reaches the layer under it.
  - Between clips, a press now reaches what's under the track, such as a layer, rather than the clip track.
  
  `TimelineClipDrop` is exported. It adds two component tokens: `--hm-timeline-clip-moving-shadow` and `--hm-timeline-clip-refused-border-color`.

## 0.11.0

### Minor Changes

- [#76](https://github.com/ie-huss-martinez/ui/pull/76) [`ff6f7cd`](https://github.com/ie-huss-martinez/ui/commit/ff6f7cdf1753d8f0dc666171a2b79588afa8ddcc) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Add the `hm-text` class, for text outside components. Put it on your editor's or application's root element, and the text inside takes ui's font family, size, weight, letter spacing, line height and text colour from the tokens, instead of the page's. It's opt-in and in the lowest-priority layer, so your own CSS, and an SDK's rules in `hm.sdk`, still win.
  
  ```html
  <div class="hm-text my-editor">…</div>
  ```

- [#81](https://github.com/ie-huss-martinez/ui/pull/81) [`0ebdee8`](https://github.com/ie-huss-martinez/ui/commit/0ebdee882da702a7a708599cdc06835bc066b36d) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Add `TimelineClips`, the clip track of `Timeline`: a horizontal listbox with one Tab stop, where each clip is as wide as its length at the timeline's zoom.
  
  - Clips are data: `{ key, length, label, content, attributes }`. Give each a `label` with its place and range, such as "Clip 2 of 5, 0:04.00 to 0:09.20".
  - ← and → move between clips and select, and Home and End go to the first and last, following the reading direction. With `selectionMode="multiple"`, Shift extends the selection, Ctrl or ⌘ moves without changing it, Space adds or removes the focused clip, and Ctrl or ⌘+A selects all; clicks take the same modifiers.
  - The selection is yours, through `selectedKeys` and `onSelectedKeysChange`. A ref gives `focusClip(key)`.
  - The clips' boundaries are snap targets for the playhead and for `useTimelineScale().snap`.
  - When the focused clip is removed, focus goes to the clip that took its place, or the one before, or the playhead.
  
  `Timeline` and `TimelinePlayhead` now measure and size themselves before the first paint, so there's no unsized frame.
  
  It adds seven component tokens, `--hm-timeline-clip-*`. Moving and trimming clips come in a later release.

- [#83](https://github.com/ie-huss-martinez/ui/pull/83) [`07155cc`](https://github.com/ie-huss-martinez/ui/commit/07155cc0687d7b30692bc4f4b286ad9d488c9f66) Thanks [@hussmartinez](https://github.com/hussmartinez)! - `TimelineClips` can now move and trim clips. It reports each edit, and you render the result.
  
  - `onMove(keys, direction)`: Alt+← and Alt+→ (Option on macOS) move the selected clips, or the focused one when it isn't selected, earlier or later. Focus stays with the clip.
  - `onTrim(key, edge, delta)`: Alt+`[` and Alt+`]` shorten a clip at its start or end by `trimStep`, and with Shift lengthen it. Dragging a clip's edge does the same: it snaps to the playhead and the clips' boundaries unless Alt is held, stops at `trimLimits`, shows the new length as it goes, and reports once on release. Escape cancels it.
  - `onTrimToPlayhead(key, edge)`: `[` and `]` set a clip's start or end to the playhead.
  
  **Alt+← and Alt+→ are now always taken while focus is on a clip,** with or without `onMove`, so the browser never goes back or forward instead.
  
  Also render buttons that move and trim the selected clips, with `aria-keyshortcuts`, and offer zoom: the keys and the drag are additions, not the only way.
  
  It adds the component token `--hm-timeline-clip-edge-size`.

- [#80](https://github.com/ie-huss-martinez/ui/pull/80) [`65d3316`](https://github.com/ie-huss-martinez/ui/commit/65d3316d3de5ad0c182ac7e26840cc9d4162e6f6) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Add the first part of a shared timeline for editors of audio and video: `Timeline`, `TimelineLayer`, `TimelinePlayhead` and `useTimelineScale`. The clip track comes in a later release.
  
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

## 0.10.0

### Minor Changes

- [#75](https://github.com/ie-huss-martinez/ui/pull/75) [`02c9dfd`](https://github.com/ie-huss-martinez/ui/commit/02c9dfd95aeb0c1dcd3a4baac4ac1f796612f05d) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Add `ImageIcon`, for an image layer or a tool that adds one. Its `IconName` is `image`.

- [#73](https://github.com/ie-huss-martinez/ui/pull/73) [`afcfef1`](https://github.com/ie-huss-martinez/ui/commit/afcfef19aa5a9d3ca7fbf5d5607db23abd045f7a) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Add `ReorderableList` and `ReorderableListItem`: a list whose items the user selects, reorders and removes, such as layers, tracks or pages, with one Tab stop for the whole list and room for `controls` in each row, such as a visibility toggle. It's a WAI-ARIA grid.
  
  - ↑ and ↓ move between rows and select; with Ctrl or ⌘ they move without selecting. ← and →, Home and End move between a row's cells. Space or Enter selects.
  - Alt+↑ and Alt+↓ (Option on macOS) move the focused item through `onMove(id, toIndex)`, and Delete or Backspace removes it through `onRemove(id)`. You own the order: render the result, and focus stays with the item.
  - Moves are announced through `AnnouncerProvider`, with the new message `reorderableList.moved`; pass `announceMoves={false}` to announce them yourself.
  - Also render buttons that move the selected item, with `aria-keyshortcuts`: the keys are an addition, not the only path.
  
  ```tsx
  <ReorderableList label={t("layers.label")} selectedId={selected} onSelectedChange={select} onMove={move} onRemove={remove}>
    {layers.map((layer) => (
      <ReorderableListItem key={layer.id} id={layer.id} label={layer.name} controls={[<ToggleButton key="visible" … />]}>
        {layer.name}
      </ReorderableListItem>
    ))}
  </ReorderableList>
  ```
  
  It adds eight component tokens, `--hm-reorderable-list-*`.

## 0.9.0

### Minor Changes

- [#68](https://github.com/ie-huss-martinez/ui/pull/68) [`8cb4a5f`](https://github.com/ie-huss-martinez/ui/commit/8cb4a5fe63e38558656cf05320dff72939c28d95) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Add `ColorField`, a colour input that works with the keyboard alone and doesn't use the browser's own colour picker: a hex input (`#rrggbb` or `#rgb`, with or without the `#`) beside a preview, and optional `swatches`, each `{ value, label }`, as a radio group named after the field. Its value is always lowercase `#rrggbb`, through `value` and `onValueChange` or `defaultValue`, and `name` submits it with a form. In a `Field`, it takes the field's label, description and error.
  
  ```tsx
  <Field label={t("shape.fill")}>
    <ColorField value={fill} onValueChange={setFill} swatches={[{ value: "#d92d20", label: t("colors.red") }]} />
  </Field>
  ```
  
  It adds the message `colorField.swatches` and the component tokens `--hm-color-field-gap`, `--hm-color-field-swatch-size`, `--hm-color-field-swatch-radius`, `--hm-color-field-swatch-border-color` and `--hm-color-field-swatch-checked-border-color`. `Field`'s label now has an `id`.

- [#70](https://github.com/ie-huss-martinez/ui/pull/70) [`cd6200f`](https://github.com/ie-huss-martinez/ui/commit/cd6200f2cb39d9ea1e6cfe4736bbcc641911ae42) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Add `TextArea`, a multi-line text input styled like `TextField` and using its tokens, states and density. `rows` sets its height, three by default, and the user can drag it taller. Native textarea props pass through, plus `onValueChange(value)` and `label`; in a `Field`, it takes the field's label, description and error. It adds the component token `--hm-text-area-padding-y`.
  
  ```tsx
  <Field label={t("text.content")}>
    <TextArea value={text} onValueChange={setText} rows={4} />
  </Field>
  ```

## 0.8.0

### Minor Changes

- [#66](https://github.com/ie-huss-martinez/ui/pull/66) [`82f6294`](https://github.com/ie-huss-martinez/ui/commit/82f629465fb16ca53bc517792b03fbf8edceab35) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Add twelve icons, for layer panels, shape tools and page tools: `VisibleIcon`, `HiddenIcon`, `LayersIcon`, `TextIcon`, `RectangleIcon`, `EllipseIcon`, `ArrowIcon`, `RedactIcon`, `DuplicateIcon`, `MoveUpIcon`, `MoveDownIcon` and `PageAddIcon`. Their `IconName`s are `visible`, `hidden`, `layers`, `text`, `rectangle`, `ellipse`, `arrow`, `redact`, `duplicate`, `move-up`, `move-down` and `page-add`.

## 0.7.0

### Minor Changes

- [#60](https://github.com/ie-huss-martinez/ui/pull/60) [`c5871f9`](https://github.com/ie-huss-martinez/ui/commit/c5871f9ec031050e7174a7a69147f40461b4ba7c) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Add `TextField`, a single-line text input of type `text`, `search`, `email`, `url`, `tel` or `password`, styled like the family's other fields. Native input props pass through, so it works controlled or uncontrolled, and `onValueChange` gives the new text. Inside a `Field`, it takes the field's label, description and error, and an error colours its border. Restyle it with the `--hm-text-field-*` tokens.

- [#57](https://github.com/ie-huss-martinez/ui/pull/57) [`ac6a811`](https://github.com/ie-huss-martinez/ui/commit/ac6a811fcb4840d39c7dd6e49c6bbd70ee3e937a) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Add `Tooltip`, for short text about a control. It shows after a short delay on hover, and at once on keyboard focus, never on touch or a mouse click's focus. The pointer can move onto it, and Escape closes it without moving focus or closing a surrounding dialog (WCAG 1.4.13). Wrap one ref-forwarding trigger, such as `IconButton`:
  
  - `type="label"` makes its text the trigger's name, for icon-only buttons; `description`, the default, describes the trigger.
  - `shortcut` takes the parts sdk-core's shortcut registry gives (`registry.describe(toolId)[0]`). It shows them in the platform's notation, ⌘⇧Z or Ctrl+Shift+Z, through the `keys.*` messages, and sets `aria-keyshortcuts` on the trigger.
  
  It renders in the top layer through the Popover API, above the trigger or below it when there's no room, with no positioning library. Restyle it with the `--hm-tooltip-*` tokens. A disabled trigger needs `focusableWhenDisabled`, because a natively disabled button gets no focus or pointer events.

## 0.6.0

### Minor Changes

- [#54](https://github.com/ie-huss-martinez/ui/pull/54) [`ffacdab`](https://github.com/ie-huss-martinez/ui/commit/ffacdab1c3a20fb1415f2928c78aa0051684f0d8) Thanks [@hussmartinez](https://github.com/hussmartinez)! - ui now requires `@hussmartinez/sdk-core` 0.4.1 or a later 0.4 release. In 0.x, ui's previous range, `^0.3.0`, allowed only 0.3 releases, so an application or SDK on sdk-core 0.4 installed two copies of sdk-core, and `instanceof SdkError` failed between them. Upgrade your own `@hussmartinez/sdk-core` to `^0.4.1` too, so `npm ls @hussmartinez/sdk-core` lists one version.

## 0.5.0

### Minor Changes

- [#51](https://github.com/ie-huss-martinez/ui/pull/51) [`89fdf82`](https://github.com/ie-huss-martinez/ui/commit/89fdf824253675c70b901a20753175978a6a8dcf) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Add `usePlatform()`, which returns `"apple"` on macOS, iOS and iPadOS, where `Mod` is ⌘, and `"other"` elsewhere, for shortcut labels and sdk-core's `createShortcutRegistry({ platform })`. It returns `"other"` on the server and during hydration, then switches on Apple devices in the next render, so server-rendered pages hydrate without a mismatch. Use it instead of reading `navigator` during render.

## 0.4.0

### Minor Changes

- [#49](https://github.com/ie-huss-martinez/ui/pull/49) [`266d3e8`](https://github.com/ie-huss-martinez/ui/commit/266d3e8a412e8182f968ceb89ef92ced6f03be2d) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Add nine icons for image and video editing: `FlipHorizontalIcon`, `FlipVerticalIcon`, `CropIcon` and `FitIcon` (zoom to fit, also for contain and cover), and `TrimStartIcon`, `TrimEndIcon` (trim to the playhead), `FadeInIcon`, `FadeOutIcon` and `SnapIcon` (a magnet). Their names join `IconName`, so tools can refer to them as `"flip-horizontal"`, `"fit"`, `"trim-start"` and so on.

## 0.3.0

### Minor Changes

- [#33](https://github.com/ie-huss-martinez/ui/pull/33) [`2af380d`](https://github.com/ie-huss-martinez/ui/commit/2af380d5b7b0a3e6de14a036da244346601905d7) Thanks [@hussmartinez](https://github.com/hussmartinez)! - `FileDropZone` takes `preventStrayDrops`. It defaults to `true`, which keeps today's behaviour: while the zone is mounted, files dropped elsewhere on the page are turned away rather than opened in place of the page. Set it to `false` when your application handles stray drops itself, or embeds the zone in a page whose drag and drop it doesn't own; the zone then adds no listeners to `window`.

- [#38](https://github.com/ie-huss-martinez/ui/pull/38) [`e36a6f2`](https://github.com/ie-huss-martinez/ui/commit/e36a6f2035b39469a608e35e6e91d295470d5d60) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Add ui's icon set: 37 icons generated from Lucide, each a component named after its use in the SDK family, such as `UndoIcon`, `RotateLeftIcon`, `PlayIcon`, `LoopIcon` and `PageGridIcon`. Icons draw with `currentColor`, size to `--hm-icon-size` or to a button's icon slot, are decorative unless given a `label`, and mirror in right-to-left text when they point along the reading direction. Each is its own export, so applications ship only the icons they import. The `IconName` type, exported from both entries, names them for tools; map the names you use to components with `Partial<Record<IconName, IconComponent>>`. Lucide's licences are in the package's `THIRD_PARTY_NOTICES.md`.

- [#35](https://github.com/ie-huss-martinez/ui/pull/35) [`40591a2`](https://github.com/ie-huss-martinez/ui/commit/40591a2585e9cb3d12ee373baa9e50825b046bd8) Thanks [@hussmartinez](https://github.com/hussmartinez)! - ui now warns in development when a second copy of it is in use on the page, naming the versions it found. Two copies don't share providers, so components from one copy miss the other's `UiMessagesProvider` and `AnnouncerProvider`: their text falls back to English, and announcements are lost. Make your application and your SDKs use the same minor version of ui; `npm ls @hussmartinez/ui` shows where each copy comes from. The check runs on first use, never on import, and is skipped in production. The README has a new "Using ui from an SDK" section.

### Patch Changes

- [#37](https://github.com/ie-huss-martinez/ui/pull/37) [`3810f9a`](https://github.com/ie-huss-martinez/ui/commit/3810f9a77126326b4474e8e77eca28823a70902c) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Production bundles no longer carry ui's development-only code: the text of its warnings, the check for a second copy of ui, and `createTheme`'s contrast check with its colour maths. Each is now guarded inline by `process.env.NODE_ENV`, which bundlers replace and fold away. An application that calls `createTheme` ships about 1.5 kB less, compressed, and one using a few components about 0.4 to 0.5 kB less. Behaviour is unchanged: warnings still print in development and never in production, and `checkContrast` still works when you call it.

- [#41](https://github.com/ie-huss-martinez/ui/pull/41) [`454fad6`](https://github.com/ie-huss-martinez/ui/commit/454fad62ab435e222a56dead2a88f9ebda9f920a) Thanks [@hussmartinez](https://github.com/hussmartinez)! - 0.1.0, 0.1.1 and 0.2.0 were published without their built files (`dist/`), so importing them failed. This release is built and checked before publishing: every file that `package.json` points to must be in the tarball. If you're on one of those versions, upgrade.

- [#44](https://github.com/ie-huss-martinez/ui/pull/44) [`737efc6`](https://github.com/ie-huss-martinez/ui/commit/737efc64babecdae1bea30680856556798751949) Thanks [@hussmartinez](https://github.com/hussmartinez)! - ui now requires `@hussmartinez/sdk-core` 0.3.0 or a later 0.3 release. Earlier ui versions accepted sdk-core 0.1, which resolves to 0.1.3: that version, like 0.2.0, was published without its built files, so importing it failed. If your application depends on sdk-core directly, upgrade it to 0.3 too, so there's one copy.

## 0.2.0

### Minor Changes

- [#30](https://github.com/ie-huss-martinez/ui/pull/30) [`21b9310`](https://github.com/ie-huss-martinez/ui/commit/21b93103be6582f99293c01b675313779a30b26b) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Add `Field`, which wires a visible `label`, an optional `description` and an optional `error` to one control: the label names it, the description and error are read with it, and an error marks it `aria-invalid`. `Slider` connects to an enclosing `Field` on its own, so it needs no `label` there. For any other control, pass a function as the children and spread the `FieldControlProps` it receives. Restyle it with the `--hm-field-*` tokens.

- [#32](https://github.com/ie-huss-martinez/ui/pull/32) [`795a48f`](https://github.com/ie-huss-martinez/ui/commit/795a48f486415d938ec2ff695a589f3c1f771fc3) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Add `FileDropZone`, where people choose or drop files. Its button opens the system's file picker and is the keyboard and screen reader path; the zone around it takes dropped files from a pointer, and has `data-hm-dragging` while files are over it, without flickering as they cross its children. `accept` and `multiple` are checked by name, type and count, and dropped folders are turned away: `onFiles` receives the files that pass, and `onFilesRejected` the others, each with a reason. The zone never reads a file or shows its name, so validate contents yourself. While a zone is on the page, a file dropped beside it no longer opens in place of the page. The text comes from the new `fileDropZone.*` messages, and the look from the `--hm-file-drop-zone-*` tokens.

- [#31](https://github.com/ie-huss-martinez/ui/pull/31) [`a4704e2`](https://github.com/ie-huss-martinez/ui/commit/a4704e21a9aaaf1fbb10e126a7e1badd65115b60) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Add `NumberField`, a number typed as text and exposed as a spin button. Typing is committed on blur or Enter and kept within `min` and `max`; text that isn't a number goes back to the last value, so `onValueChange` never receives `NaN`. Arrow Up and Arrow Down move by `step`, Page Up and Page Down by `largeStep`, and Escape throws the typing away. `parse` and `format` default to the `locale`, or `UiMessagesProvider`'s, including its digits and separators; replace them for units or a timecode. With `name`, forms receive the number rather than the formatted text. It connects to an enclosing `Field`, and takes the `--hm-number-field-*` tokens.
  
  Inside a `Field`, `Slider` and `NumberField` now warn in development when they also get a `label` or `aria-label`, which would replace the field's visible label for screen readers.

- [#27](https://github.com/ie-huss-martinez/ui/pull/27) [`ff596a1`](https://github.com/ie-huss-martinez/ui/commit/ff596a116e070ba4155e93fbbb08a3e65a592ad1) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Add `Slider`, for a value in a range such as volume or zoom, on the native `<input type="range">`. Control it with `value` and `onValueChange`, or let it keep its own value from `defaultValue`; `min`, `max`, `step` and `largeStep` set the range and steps. `formatValue` gives screen readers the value as text, such as "−6 dB". The arrow keys, Page Up and Page Down, Home and End work the same in every browser, and the slider is mirrored in right-to-left text. Restyle it with the `--hm-slider-*` tokens.

- [#25](https://github.com/ie-huss-martinez/ui/pull/25) [`f38df72`](https://github.com/ie-huss-martinez/ui/commit/f38df723494e061c0eec9230b15bb995d27b930e) Thanks [@hussmartinez](https://github.com/hussmartinez)! - Add `ToggleButton`, a button that turns something on or off, such as loop playback or the active tool, exposed as `aria-pressed`. Control it with `pressed` and `onPressedChange`, or let it keep its own state from `defaultPressed`. It takes text children, or an `icon` with a required `label`, and works as an item inside `Toolbar`.
  
  Toggle buttons that are on, including `Button` and `IconButton` with `pressed`, now have an accent border as well as a fill, so the state no longer rests on colour alone (WCAG 1.4.11). Change it with the new `--hm-button-pressed-border-color` token.

## 0.1.1

### Patch Changes

- [#22](https://github.com/ie-huss-martinez/ui/pull/22) [`a29a6c6`](https://github.com/ie-huss-martinez/ui/commit/a29a6c6ade511d50129649050aa7630ff7380bfa) Thanks [@hussmartinez](https://github.com/hussmartinez)! - The README now shows how to install the package, which peer dependencies the React components need, and a quick start with the stylesheet, `ThemeProvider` and a `Button`. It no longer says the package isn't published.

## 0.1.0

### Minor Changes

- [#20](https://github.com/ie-huss-martinez/ui/pull/20) [`f0c6ad3`](https://github.com/ie-huss-martinez/ui/commit/f0c6ad30c0ec7a4a571ab4ef96219da17ce55e17) Thanks [@hussmartinez](https://github.com/hussmartinez)! - First release of `@hussmartinez/ui`, the design system of the `@hussmartinez` SDK family: design tokens, themes, base styles and accessible React components. It's ESM only, with three entry points: `@hussmartinez/ui` (server-safe), `@hussmartinez/ui/react` and `@hussmartinez/ui/styles.css`.
  
  - **Tokens:** base, semantic and component tokens as `--hm-*` custom properties. The built-in light and dark themes meet WCAG 2.2 AA contrast and follow the system preference in pure CSS. `data-hm-theme` and `data-hm-density` change any subtree.
  - **Custom themes:** `createTheme` validates every value against an allowlist, so values from users can't inject CSS, and warns in development about contrast below AA; `checkContrast` returns the same report. Apply themes with `ThemeProvider`, which renders on the server, or as a static stylesheet with `themeToCss`, for strict Content Security Policies. Invalid themes throw `UiError` with `INVALID_THEME_TOKEN` or `INVALID_THEME_SELECTOR`.
  - **Components:** `Button`, `IconButton`, `Toolbar` with `ToolbarGroup` and `ToolbarSeparator`, `SegmentedControl`, `Dialog`, `Spinner`, `ProgressBar`, `VisuallyHidden`, and `AnnouncerProvider` with `useAnnounce`. Each takes `className`, `classNames` per part and `unstyled`, forwards its ref, renders on the server, and works with the keyboard and screen readers.
  - **Text:** components take text props, falling back to `UiMessagesProvider`, which accepts your sdk-core message catalogue; `uiMessages` has the English text.
