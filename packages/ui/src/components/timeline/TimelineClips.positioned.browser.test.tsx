import { act, useState } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanUp, loadStyles, mount } from "../../test/dom.js";
import { Timeline, type TimelineScale, useTimelineScale } from "./Timeline.js";
import { type TimelineClip, type TimelineClipEdge, TimelineClips } from "./TimelineClips.js";
import { TimelineLane } from "./TimelineLane.js";
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
});

function render(element: React.ReactElement): HTMLElement {
  const container = mount("");
  act(() => {
    root = createRoot(container);
    root.render(element);
  });
  return container;
}

let scale: TimelineScale;
function Probe() {
  scale = useTimelineScale();
  return null;
}

/** A video lane, back to back, over an audio lane with room between its clips. */
const VIDEO: TimelineClip[] = [
  { key: "v1", length: 100, label: "Video 1" },
  { key: "v2", length: 140, label: "Video 2" },
  { key: "v3", length: 60, label: "Video 3" },
];
const AUDIO: TimelineClip[] = [
  { key: "a1", at: 20, length: 60, label: "Audio 1" },
  { key: "a2", at: 120, length: 50, label: "Audio 2" },
  { key: "a3", at: 260, length: 80, label: "Audio 3" },
];

interface Options {
  readonly audio?: TimelineClip[];
  readonly extent?: number;
  readonly zoom?: number;
  readonly dir?: "ltr" | "rtl";
  readonly snapping?: boolean;
  readonly onTrim?: (key: string, edge: TimelineClipEdge, delta: number) => void;
}

let setAudio: (clips: TimelineClip[]) => void;

function Fixture({ audio: start = AUDIO, extent, zoom, dir = "ltr", snapping, onTrim }: Options) {
  const [audio, set] = useState(start);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [frame, setFrame] = useState(0);
  setAudio = set;
  return (
    <div dir={dir} style={{ inlineSize: "1000px" }}>
      <Timeline label="Timeline" length={300} extent={extent} zoom={zoom} snapping={snapping}>
        <Probe />
        <TimelinePlayhead label="Playhead" position={frame} onPositionChange={setFrame} />
        <TimelineLane id="video" label="Video track">
          <TimelineClips
            label="Video clips"
            clips={VIDEO}
            selectionMode="multiple"
            selectedKeys={selected}
            onSelectedKeysChange={setSelected}
          />
        </TimelineLane>
        <TimelineLane id="audio" label="Audio track">
          <TimelineClips
            label="Audio clips"
            clips={audio}
            selectionMode="multiple"
            selectedKeys={selected}
            onSelectedKeysChange={setSelected}
            onTrim={
              onTrim
                ? (key, edge, delta) => {
                    onTrim(key, edge, delta);
                    // As both SDKs do: the sound stays where it is, so a
                    // start that moves takes `at` with it.
                    set((clips) =>
                      clips.map((clip) =>
                        clip.key === key
                          ? {
                              ...clip,
                              length: clip.length + delta,
                              at: edge === "start" ? (clip.at ?? 0) - delta : clip.at,
                            }
                          : clip,
                      ),
                    );
                  }
                : undefined
            }
          />
        </TimelineLane>
      </Timeline>
    </div>
  );
}

const clip = (container: HTMLElement, key: string) =>
  container.querySelector(`[data-hm-key="${key}"]`) as HTMLElement;
const track = (container: HTMLElement) =>
  container.querySelector(".hm-timeline-track") as HTMLElement;
const focused = () => (document.activeElement as HTMLElement | null)?.dataset["hmKey"];

/** A clip's start and end on the track, in units, from where it's drawn. */
function span(container: HTMLElement, key: string): [number, number] {
  const box = clip(container, key).getBoundingClientRect();
  const origin = track(container).getBoundingClientRect();
  const rtl = getComputedStyle(track(container)).direction === "rtl";
  const start = rtl ? origin.right - box.right : box.left - origin.left;
  return [
    Math.round(start / scale.pixelsPerUnit),
    Math.round((start + box.width) / scale.pixelsPerUnit),
  ];
}

function drag(handle: HTMLElement, units: number, release = true): void {
  const box = handle.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const init = {
    bubbles: true,
    cancelable: true,
    button: 0,
    pointerId: 3,
    clientY: box.top + box.height / 2,
  };
  const to = x + units * scale.pixelsPerUnit;
  act(() => {
    handle.dispatchEvent(new PointerEvent("pointerdown", { ...init, clientX: x }));
  });
  act(() => {
    handle.dispatchEvent(new PointerEvent("pointermove", { ...init, clientX: to }));
  });
  if (release) {
    act(() => {
      handle.dispatchEvent(new PointerEvent("pointerup", { ...init, clientX: to }));
    });
  }
}

const edge = (container: HTMLElement, key: string, side: TimelineClipEdge) =>
  clip(container, key).querySelector(`[data-hm-edge="${side}"]`) as HTMLElement;

describe("TimelineClips with clips that have a start", () => {
  it("places each clip at its start, with room between, in the first frame committed", () => {
    const container = render(<Fixture extent={340} />);
    expect(span(container, "a1")).toEqual([20, 80]);
    expect(span(container, "a2")).toEqual([120, 170]);
    expect(span(container, "a3")).toEqual([260, 340]);
  });

  it("keeps a back-to-back lane back to back beside a positioned one", () => {
    const container = render(<Fixture extent={340} />);
    expect(span(container, "v1")).toEqual([0, 100]);
    expect(span(container, "v2")).toEqual([100, 240]);
    expect(span(container, "v3")).toEqual([240, 300]);
    // The two lanes share the timeline's scale: unit 120 is in one place.
    expect(clip(container, "a2").getBoundingClientRect().left).toBeCloseTo(
      track(container).getBoundingClientRect().left + scale.toPixels(120),
      0,
    );
  });

  it("follows the clips when their starts change", () => {
    const container = render(<Fixture extent={340} />);
    act(() =>
      setAudio([
        { key: "a1", at: 0, length: 60, label: "Audio 1" },
        { key: "a3", at: 200, length: 80, label: "Audio 3" },
      ]),
    );
    expect(span(container, "a1")).toEqual([0, 60]);
    expect(span(container, "a3")).toEqual([200, 280]);
  });

  it("lays the clips out from the other end in right-to-left text", () => {
    const container = render(<Fixture extent={340} dir="rtl" />);
    expect(span(container, "a1")).toEqual([20, 80]);
    expect(span(container, "a2")).toEqual([120, 170]);
    expect(clip(container, "a2").getBoundingClientRect().right).toBeLessThan(
      clip(container, "a1").getBoundingClientRect().left,
    );
  });

  it("is the same listbox: one Tab stop, and the arrows between clips in time order", () => {
    const container = render(<Fixture extent={340} />);
    expect(
      [...container.querySelectorAll('[aria-label="Audio clips"] [tabindex="0"]')].map(
        (element) => (element as HTMLElement).dataset["hmKey"],
      ),
    ).toEqual(["a1"]);
    act(() => clip(container, "a1").focus());
    act(() => {
      clip(container, "a1").dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }),
      );
    });
    expect(focused()).toBe("a2");
  });

  it("goes between lanes to the clip nearest in time, across the room between clips", () => {
    const container = render(<Fixture extent={340} />);
    const down = (from: string) => {
      act(() => clip(container, from).focus());
      act(() => {
        clip(container, from).dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
        );
      });
      return focused();
    };
    // v1's middle is 50: inside a1. v2's is 170: a2 ends there, so it's the nearest.
    expect(down("v1")).toBe("a1");
    expect(down("v2")).toBe("a2");
    // v3's middle is 270: inside a3.
    expect(down("v3")).toBe("a3");
    // Up from a2, whose middle is 145: inside v2.
    act(() => {
      clip(container, "a2").focus();
      clip(container, "a2").dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }),
      );
    });
    expect(focused()).toBe("v2");
  });

  it("makes every lane's clip edges snap targets for the whole timeline", () => {
    render(<Fixture extent={340} zoom={3} />);
    const reach = Math.round(8 / scale.pixelsPerUnit);
    expect(reach).toBeGreaterThanOrEqual(1);
    // The audio lane's edges: 20, 80, 120, 170, 260.
    expect(scale.snap(80 + reach)).toBe(80);
    expect(scale.snap(170 - reach)).toBe(170);
    // The video lane's boundaries: 100 and 240.
    expect(scale.snap(100 + reach)).toBe(100);
    expect(scale.snap(240 - reach)).toBe(240);
    // Between them, nothing.
    expect(scale.snap(200)).toBe(200);
  });

  it("holds a clip's other edge still while one is dragged, and its neighbours where they are", () => {
    const onTrim = vi.fn();
    const container = render(<Fixture extent={340} snapping={false} onTrim={onTrim} />);
    // The end, 20 later: the clip grows, and the next clip doesn't move.
    drag(edge(container, "a1", "end"), 20, false);
    expect(span(container, "a1")).toEqual([20, 100]);
    expect(span(container, "a2")).toEqual([120, 170]);
    act(() => {
      edge(container, "a1", "end").dispatchEvent(
        new PointerEvent("pointerup", { bubbles: true, pointerId: 3 }),
      );
    });
    expect(onTrim).toHaveBeenLastCalledWith("a1", "end", 20);
    expect(span(container, "a1")).toEqual([20, 100]);

    // The start, 10 earlier: it grows towards the start, and its end stays.
    drag(edge(container, "a2", "start"), -10, false);
    expect(span(container, "a2")).toEqual([110, 170]);
    expect(span(container, "a3")).toEqual([260, 340]);
    act(() => {
      edge(container, "a2", "start").dispatchEvent(
        new PointerEvent("pointerup", { bubbles: true, pointerId: 3 }),
      );
    });
    expect(onTrim).toHaveBeenLastCalledWith("a2", "start", 10);
    expect(span(container, "a2")).toEqual([110, 170]);
    expect(span(container, "a3")).toEqual([260, 340]);
  });

  it("snaps a dragged edge to another lane's clips", () => {
    const onTrim = vi.fn();
    const container = render(<Fixture extent={340} onTrim={onTrim} />);
    const reach = Math.round(8 / scale.pixelsPerUnit);
    expect(reach).toBeGreaterThanOrEqual(2);
    // a1 ends at 80; the video lane has a boundary at 100.
    drag(edge(container, "a1", "end"), 20 - reach + 1);
    expect(onTrim).toHaveBeenLastCalledWith("a1", "end", 20);
  });

  it("draws the track to extent, ends the playhead at length, and marks clips past it", () => {
    const container = render(<Fixture extent={340} />);
    const origin = track(container).getBoundingClientRect();
    expect(scale.length).toBe(300);
    expect(scale.extent).toBe(340);
    expect(origin.width).toBeCloseTo(scale.toPixels(340), 0);
    // Everything fits at zoom 1, the part past the length too.
    const viewport = container.querySelector(".hm-timeline-viewport") as HTMLElement;
    expect(viewport.scrollWidth).toBe(viewport.clientWidth);
    // The slider is as wide as the length, and still ends at it.
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.max).toBe("300");
    const playhead = container.querySelector(".hm-timeline-playhead") as HTMLElement;
    expect(playhead.getBoundingClientRect().width).toBeCloseTo(scale.toPixels(300), 0);
    // a3 runs from 260 to 340.
    expect(clip(container, "a3").dataset["hmPastEnd"]).toBe("");
    expect(clip(container, "a2").dataset["hmPastEnd"]).toBeUndefined();
    expect(clip(container, "v3").dataset["hmPastEnd"]).toBeUndefined();
    // A pointer past the length is still on the timeline.
    expect(scale.unitAt(origin.left + scale.toPixels(330))).toBe(330);
  });

  it("is no shorter than length, and changes nothing without extent", () => {
    const container = render(<Fixture extent={100} />);
    expect(scale.extent).toBe(300);
    expect(track(container).getBoundingClientRect().width).toBeCloseTo(scale.toPixels(300), 0);
    const playhead = container.querySelector(".hm-timeline-playhead") as HTMLElement;
    expect(playhead.style.inlineSize).toBe("");
    // a3 still runs past the length: it's drawn past the track, and marked.
    expect(clip(container, "a3").dataset["hmPastEnd"]).toBe("");
  });

  it("hydrates without errors or warnings, then places its clips", () => {
    const app = <Fixture extent={340} />;
    const html = renderToString(app);
    // On a server nothing is measured: no sizes and no places.
    expect(html).not.toContain("margin-inline-start");
    const container = mount(html);
    const consoleError = vi.spyOn(console, "error");
    const recoverable: unknown[] = [];
    act(() => {
      root = hydrateRoot(container, app, { onRecoverableError: (e) => recoverable.push(e) });
    });
    expect(recoverable).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
    expect(span(container, "a2")).toEqual([120, 170]);
  });
});
