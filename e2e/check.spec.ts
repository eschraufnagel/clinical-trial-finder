import { expect, type Page, test } from "@playwright/test";
import { WHY } from "../src/check/record.js";
import { COPY } from "../src/web/copy.js";
import { expectNoVerdict, lastQuestion, search, shortlistIds, typeReply } from "./lib/page.js";
import { patient, replyTo } from "./lib/patients.js";

/**
 * Case 9 (spec 0007 §6.3): the check, on `--fake`. A made-up patient answers
 * the questions, ticks three trials with committed parses, and checks the
 * first by tapping "I don't know" to every question; the check is then
 * stopped and the record printed. No verdict words, every "I don't know" on
 * the record, and the list unchanged.
 */
const p08 = patient("p08");

async function answerAll(page: Page): Promise<void> {
  for (let i = 0; i < 40; i++) {
    if (await page.getByRole("button", { name: COPY.conversation.seeList }).isVisible()) return;
    const question = await lastQuestion(page);
    await typeReply(page, replyTo(p08, question));
    const reading = await lastQuestion(page);
    await page.getByRole("button", { name: "That's right" }).click();
    await expect.poll(() => lastQuestion(page)).not.toBe(reading);
  }
  throw new Error("the conversation didn't finish");
}

test("case 9 (slice 0007): tick three, check one by taps, print its record", async ({ page }) => {
  await search(page, p08);
  await answerAll(page);
  await page.getByRole("button", { name: COPY.conversation.seeList }).click();
  const before = await shortlistIds(page);

  const ticks = page.getByRole("checkbox", { name: COPY.list.tick });
  expect(await ticks.count()).toBeGreaterThanOrEqual(3);
  for (let i = 0; i < 3; i++) await ticks.nth(i).check();
  // A fourth can't be ticked.
  await expect(page.getByText(COPY.list.tickLimit)).toBeVisible();
  if ((await ticks.count()) > 3) await expect(ticks.nth(3)).toBeDisabled();
  await page.getByRole("button", { name: COPY.list.checkThese }).click();
  await expect(page).toHaveURL(/#\/check\//);

  // The first trial, every question answered "I don't know", until its record is filed.
  const dontKnow = page.getByRole("button", { name: "I don't know", exact: true });
  let taps = 0;
  for (; taps < 80; taps++) {
    await expect(dontKnow.or(page.locator(".record")).first()).toBeVisible();
    if ((await page.locator(".record").count()) > 0) break;
    const asked = await lastQuestion(page);
    expect(asked).toMatch(/Does this describe you\?$/);
    await dontKnow.click();
    await expect.poll(() => lastQuestion(page)).not.toBe(asked);
  }
  expect(taps).toBeGreaterThan(0);

  // Typed text isn't read here: the taps come back.
  await page.getByLabel(COPY.conversation.reply).fill("I'm not sure.");
  await page.getByRole("button", { name: COPY.conversation.send }).click();
  await expect
    .poll(() => lastQuestion(page))
    .toBe("Typed replies can't be read in this mode. Please choose an answer.");

  await page.getByRole("button", { name: COPY.check.stop }).click();
  await expect(page.getByRole("button", { name: COPY.check.print })).toBeVisible();
  const records = page.locator(".record");
  await expect(records).toHaveCount(2);
  await expect(page.getByText(COPY.check.notChecked)).toHaveCount(1);

  // Every "I don't know" is on the first record, and each goes to the oncologist.
  const first = records.first();
  const didntKnow = first.locator("li").filter({ hasText: WHY.didntKnow });
  expect(await didntKnow.count()).toBeGreaterThanOrEqual(taps);
  expect(await first.locator("ol > li").count()).toBeGreaterThanOrEqual(taps);
  await expectNoVerdict(page, ".messages");

  // Printing shows the records, not the questions.
  await page.emulateMedia({ media: "print" });
  await expect(first).toBeVisible();
  await expect(page.locator(".messages")).toBeHidden();
  await page.emulateMedia({ media: "screen" });

  await page.getByRole("button", { name: COPY.check.back }).click();
  expect(await shortlistIds(page)).toEqual(before);
});
