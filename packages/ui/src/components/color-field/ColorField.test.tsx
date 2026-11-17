import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Field } from "../field/Field.js";
import { ColorField } from "./ColorField.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const swatches = [
  { value: "#D92D20", label: "Red" },
  { value: "#17f", label: "Blue" },
];

/** The value of an attribute on the first text input. */
const attribute = (html: string, name: string) =>
  new RegExp(`<input\\b[^>]*\\s${name}="([^"]*)"`, "i").exec(html)?.[1];

describe("ColorField on the server", () => {
  it("renders a named hex input with the colour as text and as a fill", () => {
    const html = renderToString(<ColorField label="Fill" defaultValue="#D92D20" />);
    expect(attribute(html, "type")).toBe("text");
    expect(attribute(html, "aria-label")).toBe("Fill");
    expect(attribute(html, "value")).toBe("#d92d20");
    expect(attribute(html, "class")).toBe("hm-text-field hm-color-field-input");
    expect(html).toContain('fill="#d92d20"');
    expect(html).not.toContain("radiogroup");
    // Nothing a strict Content Security Policy would block.
    expect(html).not.toContain("style=");
  });

  it("starts black, and falls back to its last colour when the value isn't one", () => {
    expect(attribute(renderToString(<ColorField label="Fill" />), "value")).toBe("#000000");
    const html = renderToString(<ColorField label="Fill" value={'red" onload="x'} />);
    expect(attribute(html, "value")).toBe("#000000");
    expect(html).not.toContain("onload");
  });

  it("renders swatches as a radio group named after the field, with one Tab stop", () => {
    const html = renderToString(<ColorField label="Fill" value="#1177ff" swatches={swatches} />);
    const group = /<div role="radiogroup" aria-labelledby="([^"]+)"/.exec(html)?.[1]?.split(" ");
    expect(group).toHaveLength(2);
    for (const [id, text] of [
      [group?.[0], "Fill"],
      [group?.[1], "swatches"],
    ]) {
      expect(html).toContain(`<span id="${id}" hidden="">${text}</span>`);
    }
    const radios = [...html.matchAll(/<button\b[^>]*role="radio"[^>]*>/g)].map(([tag]) => tag);
    expect(radios).toHaveLength(2);
    expect(radios[0]).toContain('aria-label="Red"');
    expect(radios[0]).toContain('aria-checked="false"');
    expect(radios[0]).toContain('tabindex="-1"');
    // #17f is #1177ff.
    expect(radios[1]).toContain('aria-checked="true"');
    expect(radios[1]).toContain('tabindex="0"');
    expect(radios[1]).toContain('data-hm-value="#1177ff"');
  });

  it("takes its name, description and error from a Field", () => {
    const html = renderToString(
      <Field label="Fill" error="Pick a colour">
        <ColorField swatches={swatches} swatchesLabel="presets" />
      </Field>,
    );
    const labelId = /<label id="([^"]+)" for="([^"]+)"/.exec(html);
    expect(attribute(html, "id")).toBe(labelId?.[2]);
    expect(attribute(html, "aria-invalid")).toBe("true");
    expect(attribute(html, "aria-describedby")).toBeTruthy();
    expect(attribute(html, "aria-label")).toBeUndefined();
    // The swatch group is named by the field's label, then the word.
    expect(html).toMatch(new RegExp(`role="radiogroup" aria-labelledby="${labelId?.[1]} [^" ]+"`));
    expect(html).toContain('hidden="">presets</span>');
  });

  it("adds className and classNames, and marks unstyled", () => {
    const html = renderToString(
      <ColorField
        label="Fill"
        swatches={swatches}
        className="app"
        classNames={{ root: "root", input: "input", swatch: "swatch" }}
        unstyled
      />,
    );
    expect(html).toContain('<div class="hm-color-field root app" data-hm-unstyled="">');
    expect(attribute(html, "class")).toBe("hm-text-field hm-color-field-input input");
    expect(html).toContain('class="hm-color-field-swatch swatch"');
  });

  it("submits the colour with a form, and disables every part", () => {
    const html = renderToString(
      <ColorField label="Fill" name="fill" value="#1177ff" swatches={swatches} disabled />,
    );
    const hidden = /<input\b[^>]*type="hidden"[^>]*>/.exec(html)?.[0];
    expect(hidden).toContain('name="fill"');
    expect(hidden).toContain('value="#1177ff"');
    expect(html.match(/disabled=""/g)).toHaveLength(4);
  });

  it("warns in development without a name, and about a swatch that isn't a colour", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderToString(<ColorField />);
    expect(warn).toHaveBeenLastCalledWith(
      expect.stringMatching(/ColorField needs an accessible name/),
    );
    const html = renderToString(
      <ColorField label="Fill" swatches={[{ value: "tomato", label: "Tomato" }]} />,
    );
    expect(warn).toHaveBeenLastCalledWith(expect.stringMatching(/skipped the swatch "Tomato"/));
    expect(html).not.toContain("radiogroup");
  });
});
