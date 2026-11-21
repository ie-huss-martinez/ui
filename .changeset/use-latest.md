---
"@hussmartinez/ui": patch
---

Add `useLatest(value)` to `@hussmartinez/ui/react` (sdk-core ADR 0063). It returns a ref whose `current` is the latest committed `value`, for an effect or an event handler that must call the newest version of a prop, such as a callback, without re-subscribing when it changes.

Use it instead of writing a ref while rendering, `latest.current = onChange`, which React's purity rules forbid and `hm-lint-react` reports. Replace the assignment and its ref with `const latest = useLatest(onChange)`, and keep reading `latest.current` in effects and handlers.

The ref updates in an insertion effect, during the commit and before any layout effect, so a child's layout effect and an event handler fired right after a commit both read the latest value. It renders on the server without warnings on React 18.3 and 19.

For the SDKs: each uses `useLatest` in place of its render-time ref writes, as it fixes its `refs` findings under ADR 0063.
