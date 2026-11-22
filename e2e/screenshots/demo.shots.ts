import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { cutLength, cutsFromMarks, type Mark } from "../../scripts/make-demo.js";
import { VERDICT_PATTERNS } from "../../src/shortlist/words.js";
import { COPY } from "../../src/web/copy.js";
import { expectNoVerdict, lastQuestion, shortlistIds } from "../lib/page.js";
import { patient, replyTo } from "../lib/patients.js";

/**
 * The README's loop (slice 0014), recorded from made-up patient p08 on
 * `--fake`: the start form, three questions typed and confirmed with the rest
 * fast-forwarded, the list, the first trial's card, a check of that trial by
 * taps, and the top of its record. `npm run screenshots` records it and
 * writes the cut list; `npm run demo` makes `docs/images/demo.gif` from them.
 *
 * Typing is paced and each screen held so the loop can be followed; the
 * questions in between are answered at once and marked, and `npm run demo`
 * speeds those stretches up. A caption, added to the page here and never part
 * of its source, says how many questions each fast-forward skips.
 */
const p08 = patient("p08");
const OUT = fileURLToPath(new URL("../.out/demo", import.meta.url));
const SIZE = { width: 1280, height: 800 };
/** The question typed after the first fast-forward: "I don't know" taken as an answer. */
const LINING = "Has the cancer spread to the lining of the brain or spinal cord?";

test("the README's demo", async ({ browser }) => {
  test.setTimeout(180_000);
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL ?? "",
    viewport: SIZE,
    deviceScaleFactor: 1,
    colorScheme: "light",
    recordVideo: { dir: `${OUT}/video`, size: SIZE },
  });
  const page = await context.newPage();
  const t0 = Date.now();
  const now = () => (Date.now() - t0) / 1000;
  const hold = (ms: number) => page.waitForTimeout(ms);
  const marks: Mark[] = [];

  // 1. The start form, typed.
  await page.goto("/#/");
  await page.evaluate("document.fonts.ready");
  await expect(page.getByLabel(COPY.search.zip)).toBeVisible();
  const start = now();
  await hold(700);
  await page.getByLabel(COPY.search.zip).pressSequentially(p08.search.zip, { delay: 60 });
  await hold(250);
  if (p08.search.radiusMiles === null) throw new Error("p08 travels a set distance");
  await page
    .getByRole("radio", { name: COPY.search.miles(p08.search.radiusMiles), exact: true })
    .check();
  await hold(300);
  await page.getByLabel(COPY.search.age).pressSequentially(String(p08.search.age), { delay: 60 });
  await hold(250);
  await page.getByRole("radio", { name: COPY.search[p08.search.sex], exact: true }).check();
  await hold(500);
  await page.getByRole("button", { name: COPY.search.start }).click();
  await expect(page.locator(".messages li.agent").first()).toBeVisible();
  await hold(600);

  const seeList = page.getByRole("button", { name: COPY.conversation.seeList });
  const confirm = page.getByRole("button", { name: "That's right" });

  /** Types p08's reply at reading pace, holds on its reading, and confirms it. */
  async function typed(): Promise<void> {
    const asked = await lastQuestion(page);
    await page
      .getByLabel(COPY.conversation.reply)
      .pressSequentially(replyTo(p08, asked), { delay: 30 });
    await hold(300);
    await page.getByRole("button", { name: COPY.conversation.send }).click();
    await expect(confirm).toBeVisible();
    await hold(1800);
    const reading = await lastQuestion(page);
    await confirm.click();
    await expect.poll(() => lastQuestion(page)).not.toBe(reading);
    await hold(600);
  }

  /** Answers at once, until `stop` holds; marked, captioned, and counted. */
  async function fastForward(stop: () => Promise<boolean>): Promise<number> {
    await caption(page, "More questions, sped up");
    marks.push({ at: now(), label: "fast-start" });
    let n = 0;
    while (!(await stop())) {
      const asked = await lastQuestion(page);
      await page.getByLabel(COPY.conversation.reply).fill(replyTo(p08, asked));
      await page.getByRole("button", { name: COPY.conversation.send }).click();
      await expect(confirm).toBeVisible();
      const reading = await lastQuestion(page);
      await confirm.click();
      await expect.poll(() => lastQuestion(page)).not.toBe(reading);
      n++;
      if (n > 40) throw new Error("the conversation didn't end");
    }
    await caption(page, `${n} more questions, sped up`);
    marks.push({ at: now(), label: "fast-end" });
    await hold(500);
    await uncaption(page);
    return n;
  }

  // 2–6. Two questions typed, a fast-forward to the lining question, that one
  // typed, and a fast-forward to the list.
  await typed();
  await typed();
  const lining = async () => (await lastQuestion(page)).includes(LINING);
  const first = await fastForward(async () => (await seeList.isVisible()) || (await lining()));
  let second = 0;
  if (await lining()) {
    await typed();
    second = await fastForward(() => seeList.isVisible());
  }

  // 7–8. The list, then the first card opened.
  await seeList.click();
  await shortlistIds(page);
  await page.evaluate("window.scrollTo(0, 0)");
  await page.mouse.move(0, 0);
  await hold(2500);
  await expectNoVerdict(page);
  await page.getByRole("button", { name: COPY.list.open, exact: true }).first().click();
  await hold(1500);
  await page.mouse.move(640, 500);
  await page.mouse.wheel(0, 150);
  await hold(500);
  await page.mouse.wheel(0, 150);
  await hold(1500);

  // 9. The first trial ticked and checked by taps.
  await page.getByRole("checkbox", { name: COPY.list.tick }).first().check();
  await hold(600);
  await page.getByRole("button", { name: COPY.list.checkThese }).click();
  const dontKnow = page.getByRole("button", { name: "I don't know", exact: true });
  await expect(dontKnow).toBeVisible();
  await hold(1500);
  for (const name of ["Yes", "I don't know", "I don't know"]) {
    if ((await page.locator(".record").count()) > 0) break;
    const asked = await lastQuestion(page);
    await page.getByRole("button", { name, exact: true }).click();
    await expect.poll(() => lastQuestion(page)).not.toBe(asked);
    await hold(700);
  }
  if ((await page.locator(".record").count()) === 0) {
    await page.getByRole("button", { name: COPY.check.stop }).click();
  }

  // 10. The top of the record, held so its notice can be read.
  await expect(page.getByRole("button", { name: COPY.check.print })).toBeVisible();
  const record = page.locator(".record").first();
  await record.evaluate("(el) => el.scrollIntoView({ block: 'start' })");
  await page.mouse.move(0, 0);
  const notice = record.locator(".notice-lead");
  await expect(notice).toBeVisible();
  await expect(notice).not.toBeEmpty();
  await expectNoVerdict(page, ".messages");
  await hold(4000);

  const video = page.video();
  await context.close();
  const end = now();
  if (video === null) throw new Error("nothing was recorded");
  const cuts = cutsFromMarks(marks, end, start);
  writeFileSync(
    `${OUT}/cuts.json`,
    `${JSON.stringify({ video: await video.path(), questions: { first, second }, cuts }, null, 2)}\n`,
  );
  console.log(
    `demo: ${cutLength(cuts).toFixed(1)} s after cutting; fast-forwards of ${first} and ${second} questions`,
  );
});

/** Shows a caption over the page, in its own colours and font; checked for verdict words. */
async function caption(page: Page, text: string): Promise<void> {
  const hits = VERDICT_PATTERNS.filter((p) => p.test(text)).map(String);
  expect(hits).toEqual([]);
  // Source text, run in the page: this file is typed for Node, without the DOM.
  await page.evaluate(`(() => {
    let box = document.getElementById("demo-caption");
    if (box === null) {
      box = document.createElement("div");
      box.id = "demo-caption";
      box.setAttribute("aria-hidden", "true");
      Object.assign(box.style, {
        position: "fixed",
        left: "50%",
        bottom: "28px",
        transform: "translateX(-50%)",
        zIndex: "1000",
        padding: "10px 18px",
        borderRadius: "8px",
        background: "var(--ink, #14202b)",
        color: "var(--surface, #ffffff)",
        font: "var(--text-group, 600 15px / 22px sans-serif)",
        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.18)",
      });
      document.body.append(box);
    }
    box.textContent = ${JSON.stringify(text)};
  })()`);
}

async function uncaption(page: Page): Promise<void> {
  await page.evaluate(`document.getElementById("demo-caption")?.remove()`);
}
