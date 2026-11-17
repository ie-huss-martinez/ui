import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Timeline, TimelineLayer, useTimelineScale } from "./Timeline.js";
import { TimelinePlayhead } from "./TimelinePlayhead.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function Probe() {
  const scale = useTimelineScale();
  return <span data-length={scale.length} data-scale={scale.pixelsPerUnit} />;
}

const noop = (): void => undefined;

describe("Timeline on the server", () => {
  it("renders a named region with a track, its layers and a playhead slider, unmeasured", () => {
    const html = renderToString(
      <Timeline label="Timeline" length={300} className="app" classNames={{ track: "track" }}>
        <TimelineLayer className="waveform">
          <Probe />
        </TimelineLayer>
        <TimelinePlayhead
          label="Playhead"
          position={120}
          onPositionChange={noop}
          formatValue={(frame) => `${frame / 30} s`}
        />
      </Timeline>,
    );
    expect(html).toContain('<section aria-label="Timeline" class="hm-timeline app">');
    expect(html).toContain('class="hm-timeline-track track"');
    expect(html).toContain('class="hm-timeline-layer waveform"');
    // The scale is 0 until a browser measures the timeline.
    expect(html).toContain('data-length="300" data-scale="0"');
    const slider = /<input\b[^>]*>/.exec(html)?.[0] ?? "";
    for (const attribute of [
      'type="range"',
      'min="0"',
      'max="300"',
      'value="120"',
      'aria-label="Playhead"',
      'aria-valuetext="4 s"',
      'class="hm-slider hm-timeline-playhead-slider"',
    ]) {
      expect(slider, attribute).toContain(attribute);
    }
    expect(html).toContain('class="hm-timeline-playhead-line" aria-hidden="true"');
    // Sizes are set through the CSSOM after mount, never as attributes.
    expect(html).not.toContain("style=");
  });

  it("keeps the playhead inside the timeline, and treats a length that isn't a whole number as none", () => {
    const past = renderToString(
      <Timeline label="Timeline" length={300}>
        <TimelinePlayhead label="Playhead" position={900} onPositionChange={noop} />
      </Timeline>,
    );
    expect(past).toContain('value="300"');
    const invalid = renderToString(
      <Timeline label="Timeline" length={Number.NaN}>
        <TimelinePlayhead label="Playhead" position={5} onPositionChange={noop} />
      </Timeline>,
    );
    expect(invalid).toContain('max="0"');
    expect(invalid).toContain('value="0"');
  });

  it("marks unstyled on the timeline and on the playhead", () => {
    const html = renderToString(
      <Timeline label="Timeline" length={10} unstyled>
        <TimelinePlayhead label="Playhead" position={0} onPositionChange={noop} unstyled />
      </Timeline>,
    );
    expect(html).toContain(
      '<section aria-label="Timeline" class="hm-timeline" data-hm-unstyled="">',
    );
    expect(html).toContain('<div class="hm-timeline-playhead" data-hm-unstyled="">');
  });

  it("warns in development when a part is used outside a Timeline", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderToString(<TimelinePlayhead label="Playhead" position={0} onPositionChange={noop} />);
    expect(warn).toHaveBeenLastCalledWith(
      expect.stringMatching(/TimelinePlayhead needs a Timeline above it/),
    );
  });
});
