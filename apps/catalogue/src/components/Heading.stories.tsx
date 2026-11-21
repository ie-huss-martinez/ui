import { nestedHeadingLevel } from "@hussmartinez/ui";
import { Heading, HeadingLevelProvider, useHeadingLevel } from "@hussmartinez/ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";

/**
 * The visible title of a section, in a page whose outline belongs to the host
 * (sdk-core ADR 0058). The level comes from `level`, or from the closest
 * `HeadingLevelProvider`, so an editor's host sets one number: its
 * `headingLevel`. Every level looks the same; only the outline differs.
 */
const meta = { title: "Components/Heading" } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const column = { display: "grid", gap: "var(--hm-gap-normal)", maxInlineSize: "28rem" } as const;
const text = { margin: 0 } as const;

/** Each level from 2 to 6, and one unstyled, which keeps the host's typography. */
export const Levels: Story = {
  render: () => (
    <div style={column}>
      {([2, 3, 4, 5, 6] as const).map((level) => (
        <Heading key={level} level={level}>
          Level {level}
        </Heading>
      ))}
      <Heading level={6} unstyled>
        Level 6, unstyled
      </Heading>
    </div>
  ),
};

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const level = useHeadingLevel();
  return (
    <section aria-labelledby={id} style={column}>
      <Heading id={id}>{title}</Heading>
      <HeadingLevelProvider level={nestedHeadingLevel(level)}>{children}</HeadingLevelProvider>
    </section>
  );
}

/**
 * An inspector at `headingLevel` 3: its title is an `<h3>`, and the sections
 * inside it are `<h4>`s, each labelling its `<section>`.
 */
export const NestedSections: Story = {
  name: "Nested sections",
  render: () => (
    <HeadingLevelProvider level={3}>
      <Section id="inspector" title="Selection">
        <Section id="inspector-clip" title="Clip">
          <p style={text}>Intro, 0:00 to 0:12</p>
        </Section>
        <Section id="inspector-effects" title="Effects">
          <p style={text}>Fade in, 1 second</p>
        </Section>
      </Section>
    </HeadingLevelProvider>
  ),
};
