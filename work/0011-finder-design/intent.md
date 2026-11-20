# intent: 0011 the finder's design

**Author:** the repository owner
**Status:** Draft
**Date:** 2026-11
**Scope:** The page's look and the person's experience of it, in the Chart v2 design and its patient register. The finder's own screens are designed in Claude Design first, then built. What the page does, what it says a trial's rules mean, and every measured number stay as they are.

---

## In plain words

The page works. A person answers a few questions, gets a short list, prints a sheet for their oncologist, and can check two or three trials. It looks like what it is: a working tool built to be measured. Plain system font, one narrow column, and "may not fit" in amber.

This is a proof of concept meant to show what's possible, and the person it's for is someone with cancer whose treatment has stopped working. How the page feels to them is part of what it shows. This slice gives the finder the design the owner chose for both products, Chart v2: calm, clinical, near-white or dark, one muted blue for actions only, and a larger, more legible typeface wherever the person is reading or answering.

Chart v2 was made for the sibling repository, `trial-prescreening-agent`, and covers its screens: the screening chat, a coordinator's review and a list of trials. The finder's screens are different. So the slice starts in Claude Design, with the four screens the finder has and prescreening doesn't: the start form, the short list, the oncologist sheet and the check record. Then the page is rebuilt to those designs and to Chart v2's tokens and components. The two products should read as one family: the same Record mark, "Trial Finder" beside "Trial Prescreening".

**What would make it not worth doing.** If restyling means changing what the page says a finding is. The design changes how things look and how easily they're read, never which trials are kept, how they're ordered, or what "may not fit" means. If a design asks for a status colour, a score or a verdict, the design changes, not the rule.

## Problem

**The page looks like a test harness.** `src/web/styles.css` is 173 lines: `system-ui`, a 48rem column, no dark mode, no responsive rules beyond print. The person's questions are set the same size as the navigation.

**It colours findings, which Chart v2 forbids.** "May not fit" lines on the trial cards and in the record use `.flag`, an amber (`--flag #8a4b08`), and errors use red. Chart v2's first rule is "Findings are words in neutral ink. No green/red, no ticks or crosses, and no colour, icon or weight that changes with whether a rule is met" (handoff `README.md`, Constraints 1). The finder already words findings neutrally (`docs/page.md`, Never a verdict); its colour doesn't match its words.

**Chart v2 doesn't cover the finder's screens.** The handoff is high fidelity for three prescreening screens and says "apply the same tokens and patterns to the remaining screens". The finder's short list, sheet and record have no counterpart there: the short list carries a phase sentence, a read count, what the answers checked, "may not fit" with the trial's words, and unknowns grouped by who would know. Inventing them inside an implementation slice would be guessing at a high-fidelity design.

**Carried in:**
- **The owner's choices for this slice (2026-11):**
  - design the start form, the short list, the oncologist sheet and the check record in Claude Design first;
  - the finder is called "Trial Finder" beside "Trial Prescreening";
  - the record keeps its five sections, written for the person, and takes Chart v2's visual pattern only; it doesn't adopt prescreening's four coordinator groups;
  - the README gets a few screenshots;
  - fonts bundled, no network; findings in neutral words; WCAG AA contrast in light and dark;
  - the patient's experience comes first.
- **Chart v2 is the target; the purple and coral PNGs in the handoff's `uploads/` are prescreening's old look,** not the design (owner, 2026-11).
- **The handoff** (`~/Downloads/# Clinical trial prescreening redesign/design_handoff_chart_v2/`): `README.md` (the spec), `tokens.css` (light and dark, with contrast ratios), `components.css`, `icons/` (the Record mark, favicons, `HEAD.html`), `fonts/FONTS.md` and `reference/*.dc.html`. **The font files themselves aren't in it.** `FONTS.md` lists eight WOFF2 files, all SIL OFL 1.1, to "download once, then commit".
- **Chart v2's two registers.** Coordinator register: dense, IBM Plex Sans and Mono. Patient register: Atkinson Hyperlegible, larger (question 24/35, answer 18/26), one spacing step up. Nearly every finder screen is the person's.
- **The page's rules, which stay** (`docs/page.md`):
  - every fixed sentence in `src/web/copy.ts`, scanned for verdict words by `tests/web/copy.test.ts`, and every screen scanned by the browser test;
  - the confirm step: nothing typed counts until confirmed;
  - the order and its note that it isn't a ranking; the "few of this trial's rules" line; unknowns grouped by who would know;
  - the record's sections (`docs/check.md`, How it works); every unknown on the sheet;
  - the sheet and the record print, and the questions aren't printed;
  - `src/web/` uses no Node and is imported by nothing else in `src/` (`tests/boundary.test.ts`).
- **Known and left open from earlier slices:** a failed **Check these** on the page says nothing (0009, 0010); the page's part lines weren't checked in a browser by hand (0009). The first is a state the new design has to draw (OQ 6).

## Proposed outcome

At the end of this slice:

1. **The finder's screens designed in Claude Design,** in Chart v2: the start form, the short list (with a trial card in full), the oncologist sheet, and the check record, each in light and dark, desktop and phone. The questions screen and Settings follow the handoff's patient and coordinator patterns. The designs come back as a handoff the spec builds to, and the owner accepts them before the spec is written.
2. **Chart v2's tokens and components in the page.** `tokens.css` and `components.css` in the page's stylesheet, the finder's classes mapped onto them, dark mode from the system, the responsive rules at 600 px, and print styles for the sheet and the record.
3. **The patient register wherever the person reads or answers:** the current question large, earlier answers set back, tap targets at least 44 px and primary controls 48 px.
4. **Findings in neutral ink.** "May not fit", "few of this trial's rules", a marked trial and errors are told apart by words and position, never by colour or weight.
5. **The fonts bundled:** IBM Plex Sans, IBM Plex Mono and Atkinson Hyperlegible as WOFF2, each with its `OFL.txt`, served by the local server. The page requests nothing off the machine.
6. **The Record mark and "Trial Finder"** in the header, with the favicons and app icons.
7. **AA contrast held,** in light and dark (OQ 4).
8. **Screenshots in the README,** two or three, made from `npm run app -- --fake` with made-up answers, reproducibly (OQ 5).
9. **Written up:** `docs/page.md`, the roadmap row, and `CLAUDE.md` if a command or a boundary changes.

## Affected users and systems

- **A person using the page:** the same conversation, list, sheet and check, easier to read, on a phone as well as a laptop, in dark mode if their system is.
- **Their oncologist:** the printed sheet and records, in the new type, still on plain paper in black.
- **The page** (`src/web/`): the stylesheet, components' markup and class names, `index.html` for the icons. `copy.ts` only where a design needs a sentence it doesn't have, and each new one through the verdict scan.
- **The server** (`src/server/`): serving the fonts and icons from `dist/web/`, on 127.0.0.1, as now.
- **The browser test** (`e2e/`): selectors that follow the new markup; the visible-text verdict scan unchanged.
- **The README,** with screenshots and "Trial Finder".
- **Not touched:** the search, the facts, the questions and the reader, the order, the sheet's and record's content, the check, the models and Settings' behaviour, every result in `evals/results/`. The prescreening repository is not changed by this slice.

## Constraints

- **Nothing on the page changes what a finding is.** No colour, icon or weight follows whether a rule may not fit. No "eligible", "qualified", "match", score or ranking, in the design or the copy. The note that the order isn't a ranking stays.
- **No network at runtime.** Fonts and icons are bundled and served from this machine; no CDN, no Google Fonts. The font files are downloaded once by a person and committed, like the snapshot; nothing fetches them at build or run time.
- **WCAG AA in light and dark,** for text and for controls' borders, and on the printed page.
- **Dependencies stay small.** Adding a font package from npm is a plan-level decision (OQ 3).
- **Designs are accepted before they're built.** The Claude Design pass ends with the owner, before the spec. Where a design and Chart v2's `components.css` disagree, the plan says which wins and why.
- **The page's words stay unless a design needs a new one,** and every fixed sentence stays in `copy.ts`.
- **No PHI.** Screens are designed and screenshotted with made-up answers only, from `--fake` or the committed made-up patients.
- **No model run is needed.** The slice spends no local or hosted model time; `--fake` is enough to build and photograph every screen.
- **Months, not days.** No tool attribution in commits or the PR.

## Open questions

1. **What goes to Claude Design, and how does it come back?**
   - The four screens are named. The questions screen and Settings are close to prescreening's screening chat and settings, but not the same: the finder's questions offer answers as buttons and confirm a typed reading.
   - The designs need the finder's real content to be right: a full trial card, a record with every section, a sheet with open questions.
   - **Leaning:** send all six screens, the four new ones designed and the questions screen and Settings adapted, with real copy from `copy.ts` and one made-up patient's list, sheet and record from `--fake`. The result comes back as a second handoff, committed under `work/0011-finder-design/design/` with its references, so the spec cites a fixed version.
2. **How does the record show five sections in Chart v2's pattern?**
   - Chart v2's review has a sticky summary of four counts and `<details>` groups. The finder's record is read by the person, then printed for the oncologist, and its "About the trial, not you" is folded.
   - **Leaning:** the same pattern with the finder's five sections and words: counts as the only summary, rules in protocol order within a section, findings in neutral ink. The design decides whether the summary sits beside or above on desktop.
3. **Where do the fonts come from?**
   - `FONTS.md` names the IBM Plex releases or the `@ibm/plex-sans` and `@ibm/plex-mono` npm packages, and the Braille Institute or Google Fonts' repository for Atkinson Hyperlegible.
   - **Leaning:** the owner downloads the eight WOFF2 files once and they're committed with their licences, under `src/web/fonts/`. No npm package: it would be a dependency for eight files. If only TTF is available for Atkinson, converting it is a step the owner runs.
4. **How is AA held?**
   - The handoff's ratios are computed from its hex values; the finder may add colours.
   - **Leaning:** a deterministic test in `tests/` that reads the tokens, light and dark, and checks each text and control pair the page uses against AA. The browser test checks dark mode renders. A human look at both themes is part of the owner's gate.
5. **How are the screenshots made?**
   - **Leaning:** a script a person runs, driving Playwright against `npm run app -- --fake` with a committed made-up patient, writing two or three light-mode PNGs (a question, the short list, a record) to a folder the README links. Not part of `npm test` or the browser test.
6. **Which empty, waiting and failed states are designed?**
   - "Reading the rules of …" while a trial parses, no model reachable, a reply that can't be read, a list with no trials, and a failed **Check these**, which today says nothing.
   - **Leaning:** all of them, as states of the six screens. A failed **Check these** gets a sentence in `copy.ts`: the one change in behaviour this slice makes, and named as such.
7. **Does the finder share code or assets with prescreening?**
   - The owner sees the two products working together, possibly as one product over separate repositories.
   - **Leaning:** not in this slice. The tokens, components and mark are copied in from the handoff, and a shared package is a later question.
8. **What does the gate look at?**
   - **Leaning:** two gates. The designs, before the spec. Then the built page, in light and dark, on desktop and phone, for one made-up patient end to end, before the README's screenshots and the docs.
