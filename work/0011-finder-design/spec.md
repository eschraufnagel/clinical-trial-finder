# spec: 0011 the finder's design

**Status:** Draft
**Date:** 2026-11
**Intent:** [intent.md](intent.md), committed as `0011 intent`. **Designs:** [design/](design/), committed as `0011 designs, accepted`, from [the brief](brief/brief.md).

The page is rebuilt to the accepted designs: Chart v2's tokens and components in one stylesheet, the finder's own components beside them, the patient register wherever the person reads or answers, dark mode from the system, a phone layout at 600 px, and print styles for the sheet and the record. The fonts and the Record mark are bundled. What the page says a finding is, which trials it keeps and in what order stay exactly as they are. One behaviour changes: a failed **Check these** says so.

---

## 1. What exists at the end

- **One stylesheet,** `src/web/styles.css`: Chart v2's `tokens.css` and `components.css` from the handoff, then the finder's components from `design/chart.css`, mapped back from the canvas's classes to the app's (§3).
- **The components restyled to the designs:** the header, the start form, the questions, the short list and its trial cards, the sheet, the check and its records, Settings (§4).
- **Fonts and icons bundled** under `src/web/` and served from this machine (§5).
- **A contrast test** that holds every text and control pair the page uses to AA, in light and dark (§6).
- **A failed Check these** that says so, in a new sentence (§4.4).
- **Screenshots in the README,** made by a script a person runs against `--fake` (§7).
- **The write-up:** `docs/page.md`, the README, the roadmap row, `CLAUDE.md` (§9).

## 2. The designs, and where the build differs from them (OQ 1)

**Answered.** The six screens were designed on a Claude Design canvas in Claude, in light and dark, desktop and phone, with the printed sheet and record and 18 states, and accepted by the owner (`design/README.md`). The build follows them. Where they disagree with Chart v2's `components.css`, the finder's design wins for the finder's own components, and `components.css` wins for anything Chart v2 already defines (the header, buttons, fields, tags, groups).

**Four places the build differs from the canvas, because the page can't know what the canvas drew:**

1. **The check's question isn't split** into a quoted rule and "Does this describe you?". The model words each question; only its fallback uses the fixed template (`src/screening/templates.ts`). The question card shows the message as it arrives. Splitting it would mean parsing the agent's text or a new field on the transport's messages, which this slice doesn't open.
2. **The search line above the questions** ("Lung cancer (non-small cell) · 97201 · 50 miles") is left out. The conversation view doesn't carry the search, and adding it is a server change for one line.
3. **Lab values stay one line per rule.** The canvas folded six into one row. The record's rule that every criterion has one line, which the measure and the page's keys rely on, stays; consecutive lab-value lines are set compactly instead, in the canvas's mono style.
4. **The theme and the phone rules** are written as Chart v2 writes them, `prefers-color-scheme` and `@media (max-width: 600px)`, not the canvas's classes and container query (`design/README.md`).

A later gate can overturn any of these by asking for the change the canvas shows.

## 3. The stylesheet

- **Order:** tokens, then Chart v2's components, then the finder's, then responsive rules, then print. One file, as now; no CSS framework, no CSS modules.
- **Class names:** the components' class names change to the design's (`.tcard`, `.block`, `.rrow`, `.question-card`, …). The hooks the browser test reads keep working (§8): `.messages li.agent`, `ol.trials > li`, `.shortlist`, `.record`, `.no-print`, and every role and label it finds controls by.
- **The old colours go:** `--flag`, `--problem`, `--muted`, `--paper` and every rule that uses them. Nothing on the page is coloured by whether a rule may not fit (§4.1).
- **Motion:** 120 ms colour transitions only, none under `prefers-reduced-motion: reduce`.
- **Focus:** Chart v2's: a 2 px accent outline on `:focus-visible`, and the accent border with the ring on text inputs.

## 4. The screens

All fixed sentences come from `copy.ts` or the server's words, as now (`tests/web/copy.test.ts`).

### 4.1 Findings in neutral ink

"May not fit", "Few of this trial's rules could be checked", a trial marked as about other cancers, and errors each get a labelled block in the same style as every other block on a card or record. They're told apart by their label and by coming first. No colour, icon or weight follows whether a rule may not fit: the record's finding column is 500 weight for every outcome, as Chart v2's is.

### 4.2 The frame

- **Header:** the Record mark (inline SVG, from the handoff) and "Trial Finder" (`COPY.brand`, new), the nav as now, and the model chip, which reads the model the page already shows in Settings.
- **The standing notice** ("This is a proof of concept…") and the scripted-mode notice sit in a quiet strip under the header.
- **The document title** becomes "Trial Finder". `COPY.title` ("Trials to ask your oncologist about") stays as the page's heading where it's used.

### 4.3 The start form, the questions, Settings

As the canvas draws them:
- **Start:** pills for distance and sex (radio groups, 48 px), and the "What happens next" aside with its three new lines.
- **Questions:** Chart v2's screening layout without the testing panel: earlier turns set back with each confirmed reading under the person's words, the current question large in the question card, the confirm step as its own card (**That's right** primary, **Change it** secondary), the answer buttons equal in size, "I don't know" among them. "Question N" counts the agent's questions on the page.
- **Settings:** the coordinator register, one card per provider.

### 4.4 The short list

- **Cards:** the trial's number small in mono, the NCT ID, phase and distance, the title and what it tests. Closed, a card still shows "How much was read", any "May not fit" and any other-cancer block; **Open** adds the rest as labelled blocks.
- **The rail** (desktop): "Your check", the tick note, the picked trials and **Check these**; then "For your oncologist" with the sheet's print button. **On a phone** the rail becomes a bar at the bottom with **Check these**, and the tick note sits above the cards.
- **Ticking** is unchanged: checkboxes labelled "Check this trial", three at most, only on trials that can be checked.
- **A failed Check these** (OQ 6). Today `startCheck` failing leaves the button as it was and says nothing. It shows, under the button: "The check couldn't start. Nothing on your list changed. Try again." (`COPY.list.checkFailed`, new). The ticks stay. **The one change in behaviour,** named as such in the PR.

### 4.5 The sheet

On screen and printed, as `design/Sheet.dc.html`: the questions with their counts and the trials-asked figures as a table, what to bring, what was asked and answered, the trials. The sentences are the ones `src/shortlist/sheet.ts` writes; where the design sets them as table columns, the column heads are new copy.

### 4.6 The check and its records (OQ 2)

- **Questions:** the questions screen's pattern, one trial at a time, with the picked trials as tabs above the thread. During questions the tabs show which trial is being asked; once records are filed they switch which record is shown. **Stop and show the records** and **Back to your list** as now.
- **The record** keeps its five sections and their words (`docs/check.md`). In Chart v2's review pattern: a summary column with each section's count (on a phone, above the sections), a notice with "This isn't a decision…" and the counts line, sections as `<details>`, rules in protocol order, the finding right-aligned. "About the trial, not you" stays folded. The summary's label and one line per section are new copy.
- **Printed:** every record, without the questions or the navigation, as `design/RecordPrint.dc.html`. On paper "To ask your oncologist" comes first; on screen the order is unchanged (Concern 4).

### 4.7 States

Every state on `design/States.dc.html` is drawn from the page's existing conditions: searching, an unknown ZIP, reading a reply, a reply that couldn't be read, a hosted model, the end of the questions, stopped early, a marked trial, a fourth tick refused, **Check these** starting and failing, reading a trial's rules, a typed reply in the check, a trial not reached, rules that couldn't be read, a check that's gone, a list rule and a rule for one part, a failed test in Settings.

## 5. Fonts and icons (OQ 3)

- **Fonts:** the eight WOFF2 files `design_handoff_chart_v2/fonts/FONTS.md` lists (IBM Plex Sans 400, 400 italic, 500, 600; Plex Mono 400, 500; Atkinson Hyperlegible 400, 700), with each family's `OFL.txt`, in `src/web/fonts/`. `@font-face` in `styles.css` points at them by relative URL; Vite copies them into `dist/web/assets/`. **The owner downloads them once** from the sources `FONTS.md` names and they're committed (Concern 1). No npm package.
- **Icons:** `favicon.svg`, the PNG icons and the manifest from the handoff's `icons/`, in `src/web/public/`, linked from `index.html` as `icons/HEAD.html` gives them.
- **The server** (`src/server/app.ts`) gains two content types, `.woff2` (`font/woff2`) and `.webmanifest`. It serves them from `dist/web/` on 127.0.0.1 like every other file.
- **Missing a font,** the stacks fall back to `system-ui` and `ui-monospace`, as the handoff's do.

## 6. Contrast (OQ 4)

`tests/web/contrast.test.ts`, deterministic:
- reads the light token block and the dark one from `styles.css`;
- for each pair the page uses, computes the WCAG ratio: text pairs at 4.5:1 or more, control borders, focus rings and the mark at 3:1 or more;
- the pairs are listed in the test with where each is used, starting from the handoff's list (ink on bg, on you, on surface; ink-2 on surface, surface-2, disabled; placeholder on surface; accent on surface; on-accent on accent and accent-hover; control-line on surface) and adding any the finder's components use;
- fails on a pair that falls short, or a colour in `styles.css` outside the token blocks.

The print styles use the light tokens on white, which the same test covers. The owner's look at both themes is part of Gate 1.

## 7. Screenshots (OQ 5)

- **`npm run screenshots`,** a script a person runs: Playwright against `npm run app -- --fake` on its own port, with its own config, `playwright.screenshots.config.ts`, so it's never part of `npm test` or `npm run test:e2e`.
- It plays made-up patient p08, as the browser test does, and writes three light-mode PNGs at 1280 wide to `docs/images/`: a question being confirmed, the short list, a record.
- The README shows them under "What it does", with a line saying they're made-up answers. Re-running the script overwrites them.
- `tests/boundary.test.ts` holds this config's server to `--fake` too, as it holds the browser test's.

## 8. The browser test

- **No expectation changes.** The verdict scan, the order, the confirm step, the check's records and printing are checked as now.
- **Selectors** may change where markup changes, and only to find the same element. Each one is listed in the plan. Where a class hook the test reads can stay, it stays.
- **New:** dark mode renders (the page under `colorScheme: "dark"` has a background from the dark tokens), and at 390 wide the short list shows the pick bar and no rail.

## 9. Docs and the rest

- **`docs/page.md`:** a section on how the page looks and why (the two registers, neutral findings, dark mode, the phone layout, print), linking `design/`, and the failed-check sentence under the check.
- **README:** the screenshots (§7). Its title stays "Clinical Trial Finder", the repository's name; "Trial Finder" is the page's.
- **`work/ROADMAP.md`:** a 0011 row. Only that is committed; the owner's Future scope section stays unstaged.
- **`CLAUDE.md`:** `npm run screenshots` in the command table; `src/web/` in the layout gains "fonts and icons bundled"; the boundary list notes the screenshot config is held to `--fake`.

## 10. Boundaries

- **No network at runtime.** `tests/boundary.test.ts` gains: nothing under `src/web/` (stylesheets and `index.html` included) names an `http:` or `https:` URL. Today's rule covers `fetch()` in scripts only; a font link to a CDN in a stylesheet would get past it.
- **`src/web/` stays free of Node** and unimported by the rest of `src/`.
- **No new dependency.** No new host. The server still listens on 127.0.0.1 alone.
- **No model, no spend.** Every screen is built and photographed on `--fake`.

## 11. Tests

Deterministic only:
- **The contrast test** (§6), with a case showing it catches a failing pair.
- **The copy test** as now, covering the new sentences.
- **The boundary test:** no external URL in `src/web/`; the screenshot config held to `--fake`.
- **The server:** `.woff2` and `.webmanifest` served with their types (`tests/server/`).
- **The failed check:** the list shows `COPY.list.checkFailed` when starting a check fails, and keeps the ticks (in the browser test, through a route that fails, or a unit test of the component's logic in `logic.ts`; the plan picks).
- **Gate 1 is a person looking.** The browser test proves the page works; it can't prove it reads well.

## 12. Gates

**Gate 1: is this the look the finder ships?** After every screen is built and before the screenshots and docs. The owner runs `npm run app -- --fake` with p08, or the plan's equivalent, and sees each screen in light and dark, at desktop and phone width, and the sheet and a record in print preview, beside the canvas. Wrong here costs the README's screenshots and `docs/page.md` written about a look that then changes, and a public face of the repository that doesn't match the page.

No gate on the foundation stage: the stylesheet is cheap to change, and every screen built on it is seen at Gate 1.

## 13. Out of scope

- Any change to what the page says, keeps or orders, beyond the new sentences listed in `design/canvas.json`'s note and §4.
- The transport, the server's views (beyond two content types), the check's and the conversation's logic.
- The prescreening repository, and a shared package between the two.
- A theme toggle (Chart v2 follows the system).
- More cancer types.

## Concerns for the owner

1. **The fonts are a step on your hands.** Eight WOFF2 files and two licences, downloaded once from IBM's and the Braille Institute's releases (or Google Fonts' repository), and committed, about half a megabyte. **Deciding:** you download them, as proposed; or the plan has me fetch them once from those sources with your go-ahead, which is a network call during development, not at runtime; or the `@ibm/plex-*` npm packages for Plex, which adds a dependency.
2. **Four places the build differs from the accepted canvas** (§2): the check's question unsplit, the search line left out, lab values one line each, the theme and phone rules written the app's way. **Deciding:** accept these, or ask for one, knowing the first needs a transport field and the second a server change.
3. **One behaviour change:** a failed **Check these** says so, with a new sentence. The intent named it. **Deciding:** keep it in this slice, as proposed.
4. **The printed record puts "To ask your oncologist" first,** as the canvas does, for the doctor reading it in a visit. On screen the order stays. **Deciding:** print order changed, or kept as the screen's.
5. **New sentences.** About fifteen, all listed in `design/canvas.json`'s note: the start form's "What happens next", the failed check, the record summary's lines, the sheet's column heads, "Trial Finder". Each goes through the verdict scan. **Deciding:** whether any should be cut, since the intent says the words stay unless a design needs a new one.
6. **A new command and a new Playwright config** for the screenshots. **Deciding:** add them, or take the screenshots by hand once, which nobody can re-make the same way.
