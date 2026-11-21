import { fontLaunchEnv } from "@hussmartinez/sdk-config/testing/fonts";
import { browserTestImageProblem } from "@hussmartinez/sdk-config/testing/require-image";
import { defineConfig, devices } from "@playwright/test";

const ci = Boolean(process.env["CI"]);

/**
 * Playwright starts the web servers before the global setup, so a host run
 * would build and wait for both examples before the guard refused it. Where
 * the guard will refuse, there are no servers to start, and it does so at
 * once. The configuration itself never throws, so editors still load it.
 */
const canRunBrowsers = browserTestImageProblem() === undefined;

/**
 * End-to-end server-rendering tests (ADR 0007), against production builds of
 * the Next.js and Vite examples. Chromium locally, all three engines in CI,
 * as for the other browser tests (ADR 0015), always in the browser test image
 * (docs/adr/0007).
 */
export default defineConfig({
  testDir: "tests",
  // Refuses to start outside the browser test image and CI (sdk-core ADR
  // 0049): on a host, tests fail at random.
  globalSetup: "@hussmartinez/sdk-config/testing/require-image",
  forbidOnly: ci,
  retries: 0,
  reporter: ci ? "line" : "list",
  use: {
    trace: "retain-on-failure",
    // In the image, text renders in Liberation, with a real bold face
    // (sdk-core ADR 0062). The whole environment: Playwright replaces the
    // browser's rather than adding to it.
    launchOptions: { env: fontLaunchEnv() },
  },
  projects: (ci
    ? (["Desktop Chrome", "Desktop Firefox", "Desktop Safari"] as const)
    : (["Desktop Chrome"] as const)
  ).map((device) => ({ name: device, use: { ...devices[device] } })),
  webServer: canRunBrowsers
    ? [
        {
          command: "pnpm --filter @hussmartinez/ui-example-next start",
          url: "http://localhost:3100",
          reuseExistingServer: !ci,
          timeout: 60_000,
        },
        {
          command: "pnpm --filter @hussmartinez/ui-example-vite start",
          url: "http://localhost:3200",
          reuseExistingServer: !ci,
          timeout: 60_000,
        },
      ]
    : [],
});
