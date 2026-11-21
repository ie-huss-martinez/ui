import { act, useEffect, useLayoutEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanUp, mount } from "../test/dom.js";
import { useLatest } from "./use-latest.js";

let root: Root | undefined;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => root?.unmount());
  root = undefined;
  cleanUp();
});

/**
 * The pattern `useLatest` must beat: the ref updated in a passive effect.
 * The tests run it too, and expect it to read the old value, so they show
 * they can tell the timings apart.
 */
function usePassiveLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

type UseRef = <T>(value: T) => { readonly current: T };

/** Records what its layout effect reads from the parent's ref, on every commit. */
function Child({ latest, seen }: { latest: { readonly current: number }; seen: number[] }) {
  useLayoutEffect(() => {
    seen.push(latest.current);
  });
  return null;
}

function Parent({ value, seen, use }: { value: number; seen: number[]; use: UseRef }) {
  const latest = use(value);
  return <Child latest={latest} seen={seen} />;
}

/**
 * Calls the latest `onPress` from a native listener attached once. With
 * `onCommitted`, it hands its button over right after the commit: from a
 * microtask its layout effect queues, which runs once the commit's task ends
 * and before React's next task, where a normal update's passive effects run.
 */
function Pressable({
  onPress,
  use,
  onCommitted,
}: {
  onPress: () => void;
  use: UseRef;
  onCommitted?: (button: HTMLButtonElement) => void;
}) {
  const latest = use(onPress);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = button.current as HTMLButtonElement;
    const listener = () => latest.current();
    element.addEventListener("click", listener);
    return () => element.removeEventListener("click", listener);
  }, [latest]);
  useLayoutEffect(() => {
    if (onCommitted) {
      const element = button.current as HTMLButtonElement;
      queueMicrotask(() => onCommitted(element));
    }
  });
  return (
    <button ref={button} type="button">
      Press
    </button>
  );
}

/**
 * Renders `Pressable` with a first handler, then updates it to a second at
 * normal priority, outside act, and clicks right after that commit, while
 * its passive effects are still pending. Returns the handlers called.
 */
async function pressRightAfterCommit(use: UseRef): Promise<string[]> {
  const calls: string[] = [];
  const container = mount("");
  act(() => {
    root = createRoot(container);
    root.render(<Pressable onPress={() => calls.push("first")} use={use} />);
  });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  await new Promise<void>((resolve) => {
    root?.render(
      <Pressable
        onPress={() => calls.push("second")}
        use={use}
        onCommitted={(button) => {
          button.click();
          resolve();
        }}
      />,
    );
  });
  return calls;
}

/** Records the ref `useLatest` returns on each render. */
function Probe({ value, refs }: { value: number; refs: unknown[] }) {
  refs.push(useLatest(value));
  return null;
}

describe("useLatest", () => {
  it("is read with the latest value by a child's layout effect", () => {
    const seen: number[] = [];
    const container = mount("");
    act(() => {
      root = createRoot(container);
      root.render(<Parent value={1} seen={seen} use={useLatest} />);
    });
    act(() => root?.render(<Parent value={2} seen={seen} use={useLatest} />));
    act(() => root?.render(<Parent value={3} seen={seen} use={useLatest} />));
    expect(seen).toEqual([1, 2, 3]);
  });

  it("is read with the latest value by a handler fired right after a commit, before passive effects", async () => {
    expect(await pressRightAfterCommit(useLatest)).toEqual(["second"]);
  });

  it("returns the same ref on every render", () => {
    const refs: unknown[] = [];
    const container = mount("");
    act(() => {
      root = createRoot(container);
      root.render(<Probe value={1} refs={refs} />);
    });
    act(() => root?.render(<Probe value={2} refs={refs} />));
    expect(refs).toHaveLength(2);
    expect(refs[0]).toBe(refs[1]);
  });
});

describe("a ref updated in a passive effect, for comparison", () => {
  it("is read with the previous value by a child's layout effect", () => {
    const seen: number[] = [];
    const container = mount("");
    act(() => {
      root = createRoot(container);
      root.render(<Parent value={1} seen={seen} use={usePassiveLatest} />);
    });
    act(() => root?.render(<Parent value={2} seen={seen} use={usePassiveLatest} />));
    expect(seen).toEqual([1, 1]);
  });

  it("is read with the previous value by a handler fired right after a commit", async () => {
    expect(await pressRightAfterCommit(usePassiveLatest)).toEqual(["first"]);
  });
});
