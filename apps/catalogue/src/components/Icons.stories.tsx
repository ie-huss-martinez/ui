import * as ui from "@hussmartinez/ui/react";
import { Button, IconButton, type IconComponent } from "@hussmartinez/ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * ui's icon set, generated from Lucide (docs/adr/0005). Each icon is a
 * component, such as `UndoIcon`, named after its use in the SDK family. They
 * draw with `currentColor`, size to `--hm-icon-size`, and are decorative
 * unless given a `label`.
 */
const meta = { title: "Foundations/Icons" } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** `UndoIcon` becomes `undo`, as in the `IconName` type. */
const kebab = (component: string) =>
  component
    .replace(/Icon$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();

const icons = Object.entries(ui)
  .filter(([name]) => /^[A-Z]\w*Icon$/.test(name))
  .map(([name, component]) => ({ name: kebab(name), Icon: component as IconComponent }));

const grid = {
  display: "grid",
  gap: "var(--hm-gap-normal)",
  gridTemplateColumns: "repeat(auto-fill, minmax(7.5rem, 1fr))",
  listStyle: "none",
  margin: 0,
  padding: 0,
} as const;
const cell = {
  alignItems: "center",
  display: "grid",
  gap: "var(--hm-gap-tight)",
  justifyItems: "center",
  padding: "var(--hm-inset-tight)",
} as const;
const caption = { fontFamily: "var(--hm-font-family-mono)", fontSize: "var(--hm-font-size-small)" };

/** Every icon, with its name. */
export const All: Story = {
  render: () => (
    <ul style={grid}>
      {icons.map(({ name, Icon }) => (
        <li key={name} style={cell}>
          <Icon />
          <code style={caption}>{name}</code>
        </li>
      ))}
    </ul>
  ),
};

/**
 * In right-to-left text, icons that point along the reading direction or
 * along time mirror, such as undo, redo and the chevrons, so Next points left.
 * Play and physical directions, such as up and down, don't.
 */
export const RightToLeft: Story = {
  name: "Right to left",
  render: () => (
    <div dir="rtl" style={{ display: "flex", gap: "var(--hm-gap-normal)" }}>
      <IconButton variant="quiet" label="Undo" icon={<ui.UndoIcon />} />
      <IconButton variant="quiet" label="Redo" icon={<ui.RedoIcon />} />
      <IconButton variant="quiet" label="Play" icon={<ui.PlayIcon />} />
      <IconButton variant="quiet" label="Next" icon={<ui.ChevronRightIcon />} />
    </div>
  ),
};

/** In buttons, the icon slot sets the size; alone, `--hm-icon-size` does. */
export const InUse: Story = {
  name: "In use",
  render: () => (
    <div style={{ alignItems: "center", display: "flex", gap: "var(--hm-gap-normal)" }}>
      <Button variant="primary" startIcon={<ui.DownloadIcon />}>
        Download
      </Button>
      <IconButton label="Zoom in" icon={<ui.ZoomInIcon />} />
      <span style={{ ["--hm-icon-size" as string]: "2rem", color: "var(--hm-color-accent-text)" }}>
        <ui.InfoIcon label="Information" />
      </span>
    </div>
  ),
};

/**
 * Tools for editing time, as an audio or video editor's toolbar has them,
 * left to right and right to left. `range-start` and `range-end` are ui's own
 * glyphs, drawn on Lucide's grid and stroke because Lucide has none for them;
 * they sit beside Lucide's trim and split glyphs here so they can be told
 * apart at a glance. Everything here but split and ripple points along time,
 * so it mirrors in right-to-left text.
 */
export const EditingTime: Story = {
  name: "Editing time",
  render: () => (
    <div style={{ display: "grid", gap: "var(--hm-gap-normal)" }}>
      {(["ltr", "rtl"] as const).map((dir) => (
        <div key={dir} dir={dir} style={{ display: "flex", gap: "var(--hm-gap-tight)" }}>
          <IconButton variant="quiet" label="Set the range's start" icon={<ui.RangeStartIcon />} />
          <IconButton variant="quiet" label="Set the range's end" icon={<ui.RangeEndIcon />} />
          <IconButton variant="quiet" label="Ripple" icon={<ui.RippleIcon />} />
          <IconButton variant="quiet" label="Trim the start" icon={<ui.TrimStartIcon />} />
          <IconButton variant="quiet" label="Trim the end" icon={<ui.TrimEndIcon />} />
          <IconButton variant="quiet" label="Split" icon={<ui.SplitIcon />} />
          <IconButton variant="quiet" label="Fade in" icon={<ui.FadeInIcon />} />
          <IconButton variant="quiet" label="Fade out" icon={<ui.FadeOutIcon />} />
          <IconButton variant="quiet" label="Move earlier" icon={<ui.ChevronLeftIcon />} />
          <IconButton variant="quiet" label="Move later" icon={<ui.ChevronRightIcon />} />
        </div>
      ))}
    </div>
  ),
};

/**
 * A transport over a timeline, left to right and right to left. In
 * right-to-left text the timeline runs from right to left, so going to the
 * start and the end mirror to point at them; play doesn't, because a triangle
 * pointing left reads as rewind (docs/adr/0005, amended).
 */
export const Transport: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "var(--hm-gap-loose)" }}>
      {(["ltr", "rtl"] as const).map((dir) => (
        <div key={dir} dir={dir} style={{ display: "grid", gap: "var(--hm-gap-tight)" }}>
          <div style={{ display: "flex", gap: "var(--hm-gap-tight)" }}>
            <IconButton variant="quiet" label="Go to the start" icon={<ui.SkipBackIcon />} />
            <IconButton variant="quiet" label="Play" icon={<ui.PlayIcon />} />
            <IconButton variant="quiet" label="Go to the end" icon={<ui.SkipForwardIcon />} />
          </div>
          <ui.Timeline label={`Timeline, ${dir}`} length={300}>
            <ui.TimelinePlayhead label="Playhead" position={100} onPositionChange={() => {}} />
          </ui.Timeline>
        </div>
      ))}
    </div>
  ),
};
