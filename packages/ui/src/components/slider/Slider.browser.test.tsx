import { act, createRef, useState } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { cleanUp, loadStyles, mount } from "../../test/dom.js";
import { IconButton } from "../button/IconButton.js";
import { Dialog } from "../dialog/Dialog.js";
import { Toolbar } from "../toolbar/Toolbar.js";
import { Slider, type SliderProps } from "./Slider.js";

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

function renderSlider(props: SliderProps = {}): HTMLInputElement {
  const container = render(<Slider label="Volume" {...props} />);
  const input = container.querySelector("input") as HTMLInputElement;
  input.focus();
  return input;
}

/** Presses each key and records the value after it. */
async function press(input: HTMLInputElement, keys: string[]): Promise<string[]> {
  const values: string[] = [];
  for (const key of keys) {
    await userEvent.keyboard(key);
    values.push(input.value);
  }
  return values;
}

function Gain() {
  const [gain, setGain] = useState(-6);
  return (
    <Slider
      label="Gain"
      min={-60}
      max={0}
      value={gain}
      onValueChange={setGain}
      formatValue={(db) => `${db} dB`}
    />
  );
}

/** A controlled gain, as an editor's track has it, with a spy on each callback. */
function Committed(props: {
  readonly onChange: (value: number) => void;
  readonly onCommit: (value: number) => void;
  readonly onCancel?: (value: number) => void;
}) {
  const [gain, setGain] = useState(0);
  return (
    <div style={{ inlineSize: "300px" }}>
      <Slider
        label="Gain"
        min={-60}
        max={12}
        value={gain}
        onValueChange={(value) => {
          props.onChange(value);
          setGain(value);
        }}
        onValueCommit={props.onCommit}
        onValueCancel={props.onCancel}
      />
      <button type="button">After</button>
    </div>
  );
}

/** A slider in an open dialog, as an editor's export settings have it. */
function InDialog(props: { readonly onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open title="Export" onOpenChange={props.onOpenChange}>
      <Slider label="Quality" defaultValue={50} />
    </Dialog>
  );
}

describe("Slider", () => {
  it("is a slider to assistive technology, named by its label", () => {
    const input = renderSlider();
    expect(input.type).toBe("range");
    expect(input.getAttribute("aria-label")).toBe("Volume");
  });

  it("moves by step with the arrow keys, and to the ends with Home and End", async () => {
    const input = renderSlider({ defaultValue: 50 });
    expect(
      await press(input, [
        "{ArrowRight}",
        "{ArrowUp}",
        "{ArrowLeft}",
        "{ArrowDown}",
        "{End}",
        "{Home}",
      ]),
    ).toEqual(["51", "52", "51", "50", "100", "0"]);
  });

  it("moves by a tenth of the range with Page Up and Page Down, or by largeStep", async () => {
    const input = renderSlider({ defaultValue: 50 });
    expect(await press(input, ["{PageUp}", "{PageDown}", "{PageDown}"])).toEqual([
      "60",
      "50",
      "40",
    ]);
    act(() => root?.unmount());
    const custom = renderSlider({ defaultValue: 50, largeStep: 25 });
    expect(await press(custom, ["{PageUp}", "{PageUp}"])).toEqual(["75", "100"]);
  });

  it("rounds the default large step to whole steps", async () => {
    const input = renderSlider({ min: 0, max: 48, step: 4, defaultValue: 0 });
    // A tenth of 48 is 4.8, so Page Up moves one step of 4.
    expect(await press(input, ["{PageUp}"])).toEqual(["4"]);
  });

  it("steps by decimals without drifting", async () => {
    const input = renderSlider({ min: 0, max: 1, step: 0.1, defaultValue: 0 });
    expect(await press(input, ["{ArrowUp}", "{ArrowUp}", "{ArrowUp}"])).toEqual([
      "0.1",
      "0.2",
      "0.3",
    ]);
  });

  it("reaches max with End and the arrow keys, with a decimal step", async () => {
    const input = renderSlider({ min: 0, max: 0.3, step: 0.1, defaultValue: 0 });
    expect(await press(input, ["{End}", "{Home}", "{ArrowUp}", "{ArrowUp}", "{ArrowUp}"])).toEqual([
      "0.3",
      "0",
      "0.1",
      "0.2",
      "0.3",
    ]);
  });

  it("stops at the ends without calling onValueChange", async () => {
    const onValueChange = vi.fn();
    const input = renderSlider({ defaultValue: 100, onValueChange });
    expect(await press(input, ["{ArrowRight}", "{PageUp}", "{End}"])).toEqual([
      "100",
      "100",
      "100",
    ]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("mirrors the arrow keys in right-to-left text, in every engine", async () => {
    const container = render(
      <div dir="rtl">
        <Slider label="Volume" defaultValue={50} />
      </div>,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    input.focus();
    expect(await press(input, ["{ArrowRight}", "{ArrowLeft}", "{ArrowLeft}", "{ArrowUp}"])).toEqual(
      ["49", "50", "51", "52"],
    );
  });

  it("follows the pointer, mirrored in right-to-left text", async () => {
    for (const dir of ["ltr", "rtl"] as const) {
      const onValueChange = vi.fn();
      const container = render(
        <div dir={dir} style={{ inlineSize: "300px" }}>
          <Slider label="Volume" defaultValue={50} onValueChange={onValueChange} />
        </div>,
      );
      const input = container.querySelector("input") as HTMLInputElement;
      const { height } = input.getBoundingClientRect();
      await userEvent.click(input, { position: { x: 2, y: height / 2 } });
      const value = Number(input.value);
      expect(onValueChange).toHaveBeenCalledWith(value);
      if (dir === "ltr") {
        expect(value).toBeLessThan(10);
      } else {
        expect(value).toBeGreaterThan(90);
      }
      act(() => root?.unmount());
      cleanUp();
    }
  });

  it("reads the value as formatValue's text, as it changes", async () => {
    const container = render(<Gain />);
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("aria-valuetext")).toBe("-6 dB");
    input.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(input.getAttribute("aria-valuetext")).toBe("-5 dB");
  });

  it("only asks to change when controlled", async () => {
    const onValueChange = vi.fn();
    const input = renderSlider({ value: 50, onValueChange });
    await userEvent.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenCalledWith(51);
    expect(input.value).toBe("50");
  });

  it("leaves keys alone when onKeyDown prevents the default", async () => {
    const onValueChange = vi.fn();
    const input = renderSlider({
      defaultValue: 50,
      onValueChange,
      onKeyDown: (event) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();
        }
      },
    });
    await userEvent.keyboard("{ArrowUp}");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input.value).toBe("50");
  });

  it("moves the same with Shift or Control held", async () => {
    const input = renderSlider({ defaultValue: 50 });
    expect(
      await press(input, ["{Shift>}{ArrowRight}{/Shift}", "{Control>}{ArrowRight}{/Control}"]),
    ).toEqual(["51", "52"]);
  });

  it("keeps its keys inside a toolbar, which still has one Tab stop", async () => {
    const container = render(
      <Toolbar label="Player">
        <IconButton label="Play" icon={<svg />} />
        <Slider label="Volume" defaultValue={50} />
      </Toolbar>,
    );
    const play = container.querySelector("button");
    const input = container.querySelector("input") as HTMLInputElement;
    await userEvent.tab();
    expect(document.activeElement).toBe(play);
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(input);
    expect(
      await press(input, ["{ArrowRight}", "{ArrowLeft}", "{ArrowLeft}", "{End}", "{Home}"]),
    ).toEqual(["51", "50", "49", "100", "0"]);
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute("tabindex")).toBe("0");
    expect(play?.getAttribute("tabindex")).toBe("-1");
  });

  it("submits its value with a form", () => {
    const container = render(
      <form>
        <Slider label="Volume" name="volume" defaultValue={30} />
      </form>,
    );
    const form = container.querySelector("form") as HTMLFormElement;
    expect(new FormData(form).get("volume")).toBe("30");
  });

  it("forwards its ref to the input", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Slider label="Volume" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("meets the target size, and keeps it unstyled", () => {
    const container = render(
      <>
        <Slider label="Styled" />
        <Slider label="Plain" unstyled />
      </>,
    );
    for (const input of container.querySelectorAll("input")) {
      expect(input.getBoundingClientRect().height).toBeGreaterThanOrEqual(24);
    }
  });

  it("drops visual styles but keeps the focus ring with unstyled", async () => {
    const container = render(
      <>
        <Slider label="Styled" />
        <Slider label="Plain" unstyled />
      </>,
    );
    const [styled, plain] = [...container.querySelectorAll("input")];
    expect(getComputedStyle(styled as Element).appearance).toBe("none");
    expect(getComputedStyle(plain as Element).appearance).not.toBe("none");
    (styled as HTMLElement).focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(plain);
    expect(getComputedStyle(plain as Element).outlineStyle).toBe("solid");
  });

  it("hydrates without errors or warnings", async () => {
    const app = <Gain />;
    const container = mount(renderToString(app));
    const consoleError = vi.spyOn(console, "error");
    const recoverable: unknown[] = [];
    act(() => {
      root = hydrateRoot(container, app, { onRecoverableError: (e) => recoverable.push(e) });
    });
    expect(recoverable).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
    const input = container.querySelector("input") as HTMLInputElement;
    input.focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(input.getAttribute("aria-valuetext")).toBe("-7 dB");
  });

  describe("Slider, onValueCommit", () => {
    function setUp() {
      const onChange = vi.fn();
      const onCommit = vi.fn();
      const container = render(<Committed onChange={onChange} onCommit={onCommit} />);
      const input = container.querySelector("input") as HTMLInputElement;
      input.focus();
      return { onChange, onCommit, input, container };
    }

    /**
     * Holds a key down as the browser does: a keydown, then repeats, each its
     * own event, with no time between them. Nothing waits, so a slow machine
     * and a fast one see the same thing.
     */
    function hold(input: HTMLInputElement, key: string, repeats: number): void {
      for (let press = 0; press <= repeats; press++) {
        act(() => {
          input.dispatchEvent(
            new KeyboardEvent("keydown", {
              key,
              bubbles: true,
              cancelable: true,
              repeat: press > 0,
            }),
          );
        });
      }
    }
    function release(input: HTMLInputElement, key: string): void {
      act(() => {
        input.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
      });
    }

    it("commits once for a key pressed and let go, with the value it ended on", async () => {
      const { onChange, onCommit } = setUp();
      await userEvent.keyboard("{ArrowRight}");
      expect(onChange.mock.calls).toEqual([[1]]);
      expect(onCommit.mock.calls).toEqual([[1]]);
      // Each press is its own gesture.
      await userEvent.keyboard("{PageUp}");
      expect(onCommit.mock.calls).toEqual([[1], [8]]);
    });

    it("commits once for a held key, however many times it repeats, with no time between", () => {
      const { onChange, onCommit, input } = setUp();
      // Thirty repeats: it reaches 12, the end, on the twelfth.
      hold(input, "ArrowRight", 30);
      expect(onChange).toHaveBeenCalledTimes(12);
      expect(onCommit).not.toHaveBeenCalled();
      release(input, "ArrowRight");
      expect(onCommit.mock.calls).toEqual([[12]]);
    });

    it("commits once when keys overlap, after the last is let go", () => {
      const { onCommit, input } = setUp();
      hold(input, "ArrowLeft", 3);
      hold(input, "PageDown", 0);
      release(input, "ArrowLeft");
      expect(onCommit).not.toHaveBeenCalled();
      release(input, "PageDown");
      expect(onCommit.mock.calls).toEqual([[-11]]);
    });

    it("commits what's pending when focus leaves before a key is let go", async () => {
      const { onCommit, input, container } = setUp();
      hold(input, "ArrowRight", 4);
      (container.querySelector("button") as HTMLElement).focus();
      expect(onCommit.mock.calls).toEqual([[5]]);
      // The key let go elsewhere commits nothing more.
      release(input, "ArrowRight");
      expect(onCommit).toHaveBeenCalledTimes(1);
    });

    it("commits nothing for a gesture that leaves the value where it was", async () => {
      const { onCommit, input } = setUp();
      await userEvent.keyboard("{End}");
      expect(onCommit.mock.calls).toEqual([[12]]);
      // At the end already: nothing moves, so nothing commits.
      hold(input, "ArrowRight", 5);
      release(input, "ArrowRight");
      await userEvent.keyboard("{End}");
      act(() => input.blur());
      expect(onCommit).toHaveBeenCalledTimes(1);
    });

    // The drag is sent as the browser sends it, as events on the input: a
    // press, the value changing as the thumb moves, a release off the slider,
    // then the input's own change. Not with the page's mouse, which other
    // test files running beside this one in the same page can move too.
    it("commits once for a pointer dragged along the slider, when it's let go off it", () => {
      const { onChange, onCommit, input } = setUp();
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      act(() => {
        input.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
      });
      for (const value of ["-24", "-10", "4", "9"]) {
        act(() => {
          setValue?.call(input, value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
      }
      expect(onChange.mock.calls).toEqual([[-24], [-10], [4], [9]]);
      expect(onCommit).not.toHaveBeenCalled();
      // Let go off the slider: the release reaches the window, not the input.
      act(() => {
        document.body.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
      });
      expect(onCommit.mock.calls).toEqual([[9]]);
      // The change that follows a release commits nothing more.
      act(() => {
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(onCommit).toHaveBeenCalledTimes(1);
    });

    it("commits once for a click on the track", async () => {
      const { onCommit, input } = setUp();
      const { height } = input.getBoundingClientRect();
      await userEvent.click(input, { position: { x: 2, y: height / 2 } });
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenLastCalledWith(Number(input.value));
      expect(Number(input.value)).toBeLessThan(-50);
    });

    it("commits when the value is set as assistive technology sets it, with input then change", () => {
      const { onCommit, input } = setUp();
      // Not the `value` property, which React watches: the native setter, as
      // the browser itself sets it.
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      act(() => {
        setValue?.call(input, "-20");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(onCommit.mock.calls).toEqual([[-20]]);
    });

    it("still calls the host's own onKeyUp, onPointerDown and onBlur", async () => {
      const onKeyUp = vi.fn();
      const onPointerDown = vi.fn();
      const onBlur = vi.fn();
      const input = renderSlider({
        onKeyUp,
        onPointerDown,
        onBlur,
        onValueCommit: () => undefined,
      });
      await userEvent.keyboard("{ArrowRight}");
      await userEvent.click(input);
      act(() => input.blur());
      expect(onKeyUp).toHaveBeenCalled();
      expect(onPointerDown).toHaveBeenCalled();
      expect(onBlur).toHaveBeenCalled();
    });
  });

  describe("Slider, Escape during a gesture", () => {
    function setUp() {
      const onChange = vi.fn();
      const onCommit = vi.fn();
      const onCancel = vi.fn();
      const container = render(
        <Committed onChange={onChange} onCommit={onCommit} onCancel={onCancel} />,
      );
      const input = container.querySelector("input") as HTMLInputElement;
      input.focus();
      return { onChange, onCommit, onCancel, input };
    }
    const key = (target: EventTarget, type: "keydown" | "keyup", name: string, repeat = false) => {
      const event = new KeyboardEvent(type, { key: name, bubbles: true, cancelable: true, repeat });
      act(() => {
        target.dispatchEvent(event);
      });
      return event;
    };
    const setValue = (input: HTMLInputElement, value: string) =>
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
          input,
          value,
        );
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });

    it("puts a held key's gesture back where it started, and commits nothing", () => {
      const { onChange, onCommit, onCancel, input } = setUp();
      for (let press = 0; press <= 4; press++) {
        key(input, "keydown", "ArrowRight", press > 0);
      }
      expect(onChange).toHaveBeenLastCalledWith(5);
      const pressed = key(input, "keydown", "Escape");
      expect(pressed.defaultPrevented).toBe(true);
      expect(onChange).toHaveBeenLastCalledWith(0);
      expect(onCancel.mock.calls).toEqual([[0]]);
      expect(input.value).toBe("0");
      // The key still held repeats, and is ignored until it's let go.
      key(input, "keydown", "ArrowRight", true);
      expect(input.value).toBe("0");
      key(input, "keyup", "ArrowRight");
      expect(onCommit).not.toHaveBeenCalled();
      // The next press is a gesture of its own.
      key(input, "keydown", "ArrowRight");
      key(input, "keyup", "ArrowRight");
      expect(onCommit.mock.calls).toEqual([[1]]);
    });

    it("puts a pointer drag back where it started, wherever focus is, and ignores the rest of it", () => {
      const { onChange, onCommit, onCancel, input } = setUp();
      // Not every engine focuses a range input on press, so focus is
      // elsewhere for the whole drag, and Escape comes from there.
      const elsewhere = input.parentElement?.querySelector("button") as HTMLButtonElement;
      act(() => elsewhere.focus());
      act(() => {
        input.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
      });
      setValue(input, "-24");
      setValue(input, "-10");
      const pressed = key(elsewhere, "keydown", "Escape");
      expect(pressed.defaultPrevented).toBe(true);
      expect(onChange).toHaveBeenLastCalledWith(0);
      expect(onCancel.mock.calls).toEqual([[0]]);
      // The pointer is still down and still moving: the thumb stays put.
      setValue(input, "6");
      expect(input.value).toBe("0");
      expect(onChange).toHaveBeenCalledTimes(3);
      act(() => {
        document.body.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(onCommit).not.toHaveBeenCalled();
      // The next drag commits as usual.
      act(() => {
        input.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 2 }));
      });
      setValue(input, "4");
      act(() => {
        document.body.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 2 }));
      });
      expect(onCommit.mock.calls).toEqual([[4]]);
    });

    it("leaves Escape alone with no gesture in progress", () => {
      const { onCancel, onChange, input } = setUp();
      key(input, "keydown", "ArrowRight");
      key(input, "keyup", "ArrowRight");
      const pressed = key(input, "keydown", "Escape");
      expect(pressed.defaultPrevented).toBe(false);
      expect(onCancel).not.toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("puts an uncontrolled slider back too", () => {
      const onValueCancel = vi.fn();
      const input = renderSlider({ defaultValue: 50, onValueCancel });
      input.focus();
      key(input, "keydown", "PageUp");
      expect(input.value).toBe("60");
      key(input, "keydown", "Escape");
      expect(input.value).toBe("50");
      expect(onValueCancel.mock.calls).toEqual([[50]]);
    });

    it("keeps a containing dialog open when Escape cancels a drag, and lets it close otherwise", async () => {
      const onOpenChange = vi.fn();
      const container = render(<InDialog onOpenChange={onOpenChange} />);
      const input = document.querySelector("dialog input") as HTMLInputElement;
      expect(container).toBeTruthy();
      input.focus();
      act(() => {
        input.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
      });
      setValue(input, "80");
      // A real key press, so the browser's own close request would follow.
      await userEvent.keyboard("{Escape}");
      expect(input.value).toBe("50");
      expect(onOpenChange).not.toHaveBeenCalled();
      act(() => {
        document.body.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
      });
      await userEvent.keyboard("{Escape}");
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
