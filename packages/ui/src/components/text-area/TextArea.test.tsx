import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Field } from "../field/Field.js";
import { TextArea } from "./TextArea.js";

afterEach(() => {
  vi.restoreAllMocks();
});

/** The value of an attribute on the `<textarea>`. */
const attribute = (html: string, name: string) =>
  new RegExp(`<textarea\\b[^>]*\\s${name}="([^"]*)"`, "i").exec(html)?.[1];

describe("TextArea on the server", () => {
  it("renders a named textarea of three rows, with the text field's class and its own", () => {
    const html = renderToString(<TextArea label="Caption" defaultValue={"One\nTwo"} />);
    expect(attribute(html, "aria-label")).toBe("Caption");
    expect(attribute(html, "rows")).toBe("3");
    expect(attribute(html, "class")).toBe("hm-text-field hm-text-area");
    expect(html).toContain(">One\nTwo</textarea>");
  });

  it("passes native attributes through, and escapes its text", () => {
    const html = renderToString(
      <TextArea
        label="Caption"
        rows={6}
        placeholder="Text"
        maxLength={200}
        defaultValue={"</textarea><script>x</script>"}
      />,
    );
    expect(attribute(html, "rows")).toBe("6");
    expect(attribute(html, "placeholder")).toBe("Text");
    expect(attribute(html, "maxLength")).toBe("200");
    expect(html).not.toContain("<script>");
  });

  it("connects to a Field", () => {
    const html = renderToString(
      <Field label="Caption" error="Enter some text">
        <TextArea />
      </Field>,
    );
    expect(attribute(html, "id")).toBe(/<label[^>]*for="([^"]+)"/.exec(html)?.[1]);
    expect(attribute(html, "aria-invalid")).toBe("true");
    expect(attribute(html, "aria-describedby")).toBeTruthy();
    expect(attribute(html, "aria-label")).toBeUndefined();
  });

  it("adds className and classNames, and marks unstyled", () => {
    const html = renderToString(
      <TextArea label="Caption" className="app" classNames={{ root: "root" }} unstyled />,
    );
    expect(attribute(html, "class")).toBe("hm-text-field hm-text-area root app");
    expect(attribute(html, "data-hm-unstyled")).toBe("");
  });

  it("warns in development without an accessible name, and with a name inside a Field", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderToString(<TextArea />);
    expect(warn).toHaveBeenLastCalledWith(
      expect.stringMatching(/TextArea needs an accessible name/),
    );
    renderToString(
      <Field label="Caption">
        <TextArea label="Text" />
      </Field>,
    );
    expect(warn).toHaveBeenLastCalledWith(expect.stringMatching(/set Field's label instead/));
  });
});
