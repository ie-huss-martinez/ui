import { act, createRef, useState } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanUp, loadStyles, mount } from "../../test/dom.js";
import { Field } from "../field/Field.js";
import { ColorField } from "./ColorField.js";

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

const swatches = [
  { value: "#d92d20", label: "Red" },
  { value: "#1570ef", label: "Blue" },
  { value: "#ffffff", label: "White" },
];

/** A controlled field in a Field, as an inspector would have. */
function Fill({ onValueChange }: { onValueChange?: (value: string) => void }) {
  const [fill, setFill] = useState("#d92d20");
  return (
    <Field label="Fill" description="Of the shape">
      <ColorField
        value={fill}
        swatches={swatches}
        onValueChange={(value) => {
          setFill(value);
          onValueChange?.(value);
        }}
      />
    </Field>
  );
}

const input = (container: HTMLElement) =>
  container.querySelector(".hm-color-field-input") as HTMLInputElement;
const preview = (container: HTMLElement) =>
  container.querySelector(".hm-color-field-preview rect")?.getAttribute("fill");

describe("ColorField", () => {
  it("is a textbox and a radio group, both named by its Field", async () => {
    render(<Fill />);
    const box = page.getByRole("textbox", { name: "Fill" });
    await expect.element(box).toHaveValue("#d92d20");
    await expect.element(box).toHaveAccessibleDescription("Of the shape");
    const group = page.getByRole("radiogroup", { name: "Fill swatches" });
    await expect.element(group).toBeVisible();
    await expect.element(group.getByRole("radio", { name: "Red" })).toBeChecked();
    await expect.element(group.getByRole("radio", { name: "Blue" })).not.toBeChecked();
  });

  it("commits typed text on Enter and on blur, in any accepted form", async () => {
    const onValueChange = vi.fn();
    const container = render(<Fill onValueChange={onValueChange} />);
    const field = input(container);

    // Typing alone changes nothing.
    await userEvent.fill(field, "1570EF");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(preview(container)).toBe("#d92d20");

    await userEvent.keyboard("{Enter}");
    expect(onValueChange.mock.calls).toEqual([["#1570ef"]]);
    expect(field.value).toBe("#1570ef");
    expect(preview(container)).toBe("#1570ef");
    await expect.element(page.getByRole("radio", { name: "Blue" })).toBeChecked();

    // The short form, committed by leaving the field.
    await userEvent.fill(field, "#fff");
    await userEvent.tab();
    expect(onValueChange.mock.calls).toEqual([["#1570ef"], ["#ffffff"]]);
    expect(field.value).toBe("#ffffff");
  });

  it("goes back to the value for text that isn't a colour, and on Escape", async () => {
    const onValueChange = vi.fn();
    const container = render(<Fill onValueChange={onValueChange} />);
    const field = input(container);
    await userEvent.fill(field, "tomato");
    await userEvent.keyboard("{Enter}");
    expect(field.value).toBe("#d92d20");

    await userEvent.fill(field, "#000");
    await userEvent.keyboard("{Escape}");
    expect(field.value).toBe("#d92d20");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("keeps Escape for a dialog when nothing is typed", async () => {
    const onKeyDown = vi.fn((event: React.KeyboardEvent) => event.defaultPrevented);
    const container = render(
      // biome-ignore lint/a11y/noStaticElementInteractions: stands for a dialog's own Escape handling.
      <div onKeyDown={onKeyDown}>
        <ColorField label="Fill" />
      </div>,
    );
    input(container).focus();
    await userEvent.keyboard("{Escape}");
    await userEvent.fill(input(container), "#0");
    await userEvent.keyboard("{Escape}");
    expect(onKeyDown.mock.results.map((result) => result.value)).toEqual([false, true]);
  });

  it("selects a swatch with a click, and with the arrow keys from one Tab stop", async () => {
    const onValueChange = vi.fn();
    const container = render(<Fill onValueChange={onValueChange} />);
    await userEvent.click(page.getByRole("radio", { name: "White" }));
    expect(onValueChange.mock.calls).toEqual([["#ffffff"]]);
    expect(input(container).value).toBe("#ffffff");

    const radios = [...container.querySelectorAll('[role="radio"]')] as HTMLElement[];
    expect(radios.map((radio) => radio.tabIndex)).toEqual([-1, -1, 0]);

    // Arrows wrap, move focus and select.
    radios[2]?.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(radios[0]);
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(radios[1]);
    await userEvent.keyboard("{ArrowLeft}{ArrowUp}");
    expect(document.activeElement).toBe(radios[2]);
    expect(onValueChange.mock.calls.map(([value]) => value)).toEqual([
      "#ffffff",
      "#d92d20",
      "#1570ef",
      "#d92d20",
      "#ffffff",
    ]);
  });

  it("follows the reading direction with the horizontal arrows", async () => {
    const container = render(
      <div dir="rtl">
        <Fill />
      </div>,
    );
    const radios = [...container.querySelectorAll('[role="radio"]')] as HTMLElement[];
    radios[0]?.focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(radios[1]);
  });

  it("keeps its first swatch as the Tab stop when the colour isn't a swatch", () => {
    const container = render(<ColorField label="Fill" value="#123456" swatches={swatches} />);
    const radios = [...container.querySelectorAll('[role="radio"]')] as HTMLElement[];
    expect(radios.map((radio) => radio.tabIndex)).toEqual([0, -1, -1]);
    expect(radios.map((radio) => radio.getAttribute("aria-checked"))).toEqual([
      "false",
      "false",
      "false",
    ]);
  });

  it("works uncontrolled, and submits the colour with a form", async () => {
    const container = render(
      <form>
        <ColorField label="Fill" name="fill" defaultValue="#d92d20" swatches={swatches} />
      </form>,
    );
    await userEvent.click(page.getByRole("radio", { name: "Blue" }));
    expect(input(container).value).toBe("#1570ef");
    expect(new FormData(container.querySelector("form") as HTMLFormElement).get("fill")).toBe(
      "#1570ef",
    );
  });

  it("disables the input and the swatches", async () => {
    const onValueChange = vi.fn();
    const container = render(
      <ColorField label="Fill" swatches={swatches} disabled onValueChange={onValueChange} />,
    );
    expect(input(container).disabled).toBe(true);
    for (const radio of container.querySelectorAll<HTMLButtonElement>('[role="radio"]')) {
      expect(radio.disabled).toBe(true);
    }
  });

  it("forwards its ref to the root", () => {
    const ref = createRef<HTMLDivElement>();
    render(<ColorField label="Fill" ref={ref} />);
    expect(ref.current?.className).toBe("hm-color-field");
  });

  it("shows each colour, a ring on the checked swatch, and a border on every colour", () => {
    const container = render(<Fill />);
    const [red, , white] = [...container.querySelectorAll('[role="radio"]')] as HTMLElement[];
    expect(getComputedStyle(red?.querySelector("rect") as Element).fill).toBe("rgb(217, 45, 32)");
    // The checked swatch's ring is the text colour; the others' is transparent.
    expect(getComputedStyle(red as Element).borderTopColor).toBe(
      getComputedStyle(container.querySelector("label") as Element).color,
    );
    expect(getComputedStyle(white as Element).borderTopColor).toBe("rgba(0, 0, 0, 0)");
    // White on a light surface still has an edge.
    const fill = getComputedStyle(white?.querySelector("svg") as Element);
    expect(fill.borderTopStyle).toBe("solid");
    expect(Number.parseFloat(fill.borderTopWidth)).toBeGreaterThan(0);
  });

  it("meets the target size, shows a focus ring, and keeps both unstyled", () => {
    const container = render(
      <>
        <ColorField label="Styled" swatches={swatches} />
        <ColorField label="Plain" swatches={swatches} unstyled />
      </>,
    );
    for (const control of container.querySelectorAll<HTMLElement>('input[type="text"], button')) {
      const box = control.getBoundingClientRect();
      expect(box.height).toBeGreaterThanOrEqual(24);
      expect(box.width).toBeGreaterThanOrEqual(24);
    }
    const [styled, plain] = [...container.querySelectorAll("input[type='text']")] as HTMLElement[];
    expect(getComputedStyle(styled as Element).borderTopColor).not.toBe(
      getComputedStyle(plain as Element).borderTopColor,
    );
    styled?.focus();
    expect(getComputedStyle(styled as Element).outlineStyle).toBe("solid");
    plain?.focus();
    expect(getComputedStyle(plain as Element).outlineStyle).toBe("solid");
  });

  it("hydrates without errors or warnings", () => {
    const app = <Fill />;
    const container = mount(renderToString(app));
    const consoleError = vi.spyOn(console, "error");
    const recoverable: unknown[] = [];
    act(() => {
      root = hydrateRoot(container, app, { onRecoverableError: (e) => recoverable.push(e) });
    });
    expect(recoverable).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
