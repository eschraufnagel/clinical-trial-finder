# plan: 0011 the finder's design

**Intent:** [intent.md](intent.md), committed as `0011 intent`. **Designs:** [design/](design/), committed as `0011 designs, accepted`. **Spec:** [spec.md](spec.md), committed as `0011 spec`. Section numbers (§) below are the spec's.

## Context

The page works but looks like a test harness: `src/web/styles.css` is 173 lines of `system-ui` in a 48rem column, with no dark mode and no phone layout, and it colours "may not fit" amber (`--flag`) and errors red (`--problem`). Chart v2 forbids status colour. The owner chose Chart v2 for both products. The finder's own screens were designed on a Claude Design canvas from [the brief](brief/brief.md), and the owner accepted them (`design/README.md`). The spec builds the page to them, with four stated differences (§2), one change in behaviour (a failed **Check these** says so, §4.4), bundled fonts and icons (§5), a contrast test (§6), a screenshot script (§7) and one gate on the built page (§12).

**Accepting the spec settled its concerns as proposed:**
- the owner downloads the fonts;
- the four differences from the canvas stand;
- the failed-check sentence is in;
- the printed record puts "To ask your oncologist" first;
- the new sentences stay;
- the screenshot script is added.

**What the code is today:**
- **Build and serve.** Vite builds `src/web/` (root) into `dist/web/` (`vite.config.ts`); `npm run app` runs `vite build` then `scripts/app.ts`. `src/server/app.ts` `registerPage` reads every file under `dist/web/` once and serves each with `CONTENT_TYPES` (html, js, css, svg, json, ico, png), anything else as `application/octet-stream`. There's no `src/web/public/` yet; Vite copies one if it exists.
- **The page.** `App.tsx` (header, nav, banners, hash routes), `SearchForm.tsx`, `Conversation.tsx` with `Channel.tsx` (`Messages`: `ol.messages > li.agent|li.participant`; `Reply`: the confirm step, choices, the reply form; `isConfirm(choices)` tells a confirm message), `ShortList.tsx` (ticks, `startCheck` in a `try/finally` that swallows a failure, `.rest`), `TrialCard.tsx` (every section always shown; no Open/Close in use, though `COPY.list.open`/`close` exist), `Answers.tsx`, `Sheet.tsx`, `Check.tsx` (messages, reply, records stacked, `notChecked`, `gone`), `Record.tsx` (`Section` per record section, `Line` per criterion as `li`, `toAsk` as `ol > li`, the folded section as `<details>`), `SettingsPage.tsx`, `Words.tsx` (`W`, `textOf`), `copy.ts` (`COPY`), `api.ts` (`Info` has `model`, `hosted`, `mode`), `logic.ts`.
- **What the browser test reads** (`e2e/*.spec.ts`, `e2e/lib/page.ts`): `.messages li.agent`, `ol.trials > li`, `.shortlist > ol.trials > li article` (its `aria-label`), `.trial .other`, `.rest .trial .other`, `.sheet ol`, `.record`, `li` under a record filtered by `WHY.didntKnow`, `.record ol > li`, roles and labels from `COPY`. `expectNoVerdict` scans the body's `innerText`, leaving out `[data-registry]` and `[data-said]`; anything not displayed isn't scanned.
- **Guards.** `tests/web/copy.test.ts` scans `COPY` and the server's words for verdict words and fails on JSX text written into a component. `tests/boundary.test.ts` holds `playwright.config.ts`'s `webServer.command` to `--fake` (`webServerCommand`, `runsScriptedReaderOnly`), keeps `src/web/` free of Node, and checks `fetch()` hosts; it doesn't look at URLs in stylesheets or `index.html`.
- **The record's words** come from `src/check/record.ts` (`WHY.labValue`, `REQUIRED`, …), which imports only types and `src/shortlist/words.ts`, so the page can import `WHY` without Node.
- **The handoff** is at `~/Downloads/# Clinical trial prescreening redesign/design_handoff_chart_v2/`: `tokens.css`, `components.css`, `icons/` (`brand-mark-inline.svg`, `favicon.svg`, `favicon-32.png`, `apple-touch-icon-180.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `HEAD.html` with the `<link>` tags and a manifest), `fonts/FONTS.md`.

## Order of work

### Stages and gates

| Stage | Steps | Ends at | What you can see at the end |
| --- | --- | --- | --- |
| **A. The page, rebuilt** | 1–8 | **Gate 1** | every screen in Chart v2, light and dark, desktop and phone, with print; fonts and icons bundled; the contrast test; the failed-check sentence; `gate-1-look.md` |
| **B. Shown and written up** | 9–11 | PR | `npm run screenshots` and the README's images; `docs/page.md`, `CLAUDE.md`, the roadmap row; review passes |

**Before step 2: the fonts.** The owner puts eight WOFF2 files and the two licences in `src/web/fonts/` (step 2 lists them). Step 1 needs nothing; if step 2 is reached without them, work stops and asks. That's a dependency, not a gate.

**No model run, no spend.** Every screen is built and checked on `npm run app -- --fake`.

**Gate 1: is this the look the finder ships?** (§12)
- **What's decided:** whether the built page matches the accepted canvas closely enough to photograph and write up, and whether the four differences in §2 still read right once built.
- **What the owner sees:** `work/0011-finder-design/gate-1-look.md`, which lists the walkthrough and what to compare. The owner runs `npm run app -- --fake`, plays made-up patient p08 (`evals/cases/patients/dev/p08.json`: ZIP 97201, 50 miles, 69, male; the replies are in the file), ticks three trials, checks one, and looks at:
  - each screen in the system's light and dark settings, beside the canvas;
  - each screen at phone width (the browser's device view at 390 px);
  - the sheet and a record in print preview;
  - the states the walkthrough can reach (reading a reply, stopped early, a fourth tick refused, a trial not reached, the marked trials under "more trials").

  The page also lists the four differences (§2), the new sentences (`design/canvas.json`'s note) and every selector the browser test changed.
- **What it costs to be wrong:** stage B photographs the page for the README, the repository's public face, and describes it in `docs/page.md`. A look that changes afterwards means both are redone, and a README that doesn't match the page until they are.
- **Can be no:** "revise", with the changes named; the stage A steps they touch are amended, `npm run check` and `npm run test:e2e` pass, and Gate 1 comes again.

**Stage B needs no gate.** It photographs and documents what Gate 1 accepted.

### Steps

**Rules for every step:**
- One commit per step, through `npm run check && git commit`.
- No Co-Authored-By trailer.
- No test mocks a module or stubs a global; no test reads `local/` or a gitignored file.
- Dates are months.
- `work/ROADMAP.md`'s uncommitted Future scope section is the owner's: never staged. Stage files by name.
- Every fixed sentence goes in `copy.ts`. Every class the browser test reads stays on its element: new classes are added beside it (`className="trial tcard"`), never in its place.
- After each step from 3 on, `npm run test:e2e` passes as well.

**Stage A: the page, rebuilt**

1. **Baseline.** Record in Records: `npm run check` exits 0, with the test count and time; `npm run test:e2e` passes, with its case count. The commit is `plan.md`'s Records alone.

2. **Fonts, icons, and the server's types** (§5). *Revised at step 2 (owner, 2026-11): the prescreening repository already built Chart v2 in its slice 0020, so the fonts, licences, icons, manifest and `index.html` come from there, and the two products share the same files.*
   - **Fonts,** copied from the prescreening repository's `src/web/fonts/` into `src/web/fonts/`: `IBMPlexSans-Regular.woff2`, `IBMPlexSans-Italic.woff2`, `IBMPlexSans-Medium.woff2`, `IBMPlexSans-SemiBold.woff2`, `IBMPlexMono-Regular.woff2`, `IBMPlexMono-Medium.woff2`, `AtkinsonHyperlegible-Regular.woff2`, `AtkinsonHyperlegible-Bold.woff2`, and its three licences, `IBMPlexSans-OFL.txt`, `IBMPlexMono-OFL.txt`, `AtkinsonHyperlegible-OFL.txt`. Record each file's size.
   - **Icons,** copied as they are from the prescreening repository's `src/web/public/icons/` into `src/web/public/icons/`: `favicon.svg`, `favicon-32.png`, `apple-touch-icon-180.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`; and `src/web/public/manifest.webmanifest`, from its manifest, named "Trial Finder" ("Finder" short).
   - **`src/web/index.html`:** from the prescreening repository's: `<title>Trial Finder</title>`, the icon and manifest `<link>`s under `/icons/`, the light and dark `theme-color`s, and `<meta name="color-scheme" content="light dark">`.
   - **`src/server/app.ts` `CONTENT_TYPES`:** `.woff2` → `font/woff2`, `.webmanifest` → `application/manifest+json`.
   - **`tests/server/app.test.ts`:** a built-page fixture with a `.woff2` and a `.webmanifest` file is served with those types.
   - Nothing references the fonts yet, so the page is unchanged.

3. **The stylesheet's foundation, the contrast test, and the URL boundary** (§3, §6, §10). *Revised at step 3 (owner, 2026-11): items 1 to 3 below come from the prescreening repository's `styles.css` (its lines 6 to 431: `@font-face`, tokens, base, focus, buttons, cards and tags, header, mark, model chip, banner, and the header's phone rules), copied unchanged, instead of pasting the handoff's files again. So its conventions hold here too: a button is primary unless it says `.secondary` or `.quiet`; the header is `.header` / `.header-inner`; the model chip is `.pill`. The canvas's distance and sex pills are therefore `.option` in the app.*
   - **`src/web/styles.css` rewritten, in this order:**
     1. `@font-face` for the eight fonts, `url("./fonts/…")`, `font-display: swap`;
     2. the handoff's `tokens.css` tokens as they are: light on `:root`, dark under `@media (prefers-color-scheme: dark)`, reduced motion;
     3. the handoff's `components.css` as it is (header, buttons, fields, tags, cards, screening, review groups, finding rows);
     4. the finder's components from `design/chart.css` (from "Three kinds of words" to "Settings"), with the canvas's `.t-light`/`.t-dark` blocks and `.screen` wrapper dropped, `--font-*`, `--text-*`, spacing and radius tokens moved to `:root`, and `.screen`-prefixed selectors unprefixed;
     5. the phone rules: the handoff's `@media (max-width: 600px)` block, then the canvas's `@container screen (max-width: 600px)` rules rewritten as `@media (max-width: 600px)`, with `.phone-only`/`.desktop-only`;
     6. the page's base (`body` background `--bg`, the `.app` frame);
     7. `@media print`: light tokens forced on `:root` whatever the system's theme, white background, `header`, `.no-print`, `.rail`, `.pickbar`, `.picked-tabs` and `.summary-actions` hidden, `.record` `break-inside: avoid-page` kept, every record shown (§4.6), and the printed record's order (step 7).
   - **Gone:** `--muted`, `--paper`, `--flag`, `--problem`, `.flag`, `.problem`, `.hints`' and `.may-not-fit`'s coloured borders, and the old element rules. The old class names that components still use (`.flag`, `.problem`, `.note`, `.banner`, `.primary`) get neutral rules in this step so the page still renders until steps 4 to 8 replace them: `.flag` and `.problem` become ink with no colour, `.primary` takes `.button-primary`'s rules.
   - **`tests/web/contrast.test.ts`,** new:
     - reads `styles.css`, takes the `:root` block and the `prefers-color-scheme: dark` block, and parses `--name: #hex` pairs;
     - a table of pairs, each with where it's used and its minimum: text 4.5 (`ink`/`bg`, `ink`/`surface`, `ink`/`surface-2`, `ink`/`you`, `ink-2`/`surface`, `ink-2`/`surface-2`, `ink-2`/`bg`, `ink-2`/`disabled`, `placeholder`/`surface`, `accent`/`surface`, `accent`/`bg`, `on-accent`/`accent`, `on-accent`/`accent-hover`), non-text 3 (`control-line`/`surface`, `accent`/`surface` as the focus outline, `mark-lead`/`ink` and `mark-line`/`ink` for the mark's lines on its tile);
     - checks every pair in both themes with WCAG's relative-luminance formula;
     - fails if a hex colour appears in `styles.css` outside the two token blocks, the `@media print` block's forced light tokens, and `rgba()` shadows;
     - a case showing it catches a pair below 4.5 (`#767676` on `#FFFFFF` passes at 4.54; `#777777` fails at 4.48).
   - **`tests/boundary.test.ts`:** a new block, "the page names no outside address": every file under `src/web/` except `fonts/` and `public/icons/*.png` (text read as UTF-8) has no `http://` or `https://` URL other than the SVG namespace `http://www.w3.org/2000/svg` and, in `.svg` files only, the namespaces their XML declares (`xmlns:*`); with a case that catches a Google Fonts `@import` in a stylesheet.

4. **The frame and the start form** (§4.2, §4.3).
   - **`copy.ts`:** `brand: "Trial Finder"`; `search.next: { heading: "What happens next", steps: ["A few questions, one at a time.", "A short list of trials to ask your oncologist about.", "A sheet to print for your visit."] }`.
   - **`App.tsx`:** the header as Chart v2's `.app-header`: the Record mark as inline SVG (the four `rect`s of `brand-mark-inline.svg`, without its `metadata`, `aria-hidden`), `COPY.brand`; `nav.nav` with `.nav-link`s and `aria-current="page"` on the current view; the model chip from `info.model` (and `info.hosted` when a hosted model is in use), left out while `info` is undefined. The two banners move into a `.standing` strip under the header. `COPY.title` stays where the start view uses it as its heading.
   - **`SearchForm.tsx`:** the `.start` layout: a `.card.start-form` with ZIP and age in `.start-row`, distance and sex as `fieldset` radio groups drawn as `.option`s (a real `input type="radio"` inside each label, transparent and covering its box, so it stays focusable and `getByRole("radio")` can check it; *revised at step 4: a clipped 1 px radio can't be checked by the browser test, which needs it visible*; the selected pill takes the accent border, which is an action state, not a finding), the start button `.button.button-primary`; the "What happens next" aside; the ZIP error as `.error-line role="alert"`.
   - **The browser test's `search()` helper:** distance was a `select` (`selectOption` on "How far you could travel"); it becomes `page.getByRole("radio", { name: radiusMiles === null ? COPY.search.anywhere : COPY.search.miles(radiusMiles), exact: true }).check()`. The one selector change in this step, listed for the gate page.

5. **The questions, and the check's questions** (§4.3, §4.6, §2 item 1).
   - **`Channel.tsx` `Messages`:** each `li` keeps its `className={m.from}` and gains `reading` when its choices are a confirm (`isConfirm(m.choices)`), `current` on the last agent message. Styles: earlier agent turns as `.turn-agent`, participant turns as `.turn-you-text`, a `reading` message small under the turn before it, the `current` agent message in the question card's style (label "Question N" from `COPY.conversation.question(n)`, new: `` `Question ${n}` ``, where `n` counts agent messages that offer non-confirm choices or none, up to this one). The message text is shown as it arrives (§2 item 1).
   - **`Reply`:** the confirm as `.confirm` (**That's right** `.button-primary.button-patient`, **Change it** `.button-secondary.button-patient`, the reader note as `.confirm-meta`); the reply form as `.composer` (`textarea.composer-input`, label `COPY.conversation.reply`, the local/hosted note as `.composer-note`, **Send** primary); choices as `.answers` of `.button-secondary`, equal size; "Not sure how to say it?" as `.chooser-label`; the failed state as `.error-line` with **Try again**.
   - **`Conversation.tsx`:** the `.convo` column, the intro as `.convo-reassure`, **Show me the list now** secondary and **Start over** quiet in `.convo-actions`.
   - **`Check.tsx`, its questions:** the same, under `COPY.check.heading` as `.convo-heading`, with `.picked-tabs` above the thread: one tab per picked trial (`view.trials`), the trial being asked marked `aria-current` (the first without a record while not done). Tabs are buttons here; they switch records in step 7.
   - The browser test's `lastQuestion` (`.messages li.agent`, last) still reads the last agent message.

6. **The short list, and a failed Check these** (§4.1, §4.4).
   - **`copy.ts`:** `list.checkFailed: "The check couldn't start. Nothing on your list changed. Try again."`; `list.checkHeading` reuses `COPY.nav.check` (no new string).
   - **`TrialCard.tsx`:** `article.trial.tcard` (keeps `aria-label`), with an `open` state (closed by default):
     - head: the rank in `.tcard-n`, the NCT link, phase and distance in `.tcard-meta` (from the existing `W` values; the phase's first words as a `.tag` only if `TrialView` already carries a short phase label, otherwise the meta row shows the NCT link and the site line), the title, interventions in `.tcard-tests`;
     - **always shown, closed or open, in this order:** the other-cancer block (`div.other.block`, so `.trial .other` still matches), "May not fit" (`.hints.block`: each hint's question, `yourAnswer`, the part, `theRule` in `.trial-words`, the hint note), "How much was read" (`read`, with `thin` as `.lead-line` first);
     - **open only:** what it tests, phase, where, flags ("About the record"), what your answers checked (`said` in `.said` with `data-said`), still unknown;
     - foot: the tick (passed in from `ShortList` as a child so `ShortList` keeps owning it), the full-record link, **Open**/**Close** (`COPY.list.open`/`close`) as `.button-quiet` with `aria-expanded`.
   - **`ShortList.tsx`:** `.list-layout` with `.list-main` and `aside.rail` (desktop): `COPY.nav.check` as the rail's heading, the tick note, the picked trials' titles (`ol.picked`), **Check these**, `tickLimit` when three are ticked; then "For your oncologist" with the sheet's print button linking to the sheet view. On a phone, `.pickbar` with **Check these** and `ticked.length / 3`, and the tick note `.phone-only` above the cards. Only one of each control is displayed at a width, so role queries stay unique.
   - **The failed check:** `check()` catches a rejected `startCheck`, sets `failed`, keeps the ticks, and shows `COPY.list.checkFailed` as `.error-line role="alert"` under the rail's button (and the pick bar's on a phone); a new attempt clears it.
   - **`Answers.tsx`:** `.answers-table` rows; the person's words in `.said` with `data-said`.
   - **`e2e/lib/page.ts`:** a helper `openAllCards(page)` clicks every **Open**; the list's `expectNoVerdict` calls in `conversation.spec.ts` and `check.spec.ts` call it first, so the scan still covers every card's words. Listed for the gate page as the one flow change.
   - **`e2e/check.spec.ts`,** a new case: with `page.route` answering the check's start request with a 500, **Check these** shows `COPY.list.checkFailed` and the ticks stay. (`page.route` is Playwright's request routing, not a module mock.)

7. **The sheet and the records** (§4.5, §4.6).
   - **`Sheet.tsx`:** the canvas's document: the mark and `COPY.brand` small, the heading, the lead, then: the questions with their count sentences as `src/shortlist/sheet.ts` writes them (`sheet.ts` unchanged), *kept an `ol` (revised at step 6: the browser test reads `.sheet ol`), set as rows*; then tables with `th` heads: what to bring with its questions; what was asked and answered, with column heads `COPY.sheet.question`, `.said`, `.answer` (new: "Question", "Said", "Answer"); the trials. `.sheet ol` keeps matching where the browser test reads it.
   - **`Record.tsx`:**
     - `article.record` in `.review` layout: `aside.review-summary` with `COPY.record.summary` ("This record", new) and one `.summary-item` per section, its count and its line (`COPY.record.about`, new: the five lines in `design/canvas.json`'s note), **Print or save as PDF** and **Back to your list** in `.summary-actions`; `.review-main` with the NCT ID, the title, `.notice-list` holding `notADecision` and `counts.line` (and `lead` when present);
     - each section a `details.group` (open, except the folded one, whose summary shows `COPY.record.show`), lines as `li.rrow`: kind in `.rrow-type`, the rule in `.rrow-text` (`data-registry`), the part and list notes, earlier answers and `said` in `.rrow-evidence` with `.said`, the finding (`flag` and `why`) in `.rrow-finding`, 500 weight for every outcome. A line whose `why` is `WHY.labValue` (imported from `src/check/record.ts`) gains `.lab`, and consecutive `.lab` lines are set compactly in mono (§2 item 3);
     - `toAsk` as `ol` of `.ask` items, `.ask-q` and `.ask-rule`, as now `ol > li`.
   - **`Check.tsx`, its records:** once records exist, the tabs switch which record is shown (`hidden` on the others on screen; every record shown in print). A trial not reached shows `notChecked` in a `.card`; `gone` as `.error-line` with **Back to your list**.
   - **Print** (`styles.css`): the record a single column; `.to-ask` (the `ol`'s section) given `order: -1` after the header and notice in a flex column, so "To ask your oncologist" prints first (Concern 4 of the spec); the summary column hidden; printed column heads only where the canvas has them, `COPY.record.printSaid` ("Asked earlier, and what you said", new) on the earlier-answers rows.

8. **Settings, the states, and the browser test's new cases** (§4.3, §4.7, §8).
   - **`SettingsPage.tsx`:** `.page` of `.card.provider`s, the coordinator register; results as `.result-line`; a failed test as `.error-line`. No behaviour change.
   - **States:** walk `design/States.dc.html` and confirm each is drawn by steps 4 to 7; fix what isn't. Record the list in Records, each with the step that draws it.
   - **`e2e/look.spec.ts`,** new:
     - under `page.emulateMedia({ colorScheme: "dark" })`, the start page's `body` background is `rgb(15, 22, 28)` (`--bg` dark), and under `"light"` `rgb(246, 247, 248)`;
     - at a 390 × 844 viewport, p08's list shows `.pickbar` and not `.rail`; at 1280, the reverse;
     - the fonts load: `document.fonts.check('16px "Atkinson Hyperlegible"')` is true on the questions screen.
   - **`gate-1-look.md`:** the walkthrough above, the four differences, the new sentences, the selector changes from steps 4 to 7, the states list. Then **stop for Gate 1.**

**Stage B: shown and written up**

9. **Screenshots** (§7).
   - **`playwright.screenshots.config.ts`:** `testDir: "e2e/screenshots"`, `testMatch: "*.shots.ts"`, one worker, no retries, `outputDir: "e2e/.out/shots"`, Desktop Chrome at 1280 × 900, light, `webServer.command: "rm -rf e2e/.out/settings-shots && npm run app -- --fake --port 5045 --settings-dir e2e/.out/settings-shots"`, `reuseExistingServer: false`.
   - **`e2e/screenshots/readme.shots.ts`:** plays p08 with `e2e/lib/patients.ts` and `page.ts`, answers the first question and saves `docs/images/question.png` (question 2 in its card, from the top of the page); finishes, ticks three, opens trial 2, saves `docs/images/list.png` (viewport only); checks the first by tapping "I don't know", stops, saves `docs/images/record.png`, the first record's top 1,000 px. *(Revised at step 9: a confirm sits below the fold once two answers are above it, and a whole record is 5,600 px tall.)* `playwright.config.ts`'s `testMatch: "*.spec.ts"` doesn't pick it up.
   - **`package.json`:** `"screenshots": "playwright test -c playwright.screenshots.config.ts"`.
   - **`tests/boundary.test.ts`:** the browser-test block checks both configs' commands with `runsScriptedReaderOnly`.
   - Run it; commit the three PNGs. Record their sizes.
   - **README:** under "What it does", the three images in a row with alt text, and one line: "Made-up answers, from the page's scripted mode." Its title stays.

10. **Docs.**
    - **`docs/page.md`:** a "How it looks" section: Chart v2 and its two registers, findings in neutral ink and why, dark mode from the system, the phone layout, what prints, fonts bundled with their licences, the contrast test, and a link to `work/0011-finder-design/design/`. Under "The check", the failed-check sentence. Under "Limits": the check's questions aren't split into the rule and the question (§2 item 1).
    - **`CLAUDE.md`:** `npm run screenshots` in the command table ("three README images from `--fake`; never part of `npm test` or `test:e2e`"); in the layout, `web/` gains "fonts and icons bundled in `fonts/` and `public/`"; one boundary sentence: since slice 0011 the test keeps outside addresses out of `src/web/`, and holds the screenshot config to `--fake`.
    - **`work/ROADMAP.md`:** a 0011 row (the finder's design in Chart v2; measured by the contrast test, the verdict scan, the browser test and the owner's look at Gate 1; no model), and the header's "0001 to 0011 are done". Staged with `git add -p`; Future scope stays unstaged.

11. **Review passes** (`REVIEW.md`, its passes over `main...HEAD`). Record findings and fixes in Records.

## Files that change

- `work/0011-finder-design/plan.md`, `gate-1-look.md`
- `src/web/styles.css` (rewritten), `index.html`, `copy.ts`, `App.tsx`, `SearchForm.tsx`, `Channel.tsx`, `Conversation.tsx`, `ShortList.tsx`, `TrialCard.tsx`, `Answers.tsx`, `Sheet.tsx`, `Check.tsx`, `Record.tsx`, `SettingsPage.tsx`
- `src/web/fonts/` (eight WOFF2, two licences) and `src/web/public/` (icons, manifest), new
- `src/server/app.ts`: two content types
- `tests/web/contrast.test.ts`, new; `tests/boundary.test.ts`; `tests/server/app.test.ts`
- `e2e/lib/page.ts`, `e2e/conversation.spec.ts`, `e2e/check.spec.ts`, `e2e/look.spec.ts` (new), `e2e/screenshots/readme.shots.ts` (new), and any selector the steps list
- `playwright.screenshots.config.ts`, new; `package.json`: one script
- `docs/images/question.png`, `list.png`, `record.png`, new
- `README.md`, `docs/page.md`, `CLAUDE.md`, `work/ROADMAP.md` (0011 row and header only)

**Not changed:** `src/shortlist/` (the sheet's and the list's words), `src/check/`, `src/screening/`, `src/questions/`, `src/search/`, `src/facts/`, `src/transport/`, `src/server/` beyond `app.ts`'s two types, every result under `evals/results/`, `design/`.

## Reused, not rebuilt

- **The prescreening repository's Chart v2 (its slice 0020):** the fonts, licences, icons, manifest and `index.html` (step 2). Steps 3 and 9 start from its `src/web/styles.css` (tokens, `@font-face`, base and the shared components) and its `playwright.capture.config.ts` and `npm run screenshots`, so the two products stay alike; where they differ from this plan, the step says so.
- **Chart v2's handoff:** `tokens.css` and `components.css`; the Record mark's geometry.
- **The canvas:** `design/chart.css`'s finder components and the `.dc.html` markup as the reference for each component's structure.
- **The page's data:** `TrialView`, `RecordLine`, `RecordSection`, `TrialRecord`, `FinderView`, `CheckView`, `Info` unchanged; `W`, `textOf`, `isConfirm`, `toggleTick`, `MAX_TICKED`.
- **The browser test's helpers:** `search`, `lastQuestion`, `typeReply`, `shortlistIds`, `expectNoVerdict`, `patient`, `replyTo`, for the new cases and the screenshots.
- **Guards:** `copy.test.ts` as it is; `webServerCommand` and `runsScriptedReaderOnly` for the second config.

## Risks

- **A hidden duplicate control.** The rail and the pick bar both hold **Check these**; the tick note appears twice. If CSS shows both at some width, role queries in the browser test become ambiguous. `look.spec.ts` checks the two widths; one breakpoint (600 px) decides both.
- **Closed cards hide words from the verdict scan.** `openAllCards` before each list scan keeps the scan whole. A future test that forgets it scans less. The helper is named in `expectNoVerdict`'s comment.
- **Hidden radios.** The pills hide their inputs; hidden with `display: none` they'd leave the tab order and the accessibility tree. Each radio is transparent and covers its box instead, and the focus ring is drawn on the box with `:has(:focus-visible)`.
- **Fonts missing at build.** Vite leaves an unresolved `url()` with a warning, and the page falls back to system fonts silently. `look.spec.ts`'s font check catches it.
- **Print differs by browser.** The gate looks at Chrome's print preview only. `order` in a print flex column is honoured by Chrome and Safari; the gate page says which was looked at.
- **The theme forced light in print** relies on `@media print` overriding `prefers-color-scheme: dark` tokens by coming later; the contrast test covers the light tokens it forces.

## Verification

- **Every step:** `npm run check` exits 0. **From step 3:** `npm run test:e2e` passes.
- **By hand at Gate 1:** the walkthrough in `gate-1-look.md`.
- **After step 9:** `npm run screenshots` writes the three images; running it twice gives the same layout.
- **The spec's requirements, step by step:**

  | Spec | Step |
  | --- | --- |
  | §2 (the four differences) | steps 5 (item 1), 4 (item 2: no search line), 7 (item 3), 3 (item 4) |
  | §3 | step 3 |
  | §4.1 | steps 3, 6, 7 |
  | §4.2, §4.3 | steps 4, 5, 8 |
  | §4.4 | step 6 |
  | §4.5, §4.6 | steps 5, 7 |
  | §4.7 | step 8 |
  | §5 | steps 2, 3 |
  | §6 | step 3 |
  | §7 | step 9 |
  | §8 | steps 4 to 8 |
  | §9 | steps 9, 10 |
  | §10 | steps 3, 9 |
  | §11 | steps 2, 3, 6, 8, 9 |
  | §12 | Gate 1 |

## Departures from the spec

- **Cards closed by default, and the browser test opens them before scanning.** §8 says no expectation changes and selectors only. The scan's expectations don't change, but `openAllCards` adds a step to the flow, because §4.4's closed card hides words the scan used to read.
- **The sheet's question counts stay sentences** ("7 of these 10 trials ask about this.") in a second column, rather than the canvas's "7 of these 10" under a "Trials that ask" head: splitting them would change `src/shortlist/sheet.ts`, which §13 keeps out. The sheet's other tables get new column heads as §4.5 says.
- **`COPY.conversation.question(n)`,** "Question N", is a new string the spec's list didn't name; the canvas draws it.
- **`e2e/look.spec.ts`'s font check** is beyond §8's two new checks, to catch fonts missing at build.

## Records

- **Step 1, baseline (2026-11).** At the plan's commit (`ee047e5`):
  - `npm run check` exits 0. `npm test`: 116 files, 1,295 tests passed and 8 expected failures, 885 ms.
  - `npm run test:e2e`: 8 cases passed, 28.5 s.
- **Step 2, fonts and icons (2026-11).** Copied from the prescreening repository at `af1ba04`, at the owner's word, instead of downloaded. Sizes in bytes: Plex Sans Regular 63,020, Italic 67,220, Medium 66,740, SemiBold 67,060; Plex Mono Regular 49,248, Medium 50,400; Atkinson Hyperlegible Regular 23,196, Bold 23,776; 8 fonts 410,660 in all. Licences: `IBMPlexSans-OFL.txt` and `IBMPlexMono-OFL.txt` 4,456 each, `AtkinsonHyperlegible-OFL.txt` 4,352. Its `favicon.svg` differs from the handoff's; the prescreening repository's is used, so both products serve the same file.
- **Step 3, the stylesheet (2026-11).** `styles.css` is 1,718 lines before formatting: 426 from the prescreening repository's, unchanged, then the finder's components, the old class names in neutral ink until steps 4 to 8 replace them, the phone rules and print. `vite build` bundles all eight fonts into `dist/web/assets/` and copies the icons and manifest. The contrast test passes in light, dark and print on 17 pairs; no colour is set outside a token. The browser test's 8 cases pass with the page on the new foundation.
- **Step 4, the frame and the start form (2026-11).** The header is the prescreening repository's markup with "Trial Finder"; the chip's three lines are new copy (`COPY.chip`: "Scripted reader · no model", "Local model · …", "<provider> · …"). The start view's `h1` is `COPY.title`, as the browser test expects; "Where to look" heads the form. Selector change: the browser test's `search()` checks the distance radio by its label instead of `selectOption`.
- **Step 5, the questions and the check's questions (2026-11).** The question card's "Question N" is drawn from a `data-label` attribute by CSS, so each message's text, which the browser test reads with `lastQuestion`, is unchanged. A reading waiting to be confirmed is set large in ink, with **That's right** primary and **Change it** secondary under it; answers are all `.secondary`. The check's picked trials are tabs (`role="tab"`) marked with the trial being asked. No selector changed. Seen by hand on `--fake` in the browser pane: the start form, a reading, the confirm, and question 2 in its card.
- **Step 6, the short list (2026-11).** Cards open and close (**Open**/**Close**, `aria-expanded`); closed, they show the other-cancer block, "May not fit" and "How much was read". The head carries the NCT ID, the phase's first words as a tag ("Phase 2", cut from the phase sentence at its colon), the title and the nearest-site sentence; there is no separate distance field, so the canvas's "1 mile" in the meta row is the site sentence's. The rail holds "Your check", the tick note, the picked trials, **Check these** and the failure line, then a "For your oncologist" link to the sheet (not a print button, which belongs on the sheet). The answers' section is `.your-answers`, since `.answers` is the row of answer buttons. Flow changes in the browser test: `openAllCards` before the list's three verdict scans in `conversation.spec.ts`; case 10 finds the failure line with `getByRole("alert")`, because the rail and the phone's bar each hold it and only one is shown. 9 cases pass.
- **Step 7, the sheet and the records (2026-11).** The sheet has the mark and "Trial Finder", its title as the page's `h1`, the questions as an `ol` of rows with their count sentences, what to bring, the answers as a table with the new heads "Question", "Said", "Answer" (`COPY.sheet.columns`), and the trials. A record is Chart v2's review: the summary column ("This record", the five counts and their lines, `COPY.record.summary` and `.about`), the notice, the sections as `details.group`, each rule one `li.rrow`; the finding is the flag, or the reason when there's no flag, in the same ink and weight; lab-value lines are set compactly. Below 1100 px the summary goes above the record, as the prescreening repository's review does. The picked-trial tabs choose which record is shown; print shows them all with "To ask your oncologist" first. **Two departures:** the summary column has no Print and Back buttons, because the check page already has them and two of each would make the browser test's role queries ambiguous; and "Asked earlier, and what you said" isn't used, since the printed record keeps its rows rather than becoming a table. The list's tick box is `.tick`, not `.check`, which the check page's section already is. 9 cases pass.
- **Step 8, Settings, the states and the look (2026-11).** Settings restyled in the coordinator register, with no change in what it does. The stopgap rules for the old class names are gone: no component uses them. The nav's links keep to one line (a finder rule below the shared ones; the prescreening repository's nav words are shorter). `e2e/look.spec.ts` (case 11): dark background `rgb(15, 22, 28)`, light `rgb(246, 247, 248)`, Atkinson Hyperlegible and IBM Plex Sans loaded, the rail at 1280 and the bar at 390. The states, each with how it's drawn, are in `gate-1-look.md`. Seen by hand in the browser pane: the list at 375 px in dark, the list and Settings at desktop width in dark. `npm run check` exits 0; 10 browser cases pass. **Stopped for Gate 1.**
- **Gate 1 (2026-11).** The owner's answer: go on to stage B, with no revisions.
- **Step 9, screenshots (2026-11).** `npm run screenshots` runs on `--fake` at port 5045 in 9 s and writes `docs/images/question.png` (1280 × 900, 55 KB), `list.png` (1280 × 900, 185 KB) and `record.png` (1136 × 1000, 203 KB). Two changes from the step as planned, written into it: the question image is question 2 in its card rather than a reading to confirm, and the record image is the record's top 1,000 px. The boundary test now checks both Playwright configs' server commands with `runsScriptedReaderOnly`. The README shows the three images under "What it does".
- **Step 10, docs (2026-11).** `docs/page.md` gains "How it looks", the failed-check sentence under "The check", `npm run screenshots`, and two limits: the check's questions aren't split, and print was looked at in Chrome only. `CLAUDE.md` gains the command, the `web/` line and the boundary sentence. The roadmap's 0011 row and header are committed; its Future scope section stays the owner's, unstaged.
- **Step 11, review passes (2026-11).** The five passes in `REVIEW.md` over `main...HEAD`.
  - **Plan compliance:** every changed file is in "Files that change" except `biome.jsonc`, which came in with the designs commit before the plan (it keeps Biome off the canvas's copy). Steps 7 and 9 departed, and say so in their entries.
  - **Correctness, Important, fixed:** the record's summary counts were links to `#NCT…-section`, and the page routes on the hash, so a click left the check for the start page. A failing browser check went in first (`33f51a5`, in case 9), then the fix (`a62d571`): a count scrolls to its section and opens it.
  - **Correctness, Important, fixed:** print forced only some light colours, so a page printed while the system was dark kept dark mode's accent, a light blue, on white. The contrast test now checks print over both themes and failed on it; print forces every colour token (`0d73390`). The test and the fix are one commit, because a commit must pass `npm run check`.
  - **Nit, left:** "Question N" counts the "Which is closest?" that follows **Change it** as a new question, so the number skips one after a change.
  - **Nit, left:** while the check asks about the next trial, the tabs show that trial, so the record just filed is hidden until its tab is chosen.
  - **Nit, left:** the nav's `aria-label="Main"` is written in `App.tsx`, as the prescreening repository's is, not in `copy.ts`.
  - **Scope and data, eval integrity, documentation:** nothing found. The screenshots are of made-up patient p08 on `--fake`. No assertion was loosened; the browser test's changes are listed in `gate-1-look.md`.
  - At the end: `npm run check` exits 0, with 117 files and 1,306 tests passed plus 8 expected failures; `npm run test:e2e` passes all 10 cases in 44 s.
