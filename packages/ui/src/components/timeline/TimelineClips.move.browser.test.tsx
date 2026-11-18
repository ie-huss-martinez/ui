import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { cleanUp, loadStyles, mount, track as tracked } from "../../test/dom.js";
import { Timeline, TimelineLayer, type TimelineScale, useTimelineScale } from "./Timeline.js";
import {
  type TimelineClip,
  type TimelineClipDrop,
  TimelineClips,
  type TimelineClipsProps,
} from "./TimelineClips.js";
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

let scale: TimelineScale;
function Probe() {
  scale = useTimelineScale();
  return null;
}

interface Placed {
  readonly key: string;
  readonly lane: string;
  readonly at: number;
  readonly length: number;
}

/** Two sound lanes with positions, under a picture lane that lies back to back. */
const START: Placed[] = [
  { key: "v1", lane: "voice", at: 20, length: 60 },
  { key: "v2", lane: "voice", at: 120, length: 50 },
  { key: "m1", lane: "music", at: 200, length: 80 },
];
const PICTURE: TimelineClip[] = [
  { key: "p1", length: 100, label: "Shot 1" },
  { key: "p2", length: 200, label: "Shot 2" },
];
const LANES = ["voice", "music"] as const;

interface Options {
  readonly first?: readonly string[];
  readonly zoom?: number;
  readonly dir?: "ltr" | "rtl";
  readonly snapping?: boolean;
  readonly readOnly?: boolean;
  readonly moveHandle?: TimelineClipsProps["moveHandle"];
  readonly spies?: Pick<TimelineClipsProps, "onDrop" | "onMoveLane" | "canDrop">;
  readonly under?: boolean;
}

/** An editor that applies what the track reports, and refuses an overlap or the picture lane. */
function Fixture({
  first = [],
  zoom,
  dir = "ltr",
  snapping,
  readOnly = false,
  moveHandle,
  spies = {},
  under = false,
}: Options) {
  const [clips, setClips] = useState(START);
  const [selected, setSelected] = useState(first);
  const [frame, setFrame] = useState(0);

  const place = (keys: readonly string[], by: number, lane: string | undefined): Placed[] =>
    clips.map((clip) =>
      keys.includes(clip.key) ? { ...clip, at: clip.at + by, lane: lane ?? clip.lane } : clip,
    );
  const fits = (next: Placed[]): boolean =>
    next.every(
      (clip) =>
        clip.at >= 0 &&
        LANES.includes(clip.lane as (typeof LANES)[number]) &&
        next.every(
          (other) =>
            other === clip ||
            other.lane !== clip.lane ||
            other.at >= clip.at + clip.length ||
            clip.at >= other.at + other.length,
        ),
    );
  const canDrop = (keys: readonly string[], drop: TimelineClipDrop): boolean => {
    spies.canDrop?.(keys, drop);
    return fits(place(keys, drop.by, drop.lane));
  };
  const onDrop = (keys: readonly string[], drop: TimelineClipDrop): void => {
    spies.onDrop?.(keys, drop);
    setClips(place(keys, drop.by, drop.lane));
  };
  const onMoveLane = (keys: readonly string[], direction: -1 | 1): void => {
    spies.onMoveLane?.(keys, direction);
    const key = keys[0] as string;
    const from = clips.find((clip) => clip.key === key)?.lane ?? "voice";
    const to = LANES[LANES.indexOf(from as (typeof LANES)[number]) + direction];
    if (to) {
      const next = place(keys, 0, to);
      if (fits(next)) {
        setClips(next);
      }
    }
  };

  return (
    <div dir={dir} style={{ inlineSize: "1000px" }}>
      <Timeline label="Timeline" length={300} zoom={zoom} snapping={snapping}>
        <Probe />
        <TimelinePlayhead label="Playhead" position={frame} onPositionChange={setFrame} />
        <TimelineLane id="picture" label="Picture track">
          <TimelineClips
            label="Picture clips"
            clips={PICTURE}
            selectionMode="multiple"
            selectedKeys={selected}
            onSelectedKeysChange={setSelected}
          />
        </TimelineLane>
        {LANES.map((lane) => (
          <TimelineLane key={lane} id={lane} label={`${lane} track`}>
            {under ? <TimelineLayer data-testid={`under-${lane}`} /> : null}
            <TimelineClips
              label={`${lane} clips`}
              clips={clips
                .filter((clip) => clip.lane === lane)
                .sort((a, b) => a.at - b.at)
                .map((clip) => ({
                  key: clip.key,
                  at: clip.at,
                  length: clip.length,
                  label: `Clip ${clip.key}`,
                  content: clip.key,
                }))}
              selectionMode="multiple"
              selectedKeys={selected}
              onSelectedKeysChange={setSelected}
              onDrop={readOnly ? undefined : onDrop}
              canDrop={readOnly ? undefined : canDrop}
              onMoveLane={readOnly ? undefined : onMoveLane}
              moveHandle={moveHandle}
            />
          </TimelineLane>
        ))}
      </Timeline>
      <input type="text" aria-label="Name" />
    </div>
  );
}

const clip = (container: HTMLElement, key: string) =>
  container.querySelector(`[data-hm-key="${key}"]`) as HTMLElement;
const laneOf = (container: HTMLElement, key: string) =>
  clip(container, key).closest<HTMLElement>("[data-hm-lane]")?.dataset["hmLane"];
const lane = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-hm-lane="${id}"]`) as HTMLElement;
const trackOf = (container: HTMLElement) =>
  container.querySelector(".hm-timeline-track") as HTMLElement;
const selected = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[role="option"][aria-selected="true"]')].map(
    (element) => element.dataset["hmKey"],
  );
const focused = () => (document.activeElement as HTMLElement | null)?.dataset["hmKey"];

/** A clip's start on the track, in units, from where it's drawn. */
function startOf(container: HTMLElement, key: string): number {
  const box = clip(container, key).getBoundingClientRect();
  const origin = trackOf(container).getBoundingClientRect();
  const rtl = getComputedStyle(trackOf(container)).direction === "rtl";
  return Math.round(
    (rtl ? origin.right - box.right : box.left - origin.left) / scale.pixelsPerUnit,
  );
}

interface Gesture {
  /** Units along time; in right-to-left text, later is leftward. */
  readonly units?: number;
  /** The lane to end over. */
  readonly to?: string;
  readonly release?: boolean;
  readonly altKey?: boolean;
  readonly pointerType?: string;
  /** Where on the clip to press: its content, or its body beside it. */
  readonly on?: "content" | "body";
  readonly rtl?: boolean;
}

/** Drags a clip by its body with pointer events, in steps as a hand does. */
function drag(container: HTMLElement, key: string, gesture: Gesture = {}): void {
  const {
    units = 0,
    to,
    release = true,
    altKey = false,
    pointerType = "mouse",
    on = "content",
  } = gesture;
  const element = clip(container, key);
  const target =
    on === "content"
      ? (element.querySelector(".hm-timeline-clip-content") as HTMLElement)
      : element;
  const box = element.getBoundingClientRect();
  const hold = target.getBoundingClientRect();
  const x = on === "content" ? hold.left + Math.min(hold.width / 2, 12) : box.right - box.width / 4;
  const y = box.top + box.height / 2;
  const endY = to ? lane(container, to).getBoundingClientRect().top + box.height / 2 : y;
  const dx = units * scale.pixelsPerUnit * (gesture.rtl ? -1 : 1);
  const init = { bubbles: true, cancelable: true, button: 0, pointerId: 5, pointerType, altKey };
  act(() => {
    target.dispatchEvent(new PointerEvent("pointerdown", { ...init, clientX: x, clientY: y }));
  });
  for (const part of [0.2, 0.6, 1]) {
    act(() => {
      target.dispatchEvent(
        new PointerEvent("pointermove", {
          ...init,
          clientX: x + dx * part,
          clientY: y + (endY - y) * part,
        }),
      );
    });
  }
  if (release) {
    drop(container, key, { clientX: x + dx, clientY: endY });
  }
}

function drop(
  container: HTMLElement,
  key: string,
  at: { clientX?: number; clientY?: number } = {},
): void {
  act(() => {
    clip(container, key).dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, pointerId: 5, ...at }),
    );
    // A browser follows a release on the element pressed with a click.
    clip(container, key).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** Presses keys, and reports whether the last one's default was prevented and the page scrolled. */
async function press(keys: string): Promise<{ prevented: boolean; scrolled: boolean }> {
  if (!document.querySelector("[data-tall]")) {
    const tall = tracked(document.createElement("div"));
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

describe("TimelineClips, moving a clip between lanes with the keyboard", () => {
  it("moves the focused clip to the lane below or above with Alt and ↓ or ↑, and focus goes with it", async () => {
    const onMoveLane = vi.fn();
    const container = render(<Fixture spies={{ onMoveLane }} />);
    clip(container, "v1").focus();
    expect(await press("{Alt>}{ArrowDown}{/Alt}")).toEqual(TAKEN);
    expect(onMoveLane).toHaveBeenLastCalledWith(["v1"], 1);
    expect(laneOf(container, "v1")).toBe("music");
    expect(startOf(container, "v1")).toBe(20);
    // The clip left one listbox for another: focus is on it there.
    expect(focused()).toBe("v1");
    expect(await press("{Alt>}{ArrowUp}{/Alt}")).toEqual(TAKEN);
    expect(onMoveLane).toHaveBeenLastCalledWith(["v1"], -1);
    expect(laneOf(container, "v1")).toBe("voice");
    expect(focused()).toBe("v1");
  });

  it("takes the keys where the clip can't go, and without onMoveLane, so the page doesn't scroll", async () => {
    const onMoveLane = vi.fn();
    const container = render(<Fixture spies={{ onMoveLane }} />);
    // Up from the first sound lane is the picture lane, which the editor refuses.
    clip(container, "v1").focus();
    expect(await press("{Alt>}{ArrowUp}{/Alt}")).toEqual(TAKEN);
    expect(onMoveLane).toHaveBeenLastCalledWith(["v1"], -1);
    expect(laneOf(container, "v1")).toBe("voice");
    expect(focused()).toBe("v1");
    // The picture lane's track has no onMoveLane at all.
    clip(container, "p1").focus();
    expect(await press("{Alt>}{ArrowDown}{/Alt}")).toEqual(TAKEN);
    expect(onMoveLane).toHaveBeenCalledTimes(1);
    // With Shift it isn't the track's.
    expect((await press("{Alt>}{Shift>}{ArrowDown}{/Shift}{/Alt}")).prevented).toBe(false);
  });

  it("moves the whole selection, on every lane, when the focused clip is in it", async () => {
    const onMoveLane = vi.fn();
    const container = render(<Fixture first={["v1", "v2", "m1"]} spies={{ onMoveLane }} />);
    clip(container, "v2").focus();
    await press("{Alt>}{ArrowDown}{/Alt}");
    expect(onMoveLane).toHaveBeenLastCalledWith(["v1", "v2", "m1"], 1);
  });
});

describe("TimelineClips, dragging a clip", () => {
  it("follows the pointer along time, and reports once, on release", () => {
    const onDrop = vi.fn();
    const container = render(<Fixture snapping={false} spies={{ onDrop }} />);
    drag(container, "v1", { units: 30, release: false });
    expect(onDrop).not.toHaveBeenCalled();
    expect(clip(container, "v1").dataset["hmMoving"]).toBe("allowed");
    // It's drawn where it would be, without having moved in the track.
    expect(startOf(container, "v1")).toBe(50);
    drop(container, "v1");
    expect(onDrop.mock.calls).toEqual([[["v1"], { by: 30, lane: undefined }]]);
    expect(clip(container, "v1").dataset["hmMoving"]).toBeUndefined();
    expect(startOf(container, "v1")).toBe(50);
    expect(clip(container, "v1").style.translate).toBe("");
  });

  it("treats a press that barely moves as a click: it selects, and reports no drop", () => {
    const onDrop = vi.fn();
    const container = render(<Fixture spies={{ onDrop }} />);
    const element = clip(container, "v2");
    const box = element.getBoundingClientRect();
    const init = { bubbles: true, button: 0, pointerId: 5, pointerType: "mouse" };
    act(() => {
      element.dispatchEvent(
        new PointerEvent("pointerdown", { ...init, clientX: box.left + 5, clientY: box.top + 5 }),
      );
      element.dispatchEvent(
        new PointerEvent("pointermove", { ...init, clientX: box.left + 7, clientY: box.top + 6 }),
      );
    });
    expect(element.dataset["hmMoving"]).toBeUndefined();
    drop(container, "v2");
    expect(onDrop).not.toHaveBeenCalled();
    expect(selected(container)).toEqual(["v2"]);
  });

  it("goes to the lane under the pointer, and focus goes with it", () => {
    const onDrop = vi.fn();
    const container = render(<Fixture snapping={false} spies={{ onDrop }} />);
    act(() => clip(container, "v1").focus());
    drag(container, "v1", { units: 10, to: "music", release: false });
    // Drawn over the lane it would go to.
    expect(clip(container, "v1").getBoundingClientRect().top).toBeCloseTo(
      clip(container, "m1").getBoundingClientRect().top,
      0,
    );
    drop(container, "v1");
    expect(onDrop).toHaveBeenLastCalledWith(["v1"], { by: 10, lane: "music" });
    expect(laneOf(container, "v1")).toBe("music");
    expect(startOf(container, "v1")).toBe(30);
    expect(focused()).toBe("v1");
  });

  it("doesn't change the selection with the click that ends a drag", () => {
    const container = render(<Fixture first={["m1"]} snapping={false} />);
    drag(container, "v1", { units: 20 });
    expect(selected(container)).toEqual(["m1"]);
    // The next click is a click again.
    act(() => {
      clip(container, "v1").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(selected(container)).toEqual(["v1"]);
  });

  it("takes the rest of the selection with a selected clip, on every lane", () => {
    const onDrop = vi.fn();
    const container = render(<Fixture first={["v1", "m1"]} snapping={false} spies={{ onDrop }} />);
    drag(container, "v1", { units: 15 });
    expect(onDrop).toHaveBeenLastCalledWith(["v1", "m1"], { by: 15, lane: undefined });
    // A clip that isn't selected moves alone.
    drag(container, "v2", { units: 15 });
    expect(onDrop).toHaveBeenLastCalledWith(["v2"], { by: 15, lane: undefined });
  });

  it("snaps the clip's start or end to other clips, on any lane, but not to itself", () => {
    const onDrop = vi.fn();
    const container = render(<Fixture spies={{ onDrop }} />);
    const reach = Math.round(8 / scale.pixelsPerUnit);
    expect(reach).toBeGreaterThanOrEqual(2);
    // v1 is 20 to 80; the picture lane has a boundary at 100. Moved 20 less
    // a little, its end lands on it.
    drag(container, "v1", { units: 20 - reach + 1 });
    expect(onDrop).toHaveBeenLastCalledWith(["v1"], { by: 20, lane: undefined });
    // Now 40 to 100. Moved back within reach of where it was, it doesn't
    // snap to its own edges: if it did, it wouldn't have moved at all.
    drag(container, "v1", { units: -reach });
    expect(onDrop).toHaveBeenLastCalledWith(["v1"], { by: -reach, lane: undefined });
  });

  it("doesn't snap with Alt held, or with snapping off", () => {
    const onDrop = vi.fn();
    const container = render(<Fixture spies={{ onDrop }} />);
    const reach = Math.round(8 / scale.pixelsPerUnit);
    drag(container, "v1", { units: 20 - reach + 1, altKey: true });
    expect(onDrop).toHaveBeenLastCalledWith(["v1"], { by: 20 - reach + 1, lane: undefined });
  });

  it("shows where a clip can't be dropped, and reports nothing there", () => {
    const onDrop = vi.fn();
    const canDrop = vi.fn();
    const container = render(<Fixture snapping={false} spies={{ onDrop, canDrop }} />);
    // v1 is 20 to 80 and v2 starts at 120: 50 later, they overlap.
    drag(container, "v1", { units: 50, release: false });
    expect(canDrop).toHaveBeenLastCalledWith(["v1"], { by: 50, lane: undefined });
    expect(clip(container, "v1").dataset["hmMoving"]).toBe("refused");
    expect(getComputedStyle(clip(container, "v1")).borderTopStyle).toBe("dashed");
    drop(container, "v1");
    expect(onDrop).not.toHaveBeenCalled();
    expect(startOf(container, "v1")).toBe(20);
    // The picture lane takes no sound.
    drag(container, "v1", { to: "picture", release: false });
    expect(canDrop).toHaveBeenLastCalledWith(["v1"], { by: 0, lane: "picture" });
    expect(clip(container, "v1").dataset["hmMoving"]).toBe("refused");
    drop(container, "v1");
    expect(onDrop).not.toHaveBeenCalled();
    expect(laneOf(container, "v1")).toBe("voice");
  });

  it("can't be dragged before the timeline's start", () => {
    const onDrop = vi.fn();
    const container = render(<Fixture snapping={false} spies={{ onDrop }} />);
    drag(container, "v1", { units: -60 });
    expect(onDrop).toHaveBeenLastCalledWith(["v1"], { by: -20, lane: undefined });
    expect(startOf(container, "v1")).toBe(0);
  });

  it("follows the reading direction", () => {
    const onDrop = vi.fn();
    const container = render(<Fixture dir="rtl" snapping={false} spies={{ onDrop }} />);
    // In right-to-left text, later is leftward.
    drag(container, "v1", { units: 30, rtl: true });
    expect(onDrop).toHaveBeenLastCalledWith(["v1"], { by: 30, lane: undefined });
    expect(startOf(container, "v1")).toBe(50);
  });

  it("is cancelled by Escape and by a cancelled pointer", async () => {
    const onDrop = vi.fn();
    const container = render(<Fixture first={["m1"]} snapping={false} spies={{ onDrop }} />);
    drag(container, "v1", { units: 30, release: false });
    const cancelled = await press("{Escape}");
    expect(cancelled.prevented).toBe(true);
    expect(clip(container, "v1").dataset["hmMoving"]).toBeUndefined();
    expect(startOf(container, "v1")).toBe(20);
    // Letting go afterwards drops nothing, and its click chooses nothing.
    drop(container, "v1");
    expect(onDrop).not.toHaveBeenCalled();
    expect(selected(container)).toEqual(["m1"]);

    drag(container, "v2", { units: 30, release: false });
    act(() => {
      clip(container, "v2").dispatchEvent(
        new PointerEvent("pointercancel", { bubbles: true, pointerId: 5 }),
      );
    });
    expect(clip(container, "v2").dataset["hmMoving"]).toBeUndefined();
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("isn't started by a finger, which scrolls the timeline instead", () => {
    const onDrop = vi.fn();
    const container = render(<Fixture snapping={false} spies={{ onDrop }} />);
    drag(container, "v1", { units: 30, pointerType: "touch", release: false });
    expect(clip(container, "v1").dataset["hmMoving"]).toBeUndefined();
    drop(container, "v1");
    expect(onDrop).not.toHaveBeenCalled();
    // A pen drags, as a mouse does.
    drag(container, "v1", { units: 30, pointerType: "pen" });
    expect(onDrop).toHaveBeenCalledTimes(1);
  });

  it("can't be dragged without onDrop, and shows no handle", () => {
    const container = render(<Fixture readOnly />);
    expect(container.querySelector("[data-hm-move-handle]")).toBeNull();
    expect(getComputedStyle(clip(container, "v1")).cursor).toBe("pointer");
    drag(container, "v1", { units: 30, release: false });
    expect(clip(container, "v1").dataset["hmMoving"]).toBeUndefined();
  });

  it("is dragged by its whole body by default, with a cursor that says so", () => {
    const onDrop = vi.fn();
    const container = render(<Fixture snapping={false} spies={{ onDrop }} />);
    expect(getComputedStyle(clip(container, "v1")).cursor).toBe("grab");
    drag(container, "v1", { units: 20, on: "body" });
    expect(onDrop).toHaveBeenCalledTimes(1);
  });

  it("is dragged only by its title with moveHandle title, and lets a press on the rest through", () => {
    const onDrop = vi.fn();
    const container = render(
      <Fixture snapping={false} moveHandle="title" spies={{ onDrop }} under />,
    );
    const element = clip(container, "v1");
    const title = element.querySelector(".hm-timeline-clip-content") as HTMLElement;
    expect(getComputedStyle(element).pointerEvents).toBe("none");
    expect(getComputedStyle(title).pointerEvents).toBe("auto");
    expect(getComputedStyle(title).cursor).toBe("grab");
    // What's under the pointer on the clip's body is the layer beneath it.
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.right - 3, box.bottom - 3);
    expect(hit?.getAttribute("data-testid")).toBe("under-voice");
    // And on its title, the title.
    const hold = title.getBoundingClientRect();
    expect(document.elementFromPoint(hold.left + 3, hold.top + hold.height / 2)).toBe(title);
    // A press that did reach the body starts nothing; the title drags.
    drag(container, "v1", { units: 20, on: "body" });
    expect(onDrop).not.toHaveBeenCalled();
    drag(container, "v1", { units: 20, on: "content" });
    expect(onDrop).toHaveBeenLastCalledWith(["v1"], { by: 20, lane: undefined });
  });

  it("scrolls the timeline while a dragged clip is held near the end of the view", async () => {
    const container = render(<Fixture zoom={4} snapping={false} />);
    const viewport = container.querySelector(".hm-timeline-viewport") as HTMLElement;
    expect(viewport.scrollLeft).toBe(0);
    const element = clip(container, "v1");
    const box = element.getBoundingClientRect();
    const view = viewport.getBoundingClientRect();
    const init = { bubbles: true, button: 0, pointerId: 5, pointerType: "mouse" };
    const y = box.top + box.height / 2;
    act(() => {
      element.dispatchEvent(
        new PointerEvent("pointerdown", { ...init, clientX: box.left + 10, clientY: y }),
      );
      element.dispatchEvent(
        new PointerEvent("pointermove", { ...init, clientX: box.left + 40, clientY: y }),
      );
      // Held ten pixels from the view's end.
      element.dispatchEvent(
        new PointerEvent("pointermove", { ...init, clientX: view.right - 10, clientY: y }),
      );
    });
    const before = Number(element.style.translate.split("px")[0]);
    for (let frame = 0; frame < 6; frame++) {
      await act(async () => {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      });
    }
    expect(viewport.scrollLeft).toBeGreaterThan(30);
    // The clip went on moving with the track, under a pointer that didn't.
    expect(Number(element.style.translate.split("px")[0])).toBeGreaterThan(before + 30);
    const scrolled = viewport.scrollLeft;
    drop(container, "v1");
    // Scrolling stops with the drag.
    for (let frame = 0; frame < 3; frame++) {
      await act(async () => {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      });
    }
    expect(viewport.scrollLeft).toBe(scrolled);
  });
});
