---
"@hussmartinez/ui": patch
---

`TimelineClips` with `selectionMode="single"` now keeps the selection on the focused clip however focus arrives, as its documentation said: by Tab, a click, your own `focus()`, or `focusClip`, as well as the arrow keys. Before, a clip reached by Tab or `focusClip` was focused but not selected, so tools acting on the selected clip stayed disabled until an arrow key was pressed. `onSelectedKeysChange` is called only on a real focus, and only when the selection changes, so a controlled host doesn't loop. Ctrl or ⌘ with an arrow still moves focus without selecting, and `selectionMode="multiple"` is unchanged.

If you selected the focused clip yourself in an `onFocus` handler, you can remove it.
