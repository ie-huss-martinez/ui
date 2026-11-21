import { act } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { cleanUp, loadStyles, mount } from "../../test/dom.js";
import { Dialog } from "../dialog/Dialog.js";
import { Heading, HeadingLevelProvider } from "./Heading.js";

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

describe("Heading", () => {
  it("is a heading at its level to assistive technology", async () => {
    render(
      <HeadingLevelProvider level={3}>
        <Heading>Selection</Heading>
      </HeadingLevelProvider>,
    );
    await expect.element(page.getByRole("heading", { name: "Selection", level: 3 })).toBeVisible();
  });

  it("names the section that points to its id", async () => {
    render(
      <section aria-labelledby="inspector-title">
        <Heading id="inspector-title">Selection</Heading>
      </section>,
    );
    await expect.element(page.getByRole("region", { name: "Selection" })).toBeVisible();
  });

  it("is styled as a title, sized by --hm-heading-font-size, with no margin", () => {
    const container = render(
      <div style={{ ["--hm-heading-font-size" as string]: "31px" }}>
        <Heading>Title</Heading>
      </div>,
    );
    const style = getComputedStyle(container.querySelector("h2") as Element);
    expect(style.fontSize).toBe("31px");
    expect(style.marginBlockStart).toBe("0px");
    expect(style.marginBlockEnd).toBe("0px");
  });

  it("keeps only its margin reset when unstyled", () => {
    const container = render(
      <div style={{ ["--hm-heading-font-size" as string]: "31px" }}>
        <Heading unstyled>Title</Heading>
      </div>,
    );
    const style = getComputedStyle(container.querySelector("h2") as Element);
    expect(style.fontSize).not.toBe("31px");
    expect(style.marginBlockStart).toBe("0px");
  });

  it("is a level 3 heading inside an open dialog, under its level 2 title", async () => {
    render(
      <Dialog open onOpenChange={() => undefined} title="Export">
        <Heading>Format</Heading>
      </Dialog>,
    );
    const dialog = page.getByRole("dialog", { name: "Export" });
    await expect.element(dialog.getByRole("heading", { name: "Export", level: 2 })).toBeVisible();
    await expect.element(dialog.getByRole("heading", { name: "Format", level: 3 })).toBeVisible();
  });

  it("hydrates without errors or warnings", () => {
    const app = (
      <HeadingLevelProvider level={4}>
        <section aria-labelledby="title">
          <Heading id="title">Selection</Heading>
        </section>
      </HeadingLevelProvider>
    );
    const container = mount(renderToString(app));
    const consoleError = vi.spyOn(console, "error");
    const recoverable: unknown[] = [];
    act(() => {
      root = hydrateRoot(container, app, { onRecoverableError: (e) => recoverable.push(e) });
    });
    expect(recoverable).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
    expect(container.querySelector("h4")?.id).toBe("title");
  });
});
