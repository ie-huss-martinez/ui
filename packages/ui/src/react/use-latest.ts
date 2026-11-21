import { useInsertionEffect, useRef } from "react";

/**
 * A ref that holds the latest `value`, for an effect or an event handler that
 * must call the newest version of a prop without re-subscribing when it
 * changes (sdk-core ADR 0063).
 *
 * It replaces writing the ref while rendering, `latest.current = onChange`,
 * which React's rules forbid: a render can be thrown away, and the ref would
 * then hold a value that was never committed.
 *
 * **When it updates is part of its contract.** The ref takes each committed
 * value in an insertion effect, during the commit and before any layout
 * effect. So a child's layout effect, and an event handler that fires right
 * after a commit, both read the latest value; a passive effect would be too
 * late for either. It renders on the server without warnings, on every React
 * `ui` supports.
 *
 * Read `.current` in effects and event handlers, never while rendering, and
 * don't write it. On React 19.2 and later, a function called only from
 * effects can be an Effect Event instead; one that an event handler calls
 * keeps this hook.
 *
 * @example
 * ```tsx
 * function useWindowKey(key: string, onKey: (event: KeyboardEvent) => void): void {
 *   const latest = useLatest(onKey);
 *   useEffect(() => {
 *     const listener = (event: KeyboardEvent) => {
 *       if (event.key === key) {
 *         latest.current(event);
 *       }
 *     };
 *     window.addEventListener("keydown", listener);
 *     return () => window.removeEventListener("keydown", listener);
 *   }, [key, latest]);
 * }
 * ```
 *
 * @param value - The value to keep, such as a callback prop.
 * @returns A ref whose `current` is the last committed `value`. It's the
 *   same object on every render.
 *
 * @public
 */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  useInsertionEffect(() => {
    ref.current = value;
  });
  return ref;
}
