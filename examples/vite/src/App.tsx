import {
  AnnouncerProvider,
  Button,
  ColorField,
  Dialog,
  Field,
  FileDropZone,
  Heading,
  HiddenIcon,
  IconButton,
  MoveDownIcon,
  MoveUpIcon,
  NumberField,
  ProgressBar,
  ReorderableList,
  ReorderableListItem,
  SegmentedControl,
  Slider,
  Spinner,
  TextArea,
  TextField,
  ThemeProvider,
  Timeline,
  TimelineClips,
  TimelineLane,
  TimelineLayer,
  TimelinePlayhead,
  ToggleButton,
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
  Tooltip,
  UndoIcon,
  useAnnounce,
  VisibleIcon,
  VisuallyHidden,
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

/** A timeline of 300 frames at 30 a second, with the playhead's time as text. */
function Clock() {
  const [frame, setFrame] = useState(60);
  const [selected, setSelected] = useState<readonly string[]>(["intro"]);
  const [clips, setClips] = useState([
    { key: "intro", name: "Intro", length: 90 },
    { key: "talk", name: "Talk", length: 150 },
    { key: "outro", name: "Outro", length: 60 },
  ]);
  // The track reports a move; the application owns the order.
  const move = (keys: readonly string[], direction: -1 | 1) =>
    setClips((order) => {
      const moving = order.filter((clip) => keys.includes(clip.key));
      const rest = order.filter((clip) => !keys.includes(clip.key));
      const at = order.findIndex((clip) => clip.key === keys[0]);
      const before = order.slice(0, at).filter((clip) => !keys.includes(clip.key)).length;
      const to = Math.min(Math.max(before + direction, 0), rest.length);
      return [...rest.slice(0, to), ...moving, ...rest.slice(to)];
    });
  const trim = (key: string, delta: number) =>
    setClips((all) =>
      all.map((clip) =>
        clip.key === key ? { ...clip, length: Math.max(1, clip.length + delta) } : clip,
      ),
    );
  const length = clips.reduce((sum, clip) => sum + clip.length, 0);
  return (
    <div>
      <Timeline label="Timeline" length={length}>
        <TimelineLayer />
        <TimelineClips
          label="Clips"
          selectionMode="multiple"
          clips={clips.map((clip, index) => ({
            key: clip.key,
            length: clip.length,
            label: `Clip ${index + 1} of ${clips.length}, ${clip.name}`,
            content: clip.name,
          }))}
          selectedKeys={selected}
          onSelectedKeysChange={setSelected}
          onMove={move}
          onTrim={(key, _edge, delta) => trim(key, delta)}
        />
        <TimelinePlayhead
          label="Playhead"
          position={Math.min(frame, length)}
          onPositionChange={setFrame}
          largeStep={30}
          formatValue={(position) => `${(position / 30).toFixed(1)} seconds`}
        />
      </Timeline>
      {/* The path that always works: buttons, with the keys named on them. */}
      <Button aria-keyshortcuts="Alt+ArrowLeft" onClick={() => move(selected, -1)}>
        Move clips earlier
      </Button>
      <Button aria-keyshortcuts="Alt+ArrowRight" onClick={() => move(selected, 1)}>
        Move clips later
      </Button>
    </div>
  );
}

/** A timeline of two tracks: lanes, with a header each, and one selection for both. */
function Mix() {
  const [selected, setSelected] = useState<readonly string[]>(["voice-1"]);
  const [muted, setMuted] = useState<readonly string[]>([]);
  const [frame, setFrame] = useState(0);
  // Voice lies back to back; Music's clips have a start each, with room between.
  const tracks: { id: string; name: string; clips: number[]; at?: number[] }[] = [
    { id: "voice", name: "Voice", clips: [120, 180] },
    { id: "music", name: "Music", clips: [60, 100, 80], at: [20, 100, 220] },
  ];
  return (
    <Timeline label="Mix" length={300}>
      <TimelinePlayhead label="Mix playhead" position={frame} onPositionChange={setFrame} />
      {tracks.map((track) => (
        <TimelineLane
          key={track.id}
          id={track.id}
          label={`${track.name} track`}
          header={
            <>
              <span>{track.name}</span>
              <ToggleButton
                variant="quiet"
                pressed={muted.includes(track.id)}
                onPressedChange={(on) =>
                  setMuted((ids) => (on ? [...ids, track.id] : ids.filter((id) => id !== track.id)))
                }
              >
                Mute {track.name}
              </ToggleButton>
            </>
          }
        >
          <TimelineClips
            label={`${track.name} clips`}
            clips={track.clips.map((length, index) => ({
              key: `${track.id}-${index + 1}`,
              length,
              at: track.at?.[index],
              label: `${track.name} ${index + 1}, clip ${index + 1} of ${track.clips.length}`,
              content: `${track.name} ${index + 1}`,
            }))}
            selectedKeys={selected}
            onSelectedKeysChange={setSelected}
          />
        </TimelineLane>
      ))}
    </Timeline>
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
      <Clock />
      <Mix />
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

/** Every component, rendered on the server at build time and hydrated in the browser. */
export function App() {
  return (
    <ThemeProvider mode="light">
      <main className="brand">
        <h1>@hussmartinez/ui in Vite</h1>
        <Toolbar label="Page tools">
          <ToolbarGroup label="History">
            <Tooltip type="label" content="Undo">
              <IconButton variant="quiet" label="Undo" icon={<UndoIcon />} />
            </Tooltip>
            <Tooltip content="Repeats the change you last undid">
              <Button variant="quiet">Redo</Button>
            </Tooltip>
          </ToolbarGroup>
          <ToolbarSeparator />
          <ToggleButton variant="quiet">Loop</ToggleButton>
          <ToolbarSeparator />
          <Button variant="primary">Export</Button>
        </Toolbar>
        <section aria-labelledby="status-title">
          <Heading id="status-title">Status</Heading>
          <Spinner label="Loading pages" />
          <ProgressBar value={40} label="Exporting" />
        </section>
        <Field label="Volume" description="For playback only">
          <Slider defaultValue={40} />
        </Field>
        <Field label="File name">
          <TextField defaultValue="report" />
        </Field>
        <Field label="Caption">
          <TextArea defaultValue="A page" />
        </Field>
        <Field label="Fill">
          <ColorField
            defaultValue="#1570ef"
            swatches={[
              { value: "#d92d20", label: "Red" },
              { value: "#1570ef", label: "Blue" },
            ]}
          />
        </Field>
        <Field label="Copies">
          <NumberField min={1} max={99} defaultValue={1} />
        </Field>
        <VisuallyHidden>Only for screen readers</VisuallyHidden>
        {/* A mirrored icon in nested directions, on a page whose lang isn't right to left. */}
        <div dir="rtl" data-case="rtl">
          <UndoIcon />
          <div dir="ltr" data-case="rtl-ltr">
            <UndoIcon />
            <div dir="rtl" data-case="rtl-ltr-rtl">
              <UndoIcon />
            </div>
          </div>
        </div>
        <div dir="ltr">
          <div dir="rtl" data-case="ltr-rtl">
            <UndoIcon />
          </div>
        </div>
        <AnnouncerProvider>
          <Controls />
        </AnnouncerProvider>
      </main>
    </ThemeProvider>
  );
}
