import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { cleanUp, loadStyles, mount, track } from "../../test/dom.js";
import { Timeline, type TimelineScale, useTimelineScale } from "./Timeline.js";
import {
  type TimelineClip,
  type TimelineClipEdge,
  TimelineClips,
  type TimelineClipsProps,
} from "./TimelineClips.js";
import { TimelinePlayhead } from "./TimelinePlayhead.js";

let root: Root | undefined;

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await loadStyles();
});
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  cleanUp();
  vi.restoreAllMocks();
  window.scrollTo(0, 0);
});

function render(element: React.ReactElement): HTMLElement {
  const container = mount("");
  act(() => {
    root = createRoot(container);
    root.render(element);
  });
  return container;
}

/** Five clips of 60 frames: boundaries at 60, 120, 180, 240 and 300. */
const five = (): TimelineClip[] =>
  Array.from({ length: 5 }, (_, index) => ({
    key: `c${index + 1}`,
    length: 60,
    label: `Clip ${index + 1} of 5`,
    content: `Clip ${index + 1}`,
  }));

let scale: TimelineScale;
function Probe() {
  scale = useTimelineScale();
  return null;
}

interface Options {
  readonly first?: readonly string[];
  readonly dir?: "ltr" | "rtl";
  readonly zoom?: number;
  readonly playhead?: number;
  readonly snapping?: boolean;
  readonly readOnly?: boolean;
  readonly refuse?: boolean;
  readonly start?: TimelineClip[];
  readonly spies?: Pick<TimelineClipsProps, "onMove" | "onTrim" | "onTrimToPlayhead">;
  readonly trimStep?: number;
  readonly trimLimits?: TimelineClipsProps["trimLimits"];
}

/** An editor that applies what the track reports, as a session would. */
function Fixture({
  first = ["c2"],
  dir = "ltr",
  zoom,
  playhead = 0,
  snapping,
  readOnly = false,
  refuse = false,
  start,
  spies = {},
  trimStep,
  trimLimits,
}: Options) {
  const [clips, setClips] = useState(start ?? five);
  const [selected, setSelected] = useState(first);
  const [frame, setFrame] = useState(playhead);
  const length = clips.reduce((sum, clip) => sum + clip.length, 0);

  const move = (keys: readonly string[], direction: -1 | 1): void => {
    spies.onMove?.(keys, direction);
    if (refuse) {
      return;
    }
    setClips((order) => {
      const moving = order.filter((clip) => keys.includes(clip.key));
      const rest = order.filter((clip) => !keys.includes(clip.key));
      const at = order.findIndex((clip) => clip.key === keys[0]);
      const before = order.slice(0, at).filter((clip) => !keys.includes(clip.key)).length;
      const to = Math.min(Math.max(before + direction, 0), rest.length);
      return [...rest.slice(0, to), ...moving, ...rest.slice(to)];
    });
  };
  const trim = (key: string, edge: TimelineClipEdge, delta: number): void => {
    spies.onTrim?.(key, edge, delta);
    setClips((all) =>
      all.map((clip) =>
        clip.key === key ? { ...clip, length: Math.max(1, clip.length + delta) } : clip,
      ),
    );
  };

  return (
    <div dir={dir} style={{ inlineSize: "600px" }}>
      <Timeline label="Timeline" length={length} zoom={zoom} snapping={snapping}>
        <Probe />
        <TimelineClips
          label="Clips"
          clips={clips}
          selectionMode="multiple"
          selectedKeys={selected}
          onSelectedKeysChange={setSelected}
          onMove={readOnly ? undefined : move}
          onTrim={readOnly ? undefined : trim}
          onTrimToPlayhead={readOnly ? undefined : spies.onTrimToPlayhead}
          trimStep={trimStep}
          trimLimits={trimLimits}
        />
        <TimelinePlayhead label="Playhead" position={frame} onPositionChange={setFrame} />
      </Timeline>
      <input type="text" aria-label="Name" />
    </div>
  );
}

const clip = (container: HTMLElement, key: string) =>
  container.querySelector(`[data-hm-key="${key}"]`) as HTMLElement;
const order = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[role="option"]')].map(
    (element) => element.dataset["hmKey"],
  );
const widths = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[role="option"]')].map((element) =>
    Math.round(element.getBoundingClientRect().width / scale.pixelsPerUnit),
  );
const focused = () => (document.activeElement as HTMLElement | null)?.dataset["hmKey"];
const edge = (container: HTMLElement, key: string, side: TimelineClipEdge) =>
  clip(container, key).querySelector(`[data-hm-edge="${side}"]`) as HTMLElement;

/** Presses keys, and reports whether the last one's default was prevented and the page scrolled. */
async function press(keys: string): Promise<{ prevented: boolean; scrolled: boolean }> {
  if (!document.querySelector("[data-tall]")) {
    const tall = track(document.createElement("div"));
    tall.dataset["tall"] = "";
    tall.style.height = "300vh";
    document.body.append(tall);
  }
  window.scrollTo(0, 0);
  let prevented = false;
  const seen = (event: KeyboardEvent) => {
    prevented = event.defaultPrevented;
  };
  window.addEventListener("keydown", seen);
  await userEvent.keyboard(keys);
  window.removeEventListener("keydown", seen);
  await new Promise((resolve) => setTimeout(resolve, 100));
  return { prevented, scrolled: window.scrollY !== 0 };
}

const TAKEN = { prevented: true, scrolled: false };

/** Drags an edge by a number of units, with pointer events, and optionally lets go. */
function drag(
  handle: HTMLElement,
  units: number,
  { release = true, altKey = false, rtl = false } = {},
): void {
  const box = handle.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const init = { bubbles: true, cancelable: true, button: 0, pointerId: 7, clientY: y, altKey };
  const dx = units * scale.pixelsPerUnit * (rtl ? -1 : 1);
  act(() => {
    handle.dispatchEvent(new PointerEvent("pointerdown", { ...init, clientX: x }));
  });
  act(() => {
    handle.dispatchEvent(new PointerEvent("pointermove", { ...init, clientX: x + dx / 2 }));
    handle.dispatchEvent(new PointerEvent("pointermove", { ...init, clientX: x + dx }));
  });
  if (release) {
    act(() => {
      handle.dispatchEvent(new PointerEvent("pointerup", { ...init, clientX: x + dx }));
    });
  }
}

describe("TimelineClips, moving", () => {
  it("moves the focused clip with Alt and → or ←, keeps focus on it, and takes the key at both ends", async () => {
    const onMove = vi.fn();
    const container = render(<Fixture first={[]} spies={{ onMove }} />);
    clip(container, "c2").focus();
    expect(await press("{Alt>}{ArrowRight}{/Alt}")).toEqual(TAKEN);
    expect(onMove).toHaveBeenLastCalledWith(["c2"], 1);
    expect(order(container)).toEqual(["c1", "c3", "c2", "c4", "c5"]);
    expect(focused()).toBe("c2");
    expect(await press("{Alt>}{ArrowLeft}{ArrowLeft}{/Alt}")).toEqual(TAKEN);
    expect(order(container)).toEqual(["c2", "c1", "c3", "c4", "c5"]);
    expect(focused()).toBe("c2");
    // At the first clip the key is still taken, and still reported: the host decides.
    expect(await press("{Alt>}{ArrowLeft}{/Alt}")).toEqual(TAKEN);
    expect(onMove).toHaveBeenCalledTimes(4);
    expect(order(container)).toEqual(["c2", "c1", "c3", "c4", "c5"]);
    expect(focused()).toBe("c2");
  });

  it("moves the selected clips together when the focused one is selected", async () => {
    const onMove = vi.fn();
    const container = render(<Fixture first={["c2", "c4"]} spies={{ onMove }} />);
    clip(container, "c4").focus();
    await press("{Alt>}{ArrowLeft}{/Alt}");
    // In the clips' order, whichever has focus.
    expect(onMove).toHaveBeenLastCalledWith(["c2", "c4"], -1);
    expect(order(container)).toEqual(["c2", "c4", "c1", "c3", "c5"]);
    expect(focused()).toBe("c4");
    // A focused clip outside the selection moves alone.
    clip(container, "c5").focus();
    await press("{Alt>}{ArrowLeft}{/Alt}");
    expect(onMove).toHaveBeenLastCalledWith(["c5"], -1);
  });

  it("swaps the arrows in right-to-left text", async () => {
    const onMove = vi.fn();
    const container = render(<Fixture dir="rtl" first={[]} spies={{ onMove }} />);
    clip(container, "c2").focus();
    await press("{Alt>}{ArrowLeft}{/Alt}");
    expect(onMove).toHaveBeenLastCalledWith(["c2"], 1);
    await press("{Alt>}{ArrowRight}{/Alt}");
    expect(onMove).toHaveBeenLastCalledWith(["c2"], -1);
  });

  it("takes Alt with ← and → even without onMove, so the browser can't go back", async () => {
    const container = render(<Fixture readOnly />);
    clip(container, "c1").focus();
    expect(await press("{Alt>}{ArrowLeft}{/Alt}")).toEqual(TAKEN);
    expect(await press("{Alt>}{ArrowRight}{/Alt}")).toEqual(TAKEN);
    expect(order(container)).toEqual(["c1", "c2", "c3", "c4", "c5"]);
    // But not outside the track.
    (container.querySelector('input[type="text"]') as HTMLElement).focus();
    expect((await press("{Alt>}{ArrowLeft}{/Alt}")).prevented).toBe(false);
  });

  it("leaves focus where it is when the host refuses a move", async () => {
    const container = render(<Fixture refuse />);
    clip(container, "c2").focus();
    await press("{Alt>}{ArrowRight}{/Alt}");
    expect(order(container)).toEqual(["c1", "c2", "c3", "c4", "c5"]);
    expect(focused()).toBe("c2");
  });
});

describe("TimelineClips, trimming with keys", () => {
  it("sets an edge to the playhead with [ and ], by position on the keyboard", async () => {
    const onTrimToPlayhead = vi.fn();
    const container = render(<Fixture spies={{ onTrimToPlayhead }} />);
    clip(container, "c3").focus();
    expect(await press("{BracketLeft}")).toEqual(TAKEN);
    expect(onTrimToPlayhead).toHaveBeenLastCalledWith("c3", "start");
    expect(await press("{BracketRight}")).toEqual(TAKEN);
    expect(onTrimToPlayhead).toHaveBeenLastCalledWith("c3", "end");
    // Whatever character the key types: a layout where it's another letter.
    act(() => {
      clip(container, "c3").dispatchEvent(
        new KeyboardEvent("keydown", { key: "ü", code: "BracketLeft", bubbles: true }),
      );
    });
    expect(onTrimToPlayhead).toHaveBeenCalledTimes(3);
    expect(onTrimToPlayhead).toHaveBeenLastCalledWith("c3", "start");
  });

  it("moves an edge inward with Alt and a bracket, and outward with Shift too, by trimStep", async () => {
    const onTrim = vi.fn();
    const container = render(<Fixture spies={{ onTrim }} trimStep={5} />);
    clip(container, "c3").focus();
    expect(await press("{Alt>}{BracketLeft}{/Alt}")).toEqual(TAKEN);
    expect(onTrim).toHaveBeenLastCalledWith("c3", "start", -5);
    expect(await press("{Alt>}{BracketRight}{/Alt}")).toEqual(TAKEN);
    expect(onTrim).toHaveBeenLastCalledWith("c3", "end", -5);
    expect(widths(container)).toEqual([60, 60, 50, 60, 60]);
    expect(await press("{Alt>}{Shift>}{BracketRight}{/Shift}{/Alt}")).toEqual(TAKEN);
    expect(onTrim).toHaveBeenLastCalledWith("c3", "end", 5);
    await press("{Alt>}{Shift>}{BracketLeft}{/Shift}{/Alt}");
    expect(onTrim).toHaveBeenLastCalledWith("c3", "start", 5);
    expect(widths(container)).toEqual([60, 60, 60, 60, 60]);
    expect(focused()).toBe("c3");
  });

  it("takes no bracket key without the callbacks, with Ctrl, or in a field", async () => {
    const onTrim = vi.fn();
    const onTrimToPlayhead = vi.fn();
    const container = render(<Fixture readOnly />);
    clip(container, "c3").focus();
    for (const keys of ["{BracketLeft}", "{Alt>}{BracketRight}{/Alt}"]) {
      expect((await press(keys)).prevented, keys).toBe(false);
    }
    act(() => root?.render(<Fixture key="live" spies={{ onTrim, onTrimToPlayhead }} />));
    clip(container, "c3").focus();
    for (const keys of [
      "{Control>}{BracketLeft}{/Control}",
      "{Shift>}{BracketLeft}{/Shift}",
      "{Alt>}{Control>}{BracketLeft}{/Control}{/Alt}",
    ]) {
      expect((await press(keys)).prevented, keys).toBe(false);
    }
    (container.querySelector('input[type="text"]') as HTMLElement).focus();
    expect((await press("{BracketLeft}")).prevented).toBe(false);
    expect(onTrim).not.toHaveBeenCalled();
    expect(onTrimToPlayhead).not.toHaveBeenCalled();
  });
});

describe("TimelineClips, trimming by dragging an edge", () => {
  it("gives each clip two edges to drag when it can be trimmed, hidden from assistive technology", () => {
    const container = render(<Fixture />);
    const edges = clip(container, "c1").querySelectorAll("[data-hm-edge]");
    expect([...edges].map((element) => element.getAttribute("data-hm-edge"))).toEqual([
      "start",
      "end",
    ]);
    for (const element of edges) {
      expect(element.getAttribute("aria-hidden")).toBe("true");
      expect(getComputedStyle(element).cursor).toBe("ew-resize");
    }
    // A third of the clip at most, so its middle can still be pressed.
    const box = clip(container, "c1").getBoundingClientRect();
    expect(edges[0]?.getBoundingClientRect().width).toBeLessThanOrEqual(box.width / 3 + 0.5);
    act(() => root?.render(<Fixture key="fixed" readOnly />));
    expect(container.querySelector("[data-hm-edge]")).toBeNull();
  });

  it("shows the clip at its new length while dragging, and reports it once, on release", () => {
    const onTrim = vi.fn();
    const container = render(<Fixture spies={{ onTrim }} snapping={false} />);
    drag(edge(container, "c2", "end"), -20, { release: false });
    expect(onTrim).not.toHaveBeenCalled();
    expect(widths(container)).toEqual([60, 40, 60, 60, 60]);
    expect(clip(container, "c2").dataset["hmDragging"]).toBe("end");
    act(() => {
      edge(container, "c2", "end").dispatchEvent(
        new PointerEvent("pointerup", { bubbles: true, pointerId: 7 }),
      );
    });
    expect(onTrim.mock.calls).toEqual([["c2", "end", -20]]);
    expect(widths(container)).toEqual([60, 40, 60, 60, 60]);
    expect(clip(container, "c2").dataset["hmDragging"]).toBeUndefined();
  });

  it("makes a clip longer when its start is dragged earlier, and shorter when later", () => {
    const onTrim = vi.fn();
    const container = render(<Fixture spies={{ onTrim }} snapping={false} />);
    drag(edge(container, "c3", "start"), -15);
    expect(onTrim).toHaveBeenLastCalledWith("c3", "start", 15);
    drag(edge(container, "c3", "start"), 30);
    expect(onTrim).toHaveBeenLastCalledWith("c3", "start", -30);
    expect(widths(container)).toEqual([60, 60, 45, 60, 60]);
  });

  it("follows the reading direction", () => {
    const onTrim = vi.fn();
    const container = render(<Fixture dir="rtl" spies={{ onTrim }} snapping={false} />);
    // In right-to-left text, the end is on the left: 20 units later is 20 units leftward.
    drag(edge(container, "c2", "end"), 20, { rtl: true });
    expect(onTrim).toHaveBeenLastCalledWith("c2", "end", 20);
  });

  it("snaps a dragged edge to the playhead and the boundaries, unless Alt is held", () => {
    const onTrim = vi.fn();
    const container = render(<Fixture spies={{ onTrim }} playhead={150} />);
    const reach = Math.round(8 / scale.pixelsPerUnit);
    expect(reach).toBeGreaterThanOrEqual(2);
    // c2 ends at 120; dragged to just short of the playhead at 150, it lands on it.
    drag(edge(container, "c2", "end"), 30 - reach + 1);
    expect(onTrim).toHaveBeenLastCalledWith("c2", "end", 30);
    act(() => root?.render(<Fixture key="alt" spies={{ onTrim }} playhead={150} />));
    drag(edge(container, "c2", "end"), 30 - reach + 1, { altKey: true });
    expect(onTrim).toHaveBeenLastCalledWith("c2", "end", 30 - reach + 1);
  });

  it("stops at one unit, and at trimLimits", () => {
    const onTrim = vi.fn();
    const trimLimits = vi.fn(() => ({ min: -25, max: 10 }));
    const container = render(<Fixture spies={{ onTrim }} snapping={false} />);
    drag(edge(container, "c2", "end"), -100);
    expect(onTrim).toHaveBeenLastCalledWith("c2", "end", -59);
    act(() =>
      root?.render(
        <Fixture key="limits" spies={{ onTrim }} snapping={false} trimLimits={trimLimits} />,
      ),
    );
    drag(edge(container, "c2", "end"), 40);
    expect(trimLimits).toHaveBeenLastCalledWith("c2", "end");
    expect(onTrim).toHaveBeenLastCalledWith("c2", "end", 10);
    drag(edge(container, "c2", "end"), -80);
    expect(onTrim).toHaveBeenLastCalledWith("c2", "end", -25);
  });

  it("reports nothing for a drag that ends where it began, is cancelled, or meets Escape", async () => {
    const onTrim = vi.fn();
    const container = render(<Fixture spies={{ onTrim }} snapping={false} />);
    drag(edge(container, "c2", "end"), 0);
    drag(edge(container, "c2", "end"), -20, { release: false });
    act(() => {
      edge(container, "c2", "end").dispatchEvent(
        new PointerEvent("pointercancel", { bubbles: true, pointerId: 7 }),
      );
    });
    expect(widths(container)).toEqual([60, 60, 60, 60, 60]);
    drag(edge(container, "c2", "end"), -20, { release: false });
    expect(widths(container)).toEqual([60, 40, 60, 60, 60]);
    const cancelled = await press("{Escape}");
    expect(cancelled.prevented).toBe(true);
    expect(widths(container)).toEqual([60, 60, 60, 60, 60]);
    // The release after Escape reports nothing either.
    act(() => {
      edge(container, "c2", "end").dispatchEvent(
        new PointerEvent("pointerup", { bubbles: true, pointerId: 7 }),
      );
    });
    expect(onTrim).not.toHaveBeenCalled();
  });

  it("doesn't move the playhead when an edge is pressed", () => {
    const container = render(<Fixture snapping={false} />);
    drag(edge(container, "c4", "start"), 5);
    expect((container.querySelector('input[type="range"]') as HTMLInputElement).value).toBe("0");
  });
});

describe("TimelineClips, at scale", () => {
  it("resizes every one of 2,000 clips when the zoom changes", () => {
    const many: TimelineClip[] = Array.from({ length: 2000 }, (_, index) => ({
      key: `k${index}`,
      length: 48,
      label: `Clip ${index + 1} of 2000`,
      content: `Clip ${index + 1}`,
    }));
    const container = render(<Fixture start={many} first={["k0"]} zoom={20} />);
    const before = clip(container, "k0").getBoundingClientRect().width;
    act(() => root?.render(<Fixture start={many} first={["k0"]} zoom={40} />));
    // The first, the last and one between: no time is asserted, since a time
    // depends on what else the machine is doing. Those are in docs/adr/0011.
    for (const key of ["k0", "k1000", "k1999"]) {
      expect(clip(container, key).getBoundingClientRect().width).toBeCloseTo(before * 2, 0);
    }
  });
});
