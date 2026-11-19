---
"@hussmartinez/ui": minor
---

`Slider` cancels a gesture with Escape. During a drag, or while a key is held, Escape puts the value back where the gesture started, through `onValueChange`, commits nothing, and calls the new `onValueCancel(value)` with that value. The rest of the gesture is ignored: the thumb doesn't follow the pointer back, and a held key doesn't start again until it's let go. Escape with no gesture in progress is left alone, so it still closes a containing `Dialog`; Escape that cancels a gesture doesn't. If you tracked cancellation yourself to keep one undo step per gesture, you can use `onValueCancel` instead.
