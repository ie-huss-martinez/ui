import { withFirefoxLabelledByGuard } from "@hussmartinez/sdk-config/testing/firefox-labelled-by";
import { test as base } from "@playwright/test";

export { expect, type Page } from "@playwright/test";

/**
 * Playwright's `test`, with the family's guard against a Firefox crash
 * (ui#61): in Firefox 159, reading an element's `ariaLabelledByElements` from
 * two JavaScript worlds, as role locators and axe-core do, crashes the page.
 * The guard removes the property from every page of the test's browser
 * context before any script runs, so a page that a fixture opens or
 * navigates first is covered too.
 */
export const test = withFirefoxLabelledByGuard(base);
