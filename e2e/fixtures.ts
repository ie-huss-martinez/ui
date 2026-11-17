import { test as base } from "@playwright/test";

export { expect, type Page } from "@playwright/test";

/**
 * Playwright's `test`, with a guard against a Firefox crash (ui#61).
 *
 * Firefox 159 crashes the page when an element's `ariaLabelledByElements` is
 * read from two JavaScript worlds. Playwright's role locators read it from
 * their isolated world to compute a name, and axe-core reads it from the
 * page's world, so `getByRole("button", { name })` and an axe run on the same
 * page crash it, in either order. Two lines reproduce it, with no library:
 * `<button aria-labelledby="x"></button><span id="x">Undo</span>`.
 *
 * So in Firefox the property is removed from the page's world before any
 * script runs. axe then resolves `aria-labelledby` by ID, as it does in
 * browsers without the property, and reports the same results. The package
 * never reads the property, and Playwright's world keeps its own copy.
 */
export const test = base.extend({
  page: async ({ page, browserName }, use) => {
    if (browserName === "firefox") {
      await page.addInitScript(() => {
        delete (Element.prototype as { ariaLabelledByElements?: unknown }).ariaLabelledByElements;
      });
    }
    await use(page);
  },
});
