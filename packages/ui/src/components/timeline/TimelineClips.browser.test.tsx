import { act, createRef, useState } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanUp, loadStyles, mount, track } from "../../test/dom.js";
import { Timeline, type TimelineScale, useTimelineScale } from "./Timeline.js";
import { type TimelineClip, TimelineClips, type TimelineClipsHandle } from "./TimelineClips.js";
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

const five = (): TimelineClip[] =>
  [60, 30, 90, 60, 60].map((length, index) => ({
    key: `c${index + 1}`,
    length,
    label: `Clip ${index + 1} of 5`,
    content: `Clip ${index + 1}`,
  }));

let scale: TimelineScale;
function Probe() {
  scale = useTimelineScale();
  return null;
}

let setClips: (clips: TimelineClip[]) => void;
const handle = createRef<TimelineClipsHandle>();

interface Options {
  readonly mode?: "single" | "multiple";
  readonly first?: readonly string[];
  readonly onChange?: (keys: readonly string[]) => void;
  readonly dir?: "ltr" | "rtl";
  readonly zoom?: number;
  readonly start?: TimelineClip[];
}

/** A 600-pixel timeline with a clip track that keeps its own selection, and a playhead. */
function Fixture({ mode = "single", first = ["c2"], onChange, dir = "ltr", zoom, start }: Options) {
  const [clips, set] = useState(start ?? five);
  const [selected, setSelected] = useState(first);
  const [frame, setFrame] = useState(0);
  setClips = set;
  const length = clips.reduce((sum, clip) => sum + clip.length, 0);
  return (
    <div dir={dir} style={{ inlineSize: "600px" }}>
      <button type="button">Before</button>
      <Timeline label="Timeline" length={length} zoom={zoom}>
        <Probe />
        <TimelineClips
          ref={handle}
          label="Clips"
          clips={clips}
          selectionMode={mode}
          selectedKeys={selected}
          onSelectedKeysChange={(keys) => {
            onChange?.(keys);
            setSelected(keys);
          }}
        />
        <TimelinePlayhead label="Playhead" position={frame} onPositionChange={setFrame} />
      </Timeline>
      <input type="text" aria-label="Name" />
    </div>
  );
}

const clip = (container: HTMLElement, key: string) =>
  container.querySelector(`[data-hm-key="${key}"]`) as HTMLElement;
const selected = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[role="option"][aria-selected="true"]')].map(
    (element) => element.dataset["hmKey"],
  );
const tabStops = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[role="option"][tabindex="0"]')].map(
    (element) => element.dataset["hmKey"],
  );
const focused = () => (document.activeElement as HTMLElement | null)?.dataset["hmKey"];

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

describe("TimelineClips", () => {
  it("is a named, horizontal listbox whose options are named and one is selected", async () => {
    render(<Fixture />);
    const list = page.getByRole("listbox", { name: "Clips" });
    await expect.element(list).toHaveAttribute("aria-orientation", "horizontal");
    expect(list.getByRole("option").elements()).toHaveLength(5);
    await expect
      .element(list.getByRole("option", { selected: true }))
      .toHaveAccessibleName("Clip 2 of 5");
  });

  it("sizes each clip to its length, in the first frame committed", () => {
    // No waiting: the sizes are there as soon as render returns.
    const container = render(<Fixture />);
    expect(scale.pixelsPerUnit).toBeGreaterThan(0);
    const widths = five().map((_, index) => clip(container, `c${index + 1}`).offsetWidth);
    const unit = (widths[1] as number) / 30;
    expect(unit).toBeCloseTo(scale.pixelsPerUnit, 1);
    expect(widths.map((width) => Math.round(width / unit))).toEqual([60, 30, 90, 60, 60]);
    // Together they fill the track exactly, and the track is sized too.
    const trackElement = container.querySelector(".hm-timeline-track") as HTMLElement;
    expect(trackElement.style.inlineSize).not.toBe("");
    expect(clip(container, "c5").getBoundingClientRect().right).toBeCloseTo(
      trackElement.getBoundingClientRect().right,
      0,
    );
  });

  it("has one Tab stop, on the selected clip, then the playhead", async () => {
    const container = render(<Fixture />);
    expect(tabStops(container)).toEqual(["c2"]);
    (page.getByRole("button", { name: "Before" }).element() as HTMLElement).focus();
    await userEvent.tab();
    expect(focused()).toBe("c2");
    await userEvent.tab();
    expect(document.activeElement).toBe(container.querySelector('input[type="range"]'));
    await userEvent.tab();
    expect(document.activeElement).toBe(container.querySelector('input[type="text"]'));
  });

  it("moves between clips with ← and →, Home and End, selects, and doesn't wrap", async () => {
    const onChange = vi.fn();
    const container = render(<Fixture onChange={onChange} />);
    clip(container, "c2").focus();
    expect(await press("{ArrowRight}")).toEqual(TAKEN);
    expect(focused()).toBe("c3");
    expect(selected(container)).toEqual(["c3"]);
    expect(await press("{End}")).toEqual(TAKEN);
    expect(focused()).toBe("c5");
    // At the last clip the key is still taken.
    expect(await press("{ArrowRight}")).toEqual(TAKEN);
    expect(focused()).toBe("c5");
    expect(await press("{Home}")).toEqual(TAKEN);
    expect(await press("{ArrowLeft}")).toEqual(TAKEN);
    expect(focused()).toBe("c1");
    expect(onChange.mock.calls).toEqual([[["c3"]], [["c5"]], [["c1"]]]);
    expect(tabStops(container)).toEqual(["c1"]);
  });

  it("swaps ← and → in right-to-left text, where time runs leftward", async () => {
    const container = render(<Fixture dir="rtl" />);
    clip(container, "c2").focus();
    await press("{ArrowLeft}");
    expect(focused()).toBe("c3");
    await press("{ArrowRight}{ArrowRight}");
    expect(focused()).toBe("c1");
    // And the clips are laid out from the right.
    expect(clip(container, "c1").getBoundingClientRect().left).toBeGreaterThan(
      clip(container, "c2").getBoundingClientRect().left,
    );
  });

  it("moves without selecting with Ctrl or ⌘, and selects with Space or Enter, when single", async () => {
    const onChange = vi.fn();
    const container = render(<Fixture onChange={onChange} />);
    clip(container, "c2").focus();
    expect(await press("{Control>}{ArrowRight}{/Control}")).toEqual(TAKEN);
    expect(await press("{Meta>}{End}{/Meta}")).toEqual(TAKEN);
    expect(focused()).toBe("c5");
    expect(onChange).not.toHaveBeenCalled();
    expect(selected(container)).toEqual(["c2"]);
    expect(await press(" ")).toEqual(TAKEN);
    expect(selected(container)).toEqual(["c5"]);
    await press("{Control>}{Home}{/Control}{Enter}");
    expect(selected(container)).toEqual(["c1"]);
    // Shift is for several clips, which a single selection doesn't have.
    expect((await press("{Shift>}{ArrowRight}{/Shift}")).prevented).toBe(false);
    expect(selected(container)).toEqual(["c1"]);
  });

  it("extends, toggles and selects all when multiple", async () => {
    const onChange = vi.fn();
    const container = render(<Fixture mode="multiple" onChange={onChange} />);
    expect(container.querySelector('[role="listbox"]')?.getAttribute("aria-multiselectable")).toBe(
      "true",
    );
    clip(container, "c2").focus();
    // Shift extends from the clip last chosen, in either direction.
    expect(await press("{Shift>}{ArrowRight}{ArrowRight}{/Shift}")).toEqual(TAKEN);
    expect(selected(container)).toEqual(["c2", "c3", "c4"]);
    await press("{Shift>}{Home}{/Shift}");
    expect(selected(container)).toEqual(["c1", "c2"]);
    // An arrow alone starts again from where it lands.
    await press("{ArrowRight}");
    expect(selected(container)).toEqual(["c2"]);
    // Ctrl moves without selecting, and Space adds or removes the focused clip.
    await press("{Control>}{ArrowRight}{ArrowRight}{/Control}");
    expect(selected(container)).toEqual(["c2"]);
    expect(await press(" ")).toEqual(TAKEN);
    expect(selected(container)).toEqual(["c2", "c4"]);
    await press("{Control>} {/Control}");
    expect(selected(container)).toEqual(["c2"]);
    // Shift+Space selects from the clip last chosen to the focused one.
    await press("{Control>}{End}{/Control}{Shift>} {/Shift}");
    expect(selected(container)).toEqual(["c4", "c5"]);
    expect(await press("{Control>}a{/Control}")).toEqual(TAKEN);
    expect(selected(container)).toEqual(["c1", "c2", "c3", "c4", "c5"]);
    await press("{Meta>}a{/Meta}");
    await press("{Enter}");
    expect(selected(container)).toEqual(["c5"]);
  });

  it("selects on a click, and with Shift and Ctrl or ⌘ when multiple", async () => {
    const container = render(<Fixture mode="multiple" />);
    await userEvent.click(clip(container, "c4"));
    expect(selected(container)).toEqual(["c4"]);
    expect(tabStops(container)).toEqual(["c4"]);
    await userEvent.click(clip(container, "c2"), { modifiers: ["Shift"] });
    expect(selected(container)).toEqual(["c2", "c3", "c4"]);
    await userEvent.click(clip(container, "c3"), { modifiers: ["ControlOrMeta"] });
    expect(selected(container)).toEqual(["c2", "c4"]);

    // Single: the modifiers do nothing special.
    act(() => root?.render(<Fixture key="single" />));
    await userEvent.click(clip(container, "c4"), { modifiers: ["Shift"] });
    expect(selected(container)).toEqual(["c4"]);
  });

  it("leaves a press on a clip to the clip: the playhead doesn't move", async () => {
    const container = render(<Fixture />);
    await userEvent.click(clip(container, "c4"));
    expect((container.querySelector('input[type="range"]') as HTMLInputElement).value).toBe("0");
  });

  it("takes no key with Shift and Ctrl together, in a field, or that it doesn't know", async () => {
    const onChange = vi.fn();
    const container = render(<Fixture mode="multiple" onChange={onChange} />);
    clip(container, "c2").focus();
    for (const keys of [
      "{Alt>}{Home}{/Alt}",
      "{Alt>}{ArrowUp}{/Alt}",
      "{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}",
      "{Alt>}{Control>}{ArrowRight}{/Control}{/Alt}",
      "{BracketLeft}",
      "{Alt>}{BracketRight}{/Alt}",
      "{Shift>}{Control>}{ArrowRight}{/Control}{/Shift}",
      "{ArrowDown}",
      "x",
      "{Delete}",
    ]) {
      expect((await press(keys)).prevented, keys).toBe(false);
    }
    (container.querySelector('input[type="text"]') as HTMLElement).focus();
    for (const keys of ["{ArrowRight}", "{Home}", " ", "{Control>}a{/Control}"]) {
      expect((await press(keys)).prevented, keys).toBe(false);
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it("gives the clips' boundaries to the timeline as snap targets", () => {
    render(<Fixture zoom={6} />);
    const reach = Math.round(8 / scale.pixelsPerUnit);
    expect(reach).toBeGreaterThanOrEqual(1);
    // Boundaries are at 60, 90, 180, 240 and 300.
    expect(scale.snap(90 + reach)).toBe(90);
    expect(scale.snap(180 - reach)).toBe(180);
    expect(scale.snap(120)).toBe(120);
    act(() => setClips([{ key: "x", length: 130, label: "One" }, ...five().slice(1)]));
    expect(scale.snap(130 + reach)).toBe(130);
  });

  it("moves focus to the clip that takes a removed clip's place, then the one before, then the playhead", async () => {
    const container = render(<Fixture />);
    clip(container, "c3").focus();
    act(() => setClips(five().filter((item) => item.key !== "c3")));
    expect(focused()).toBe("c4");
    // The last clip's place is taken by the one before it.
    clip(container, "c5").focus();
    act(() => setClips(five().filter((item) => item.key !== "c3" && item.key !== "c5")));
    expect(focused()).toBe("c4");
    // With no clips left, the playhead.
    act(() => setClips([]));
    expect(document.activeElement).toBe(container.querySelector('input[type="range"]'));
  });

  it("doesn't take focus when a clip goes while focus is elsewhere", async () => {
    const container = render(<Fixture />);
    clip(container, "c3").focus();
    const before = page.getByRole("button", { name: "Before" }).element() as HTMLElement;
    before.focus();
    act(() => setClips(five().filter((item) => item.key !== "c3")));
    expect(document.activeElement).toBe(before);

    // Nor when focus was left on nothing, by a click on the page.
    clip(container, "c4").focus();
    act(() => (document.activeElement as HTMLElement).blur());
    await Promise.resolve();
    act(() => setClips(five().filter((item) => item.key !== "c3" && item.key !== "c4")));
    expect(document.activeElement).toBe(document.body);
  });

  it("focuses a clip through its ref, and scrolls it into view", () => {
    const container = render(<Fixture zoom={6} />);
    const viewport = container.querySelector(".hm-timeline-viewport") as HTMLElement;
    expect(viewport.scrollLeft).toBe(0);
    let found = false;
    act(() => {
      found = handle.current?.focusClip("c5") ?? false;
    });
    expect(found).toBe(true);
    expect(focused()).toBe("c5");
    expect(viewport.scrollLeft).toBeGreaterThan(0);
    const box = clip(container, "c5").getBoundingClientRect();
    const view = viewport.getBoundingClientRect();
    expect(box.left).toBeGreaterThanOrEqual(view.left - 1);
    expect(box.left).toBeLessThan(view.right);
    expect(handle.current?.focusClip("nope")).toBe(false);
  });

  it("shows a selected clip with a thicker border as well as a colour, and a focus ring", async () => {
    const container = render(<Fixture />);
    const plain = getComputedStyle(clip(container, "c1"));
    const chosen = getComputedStyle(clip(container, "c2"));
    expect(chosen.backgroundColor).not.toBe(plain.backgroundColor);
    expect(chosen.borderTopColor).not.toBe(plain.borderTopColor);
    expect(Number.parseFloat(chosen.borderTopWidth)).toBeGreaterThan(
      Number.parseFloat(plain.borderTopWidth),
    );
    (page.getByRole("button", { name: "Before" }).element() as HTMLElement).focus();
    await userEvent.tab();
    expect(getComputedStyle(clip(container, "c2")).outlineStyle).toBe("solid");
  });

  it("cuts off what a clip shows where the clip ends", () => {
    const container = render(
      <Fixture
        start={[
          { key: "short", length: 1, label: "Short", content: "A long name that can't fit" },
          { key: "long", length: 299, label: "Long", content: "Long" },
        ]}
      />,
    );
    const short = clip(container, "short");
    expect(short.offsetWidth).toBeLessThan(10);
    expect(short.scrollWidth).toBeGreaterThan(short.clientWidth);
    expect(getComputedStyle(short).overflow).toBe("hidden");
  });

  // What keeps a long track quick is asserted as what changes, not as a
  // time: a time depends on what else the machine is doing. The measured
  // times are in docs/adr/0011.
  it("changes only the two clips a key moves between, among 2,000", async () => {
    const many: TimelineClip[] = Array.from({ length: 2000 }, (_, index) => ({
      key: `k${index}`,
      length: 48,
      label: `Clip ${index + 1} of 2000`,
      content: `Clip ${index + 1}`,
    }));
    const container = render(<Fixture start={many} first={["k0"]} zoom={40} />);
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(2000);

    clip(container, "k0").focus();
    const mutated = new Set<Node>();
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        mutated.add(record.target);
      }
    });
    observer.observe(container.querySelector('[role="listbox"]') as Node, {
      attributes: true,
      subtree: true,
    });
    act(() => {
      clip(container, "k0").dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }),
      );
    });
    await Promise.resolve();
    observer.disconnect();
    expect(focused()).toBe("k1");
    // Only the clip left and the clip reached change.
    expect([...mutated].map((node) => (node as HTMLElement).dataset["hmKey"]).sort()).toEqual([
      "k0",
      "k1",
    ]);
  });

  it("hydrates without errors or warnings", () => {
    const app = <Fixture mode="multiple" first={["c2", "c3"]} />;
    const container = mount(renderToString(app));
    const consoleError = vi.spyOn(console, "error");
    const recoverable: unknown[] = [];
    act(() => {
      root = hydrateRoot(container, app, { onRecoverableError: (e) => recoverable.push(e) });
    });
    expect(recoverable).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
    expect(container.querySelector("[data-hm-measured]")).not.toBeNull();
  });
});
