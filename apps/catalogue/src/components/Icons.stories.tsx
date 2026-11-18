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
 * In right-to-left text, icons that point along the reading direction, such
 * as undo and redo, mirror. Media controls and physical directions don't.
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
 * apart at a glance.
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
        </div>
      ))}
    </div>
  ),
};
