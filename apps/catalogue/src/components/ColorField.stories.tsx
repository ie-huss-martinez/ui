import { ColorField, Field } from "@hussmartinez/ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

const swatches = [
  { value: "#101828", label: "Black" },
  { value: "#ffffff", label: "White" },
  { value: "#d92d20", label: "Red" },
  { value: "#f79009", label: "Orange" },
  { value: "#fdb022", label: "Yellow" },
  { value: "#12b76a", label: "Green" },
  { value: "#1570ef", label: "Blue" },
  { value: "#7a5af8", label: "Purple" },
];

/**
 * A colour input: a hex field with a preview, and optional swatches. It
 * doesn't use the browser's own colour picker.
 */
const meta = {
  title: "Components/ColorField",
  component: ColorField,
  args: { label: "Fill", defaultValue: "#1570ef", swatches },
} satisfies Meta<typeof ColorField>;

export default meta;
type Story = StoryObj<typeof meta>;

const column = { display: "grid", gap: "var(--hm-gap-loose)", maxInlineSize: "20rem" } as const;

export const Default: Story = {};

/** With visible labels, as in an inspector: each swatch group is named after its field. */
export const InField: Story = {
  name: "In a field",
  render: function InField() {
    const [fill, setFill] = useState("#d92d20");
    const [stroke, setStroke] = useState("#101828");
    return (
      <div style={column}>
        <Field label="Fill" description="Of the selected shape.">
          <ColorField value={fill} onValueChange={setFill} swatches={swatches} />
        </Field>
        <Field label="Stroke">
          <ColorField value={stroke} onValueChange={setStroke} swatches={swatches} />
        </Field>
      </div>
    );
  },
};

/** The hex input alone. */
export const WithoutSwatches: Story = {
  name: "Without swatches",
  args: { swatches: undefined },
};

export const Disabled: Story = {
  args: { disabled: true },
};

/** Visual styles dropped: layout, focus rings and target sizes stay. */
export const Unstyled: Story = {
  args: { unstyled: true },
};
