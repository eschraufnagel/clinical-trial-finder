# spec: 0014 demo video

**Status:** Draft
**Date:** 2026-11
**Intent:** [intent.md](intent.md), committed as `0014 intent`.

A silent, looping GIF of about 35 seconds goes near the top of the README: made-up patient p08 fills in the start form, answers three questions in his own words and confirms each reading, then his list arrives, the first trial's card opens, that trial is checked, and the top of its record holds on screen. It is recorded by Playwright against `npm run app -- --fake`, beside the screenshots, and a script ported from the sibling repository turns the recording into `docs/images/demo.gif` with `ffmpeg`, under 5 MB. No product code, result or data file changes. The narrated walkthrough is left for later.

---

## 1. What exists at the end

- **`docs/images/demo.gif`:** the loop (§2), light, under 5 MB (§5).
- **`e2e/screenshots/demo.shots.ts`:** the capture (§3). It records the walk and writes a cut list to `e2e/.out/demo/cuts.json`. Run by `npm run screenshots`, with the three still images.
- **`scripts/make-demo.ts`:** turns the recording into the GIF (§4). `npm run demo`.
- **`tests/scripts/make-demo.test.ts`:** the script's cut and filter logic, with no `ffmpeg` (§8).
- **`README.md`:** the GIF and its caption after the opening paragraphs (§6).
- **`docs/demo.md`:** one line at the top linking the loop (OQ 5).
- **`docs/page.md`:** `npm run demo` beside `npm run screenshots` in its command block.
- **`CLAUDE.md`:** `npm run demo` in "Verifying your work", and the screenshot row says it records the demo too (§9).
- **`package.json`:** the `demo` script. No new dependency.
- **The roadmap:** a 0014 row.

Not changed: `src/`, `evals/`, `data/`, `playwright.config.ts`, `playwright.screenshots.config.ts`, `e2e/screenshots/readme.shots.ts`, the three still images, every committed result.

## 2. What the loop shows

The walk is `docs/demo.md`'s, shortened. Target length 30 to 40 seconds after cutting; each beat below says roughly how long it plays.

| # | Beat | Plays | How |
| ---: | --- | ---: | --- |
| 1 | The start form, empty, then ZIP 97201, age 69, 50 miles, Male typed and ticked; **Start the questions** | ~4 s | typed at reading pace |
| 2 | Q1, "What type of lung cancer cell did the biopsy show?": `Adenocarcinoma.` typed, **Send**, the reading shown, **That's right** | ~4 s | typed, held on the reading |
| 3 | Q2, how far it has spread: `Spread to the adrenal gland and the bones.`, reading, **That's right** | ~4 s | typed, held on the reading |
| 4 | Q3 to Q9, sped up | ~2.5 s | a fast-forward, with a caption (§3.2) |
| 5 | Q10, the lining of the brain or spinal cord: `Don't know.`, read as "you don't know", **That's right** | ~4 s | typed, held: "I don't know" is an expected answer |
| 6 | Q11 to Q16, sped up, then **See your list** | ~2.5 s | a fast-forward, with a caption |
| 7 | The list: the note that the order isn't a ranking, ten cards | ~3 s | held at the top |
| 8 | The first card, TAPUR (NCT02693535), opened: nearest site, what was checked against his answers, what's unknown | ~4 s | opened, scrolled gently |
| 9 | **Check this trial** ticked, **Check these**; the check opens with how many rules his answers already covered; **Yes**, **I don't know**, **I don't know**; **Stop and show the record** | ~4 s | tapped at a steady pace |
| 10 | The record's top: the summary column, "This isn't a decision", the first sections | ~4 s | held, so the notice can be read |

About 36 seconds. The loop restarts at the empty form.

**Why these three questions (beat 2, 3, 5).** Q1 and Q2 are the first a person meets and show the confirm step twice; Q10 shows "I don't know" being taken as an answer, the guardrail the README states second. The rest are fast-forwarded, not hidden. A later gate can drop beat 5 and merge beats 4 and 6 into one fast-forward if the loop runs long.

**Why TAPUR.** It's trial 1 on p08's list and has a committed parse, so it can be checked in scripted mode, as `docs/demo.md` §6 and `readme.shots.ts` already use it. Trial 6, whose record has the known fault (0013 Records), isn't shown.

## 3. The capture

### 3.1 Where and how

**`e2e/screenshots/demo.shots.ts`,** a second test in the screenshot run, so it runs under `playwright.screenshots.config.ts`, which `tests/boundary.test.ts` already holds to `--fake`. No new Playwright config, so the boundary test needs no new entry.

- Its own browser context, `browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: "light", recordVideo: { dir, size } })`, at **1280×800**, the sibling's size. 16:10 suits a README banner better than the stills' 1280×900, and the beats above fit in it with gentle scrolling.
- It drives p08 with the helpers in `e2e/lib/page.ts` and `e2e/lib/patients.ts`, the same replies `readme.shots.ts` uses. Typed beats use `pressSequentially` with a key delay (about 30 ms) instead of `fill`, and `page.waitForTimeout` holds each screen. Fast-forwarded questions use `fill` and no holds.
- It notes **marks**, seconds from the context's start, where each fast-forward begins and ends, and writes `{ video, cuts }` to `e2e/.out/demo/cuts.json` after the context closes (the video's path is known only then). `e2e/.out/` is gitignored.
- It checks what it records: `expectNoVerdict` on the list and the record, and that the record's "This isn't a decision" notice is visible before the final hold. A capture that fails these writes no cut list.

`npm run screenshots` runs both tests, so the stills and the recording are always made from the same page. Recording costs a few seconds and touches nothing committed; the GIF is only rewritten by `npm run demo`, run deliberately (§4).

### 3.2 The fast-forward caption (OQ 6)

**Proposed, a departure from the intent's leaning.** The intent leaned against caption frames, as a second thing to keep in sync. The sibling's capture shows a better way: a caption is a small fixed box the capture adds to the page with `page.evaluate` for the length of a fast-forward, and removes after. It lives in the capture's own code, so it can't drift from the walk, and it is never part of the page's source. Without one, a viewer sees answers flash past with no idea how many or why.

- Two captions: "7 more questions, sped up" and "6 more questions, sped up". The counts come from the walk itself, not from constants, so a change in the questions changes the caption.
- Styled from the page's own tokens (its ink and surface colours, its font), bottom centre, so it reads as part of the recording and not as a product screen.
- Caption words are checked against `VERDICT_PATTERNS` in the capture, as the page's words are.

If the owner prefers no captions, the fast-forwards stay and the README caption says "most questions are sped up", which it says either way (§6).

## 4. Making the GIF

**`scripts/make-demo.ts`,** ported from the sibling's (`eschraufnagel/trial-prescreening-agent`, `scripts/make-demo.ts`, slice 0016 there), with the same shape:

- `cutsFromMarks(marks, end)`: pieces at speed 1 outside the marks, and each fast-forward sped up to last **2.5 s** (the sibling's waits last 0.6 s; a fast-forward should be visibly one, not a jump).
- `filterGraph(cuts, fps, width, offset)`: `ffmpeg` trims, speeds and joins the pieces, scales with Lanczos, and makes a palette from the recording (`palettegen=stats_mode=diff`, `paletteuse` with Bayer dither), looping forever.
- **Size steps:** 12 fps at 960 px, then 10 fps at 960, then 10 at 800, then 10 at 720, stopping at the first under 5 MB; still over at 720 is an error saying to shorten the walk.
- `--offset <s>` shifts every cut, if the video lags the marks.
- It checks `ffmpeg` is on the path and says how to install it if not.
- No network, no model, and no import from `src/`: Node's built-ins only.

Mark labels are `"fast-start"` and `"fast-end"`, not the sibling's `"wait-start"`/`"wait-end"`, since nothing here waits.

**`ffmpeg` is a system tool, not a dependency** (Concern 1). It's installed on this machine with Homebrew. Nothing under `tests/` calls it, so `npm test` passes from a fresh clone without it; only `npm run demo` needs it. `gifski` makes better GIFs but isn't installed and isn't needed.

## 5. Format, size and place (OQ 1, OQ 2, OQ 3)

- **GIF, committed, at `docs/images/demo.gif` (OQ 1).** It plays inline on GitHub, in a clone's Markdown preview and in a fork, loops by itself, and matches the sibling. An MP4 plays inline in a README only as an uploaded attachment, which lives on GitHub, can't be remade by a script and committed, and isn't in a clone. `npm run demo -- --mp4` also writes `e2e/.out/demo/demo.mp4` (H.264, a fraction of the size) for the owner to upload elsewhere if they want one; it's never committed.
- **Under 5 MB, 720 to 960 px wide (OQ 2).** GitHub shows a README at up to about 880 px wide, so 960 px is shown slightly scaled down and 720 px nearly full size. The record's text is the smallest that matters; the gate checks it's readable at whatever width the size steps land on.
- **Light only (OQ 3),** as the stills and the sibling. A second, dark GIF behind `<picture>` would double the binary cost for a reader on a dark theme who sees the light page anyway in the stills.

**The cost in history.** The repository's packed size is about 26 MB today. Each committed GIF adds up to 5 MB that stays forever, including every remake. So the GIF is committed once, after the gate (§10), and remade only when the page visibly changes, as its own commit.

## 6. The README

Placed after the two opening paragraphs (the one-sentence description and "Every stage is measured"), before "## The problem", as the sibling places its demo after its opening:

```markdown
![Made-up patient p08 answers a few questions in his own words and confirms each reading, then his short list appears, a trial's card is opened and checked, and its record says it isn't a decision.](docs/images/demo.gif)

*The page in its scripted mode, with made-up answers. Each typed reply gets the local model's recorded reading of it, and the check replays a recorded reading of the trial's rules. Most questions are sped up.*
```

- The caption follows the sibling's ("The real assistant, running on a local model, with made-up answers. Waits for the model are shortened.") in length and form, and says the truth about scripted mode: no model runs during the loop, but the readings shown are the model's, recorded.
- The three stills stay under "What it does" (OQ 7). They give a reader time with each screen and work where a GIF doesn't play.
- Nothing else in the README changes.

## 7. The narrated walkthrough (OQ 4)

**Not in this slice.** `docs/demo.md` already holds the talking points, so the owner can narrate from it today. A timed narration script makes sense once the owner knows where a narrated video would be posted, since a narrated MP4 has the same hosting problem as §5. Listed as a follow-up in the plan's records.

**`docs/demo.md` links the loop (OQ 5):** one line under its opening paragraph, "The README's loop shows the same walk in about 35 seconds", linking `../README.md`.

## 8. Requirements

**It does:**
- R1. `npm run screenshots` records the walk in §2 from `--fake` and writes `e2e/.out/demo/cuts.json`, alongside the three stills, unchanged.
- R2. `npm run demo` writes `docs/images/demo.gif` from that recording, under 5 MB, looping, 30 to 40 seconds long.
- R3. The loop shows the confirm step at least twice, an "I don't know" taken as an answer, the list's note that the order isn't a ranking, an opened card, a check, and the record's "This isn't a decision", held long enough to read.
- R4. The README shows the GIF with alt text and the caption in §6.
- R5. Remaking the GIF after a page change is `npm run screenshots` then `npm run demo`, documented in `CLAUDE.md` and `docs/page.md`.

**It never does:**
- R6. Reach a model or the network while recording or making the GIF.
- R7. Show any word on screen or in a caption that says or suggests the person is eligible, matched, or ranked; the capture fails if `expectNoVerdict` or the caption check finds one.
- R8. Show anything that isn't made up.
- R9. Need `ffmpeg` for `npm test` or `npm run check`.
- R10. Change the page: no file under `src/` changes.

**Measured by:** the capture's own checks (R3, R7), the script's size check (R2), `tests/scripts/make-demo.test.ts` (the cut and filter logic), and the owner watching the GIF at the gate. No model, no `--spend`.

## 9. Design and boundaries

- **Code goes where `CLAUDE.md` says:** the capture under `e2e/screenshots/`, the script under `scripts/`, its test under `tests/scripts/`.
- **The capture imports `cutsFromMarks` from `scripts/make-demo.ts`,** as the sibling's does. `scripts/` is never imported by the application; `e2e/` isn't the application.
- **`tests/boundary.test.ts`:** no rule is widened. The screenshot config is already held to `--fake`. **Proposed, one small addition:** a rule that `scripts/make-demo.ts` imports only `node:` modules, so it can never reach a model, the network module or the registry, in the style of the 0008 to 0010 rules for other scripts. The plan can drop it if it's ceremony.
- **`CLAUDE.md`:**
  - the `npm run screenshots` row becomes "the README's three images into `docs/images/`, and the demo's recording into `e2e/.out/demo/`, from `npm run app -- --fake` on port 5045; never part of `npm test` or `test:e2e`";
  - a new row: "`npm run demo` | the README's loop, `docs/images/demo.gif`, from the last `npm run screenshots`; needs `ffmpeg` on the path; `-- --offset <s>`, `-- --mp4`. No network, no model";
  - if the boundary rule above is added, a line under "Since slice 0014".

## 10. Gates (OQ 8)

**One gate, before the GIF is committed: the owner watches it in the README.** The README with the GIF is previewed locally (a Markdown preview of the worktree) or on the pushed branch, since a private repository's branch page shows it to the owner.

- **What's decided:** whether the loop is legible at the width it landed on, honest about scripted mode, and worth its size; and whether the captions (§3.2) and the three questions (§2) are right.
- **What being wrong costs:** a committed GIF stays in the history for good, and each retake adds up to another 5 MB. Retakes before the gate cost nothing, since the GIF lives uncommitted until then.

The capture, the script and its test are committed before the gate; the GIF, the README and `docs/demo.md` after.

## 11. Out of scope

- Any change to the page, including anything the recording shows that should be fixed; it goes on a list in the PR.
- The narrated walkthrough (§7).
- A dark GIF, an MP4 in the README, or a hosted video.
- Remaking the three still images.
- Making the repository public.
- The breast-cancer work (0012) and the sibling repository.

## Concerns for the owner

1. **`ffmpeg` becomes a tool the repository uses** (§4). Not an npm dependency and not needed for `npm test`, but `npm run demo` fails without it. The sibling made the same choice. **You're deciding** whether that's acceptable here.
2. **The fast-forward captions depart from the intent's leaning** (§3.2, OQ 6). The intent said no caption frames; the spec proposes two short in-page captions that live in the capture's code and so can't drift. **You're deciding** captions or none.
3. **This reverses 0013's "no GIF".** 0013 leaned against it until the repository went public, and it's still private. A GIF in a private README promotes nothing until visibility changes, which stays your call outside this slice. **You're deciding** whether to make the GIF now regardless.
4. **The GIF adds up to 5 MB to the history** for good, about a fifth of today's packed size, and the same again at each remake (§5). **You're deciding** whether that's a fair cost, and the spec proposes remaking only when the page visibly changes.
5. **1280×800, not the stills' 1280×900** (§3.1). The loop is framed as a banner, like the sibling's; the stills keep their size. A small inconsistency, flagged so it's a choice.
