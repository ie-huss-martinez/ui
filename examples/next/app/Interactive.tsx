"use client";

/**
 * Components that need callbacks, which can't cross from a Server Component.
 * data-hydrated marks the moment React has taken over.
 */
import {
  AnnouncerProvider,
  Button,
  Dialog,
  FileDropZone,
  HiddenIcon,
  IconButton,
  MoveDownIcon,
  MoveUpIcon,
  ReorderableList,
  ReorderableListItem,
  SegmentedControl,
  ToggleButton,
  useAnnounce,
  VisibleIcon,
} from "@hussmartinez/ui/react";
import { useEffect, useState } from "react";

/**
 * A reorderable list as an editor uses it: the list owns no order, and the
 * buttons under it are the path that always works, with the keys named on
 * them. The list's own keys are an addition.
 */
function Layers() {
  const [layers, setLayers] = useState(["Title", "Photo", "Background"]);
  const [selected, setSelected] = useState("Photo");
  const [hidden, setHidden] = useState<readonly string[]>([]);
  const index = layers.indexOf(selected);
  const move = (id: string, toIndex: number) =>
    setLayers((order) => {
      const next = order.filter((layer) => layer !== id);
      next.splice(toIndex, 0, id);
      return next;
    });
  return (
    <div>
      <ReorderableList
        label="Layers"
        selectedId={selected}
        onSelectedChange={setSelected}
        onMove={move}
      >
        {layers.map((layer) => (
          <ReorderableListItem
            key={layer}
            id={layer}
            label={layer}
            controls={[
              <ToggleButton
                key="visible"
                variant="quiet"
                label={`Show ${layer}`}
                icon={hidden.includes(layer) ? <HiddenIcon /> : <VisibleIcon />}
                pressed={!hidden.includes(layer)}
                onPressedChange={(visible) =>
                  setHidden((ids) => (visible ? ids.filter((id) => id !== layer) : [...ids, layer]))
                }
              />,
            ]}
          >
            {layer}
          </ReorderableListItem>
        ))}
      </ReorderableList>
      <IconButton
        label="Move layer up"
        icon={<MoveUpIcon />}
        aria-keyshortcuts="Alt+ArrowUp"
        disabled={index <= 0}
        focusableWhenDisabled
        onClick={() => move(selected, index - 1)}
      />
      <IconButton
        label="Move layer down"
        icon={<MoveDownIcon />}
        aria-keyshortcuts="Alt+ArrowDown"
        disabled={index === layers.length - 1}
        focusableWhenDisabled
        onClick={() => move(selected, index + 1)}
      />
    </div>
  );
}

function Controls() {
  const announce = useAnnounce();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"single" | "grid">("single");
  const [received, setReceived] = useState<string>();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return (
    <section data-hydrated={hydrated ? "" : undefined}>
      <SegmentedControl
        label="View"
        value={view}
        onValueChange={setView}
        options={[
          { value: "single", label: "Single" },
          { value: "grid", label: "Grid" },
        ]}
      />
      <Layers />
      <FileDropZone accept=".pdf,application/pdf" onFiles={([file]) => setReceived(file?.name)}>
        {/* The name comes from the file: rendered as text, never as markup. */}
        {received ? <p data-testid="received">Received {received}</p> : null}
      </FileDropZone>
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Export"
        footer={
          <Button
            variant="primary"
            onClick={() => {
              setOpen(false);
              announce("Exported");
            }}
          >
            Confirm
          </Button>
        }
      >
        <p>Export this document?</p>
      </Dialog>
    </section>
  );
}

export function Interactive() {
  return (
    <AnnouncerProvider>
      <Controls />
    </AnnouncerProvider>
  );
}
