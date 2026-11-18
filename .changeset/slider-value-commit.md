---
"@hussmartinez/ui": minor
---

`Slider` gains `onValueCommit(value)`, called once when a gesture that changed the value ends, with the value it ended on:

- when the pointer is let go, after a drag or a click on the track, wherever the pointer is by then;
- when the last key held is let go, however many times it repeated;
- when the slider loses focus before that.

A gesture that leaves the value where it was calls nothing. Use it for what should happen once per gesture, such as an undo step, and `onValueChange` for what follows the value as it moves:

```tsx
<Slider label={t("track.gain")} value={gain} onValueChange={preview} onValueCommit={(db) => session.setGain(track, db)} />
```
