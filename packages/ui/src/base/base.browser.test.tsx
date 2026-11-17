import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "../react/ThemeProvider.js";
import { addStyle, cleanUp, loadStyles, mount } from "../test/dom.js";

beforeEach(async () => {
  await loadStyles();
});
afterEach(cleanUp);

/** What var(--hm-color-text) resolves to inside an element, as a computed colour. */
function themeText(element: Element): string {
  const probe = document.createElement("span");
  probe.style.color = "var(--hm-color-text)";
  element.append(probe);
  const colour = getComputedStyle(probe).color;
  probe.remove();
  return colour;
}

function colour(element: Element | null): string {
  if (!element) {
    throw new Error("missing element");
  }
  return getComputedStyle(element).color;
}

// A host page that sets its text colour from the tokens once, at the top, as
// hosts commonly do. Without the base rule, everything below inherits this
// computed light-theme colour, whatever theme a subtree uses.
const PAGE = '<div data-hm-theme="light" id="page" style="color: var(--hm-color-text)">';

describe("text in themed subtrees", () => {
  it("takes the subtree's text colour inside data-hm-theme", () => {
    const root = mount(`${PAGE}<section data-hm-theme="dark"><p id="text">Hi</p></section></div>`);
    const page = root.querySelector("#page") as Element;
    const dark = root.querySelector("section") as Element;
    expect(themeText(dark)).not.toBe(themeText(page));
    expect(colour(root.querySelector("#text"))).toBe(themeText(dark));
  });

  it("takes the subtree's text colour inside ThemeProvider, through its display: contents wrapper", () => {
    const root = mount(
      `${PAGE}${renderToString(
        <ThemeProvider mode="dark">
          <p id="text">Hi</p>
        </ThemeProvider>,
      )}</div>`,
    );
    const scope = root.querySelector("[data-hm-theme-scope]") as Element;
    expect(getComputedStyle(scope).display).toBe("contents");
    expect(themeText(scope)).not.toBe(themeText(root.querySelector("#page") as Element));
    expect(colour(root.querySelector("#text"))).toBe(themeText(scope));
  });

  it("lets unlayered host CSS still set the colour of a themed subtree", () => {
    addStyle(".host-text { color: rgb(1, 2, 3); }");
    const root = mount(
      `${PAGE}<section data-hm-theme="dark" class="host-text"><p id="text">Hi</p></section></div>`,
    );
    expect(colour(root.querySelector("section"))).toBe("rgb(1, 2, 3)");
    expect(colour(root.querySelector("#text"))).toBe("rgb(1, 2, 3)");
  });
});

describe("the hm-text class", () => {
  // A host page with its own type, as a host's stylesheet would set on body.
  const HOST =
    '<div id="host" style="font-family: serif; font-size: 30px; font-weight: 700; letter-spacing: 3px; line-height: 3; color: rgb(1, 2, 3)">';

  /** What a token resolves to for a property, inside an element. */
  function resolved(element: Element, property: string, token: string): string {
    const probe = document.createElement("span");
    probe.style.setProperty(property, `var(--hm-${token})`);
    element.append(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  const TOKENS = [
    ["color", "color-text"],
    ["font-family", "font-family"],
    ["font-size", "font-size-body"],
    ["font-weight", "font-weight-regular"],
    ["letter-spacing", "letter-spacing"],
  ] as const;

  it("gives text ui's type and colour, whatever the page around it sets", () => {
    const root = mount(
      `${HOST}<div class="hm-text"><p id="text">Hi</p></div><p id="plain">Hi</p></div>`,
    );
    const text = root.querySelector("#text") as Element;
    const plain = root.querySelector("#plain") as Element;
    for (const [property, token] of TOKENS) {
      const expected = resolved(root, property, token);
      expect(getComputedStyle(text).getPropertyValue(property), property).toBe(expected);
      expect(getComputedStyle(plain).getPropertyValue(property), property).not.toBe(expected);
    }
    // The line height is a number, so it's compared as lengths.
    expect(Number.parseFloat(getComputedStyle(text).lineHeight)).toBeLessThan(
      Number.parseFloat(getComputedStyle(text).fontSize) * 3,
    );
    // Not the browser's default serif, which is what an SDK's own text got.
    expect(getComputedStyle(text).fontFamily).not.toBe("serif");
  });

  it("leaves the page alone without the class", () => {
    const root = mount(`${HOST}<p id="plain">Hi</p></div>`);
    const plain = getComputedStyle(root.querySelector("#plain") as Element);
    expect(plain.fontFamily).toBe("serif");
    expect(plain.fontSize).toBe("30px");
    expect(plain.color).toBe("rgb(1, 2, 3)");
  });

  it("follows the theme and density it's in", () => {
    const root = mount(
      '<div data-hm-theme="light" class="hm-text" id="light">Hi</div><div data-hm-theme="dark" class="hm-text" id="dark">Hi</div>',
    );
    const light = root.querySelector("#light") as Element;
    const dark = root.querySelector("#dark") as Element;
    expect(colour(dark)).toBe(themeText(dark));
    expect(colour(dark)).not.toBe(colour(light));
  });

  it("loses to an SDK's rule in hm.sdk and to unlayered host CSS", () => {
    addStyle(
      "@layer hm.sdk { .sdk-editor { font-size: 11px; } } .host-text { color: rgb(4, 5, 6); }",
    );
    const root = mount('<div class="hm-text sdk-editor host-text" id="text">Hi</div>');
    const text = getComputedStyle(root.querySelector("#text") as Element);
    expect(text.fontSize).toBe("11px");
    expect(text.color).toBe("rgb(4, 5, 6)");
  });
});
