import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { COPY } from "../../src/web/copy.js";
import { lastQuestion, search, shortlistIds, typeReply } from "../lib/page.js";
import { patient, replyTo } from "../lib/patients.js";

/**
 * The README's three images (slice 0011), from made-up patient p08 on
 * `--fake`: a question in its card, the short list with a
 * card open, and a checked trial's record. `npm run screenshots`.
 */
const p08 = patient("p08");
const image = (name: string) =>
  fileURLToPath(new URL(`../../docs/images/${name}.png`, import.meta.url));

async function settle(page: Page): Promise<void> {
  await page.evaluate("document.fonts.ready");
  await page.mouse.move(0, 0);
}

/** Answers one question by typing p08's reply and confirming its reading. */
async function answer(page: Page): Promise<void> {
  await typeReply(page, replyTo(p08, await lastQuestion(page)));
  const reading = await lastQuestion(page);
  await page.getByRole("button", { name: "That's right" }).click();
  await expect.poll(() => lastQuestion(page)).not.toBe(reading);
}

test("the README's images", async ({ page }) => {
  await search(page, p08);
  await expect(page.locator(".messages li.agent").first()).toBeVisible();

  // The second question in its card, the first answered above it.
  await answer(page);
  await page.evaluate("window.scrollTo(0, 0)");
  await settle(page);
  await page.screenshot({ path: image("question"), animations: "disabled" });

  for (let i = 0; i < 40; i++) {
    if (await page.getByRole("button", { name: COPY.conversation.seeList }).isVisible()) break;
    await answer(page);
  }
  await page.getByRole("button", { name: COPY.conversation.seeList }).click();
  await shortlistIds(page);

  // The list, its second card open and three ticked.
  const ticks = page.getByRole("checkbox", { name: COPY.list.tick });
  for (let i = 0; i < 3; i++) await ticks.nth(i).check();
  await page.getByRole("button", { name: COPY.list.open, exact: true }).nth(1).click();
  await page.evaluate("window.scrollTo(0, 0)");
  await settle(page);
  await page.screenshot({ path: image("list"), animations: "disabled" });

  // The first trial checked by tapping "I don't know", then its record.
  await page.getByRole("button", { name: COPY.list.checkThese }).click();
  const dontKnow = page.getByRole("button", { name: "I don't know", exact: true });
  for (let taps = 0; taps < 80; taps++) {
    await expect(dontKnow.or(page.locator(".record")).first()).toBeVisible();
    if ((await page.locator(".record").count()) > 0) break;
    const asked = await lastQuestion(page);
    await dontKnow.click();
    await expect.poll(() => lastQuestion(page)).not.toBe(asked);
  }
  await page.getByRole("button", { name: COPY.check.stop }).click();
  await expect(page.getByRole("button", { name: COPY.check.print })).toBeVisible();
  // The record's top: its summary column, the notice and the first sections.
  const box = await page.locator(".record").first().boundingBox();
  if (box === null) throw new Error("the record isn't shown");
  // The box is in the window's coordinates; a full-page clip is in the page's.
  const top = box.y + (await page.evaluate<number>("window.scrollY"));
  await settle(page);
  await page.screenshot({
    path: image("record"),
    animations: "disabled",
    fullPage: true,
    clip: { x: box.x, y: top, width: box.width, height: Math.min(box.height, 1000) },
  });
});
