import { fontLaunchEnv } from "@hussmartinez/sdk-config/testing/fonts";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import type { BrowserCommand } from "vitest/node";

/**
 * Emulates `prefers-color-scheme`, so browser tests can check system mode.
 * Declared for tests in src/test/browser-commands.d.ts.
 */
const setColorScheme: BrowserCommand<[scheme: "light" | "dark"]> = async (context, scheme) => {
  if (context.provider.name !== "playwright") {
    throw new Error("setColorScheme needs the Playwright provider");
  }
  await context.page.emulateMedia({ colorScheme: scheme });
};

const ALL_BROWSERS = ["chromium", "firefox", "webkit"] as const;

/** Emulates `prefers-reduced-motion`, so browser tests can check motion fallbacks. */
const setReducedMotion: BrowserCommand<[reduce: boolean]> = async (context, reduce) => {
  if (context.provider.name !== "playwright") {
    throw new Error("setReducedMotion needs the Playwright provider");
  }
  await context.page.emulateMedia({ reducedMotion: reduce ? "reduce" : "no-preference" });
};

// Browser tests run on Chromium locally, and on all three engines in CI or
// with --mode all-browsers (ADR 0015), always in the browser test image
// (docs/adr/0007).
export default defineConfig(({ mode }) => {
  const browsers =
    process.env["CI"] || mode === "all-browsers" ? ALL_BROWSERS : (["chromium"] as const);
  return {
    test: {
      projects: [
        {
          test: {
            name: "unit",
            // build.test.ts checks the built package, so it sits next to the
            // Vite config rather than in src/.
            include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts", "*.test.ts"],
            exclude: ["src/**/*.browser.test.{ts,tsx}"],
            environment: "node",
          },
        },
        {
          test: {
            name: "browser",
            include: ["src/**/*.browser.test.{ts,tsx}"],
            // Refuses to start outside the browser test image and CI (sdk-core
            // ADR 0049): on a host, tests fail at random.
            globalSetup: ["@hussmartinez/sdk-config/testing/require-image"],
            browser: {
              enabled: true,
              headless: true,
              // In the image, text renders in Liberation, with a real bold face
              // (sdk-core ADR 0062). The whole environment: Playwright replaces
              // the browser's rather than adding to it.
              provider: playwright({ launchOptions: { env: fontLaunchEnv() } }),
              instances: browsers.map((browser) => ({ browser })),
              commands: { setColorScheme, setReducedMotion },
            },
          },
        },
      ],
    },
  };
});
