import {
  AnnouncerProvider,
  DeleteIcon,
  HiddenIcon,
  IconButton,
  MoveDownIcon,
  MoveUpIcon,
  ReorderableList,
  ReorderableListItem,
  ToggleButton,
  VisibleIcon,
} from "@hussmartinez/ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

/**
 * A list whose items the user selects, reorders and removes, with one Tab
 * stop and room for controls in each row. Alt+↑ and Alt+↓ (Option on macOS)
 * move the focused item; Delete removes it.
 */
const meta = {
  title: "Components/ReorderableList",
  component: ReorderableList,
  args: { label: "Layers" },
} satisfies Meta<typeof ReorderableList>;

export default meta;
type Story = StoryObj<typeof meta>;

const panel = { display: "grid", gap: "var(--hm-gap-normal)", maxInlineSize: "18rem" } as const;
const buttons = { display: "flex", gap: "var(--hm-gap-tight)" } as const;

function Layers({ unstyled = false, withButtons = true }) {
  const [layers, setLayers] = useState(["Title", "Photo", "Shape", "Background"]);
  const [selected, setSelected] = useState<string | null>("Photo");
  const [hidden, setHidden] = useState<readonly string[]>(["Shape"]);
  const index = selected === null ? -1 : layers.indexOf(selected);
  const move = (id: string, toIndex: number) =>
    setLayers((order) => {
      const next = order.filter((layer) => layer !== id);
      next.splice(toIndex, 0, id);
      return next;
    });
  const remove = (id: string) => {
    const at = layers.indexOf(id);
    const next = layers.filter((layer) => layer !== id);
    setLayers(next);
    setSelected(next[Math.min(at, next.length - 1)] ?? null);
  };
  return (
    <AnnouncerProvider>
      <div style={panel}>
        <ReorderableList
          label="Layers"
          selectedId={selected}
          onSelectedChange={setSelected}
          onMove={move}
          onRemove={remove}
          unstyled={unstyled}
        >
          {layers.map((layer) => (
            <ReorderableListItem
              key={layer}
              id={layer}
              label={layer}
              unstyled={unstyled}
              controls={[
                <ToggleButton
                  key="visible"
                  variant="quiet"
                  size="small"
                  label={`Show ${layer}`}
                  icon={hidden.includes(layer) ? <HiddenIcon /> : <VisibleIcon />}
                  pressed={!hidden.includes(layer)}
                  onPressedChange={(visible) =>
                    setHidden((ids) =>
                      visible ? ids.filter((id) => id !== layer) : [...ids, layer],
                    )
                  }
                />,
              ]}
            >
              {layer}
            </ReorderableListItem>
          ))}
        </ReorderableList>
        {withButtons ? (
          <div style={buttons}>
            <IconButton
              label="Move up"
              icon={<MoveUpIcon />}
              aria-keyshortcuts="Alt+ArrowUp"
              disabled={index <= 0}
              focusableWhenDisabled
              onClick={() => selected !== null && move(selected, index - 1)}
            />
            <IconButton
              label="Move down"
              icon={<MoveDownIcon />}
              aria-keyshortcuts="Alt+ArrowDown"
              disabled={index === -1 || index === layers.length - 1}
              focusableWhenDisabled
              onClick={() => selected !== null && move(selected, index + 1)}
            />
            <IconButton
              label="Delete"
              icon={<DeleteIcon />}
              aria-keyshortcuts="Delete"
              disabled={index === -1}
              focusableWhenDisabled
              onClick={() => selected !== null && remove(selected)}
            />
          </div>
        ) : null}
      </div>
    </AnnouncerProvider>
  );
}

/**
 * As an editor uses it. The list owns no order: it calls `onMove` and
 * `onRemove`, and the story renders the result. **The buttons under the list
 * are required:** they're the path for touch and for people who don't know
 * the keys, and they name the keys with `aria-keyshortcuts`.
 */
export const Default: Story = {
  render: () => <Layers />,
};

/** Visual styles dropped: layout, focus rings and target sizes stay. */
export const Unstyled: Story = {
  render: () => <Layers unstyled withButtons={false} />,
};

/** Without `onMove` and `onRemove`: a selectable list, with nothing to reorder. */
export const SelectOnly: Story = {
  name: "Select only",
  render: function SelectOnly() {
    const [selected, setSelected] = useState("Intro");
    return (
      <div style={panel}>
        <ReorderableList label="Tracks" selectedId={selected} onSelectedChange={setSelected}>
          {["Intro", "Interview", "Outro"].map((track) => (
            <ReorderableListItem key={track} id={track} label={track}>
              {track}
            </ReorderableListItem>
          ))}
        </ReorderableList>
      </div>
    );
  },
};
