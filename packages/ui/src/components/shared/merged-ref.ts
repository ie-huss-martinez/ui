import { type ForwardedRef, type RefObject, useCallback, useRef } from "react";

/** Gives a ref the node, whichever kind of ref the host passed. */
function assignRef<T>(ref: ForwardedRef<T>, node: T | null): void {
  if (typeof ref === "function") {
    ref(node);
  } else if (ref) {
    ref.current = node;
  }
}

/**
 * A component's own ref to its element, merged with the ref its host
 * forwarded: attach the callback to the element, and read the element from
 * the returned ref in effects and handlers. Both refs are set when React
 * attaches or detaches the element, never while rendering.
 */
export function useMergedRef<T>(
  forwarded: ForwardedRef<T>,
): readonly [RefObject<T | null>, (node: T | null) => void] {
  const local = useRef<T | null>(null);
  const setRef = useCallback(
    (node: T | null) => {
      local.current = node;
      assignRef(forwarded, node);
    },
    [forwarded],
  );
  return [local, setRef];
}
