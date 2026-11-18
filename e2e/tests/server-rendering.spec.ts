import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "../fixtures.js";

/**
 * The same checks against both examples: the package renders on the server,
 * hydrates without a warning, works afterwards, passes axe and never reaches
 * another origin (ADR 0007, ADR 0012, ADR 0014).
 */
const apps = [
  { name: "Next.js App Router", url: "http://localhost:3100/" },
  { name: "Vite", url: "http://localhost:3200/" },
] as const;

interface Problems {
  console: string[];
  errors: string[];
  foreignRequests: string[];
}

function watch(page: Page, origin: string): Problems {
  const problems: Problems = { console: [], errors: [], foreignRequests: [] };
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      problems.console.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => problems.errors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith("http") && url.origin !== origin) {
      problems.foreignRequests.push(request.url());
    }
  });
  return problems;
}

for (const app of apps) {
  test.describe(app.name, () => {
    test("renders every component on the server", async ({ request }) => {
      const response = await request.get(app.url);
      expect(response.ok()).toBe(true);
      const html = await response.text();
      for (const marker of [
        'data-hm-theme-scope="',
        'role="toolbar"',
        'class="hm-toolbar-group"',
        'class="hm-toolbar-separator"',
        "hm-icon-button",
        'data-hm-icon="undo"',
        'role="tooltip"',
        'class="hm-text-field"',
        'class="hm-text-field hm-text-area"',
        'class="hm-color-field"',
        'role="grid"',
        'class="hm-timeline"',
        'role="listbox"',
        'class="hm-timeline-lane"',
        'aria-pressed="false"',
        'class="hm-spinner"',
        "<progress",
        'class="hm-slider"',
        'class="hm-field"',
        'role="spinbutton"',
        'class="hm-file-drop-zone"',
        'class="hm-visually-hidden"',
        'role="radiogroup"',
        "<dialog",
        'role="status"',
        "@layer hm.tokens.theme",
      ]) {
        expect(html, marker).toContain(marker);
      }
    });

    test("hydrates without errors or warnings, and works afterwards", async ({ page }) => {
      const problems = watch(page, new URL(app.url).origin);
      await page.goto(app.url);
      await expect(page.locator("[data-hydrated]")).toBeAttached();

      // Each toolbar has exactly one Tab stop after hydration: the page's own,
      // and each lane's header, which is a toolbar too.
      const toolbars = page.getByRole("toolbar");
      await expect(toolbars).toHaveCount(3);
      for (const toolbar of await toolbars.all()) {
        await expect(toolbar.locator('[tabindex="0"]')).toHaveCount(1);
      }

      // The tooltip names the Undo button and shows on keyboard focus.
      const undo = page.getByRole("button", { name: "Undo" });
      await undo.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(page.locator('[role="tooltip"]:popover-open')).toHaveText("Undo");
      await page.keyboard.press("Escape");
      await expect(page.locator('[role="tooltip"]:popover-open')).toHaveCount(0);

      // A toggle button keeps its own state, even from a Server Component.
      const loop = page.getByRole("button", { name: "Loop" });
      await loop.click();
      await expect(loop).toHaveAttribute("aria-pressed", "true");

      // The slider keeps its own value and moves with the keyboard.
      const volume = page.getByRole("slider", { name: "Volume" });
      await volume.focus();
      await page.keyboard.press("PageUp");
      await expect(volume).toHaveValue("50");
      await expect(volume).toHaveAccessibleDescription("For playback only");

      // The text field is named by its Field and takes typing.
      const fileName = page.getByRole("textbox", { name: "File name" });
      await fileName.fill("final");
      await expect(fileName).toHaveValue("final");

      // The text area is named by its Field, and Enter adds a line.
      const caption = page.getByRole("textbox", { name: "Caption" });
      await caption.fill("One");
      await caption.press("Enter");
      await caption.pressSequentially("Two");
      await expect(caption).toHaveValue("One\nTwo");

      // The colour field commits a typed colour, and its swatches select.
      const fill = page.getByRole("textbox", { name: "Fill" });
      await fill.fill("d92d20");
      await fill.press("Enter");
      await expect(fill).toHaveValue("#d92d20");
      const fillSwatches = page.getByRole("radiogroup", { name: "Fill swatches" });
      await expect(fillSwatches.getByRole("radio", { name: "Red" })).toBeChecked();
      await fillSwatches.getByRole("radio", { name: "Red" }).press("ArrowRight");
      await expect(fill).toHaveValue("#1570ef");

      // The number field commits typing on Enter, within its range.
      const copies = page.getByRole("spinbutton", { name: "Copies" });
      await copies.fill("250");
      await copies.press("Enter");
      await expect(copies).toHaveValue("99");
      await copies.press("ArrowDown");
      await expect(copies).toHaveAttribute("aria-valuenow", "98");

      // The file drop zone delivers a chosen file, whose name is shown as text.
      await page.locator('.hm-file-drop-zone input[type="file"]').setInputFiles({
        name: '<img src=x onerror="window.__pwned=1">.pdf',
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.7"),
      });
      await expect(page.getByTestId("received")).toHaveText(
        'Received <img src=x onerror="window.__pwned=1">.pdf',
      );
      expect(await page.evaluate(() => "__pwned" in window)).toBe(false);

      // A file dropped beside the zone is turned away, so the page stays.
      const strayDrop = await page.evaluate(() => {
        const data = new DataTransfer();
        data.items.add(new File(["%PDF-1.7"], "stray.pdf", { type: "application/pdf" }));
        const drop = new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data });
        document.body.dispatchEvent(drop);
        return drop.defaultPrevented;
      });
      expect(strayDrop).toBe(true);

      // The reorderable list: one Tab stop, arrows select, and Alt with an
      // arrow moves the row. Each key's default is prevented, and the page
      // doesn't scroll: it's made short enough to scroll first, or that
      // couldn't fail. Nothing here shows that Alt with an arrow can't
      // navigate: that shortcut belongs to the browser's own interface, which
      // automation doesn't have, so the page stays put whatever it does
      // (docs/adr/0011).
      const layers = page.getByRole("grid", { name: "Layers" });
      await expect(layers.locator('[tabindex="0"]')).toHaveCount(1);
      await page.setViewportSize({ width: 1280, height: 320 });
      await page.evaluate(() => {
        const seen: boolean[] = [];
        (window as unknown as { hmPrevented: boolean[] }).hmPrevented = seen;
        // On the window, so it runs after the list has handled the key.
        window.addEventListener("keydown", (event) => seen.push(event.defaultPrevented));
      });
      await layers.getByRole("gridcell", { name: "Photo", exact: true }).focus();
      const scroll = () =>
        page.evaluate(() => ({
          y: window.scrollY,
          room: document.documentElement.scrollHeight - window.innerHeight - window.scrollY,
        }));
      const before = await scroll();
      // Room to scroll further down, which an untaken ArrowDown would use.
      expect(before.room).toBeGreaterThan(100);
      await page.keyboard.press("Alt+ArrowUp");
      await expect(layers.getByRole("row").first()).toHaveAttribute("data-hm-id", "Photo");
      await expect(layers.getByRole("gridcell", { name: "Photo", exact: true })).toBeFocused();
      await expect(page.getByText("Photo moved to position 1 of 3")).toBeAttached();
      // Taken at the first row too.
      await page.keyboard.press("Alt+ArrowUp");
      await page.keyboard.press("ArrowDown");
      await expect(layers.getByRole("row", { selected: true })).toHaveAttribute(
        "data-hm-id",
        "Title",
      );
      expect((await scroll()).y).toBe(before.y);
      // One entry per key, with Alt's own keydown before each Alt combination.
      const prevented = await page.evaluate(
        () => (window as unknown as { hmPrevented: boolean[] }).hmPrevented,
      );
      expect(prevented).toEqual([false, true, false, true, true]);
      await page.setViewportSize({ width: 1280, height: 720 });
      // The buttons do the same without the keys.
      await page.getByRole("button", { name: "Move layer down" }).click();
      await expect(layers.getByRole("row").last()).toHaveAttribute("data-hm-id", "Title");

      // The timeline's playhead moves with the slider's keys, and reads its
      // time as text.
      const playhead = page.getByRole("slider", { name: "Playhead", exact: true });
      await expect(playhead).toHaveAttribute("aria-valuetext", "2.0 seconds");
      await playhead.focus();
      await page.keyboard.press("PageUp");
      await expect(playhead).toHaveAttribute("aria-valuetext", "3.0 seconds");
      const clipsList = page.getByRole("listbox", { name: "Clips", exact: true });
      await expect(clipsList.getByRole("option")).toHaveCount(3);
      // The clips: one Tab stop, arrows select, Shift extends.
      await clipsList.getByRole("option", { name: "Clip 1 of 3, Intro" }).focus();
      await page.keyboard.press("ArrowRight");
      await expect(clipsList.getByRole("option", { selected: true })).toHaveAccessibleName(
        "Clip 2 of 3, Talk",
      );
      await page.keyboard.press("Shift+ArrowRight");
      await expect(clipsList.getByRole("option", { selected: true })).toHaveCount(2);
      // Alt with an arrow moves the selected clips, and its default is
      // prevented at the track's end too. That, not the URL, is what's
      // checked: automation has no Back shortcut to prevent (docs/adr/0011).
      await page.evaluate(() => {
        const seen: boolean[] = [];
        (window as unknown as { hmClipKeys: boolean[] }).hmClipKeys = seen;
        window.addEventListener("keydown", (event) => {
          if (event.key.startsWith("Arrow")) {
            seen.push(event.defaultPrevented);
          }
        });
      });
      await page.keyboard.press("Alt+ArrowLeft");
      await expect(clipsList.getByRole("option").first()).toHaveAccessibleName("Clip 1 of 3, Talk");
      await expect(clipsList.getByRole("option", { name: "Clip 2 of 3, Outro" })).toBeFocused();
      await page.keyboard.press("Alt+ArrowLeft");
      expect(
        await page.evaluate(() => (window as unknown as { hmClipKeys: boolean[] }).hmClipKeys),
      ).toEqual([true, true]);
      // The buttons move them back without the keys.
      await page.getByRole("button", { name: "Move clips later" }).click();
      await expect(clipsList.getByRole("option").first()).toHaveAccessibleName(
        "Clip 1 of 3, Intro",
      );
      // Alt with a bracket shortens the focused clip at that edge, by a frame.
      await clipsList.getByRole("option", { name: "Clip 2 of 3, Talk" }).focus();
      const wide = await clipsList.getByRole("option", { name: "Clip 2 of 3, Talk" }).boundingBox();
      for (let press = 0; press < 30; press++) {
        await page.keyboard.press("Alt+BracketRight");
      }
      const narrow = await clipsList
        .getByRole("option", { name: "Clip 2 of 3, Talk" })
        .boundingBox();
      expect(narrow?.width ?? 0).toBeLessThan((wide?.width ?? 0) * 0.95);

      // Each clip is as wide as its length: now 120 frames to 60.
      const talk = await clipsList.getByRole("option", { name: "Clip 2 of 3, Talk" }).boundingBox();
      const outro = await clipsList
        .getByRole("option", { name: "Clip 3 of 3, Outro" })
        .boundingBox();
      expect((talk?.width ?? 0) / (outro?.width ?? 1)).toBeCloseTo(2, 1);

      // Lanes: each is a group with a toolbar and its clips; ↓ goes to the
      // clip nearest in time on the next lane, and selects it there only.
      const mix = page.getByRole("region", { name: "Mix" });
      await expect(mix.getByRole("group")).toHaveCount(2);
      await expect(mix.getByRole("toolbar", { name: "Music track" })).toBeVisible();
      const voice = mix.getByRole("listbox", { name: "Voice clips" });
      const music = mix.getByRole("listbox", { name: "Music clips" });
      await voice.getByRole("option", { name: "Voice 2, clip 2 of 2" }).focus();
      await page.keyboard.press("ArrowDown");
      await expect(music.getByRole("option", { name: "Music 3, clip 3 of 3" })).toBeFocused();
      await expect(mix.getByRole("option", { selected: true })).toHaveCount(1);
      await expect(music.getByRole("option", { selected: true })).toHaveAccessibleName(
        "Music 3, clip 3 of 3",
      );
      // Music's clips have a start each: there's room before the first and
      // between them, where Voice's lie back to back.
      const [first, second] = await Promise.all(
        [0, 1].map((index) => music.getByRole("option").nth(index).boundingBox()),
      );
      const [voiceFirst, voiceSecond] = await Promise.all(
        [0, 1].map((index) => voice.getByRole("option").nth(index).boundingBox()),
      );
      expect(first?.x ?? 0).toBeGreaterThan((voiceFirst?.x ?? 0) + 5);
      expect(second?.x ?? 0).toBeGreaterThan((first?.x ?? 0) + (first?.width ?? 0) + 5);
      expect(voiceSecond?.x ?? 0).toBeCloseTo((voiceFirst?.x ?? 0) + (voiceFirst?.width ?? 0), 0);

      // Alt+↓ on a clip in a lane is taken, even though this example moves
      // no clips between lanes: unprevented, it would scroll the page.
      await page.evaluate(() => {
        // The arrow's own keydown: Alt's comes first, and isn't the track's.
        window.addEventListener("keydown", (event) => {
          if (event.key === "ArrowDown") {
            (window as unknown as { hmLaneKey?: boolean }).hmLaneKey = event.defaultPrevented;
          }
        });
      });
      await page.keyboard.press("Alt+ArrowDown");
      expect(
        await page.evaluate(() => (window as unknown as { hmLaneKey?: boolean }).hmLaneKey),
      ).toBe(true);
      await expect(music.getByRole("option", { name: "Music 3, clip 3 of 3" })).toBeFocused();

      // The header stays beside its lane, before the lane's first clip.
      const head = await mix.getByRole("toolbar", { name: "Music track" }).boundingBox();
      const firstClip = await music.getByRole("option").first().boundingBox();
      expect((head?.x ?? 0) + (head?.width ?? 0)).toBeLessThanOrEqual((firstClip?.x ?? 0) + 1);

      // The segmented control selects with the arrow keys.
      await page.getByRole("radio", { name: "Single" }).focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByRole("radio", { name: "Grid" })).toHaveAttribute(
        "aria-checked",
        "true",
      );

      // The dialog opens as a modal, and Escape closes it.
      await page.getByRole("button", { name: "Open dialog" }).click();
      const dialog = page.getByRole("dialog", { name: "Export" });
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();

      // Confirming announces the result.
      await page.getByRole("button", { name: "Open dialog" }).click();
      await page.getByRole("button", { name: "Confirm" }).click();
      await expect(page.getByRole("status")).toHaveText("Exported");

      // The themed section uses the custom theme from themeToCss.
      const accent = await page
        .locator("main.brand")
        .evaluate((element) => getComputedStyle(element).getPropertyValue("--hm-color-accent"));
      expect(accent.trim()).toBe("#5b21b6");

      expect(problems.errors).toEqual([]);
      expect(problems.console).toEqual([]);
      expect(problems.foreignRequests).toEqual([]);
    });

    test("passes axe", async ({ page }) => {
      await page.goto(app.url);
      await expect(page.locator("[data-hydrated]")).toBeAttached();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });

    // A tooltip of each type, closed and open (ui#61). The role locators and
    // axe both compute the trigger's name, as an SDK's tests do.
    for (const tooltip of [
      { type: "label", trigger: "Undo", text: "Undo" },
      { type: "description", trigger: "Redo", text: "Repeats the change you last undid" },
    ] as const) {
      test(`passes axe with a ${tooltip.type} tooltip, closed and open`, async ({ page }) => {
        await page.goto(app.url);
        await expect(page.locator("[data-hydrated]")).toBeAttached();
        const trigger = page.getByRole("button", { name: tooltip.trigger, exact: true });
        const open = page.locator('[role="tooltip"]:popover-open');

        // Closed, the tooltip still names or describes its trigger.
        await expect(open).toHaveCount(0);
        if (tooltip.type === "label") {
          await expect(trigger).toHaveAccessibleName(tooltip.text);
          await expect(trigger).toHaveAccessibleDescription("");
        } else {
          await expect(trigger).toHaveAccessibleDescription(tooltip.text);
        }
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

        // Open, its text is on the page too, and checked for contrast.
        await trigger.hover();
        await expect(open).toHaveText(tooltip.text);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
        expect(results.passes.map((rule) => rule.id)).toContain("button-name");
      });
    }
  });
}
