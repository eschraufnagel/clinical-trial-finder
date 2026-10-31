import { expect, test } from "@playwright/test";
import { COPY } from "../src/web/copy.js";
import { search } from "./lib/page.js";
import { patient } from "./lib/patients.js";

/** Case 1 (spec 0004 §10): the search form, to the first question; a ZIP the gazetteer lacks is refused. */
test("case 1: the search form leads to the first question, and an unknown ZIP is refused", async ({
  page,
}) => {
  await page.goto("/#/");
  await expect(page.getByRole("heading", { name: COPY.title, level: 1 })).toBeVisible();
  await expect(page.getByText(COPY.scripted)).toBeVisible();

  const p08 = patient("p08");
  await search(page, { ...p08, search: { ...p08.search, zip: "00000" } });
  await expect(page.getByRole("alert")).toContainText("isn't in the Census Bureau's ZIP table");

  await search(page, p08);
  await expect(page).toHaveURL(/#\/c\//);
  await expect(page.locator(".messages li.agent").last()).toHaveText(
    "What type of lung cancer cell did the biopsy show?",
  );
  await expect(page.getByText(COPY.conversation.local)).toBeVisible();
});
