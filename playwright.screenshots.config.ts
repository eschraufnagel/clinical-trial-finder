import { defineConfig, devices } from "@playwright/test";

/**
 * The README's images (slice 0011): `npm run screenshots`, run by a person,
 * never by `npm test` or `npm run test:e2e`.
 *
 * Like the browser test, it builds the page and runs it with the scripted
 * reader, so no model is ever reached (`tests/boundary.test.ts` holds the
 * command to `--fake`). Port 5045 keeps it clear of the app on 5025 and the
 * browser test on 5035. Settings go to an emptied `e2e/.out/settings-shots/`.
 * The images go to `docs/images/`; everything else under `e2e/.out/`.
 */
export default defineConfig({
  testDir: "e2e/screenshots",
  testMatch: "*.shots.ts",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 120_000,
  outputDir: "e2e/.out/shots",
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5045",
  },
  projects: [
    {
      name: "chromium",
      // After the device preset, which would otherwise set 1280×720.
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 1,
        colorScheme: "light",
      },
    },
  ],
  webServer: {
    command:
      "rm -rf e2e/.out/settings-shots && npm run app -- --fake --port 5045 --settings-dir e2e/.out/settings-shots",
    url: "http://127.0.0.1:5045/api/info",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
