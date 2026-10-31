import { expect, type Response, test } from "@playwright/test";
import { COPY } from "../src/web/copy.js";

/**
 * Case 7 (spec 0004 §10), adapted from the prescreening repository's case
 * 11: Settings in fake mode. A key is saved, shown only by its last four
 * characters, tested (scripted: no call), chosen, kept across a reload and
 * removed. Settings go to the emptied `e2e/.out/settings/`, and no answer
 * from the server ever carries the key.
 */
const KEY = "test-key-00000000";

test("case 7: a provider is chosen and its key saved, tested and removed, never sent back", async ({
  page,
}) => {
  const bodies: Promise<string>[] = [];
  page.on("response", (response: Response) => {
    if (response.url().includes("/api/")) bodies.push(response.text().catch(() => ""));
  });

  await page.goto("/#/settings");
  await expect(page.getByRole("heading", { name: COPY.settings.heading })).toBeVisible();
  await expect(page.getByText(COPY.settings.scripted)).toBeVisible();

  await page.getByRole("radio", { name: "Anthropic" }).check();
  await expect(page.getByRole("combobox")).toHaveValue("claude-haiku-4-5");
  await page.getByLabel(COPY.settings.key, { exact: true }).fill(KEY);
  await page.getByRole("button", { name: COPY.settings.saveKey }).click();
  await expect(page.getByText(COPY.settings.keySaved("…0000"))).toBeVisible();
  await expect(page.getByLabel(COPY.settings.key, { exact: true })).toHaveValue("");

  await page.getByRole("button", { name: COPY.settings.test }).click();
  await expect(page.getByText(/^It works: /)).toBeVisible();

  await page.getByRole("button", { name: COPY.settings.use }).click();
  await expect(page.getByRole("button", { name: COPY.settings.inUse })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("radio", { name: "Anthropic" })).toBeChecked();
  await expect(page.getByText(COPY.settings.keySaved("…0000"))).toBeVisible();

  await page.getByRole("button", { name: COPY.settings.removeKey }).click();
  await expect(page.getByText(COPY.settings.noKey)).toBeVisible();

  const texts = await Promise.all(bodies);
  expect(texts.length).toBeGreaterThan(5);
  expect(texts.filter((t) => t.includes(KEY))).toEqual([]);
});
