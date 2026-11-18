---
"@hussmartinez/ui": patch
---

`ReorderableList` now selects the row whose item receives focus however focus arrives: by Tab, a click, or your own `focus()`, as well as the arrow keys. Before, Tab onto a list with nothing selected focused the first row without selecting it, so tools acting on the selected row stayed disabled until an arrow key was pressed. `onSelectedChange` is called only on a real focus, and only when the selection changes. Focus on a row's control still never changes the selection, and Ctrl or ⌘ with an arrow still moves without selecting. It now behaves as `TimelineClips` does in single selection.
