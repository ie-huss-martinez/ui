import { act, createRef, useState } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanUp, loadStyles, mount } from "../../test/dom.js";
import { Field } from "../field/Field.js";
import { TextField } from "../text-field/TextField.js";
import { TextArea } from "./TextArea.js";

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

/** A controlled area with validation, as a text tool would have. */
function Caption({ onValueChange }: { onValueChange?: (value: string) => void }) {
  const [text, setText] = useState("");
  return (
    <Field
      label="Caption"
      description="Shown under the image"
      error={text.length > 5 ? "Too long" : undefined}
    >
      <TextArea
        value={text}
        onValueChange={(value) => {
          setText(value);
          onValueChange?.(value);
        }}
      />
    </Field>
  );
}

const area = (container: HTMLElement) => container.querySelector("textarea") as HTMLTextAreaElement;

describe("TextArea", () => {
  it("is a multi-line textbox named and described by its Field, and marked invalid", async () => {
    const container = render(<Caption />);
    const box = page.getByRole("textbox", { name: "Caption" });
    expect(area(container).matches("textarea")).toBe(true);
    await expect.element(box).toHaveAccessibleDescription("Shown under the image");
    await userEvent.type(area(container), "abcdef");
    await expect.element(box).toHaveAttribute("aria-invalid", "true");
    await expect.element(box).toHaveAccessibleDescription("Shown under the image Too long");
  });

  it("adds a line on Enter without submitting a form, and reports each change", async () => {
    const onValueChange = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const container = render(
      <form onSubmit={onSubmit}>
        <TextArea label="Caption" name="caption" onValueChange={onValueChange} />
      </form>,
    );
    await userEvent.type(area(container), "a{Enter}b");
    expect(onValueChange.mock.calls).toEqual([["a"], ["a\n"], ["a\nb"]]);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(new FormData(container.querySelector("form") as HTMLFormElement).get("caption")).toBe(
      "a\nb",
    );
  });

  it("gives its value with \\n between lines, whatever was set", () => {
    const container = render(<TextArea label="Caption" defaultValue={"One\r\nTwo\rThree"} />);
    expect(area(container).value).toBe("One\nTwo\nThree");
  });

  it("forwards its ref to the textarea", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<TextArea label="Caption" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it("looks like a TextField: the same border, background, radius, font and inline padding", () => {
    const container = render(
      <>
        <TextField label="Field" />
        <TextArea label="Area" />
      </>,
    );
    const field = getComputedStyle(container.querySelector("input") as Element);
    const style = getComputedStyle(area(container));
    for (const property of [
      "borderTopColor",
      "borderTopWidth",
      "borderTopStyle",
      "borderTopLeftRadius",
      "backgroundColor",
      "color",
      "fontFamily",
      "fontSize",
      "paddingInlineStart",
    ] as const) {
      expect(style[property], property).toBe(field[property]);
    }
  });

  it("has room above and below its text, grows with rows, and resizes only taller", () => {
    const container = render(
      <>
        <TextArea label="Three" />
        <TextArea label="Six" rows={6} />
      </>,
    );
    const [three, six] = [...container.querySelectorAll("textarea")] as HTMLTextAreaElement[];
    const style = getComputedStyle(three as Element);
    expect(Number.parseFloat(style.paddingTop)).toBeGreaterThan(0);
    expect(style.paddingTop).toBe(style.paddingBottom);
    expect(style.resize).toBe("vertical");
    const lineHeight = Number.parseFloat(style.lineHeight);
    // Three lines fit, and six rows are three lines taller.
    expect(three?.clientHeight).toBeGreaterThanOrEqual(3 * lineHeight);
    expect(
      (six?.getBoundingClientRect().height ?? 0) - (three?.getBoundingClientRect().height ?? 0),
    ).toBeCloseTo(3 * lineHeight, 0);
  });

  it("follows the density, through the text field's tokens", () => {
    const container = render(
      <>
        <div data-hm-density="comfortable">
          <TextArea label="Comfortable" rows={1} />
        </div>
        <div data-hm-density="compact">
          <TextArea label="Compact" rows={1} />
        </div>
      </>,
    );
    const [comfortable, compact] = [...container.querySelectorAll("textarea")] as HTMLElement[];
    expect(compact?.getBoundingClientRect().height).toBeLessThan(
      comfortable?.getBoundingClientRect().height ?? 0,
    );
  });

  it("meets the target size, shows a focus ring, and keeps both unstyled", () => {
    const container = render(
      <>
        <TextArea label="Styled" rows={1} />
        <TextArea label="Plain" rows={1} unstyled />
      </>,
    );
    const [styled, plain] = [...container.querySelectorAll("textarea")] as HTMLTextAreaElement[];
    for (const textarea of [styled, plain]) {
      expect(textarea?.getBoundingClientRect().height).toBeGreaterThanOrEqual(24);
    }
    expect(getComputedStyle(styled as Element).borderTopColor).not.toBe(
      getComputedStyle(plain as Element).borderTopColor,
    );
    styled?.focus();
    expect(getComputedStyle(styled as Element).outlineStyle).toBe("solid");
    plain?.focus();
    expect(getComputedStyle(plain as Element).outlineStyle).toBe("solid");
  });

  it("marks an invalid area with the text field's invalid border token, and dims when disabled", () => {
    const container = render(
      <div style={{ ["--hm-text-field-invalid-border-color" as string]: "rgb(255, 0, 0)" }}>
        <TextArea label="Invalid" aria-invalid />
        <TextArea label="Disabled" disabled />
      </div>,
    );
    const [invalid, disabled] = [...container.querySelectorAll("textarea")] as HTMLElement[];
    expect(getComputedStyle(invalid as Element).borderTopColor).toBe("rgb(255, 0, 0)");
    expect(Number(getComputedStyle(disabled as Element).opacity)).toBeLessThan(1);
  });

  it("hydrates without errors or warnings", () => {
    const app = <Caption />;
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
