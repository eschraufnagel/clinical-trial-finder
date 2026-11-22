# intent: 0014 demo video

**Author:** the repository owner
**Status:** Draft
**Date:** 2026-11
**Scope:** A short, silent, looping recording of the page near the top of the README, made by a script from the page's scripted mode, and the decisions around it: format, size, where it lives, and whether a longer narrated walkthrough belongs here. No product code changes, and no new measurement.

---

## In plain words

The README now tells the story well: the problem, what the finder does, the lines it never crosses, six measured results and a diagram (slice 0013). What it can't do in still images is show the thing moving: a person typing a reply in their own words, the page saying how it read it, the person confirming, and a short list arriving at the end.

The owner wants to promote the GitHub page, and a short video says "this is real and it works" faster than any paragraph. This slice adds a 20 to 40 second silent loop near the top of the README, following made-up patient p08 from the start form through a few questions to his list, one card opened, and a checked trial's record. It is made by a script, the way the screenshots are, so it can be remade when the page changes rather than re-recorded by hand.

A longer narrated walkthrough, in the owner's own voice over `docs/demo.md`, may follow. The slice can supply its timing and captions. It can't supply the voice.

**What would make it not worth doing.** If the loop shows more than the product does. It runs in scripted mode, so the caption has to say what that means. If it skims past the "not a decision" notice, or makes the list look like a ranking or a verdict, it oversells, and a still image is better.

## Problem

**The README has no motion.** Three still images (`docs/images/question.png`, `list.png`, `record.png`, made by `npm run screenshots`) sit under "What it does". They show what the screens look like, not that a conversation happens: the typed reply, the reading, the confirm step and the list that follows.

**The sibling repository already has one.** `eschraufnagel/trial-prescreening-agent` puts `docs/images/demo.gif` (about 4.8 MB) right after its opening paragraph and its one-line caveat, with an italic caption beneath: *"The real assistant, running on a local model, with made-up answers. Waits for the model are shortened."* It's made by `scripts/make-demo.ts` (that repository's slice 0016): `npm run screenshots` records the page with Playwright and writes a cut list, then the script trims and speeds the recording with `ffmpeg` and builds a looping GIF with its own palette, stepping down frame rate and width until it's under 5 MB. `ffmpeg` is a system tool there, not a dependency. The two repositories were made to look like one family in 0011 and read like one in 0013; a demo in the same place, with a caption in the same style, keeps that.

**What's different here.**
- **Scripted mode has no model waits.** The sibling's recording speeds up the waits for a model. Here `--fake` answers instantly, so the problem is the opposite: without deliberate pauses the recording is too fast to read. Typing has to be paced, and each screen held long enough to take in.
- **The conversation is long.** p08 answers 16 questions before **See your list** appears (`docs/demo.md` §3). A 20 to 40 second loop can show two or three of them; the rest have to be cut or sped through, and the viewer should be able to tell that happened.
- **The caption can't say "the real assistant, running on a local model".** In scripted mode each of p08's exact replies gets the local model's real recorded reading (`docs/demo.md` §1), and the check replays a committed parse. The caption has to say that truthfully, in the sibling's style.

**Carried in:**
- **Slice 0013 leaned against a GIF** (`work/0013-demo-ready/intent.md`, OQ 1): "no GIF in this slice. The three screenshots plus the demo script cover it, and the owner will show the page live. Revisit if the repository goes public." Its reasons were a binary file that goes stale when the page changes, and the need for a way to remake it. This slice revisits that at the owner's request (2026-11): the owner wants to promote the GitHub page.
- **The repository is still private** (checked 2026-11 with `gh api`); the sibling is public. Visibility stayed the owner's call in 0013, outside that slice, and stays outside this one.
- **p08 is the demo's person.** The README's screenshots and `docs/demo.md` both follow him; his typed replies are read as written in scripted mode, and trials 1, 2, 3 and 6 on his list can be checked (`work/0013-demo-ready/plan.md`, Records, step 2).
- **One known fault in the check's record** (0013 Records, follow-ups): trial 6's record shows the prior-therapy exclusion as covered by the mutation-pill answer. The loop shouldn't show that record.
- **The screenshot setup is the precedent.** `playwright.screenshots.config.ts` runs `npm run app -- --fake` on port 5045, 1280×900, light, and `tests/boundary.test.ts` holds its server command to `--fake`. `e2e/screenshots/readme.shots.ts` already drives p08 from the start form to a checked trial's record. Playwright can record video with `recordVideo` (WebM); `@playwright/test` 1.63.0 is already a dependency.
- **Tools on this machine:** `ffmpeg` is installed (Homebrew); `gifski` is not. Using either is a plan-level decision, as is any new npm dependency (`CLAUDE.md`, "Dependencies").

## Proposed outcome

At the end of this slice:

1. **A silent loop near the top of the README,** 20 to 40 seconds, of p08: the start form filled in, two or three questions typed and confirmed, a visible skip through the rest, the list arriving, one card opened, a trial ticked and checked, and the top of its record with "This isn't a decision" readable. Placed and captioned in the sibling's style, with alt text that says what it shows.
2. **Made by a script, reproducibly,** from `--fake`, the way `npm run screenshots` is: Playwright records the page, a script turns the recording into the file the README shows. Remaking it after a page change is one or two commands, documented where the screenshots are.
3. **Within a size the README can carry,** decided in the spec (OQ 2), with the script enforcing it.
4. **`docs/demo.md` linked to it,** if OQ 5 says so.
5. **If OQ 4 puts it in scope,** a narration script for a 60 to 90 second walkthrough: the `docs/demo.md` "Say" lines cut to fit, with timings against the steps, for the owner to record over. The recording itself is the owner's.
6. **`CLAUDE.md`'s command table** gains the new command, and the roadmap gains this slice's row.

## Affected users and systems

- **Someone opening the GitHub page:** sees the page working within a few seconds of landing.
- **The owner:** has something to point to when promoting the repository, and possibly a script to narrate.
- **Files:** `README.md`; a new file under `docs/images/`; `e2e/screenshots/` (a recording alongside or inside the screenshot run) and possibly `playwright.screenshots.config.ts`; a new script under `scripts/` and its test under `tests/`; `package.json` scripts; `docs/demo.md`; `CLAUDE.md`; `work/ROADMAP.md`.
- **The boundary test,** if a new config or script needs holding to `--fake` the way the screenshot config is.
- **Not touched:** `src/`, `evals/`, `data/`, every committed result, the sibling repository, the breast-cancer work on `0012-breast-cancer`.

## Constraints

- **The recording claims no more than the page does.** Made-up answers, scripted mode, said in the caption. Nothing on screen or in the caption suggests the person is eligible, matched, or that the list is a ranking. The record's "This isn't a decision" stays on screen long enough to read.
- **No model run and no network.** Recorded from `--fake` only. No `--spend`.
- **No product code change.** If recording shows something that needs fixing, it goes on a list for a later slice.
- **No PHI.** p08 is made up, as every frame must be. No real names, places beyond his made-up ZIP, or dates.
- **Binary files are forever in git.** Every committed version of a multi-megabyte file stays in the history. The file is committed only after the owner has watched it, and remade rarely.
- **Tools:** `ffmpeg` as a system tool, if used, is named in the plan and in the docs, and nothing under `tests/` needs it, so `npm test` still passes from a fresh clone without it. A new npm dependency is a plan-level decision.
- **The README stays short.** One loop and one caption line; nothing else added to the top.
- **Visibility is the owner's call.** This slice doesn't make the repository public.
- **Months, not days.** No tool attribution in commits or the PR.

## Open questions

1. **GIF or MP4?**
   - **GIF** is committed in the repository, plays inline everywhere (GitHub, a fork, a clone's Markdown preview), loops by itself, and matches the sibling. It's large for its quality, and limited to 256 colours per frame, which Chart v2's flat colours tolerate well.
   - **MP4** is a fraction of the size and sharper. GitHub only plays it inline when it's uploaded as an attachment (a `github.com/user-attachments/...` link), which lives on GitHub, not in the repository: it can't be remade by a script and committed, a clone doesn't have it, and on a private repository only people with access can see it. A `<video>` tag pointing at a committed file doesn't play in a GitHub README.
   - **Leaning:** GIF, committed, as the sibling does. The MP4 from the same recording can be kept locally, uncommitted, for the owner to upload elsewhere if they want one.
2. **How big, how wide, and where does it live?**
   - The sibling caps at 5 MB and steps down from 960 px wide at 12 fps to 720 px at 10. This page's screens are text-heavy, so legibility at width matters more than frame rate.
   - **Leaning:** `docs/images/demo.gif`, under 5 MB, the same cap and step-down as the sibling, recorded at 1280×900 like the screenshots and scaled down. The spec checks whether the record's text is readable at the width that fits.
3. **Light or dark?**
   - The screenshots are light. Dark mode follows the system on the page (0011). GitHub can show different images per theme with `<picture>` and `prefers-color-scheme`, at double the binary cost.
   - **Leaning:** light only, matching the screenshots and the sibling.
4. **Is the narrated walkthrough in this slice?**
   - The owner would record 60 to 90 seconds in their own voice over `docs/demo.md`. The slice could supply a timed narration script; the recording would live off the repository (an upload or a video site), since a narrated MP4 has the same hosting problem as OQ 1.
   - **Leaning:** not in this slice. `docs/demo.md` already holds the talking points, and the owner can narrate from it. Supplying a timed script makes sense once the owner knows where a narrated video would be posted; that's its own small slice.
5. **Should `docs/demo.md` link the loop?**
   - **Leaning:** yes, one line at the top: "the README's loop shows the same walk in 30 seconds". The demo is the long version of the same story.
6. **How are the skipped questions shown?**
   - Answering all 16 at reading speed takes minutes. Options: speed through them visibly (the sibling's cut list, at a higher speed for the middle), cut with a brief caption frame ("13 more questions"), or answer by the **Choose an answer** buttons quickly.
   - **Leaning:** the sibling's approach: record the whole walk with marks where the skip starts and ends, and speed the middle up so it's plainly a fast-forward, lasting two or three seconds. No caption frames, which would be a second thing to keep in sync.
7. **Do the three still images stay?**
   - The loop shows the same three screens in motion. Removing the stills shortens the README; keeping them gives a reader time with each screen and works where GIFs don't autoplay.
   - **Leaning:** keep them where they are, under "What it does". The loop goes at the top, as the sibling's does.
8. **What does the gate look at?**
   - **Leaning:** one gate, before the GIF is committed: the owner watches it in the README on the branch (pushed or previewed locally), because a binary file committed is in the history for good, and a second take costs another 5 MB. The question is whether it's legible, honest about scripted mode, and worth its size.
