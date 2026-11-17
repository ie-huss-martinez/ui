import {
  Button,
  Timeline,
  type TimelineClip,
  TimelineClips,
  TimelineLayer,
  TimelinePlayhead,
  useTimelineScale,
} from "@hussmartinez/ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef, useState } from "react";

/**
 * A timeline over whole units, such as frames: a track as wide as its length
 * at the current zoom, a clip track, a playhead, and layers for an editor's
 * own drawing. Edits are reported, and the editor renders the result.
 */
const meta = {
  title: "Components/Timeline",
  component: Timeline,
  args: { label: "Timeline", length: 300 },
} satisfies Meta<typeof Timeline>;

export default meta;
type Story = StoryObj<typeof meta>;

const FRAMES = 300;
const RATE = 30;
const time = (frame: number) => `${(frame / RATE).toFixed(2)} seconds`;

const marks = {
  blockSize: "var(--hm-control-height)",
  position: "relative",
} as const;
const mark = {
  borderInlineStart: "var(--hm-border-width) solid var(--hm-color-border-strong)",
  color: "var(--hm-color-text-muted)",
  fontSize: "var(--hm-font-size-small)",
  insetBlock: 0,
  paddingInlineStart: "var(--hm-gap-tight)",
  position: "absolute",
} as const;

/**
 * An editor's own layer: a mark at each second, placed with the timeline's
 * scale through the CSSOM, as the timeline places its own parts.
 */
function Seconds() {
  const scale = useTimelineScale();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    for (const element of root.current?.children ?? []) {
      const second = Number((element as HTMLElement).dataset["second"]);
      (element as HTMLElement).style.insetInlineStart = `${scale.toPixels(second * RATE)}px`;
    }
  }, [scale]);
  return (
    <div ref={root} style={marks} aria-hidden="true">
      {Array.from({ length: FRAMES / RATE }, (_, second) => (
        <span key={second} data-second={second} style={mark}>
          {second}
        </span>
      ))}
    </div>
  );
}

const CLIPS: TimelineClip[] = [
  { key: "intro", length: 60, label: "Clip 1 of 4, Intro, 0.00 to 2.00 seconds", content: "Intro" },
  {
    key: "talk",
    length: 120,
    label: "Clip 2 of 4, Interview, 2.00 to 6.00 seconds",
    content: "Interview",
  },
  {
    key: "cut",
    length: 30,
    label: "Clip 3 of 4, Cutaway, 6.00 to 7.00 seconds",
    content: "Cutaway",
  },
  {
    key: "outro",
    length: 90,
    label: "Clip 4 of 4, Outro, 7.00 to 10.00 seconds",
    content: "Outro",
  },
];

function Editor({
  label = "Timeline",
  zoom = 1,
  start = 120,
  unstyled = false,
  clips = false,
  selected: first = ["talk"],
}: {
  label?: string;
  zoom?: number;
  start?: number;
  unstyled?: boolean;
  clips?: false | "single" | "multiple";
  selected?: readonly string[];
}) {
  const [frame, setFrame] = useState(start);
  const [selected, setSelected] = useState(first);
  return (
    <Timeline label={label} length={FRAMES} zoom={zoom} snapTargets={[150]} unstyled={unstyled}>
      {/* Layers and clips share one lane, so the ruler is shown where there are no clips. */}
      {clips ? null : (
        <TimelineLayer>
          <Seconds />
        </TimelineLayer>
      )}
      {clips ? (
        <TimelineClips
          label={`${label} clips`}
          clips={CLIPS}
          selectionMode={clips}
          selectedKeys={selected}
          onSelectedKeysChange={setSelected}
          unstyled={unstyled}
        />
      ) : null}
      <TimelinePlayhead
        label={`${label} playhead`}
        position={frame}
        onPositionChange={setFrame}
        largeStep={RATE}
        formatValue={time}
        unstyled={unstyled}
      />
    </Timeline>
  );
}

/** Fitted to its width, with a layer that marks each second. A press on the track moves the playhead. */
export const Default: Story = {
  render: () => <Editor />,
};

/** Four times as wide as it fits: the track scrolls, with the playhead brought into view. */
export const Zoomed: Story = {
  render: () => <Editor zoom={4} start={210} />,
};

/**
 * At its first and last units, the playhead's thumb and line stay inside the
 * timeline. Two timelines on a page need different names, as any two regions do.
 */
export const AtTheEnds: Story = {
  name: "At the ends",
  render: () => (
    <div style={{ display: "grid", gap: "var(--hm-gap-loose)" }}>
      <Editor label="At the start" start={0} />
      <Editor label="At the end" start={FRAMES} />
    </div>
  ),
};

/**
 * With a clip track: a listbox with one Tab stop. ← and → move between clips
 * and select. Each clip's name says its place and range, which a screen
 * reader can't see on the track.
 */
export const WithClips: Story = {
  name: "With clips",
  render: () => <Editor clips="single" />,
};

/** Several clips selected: Shift extends, Ctrl or ⌘ moves without selecting, and Space adds or removes. */
export const SeveralSelected: Story = {
  name: "Several selected",
  render: () => <Editor clips="multiple" selected={["talk", "cut"]} start={30} />,
};

/** An editor that applies what the track reports: its clips are its own state. */
function Editable() {
  const [clips, setClips] = useState(CLIPS);
  const [selected, setSelected] = useState<readonly string[]>(["talk"]);
  const [frame, setFrame] = useState(90);
  const length = clips.reduce((sum, item) => sum + item.length, 0);
  const move = (keys: readonly string[], direction: -1 | 1) =>
    setClips((order) => {
      const moving = order.filter((item) => keys.includes(item.key));
      const rest = order.filter((item) => !keys.includes(item.key));
      const at = order.findIndex((item) => item.key === keys[0]);
      const before = order.slice(0, at).filter((item) => !keys.includes(item.key)).length;
      const to = Math.min(Math.max(before + direction, 0), rest.length);
      return [...rest.slice(0, to), ...moving, ...rest.slice(to)];
    });
  const trim = (key: string, delta: number) =>
    setClips((all) =>
      all.map((item) =>
        item.key === key ? { ...item, length: Math.max(1, item.length + delta) } : item,
      ),
    );
  const only = selected.length === 1 ? selected[0] : undefined;
  return (
    <div style={{ display: "grid", gap: "var(--hm-gap-normal)" }}>
      <Timeline label="Timeline" length={length}>
        <TimelineClips
          label="Clips"
          clips={clips}
          selectionMode="multiple"
          selectedKeys={selected}
          onSelectedKeysChange={setSelected}
          onMove={move}
          onTrim={(key, _edge, delta) => trim(key, delta)}
          trimStep={RATE / 2}
          trimLimits={() => ({ max: RATE * 2 })}
        />
        <TimelinePlayhead
          label="Playhead"
          position={Math.min(frame, length)}
          onPositionChange={setFrame}
          largeStep={RATE}
          formatValue={time}
        />
      </Timeline>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--hm-gap-tight)" }}>
        <Button
          size="small"
          aria-keyshortcuts="Alt+ArrowLeft"
          disabled={selected.length === 0}
          focusableWhenDisabled
          onClick={() => move(selected, -1)}
        >
          Move earlier
        </Button>
        <Button
          size="small"
          aria-keyshortcuts="Alt+ArrowRight"
          disabled={selected.length === 0}
          focusableWhenDisabled
          onClick={() => move(selected, 1)}
        >
          Move later
        </Button>
        <Button
          size="small"
          aria-keyshortcuts="Alt+BracketRight"
          disabled={only === undefined}
          focusableWhenDisabled
          onClick={() => only !== undefined && trim(only, -RATE / 2)}
        >
          Shorten
        </Button>
        <Button
          size="small"
          aria-keyshortcuts="Alt+Shift+BracketRight"
          disabled={only === undefined}
          focusableWhenDisabled
          onClick={() => only !== undefined && trim(only, RATE / 2)}
        >
          Lengthen
        </Button>
      </div>
    </div>
  );
}

/**
 * Moving and trimming. Alt+← and Alt+→ move the selected clips; Alt+[ and
 * Alt+] shorten the focused one, and with Shift lengthen it; dragging an
 * edge trims it. **The buttons are required:** they're the path for touch
 * and for people who don't know the keys, with the keys named on them.
 */
export const Editing: Story = {
  render: () => <Editable />,
};

/** Visual styles dropped: the native slider, with no line, and clips with no colours. */
export const Unstyled: Story = {
  render: () => <Editor unstyled clips="single" />,
};
