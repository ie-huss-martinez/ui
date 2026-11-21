/**
 * A Server Component. It imports the server-safe entry, which must not touch
 * the browser, and renders components from the client entry directly, which
 * only works if their "use client" directive survived the build (ADR 0007).
 */
import { createTheme, themeToCss, tokens } from "@hussmartinez/ui";
import {
  Button,
  ColorField,
  Field,
  Heading,
  IconButton,
  NumberField,
  ProgressBar,
  Slider,
  Spinner,
  TextArea,
  TextField,
  ThemeProvider,
  ToggleButton,
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
  Tooltip,
  UndoIcon,
  VisuallyHidden,
} from "@hussmartinez/ui/react";
import { Interactive } from "./Interactive";

// Created on the server. A theme passed to a client component as a prop is
// serialised, so on the server it's written as CSS instead.
const brand = createTheme({ extends: "light", tokens: { "color-accent": "#5b21b6" } });

export default function Page() {
  return (
    <ThemeProvider mode="light">
      <style
        // themeToCss output is allowlisted and never contains "<".
        dangerouslySetInnerHTML={{ __html: themeToCss(brand, ".brand") }}
      />
      <main className="brand">
        <h1>@hussmartinez/ui in Next.js</h1>
        <p data-testid="token-count">{tokens.length}</p>
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
        <Interactive />
      </main>
    </ThemeProvider>
  );
}
