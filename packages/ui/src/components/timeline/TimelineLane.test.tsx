import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Timeline, TimelineLayer } from "./Timeline.js";
import { TimelineClips } from "./TimelineClips.js";
import { TimelineLane } from "./TimelineLane.js";
import { TimelinePlayhead } from "./TimelinePlayhead.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const noop = (): void => undefined;

describe("TimelineLane on the server", () => {
  const html = renderToString(
    <Timeline label="Timeline" length={300}>
      <TimelinePlayhead label="Playhead" position={0} onPositionChange={noop} />
      <TimelineLane
        id="voice"
        label="Track 1, Voice"
        className="app"
        classNames={{ header: "head" }}
        header={
          <button type="button" aria-pressed="false">
            Mute
          </button>
        }
      >
        <TimelineLayer>Waveform</TimelineLayer>
        <TimelineClips
          label="Voice clips"
          clips={[{ key: "a", length: 300, label: "Clip 1 of 1 on Voice" }]}
          selectedKeys={[]}
          onSelectedKeysChange={noop}
        />
      </TimelineLane>
      <TimelineLane id="music" label="Track 2, Music">
        <TimelineLayer>Waveform</TimelineLayer>
      </TimelineLane>
    </Timeline>,
  );

  it("renders each lane as a named group, with its header as a toolbar of the same name", () => {
    expect(html).toContain(
      '<div role="group" aria-label="Track 1, Voice" data-hm-lane="voice" class="hm-timeline-lane app">',
    );
    expect(html).toContain('<div class="hm-timeline-lane-header head">');
    expect(html).toMatch(/<div[^>]*role="toolbar"[^>]*aria-label="Track 1, Voice"/);
    expect(html).toContain('class="hm-toolbar hm-timeline-lane-toolbar"');
    // A lane without a header has none.
    const music = html.slice(html.indexOf('data-hm-lane="music"'));
    expect(music).not.toContain("hm-timeline-lane-header");
  });

  it("puts a lane's header before its layers and clips, so it's the lane's first Tab stop", () => {
    const voice = html.slice(
      html.indexOf('data-hm-lane="voice"'),
      html.indexOf('data-hm-lane="music"'),
    );
    expect(voice.indexOf('role="toolbar"')).toBeLessThan(voice.indexOf("hm-timeline-layer"));
    expect(voice.indexOf("hm-timeline-layer")).toBeLessThan(voice.indexOf('role="listbox"'));
  });

  it("knows no lanes yet, and sets no sizes: a browser lays them out when it measures", () => {
    // The lanes say they're there when React commits, which a server never does.
    expect(html).not.toContain("data-hm-lanes");
    expect(html).not.toContain("hm-timeline-bar");
    expect(html).not.toContain("style=");
  });

  it("warns in development outside a Timeline", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderToString(<TimelineLane id="a" label="Track 1" />);
    expect(warn).toHaveBeenLastCalledWith(
      expect.stringMatching(/TimelineLane needs a Timeline above it/),
    );
  });
});
