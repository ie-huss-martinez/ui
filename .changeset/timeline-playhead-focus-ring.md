---
"@hussmartinez/ui": patch
---

The `Timeline`'s playhead now shows its whole focus ring. The timeline scrolls, and a scrolling box clips what's drawn outside it, so the thumb's ring lost its top edge, and at the first or last unit its outer side too. The slider's row is now tall enough for the thumb and its ring, and the timeline keeps room for the ring past each end. A timeline is a few pixels taller where the thumb and ring are larger than the target size, and its track is a few pixels narrower. Nothing changes in the API.
