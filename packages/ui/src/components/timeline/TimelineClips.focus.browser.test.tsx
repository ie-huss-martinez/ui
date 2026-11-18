import { act, createRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanUp, loadStyles, mount } from "../../test/dom.js";
import { Timeline } from "./Timeline.js";
import { type TimelineClip, TimelineClips, type TimelineClipsHandle } from "./TimelineClips.js";
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

const clipsOf = (lane: string): TimelineClip[] =>
  [100, 100, 100].map((length, index) => ({
    key: `${lane}${index + 1}`,
    length,
    label: `${lane} ${index + 1}`,
    content: `${lane} ${index + 1}`,
  }));

const voiceHandle = createRef<TimelineClipsHandle>();

interface Options {
  readonly mode?: "single" | "multiple";
  readonly first?: readonly string[];
  readonly onChange?: (keys: readonly string[]) => void;
  readonly onMove?: (keys: readonly string[], direction: -1 | 1) => void;
}

/** Two lanes sharing one controlled selection, as an editor's tracks do. */
function Fixture({ mode = "single", first = [], onChange, onMove }: Options) {
  const [selected, setSelected] = useState(first);
  const [frame, setFrame] = useState(0);
  const change = (keys: readonly string[]) => {
    onChange?.(keys);
    setSelected(keys);
  };
  return (
    <div style={{ inlineSize: "1000px" }}>
      <button type="button">Before</button>
      <Timeline label="Timeline" length={300}>
        <TimelinePlayhead label="Playhead" position={frame} onPositionChange={setFrame} />
        {["voice", "music"].map((lane) => (
          <TimelineLane key={lane} id={lane} label={`${lane} track`}>
            <TimelineClips
              ref={lane === "voice" ? voiceHandle : undefined}
              label={`${lane} clips`}
              clips={clipsOf(lane)}
              selectionMode={mode}
              selectedKeys={selected}
              onSelectedKeysChange={change}
              onMove={onMove}
            />
          </TimelineLane>
        ))}
      </Timeline>
    </div>
  );
}

const clip = (container: HTMLElement, key: string) =>
  container.querySelector(`[data-hm-key="${key}"]`) as HTMLElement;
const selected = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[role="option"][aria-selected="true"]')].map(
    (element) => element.dataset["hmKey"],
  );
const focused = () => (document.activeElement as HTMLElement | null)?.dataset["hmKey"];

/** Tabs from the button before the timeline, past the playhead, onto the first lane's clips. */
async function tabIntoClips(): Promise<void> {
  (page.getByRole("button", { name: "Before" }).element() as HTMLElement).focus();
  await userEvent.tab();
  await userEvent.tab();
}

describe("TimelineClips, single selection follows focus", () => {
  it("selects the clip that Tab lands on when nothing is selected", async () => {
    const onChange = vi.fn();
    const container = render(<Fixture onChange={onChange} />);
    await tabIntoClips();
    expect(focused()).toBe("voice1");
    expect(onChange.mock.calls).toEqual([[["voice1"]]]);
    expect(selected(container)).toEqual(["voice1"]);
  });

  it("calls nothing when Tab returns to the clip that's already the selection", async () => {
    const onChange = vi.fn();
    render(<Fixture first={["voice2"]} onChange={onChange} />);
    await tabIntoClips();
    expect(focused()).toBe("voice2");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("selects the clip focusClip focuses, and the one a host focuses itself", () => {
    const onChange = vi.fn();
    const container = render(<Fixture onChange={onChange} />);
    act(() => {
      voiceHandle.current?.focusClip("voice3");
    });
    expect(selected(container)).toEqual(["voice3"]);
    act(() => clip(container, "music2").focus());
    // One selection for the timeline: the other lane's clip replaces it.
    expect(selected(container)).toEqual(["music2"]);
    expect(onChange.mock.calls).toEqual([[["voice3"]], [["music2"]]]);
  });

  it("still moves focus without selecting with Ctrl or ⌘, along a lane and between lanes", async () => {
    const onChange = vi.fn();
    const container = render(<Fixture first={["voice1"]} onChange={onChange} />);
    act(() => clip(container, "voice1").focus());
    await userEvent.keyboard("{Control>}{ArrowRight}{/Control}");
    expect(focused()).toBe("voice2");
    await userEvent.keyboard("{Control>}{ArrowDown}{/Control}");
    expect(focused()).toBe("music2");
    expect(onChange).not.toHaveBeenCalled();
    expect(selected(container)).toEqual(["voice1"]);
    // And a plain arrow selects, as before.
    await userEvent.keyboard("{ArrowRight}");
    expect(selected(container)).toEqual(["music3"]);
  });

  it("leaves a quietly focused clip unselected when it moves and focus is put back", async () => {
    const onChange = vi.fn();
    const container = render(
      <Fixture first={["voice1"]} onChange={onChange} onMove={() => undefined} />,
    );
    act(() => clip(container, "voice1").focus());
    await userEvent.keyboard("{Control>}{ArrowRight}{/Control}");
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(focused()).toBe("voice2");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("calls nothing when a click lands on the clip that's already the selection", async () => {
    const onChange = vi.fn();
    const container = render(<Fixture first={["voice2"]} onChange={onChange} />);
    await userEvent.click(clip(container, "voice2"));
    expect(onChange).not.toHaveBeenCalled();
    // A click elsewhere selects once, though focus and the click both see it.
    await userEvent.click(clip(container, "music1"));
    expect(onChange.mock.calls).toEqual([[["music1"]]]);
  });
});

describe("TimelineClips, multiple selection is unchanged", () => {
  it("doesn't select on Tab, focusClip or a host's focus", async () => {
    const onChange = vi.fn();
    const container = render(<Fixture mode="multiple" onChange={onChange} />);
    await tabIntoClips();
    expect(focused()).toBe("voice1");
    act(() => {
      voiceHandle.current?.focusClip("voice3");
    });
    act(() => clip(container, "music2").focus());
    expect(onChange).not.toHaveBeenCalled();
    expect(selected(container)).toEqual([]);
  });
});
