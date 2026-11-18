import { act, useState } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { addStyle, cleanUp, loadStyles, mount, track as tracked } from "../../test/dom.js";
import {
  Timeline,
  type TimelineLanes,
  TimelineLayer,
  type TimelineScale,
  useTimelineLanes,
  useTimelineScale,
} from "./Timeline.js";
import { type TimelineClip, TimelineClips } from "./TimelineClips.js";
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

/** A frame for the ResizeObserver, and the render it causes. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  });
}

let scale: TimelineScale;
let lanesApi: TimelineLanes;
function Probe() {
  scale = useTimelineScale();
  lanesApi = useTimelineLanes();
  return <div data-testid="over" style={{ blockSize: "100%" }} />;
}

interface Track {
  readonly id: string;
  readonly name: string;
  /** Clip lengths, back to back. */
  readonly clips: readonly number[];
}

const THREE: Track[] = [
  { id: "voice", name: "Voice", clips: [60, 60, 60, 60, 60] },
  { id: "music", name: "Music", clips: [150, 150] },
  { id: "effects", name: "Effects", clips: [100, 100, 100] },
];

const clipsOf = (lane: Track): TimelineClip[] =>
  lane.clips.map((length, index) => ({
    key: `${lane.id}${index + 1}`,
    length,
    label: `Clip ${index + 1} of ${lane.clips.length} on ${lane.name}`,
    content: `${lane.name} ${index + 1}`,
  }));

let setTracks: (tracks: Track[]) => void;

interface Options {
  readonly tracks?: Track[];
  readonly width?: number;
  readonly zoom?: number;
  readonly dir?: "ltr" | "rtl";
  readonly mode?: "single" | "multiple";
  readonly first?: readonly string[];
  readonly headers?: boolean;
  readonly onChange?: (keys: readonly string[]) => void;
  readonly onMove?: (keys: readonly string[], direction: -1 | 1) => void;
}

/** An editor with lanes: one selection for all of them, and a playhead written first. */
function Fixture({
  tracks: start = THREE,
  width = 1000,
  zoom,
  dir = "ltr",
  mode = "single",
  first = ["voice2"],
  headers = true,
  onChange,
  onMove,
}: Options) {
  const [tracks, set] = useState(start);
  const [selected, setSelected] = useState(first);
  const [frame, setFrame] = useState(0);
  setTracks = set;
  return (
    <div dir={dir} style={{ inlineSize: `${width}px` }}>
      <button type="button">Before</button>
      <Timeline label="Timeline" length={300} zoom={zoom} className="probe-timeline">
        <TimelinePlayhead label="Playhead" position={frame} onPositionChange={setFrame} />
        {tracks.map((lane) => (
          <TimelineLane
            key={lane.id}
            id={lane.id}
            label={`${lane.name} track`}
            header={
              headers ? (
                <>
                  <span>{lane.name}</span>
                  <button type="button" aria-pressed="false">
                    Mute {lane.name}
                  </button>
                  <button type="button" aria-pressed="false">
                    Solo {lane.name}
                  </button>
                </>
              ) : undefined
            }
          >
            <TimelineLayer data-testid={`layer-${lane.id}`} />
            <TimelineClips
              label={`${lane.name} clips`}
              clips={clipsOf(lane)}
              selectionMode={mode}
              selectedKeys={selected}
              onSelectedKeysChange={(keys) => {
                onChange?.(keys);
                setSelected(keys);
              }}
              onMove={onMove}
            />
          </TimelineLane>
        ))}
        {/* Over every lane, and out of the pointer's way, as a drawing is. */}
        <TimelineLayer style={{ pointerEvents: "none" }}>
          <Probe />
        </TimelineLayer>
      </Timeline>
      <input type="text" aria-label="Name" />
    </div>
  );
}

const lane = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-hm-lane="${id}"]`) as HTMLElement;
const header = (container: HTMLElement, id: string) =>
  lane(container, id).querySelector(".hm-timeline-lane-header") as HTMLElement;
const clip = (container: HTMLElement, key: string) =>
  container.querySelector(`[data-hm-key="${key}"]`) as HTMLElement;
const viewport = (container: HTMLElement) =>
  container.querySelector(".hm-timeline-viewport") as HTMLElement;
const track = (container: HTMLElement) =>
  container.querySelector(".hm-timeline-track") as HTMLElement;
const timeline = (container: HTMLElement) => container.querySelector(".hm-timeline") as HTMLElement;
const selected = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[role="option"][aria-selected="true"]')].map(
    (element) => element.dataset["hmKey"],
  );
const focused = () => (document.activeElement as HTMLElement | null)?.dataset["hmKey"];
const box = (element: Element) => element.getBoundingClientRect();

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

describe("TimelineLane", () => {
  it("is a named group, holding a toolbar of the same name and its clips' listbox", async () => {
    render(<Fixture />);
    const music = page.getByRole("group", { name: "Music track" });
    await expect.element(music).toBeVisible();
    await expect.element(music.getByRole("toolbar", { name: "Music track" })).toBeVisible();
    await expect.element(music.getByRole("listbox", { name: "Music clips" })).toBeVisible();
    expect(page.getByRole("group").elements()).toHaveLength(3);
    expect(page.getByRole("slider").elements()).toHaveLength(1);
  });

  it("stacks the lanes in the order written, under the slider, in the first frame committed", () => {
    // No waiting: the rows and sizes are there as soon as render returns.
    const container = render(<Fixture />);
    expect(timeline(container).dataset["hmLanes"]).toBe("beside");
    const slider = box(container.querySelector('input[type="range"]') as Element);
    const tops = THREE.map(({ id }) => box(lane(container, id)).top);
    expect(tops[0]).toBeGreaterThanOrEqual(slider.bottom - 1);
    expect(tops[1]).toBeGreaterThanOrEqual(box(lane(container, "voice")).bottom - 1);
    expect(tops[2]).toBeGreaterThanOrEqual(box(lane(container, "music")).bottom - 1);
    // Each lane's layer and clips share its row.
    for (const { id } of THREE) {
      const row = box(lane(container, id));
      expect(box(container.querySelector(`[data-testid="layer-${id}"]`) as Element).top).toBe(
        box(clip(container, `${id}1`)).top,
      );
      expect(row.height).toBeGreaterThanOrEqual(24);
    }
    // The playhead's line runs down every lane.
    const line = box(container.querySelector(".hm-timeline-playhead-line") as Element);
    expect(line.bottom).toBeGreaterThanOrEqual(box(lane(container, "effects")).bottom - 1);
    expect(line.top).toBeLessThanOrEqual(slider.top + 1);
  });

  it("gives the headers one column, as wide as the widest, before the first unit", () => {
    const container = render(<Fixture />);
    const widths = THREE.map(({ id }) => box(header(container, id)).width);
    const widest = Math.max(
      ...THREE.map(
        ({ id }) => box(lane(container, id).querySelector('[role="toolbar"]') as Element).width,
      ),
    );
    expect(widths[0]).toBeGreaterThan(60);
    expect(new Set(widths.map((width) => Math.round(width))).size).toBe(1);
    expect(widths[0]).toBeGreaterThanOrEqual(widest - 0.5);
    expect(widths[0]).toBeLessThan(widest + 1.5);
    // Every header starts at the viewport's edge, and the first clip after it.
    const view = box(viewport(container));
    for (const { id } of THREE) {
      expect(box(header(container, id)).left).toBeCloseTo(view.left, 0);
      expect(box(clip(container, `${id}1`)).left).toBeGreaterThanOrEqual(
        box(header(container, id)).right,
      );
    }
    // The timeline's length still fits what's left: nothing scrolls sideways.
    expect(viewport(container).scrollWidth).toBe(viewport(container).clientWidth);
    expect(scale.pixelsPerUnit).toBeCloseTo(box(track(container)).width / 300, 6);
    expect(box(track(container)).width).toBeLessThan(view.width - (widths[0] as number));
  });

  it("keeps the headers in view as the timeline scrolls, and maps pointers to units as before", () => {
    const container = render(<Fixture zoom={4} />);
    const view = box(viewport(container));
    viewport(container).scrollLeft = 600;
    expect(viewport(container).scrollLeft).toBe(600);
    for (const { id } of THREE) {
      expect(box(header(container, id)).left).toBeCloseTo(view.left, 0);
    }
    // The clips went under the headers.
    expect(box(clip(container, "voice1")).left).toBeLessThan(view.left);
    // A unit's pixel and a pixel's unit still agree.
    for (const unit of [120, 150, 200]) {
      const x = box(track(container)).left + scale.toPixels(unit);
      expect(scale.unitAt(x)).toBe(unit);
    }
    // What's in view starts at the headers' edge, not under them: the first
    // unit is the one that edge cuts through, or the next.
    const range = scale.visibleRange();
    const firstVisible = box(track(container)).left + scale.toPixels(range.start);
    const edge = box(header(container, "voice")).right;
    expect(firstVisible).toBeGreaterThan(edge - scale.pixelsPerUnit - 1);
    expect(firstVisible).toBeLessThan(edge + scale.pixelsPerUnit + 1);
  });

  it("puts the headers at the other end in right-to-left text", () => {
    const container = render(<Fixture dir="rtl" zoom={4} />);
    const view = box(viewport(container));
    viewport(container).scrollLeft = -400;
    for (const { id } of THREE) {
      expect(box(header(container, id)).right).toBeCloseTo(view.right, 0);
    }
    expect(box(clip(container, "music2")).right).toBeLessThan(
      box(clip(container, "music1")).left + 1,
    );
  });

  it("has two Tab stops a lane, its header then its clips, after the playhead", async () => {
    const container = render(<Fixture />);
    (page.getByRole("button", { name: "Before" }).element() as HTMLElement).focus();
    const stops: string[] = [];
    for (let stop = 0; stop < 8; stop++) {
      await userEvent.tab();
      const active = document.activeElement as HTMLElement;
      stops.push(
        active.dataset["hmKey"] ??
          active.getAttribute("aria-label") ??
          active.textContent ??
          active.tagName,
      );
    }
    expect(stops).toEqual([
      "Playhead",
      "Mute Voice",
      "voice2",
      "Mute Music",
      "music1",
      "Mute Effects",
      "effects1",
      "Name",
    ]);
    // In a header, the arrows move between its controls.
    (lane(container, "voice").querySelector("button") as HTMLElement).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement?.textContent).toBe("Solo Voice");
  });

  it("moves between lanes with ↑ and ↓, to the clip nearest in time, and selects it", async () => {
    const onChange = vi.fn();
    const container = render(<Fixture onChange={onChange} />);
    // voice4 covers 180 to 240; on Music that's the second clip, from 150.
    clip(container, "voice4").focus();
    expect(await press("{ArrowDown}")).toEqual(TAKEN);
    expect(focused()).toBe("music2");
    expect(selected(container)).toEqual(["music2"]);
    // music2's middle is 225: on Effects, the third clip, from 200.
    expect(await press("{ArrowDown}")).toEqual(TAKEN);
    expect(focused()).toBe("effects3");
    // At the last lane the key is still taken, and nothing moves.
    expect(await press("{ArrowDown}")).toEqual(TAKEN);
    expect(focused()).toBe("effects3");
    await press("{ArrowUp}{ArrowUp}");
    // effects3's middle is 250, music2's 225: on Voice, the fourth clip, 180 to 240.
    expect(focused()).toBe("voice4");
    expect(await press("{ArrowUp}")).toEqual(TAKEN);
    expect(focused()).toBe("voice4");
    expect(onChange.mock.calls.map(([keys]) => keys)).toEqual([
      ["music2"],
      ["effects3"],
      ["music2"],
      ["voice4"],
    ]);
  });

  it("moves between lanes without selecting with Ctrl or ⌘, and not at all with Shift", async () => {
    const onChange = vi.fn();
    const container = render(<Fixture onChange={onChange} />);
    clip(container, "voice2").focus();
    expect(await press("{Control>}{ArrowDown}{/Control}")).toEqual(TAKEN);
    expect(focused()).toBe("music1");
    await press("{Meta>}{ArrowDown}{/Meta}");
    expect(focused()).toBe("effects1");
    expect(onChange).not.toHaveBeenCalled();
    expect(selected(container)).toEqual(["voice2"]);
    expect((await press("{Shift>}{ArrowUp}{/Shift}")).prevented).toBe(false);
    expect(focused()).toBe("effects1");
  });

  it("skips a lane with no clips", async () => {
    const container = render(
      <Fixture
        tracks={[THREE[0] as Track, { id: "empty", name: "Empty", clips: [] }, THREE[2] as Track]}
      />,
    );
    clip(container, "voice1").focus();
    await press("{ArrowDown}");
    expect(focused()).toBe("effects1");
    await press("{ArrowUp}");
    expect(focused()).toBe("voice1");
  });

  it("keeps one selection across lanes: replaced by a plain choice, kept when adding", async () => {
    const container = render(<Fixture mode="multiple" />);
    await userEvent.click(clip(container, "music1"));
    expect(selected(container)).toEqual(["music1"]);
    // Ctrl or ⌘ adds on another lane, and Space too.
    await userEvent.click(clip(container, "effects2"), { modifiers: ["ControlOrMeta"] });
    expect(selected(container).sort()).toEqual(["effects2", "music1"]);
    clip(container, "voice3").focus();
    await press(" ");
    expect(selected(container).sort()).toEqual(["effects2", "music1", "voice3"]);
    // Shift extends within the lane, and keeps the others.
    await press("{Shift>}{ArrowRight}{/Shift}");
    expect(selected(container).sort()).toEqual(["effects2", "music1", "voice3", "voice4"]);
    // Removing one keeps the rest.
    await userEvent.click(clip(container, "music1"), { modifiers: ["ControlOrMeta"] });
    expect(selected(container).sort()).toEqual(["effects2", "voice3", "voice4"]);
    // A plain choice replaces the selection on every lane.
    await userEvent.click(clip(container, "effects1"));
    expect(selected(container)).toEqual(["effects1"]);
  });

  it("moves the whole selection, on every lane, when the focused clip is in it", async () => {
    const onMove = vi.fn();
    const container = render(
      <Fixture mode="multiple" first={["voice2", "music1", "effects3"]} onMove={onMove} />,
    );
    clip(container, "music1").focus();
    await press("{Alt>}{ArrowRight}{/Alt}");
    // This lane's clips first, in order, then the others'.
    expect(onMove).toHaveBeenLastCalledWith(["music1", "voice2", "effects3"], 1);
    clip(container, "music2").focus();
    await press("{Alt>}{ArrowLeft}{/Alt}");
    expect(onMove).toHaveBeenLastCalledWith(["music2"], -1);
  });

  it("covers every lane with a layer written outside them, and tells it the lane under a pointer", () => {
    const container = render(<Fixture />);
    const over = box(container.querySelector('[data-testid="over"]') as Element);
    expect(over.top).toBeCloseTo(box(lane(container, "voice")).top, 0);
    expect(over.bottom).toBeCloseTo(box(lane(container, "effects")).bottom, 0);
    expect(over.width).toBeCloseTo(box(track(container)).width, 0);
    expect(lanesApi.lanes).toEqual(["voice", "music", "effects"]);
    for (const { id } of THREE) {
      const row = box(lane(container, id));
      expect(lanesApi.laneAt(row.top + row.height / 2)).toBe(id);
    }
    expect(lanesApi.laneAt(box(lane(container, "voice")).top - 5)).toBeUndefined();
  });

  it("follows the lanes as they're added, moved and removed, back to a timeline without lanes", () => {
    const container = render(<Fixture />);
    act(() => setTracks([THREE[2] as Track, THREE[0] as Track]));
    expect(lanesApi.lanes).toEqual(["effects", "voice"]);
    expect(box(lane(container, "effects")).bottom).toBeLessThanOrEqual(
      box(lane(container, "voice")).top + 1,
    );
    expect(container.querySelector('[data-hm-lane="music"]')).toBeNull();
    const withLanes = box(track(container)).width;

    act(() => setTracks([]));
    expect(lanesApi.lanes).toEqual([]);
    expect(timeline(container).dataset["hmLanes"]).toBeUndefined();
    expect(container.querySelector(".hm-timeline-bar")).toBeNull();
    expect(viewport(container).style.paddingInlineStart).toBe("");
    // The headers' column is gone, so the track has its room back.
    expect(box(track(container)).width).toBeGreaterThan(withLanes + 60);
    expect(viewport(container).scrollWidth).toBe(viewport(container).clientWidth);
  });

  it("widens the headers' column when a header's content grows", async () => {
    const container = render(<Fixture />);
    const before = box(header(container, "voice")).width;
    act(() =>
      setTracks([
        { ...(THREE[0] as Track), name: "A much longer name of a track" },
        ...THREE.slice(1),
      ]),
    );
    await settle();
    await settle();
    const after = box(header(container, "voice")).width;
    expect(after).toBeGreaterThan(before + 40);
    expect(box(header(container, "music")).width).toBeCloseTo(after, 0);
    expect(viewport(container).scrollWidth).toBe(viewport(container).clientWidth);
  });

  it("has no headers' column for lanes without headers", () => {
    const container = render(<Fixture headers={false} />);
    expect(container.querySelector(".hm-timeline-lane-header")).toBeNull();
    expect(container.querySelector(".hm-timeline-corner")).toBeNull();
    expect(viewport(container).style.paddingInlineStart).toBe("");
    expect(box(lane(container, "music")).top).toBeGreaterThanOrEqual(
      box(lane(container, "voice")).bottom - 1,
    );
  });

  it("puts each header above its lane where the timeline is narrower than 720 pixels", async () => {
    const container = render(<Fixture width={600} />);
    expect(timeline(container).dataset["hmLanes"]).toBe("above");
    for (const { id } of THREE) {
      expect(box(header(container, id)).bottom).toBeLessThanOrEqual(
        box(clip(container, `${id}1`)).top + 1,
      );
    }
    // No column: the clips start where the track does, and the length fits.
    expect(viewport(container).style.paddingInlineStart).toBe("");
    expect(box(clip(container, "voice1")).left).toBeCloseTo(box(track(container)).left, 0);
    expect(viewport(container).scrollWidth).toBe(viewport(container).clientWidth);

    // And beside again when there's room.
    (container.firstElementChild as HTMLElement).style.inlineSize = "1000px";
    await settle();
    await settle();
    expect(timeline(container).dataset["hmLanes"]).toBe("beside");
    expect(box(clip(container, "voice1")).left).toBeGreaterThanOrEqual(
      box(header(container, "voice")).right,
    );
  });

  it("scrolls the lanes under the slider when the timeline has a maximum height", () => {
    addStyle(".probe-timeline .hm-timeline-viewport { max-block-size: 90px; }");
    const container = render(<Fixture />);
    const view = viewport(container);
    expect(view.scrollHeight).toBeGreaterThan(view.clientHeight);
    const slider = container.querySelector('input[type="range"]') as Element;
    const before = box(slider).top;
    view.scrollTop = 40;
    expect(view.scrollTop).toBe(40);
    expect(box(slider).top).toBeCloseTo(before, 0);
    expect(box(lane(container, "voice")).top).toBeLessThan(before);
  });

  it("scrolls a focused clip out from under the headers", () => {
    const container = render(<Fixture zoom={4} />);
    viewport(container).scrollLeft = 900;
    act(() => clip(container, "voice2").focus());
    // Focus alone doesn't scroll; the arrow keys go through focusClip.
    act(() => {
      clip(container, "voice2").dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }),
      );
    });
    expect(focused()).toBe("voice1");
    expect(box(clip(container, "voice1")).left).toBeGreaterThanOrEqual(
      box(header(container, "voice")).right - 1,
    );
  });

  it("shows the headers on a background of their own, and a line between lanes, when styled", () => {
    const container = render(<Fixture />);
    const head = getComputedStyle(header(container, "voice"));
    expect(head.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(head.position).toBe("sticky");
    expect(getComputedStyle(lane(container, "music")).borderTopStyle).toBe("solid");
  });

  it("hydrates without errors or warnings, then lays its lanes out", () => {
    const app = <Fixture />;
    const container = mount(renderToString(app));
    const consoleError = vi.spyOn(console, "error");
    const recoverable: unknown[] = [];
    act(() => {
      root = hydrateRoot(container, app, { onRecoverableError: (e) => recoverable.push(e) });
    });
    expect(recoverable).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
    expect(timeline(container).dataset["hmLanes"]).toBe("beside");
    expect(box(lane(container, "music")).top).toBeGreaterThanOrEqual(
      box(lane(container, "voice")).bottom - 1,
    );
  });

  // What keeps many lanes quick is asserted as what changes, not as a time:
  // a time depends on what else the machine is doing. The measured times
  // are in docs/adr/0011.
  it("lays out 16 lanes of 125 clips, and a key changes two clips on one lane", async () => {
    const many: Track[] = Array.from({ length: 16 }, (_, index) => ({
      id: `t${index}`,
      name: `Track ${index + 1}`,
      clips: Array.from({ length: 125 }, () => 48),
    }));
    const container = render(<Fixture tracks={many} first={[]} zoom={10} />);
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(2000);
    expect(lanesApi.lanes).toHaveLength(16);
    expect(box(lane(container, "t15")).top).toBeGreaterThanOrEqual(
      box(lane(container, "t14")).bottom - 1,
    );
    // Every lane's clips are sized by the one scale.
    expect(box(clip(container, "t151")).width).toBeCloseTo(box(clip(container, "t01")).width, 1);

    clip(container, "t71").focus();
    const mutated = new Set<string | undefined>();
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const target = record.target as HTMLElement;
        // React writes a controlled input's type and name again whenever it
        // renders: the playhead's slider is React's, not the lanes'.
        if (!target.closest(".hm-timeline-playhead")) {
          mutated.add(target.dataset["hmKey"] ?? `${target.className}@${record.attributeName}`);
        }
      }
    });
    observer.observe(track(container), { attributes: true, subtree: true });
    act(() => {
      clip(container, "t71").dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }),
      );
    });
    await Promise.resolve();
    observer.disconnect();
    expect(focused()).toBe("t72");
    expect([...mutated].sort()).toEqual(["t71", "t72"]);
  });
});
