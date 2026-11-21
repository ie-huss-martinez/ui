import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nestedHeadingLevel } from "../../heading/heading-level.js";
import { Dialog } from "../dialog/Dialog.js";
import { Heading, HeadingLevelProvider, useHeadingLevel } from "./Heading.js";

/** A heading, then the same one level down, `depth` times. */
function Nested({ depth }: { readonly depth: number }) {
  const level = useHeadingLevel();
  return (
    <>
      <Heading>Level {level}</Heading>
      {depth > 0 ? (
        <HeadingLevelProvider level={nestedHeadingLevel(level)}>
          <Nested depth={depth - 1} />
        </HeadingLevelProvider>
      ) : null}
    </>
  );
}

/** The level from context, as text. */
function Level() {
  return <>{useHeadingLevel()}</>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Heading on the server", () => {
  it("is an h2 by default", () => {
    expect(renderToString(<Heading>Selection</Heading>)).toBe(
      '<h2 class="hm-heading">Selection</h2>',
    );
  });

  it("renders the element for its level", () => {
    for (const level of [2, 3, 4, 5, 6] as const) {
      expect(renderToString(<Heading level={level}>Title</Heading>)).toBe(
        `<h${level} class="hm-heading">Title</h${level}>`,
      );
    }
  });

  it("passes its other props to the element, id first among them, so a section can be labelled by it", () => {
    const html = renderToString(
      <Heading id="inspector-title" data-part="title" aria-describedby="hint" title="Selection">
        Selection
      </Heading>,
    );
    expect(html).toBe(
      '<h2 id="inspector-title" data-part="title" aria-describedby="hint" title="Selection" class="hm-heading">Selection</h2>',
    );
  });

  it("takes classes and unstyled", () => {
    const html = renderToString(
      <Heading className="x" classNames={{ root: "y" }} unstyled>
        Title
      </Heading>,
    );
    expect(html).toContain('class="hm-heading y x"');
    expect(html).toContain('data-hm-unstyled=""');
  });

  it("renders an h2, with a development warning, for a level that isn't one", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // An untyped host could pass this.
    const level = 7 as unknown as 2;
    expect(renderToString(<Heading level={level}>Title</Heading>)).toBe(
      '<h2 class="hm-heading">Title</h2>',
    );
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("HeadingLevelProvider", () => {
  it("sets the level of the headings inside that don't set their own", () => {
    const html = renderToString(
      <HeadingLevelProvider level={4}>
        <Heading>Inherited</Heading>
        <Heading level={2}>Own</Heading>
      </HeadingLevelProvider>,
    );
    expect(html).toBe('<h4 class="hm-heading">Inherited</h4><h2 class="hm-heading">Own</h2>');
  });

  it("nests a level down with nestedHeadingLevel, and never past 6", () => {
    const html = renderToString(
      <HeadingLevelProvider level={4}>
        <Nested depth={3} />
      </HeadingLevelProvider>,
    );
    expect(html.match(/<h\d/g)).toEqual(["<h4", "<h5", "<h6", "<h6"]);
  });

  it("gives useHeadingLevel 2 without a provider", () => {
    expect(renderToString(<Level />)).toBe("2");
  });
});

describe("Heading in a Dialog", () => {
  it("starts at 3 under the dialog's h2 title, in the content and the footer", () => {
    const html = renderToString(
      <Dialog
        open
        onOpenChange={() => undefined}
        title="Export"
        footer={<Heading>Footer note</Heading>}
      >
        <Heading>Format</Heading>
        <Heading level={4}>Own level</Heading>
      </Dialog>,
    );
    expect(html.match(/<h\d/g)).toEqual(["<h2", "<h3", "<h4", "<h3"]);
  });
});
