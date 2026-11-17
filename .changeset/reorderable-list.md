---
"@hussmartinez/ui": minor
---

Add `ReorderableList` and `ReorderableListItem`: a list whose items the user selects, reorders and removes, such as layers, tracks or pages, with one Tab stop for the whole list and room for `controls` in each row, such as a visibility toggle. It's a WAI-ARIA grid.

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
