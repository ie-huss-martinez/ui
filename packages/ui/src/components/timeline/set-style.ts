/** What was last written to each element, so the same value isn't written again. */
const written = /* @__PURE__ */ new WeakMap<HTMLElement, Map<string, string>>();

/**
 * Sets an inline style through the CSSOM, which a strict Content Security
 * Policy allows where it blocks `style` attributes, and only when the value
 * changed. The timeline's parts size and place themselves at every commit;
 * writing the same value again would dirty the element's style each time.
 * An empty value removes the property.
 */
export function setStyle(element: HTMLElement, property: string, value: string): void {
  let last = written.get(element);
  if (!last) {
    last = new Map();
    written.set(element, last);
  }
  if ((last.get(property) ?? "") === value) {
    return;
  }
  last.set(property, value);
  if (value === "") {
    element.style.removeProperty(property);
  } else {
    element.style.setProperty(property, value);
  }
}
