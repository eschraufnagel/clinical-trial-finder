import { defineConfig, devices } from "@playwright/test";

/**
 * The browser test (slice 0004): `npm run test:e2e`, never part of `npm test`.
 *
 * It builds the page and runs it with the scripted reader, so no model is
 * ever reached (`tests/boundary.test.ts` holds the command to `--fake`). Port
 * 5035 keeps it clear of an `npm run app` on 5025, and it never reuses a
 * server already running. Settings it saves go to an emptied
 * `e2e/.out/settings/`, never to `local/`. Everything it writes is under
 * `e2e/.out/`, gitignored. Copied from the prescreening repository.
 *
 * One worker and no retries: one server is shared, and a flaky browser test
 * is a bug to fix, not to retry.
 */
export default defineConfig({
  testDir: "e2e",
  testMatch: "*.spec.ts",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  outputDir: "e2e/.out/results",
  reporter: [["list"], ["html", { outputFolder: "e2e/.out/report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5035",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      "rm -rf e2e/.out/settings && npm run app -- --fake --port 5035 --settings-dir e2e/.out/settings",
    url: "http://127.0.0.1:5035/api/info",
    reuseExistingServer: false,
    // Includes `vite build` and loading the snapshot.
    timeout: 120_000,
  },
});
