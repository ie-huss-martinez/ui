import { act, createRef, memo, useState } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanUp, loadStyles, mount } from "../../test/dom.js";
import {
  Timeline,
  TimelineLayer,
  type TimelineProps,
  type TimelineRange,
  type TimelineScale,
  useTimelineScale,
} from "./Timeline.js";
import { TimelinePlayhead, type TimelinePlayheadProps } from "./TimelinePlayhead.js";

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

/** Renders, then lets the timeline measure itself and render again. */
async function render(element: React.ReactElement): Promise<HTMLElement> {
  const container = mount("");
  await act(async () => {
    root = createRoot(container);
    root.render(element);
  });
  await settle();
  return container;
}

/** A frame for the ResizeObserver, and the render it causes. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  });
}

let scale: TimelineScale;
let layerRenders = 0;

/** A layer that hands the scale to the test, and counts its renders. */
const Probe = memo(function Probe() {
  scale = useTimelineScale();
  layerRenders++;
  return <button type="button">In a layer</button>;
});

type Options = Partial<TimelineProps> &
  Partial<Pick<TimelinePlayheadProps, "step" | "largeStep" | "seekOnPress" | "following">> & {
    readonly start?: number | undefined;
    readonly onSeek?: ((position: number) => void) | undefined;
    readonly dir?: "ltr" | "rtl";
  };

/** A 600-pixel timeline of 300 frames, with a playhead that keeps its own position. */
function Fixture({
  start = 0,
  onSeek,
  dir = "ltr",
  step,
  largeStep,
  seekOnPress,
  following,
  ...timeline
}: Options) {
  return (
    <div dir={dir} style={{ inlineSize: "600px" }}>
      <Timeline label="Timeline" length={300} {...timeline}>
        <TimelineLayer>
          <Probe />
        </TimelineLayer>
        <Playhead
          start={start}
          onSeek={onSeek}
          step={step}
          largeStep={largeStep}
          seekOnPress={seekOnPress}
          following={following}
        />
      </Timeline>
    </div>
  );
}

let seek: (position: number) => void;

/** The playhead in a component of its own, as an editor that plays has it. */
function Playhead({
  start,
  onSeek,
  ...props
}: Pick<Options, "start" | "onSeek" | "step" | "largeStep" | "seekOnPress" | "following">) {
  const [position, setPosition] = useState(start ?? 0);
  seek = setPosition;
  return (
    <TimelinePlayhead
      label="Playhead"
      position={position}
      onPositionChange={(next) => {
        onSeek?.(next);
        setPosition(next);
      }}
      formatValue={(frame) => `frame ${frame}`}
      {...props}
    />
  );
}

const track = (container: HTMLElement) =>
  container.querySelector(".hm-timeline-track") as HTMLElement;
const viewport = (container: HTMLElement) =>
  container.querySelector(".hm-timeline-viewport") as HTMLElement;
const line = (container: HTMLElement) =>
  container.querySelector(".hm-timeline-playhead-line") as HTMLElement;
const slider = (container: HTMLElement) => container.querySelector("input") as HTMLInputElement;

/** The clientX of a unit on the track, in either direction. */
function xOf(container: HTMLElement, unit: number): number {
  const box = track(container).getBoundingClientRect();
  const rtl = getComputedStyle(track(container)).direction === "rtl";
  return rtl ? box.right - scale.toPixels(unit) : box.left + scale.toPixels(unit);
}

function pressAt(container: HTMLElement, clientX: number, init: PointerEventInit = {}): void {
  const box = track(container).getBoundingClientRect();
  act(() => {
    track(container).dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX,
        clientY: box.bottom - 2,
        ...init,
      }),
    );
  });
}

describe("Timeline", () => {
  it("is a named region with a playhead slider that reads its position as text", async () => {
    await render(<Fixture start={120} />);
    await expect.element(page.getByRole("region", { name: "Timeline" })).toBeVisible();
    const playhead = page.getByRole("slider", { name: "Playhead" });
    await expect.element(playhead).toHaveValue("120");
    await expect.element(playhead).toHaveAttribute("aria-valuetext", "frame 120");
  });

  it("fits its length to its width at zoom 1, and scales with the zoom up to a cap", async () => {
    const onMaxZoomChange = vi.fn();
    const container = await render(<Fixture onMaxZoomChange={onMaxZoomChange} />);
    const room = track(container).getBoundingClientRect().width;
    // The viewport keeps half a thumb free at each end.
    expect(room).toBeGreaterThan(560);
    expect(room).toBeLessThan(600);
    expect(scale.pixelsPerUnit).toBeCloseTo(room / 300, 6);
    expect(viewport(container).scrollWidth).toBe(viewport(container).clientWidth);
    expect(onMaxZoomChange).toHaveBeenLastCalledWith(48 / (room / 300));

    await act(async () => root?.render(<Fixture zoom={2} />));
    expect(track(container).getBoundingClientRect().width).toBeCloseTo(room * 2, 1);
    expect(scale.pixelsPerUnit).toBeCloseTo((room * 2) / 300, 6);

    // Less than 1 still fits, and a huge zoom stops at maxPixelsPerUnit.
    await act(async () => root?.render(<Fixture zoom={0.2} />));
    expect(track(container).getBoundingClientRect().width).toBeCloseTo(room, 1);
    await act(async () => root?.render(<Fixture zoom={1000} maxPixelsPerUnit={10} />));
    expect(scale.pixelsPerUnit).toBe(10);
    expect(track(container).getBoundingClientRect().width).toBeCloseTo(3000, 1);
  });

  it("follows its container's width", async () => {
    const container = await render(<Fixture />);
    const before = scale.pixelsPerUnit;
    (container.firstElementChild as HTMLElement).style.inlineSize = "300px";
    await settle();
    await settle();
    expect(scale.pixelsPerUnit).toBeLessThan(before * 0.6);
    expect(viewport(container).scrollWidth).toBe(viewport(container).clientWidth);
  });

  it.each(["ltr", "rtl"] as const)(
    "maps units to pixels and back at several zooms, in %s",
    async (dir) => {
      const container = await render(<Fixture dir={dir} />);
      for (const zoom of [1, 3, 7.5]) {
        await act(async () => root?.render(<Fixture dir={dir} zoom={zoom} />));
        viewport(container).scrollLeft = 0;
        for (const unit of [0, 1, 37, 150]) {
          if (scale.toPixels(unit) < viewport(container).clientWidth) {
            expect(scale.unitAt(xOf(container, unit)), `${zoom}× unit ${unit}`).toBe(unit);
          }
        }
        // Outside the track is its first or last unit.
        expect(scale.unitAt(xOf(container, 0) + (dir === "rtl" ? 500 : -500))).toBe(0);
        expect(scale.unitAt(xOf(container, 300) + (dir === "rtl" ? -500 : 500))).toBe(300);
      }
    },
  );

  it("snaps a pointer to the playhead and to snapTargets within 8 pixels, and not beyond", async () => {
    const container = await render(<Fixture start={100} snapTargets={[200]} zoom={3} />);
    const reach = Math.round(8 / scale.pixelsPerUnit);
    expect(reach).toBeGreaterThanOrEqual(1);
    expect(scale.snap(100 + reach)).toBe(100);
    expect(scale.snap(100 + reach + 1)).toBe(100 + reach + 1);
    expect(scale.snap(200 - reach)).toBe(200);
    expect(scale.unitAt(xOf(container, 100 + reach), { snap: true })).toBe(100);
    expect(scale.unitAt(xOf(container, 100 + reach))).toBe(100 + reach);

    // The playhead's target follows it.
    act(() => seek(40));
    expect(scale.snap(40 + reach)).toBe(40);
    expect(scale.snap(100 + reach)).toBe(100 + reach);

    await act(async () =>
      root?.render(<Fixture start={100} snapTargets={[200]} zoom={3} snapping={false} />),
    );
    expect(scale.snap(200 - reach)).toBe(200 - reach);
  });

  it("moves the playhead to a press on the track, snapping unless Alt is held", async () => {
    const onSeek = vi.fn();
    const container = await render(<Fixture onSeek={onSeek} snapTargets={[200]} zoom={3} />);
    const reach = Math.round(8 / scale.pixelsPerUnit);
    pressAt(container, xOf(container, 60));
    expect(onSeek).toHaveBeenLastCalledWith(60);
    expect(slider(container).value).toBe("60");
    pressAt(container, xOf(container, 200 - reach));
    expect(onSeek).toHaveBeenLastCalledWith(200);
    pressAt(container, xOf(container, 200 - reach), { altKey: true });
    expect(onSeek).toHaveBeenLastCalledWith(200 - reach);
    // Not with another button, and not for the same unit again.
    pressAt(container, xOf(container, 10), { button: 2 });
    pressAt(container, xOf(container, 200 - reach), { altKey: true });
    expect(onSeek).toHaveBeenCalledTimes(3);
  });

  it("leaves a press on a control in a layer alone, and every press with seekOnPress off", async () => {
    const onSeek = vi.fn();
    const container = await render(<Fixture onSeek={onSeek} />);
    await userEvent.click(page.getByRole("button", { name: "In a layer" }));
    expect(onSeek).not.toHaveBeenCalled();
    await act(async () => root?.render(<Fixture onSeek={onSeek} seekOnPress={false} />));
    pressAt(container, xOf(container, 60));
    expect(onSeek).not.toHaveBeenCalled();
  });

  it("moves the playhead with the slider's keys, by step and by largeStep", async () => {
    const onSeek = vi.fn();
    const container = await render(<Fixture start={90} onSeek={onSeek} step={2} largeStep={30} />);
    slider(container).focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowLeft}{PageUp}{PageDown}{End}{Home}");
    expect(onSeek.mock.calls.map(([position]) => position)).toEqual([92, 94, 92, 122, 92, 300, 0]);
  });

  it.each(["ltr", "rtl"] as const)("draws the playhead's line at its unit, in %s", async (dir) => {
    const container = await render(<Fixture dir={dir} start={75} zoom={2} />);
    const centre = (element: Element): number => {
      const box = element.getBoundingClientRect();
      return (box.left + box.right) / 2;
    };
    expect(centre(line(container))).toBeCloseTo(xOf(container, 75), 0);
    act(() => seek(150));
    expect(centre(line(container))).toBeCloseTo(xOf(container, 150), 0);
    // The line runs the track's whole height.
    expect(line(container).getBoundingClientRect().height).toBeCloseTo(
      track(container).getBoundingClientRect().height,
      0,
    );
  });

  it("starts with the playhead in view, when the zoom puts it out of it", async () => {
    const container = await render(<Fixture zoom={5} start={250} />);
    const box = viewport(container).getBoundingClientRect();
    const x = xOf(container, 250);
    expect(viewport(container).scrollLeft).toBeGreaterThan(0);
    expect(x).toBeGreaterThan(box.left);
    expect(x).toBeLessThan(box.right);
    // In view already, it doesn't scroll.
    await act(async () => root?.render(<Fixture key="near" zoom={5} start={20} />));
    await settle();
    expect(viewport(container).scrollLeft).toBe(0);
  });

  it("keeps the playhead in view while following, and brings it back after a zoom", async () => {
    const container = await render(<Fixture zoom={5} following />);
    const visible = (): boolean => {
      const box = viewport(container).getBoundingClientRect();
      const x = xOf(container, Number(slider(container).value));
      return x >= box.left && x <= box.right;
    };
    expect(viewport(container).scrollLeft).toBe(0);
    act(() => seek(250));
    expect(viewport(container).scrollLeft).toBeGreaterThan(0);
    expect(visible()).toBe(true);

    // Without following, a seek out of view doesn't scroll; a zoom does.
    await act(async () => root?.render(<Fixture zoom={5} />));
    const before = viewport(container).scrollLeft;
    act(() => seek(10));
    expect(viewport(container).scrollLeft).toBe(before);
    expect(visible()).toBe(false);
    await act(async () => root?.render(<Fixture zoom={8} />));
    expect(visible()).toBe(true);
  });

  it("reports the units in view when the timeline scrolls or zooms", async () => {
    const ranges: TimelineRange[] = [];
    const onVisibleRangeChange = (range: TimelineRange) => ranges.push(range);
    const container = await render(<Fixture onVisibleRangeChange={onVisibleRangeChange} />);
    expect(ranges.at(-1)).toEqual({ start: 0, end: 300 });
    await act(async () =>
      root?.render(<Fixture zoom={4} onVisibleRangeChange={onVisibleRangeChange} />),
    );
    const zoomed = ranges.at(-1) as TimelineRange;
    expect(zoomed.end - zoomed.start).toBeLessThan(90);
    expect(scale.visibleRange()).toEqual(zoomed);

    // Scrolled so that unit 100 is at the viewport's edge. scrollLeft is
    // whole pixels in some engines, so the first unit in view is 99 or 100.
    const pad = Number.parseFloat(getComputedStyle(viewport(container)).paddingLeft);
    viewport(container).scrollLeft = scale.toPixels(100) + pad;
    await act(async () => {
      viewport(container).dispatchEvent(new Event("scroll"));
    });
    const scrolled = ranges.at(-1) as TimelineRange;
    expect([99, 100]).toContain(scrolled.start);
    expect(scrolled.end - scrolled.start).toBeGreaterThan(60);
    expect(scrolled.end - scrolled.start).toBeLessThan(90);
    // What's reported is what a layer would read, and unit 100 is at the edge.
    expect(scale.visibleRange()).toEqual(scrolled);
    expect(
      Math.abs(xOf(container, 100) - viewport(container).getBoundingClientRect().left),
    ).toBeLessThan(1.5);
  });

  it("renders only the playhead when the playhead moves", async () => {
    await render(<Fixture />);
    const before = layerRenders;
    for (let frame = 1; frame <= 30; frame++) {
      act(() => seek(frame));
    }
    expect(layerRenders).toBe(before);
  });

  it("stacks its layers and its playhead in one lane, with the slider above it", async () => {
    const container = await render(
      <div style={{ inlineSize: "600px" }}>
        <Timeline label="Timeline" length={300}>
          <TimelineLayer data-testid="under">
            <div style={{ blockSize: "80px" }} />
          </TimelineLayer>
          <TimelineLayer data-testid="over" />
          <TimelinePlayhead label="Playhead" position={0} onPositionChange={() => undefined} />
        </Timeline>
      </div>,
    );
    const under = container.querySelector('[data-testid="under"]') as Element;
    const over = container.querySelector('[data-testid="over"]') as Element;
    expect(over.getBoundingClientRect().top).toBe(under.getBoundingClientRect().top);
    expect(over.getBoundingClientRect().height).toBe(under.getBoundingClientRect().height);
    expect(under.getBoundingClientRect().height).toBeGreaterThanOrEqual(80);
    expect(under.getBoundingClientRect().width).toBeCloseTo(
      track(container).getBoundingClientRect().width,
      0,
    );
    expect(slider(container).getBoundingClientRect().bottom).toBeLessThanOrEqual(
      under.getBoundingClientRect().top + 1,
    );
    expect(slider(container).getBoundingClientRect().height).toBeGreaterThanOrEqual(24);
  });

  it("has no length to show without one", async () => {
    const container = await render(<Fixture length={0} />);
    expect(scale.pixelsPerUnit).toBe(0);
    expect(scale.visibleRange()).toEqual({ start: 0, end: 0 });
    expect(slider(container).max).toBe("0");
    pressAt(container, 300);
    expect(slider(container).value).toBe("0");
  });

  it("forwards refs to the region, a layer and the slider", async () => {
    const region = createRef<HTMLElement>();
    const layer = createRef<HTMLDivElement>();
    const input = createRef<HTMLInputElement>();
    await render(
      <Timeline label="Timeline" length={10} ref={region}>
        <TimelineLayer ref={layer} />
        <TimelinePlayhead
          label="Playhead"
          position={0}
          onPositionChange={() => undefined}
          ref={input}
        />
      </Timeline>,
    );
    expect(region.current?.tagName).toBe("SECTION");
    expect(layer.current?.className).toBe("hm-timeline-layer");
    expect(input.current?.type).toBe("range");
  });

  it("shows the playhead's line and the track's background only when styled", async () => {
    const container = await render(
      <div style={{ inlineSize: "600px" }}>
        <Timeline label="Styled" length={10}>
          <TimelinePlayhead label="Playhead" position={5} onPositionChange={() => undefined} />
        </Timeline>
        <Timeline label="Plain" length={10} unstyled>
          <TimelinePlayhead
            label="Playhead"
            position={5}
            onPositionChange={() => undefined}
            unstyled
          />
        </Timeline>
      </div>,
    );
    const [styled, plain] = [...container.querySelectorAll(".hm-timeline-playhead-line")];
    expect(getComputedStyle(styled as Element).borderInlineStartStyle).toBe("solid");
    expect(getComputedStyle(plain as Element).borderInlineStartStyle).toBe("none");
    const [styledTrack, plainTrack] = [...container.querySelectorAll(".hm-timeline-viewport")];
    expect(getComputedStyle(styledTrack as Element).backgroundColor).not.toBe(
      getComputedStyle(plainTrack as Element).backgroundColor,
    );
  });

  it("hydrates without errors or warnings, then sizes itself", async () => {
    const app = <Fixture start={30} zoom={2} />;
    const container = mount(renderToString(app));
    expect(track(container).getAttribute("style")).toBeNull();
    const consoleError = vi.spyOn(console, "error");
    const recoverable: unknown[] = [];
    await act(async () => {
      root = hydrateRoot(container, app, { onRecoverableError: (e) => recoverable.push(e) });
    });
    await settle();
    expect(recoverable).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
    expect(scale.pixelsPerUnit).toBeGreaterThan(0);
    expect(track(container).style.inlineSize).not.toBe("");
  });
});
