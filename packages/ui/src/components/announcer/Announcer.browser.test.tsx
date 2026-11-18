import { act, StrictMode, useEffect } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanUp, loadStyles, mount } from "../../test/dom.js";
import { type Announce, AnnouncerProvider, useAnnounce } from "./Announcer.js";

let root: Root | undefined;
let announce: Announce = () => undefined;

function Capture() {
  announce = useAnnounce();
  return null;
}

/** Announces when it mounts, as an editor's component does from an effect. */
function OnMount() {
  const say = useAnnounce();
  useEffect(() => say("Opened."), [say]);
  return null;
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await loadStyles();
});
afterEach(() => {
  for (const observer of observers.splice(0)) {
    observer.disconnect();
  }
  act(() => root?.unmount());
  root = undefined;
  cleanUp();
  vi.restoreAllMocks();
});

function render(): HTMLElement {
  const container = mount("");
  act(() => {
    root = createRoot(container);
    root.render(
      <AnnouncerProvider>
        <Capture />
      </AnnouncerProvider>,
    );
  });
  return container;
}

/**
 * Records every non-empty text a region receives from now on, as a screen
 * reader would hear it: a test of the final text would miss one replaced by
 * another.
 */
function record(container: HTMLElement, role: "status" | "alert"): () => string[] {
  const region = container.querySelector(`.hm-announcer [role="${role}"]`) as Element;
  const texts: string[] = [];
  const observer = new MutationObserver(() => texts.push(region.textContent ?? ""));
  observer.observe(region, { childList: true, characterData: true, subtree: true });
  observers.push(observer);
  return () => texts.filter((text) => text !== "");
}

const observers: MutationObserver[] = [];

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

async function settle(): Promise<void> {
  await act(async () => {
    await nextFrame();
    await nextFrame();
  });
}

describe("AnnouncerProvider", () => {
  it("puts polite messages in the status region and assertive ones in the alert region", async () => {
    const container = render();
    act(() => announce("Saved 1.3 MB"));
    await settle();
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Saved 1.3 MB");
    act(() => announce("Export failed", { politeness: "assertive" }));
    await settle();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Export failed");
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Saved 1.3 MB");
  });

  it("empties the region before repeating a message, so it's announced again", async () => {
    const container = render();
    const status = container.querySelector('[role="status"]') as Element;
    act(() => announce("Saved"));
    await settle();
    const texts: string[] = [];
    const observer = new MutationObserver(() => texts.push(status.textContent ?? ""));
    observer.observe(status, { childList: true, characterData: true, subtree: true });
    act(() => announce("Saved"));
    await settle();
    observer.disconnect();
    expect(texts).toContain("");
    expect(texts.at(-1)).toBe("Saved");
  });

  it("says messages sent in the same frame together, in order, in one update", async () => {
    const container = render();
    const said = record(container, "status");
    act(() => {
      announce("Recording opened.");
      announce("It's longer than the limit.");
    });
    await settle();
    expect(said()).toEqual(["Recording opened. It's longer than the limit."]);
  });

  it("keeps polite and assertive messages in the same frame apart", async () => {
    const container = render();
    const polite = record(container, "status");
    const assertive = record(container, "alert");
    act(() => {
      announce("Saved.");
      announce("Export failed.", { politeness: "assertive" });
      announce("3 pages.");
    });
    await settle();
    expect(polite()).toEqual(["Saved. 3 pages."]);
    expect(assertive()).toEqual(["Export failed."]);
  });

  it("says a message in the next frame on its own", async () => {
    const container = render();
    const said = record(container, "status");
    act(() => announce("One."));
    await settle();
    act(() => announce("Two."));
    await settle();
    expect(said()).toEqual(["One.", "Two."]);
  });

  it("says the same message once when it's sent twice in a frame", async () => {
    const container = render();
    const said = record(container, "status");
    act(() => {
      announce("Saved.");
      announce("Saved.");
    });
    await settle();
    expect(said()).toEqual(["Saved."]);
  });

  it("still announces after Strict Mode's extra cleanup cancels a pending message", async () => {
    const container = mount("");
    act(() => {
      root = createRoot(container);
      root.render(
        <StrictMode>
          <AnnouncerProvider>
            <OnMount />
            <Capture />
          </AnnouncerProvider>
        </StrictMode>,
      );
    });
    await settle();
    const said = record(container, "status");
    act(() => announce("Later."));
    await settle();
    expect(said().at(-1)).toBe("Later.");
  });

  it("announces in both regions when both are used in the same frame", async () => {
    const container = render();
    act(() => {
      announce("Saved");
      announce("Export failed", { politeness: "assertive" });
    });
    await settle();
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Saved");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Export failed");
  });

  it("keeps its regions hidden on screen but in the accessibility tree", () => {
    const container = render();
    const regions = container.querySelector(".hm-announcer") as Element;
    expect(regions.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    expect(getComputedStyle(regions).display).not.toBe("none");
  });

  it("hydrates without errors or warnings", () => {
    const app = (
      <AnnouncerProvider>
        <p>Content</p>
      </AnnouncerProvider>
    );
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
