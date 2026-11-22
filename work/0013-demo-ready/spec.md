# spec: 0013 ready to show

**Status:** Draft
**Date:** 2026-11
**Intent:** [intent.md](intent.md), committed as `0013 intent`.

The README is rewritten for someone opening the repository for the first time, with the guardrails stated together, a table of six measured results, each linked to its committed file, and a Mermaid diagram of the parts and the model boundary. A demo script follows made-up patient p08 through the page in `--fake` mode, the same person the README's screenshots show. The GitHub page gets a description and topics. The history is scanned for PHI and secrets and the result is written down. No product code, test, result or data file changes.

---

## 1. What exists at the end

- **`README.md`,** rewritten (§2), with the results table (§3) and the diagram (§4).
- **`docs/demo.md`,** new: the demo script and its talking points (§5).
- **The GitHub description and topics,** set with the owner's go-ahead (§6).
- **`work/0013-demo-ready/history-scan.md`:** how the history was scanned, with what, and what was found (§7).
- **`CLAUDE.md`:** the README convention, and the demo in "Verifying your work" (§9).
- **The roadmap:** a 0013 row (§9).

Not changed: `src/`, `tests/`, `e2e/`, `evals/`, `data/`, `scripts/`, `docs/images/`, the other `docs/` files.

## 2. The README

**For whom.** Someone technical with a few minutes, such as an engineering leader at a clinical-research company. They should be able to say, after reading it, what problem this is, what the finder does, which lines it never crosses, what was measured and how well it did, and how it was built.

**Sections, in order:**

1. **Title and one sentence.** As now: "An AI assistant that helps a person with cancer find clinical trials worth asking their oncologist about." The badges stay.
2. **The problem.** Two short paragraphs, from `work/0000-product/intent.md` §Problem. Hundreds of trials per search, rules written for clinicians, facts patients don't know. Then the number that shows why it matters: 55.6% of 8,883 patients had no trial available where they were treated, and 8.1% enrolled (research §1). Heading wording matches the sibling repository's, read at writing time (§2.1).
3. **What it does.** The five steps as now, shortened, then the three screenshots.
4. **What it never does.** The guardrails together, each one line, each linked to where it's enforced or measured:
   - never says a person is eligible, or should join; the oncologist and the trial team decide (the verdict scans in `tests/web/copy.test.ts` and the browser test);
   - "I don't know" never removes a trial, and nothing a model reads removes one. Why: on held-out, a quarter of the mapper's readings would have wrongly ruled a trial out (`docs/facts.md`, `evals/results/facts/06-5fea50034aea.json`);
   - no real patient data: every patient is made up;
   - runs on one computer. Searches use a saved copy of the registry. The model is local by default, and a hosted one is used only when a person picks it in Settings with their own key;
   - contacts no one.
5. **What was measured.** The table (§3).
6. **How it works.** The diagram (§4), and a sentence on each part, linking its doc.
7. **How it was built.** As now, slightly expanded: built in slices, each with an intent, spec and plan accepted before code (`work/`); a boundary test holds the architecture (`tests/boundary.test.ts`); results committed with model, quantization, temperature and seed; the eval harness first, the agent there to give it something to measure. The link to the sibling repository stays.
8. **Run it.** Short: `npm install`, `npm run check`, `npm run app -- --fake` and the URL, then a link to `docs/demo.md` and a line saying the other commands are in each doc and in `CLAUDE.md`.
9. **Status.** One line at the end, not the top: a proof of concept on made-up patients, measured on one cancer (non-small cell lung cancer), not for real use.

**Rules for the wording:**
- No "eligible", "qualify", "match" or "best" about a person and a trial, other than to say the finder doesn't decide them.
- No number that isn't in §3 or already in a linked doc.
- Plain words, as `CLAUDE.md` asks: the README is for technical and non-technical readers.
- About 120 to 160 lines. Today's is 76; the table and the diagram add most of the difference.

### 2.1 The sibling repository

`eschraufnagel/trial-prescreening-agent` is being reworded separately. When the README is written, its current README is read (read-only, `gh`) and the finder's headings, its sentence on the problem, and its guardrail wording follow the same terms where the two products overlap. Nothing in that repository is changed. If the two disagree on a fact, the finder's README says what the finder does and the difference goes to the owner.

## 3. What was measured (OQ 3)

**Proposed:** six rows, every number already in `docs/`, each linked to its committed result. Columns: what was measured, the result, and what it doesn't show. Under the table, one line on the models: the local model is Qwen3.6-35B-A3B, MLX, 8-bit, temperature 0, seed 20260921; Claude Haiku 4.5 at temperature 0, with no seed (the API has none). Each result file records its own.

| Measured | Result | What it doesn't show |
| --- | --- | --- |
| **How close a short conversation gets to a full record:** 17 held-out made-up patients who know only part of their record | The conversation keeps **85%** of the short list the full record gives; the 8 fixed questions alone keep 72%; a person who knew everything, 91% ([`questions/06`](../../evals/results/questions/06-8eea38fafad5.json)) | Agreement with a full-record run of the same finder, not with clinicians' judgment. The patients were written here. |
| **Search recall:** a held-out random sample of the snapshot, labelled for NSCLC | **76 of 82** relevant trials kept, 92.7% (84.9–96.6%) ([`search/01`](../../evals/results/search/01-a3e87584fb11.json)) | Short of the 95% bar set beforehand, accepted as the finding. Labels written here. |
| **Trials for other cancers moved down** | Short-list places held by them, on held-out: **35 of 162 to 6** ([`questions/06`](../../evals/results/questions/06-8eea38fafad5.json), [`search/other/01`](../../evals/results/search/other/01-d16e940b9df3.json)) | 14 of 43 such trials still unmarked; about 1 relevant trial in 200 marked (moved down, not hidden). |
| **Reading a person's own words,** on a hosted model | Claude Haiku 4.5 read **527 of 527** held-out replies: 324 of 326 stated answers right, 0 of 201 "don't know"s turned into an answer ([`reads/heldout-claude-haiku-4-5-…-schema`](../../evals/results/questions/reads/heldout-claude-haiku-4-5-8cb01749-schema.json)) | Replies were written to be clear. Two plain "No"s read as "Yes". |
| **The deeper check,** on 50 held-out patient–trial pairs, local model | **27%** of questions saved by not asking again; caught **5 of 16** clearly ruled-out trials; false alarms on **27 of 34** others ([`check/01`](../../evals/results/check/01-1db863f7b74c.json)) | The false-alarm rate is high: the record says "may not fit" too often. 0009 and 0010 worked on it; it's open. |
| **Outside judgments,** search only | TREC's assessors: **1,290 of 1,669** relevant trials kept, 77.3%. NIH-TrialBench: **26 of 29** target trials kept ([`trec/01`](../../evals/results/benchmark/search/trec/01-80fcdb226e48.json), [`trialbench/01`](../../evals/results/benchmark/search/trialbench/01-4399149b1b7a.json)) | Other cancers, not NSCLC. TREC judged trials for other conditions too, which the search drops by design. |

The links are written relative to the README (`evals/results/…`); the `../../` above is from this folder.

**The conversation row uses `questions/06`, not the roadmap's 89% and 79%.** Those are 0003's result (`questions/01`), under the order the page used then. The page today uses `other-last` (0005), and `questions/06` scores it: 85%, 72% and 91%. The README reports what the page does now; `docs/questions.md` keeps the history. See Concerns.

**Left out, on purpose:** the fact mapper's coverage and wrong-mapping rate (a guardrail's reason, §2, not a headline), the check's NIH-TrialBench dev runs (dev only), and the parser's grades (inherited). A later gate can swap any row.

## 4. The diagram (OQ 5)

**Proposed:** Mermaid, in the README, so GitHub renders it and it's edited as text. No image, no tool to remake it.

What it shows:
- **The flow:** the registry snapshot → search (no model) → fact hints (each trial's rules read ahead of time by the local model; hints only) → the questions (chosen by code; a model reads the person's replies) → the short list and the oncologist sheet (code) → the deeper check of up to three picked trials (a model parses the trial's rules, and the screening agent asks what's left) → a record per trial.
- **Which parts use a model,** marked on the node, and which don't.
- **The model boundary:** every model call goes through `src/models/`, to the local model by default or to Anthropic, OpenAI or xAI when a person chooses one in Settings.
- **The eval harness beside it:** each stage linked to the measurement in §3, so the diagram also says where each number comes from.

It must read in GitHub's light and dark themes: Mermaid's default theme, no custom colours, about 12 nodes at most. If it can't stay that small, the eval harness goes in a second, smaller diagram.

## 5. The demo (OQ 4)

**Proposed: the demo follows made-up patient p08** (`evals/cases/patients/dev/p08.json`): 69, adenocarcinoma spread to the adrenal gland and bones, progressed on Keytruda with chemotherapy, a HER2 exon 20 mutation, three lines of treatment. That's the person the tool is for. The README's screenshots already follow p08 (`e2e/screenshots/readme.shots.ts`), so the demo and the images tell the same story, and **the screenshots don't need remaking** (intent outcome 6).

**Typed replies, not buttons.** `--fake` reads a reply as the local model read it in the committed reading runs, matched on the exact text (`scriptedReader`, `scripts/app.ts`). Typing p08's own replies, word for word, gets the model's real recorded reading of each, and shows the step where the page asks the person to confirm it. So the script lists p08's replies to paste, in order. The buttons are the fallback for any question whose reply doesn't match.

**`docs/demo.md` holds:**
1. **Before:** `npm install`, `npm run app -- --fake`, open http://127.0.0.1:5025. Settings shows "a scripted reader": say so, it's honest.
2. **The start form:** ZIP 97201, age 69, 50 miles, male. Talking point: answers stay on this computer; one cancer so far.
3. **The questions:** each question as the page asks it, the reply to paste, and what the confirm step shows. Talking points: "I don't know" never removes a trial; questions are chosen by how much each answer would change the list; the reader's measured accuracy (§3).
4. **The list:** what each card says (nearest site, how much of its rules were read, "may not fit" with the trial's own words); the note that the order isn't a ranking. Talking points: search recall, trials for other cancers moved down.
5. **The oncologist sheet:** what to bring, the open questions grouped by who would know. Talking point: every unknown becomes a question.
6. **The check:** tick a trial that has a committed parse, "Check these"; the opening line says how many of its rules earlier answers already covered; answer two or three, then "Stop and show the record". Talking points: nothing asked twice (27%); the false-alarm rate, said plainly.
7. **The record:** its sections; it prints; it's sent nowhere.
8. **Closing:** the eval harness and `work/`, with where to look.
9. **What fake mode can't do:** typed text other than the scripted replies reads as unknown; only trials with committed parses can be checked. Live mode needs the local model or a key.

**Timing:** about five minutes; the script marks what to skip for three.

**How it's written:** by walking the page on `finder-fake` with p08's replies and recording what each screen says. Which trials on p08's list are checkable is found then, not guessed. If none of p08's trials can be checked, the script says so and checks the nearest trial that can, and the owner hears about it at the gate.

**No product change.** If the walk finds something wrong on the page, it goes on a list in the PR for a later slice.

## 6. The GitHub page

- **Description** (under 350 characters), e.g.: "A local proof of concept: an AI assistant that helps a person with cancer find clinical trials to ask their oncologist about, with an eval harness that measures every stage. Made-up patients only; it never says who is eligible."
- **Topics:** `clinical-trials`, `oncology`, `llm`, `evals`, `ai-agents`, `typescript`, `local-first`, `clinicaltrials-gov`, `healthcare`.
- **Set by `gh repo edit`,** after the owner accepts the wording at the gate. The repository's visibility isn't touched.

## 7. The history scan (OQ 6)

**Proposed: two passes, both local, both read-only.**

1. **Secrets:** `gitleaks git` over every commit on every branch, run locally with no upload, its version recorded. Gitleaks isn't installed on this machine; the owner installs it (Homebrew), since it's a tool on the machine, not a dependency of the repository. If the owner would rather not, a `git log -p --all` search for key prefixes (`sk-ant-`, `sk-`, `xai-`, `AKIA`, `ghp_`, `-----BEGIN`) and assignments to the four key variables stands in, and the record says it's the weaker pass.
2. **PHI:** a search of every blob in the history for patterns that would be real patient data: dates of birth, MRNs and record numbers, phone numbers, email addresses, street addresses, and the word "patient" beside a name. Made-up patients are expected, and each hit is read by a person and judged, not counted.

**Recorded in `history-scan.md`:** the commands, the tool version, the commit range, the count of hits per pass, and each judged hit with its file and commit (no secret value is copied in). **A real finding goes to the owner** before anything else happens, and isn't fixed in this slice.

## 8. A GIF, and a docs overview (OQ 1, OQ 2)

- **No GIF (OQ 1).** The three screenshots and the demo script cover it, and the owner shows the page live. A GIF is a binary that goes stale and needs its own way to remake it. Revisit if the repository goes public.
- **No `docs/` overview page (OQ 2).** The README's "How it works" links each part to its doc, and the table links each number to its result and doc. That's the map. If the README runs past about 160 lines because of it, the spec's answer changes to a `docs/README.md` and the gate hears why.

## 9. `CLAUDE.md` and the roadmap

- **The README convention** becomes: "The README is short and for anyone who opens the repository: the problem, what it does, what it never does, what was measured, how it works and how it was built, and how to run it. It names no one. Its results table holds a few headline numbers, each linked to a committed result in `evals/results/` with a line on what it doesn't show; detail, other results and limitations go in `docs/`, one file per part."
- **"Where things live":** `docs/demo.md` named.
- **"Verifying your work":** no new command; the demo is `npm run app -- --fake`, already listed.
- **The roadmap:** a 0013 row, "Ready to show", measured by the owner's read and demo run at the gate; no model.

## 10. Boundaries

None touched. No file under `src/`, `scripts/`, `tests/` or `e2e/` changes, so `tests/boundary.test.ts` is unaffected. The one network call the slice makes is `gh` (reading the sibling README, setting the description and topics), run by hand in the session, not by the repository's code.

## 11. Tests

No new test, and none changed. `npm run check` passes on every commit, as always. Before the gate, each link in the README and `docs/demo.md` is checked to resolve to a file in the repository, by a one-off command recorded in the plan, not a test.

## 12. Gates (OQ 7)

**One gate, before the README and the demo are committed: the owner reads the README and runs `docs/demo.md` start to finish on their own machine.** What's being decided is what a reader sees on 2026-11-25; being wrong costs a first impression that can't be redone. The same gate accepts the GitHub description and topics before they're set.

**The history scan reports when it's done,** separately, because a finding there decides whether the repository can go public, which is a different decision from whether the README is good.

## 13. Out of scope

- Any change to what the page does or says, including fixes the demo walk turns up.
- New measurements, model runs or `--spend`.
- The breast cancer work (0012) and anything it adds; the README describes `main`.
- The sibling repository.
- Making the repository public.
- Rewriting history.

## Concerns for the owner

1. **The conversation's headline number is 85%, not 89%.** The roadmap and `docs/questions.md` lead with 0003's 89% (and 79% for the fixed questions alone). Under the order the page uses today, the same 17 held-out patients give 85% and 72% (`questions/06`, 0005). The README would report 85%. **You're deciding** whether the headline is what the page does now (proposed), or 0003's number with a note. `docs/questions.md`'s opening sentence still says 89%; correcting it is a doc change this slice could make, or leave.
2. **Gitleaks is a new tool on your machine** (§7). Not a repository dependency, but something installed. **You're deciding** whether to install it or take the weaker grep pass.
3. **The README now reports results,** against the convention `CLAUDE.md` states today. You accepted this; §9 is the new wording to check.
4. **Setting the description and topics is visible on GitHub** to anyone with access, even while the repository is private. Proposed only after you accept the wording at the gate.
5. **The check's false-alarm row is unflattering** (27 of 34). Proposed in the table because leaving it out would oversell; it's the row a careful reader will ask about.
