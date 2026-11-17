import { Field, TextArea } from "@hussmartinez/ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

/** A multi-line text input, styled like `TextField`. In a `Field`, it takes the field's label, description and error. */
const meta = {
  title: "Components/TextArea",
  component: TextArea,
  args: { label: "Caption", defaultValue: "A view of the harbour\nat dusk" },
} satisfies Meta<typeof TextArea>;

export default meta;
type Story = StoryObj<typeof meta>;

const column = { display: "grid", gap: "var(--hm-gap-loose)", maxInlineSize: "20rem" } as const;

export const Default: Story = {};

/** With a visible label, a description and live validation. */
export const InField: Story = {
  name: "In a field",
  render: function InField() {
    const [text, setText] = useState("A view of the harbour at dusk, from the old lighthouse");
    return (
      <div style={column}>
        <Field
          label="Caption"
          description="Up to 40 characters."
          error={text.length > 40 ? "The caption is too long." : undefined}
        >
          <TextArea value={text} onValueChange={setText} />
        </Field>
        <Field label="Notes">
          <TextArea rows={5} placeholder="Anything else" />
        </Field>
      </div>
    );
  },
};

export const Disabled: Story = {
  args: { disabled: true },
};

/** Visual styles dropped: the native textarea, with its focus ring and target size. */
export const Unstyled: Story = {
  args: { unstyled: true },
};
