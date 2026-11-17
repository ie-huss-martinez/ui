import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReorderableList, ReorderableListItem } from "./ReorderableList.js";

const tags = (html: string, pattern: RegExp) => [...html.matchAll(pattern)].map(([tag]) => tag);

function Layers(props: { selectedId?: string | null; unstyled?: boolean }) {
  return (
    <ReorderableList label="Layers" className="app" classNames={{ root: "root" }} {...props}>
      <ReorderableListItem
        id="title"
        label="Title"
        className="row"
        classNames={{ item: "item", control: "control" }}
        controls={[
          <button key="visible" type="button" aria-pressed="true">
            Visible
          </button>,
          <button key="lock" type="button" aria-pressed="false">
            Locked
          </button>,
        ]}
      >
        Title
      </ReorderableListItem>
      <ReorderableListItem id="photo" label="Photo">
        Photo
      </ReorderableListItem>
    </ReorderableList>
  );
}

describe("ReorderableList on the server", () => {
  it("renders a named grid of rows, each with its item's cell and a cell per control", () => {
    const html = renderToString(<Layers selectedId="photo" />);
    expect(html).toContain(
      '<div role="grid" aria-label="Layers" class="hm-reorderable-list root app">',
    );
    const rows = tags(html, /<div role="row"[^>]*>/g);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('aria-selected="false"');
    expect(rows[0]).toContain('data-hm-id="title"');
    expect(rows[0]).toContain('class="hm-reorderable-list-row row"');
    expect(rows[1]).toContain('aria-selected="true"');
    const cells = tags(html, /<div role="gridcell"[^>]*>/g);
    expect(cells).toHaveLength(4);
    expect(cells[0]).toContain('aria-label="Title"');
    expect(cells[0]).toContain('class="hm-reorderable-list-item item"');
    expect(cells[1]).toContain('data-hm-cell="control"');
    expect(cells[1]).toContain('class="hm-reorderable-list-control control"');
  });

  it("makes the selected item the Tab stop, and leaves the controls' tabindex to the browser", () => {
    const html = renderToString(<Layers selectedId="photo" />);
    const cells = tags(html, /<div role="gridcell"[^>]*data-hm-cell="item"[^>]*>/g);
    expect(cells[0]).toContain('tabindex="-1"');
    expect(cells[1]).toContain('tabindex="0"');
    // The list sets the controls' tabindex after hydration, so there's
    // nothing for hydration to mismatch.
    expect(html).not.toMatch(/<button[^>]*tabindex/);
  });

  it("selects nothing without selectedId, and marks unstyled", () => {
    const html = renderToString(<Layers selectedId={null} unstyled />);
    expect(html).not.toContain('aria-selected="true"');
    expect(html).toContain('data-hm-unstyled=""');
  });
});
