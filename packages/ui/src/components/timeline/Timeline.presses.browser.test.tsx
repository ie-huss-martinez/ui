import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanUp, loadStyles, mount } from "../../test/dom.js";
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
let lanesApi: TimelineLanes;

/** A layer under every lane that records presses, as a range selection would. */
function RangeLayer({ onPress }: { onPress: (unit: number, lane: string | undefined) => void }) {
  scale = useTimelineScale();
  lanesApi = useTimelineLanes();
  return (
    <div
      data-testid="range"
      style={{ blockSize: "100%" }}
      onPointerDown={(event) =>
        onPress(scale.unitAt(event.clientX), lanesApi.laneAt(event.clientY))
      }
    />
  );
}

const CLIPS: Record<string, TimelineClip[]> = {
  voice: [
    { key: "v1", at: 20, length: 60, label: "Voice 1", content: "Voice 1" },
    { key: "v2", at: 150, length: 100, label: "Voice 2", content: "Voice 2" },
  ],
  music: [{ key: "m1", at: 100, length: 150, label: "Music 1", content: "Music 1" }],
};

interface Options {
  readonly onPress?: (unit: number, lane: string | undefined) => void;
  readonly onSeek?: (position: number) => void;
  readonly seekOnPress?: boolean;
  readonly moveHandle?: "clip" | "title";
  readonly laneLayer?: "none" | "interactive" | "plain";
  readonly onLaneLayer?: () => void;
  readonly onHeader?: () => void;
}

function Fixture({
  onPress = () => undefined,
  onSeek,
  seekOnPress = false,
  moveHandle = "title",
  laneLayer = "none",
  onLaneLayer,
  onHeader,
}: Options) {
  const [frame, setFrame] = useState(0);
  return (
    // Within the test frame's viewport, where elementFromPoint can see it.
    <div style={{ inlineSize: "380px" }}>
      <Timeline label="Timeline" length={300}>
        <TimelinePlayhead
          label="Playhead"
          position={frame}
          seekOnPress={seekOnPress}
          onPositionChange={(next) => {
            onSeek?.(next);
            setFrame(next);
          }}
        />
        {/* Written before the lanes, so it's under them and their clips. */}
        <TimelineLayer>
          <RangeLayer onPress={onPress} />
        </TimelineLayer>
        {Object.entries(CLIPS).map(([lane, clips]) => (
          <TimelineLane
            key={lane}
            id={lane}
            label={`${lane} track`}
            header={
              <button type="button" onPointerDown={() => onHeader?.()}>
                Mute {lane}
              </button>
            }
          >
            {laneLayer === "none" ? null : (
              <TimelineLayer
                interactive={laneLayer === "interactive"}
                data-testid={`layer-${lane}`}
                style={{ blockSize: "100%" }}
                onPointerDown={() => onLaneLayer?.()}
              />
            )}
            <TimelineClips
              label={`${lane} clips`}
              clips={clips}
              selectedKeys={[]}
              onSelectedKeysChange={() => undefined}
              onDrop={() => undefined}
              onTrim={() => undefined}
              moveHandle={moveHandle}
            />
          </TimelineLane>
        ))}
      </Timeline>
    </div>
  );
}

const clip = (container: HTMLElement, key: string) =>
  container.querySelector(`[data-hm-key="${key}"]`) as HTMLElement;
const lane = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-hm-lane="${id}"]`) as HTMLElement;
const track = (container: HTMLElement) =>
  container.querySelector(".hm-timeline-track") as HTMLElement;

/** Presses at a point as a pointer does: on whatever the browser finds there. */
function pressAt(x: number, y: number): Element | null {
  const target = document.elementFromPoint(x, y);
  act(() => {
    target?.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: x,
        clientY: y,
        pointerType: "mouse",
      }),
    );
  });
  return target;
}

/** A point on a lane at a unit, in the row of its clips: below its header, where that's above. */
function at(container: HTMLElement, id: string, unit: number): [number, number] {
  const clips = lane(container, id).querySelector(".hm-timeline-clips") as HTMLElement;
  const row = clips.getBoundingClientRect();
  const left = track(container).getBoundingClientRect().left;
  return [left + scale.toPixels(unit), row.top + row.height / 2];
}

/** A point on a clip's body: below its title, and clear of its edges. */
function body(container: HTMLElement, key: string): [number, number] {
  const box = clip(container, key).getBoundingClientRect();
  return [box.left + box.width / 2, box.bottom - 3];
}

describe("Timeline, presses through lanes", () => {
  it("lets a press on a lane's empty space through to a layer under the lanes, with its unit and lane", () => {
    const onPress = vi.fn();
    const container = render(<Fixture onPress={onPress} />);
    // Voice is empty from 80 to 150; music is empty before 100.
    const target = pressAt(...at(container, "voice", 110));
    expect((target as HTMLElement).dataset["testid"]).toBe("range");
    expect(onPress).toHaveBeenLastCalledWith(110, "voice");
    pressAt(...at(container, "music", 40));
    expect(onPress).toHaveBeenLastCalledWith(40, "music");
  });

  it("lets a press on a clip's body through too, with the title as the handle", () => {
    const onPress = vi.fn();
    const container = render(<Fixture onPress={onPress} />);
    // Below the title, in the middle: the clip's body.
    pressAt(...body(container, "m1"));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress.mock.calls[0]?.[1]).toBe("music");
  });

  it("keeps presses on a clip's title and edges, on a header, and on a whole clip that's its own handle", () => {
    const onPress = vi.fn();
    const onHeader = vi.fn();
    const container = render(<Fixture onPress={onPress} onHeader={onHeader} />);
    const title = clip(container, "v2").querySelector(".hm-timeline-clip-content") as HTMLElement;
    const titleBox = title.getBoundingClientRect();
    // The title's middle: clear of the edges, which overlap its ends.
    expect(pressAt(titleBox.left + titleBox.width / 2, titleBox.top + titleBox.height / 2)).toBe(
      title,
    );
    const edge = clip(container, "v2").querySelector('[data-hm-edge="end"]') as HTMLElement;
    const edgeBox = edge.getBoundingClientRect();
    expect(pressAt(edgeBox.left + edgeBox.width / 2, edgeBox.top + edgeBox.height / 2)).toBe(edge);
    const button = lane(container, "voice").querySelector("button") as HTMLElement;
    const buttonBox = button.getBoundingClientRect();
    expect(pressAt(buttonBox.left + 4, buttonBox.top + 4)).toBe(button);
    expect(onHeader).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();

    // With the whole clip as the handle, its body is the clip's.
    act(() => root?.render(<Fixture onPress={onPress} moveHandle="clip" />));
    expect(pressAt(...body(container, "m1"))).toBe(clip(container, "m1"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("lets presses through a lane's own layer, unless it's interactive", () => {
    const onPress = vi.fn();
    const onLaneLayer = vi.fn();
    const container = render(
      <Fixture onPress={onPress} laneLayer="plain" onLaneLayer={onLaneLayer} />,
    );
    pressAt(...at(container, "voice", 110));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onLaneLayer).not.toHaveBeenCalled();

    act(() =>
      root?.render(<Fixture onPress={onPress} laneLayer="interactive" onLaneLayer={onLaneLayer} />),
    );
    const target = pressAt(...at(container, "voice", 110));
    expect((target as HTMLElement).dataset["testid"]).toBe("layer-voice");
    expect(onLaneLayer).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("still seeks on a press with seekOnPress, through the layer under the lanes", () => {
    const onSeek = vi.fn();
    const container = render(<Fixture seekOnPress onSeek={onSeek} />);
    pressAt(...at(container, "voice", 110));
    expect(onSeek).toHaveBeenLastCalledWith(110);
  });
});
