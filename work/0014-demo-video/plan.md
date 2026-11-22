# plan: 0014 demo video

**Status:** Draft
**Date:** 2026-11
**Intent:** [intent.md](intent.md), committed as `0014 intent`. **Spec:** [spec.md](spec.md), committed as `0014 spec`.

## Context

The README tells the finder's story in words, numbers and three still images (slice 0013), but nothing shows the page moving. The owner wants to promote the GitHub page, and a short loop shows "it's real and it works" faster than a paragraph. This slice adds a silent, light, ~36-second GIF of made-up patient p08 near the top of the README, recorded by Playwright against `npm run app -- --fake` beside the screenshots, and turned into `docs/images/demo.gif` (under 5 MB) by a script ported from the sibling repository, using `ffmpeg`. No file under `src/`, `evals/` or `data/` changes, no model runs, and no npm dependency is added.

## Order of work

### Stages and gates

| Stage | Steps | Ends at | What you can see at the end |
| --- | --- | --- | --- |
| **A. Build the tooling** | 1–3 | — | `scripts/make-demo.ts` and its test; the capture `e2e/screenshots/demo.shots.ts`; the boundary rule; `npm run demo` in `package.json`. All committed. |
| **B. Make the GIF** | 4–5 | **Gate 1** | `docs/images/demo.gif`, the README with it, and `docs/demo.md`'s link line, **written and left uncommitted**; `work/0014-demo-video/gate-1-watch.md` committed, with the GIF's size, width, frame rate and length |
| **C. Land** | 6–8 | PR | the GIF, README and `docs/demo.md` committed; `docs/page.md`, `CLAUDE.md`, the roadmap; review passes |

**No model run, no spend, no network.** Everything records from `--fake`. `ffmpeg` is a tool on the machine (`/opt/homebrew/bin/ffmpeg`), not an npm dependency (spec Concern 1, accepted with the spec).

**Stage A needs no gate.** It's code with tests, committed through `npm run check`; nothing downstream is costly until a GIF is committed.

**Gate 1: is this GIF worth putting in the history for good?** (spec §10)
- **What's decided:** whether the loop is readable at the width the size steps landed on (the record's text is the test), honest about scripted mode (the caption), paced so each beat can be followed, and worth its size; whether the two fast-forward captions and the three shown questions are right.
- **What the owner sees:** `gate-1-watch.md`, which says how to look at the README with the GIF: the worktree's README in a Markdown preview, or the branch pushed and viewed on GitHub (owner's choice; a push needs their go-ahead). It lists the GIF's bytes, width, fps and length; the beat timings as cut; any capture warnings; and anything wrong on the page the recording showed (not fixed, spec §11).
- **What it costs to be wrong:** stage C commits a binary of up to 5 MB that stays in the history forever; every retake after that adds the same again. Before the gate, a retake costs only a rerun.
- **Can be no:** "retake", with what to change (pacing, holds, captions, questions, width). Steps 3–4 are amended, the capture and `npm run demo` rerun, `gate-1-watch.md` updated, and Gate 1 comes again. A retake that changes the capture's code is committed as `0014 step 3: revised` before the new GIF is shown.

**Stage C needs no gate.** It commits what Gate 1 accepted and records it.

### Steps

**Rules for every step:**
- Commit through `npm run check && git commit ...`, one step per commit, message `0014 step N: <what>`. No tool attribution.
- Months, not days. No PHI: p08 is made up.
- If a step can't be done as written, `plan.md` is updated in the same commit.
- Nothing under `src/`, `evals/`, `data/` changes; `playwright.config.ts`, `playwright.screenshots.config.ts`, `e2e/screenshots/readme.shots.ts` and the three PNGs don't either. A page fault the recording shows goes in `gate-1-watch.md` and the PR's follow-ups.

**Step 1. `scripts/make-demo.ts` and its test** (spec §4). Commit: `0014 step 1: make-demo script`.
- Port the sibling's `scripts/make-demo.ts` (read with `gh api repos/eschraufnagel/trial-prescreening-agent/contents/scripts/make-demo.ts -H "Accept: application/vnd.github.raw"`, and its test at `tests/scripts/make-demo.test.ts` the same way), with these changes:
  - `Mark.label` is `"fast-start" | "fast-end"`; `cutsFromMarks` speeds each marked span to last `FAST_SECONDS = 2.5`; error text says "a fast-forward's start and end".
  - `CUTS_FILE` is `e2e/.out/demo/cuts.json`; `OUT` is `docs/images/demo.gif`.
  - `ATTEMPTS` and `MAX_BYTES` (5 × 1024 × 1024) as the sibling's: 12 fps/960, 10/960, 10/800, 10/720.
  - `--mp4`: after the GIF, also write `e2e/.out/demo/demo.mp4` with the same cuts (`-c:v libx264 -pix_fmt yuv420p -crf 23 -movflags +faststart`, `scale=960:-2`, no palette steps). A pure `mp4Args(...)` or a variant of `filterGraph` makes this testable.
  - `--offset <s>` and `requireFfmpeg()` as the sibling's.
  - After writing, print bytes, fps, width and the cut total length (sum of `(to - from) / speed`), which `gate-1-watch.md` records. A pure `cutLength(cuts)` exports it.
  - Header comment says what it does, that `ffmpeg` is a system tool needed for this only, and no network, no model. Imports `node:` modules only.
- `tests/scripts/make-demo.test.ts`: `cutsFromMarks` (no marks → one piece; one fast-forward → three pieces, the middle sped to 2.5 s; marks out of order or unpaired → throws; a mark at the very start or end); `filterGraph` (trims and speeds in order, offset applied and clamped at 0, palette steps present, scale width); `cutLength`; the MP4 arguments. No `ffmpeg` is run.
- `package.json`: `"demo": "node --import tsx scripts/make-demo.ts"`.

**Step 2. The boundary rule** (spec §9). Commit: `0014 step 2: make-demo reaches nothing in the repository`.
- In `tests/boundary.test.ts`, after the slice 0010 `criteria:compare` block, a `describe("make-demo imports nothing from the repository", …)` in the same style: `reachableModules(scripts/make-demo.ts)` equals the script alone (so it reaches no model, no parser, no registry, nothing in `src/` or `evals/`); "walks a real graph" (the entry is in it); "touches no network" via `findNetworkUsage` on the script; "would catch it": a helper `importsLocal(source)` (relative `from` after `stripTypeOnlyImports(stripComments(...))`) is true for `import { x } from "../src/models/index.js";` and false for `import { execFileSync } from "node:child_process";`, and the script's own source gives false. A comment says why: it calls `ffmpeg` and writes a file, and nothing more.

**Step 3. The capture** (spec §2, §3). Commit: `0014 step 3: demo capture`.
- New `e2e/screenshots/demo.shots.ts`, one `test("the README's demo", async ({ browser }) => …)`, picked up by `playwright.screenshots.config.ts` (`testMatch: "*.shots.ts"`, `workers: 1`). Raise this test's timeout with `test.setTimeout(180_000)`.
- Context: `browser.newContext({ baseURL: test.info().project.use.baseURL ?? "", viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, colorScheme: "light", recordVideo: { dir: "e2e/.out/demo/video", size: { width: 1280, height: 800 } } })`. Before starting, remove `e2e/.out/demo/` so an old cut list can't survive a failed run.
- Timing: `t0 = Date.now()` right after `newPage()`; `marks.push({ at: (Date.now() - t0) / 1000, label })`. `hold(ms)` is `page.waitForTimeout(ms)`.
- Reuse `search`'s logic but typed: a local `typedSearch(page, p08)` that does what `search` in `e2e/lib/page.ts` does, with `pressSequentially(..., { delay: 60 })` for ZIP and age and a short hold after each radio. `lastQuestion`, `shortlistIds`, `expectNoVerdict` from `e2e/lib/page.ts`; `patient("p08")`, `replyTo` from `e2e/lib/patients.ts`; `COPY` from `src/web/copy.ts`.
- **Typed question** (beats 2, 3, 5): `pressSequentially(reply, { delay: 30 })` into `COPY.conversation.reply`, click `COPY.conversation.send`, wait for "That's right", hold 1,800 ms on the reading, click it, wait for the next question, hold 600 ms.
- **Fast question** (inside a fast-forward): `fill` and click, wait as `answer()` does in `readme.shots.ts`, then a 400 ms hold on the reading and another on the next question (`FAST_HOLD`). *Revised after the first run:* with no holds the 7 and 6 questions took 1.3 s and 1.1 s, under `FAST_SECONDS`, so nothing was sped up and the questions flashed past; with the holds they're sped up about 2.8× and 2.4×, and the loop is 36.2 s.
- **Which questions are typed:** count questions as they're asked. Questions 1 and 2 typed; then a fast-forward until the question asked is the one whose words match the vocabulary fact for the lining of the brain or spinal cord (find its question text through `replyTo`'s vocabulary, i.e. by matching the fact's `question`; if it's never asked, the fast-forward runs to the list and `gate-1-watch.md` says so); that one typed; then a fast-forward to **See your list**. The caption's count is the number of questions answered inside that fast-forward, counted while it runs.
- **Caption** (spec §3.2): `caption(page, text)` adds `<div id="demo-caption">` with `page.evaluate`, fixed bottom-centre, using the page's CSS variables for ink, surface and font (read the variable names from `src/web/` styles while writing; fall back to plain black on white with a border if none fit), and `uncaption(page)` removes it. Caption text is `${n} more questions, sped up`, set after the fast-forward knows `n`: so add the caption with "More questions, sped up" at the start, and update its text to the count when done, then hold 500 ms and remove it. Before showing any caption, assert none of `VERDICT_PATTERNS` (`src/shortlist/words.ts`) matches the text. Marks bracket the fast-forward excluding that final 500 ms hold.
- **List** (beats 7–8): click **See your list**, `shortlistIds`, scroll to top, hold 2,500 ms; `expectNoVerdict(page)`; open the first card (`COPY.list.open`, `.first()`), hold 1,500 ms, `mouse.wheel` down ~300 px in two steps with holds, hold 1,500 ms.
- **Check** (beat 9): tick the first card's `COPY.list.tick` checkbox, hold 600 ms, `COPY.list.checkThese`; wait for the first check question; hold 1,500 ms on the opening line; tap **Yes**, **I don't know**, **I don't know** with 700 ms holds (by role and name, as `readme.shots.ts` does for "I don't know"); click `COPY.check.stop`.
- **Record** (beat 10): wait for `COPY.check.print`; scroll `.record` into view at the top; assert `.record .notice-lead` is visible and non-empty; `expectNoVerdict(page, …)` with the same leave-out the browser test uses on the record; hold 4,000 ms.
- **End:** `const video = page.video()`; `await context.close()`; `const end` = seconds at close; write `e2e/.out/demo/cuts.json` as `{ video: await video.path(), cuts: cutsFromMarks(marks, end) }` (import from `../../scripts/make-demo.js`). Trim the first second of blank load: if the first mark is later than 1 s, the cut list starts at the moment the form is first visible (record that moment as `start` and pass cuts from it; `cutsFromMarks` takes an optional start, added in step 1 if needed and tested there).
- Run `npm run screenshots` once and check: the three PNGs are byte-identical to `main` (`git status docs/images` clean), `cuts.json` exists, its total length is 30–40 s. If the walk runs long, shorten holds first, then drop beat 5 (spec §2 allows it), and record which in `plan.md`.

**Step 4. Make the GIF and place it.** Written, **not committed until Gate 1**.
- `npm run demo`. If over 5 MB at 720 px, shorten holds in step 3 (amend, recommit step 3 as `revised`) before anything else.
- Watch it (open the GIF in a browser via the preview pane or Quick Look) for: the caption readable, the record's notice readable, no flash of an unstyled page, the loop seam at the empty form. If the video lags the marks visibly, rerun with `--offset`.
- `README.md`: insert spec §6's image line and italic caption, word for word, after the paragraph "Every stage is measured. …" and before `## The problem`, with a blank line either side.
- `docs/demo.md`: under the opening paragraph, one line: "The [README's loop](../README.md) shows the same walk in about 35 seconds." (adjust "35" to the cut length, rounded to 5).

**Step 5. The gate page.** Commit: `0014 step 5: Gate 1 page`.
- `work/0014-demo-video/gate-1-watch.md`: how to view (local preview, or push on go-ahead); the GIF's bytes, width, fps, length (from `npm run demo`'s output); the beat timings as cut; the caption and alt text word for word; any page fault the recording showed; any departure from spec §2 (a dropped beat).
- Stop at Gate 1.

**Step 6. Commit what Gate 1 accepted.** Commit: `0014 step 6: the README's demo` (the GIF, README and `docs/demo.md` together, since the README's image needs the file).

**Step 7. Docs, `CLAUDE.md` and the roadmap** (spec §9). Commit: `0014 step 7: demo command, roadmap row`.
- `docs/page.md`'s command block: `npm run screenshots` line becomes "the README's three images and the demo's recording, on --fake"; add `npm run demo             the README's loop, from that recording; needs ffmpeg`.
- `CLAUDE.md` "Verifying your work": the `npm run screenshots` row as spec §9 words it; a new `npm run demo` row after it, as spec §9 words it. Under the boundary list, a line: "Since slice 0014, it also keeps `scripts/make-demo.ts` to Node's own modules: it reaches nothing in the repository and no network."
- `work/ROADMAP.md`: the opening line's done list gains 0014; a 0014 row: "**Done.** A ~35-second loop near the top of the README of p08 on `--fake`, from the start form to a checked trial's record, made by `npm run screenshots` then `npm run demo` ([docs/page.md](../docs/page.md))", measured by "the capture's own checks and the owner's watch at Gate 1", model "No".

**Step 8. Review passes and the PR.** Commit: `0014 step 8: review passes` (Records filled).
- Run `REVIEW.md`'s passes on the diff against `main`; record findings; fix Importants.
- Push and open the PR only on the owner's go-ahead. The PR says Gate 1 was held, gives the GIF's size, lists page faults and the narrated walkthrough as follow-ups, and carries no tool attribution.

## Files that change

| File | Step | Change |
| --- | --- | --- |
| `scripts/make-demo.ts` | 1 | new |
| `tests/scripts/make-demo.test.ts` | 1 | new |
| `package.json` | 1 | `demo` script |
| `tests/boundary.test.ts` | 2 | one `describe` block |
| `e2e/screenshots/demo.shots.ts` | 3 | new |
| `docs/images/demo.gif` | 4 (committed in 6) | new, ≤ 5 MB |
| `README.md` | 4 (committed in 6) | image and caption |
| `docs/demo.md` | 4 (committed in 6) | one line |
| `work/0014-demo-video/gate-1-watch.md` | 5 | new |
| `docs/page.md`, `CLAUDE.md`, `work/ROADMAP.md` | 7 | commands, boundary line, row |
| `work/0014-demo-video/plan.md` | 8 | Records |

## Reused, not rebuilt

- The sibling's `scripts/make-demo.ts` and its test, ported, not re-derived.
- `playwright.screenshots.config.ts` as it is: its `--fake` server on port 5045, already held by `tests/boundary.test.ts`.
- `search`, `lastQuestion`, `shortlistIds`, `expectNoVerdict` (`e2e/lib/page.ts`); `patient`, `replyTo` (`e2e/lib/patients.ts`); the walk in `e2e/screenshots/readme.shots.ts`; `COPY` (`src/web/copy.ts`); `VERDICT_PATTERNS` (`src/shortlist/words.ts`).
- `reachableModules` and `findNetworkUsage` in `tests/boundary.test.ts`.
- p08 and TAPUR, as `docs/demo.md` already walks them.

## Risks

- **The walk runs long.** 16 questions plus the check; holds are the lever, then dropping beat 5. Measured in step 3 before any GIF is made.
- **Over 5 MB.** Text-heavy frames compress less well. Size steps first, then shorter holds; the gate sees the width it landed on.
- **Video and marks out of step.** Playwright's video starts at page creation; `t0` is taken right after `newPage()`. `--offset` corrects a visible lag.
- **Q10 isn't asked of p08** in some order change. The capture handles it (fast-forward to the list) and the gate page says so.
- **The record's text is unreadable at 720–960 px.** That's Gate 1's question; a retake could crop to the record's column for the last beat, recorded as a departure.
- **Running `npm run screenshots` rewrites the PNGs.** They're deterministic; step 3 checks they're byte-identical. If they differ, they're left uncommitted and the difference goes on the gate page; remaking them is out of scope.
- **0012 and 0014 both touch the roadmap and `CLAUDE.md`.** A small merge conflict, resolved by whichever lands second.

## Verification

- `npm run check` exits 0 before every commit; `tests/scripts/make-demo.test.ts` runs in it with no `ffmpeg`.
- The boundary block (step 2) passes, and would fail if the script imported anything local (its "would catch" case: a source string with a relative import gives a non-empty reach).
- `npm run screenshots` passes: the capture's checks (no verdict words on the list and record, the notice visible, captions clean) and the stills unchanged.
- `npm run demo` prints a size ≤ 5 MB and a length of 30–40 s.
- `npm run test:e2e` still passes (the capture isn't in its `testDir`).
- `git diff --stat main` at step 8 shows nothing under `src/`, `evals/`, `data/`, and no change to either Playwright config or `readme.shots.ts`.
- The owner watches the GIF in the README at Gate 1.

**Spec requirements to steps:** R1 → 3; R2 → 1, 4; R3 → 3, Gate 1; R4 → 4, 6; R5 → 7; R6 → 2, 3 (config already `--fake`); R7 → 3; R8 → p08 only, Pass 3; R9 → 1 (test runs no `ffmpeg`); R10 → Verification's diff.

## Departures from the spec

- **The capture's start is trimmed** to when the form is first visible (step 3), so the loop doesn't open on a blank frame. Not in the spec; doesn't change what's shown.
- **`cutsFromMarks` may take an optional start** for that trim. A small addition to the ported function, tested.

## Records

(Filled at step 8.)
