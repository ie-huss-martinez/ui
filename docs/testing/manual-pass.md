# Manual pass: ReorderableList and Timeline

[ADR 0009](../adr/0009-reorderable-list.md) (`ReorderableList`) and [ADR 0011](../adr/0011-timeline.md) (`Timeline`) stay Proposed until two checks that no automated test can make:

- **Alt with an arrow key in real browsers.** Chrome and Firefox on Windows and Linux use Alt+← and Alt+→ for Back and Forward. The automated browsers have no Back button, so the tests can only show that the key's default is prevented, not that a real browser stays on the page.
- **A screen-reader pass.** Nobody has heard these components yet. The design assumes a screen reader passes the arrow keys through to a `grid` and a `listbox` without being told to, and that a timeline with lanes makes sense spoken.

This is a script for a person. It takes about 20 minutes: 5 for the keys, 5 for each NVDA browser and 5 for VoiceOver. Each step has a pass condition. Record what you find as described at the end, and the records are then amended and accepted in one pull request.

## Setting up

On the machine you test on, with Node 24 or later:

```sh
pnpm install
pnpm build
pnpm --filter @hussmartinez/ui-catalogue dev
```

To test from another machine, add `--host 0.0.0.0` to the last command and use this machine's address instead of `localhost`.

**Open the stories on their own, not inside Storybook.** Storybook's interface uses Alt with the arrow keys to switch stories, and it would hide what the component does. Use these addresses:

| Story | Address |
|---|---|
| List | <http://localhost:6006/iframe.html?id=components-reorderablelist--default&viewMode=story> |
| Moving clips | <http://localhost:6006/iframe.html?id=components-timeline--moving-clips&viewMode=story> |
| Lanes | <http://localhost:6006/iframe.html?id=components-timeline--lanes&viewMode=story> |

Reload the page before each part so the story starts in its first state. Use the keyboard only.

## Part 1: Alt and the arrow keys (Chrome, then Firefox, on Windows or Linux)

No screen reader for this part. Give each story some history in both directions first, so Back and Forward would leave the page if the component didn't stop them. In one tab:

1. open any other page, such as <http://localhost:6006/>;
2. open the story's address;
3. open another page;
4. press Back once, to return to the story.

Then zoom the page to 400% with Ctrl and +, so it can scroll.

**Moving clips.** The first state has two lanes, voice and music. voice-2 is selected.

| Do | Pass if |
|---|---|
| Press Tab until voice-2 has focus. Press Alt+← three times. | voice-2 moves earlier each time. The address and the page stay the same. |
| Press Alt+→ three times. | voice-2 moves later each time. The address and the page stay the same. |
| Press ← to focus voice-1. Hold Alt and press ← until it stops moving, then twice more. | voice-1 stops at the start of the track. The page stays, including on the presses that move nothing. |
| Focus voice-2. Press Alt+↓. | voice-2 moves to the music lane and keeps focus. The page doesn't scroll. |
| Press Alt+↓ again. | voice-2 stays, because there's no lane below. The page doesn't scroll. |
| Press Alt+↑ twice. | voice-2 moves back to the voice lane, then stays. The page doesn't scroll. |

**List.** Photo is selected.

| Do | Pass if |
|---|---|
| Tab into the list. Press Alt+↑ until Photo is first, then twice more. | Photo moves up, then stays. The page doesn't scroll, and the address doesn't change. |
| Press Alt+↓ until Photo is last, then twice more. | Photo moves down, then stays. The page doesn't scroll. |

Fail if anything goes back or forward, the page scrolls, or a key does nothing on the component. Note which browser, story and key.

## Part 2: NVDA, with Firefox and then with Chrome (Windows)

Start NVDA, then the browser. Don't switch modes yourself unless a step says to: whether NVDA switches to focus mode by itself is part of the check. Wording varies between screen readers, so "selected", "checked" and "pressed" all count. What matters is the meaning in the middle column.

**List.**

| Do | Expect to hear | Pass if |
|---|---|---|
| Tab from the top of the page into the list. | The grid "Layers", then "Photo", selected, with its row (2 of 4). | NVDA is now in focus mode: the next keys reach the list. |
| Press ↓, then ↑ twice. | "Shape", selected; "Photo", selected; "Title", selected. | Each row is read, and the selection follows. |
| Press Ctrl+↓. | "Photo", not selected. | Focus moves without selecting. |
| Press →. | "Show Photo", toggle button, pressed. | The control in the row is reached. |
| Press Space, then Space again. | Not pressed, then pressed. | Photo's eye icon changes each time. |
| Press ←, then ↓ to Shape. Press Alt+↓. | "Shape moved to position 4 of 4". | The move is announced, and focus stays on Shape. |
| Press Alt+↑. | "Shape moved to position 3 of 4". | |
| Press Delete. | "Background", selected. | Shape is gone, and focus is on the row now at its place. |
| Press Tab. | "Move up" button, with its shortcut Alt+Up Arrow. | The buttons name their keys. |

**Lanes.** In this story, Music 1 is selected and the Effects track is muted.

| Do | Expect to hear | Pass if |
|---|---|---|
| Tab from the top of the page. | The region "Timeline", then "Playhead", slider, 3.33 seconds. | |
| Press → twice. | The playhead's time, larger each time. | |
| Tab. | The group "Track 1, Voice", the toolbar "Track 1, Voice", then "Mute", toggle button, not pressed. | |
| Press →. | "Voice gain", slider, 0 decibels. | Focus moves along the toolbar. **If NVDA stays in browse mode here, → reads the page instead.** Note it: it's the risk image-sdk#67 describes. |
| Tab. | The list "Voice clips", then "Voice 1, clip 1 of 3", not selected. | NVDA is in focus mode in the clips. |
| Press →. | "Voice 2, clip 2 of 3". | |
| Press ↓. | The group "Track 2, Music", then the Music clip nearest in time. | Focus moves to the lane below, and the new lane is named. |
| Press ↓ again. | "Track 3, Effects, muted", then an Effects clip. | The lane's state is heard. |
| Press Space. | That clip, selected. | |
| Press Insert+Space, then ↓ and ↑ a few times (browse mode). | The lanes, their headers and their clips, read as a page. | The structure makes sense to read. Note anything read twice or out of order. Press Insert+Space again to go back to focus mode. |

**Moving clips.** Without restarting NVDA.

| Do | Expect to hear | Pass if |
|---|---|---|
| Press Tab until you reach the clips. | "voice-2, from 4.00 seconds", selected. | |
| Press Alt+←. | Possibly "voice-2, from 3.83 seconds". | The clip moves, and focus stays on it. **This story doesn't announce moves itself,** so silence isn't a failure, but note it, because the SDKs announce in their own words. |
| Press Alt+↓. | Possibly the music lane's name. | The clip moves to the music lane, and focus stays on it. |

Then do the three tables again with Chrome.

## Part 3: VoiceOver with Safari (macOS)

Turn on Safari › Settings › Advanced › "Press Tab to highlight each item on a webpage", or Tab skips the buttons. Turn VoiceOver on with ⌘F5. Use Tab and the arrow keys as below, not the VoiceOver cursor (Control+Option with the arrow keys). Quick Nav must be off, or VoiceOver keeps the arrow keys for itself; press ← and → together to turn it off. Alt is Option, Ctrl is ⌘, and Delete is the Delete key, which other keyboards call Backspace.

Do the **List** and **Lanes** tables from Part 2, without the browse-mode step, which is NVDA's. VoiceOver has no browse mode, so the keys should reach the components without any switching.

Then check what's Safari's own. With the page zoomed to 400% (⌘+), Option+↑ and Option+↓ on a clip or a row must not scroll the page.

## Doing learn-sdk's pass in the same session

learn-sdk's player needs its own pass, which is due because 0.2.1 has shipped it ([its script](https://github.com/ie-huss-martinez/learn-sdk/blob/main/docs/testing/screen-reader-pass.md)). It fits the same session: it uses the same readers and browsers, VoiceOver with Safari and NVDA with Firefox or Chrome. Its example runs on port 4340, and the catalogue runs on 6006, so both can be served together. Do this pass first, then learn-sdk's for each reader while it's running. Its pass needs a Thai voice installed, and its results go in learn-sdk's release pull request, not here.

## Recording the result

For each part, write down:

- the operating system, browser and screen reader, with versions;
- for each table, "as expected", or the step and what happened instead;
- anything confusing, even where it passed.

Send it to whoever writes the pull request that accepts the records. That pull request amends ADR 0009 and ADR 0011 with what was found and changes their status to Accepted, or opens an issue for each failure and leaves them Proposed.
