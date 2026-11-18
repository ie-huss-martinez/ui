---
"@hussmartinez/ui": patch
---

A focused control inside a `Dialog`'s body now shows its whole focus ring. The body scrolls, and a scrolling box clips what's drawn outside it, so a field as wide as the body, or at its end, showed its ring along one edge only. The body now keeps room for a ring at every edge, and its content stays where it was. Nothing changes in the API.
