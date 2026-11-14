import { expect, test } from "@playwright/test";
import { COPY } from "../src/web/copy.js";
import { search, shortlistIds } from "./lib/page.js";
import { patient } from "./lib/patients.js";

/**
 * Case 11 (slice 0011): the look holds in the browser. Dark mode follows the
 * system, the list's rail becomes a bar on a phone, and the bundled fonts
 * load. The contrast test (`tests/web/contrast.test.ts`) holds the colours.
 */
const p08 = patient("p08");

async function background(page: import("@playwright/test").Page): Promise<string> {
  return page.evaluate<string>("getComputedStyle(document.body).backgroundColor");
}

test("case 11 (slice 0011): dark mode, the phone's bar, and the fonts", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/#/");
  await expect(page.getByLabel(COPY.search.zip)).toBeVisible();
  expect(await background(page)).toBe("rgb(15, 22, 28)");
  await page.emulateMedia({ colorScheme: "light" });
  expect(await background(page)).toBe("rgb(246, 247, 248)");

  await search(page, p08);
  await expect(page.locator(".messages li.agent").first()).toBeVisible();
  await page.evaluate("document.fonts.ready");
  expect(await page.evaluate<boolean>(`document.fonts.check('16px "Atkinson Hyperlegible"')`)).toBe(
    true,
  );
  expect(await page.evaluate<boolean>(`document.fonts.check('16px "IBM Plex Sans"')`)).toBe(true);

  await page.getByRole("button", { name: COPY.conversation.listNow }).click();
  await shortlistIds(page);
  await expect(page.locator(".rail")).toBeVisible();
  await expect(page.locator(".pickbar")).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".pickbar")).toBeVisible();
  await expect(page.locator(".rail")).toBeHidden();
});
