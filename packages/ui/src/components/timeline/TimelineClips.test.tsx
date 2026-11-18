import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Timeline } from "./Timeline.js";
import { type TimelineClip, TimelineClips } from "./TimelineClips.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const clips: TimelineClip[] = [
  { key: "a", length: 90, label: "Clip 1 of 3, 0:00 to 0:03", content: "Intro" },
  {
    key: "b",
    length: 150,
    label: "Clip 2 of 3, 0:03 to 0:08, muted",
    attributes: { "data-muted": "" },
  },
  { key: "c", length: 60, label: "Clip 3 of 3, 0:08 to 0:10", content: "Outro" },
];
const noop = (): void => undefined;
const tags = (html: string) =>
  [...html.matchAll(/<div[^>]*role="option"[^>]*>/g)].map(([tag]) => tag);

function render(props: Partial<React.ComponentProps<typeof TimelineClips>> = {}): string {
  return renderToString(
    <Timeline label="Timeline" length={300}>
      <TimelineClips
        label="Clips"
        clips={clips}
        selectedKeys={["b"]}
        onSelectedKeysChange={noop}
        {...props}
      />
    </Timeline>,
  );
}

describe("TimelineClips on the server", () => {
  it("renders a horizontal listbox of options, named, with the selected clip as the Tab stop", () => {
    const html = render({ className: "app", classNames: { clip: "clip", content: "content" } });
    expect(html).toContain(
      '<div role="listbox" aria-label="Clips" aria-orientation="horizontal" class="hm-timeline-clips app">',
    );
    const options = tags(html);
    expect(options).toHaveLength(3);
    expect(options[0]).toContain('aria-label="Clip 1 of 3, 0:00 to 0:03"');
    expect(options[0]).toContain('aria-selected="false"');
    expect(options[0]).toContain('tabindex="-1"');
    expect(options[0]).toContain('class="hm-timeline-clip clip"');
    expect(options[1]).toContain('aria-selected="true"');
    expect(options[1]).toContain('tabindex="0"');
    expect(options[1]).toContain('data-muted=""');
    expect(options[1]).toContain('data-hm-key="b"');
    expect(html).toContain('<span class="hm-timeline-clip-content content">Intro</span>');
    // Unmeasured, with no sizes: the clips share the track until a browser measures it.
    expect(html).not.toContain("data-hm-measured");
    expect(html).not.toContain("style=");
  });

  it("says it takes several with selectionMode multiple, and marks each selected clip", () => {
    const html = render({ selectionMode: "multiple", selectedKeys: ["a", "c"] });
    expect(html).toContain('aria-multiselectable="true"');
    expect(tags(html).map((tag) => /aria-selected="(\w+)"/.exec(tag)?.[1])).toEqual([
      "true",
      "false",
      "true",
    ]);
    // The first selected clip is the Tab stop.
    expect(tags(html).map((tag) => /tabindex="(-?\d)"/.exec(tag)?.[1])).toEqual(["0", "-1", "-1"]);
  });

  it("makes the first clip the Tab stop when none is selected, and marks unstyled", () => {
    const html = render({ selectedKeys: [], unstyled: true });
    expect(tags(html).map((tag) => /tabindex="(-?\d)"/.exec(tag)?.[1])).toEqual(["0", "-1", "-1"]);
    expect(html).toContain('class="hm-timeline-clips" data-hm-unstyled=""');
  });

  it("leaves out a clip without a whole, positive length, and warns in development", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const html = render({
      clips: [
        ...clips,
        { key: "d", length: 0, label: "Empty" },
        { key: "e", length: 1.5, label: "Half" },
      ],
    });
    expect(tags(html)).toHaveLength(3);
    expect(warn).toHaveBeenLastCalledWith(expect.stringMatching(/TimelineClips left out a clip/));
  });

  it("takes clips with a start, and warns in development when they overlap or only some have one", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const placed = render({
      clips: [
        { key: "a", at: 20, length: 60, label: "Audio 1" },
        { key: "b", at: 120, length: 50, label: "Audio 2" },
      ],
    });
    // The same listbox, and nothing placed until a browser measures it.
    expect(tags(placed)).toHaveLength(2);
    expect(placed).not.toContain("style=");
    expect(warn).not.toHaveBeenCalled();

    render({
      clips: [
        { key: "a", at: 20, length: 60, label: "Audio 1" },
        { key: "b", at: 70, length: 50, label: "Audio 2" },
      ],
    });
    expect(warn).toHaveBeenLastCalledWith(expect.stringMatching(/overlap or aren't in time order/));
    render({
      clips: [
        { key: "a", at: 20, length: 60, label: "Audio 1" },
        { key: "b", length: 50, label: "Audio 2" },
      ],
    });
    expect(warn).toHaveBeenLastCalledWith(expect.stringMatching(/some clips `at` and not others/));
    render({ clips: [{ key: "a", at: 1.5, length: 60, label: "Audio 1" }] });
    expect(warn).toHaveBeenLastCalledWith(expect.stringMatching(/isn't a whole number/));
  });

  it("marks a clip that runs past the timeline's length", () => {
    const html = render({
      clips: [
        { key: "a", at: 0, length: 300, label: "Audio 1" },
        { key: "b", at: 300, length: 40, label: "Audio 2" },
      ],
    });
    const options = tags(html);
    expect(options[0]).not.toContain("data-hm-past-end");
    expect(options[1]).toContain('data-hm-past-end=""');
  });
});
