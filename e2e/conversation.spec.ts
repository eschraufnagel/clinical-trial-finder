import { expect, type Page, test } from "@playwright/test";
import { COPY } from "../src/web/copy.js";
import { expectNoVerdict, lastQuestion, search, shortlistIds, typeReply } from "./lib/page.js";
import { expectedShortlist, patient, replyTo } from "./lib/patients.js";

/**
 * Cases 2 to 6 (spec 0004 §10): a made-up patient's own replies through the
 * page, every reading confirmed, ending on the short list `questions:try`
 * gives for the same readings; then the list, a changed answer and the sheet.
 */
const p08 = patient("p08");

async function answerAll(page: Page, changeFirst: boolean): Promise<void> {
  for (let i = 0; i < 40; i++) {
    if (await page.getByRole("button", { name: COPY.conversation.seeList }).isVisible()) return;
    const question = await lastQuestion(page);
    await typeReply(page, replyTo(p08, question));
    const reading = await lastQuestion(page);
    expect(reading).toMatch(/^I read that as: /);
    if (changeFirst && i === 0) {
      // Change it: the answers come back unfolded, and one is picked as given.
      await page.getByRole("button", { name: "Change it" }).click();
      await expect.poll(() => lastQuestion(page)).toBe("Which is closest?");
      await page.getByRole("button", { name: "Adenocarcinoma", exact: true }).click();
      await expect.poll(() => lastQuestion(page)).not.toBe("Which is closest?");
    } else {
      await page.getByRole("button", { name: "That's right" }).click();
      await expect.poll(() => lastQuestion(page)).not.toBe(reading);
    }
  }
  throw new Error("the conversation didn't finish");
}

test("case 2: typed replies, each reading confirmed, end on questions:try's short list", async ({
  page,
}) => {
  await search(page, p08);
  await answerAll(page, true);
  await expectNoVerdict(page);
  await page.getByRole("button", { name: COPY.conversation.seeList }).click();
  expect(await shortlistIds(page)).toEqual(expectedShortlist(p08));
  await expectNoVerdict(page);
});

test("case 3: Show me the list now, after the first answer", async ({ page }) => {
  await search(page, p08);
  await page.getByText(COPY.conversation.choose).click();
  await page.getByRole("button", { name: "Adenocarcinoma", exact: true }).click();
  await expect.poll(() => lastQuestion(page)).toBe("How far has the cancer spread?");
  await page.getByRole("button", { name: COPY.conversation.listNow }).click();
  await expect(page).toHaveURL(/#\/list\//);
  await expect(page.getByText(COPY.list.notStopped)).toHaveCount(0);
  expect((await shortlistIds(page)).length).toBe(10);
});

test("case 4: changing an answer reorders the list", async ({ page }) => {
  await search(page, p08);
  await answerAll(page, false);
  await page.getByRole("button", { name: COPY.conversation.seeList }).click();
  const before = await shortlistIds(page);
  const brain = page.getByRole("listitem", { name: "Has the cancer spread to the brain?" });
  await brain.getByRole("button", { name: COPY.answers.change }).click();
  await brain.getByRole("combobox").selectOption({ label: "Yes, and causing symptoms" });
  await brain.getByRole("button", { name: COPY.answers.save }).click();
  await expect.poll(() => shortlistIds(page)).not.toEqual(before);
});

test("case 5 and 6: the sheet, and no verdict on any screen", async ({ page }) => {
  await search(page, p08);
  await answerAll(page, false);
  const id = /#\/c\/(.+)$/.exec(page.url())?.[1] ?? "";
  await page.goto(`/#/list/${id}`);
  await page.getByRole("button", { name: COPY.list.showRest }).click();
  await expectNoVerdict(page);

  await page.goto(`/#/sheet/${id}`);
  await expect(page.getByRole("heading", { name: "For your oncologist" })).toBeVisible();
  await expect(page.getByRole("button", { name: COPY.sheet.print })).toBeVisible();
  // p08 didn't know about spread to the lining of the brain: it's a question for the oncologist.
  await expect(
    page
      .locator(".sheet ol")
      .first()
      .getByText("Has the cancer spread to the lining of the brain or spinal cord?"),
  ).toBeVisible();
  // p08 is a man: pregnancy is asked of no one here.
  await expect(page.getByText("Are you pregnant or breastfeeding?")).toHaveCount(0);
  await expectNoVerdict(page);

  await page.goto("/#/settings");
  await expectNoVerdict(page);
});

test("case 8 (slice 0005): a trial whose record names other cancers says so first, below the short list", async ({
  page,
}) => {
  await search(page, p08);
  await page.getByText(COPY.conversation.choose).click();
  await page.getByRole("button", { name: "Adenocarcinoma", exact: true }).click();
  await expect.poll(() => lastQuestion(page)).toBe("How far has the cancer spread?");
  await page.getByRole("button", { name: COPY.conversation.listNow }).click();
  // The rest isn't shown yet, so any marked card here would be on the short list.
  await expect(page.locator(".trial .other")).toHaveCount(0);
  await page.getByRole("button", { name: COPY.list.showRest }).click();
  const marked = page.locator(".rest .trial .other").first();
  await expect(marked).toContainText("This trial's record ");
  await expect(marked).toContainText(COPY.list.fromRecord);
  await expectNoVerdict(page);
});
