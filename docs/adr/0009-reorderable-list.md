# 0009. A reorderable list: a grid of rows with one Tab stop

- **Status:** Proposed
- **Date:** 2026-11-17

## Context

Two SDKs have a list whose items the user selects, reorders and removes:

- **image-sdk's layers panel** ([image-sdk#75](https://github.com/ie-huss-martinez/image-sdk/pull/75)) is a list of buttons today, because `ui` has nothing better. Each row has a button that selects the layer and one that shows or hides it, so every layer is two Tab stops, and a document with twenty layers puts forty stops before the fields below the list.
- **pdf-sdk's thumbnails** are a listbox the SDK wrote itself. Its [ADR 0008](https://github.com/ie-huss-martinez/pdf-sdk/blob/main/docs/adr/0008-page-organisation-in-the-editor.md) chose the keys for moving and deleting pages, checked them against every browser's and system's shortcuts, and set the rules for focus afterwards.

audio-sdk's and video-sdk's track lists will need the same. The decisions in pdf-sdk's record aren't about PDFs, so they belong in `ui`, once.

The component has to give:

- **One Tab stop for the whole list,** however many rows it has.
- **A control in each row,** such as a visibility toggle, reachable by keyboard.
- **Reordering without a pointer and without dragging** (WCAG 2.1.1 and 2.5.7), on keys that no browser or system takes.
- **Focus that keeps its place** after a move or a removal, and never falls to the body.
- **Screen readers that pass the keys through.** In a document's ordinary reading mode, NVDA and JAWS keep the arrow keys for themselves. Only a composite widget role switches them to the mode that sends keys to the page.

## Decision

### The pattern: a grid, not a listbox

`ReorderableList` is a WAI-ARIA **grid** with one column of rows, as in the Authoring Practices' layout grid examples.

- **A listbox can't hold the row's control.** An option's descendants are presentational, so a toggle inside one isn't exposed as a toggle. That's why image-sdk fell back to buttons.
- **A grid can.** Each row is a `row` with `aria-selected`. Its first cell is the row itself: its content and its accessible name. Each further cell holds exactly one control.
- **A grid is a composite widget,** so screen readers send it the arrow keys, and it has one Tab stop by definition.

```html
<div role="grid" aria-label="Layers" class="hm-reorderable-list">
  <div role="row" aria-selected="true" class="hm-reorderable-list-row">
    <div role="gridcell" tabindex="0" class="hm-reorderable-list-item">Title</div>
    <div role="gridcell" class="hm-reorderable-list-control">
      <button aria-pressed="true" aria-label="Visible" tabindex="-1">…</button>
    </div>
  </div>
  …
</div>
```

### The API

```tsx
<ReorderableList
  label={t("layers.label")}
  selectedId={selected}
  onSelectedChange={select}
  onMove={(id, toIndex) => session.moveLayer(id, toIndex)}
  onRemove={(id) => session.deleteLayer(id)}
>
  {layers.map((layer) => (
    <ReorderableListItem
      key={layer.id}
      id={layer.id}
      label={layer.name}
      controls={[
        <ToggleButton key="visible" label={t("layers.visible")} icon={<VisibleIcon />} … />,
      ]}
    >
      <LayerPreview layer={layer} /> {layer.name}
    </ReorderableListItem>
  ))}
</ReorderableList>
```

- **The host owns the order.** The list never reorders anything itself: it calls `onMove(id, toIndex)`, and the host renders the items in the new order, or doesn't, when the move isn't allowed. The same goes for `onRemove`. Both are optional; without `onMove` the list is a plain selectable list with row controls.
- **Order is the order shown.** "Up" is towards the first row. image-sdk shows the top layer first, so up the list is up the stack; that mapping is the host's.
- **`label` on an item is required** and is the row's accessible name, because its content can be anything, such as a thumbnail.
- **One row is selected, or none.** Several at once, as pdf-sdk's thumbnails have, is a later addition (see below).
- **The component contract applies** ([ADR 0003](0003-component-contract.md)): `className`, `classNames` for `root`, `row`, `item` and `control`, `unstyled`, refs, and component tokens with semantic fallbacks.

### Keys

They work only while focus is inside the list, and never when the target is a text field. Every key the list handles has its default prevented, **including a move at the first or last row,** so the page never scrolls instead. image-sdk measured that: Chromium on Linux scrolls the page for Alt with ↑ or ↓.

| Key | Action |
|---|---|
| ↑ / ↓ | Focus the same cell in the previous or next row, and select that row |
| ← / → | Focus the previous or next cell in the row, following the reading direction |
| Home / End | Focus the row's first or last cell |
| Ctrl+Home / Ctrl+End (⌘ on macOS) | Focus the first or last row, and select it |
| Space or Enter, on a row's first cell | Select the row |
| Space or Enter, on a control | The control's own action |
| **Alt+↑ / Alt+↓** (Option on macOS) | Move the focused row up or down one place |
| **Delete, Backspace** | Remove the focused row, when the host passes `onRemove` |

- **The move and remove keys are pdf-sdk ADR 0008's,** with its table of what each browser and system reserves. This record doesn't repeat that check; it adopts the result. There is no key to move to the start or end, for that record's reason: Alt+Home opens the home page in Chrome and Firefox.
- **Selection follows focus between rows,** as in a single-selection listbox and in pdf-sdk's thumbnails, so an editor's stage shows the row the user is on.
- **A pointer press on a row selects it;** a press on a control only acts on the control.

### Focus

- **The Tab stop** is the cell that last had focus; before that, the selected row's first cell; with no selection, the first row's. The controls inside rows are taken out of the Tab order by the list, the way `Toolbar` manages its items, so the server renders no `tabindex` on them and hydration can't mismatch.
- **After a move,** focus stays on the same cell of the moved row.
- **After a removal,** focus goes to the same cell of the row now at that position, or of the new last row. When the list becomes empty, the host decides where focus goes, because only it knows what's next to the list.
- **Focus is restored only after a real change, and only if it was dropped or is still in the list.** image-sdk found the bug this rule prevents: a move key at the top set "put focus back", nothing rendered, and the next render pulled focus from wherever the user had gone.
- **A control that can't act stays focusable,** with `aria-disabled`, as `focusableWhenDisabled` does for buttons, so arrowing along a column never skips a row.

### Announcements

Moving a row doesn't move focus, so a screen reader says nothing by itself. After the host renders the new order, the list announces it through `ui`'s announcer, with the new message `reorderableList.moved`: "{label} moved to position {position} of {count}". A move the host refused isn't announced.

`announceMoves={false}` turns that off for a host that announces in its own words, as pdf-sdk does ("Moved 1 page to position 3."). Removal isn't announced by the list: focus lands on another row, which is read out, and the host knows what was removed.

### The path that always works

The keys are an addition. **A host that passes `onMove` must also offer buttons that move the selected row,** as pdf-sdk's toolbar and image-sdk's panel do, with `aria-keyshortcuts` naming the keys. They're the path for touch, for switch access and for users who don't know the keys. The list doesn't render them itself, because where they go, and what they're called, is the editor's design. The README says so, and the stories show it.

### Tests

As pdf-sdk ADR 0008 requires of its listbox, on Chromium, Firefox and WebKit:

- **Every key in the table** does its action and has its default prevented, including the move keys at both ends.
- **The page neither scrolls nor navigates:** the test page is taller than the window and has a history entry behind it.
- **A key typed in a text field does nothing,** and nor does a key with another modifier.
- **Focus** after each move and removal, the stale-restore case above, and one Tab stop into and out of the list.
- **axe** on every story, and the end-to-end examples with a role locator next to it.

### Later, as additions

- **Several selected rows,** with Shift and Ctrl or ⌘ as in pdf-sdk's thumbnails, through a `selectionMode` prop. pdf-sdk can adopt the list then.
- **Dragging,** with pointer events, an insertion line, one `onMove` per drop and Escape to cancel. It adds no new callback, so hosts get it without changing code.
- **A horizontal list,** for thumbnails in a strip.

## Alternatives considered

- **A listbox with the controls beside it,** each option paired with a button outside the listbox: the control isn't part of its row for a screen reader, and it's a Tab stop of its own again.
- **A plain list with a roving Tab stop,** as `Toolbar` has: `list` isn't a widget role, so NVDA and JAWS keep the arrow keys in reading mode and the list's keys never arrive.
- **A tree:** it adds expanding and levels that a flat list doesn't have, and its items can't hold controls either.
- **A "grab" mode,** where Space picks a row up and the arrows carry it: rejected in pdf-sdk ADR 0008. Space already selects, and a mode is easy to get lost in.
- **The list reordering its own state:** it would hide a refused move, and editors keep order in a document model with undo, not in a component.
- **Rendering the move buttons inside each row:** two more cells in every row, mostly repeating each other, when one pair acting on the selection does the same.

## Consequences

- image-sdk's layers panel goes from two Tab stops a layer to one for the list, and the track lists get the same keys and focus rules as pdf-sdk's pages.
- **A grid is announced as a table by some screen readers,** with "row 2 of 5" rather than "2 of 5". That's the accepted cost of rows that hold controls.
- **This design hasn't been tried with a real screen reader.** The claim that a grid receives these keys comes from the Authoring Practices and from pdf-sdk's record for a listbox. The browser tests can't check it. NVDA with Firefox and Chrome, and VoiceOver with Safari, need a manual pass before the status changes to Accepted, and the record is amended with what they find.
- The React entry is at 14.43 kB of 15 kB, so the pull request that adds the list raises the budget from its measurement.
- A row's controls are limited to one control per cell. A text field in a row, for renaming in place, needs an editing mode (Enter or F2 to edit, Escape to leave) and its own record.
