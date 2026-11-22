# intent: 0013 ready to show

**Author:** the repository owner
**Status:** Draft
**Date:** 2026-11
**Scope:** How the repository tells its story to someone opening it for the first time: the README, a diagram, a demo script, the GitHub page, and a scan of the history before the repository can go public. No product code changes, and no new measurement.

---

## In plain words

The finder works. A person answers a few questions, gets a short list of trials, prints a sheet for their oncologist and checks up to three trials closely. Eleven slices measured each part and committed every result.

The repository doesn't say that well. The README opens by apologising ("not for real use, and not finished"), spends most of its length on terminal commands, and hides the eval harness, which is the main thing this project built, behind links. A reader learns what the tool does, but not what was found, how it's kept honest, or why that matters.

This slice rewrites the telling for someone technical who has a few minutes: an engineering leader at a company that works on clinical research. They should come away knowing the problem, what the finder does, the lines it never crosses, what was measured and how well it did, and how it was built. Then, if they want to see it, there's a five-minute demo that runs with no model and no network, with a script to follow.

**What would make it not worth doing.** If polishing means overselling. Every number in the README has to point to a committed result and say what it doesn't show. If a sentence reads better than the evidence behind it, the sentence changes.

## Problem

**The README undersells and misdirects.**
- It opens unsure of itself: "A proof of concept, not for real use, and not finished" (`README.md`, line 7). That's true, but it's the first thing a reader meets.
- "Run it" is most of the page: six commands, each with a paragraph.
- It never says what was found. `CLAUDE.md` forbids it: the README "reports no findings; detail, results and limitations go in `docs/`, one file per part".
- The guardrails that make this safe to show (no eligibility verdict, an unknown never excludes a trial, no PHI, local by default, no contact with anyone) are scattered through `docs/` and `CLAUDE.md`, not stated together.

**The eval harness isn't visible.** `CLAUDE.md` and the product intent both say the harness is the primary artifact. The README mentions measurement once, in a link to `docs/benchmark.md`. The results are in `evals/results/` and the roadmap's "Measured by" column, which a first-time reader won't open.

**There's no picture of how it fits together.** Search, fact hints, question choice, the short list and the deeper check are five parts with a model behind only some of them, and one boundary (`src/models/`) that every model call goes through. Today that's only in prose, across six docs.

**There's no demo to follow.** `npm run app -- --fake` runs the whole page with no model. But in fake mode most typed replies aren't understood, so a demo has to use the "Choose an answer" buttons, and only trials with committed parses can be checked. Someone who hasn't done it before will stumble. Walked through 2026-11 on `finder-fake` (port 5055): the start form takes ZIP, age, travel and sex; "Start the questions" asks 16 questions by buttons; the list shows 10 trials and 196 more; two of the ten can be checked, and the check opens saying how many of the trial's rules the earlier answers already covered. Taking the first button every time describes early, operable cancer, which is a weak story for a tool meant for people whose treatment has stopped working.

**The GitHub page is bare.** The description is one sentence; there are no topics. The repository is private.

**The history hasn't been scanned.** Nobody has checked all of it for PHI or secrets. The constraints forbid both, and the boundary test holds the code, but not every committed file across every commit.

**Carried in:**
- **The owner's choices for this slice (2026-11):**
  - a headline results table in the README is accepted, which overrides the `CLAUDE.md` convention that the README reports no findings, and that convention is updated in this slice;
  - a scripted demo on `npm run app -- --fake`, with a click-by-click script and talking points;
  - a full slice: intent, spec and plan, each committed on the owner's acceptance;
  - the repository stays private for now. Making it public is the owner's decision, outside this slice; this slice makes it ready.
- **The audience, and the date:** the owner is showing the repository to a VP of Engineering at a clinical-research company on 2026-11-25. It doesn't need to be finished; it needs to be clear.
- **Consistency with the sibling repository.** `eschraufnagel/trial-prescreening-agent` is being reworded separately (its problem and why-it-matters). The two should read as one family, as 0011 made them look like one. That repository isn't changed here.
- **The headline numbers already exist,** each with a committed result, in the roadmap's "Measured by" column and in `docs/`:
  - search recall on held-out NSCLC labels, 76 of 82 (`evals/results/search/01-a3e87584fb11.json`, `docs/search.md`);
  - the conversation's three-way comparison, 89% of the full record's short list against 79% from the intake alone (`evals/results/questions/`, `docs/questions.md`);
  - the reader on Claude Haiku 4.5, 527 of 527 held-out replies read (`evals/results/questions/reads/`, `docs/questions.md`);
  - the trials-for-other-cancers mark, 35 of 162 places to 6 (`evals/results/search/other/`, `docs/search.md`);
  - the deeper check, 27% of questions saved and false alarms on 27 of 34 (`evals/results/check/01-1db863f7b74c.json`, `docs/check.md`);
  - outside benchmarks, TREC 77.3% pooled and NIH-TrialBench 26 of 29 (`evals/results/benchmark/`, `docs/benchmark.md`).
  Each has stated limits in its doc. Some of them are not flattering, and that's part of the story.
- **0011 left the README with three screenshots** (`docs/images/`, made by `npm run screenshots`) and the README's last section, "How it's being built".
- **Not merged:** slice 0012 (breast cancer) is on its own branch. This slice branches from `main` and describes NSCLC only.

## Proposed outcome

At the end of this slice:

1. **A README for someone opening the repository for the first time,** in this order: what it is in a sentence; the problem and why it matters; what it does, with the screenshots; the guardrails, together; what was measured (item 2); how it's built, with the diagram (item 3); and how to run it, short. The "not finished" caveat stays, said once and plainly, not as the opening.
2. **A "What was measured" table,** five to seven rows. Each row is one number, a link to its committed result in `evals/results/`, and a line on what it doesn't show. Every number is already in `docs/`; none is new. It records model, quantization, temperature and seed where the result does, per `CLAUDE.md`, or links to where they are.
3. **An architecture diagram:** search → fact hints → question choice → short list → deeper check, showing which parts call a model and that every call goes through `src/models/`, with the local model as default and hosted models only by choice in Settings. It renders on GitHub and lives in the repository as text or a committed image.
4. **A demo script** (`docs/demo.md`): start the app in fake mode, then click by click through one made-up person whose answers tell the intended story (advanced cancer, treatment that stopped working), to the list, the oncologist sheet, a check of a checkable trial, and its record. With talking points at each screen: what the screen shows, which guardrail it demonstrates, and which measured number sits behind it. About five minutes.
5. **The GitHub page:** a description and topics, set by the owner or with their go-ahead.
6. **Screenshots refreshed if the demo's person differs** from the one `npm run screenshots` uses, so the README and the demo show the same story.
7. **The history scanned** for PHI and secrets, every commit and every file, with the method and the result written down. A finding is reported to the owner, not fixed by rewriting history in this slice.
8. **`CLAUDE.md` updated:** the README convention, to allow the headline table; anything else the slice changes.

## Affected users and systems

- **Someone opening the repository:** a hiring manager, an engineer, a clinician. They get the story in the README and can run the demo.
- **The owner:** presents with the demo script.
- **Files:** `README.md`, `docs/demo.md` (new), possibly a `docs/` overview (OQ 2), `docs/images/`, `CLAUDE.md`, the roadmap row. The screenshot script only if the demo's person changes.
- **GitHub:** the repository's description and topics.
- **Not touched:** everything under `src/`, `evals/`, `data/`, `tests/`, `e2e/`; every committed result; the sibling repository; the breast cancer work.

## Constraints

- **Nothing in the telling claims more than the results.** Every number links to a committed result; none is rounded up or stated without its limit. No sentence says or suggests the finder tells anyone they're eligible, matches them, or ranks trials by benefit.
- **No new measurement and no model run.** The demo runs on `--fake`; screenshots come from `--fake`. No `--spend`.
- **No product code change.** If the demo shows something that needs fixing, it goes on a list for a later slice, not into this one.
- **No PHI.** The demo's person is made up, and so is every screenshot. The history scan is read-only.
- **No secrets.** Setting the GitHub description and topics touches nothing but those two fields.
- **The README stays short.** Detail stays in `docs/`, one file per part.
- **Visibility is the owner's call.** This slice doesn't make the repository public.
- **Months, not days.** No tool attribution in commits or the PR.

## Open questions

1. **Is a short GIF worth it?**
   - A 10 to 20 second loop of the conversation reaching the list shows the product faster than three still images. It also adds a binary file that goes stale when the page changes, and needs a way to remake it.
   - **Leaning:** no GIF in this slice. The three screenshots plus the demo script cover it, and the owner will show the page live. Revisit if the repository goes public.
2. **Does `docs/` need an overview page?**
   - Six docs, one per part, each detailed. A reader who leaves the README for `docs/` lands in one part with no map.
   - **Leaning:** no separate page. The README's diagram links each box to its doc, and the results table links each number to its doc, which is the map. A `docs/README.md` only if the spec finds the README can't carry it.
3. **Which numbers make the table?**
   - Eleven slices have numbers; the table should hold five to seven. The conversation's three-way comparison is the question the project exists to answer. Search recall is the stage nothing can recover from. The check's false-alarm rate is high, and leaving it out would oversell.
   - **Leaning:** the three-way comparison, search recall, the reader on a hosted model, the other-cancers mark, the deeper check (questions saved and false alarms together), and the outside benchmarks. The spec fixes the wording and the "what it doesn't show" line for each.
4. **Which made-up person does the demo follow?**
   - The first button every time tells the wrong story. The committed patients in `evals/cases/patients/` have answers written for the evals, and one of them might fit.
   - **Leaning:** pick the button answers by hand for a person with advanced NSCLC after chemotherapy and immunotherapy, and check that at least one trial on their list has a committed parse. If no such path reaches a checkable trial, say so, and choose the nearest story that does.
5. **What form does the diagram take?**
   - Mermaid renders on GitHub from text and diffs well; an SVG or PNG looks better and can follow Chart v2.
   - **Leaning:** Mermaid in the README, so it stays in sync with the text and needs no tool to remake.
6. **How is the history scanned?**
   - **Leaning:** a secret scanner over every commit (run locally, no upload) plus a search of the history for patterns that would be PHI (names beside dates of birth, MRNs, addresses beyond ZIP), with the method, tool version and result written into the slice folder. The scan's output is read by a person before anything is said about it.
7. **What does the gate look at?**
   - **Leaning:** one gate, before the README and demo are committed: the owner reads the README and runs the demo script start to finish, because what a reader sees on Wednesday is the thing being decided. The history scan's result goes to the owner whenever it's ready, separately.
