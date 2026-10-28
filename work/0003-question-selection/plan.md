# plan: 0003 question selection

**Intent:** `work/0003-question-selection/intent.md` · **Spec:** `work/0003-question-selection/spec.md`
**Branch:** `0003-question-selection`, from `main` at `900e902` (0002 merged). Intent, spec and this plan are committed together at step 1.

---

## Context

0002 left every NSCLC candidate's rules mapped onto 31 facts. A mapping is a "may not fit" hint, never a rule-out. But nothing orders the trials, nothing chooses which question to ask, and nothing says when to stop. `facts:try` only prints how many trials map each unanswered fact, and it ranks pregnancy fourth for a 64-year-old woman (73 of 188 Chicago trials).

This slice adds five things:
- a pinned order for the trials;
- a fixed intake;
- a deterministic chooser and stopping rule;
- about 20 made-up patients, each with a full record and what they know;
- a model reader for replies in a person's own words.

It measures the full record against the intake alone and against the conversation. That's the product's three-way comparison, here with no model at all. The reader is then measured on its own, and in the loop.

**What it spends:**
- **Machine time:** the local model, for about 600 short reader calls (minutes).
- **Money:** none. Hosted reads are dry without `--spend`, and none is planned.
- **Network:** none beyond the local model.
- **Dependencies:** none new.

**Baseline:** `npm run check` on `900e902`: 817 passed and 8 expected fail, 67 files.

**The local model** (`omlx`, `Qwen3.6-35B-A3B-MLX-8bit`, `http://127.0.0.1:8000/v1`) is needed only in stage C. If it isn't answering, Claude stops and asks the owner to start it, and doesn't fall back to a hosted model.

---

## Order of work

### Stages and gates

| Stage | Steps | Ends at | What you can see at the end |
| --- | --- | --- | --- |
| **A. Patients** | 1–3 | **Gate 1** | `AUTHORING.md`; 20 patients, committed and split by hash; their loader; knowledge rates; a blind reading of every reply |
| **B. Order, chooser, measurement** | 4–9 | **Gate 2** | `questions:try` and `questions:eval`; dev curves for three scorers, five arms |
| **B′. Held-out** | 10 | — | held-out scored once with the frozen settings |
| **C. The reader** | 11–13 | **Gate 3** | `questions:read`; dev reads tuned; held-out read once; the conversation rerun with reads |
| **D. Written up** | 14–15 | PR | `docs/questions.md`, README, ROADMAP, CLAUDE.md, review passes |

**Gate 1: are these patients good enough to measure against?** (spec §5)
- **What's decided:** whether the 20 patients and their replies are what the measurement should rest on, before any chooser or reader runs on them.
- **What the owner sees:**
  - the coverage table from `AUTHORING.md`;
  - each patient's search size;
  - the actual knowledge rates beside the convention's 90/30/35;
  - a blind reading. A separate agent, given only `AUTHORING.md`, each fact's question and answers, and each reply, says which answer each reply means or "unknown". Every disagreement with the record is listed.
- **What it costs to be wrong:** Every number in B and C is computed against these patients. Changing them after Gate 2 means redoing the dev choice. After held-out, it's a new measurement, and held-out has been looked at.
- **The answer can be no.** Ambiguous replies are rewritten. If the knowledge rates are off, or a group the product is for is missing (no one with a driver, nobody rural), patients are added or changed, in one commit, before stage B.
- **Delegable:** the blind reading needs no clinical judgment. `docs/questions.md` says no clinician checked the patients.

**Gate 1, as answered** (owner, 2026-10; `gate-1-patients.md`): the 20 patients are accepted as written, with 3 on dev (p08, p11, p17). None is added.

**Gate 2: which scorer and budget go to held-out?** (spec §4.1, §6.3)
- **What the owner sees:**
  - the dev curves (agreement and would-flag after 0–20 follow-ups) for `fixed`, `count` and `shortlist`;
  - the five arms' numbers;
  - the "from the start" arm against the fixed intake;
  - pushed-down and no-mapping counts;
  - two patients' full `questions:try` transcripts.
- **The choices:**
  - the scorer, which is `shortlist` if it beats `count`, else `count`, and that's the finding;
  - the budget, read off the curve where agreement stops rising;
  - whether the intake stays fixed;
  - whether `shortlistSize` stays 10.
- **What it costs to be wrong:**
  - Held-out is scored once with what's chosen here.
  - 0004 builds the page on this order, intake, scorer and budget.
  - A scorer that wastes questions puts the burden on a person who is unwell.
- **Can be no:** if no scorer comes near the record arm even with knows-all, the gap is in the mappings or the order, not the chooser. That's written up as the finding, and 0004 is re-planned around it.

**Gate 2, as answered** (owner, 2026-10; `gate-2-finding.md`): scorer `shortlist`, budget 8, fixed intake, short list of 10. The order stays as the spec pinned it for held-out; whether to change it is 0004's first question.

**Gate 3: is the reader good enough for free text on the page?** (spec §7.3)
- **What the owner sees:**
  - held-out exact, lost, wrong and invented, with intervals, against the proposed bars: invented ≤ 5%, exact ≥ 85%;
  - every invented reading, with its reply;
  - the conversation rerun with reads, beside the deterministic patient;
  - prompt revisions on dev and what each changed.
- **The choices:**
  - free text in 0004, with the reader;
  - buttons, with the reader left as measured and unused;
  - buttons first and free text as an option, recorded for 0004's intent.
- **What it costs to be wrong:** An invented fact puts an answer in a person's profile that they never gave. It moves trials and hides questions from the oncologist sheet. 0004's page design follows from this answer.

**Gate 3, as answered** (owner, 2026-10; `gate-3-reader.md`): free text in 0004, with each reading shown back for the person to confirm or change.

Stage B′ and D need no gate of their own.

### Steps

Each step is one commit, through `npm run check && git commit`. No commit carries a Co-Authored-By trailer. No test mocks a module or stubs a global; the adapter is injected.

**Stage A: patients**

1. **Commit intent, spec and this plan** as `work/0003-question-selection/{intent,spec,plan}.md`. Record the baseline test count from `npm run check`.

2. **The convention and the loader.**
   - `evals/cases/patients/AUTHORING.md`: spec §5.2, in full, with the coverage table left to fill.
   - `evals/questions/patients.ts`:
     - `Patient` type, `loadPatient(path, vocabulary, zips)` and `loadPatients(set)`;
     - validation per spec §5.1, with every problem reported together;
     - `setFor(id)`, which hashes the id with sha256 and sends it to dev when the first byte is below 64, so about a quarter go to dev;
     - `knowledgeRates(patients, vocabulary)`, the actual rates by `whoKnows`;
     - `replyFor(patient, factId)`, which returns `says`, else `dontKnow`, else `dontKnowPhrases[i % n]`, where `i` is the fact's index in `factsFor`.
   - **Tests:** `tests/evals/questions-patients.test.ts`, on made-up fixtures in the test file. Each validation rule rejects; `setFor` is stable; `replyFor` rotates in fact order.

3. **The 20 patients, written, then split.**
   - Claude writes all 20 into a staging folder, then moves each to `dev/` or `heldout/` by `setFor`, in the same commit. A small script does the move: `scripts/questions-split.ts`, which refuses if either set folder already has files.
   - Each patient's search runs once, to check it keeps candidates. A search keeping fewer than ten trials is allowed and noted.
   - Claude fills the coverage table and runs the blind reading as a separate agent (Gate 1). The reading goes to `work/0003-question-selection/gate-1-patients.md`, with the knowledge rates and every disagreement.
   - If the split leaves dev with fewer than 4 patients, the threshold isn't changed. The owner decides at Gate 1.
   - **Tests:** the committed patients load, and every file's folder is its `setFor`.
   - **→ Gate 1.**

**Stage B: order, chooser, measurement**

4. **Move the run loader into `src/facts/run.ts`.**
   - `FACTS_DATA_DIR`, `runDirFor` and `readTrialFacts` move there from `scripts/facts-map.ts` and `scripts/facts-show.ts`.
   - The scripts re-export or import them, with no behaviour change.
   - `src/facts/index.ts` exports them.
   - **Tests:** the existing `tests/facts/run-sample.test.ts` and `tests/scripts/facts-cli.test.ts` pass unchanged.

5. **The order (spec §2).**
   - `src/shortlist/order.ts`: `orderTrials(entries)`, where an entry is a `{ candidate, status }`, and `shortlistOf(order, size)`.
   - `ORDER_KEYS` is exported as a readonly list of the key names, for the pin.
   - **Tests:** `tests/shortlist/order.test.ts` covers each key, ties, no distance last, nothing dropped, `ORDER_KEYS` equal to the four keys in order, and a candidate with no `TrialFacts` (no mappings) sorting as unhinted.

6. **Settings (spec §3).**
   - `data/questions/conversation.json`, as in the spec.
   - `src/questions/settings.ts`: `loadConversationSettings(path, vocabulary)`, validation and `sha256`.
   - **Tests:** `tests/questions/settings.test.ts`. The committed file loads; an unknown fact, a duplicate intake entry, a fact for another cancer, size or budget below 1, and an unknown scorer all reject, together.

7. **The chooser and the conversation (spec §4).**
   - `src/questions/select.ts`:
     - `askable(...)`;
     - the three scorers as `Record<ScorerName, Scorer>`;
     - `nextQuestion(...)`, which returns `{ factId } | { stop: "budget" | "nothing-left" | "stable" }`.
   - `shortlist` computes, per fact and answer, `statusFor` only for the candidates that map the fact, then reorders. The rest keep their status.
   - `src/questions/conversation.ts`:
     - `ConversationState`;
     - `runConversation({ candidates, run, vocabulary, settings, sex, answer, scorer?, budget?, intake? })`, where `intake: false` gives the from-the-start arm;
     - each `Step` holds the fact, the reply (an answer id or `unknown`), the short list before and after, and the entered and left ids.
   - `src/questions/index.ts`.
   - **Tests:** `tests/questions/select.test.ts` and `tests/questions/conversation.test.ts`, on a fixture of about 15 hand-made `TrialFacts` and candidates with distances, built so the three scorers choose differently. They cover:
     - "unknown" is never re-asked and moves nothing;
     - the skip for men;
     - each stop reason;
     - `stable` when no answer could move the list;
     - the intake comes first, in order;
     - the from-the-start arm uses no intake.

8. **The measurement (spec §6).**
   - `evals/questions/arms.ts`: the five arms per patient. It runs the search with `searchTrials` and the snapshot, zips and cancer vocabulary loaded once, reads the run via `src/facts/run.ts`, and calls `runConversation` with `answer = knows ? record : unknown`.
   - `evals/questions/metrics.ts`: agreement, would-flag, the curve (budget lifted to 20), pushed down, no-mapping places, open questions, and per-set sums.
   - `evals/questions/result.ts`:
     - `QuestionsEvalResult` (version, set, patients' hashes, settings hash, run name, prompt and vocabulary hash, snapshot month, optional reads file, rows, metrics);
     - `verifyResult`, after `evals/search/result.ts`, which checks that the metrics follow from the rows and the hashes match.
   - `scripts/questions-eval.ts` (`questions:eval`):
     - `--dev`, `--reads <file>` and `--check`;
     - writes `evals/results/questions/NN-<settings hash>.json` via `nextRunFile` (`evals/run-file.ts`);
     - `--check` reruns the latest and diffs it.
   - **Tests:** `tests/evals/questions-metrics.test.ts`, on a two-patient hand-worked fixture. `tests/evals/questions-result.test.ts` verifies the committed latest (once one exists) without rerunning, and a changed number fails.
   - `package.json`: `questions:eval`. `biome.jsonc`: ignore `evals/results/questions`.

9. **`questions:try`, the boundaries and the dev run.**
   - `scripts/questions-try.ts`: `--patient`, `--scorer`, `--budget`, `--reads` and `--run`. It prints the steps, the stop reason, the short list with hints and quotes (`describeMapping` from `scripts/facts-show.ts`), and the open questions.
   - `tests/scripts/questions-cli.test.ts`: `formatTry` on the fixture, and the no-verdict string check (spec §10) over its output and a result file's strings.
   - `tests/boundary.test.ts` gains a block, "question choice and the order reach no model", modelled on the `src/facts/` block at line 632:
     - everything under `src/shortlist/` and `src/questions/`, except `read.ts` and `prompt.ts`, reaches no file under `src/models/`, `src/criteria/parse.ts`, `src/screening/`, `src/plain/` or `src/transport/`;
     - all of `src/questions/` stays away from the factory;
     - `evals/questions/patients.ts` reaches no model;
     - each rule has a "would catch" test.
   - Claude runs `questions:eval -- --dev` and two transcripts, and records the curves in Records. **→ Gate 2.**

**Stage B′: held-out**

10. **Freeze and score held-out once.**
    - Write Gate 2's scorer, budget and intake into `conversation.json`.
    - Run `questions:eval` once and commit the result.
    - Record it in Records and `gate-2-finding.md`.

**Stage C: the reader**

11. **The reader (spec §7.1).**
    - `src/questions/prompt.ts`: `READER_SYSTEM_PROMPT`, `buildReaderPrompt(fact, reply)` and `READER_PROMPT_VERSION` via `hashPrompt` (`src/criteria/prompt.ts:120`).
    - `src/questions/read.ts`: `readReply(fact, reply, adapter, { maxOutputTokens })`, which returns `{ answer: string | "unknown", rejected?: string }`. It uses `objectFrom` from `src/screening/calls.ts`, as the participant does. Check the boundary: if that import reaches the screening agent, copy the ten-line helper instead.
    - **Tests:** `tests/questions/read.test.ts` with `FakeModelAdapter` (`src/models/fake.ts`):
      - a valid id;
      - "unknown";
      - an id from another fact;
      - truncation;
      - non-JSON;
      - the prompt holds the fact's question, its answers and the reply, and nothing else.

12. **`questions:read` and the dev reads (spec §7.2).**
    - `scripts/questions-read.ts`:
      - `--set dev|heldout`, `--model` and `--spend`, through `readModelFlags`/`planPaidRun`/`logSpend` (`scripts/lib/model-flags.ts`) and `createLocalAdapter`/`createAdapter`, as `scripts/facts-map.ts` does;
      - every (patient, NSCLC fact) pair, written as it goes and resumable;
      - writes `evals/results/questions/reads/NN-<prompt>.json` with the adapter descriptor (model, quantization, temperature, seed).
    - `evals/questions/read-grade.ts`: exact, lost, wrong and invented, with `wilson` (`evals/search/metrics.ts:64`).
    - `questions:eval -- --reads` uses the reads as `answer`.
    - **Tests:** `tests/evals/questions-read-grade.test.ts` on a hand-worked fixture, and resume on a temp dir with the fake adapter (`tests/scripts/questions-read.test.ts`).
    - Claude runs dev reads on the local model. Up to two prompt revisions on dev, each a new prompt version and a new result, with what changed recorded.

13. **Held-out reads, once, and the conversation with reads.**
    - Freeze the prompt.
    - Run `questions:read -- --set heldout` and `questions:eval -- --reads <heldout reads>`, then commit both.
    - Record the numbers. **→ Gate 3.** The answer goes in `gate-3-reader.md`.

**Stage D: written up**

14. **Docs.**
    - `docs/questions.md`: the finding in plain words, the order, the chooser, the patients and their limits, the dev and held-out tables with every result linked, the reader's numbers with model, quantization, temperature and seed, and the limits (one author, 20 patients, one cancer, mappings that are wrong a quarter of the time, trials with no mappings rising).
    - `README.md`: one line on the conversation. No findings.
    - `work/ROADMAP.md`: 0003 done, and 0004's row updated with the Gate 3 answer.
    - `CLAUDE.md`:
      - the three commands;
      - `src/questions/` and `src/shortlist/` in the layout, and `data/questions/` and `evals/questions/`, `evals/cases/patients/`;
      - the new boundary sentence.

15. **Review passes** (`REVIEW.md`), findings recorded in Records. `git diff main` is empty on the "not touched" paths.

---

## Files that change

**New:**
- `src/shortlist/order.ts`
- `src/questions/index.ts`, `settings.ts`, `select.ts`, `conversation.ts`, `prompt.ts`, `read.ts`
- `src/facts/run.ts`
- `data/questions/conversation.json`
- `evals/cases/patients/AUTHORING.md`, `dev/*.json`, `heldout/*.json` (20 in all)
- `evals/questions/patients.ts`, `arms.ts`, `metrics.ts`, `result.ts`, `reads.ts`
- `evals/results/questions/` (dev and held-out results), `evals/results/questions/reads/`, `evals/results/questions/with-reads/`
- `scripts/questions-split.ts`, `questions-eval.ts`, `questions-try.ts`, `questions-read.ts`
- `tests/shortlist/order.test.ts`
- `tests/questions/settings.test.ts`, `select.test.ts`, `conversation.test.ts`, `read.test.ts`
- `tests/evals/questions-patients.test.ts`, `questions-metrics.test.ts`, `questions-result.test.ts`, `questions-read-grade.test.ts`
- `tests/scripts/questions-cli.test.ts`, `questions-read.test.ts`
- `docs/questions.md`
- `work/0003-question-selection/intent.md`, `spec.md`, `plan.md`, `gate-1-patients.md`, `gate-2-finding.md`, `gate-2-transcripts.txt`, `gate-3-reader.md`

**Modified:**
- `src/facts/index.ts`, and `scripts/facts-map.ts` and `scripts/facts-show.ts` (the loader move)
- `tests/boundary.test.ts`, `package.json`, `biome.jsonc`
- `CLAUDE.md`, `README.md`, `work/ROADMAP.md`

**Not touched, checked at step 15:** `data/facts/` (vocabulary and runs), `src/facts/status.ts`, `map.ts`, `prompt.ts`, `src/search/`, `src/trials/`, `src/criteria/`, `src/screening/`, `src/models/`, `data/snapshot/`, `evals/participant/`, `evals/cases/facts/`, `evals/results/facts/`, `evals/results/search/`.

## Reused, not rebuilt

- `statusFor`, `validateProfile` and `Profile` (`src/facts/status.ts`); `factsFor` and `loadFactVocabulary` (`src/facts/vocabulary.ts`).
- `searchTrials` (`src/search/search.ts`), `loadVocabulary`, `loadZipPoints`, and `loadSnapshot` (`src/trials/snapshot-load.ts`); the default `purposes` from `parseArgs` (`scripts/search.ts:66`).
- `readTrialFacts`, `runDirFor` and `describeMapping` (`scripts/facts-show.ts`); the first two move to `src/facts/run.ts`.
- `hashPrompt` (`src/criteria/prompt.ts:120`), `FakeModelAdapter`, `createLocalAdapter` and `createAdapter`, and `monthStamp`.
- `readModelFlags`, `planPaidRun` and `logSpend` (`scripts/lib/model-flags.ts`), and the resumable write-as-you-go pattern from `scripts/facts-map.ts`.
- `wilson` (`evals/search/metrics.ts:64`), `nextRunFile` (`evals/run-file.ts`), and the verify-and-check pattern (`evals/search/result.ts`, `scripts/search-eval.ts`).
- `objectFrom` (`src/screening/calls.ts`), if the boundary allows it.
- The boundary block pattern (`tests/boundary.test.ts:632`).

## Risks

- **One author for the patients, replies, chooser and reader prompt.** Mitigations:
  - patients first, split by hash;
  - a blind reading at Gate 1;
  - dev choices, with held-out scored once.

  The blind reader is a Claude model and the reader is Qwen. Replies a Claude model found clear may be easier than real ones. `docs/questions.md` says so.
- **Twenty patients is small.** Five dev patients make the scorer choice noisy. The curves are reported per patient as well as summed, so one outlier is visible.
- **The `shortlist` scorer's uniform average overrates rare answers.** That's the measured question (OQ 1), not a bug, and Gate 2 sees it.
- **Hint-driven pushes are wrong about a quarter of the time** (0002). They're counted, not fixed. The order is the place 0004 would change if Gate 2 says so.
- **The eval's speed.** About 20 patients × 5 arms × 3 scorers × up to 20 follow-ups, each scoring 31 facts × ≤6 answers over ~200 trials. That's seconds, not minutes. If it's slower, only the candidates that map a fact are re-statused (step 7). Tests never run the full eval.
- **The local model is down at stage C.** Stop and ask; never fall back to hosted.
- **The split gives dev too few patients.** The threshold isn't moved to fix it; Gate 1 decides.

## Verification

- `npm run check` at every commit; `npm test` stays around a second.
- `questions:eval -- --check` after steps 10 and 13. `search:eval -- --check` and `facts:eval -- --check` are unchanged at step 15.
- `questions:try` on two dev patients, output in Records. `facts:try` with the Chicago example, unchanged after the loader move.
- No `--spend` in any run. `evals/results/spend.jsonl` is unchanged.
- `git diff main` on the "not touched" paths is empty at step 15.

## Records

Written as the work goes: the baseline, the split, the knowledge rates, the blind reading, the gate answers, the dev curves, held-out, the reader's revisions and numbers, and the review findings.

- **Step 1.** Intent, spec and plan committed. Baseline 817 passed and 8 expected fail.
- **Step 2.** `AUTHORING.md` and the patient loader. Spec §5.2 amended: the coherence rule "prior treatments no more than the lines allow" is dropped, because adjuvant treatment before a recurrence counts toward no advanced line and checking it would take a clinical judgment. The loader checks the other three.
- **Step 3.** 20 patients written, revised once to Rule 4's rates before the split (26 facts made unknown, 11 made known), then split by hash: 3 dev (p08, p11, p17), 17 held-out. Rates 91% / 30% / 35%. p19's search keeps 2 trials. The blind reading agreed on all 434 hand-written replies. `questions:split` added to `package.json`. Record: `gate-1-patients.md`.
- **Gate 1.** Accepted, 3 dev.
- **Step 4.** Run loader moved to `src/facts/run.ts`; `facts:show` and `facts:try` print as before.
- **Step 5.** `src/shortlist/order.ts`: `orderTrials`, `shortlistOf` and `ORDER_KEYS`. An entry is a candidate and its status, or `null` for a trial the run didn't map.
- **Step 6.** `data/questions/conversation.json` and `src/questions/settings.ts`. `loadConversationSettings(vocabulary, path?, cancerType?)` takes the vocabulary first, so the committed file is the default.
- **Step 7.** `src/questions/select.ts` and `conversation.ts`.
  - **`shortlistChange` is exact and cheap.** An answer only adds hints, so only short-list trials that gain one can leave, and the trials that take their places are the next ones below that gain none. A test checks it against re-sorting every trial, for every fact and answer.
  - **`order.ts` gained `keyOf` and `compareKeys`,** so the chooser compares counts by the one definition of the order.
  - **Timing:** about 50 ms per conversation for 1,060 trials.
  - **While the tests were first written,** five of their expectations were wrong about the fixture, not the code: NCT04 and NCT05 don't map HIV, `brain_mets` is mapped by no trial, and a budget of 0 leaves ECOG open. They were corrected in the same commit; no existing test changed.
- **Step 8.** `evals/questions/arms.ts`, `metrics.ts` and `result.ts`, and `scripts/questions-eval.ts` (`questions:eval`, with `--dev` and `--check`).
  - **Dev results go to `evals/results/questions/dev/`,** and held-out runs, which include dev, go to `evals/results/questions/`, as `search:eval` does.
  - **The curve runs the conversation again with a budget of 20.** The same choices are made, so the conversation arm's list is the curve's at the budget.
  - **Would-flag is re-derived from the rows** through the record row's `recordFlagged`. The curves are checked only by `--check`, which reruns.
  - **The metrics test's numbers were worked out by hand before it ran,** and all of them held. One expectation in the result test was wrong: the fixture's all-zero hash matched the file name it was meant to reject. It was corrected while the test was written.
- **Step 9.** `questions:try`, the boundary block "question choice and the order reach no model", and the CLI and no-verdict tests.
  - **A bug found in the first transcript, and fixed in this step:** the oncologist sheet asked a man whether he was pregnant. `openQuestions` now takes the facts skipped for this person (`skippedFacts` in `settings.ts`), with a test.
  - **Dev run** `evals/results/questions/dev/01-e935d9c2c86e.json`, about 4 seconds; `--check --dev` matches it.
  - **Curves:** `shortlist` reaches the plateau in 1 to 4 follow-ups, `count` in 6 to 8. With what the patients know, the conversation ends at 90% agreement; knowing everything, at 100% by question 8.
  - **The order favours trials the mapper read little:** short-list trials carry about half the average candidate's mappings.
  - Record: `gate-2-finding.md` and `gate-2-transcripts.txt`. **→ Gate 2.**
- **Gate 2.** As recommended: `shortlist`, budget 8; the order kept, and handed to 0004.
- **Step 10.** Settings frozen: `shortlist`, budget 8. Held-out was scored once, in `evals/results/questions/01-867d9528f7e8.json` (18 s); `--check` matches it.
  - **At 8 follow-ups:** agreement 89% for `shortlist`, 85% for `count`, 83% for `fixed` and 79% for the intake alone. Knowing everything, `shortlist` reaches 95%.
  - **Per patient,** `shortlist` is never worse than either other scorer.
  - **Dev's "faster" didn't hold:** `count` leads at 2 to 5 follow-ups.
  - Written into `gate-2-finding.md`.

- **Step 11.** `src/questions/prompt.ts` and `read.ts`, with fake-adapter tests.
  - **`objectFrom` is copied, not imported:** `src/screening/calls.ts` imports the rest of the screening agent.
  - **A failure of the adapter itself is thrown, not read as unknown,** so a run records it and retries rather than counting it as a "don't know". This refines spec §7.1, which read bad JSON as unknown: JSON of the wrong shape still reads as unknown.
  - `src/questions/index.ts` doesn't export the reader, so the barrel stays model-free.
  - **The local model wasn't answering at the start of stage C** (connection refused on 127.0.0.1:8000).
- **Step 12, code.** `scripts/questions-read.ts` (`questions:read`), `evals/questions/reads.ts` (pairs, grading, `fromReads`), and `questions:eval -- --reads`.
  - **Reads files are named `evals/results/questions/reads/<set>-<model>-<prompt>.json`,** one per set, model and prompt, not `NN-<prompt>.json`. A stopped run resumes into its own file, and a prompt revision gets a new one. (Amended from the plan's naming.)
  - **The grading is in `reads.ts`, not a separate `read-grade.ts`.**
  - **Results answered from reads go to `evals/results/questions/with-reads/`,** so they never become the latest held-out result.
  - **Tests:** grading on a hand-worked fixture, and resume and failures with the fake adapter.
- **Step 12, dev reads** (local `Qwen3.6-35B-A3B-MLX-8bit`, 8-bit, temperature 0, seed 20260921; 93 pairs, about 100 s each run). Three prompts, all committed under `evals/results/questions/reads/`:

  | Prompt | Change | Exact (of 54) | Lost | Wrong | Invented (of 39) |
  | --- | --- | ---: | ---: | ---: | ---: |
  | `26b2af74` | original | 52 | 2 | 0 | 0 |
  | `c4cedd44` | revision 1: a line saying the answer is an id copied from the list | 51 | 3 | 0 | 0 |
  | `8cb01749` | revision 2: original wording; the layout quotes the ids (`READER_LAYOUT` 2) | **54** | 0 | 0 | 0 |

  - **Every loss was ECOG,** answered with `[1]`, a position in the list, where the id `ps1` reads like an ECOG score. The reader read each one as unknown, as designed.
  - **Revision 1's extra instruction made it worse,** as in 0002. Revision 2 changed the layout, not the words.
  - **`READER_LAYOUT` is now part of the prompt version,** as `SIMULATOR_LAYOUT` is for the participant.
  - **Frozen:** `8cb01749`.
- **Step 13.** Held-out read once with the frozen prompt `8cb01749` (527 pairs, 572 s, 0 failed).
  - **Known replies:** 326 of 326 exact (95% interval 98.8% to 100%).
  - **Don't-know replies:** 1 of 201 invented (0.5%; 0.1% to 2.8%). p05's "Non-small cell, that's all I remember" was read as another non-small cell type, where her record says adenocarcinoma.
  - **Conversations answered from the readings** (`evals/results/questions/with-reads/02-867d9528f7e8.json`; dev in `01`): only p05 changes. Her conversation's agreement rose from 70% to 80%, and her intake list's would-flag from 50% to 60%.
  - `--check --reads` matches. Record: `gate-3-reader.md`. **→ Gate 3.**
- **Gate 3.** Free text, with each reading confirmed by the person.
