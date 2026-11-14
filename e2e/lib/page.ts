import { expect, type Page } from "@playwright/test";
import type { Patient } from "../../evals/questions/patients.js";
import { VERDICT_PATTERNS } from "../../src/shortlist/words.js";
import { COPY } from "../../src/web/copy.js";

/** Fills the search form with a patient's search and starts. */
export async function search(page: Page, p: Patient): Promise<void> {
  await page.goto("/#/");
  await page.getByLabel(COPY.search.zip).fill(p.search.zip);
  await page
    .getByRole("radio", {
      name:
        p.search.radiusMiles === null
          ? COPY.search.anywhere
          : COPY.search.miles(p.search.radiusMiles),
      exact: true,
    })
    .check();
  await page.getByLabel(COPY.search.age).fill(String(p.search.age));
  await page.getByRole("radio", { name: COPY.search[p.search.sex], exact: true }).check();
  await page.getByRole("button", { name: COPY.search.start }).click();
}

/** The last message the page wrote in the conversation. */
export async function lastQuestion(page: Page): Promise<string> {
  return (await page.locator(".messages li.agent").last().textContent()) ?? "";
}

/** Types a reply and waits for its reading to be shown back. */
export async function typeReply(page: Page, text: string): Promise<void> {
  await page.getByLabel(COPY.conversation.reply).fill(text);
  await page.getByRole("button", { name: COPY.conversation.send }).click();
  await expect(page.getByRole("button", { name: "That's right" })).toBeVisible();
}

/** The short list's NCT ids, in order, as the list page shows them. */
export async function shortlistIds(page: Page): Promise<string[]> {
  await expect(page.locator("ol.trials > li").first()).toBeVisible();
  return page
    .locator(".shortlist > ol.trials > li article")
    .evaluateAll((articles) => articles.map((a) => a.getAttribute("aria-label") ?? ""));
}

/**
 * The page's own visible words, leaving out the trial's (`data-registry`)
 * and the person's (`data-said`), checked against the verdict patterns.
 * `also` leaves out more: the check's messages, which quote the trial's rules
 * as plain text, and whose fixed words `tests/server/check.test.ts` scans.
 */
export async function expectNoVerdict(page: Page, also: string | null = null): Promise<void> {
  const leaveOut = ["[data-registry]", "[data-said]", ...(also === null ? [] : [also])].join(", ");
  // Source text, run in the page: this file is typed for Node, without the DOM.
  const text = await page.evaluate<string>(`(() => {
    const clone = document.body.cloneNode(true);
    for (const el of clone.querySelectorAll(${JSON.stringify(leaveOut)})) el.remove();
    document.body.append(clone);
    clone.hidden = false;
    const text = clone.innerText;
    clone.remove();
    return text;
  })()`);
  expect(text.length).toBeGreaterThan(50);
  const hits = VERDICT_PATTERNS.filter((p) => p.test(text)).map(String);
  expect(hits).toEqual([]);
}

/**
 * Opens every trial card on the list (slice 0011). Closed, a card shows only
 * "May not fit", how much was read and anything about its record, so the
 * verdict scan opens them all first to read every word the list writes.
 */
export async function openAllCards(page: Page): Promise<void> {
  const open = page.getByRole("button", { name: COPY.list.open, exact: true });
  while ((await open.count()) > 0) await open.first().click();
}
