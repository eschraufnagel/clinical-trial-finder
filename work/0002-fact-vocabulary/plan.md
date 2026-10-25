# plan: 0002 fact vocabulary

**Intent:** `work/0002-fact-vocabulary/intent.md` · **Spec:** `work/0002-fact-vocabulary/spec.md`
**Branch:** `0002-fact-vocabulary`, from `main` at `06bb0b7`; intent and spec `e388751`.

---

## Context

The search from 0001 leaves too many trials: 188 within 50 miles of downtown Chicago for one made-up person. To narrow them with a few questions, one answer has to settle many trials at once.

This slice builds three things:
- a vocabulary of about 31 patient facts;
- a model mapping from each NSCLC candidate trial's rules onto those facts, run offline;
- a deterministic status function, where an unknown never rules out.

It then measures two things against hand labels written first:
- **wrong rule-outs**, the safety number;
- **coverage**, whether a small vocabulary is enough at all.

**What it spends:**
- **Machine time:** the local model, for hours to days.
- **Money:** nothing unless the owner chooses a hosted model at Gate 2, with `--spend`.
- **Network:** none beyond the model call.
- **Dependencies:** none new.

**Baseline**, from `npm run check` on `e388751`: 752 passed and 8 expected fail.

**The local model** (`omlx`, `Qwen3.6-35B-A3B-MLX-8bit`, `http://127.0.0.1:8000/v1`) wasn't answering when this plan was written. Stage B's model steps need it running. If it isn't, Claude stops and asks the owner to start it, and doesn't fall back to a hosted model.

---

## Order of work

### Stages and gates

| Stage | Steps | Ends at | What you can see at the end |
| --- | --- | --- | --- |
| **A. Vocabulary and labels** | 1–5 | **Gate 1** | `data/facts/vocabulary.json`; 40 trials labelled. Coverage and vocabulary gaps are computed from the labels alone, with no model |
| **B. The mapper, tuned and scored** | 6–11 | **Gate 2** | Fake-adapter tests; a dev run tuned on the local model; the held-out set scored once; timing and a hosted dry-run estimate for all 1,129 |
| ~~C. The long run~~ | ~~12–13~~ | | *Replaced after Gate 2: see below.* |
| ~~D. Written up~~ | ~~14–15~~ | | |
| **C′. Hints, not rule-outs** (re-planned after Gate 2) | 12–13 | **Gate 3** | No mapping rules a trial out; the local model scored on held-out with the frozen prompt, beside Haiku |
| **D′. The long run** | 14–15 | — | All 1,129 candidates mapped, with a manifest; `facts:show` and `facts:try` print hints and question counts |
| **E′. Written up** | 16–17 | PR | docs, CLAUDE.md, README, roadmap, review passes |

**Gate 1: is the vocabulary worth spending model time on?** (intent, open question 1; spec §2.2, §5)
- **What's decided:** whether the 31 facts and the labels hold up before any model maps anything.
- **What the owner sees:**
  - the labels' coverage: of the rules that are rules, the share the vocabulary can express;
  - every `vocabulary-gap` note, grouped;
  - a blind relabel of 5 of the 40 trials by a separate agent, from `ANNOTATION.md`, compared passage by passage, as at 0001's Gate 2.
- **What it costs to be wrong:**
  - Changing a fact after stage B means relabelling every trial that touches it, re-tuning the prompt and rerunning the dev and held-out sets.
  - After stage C, it also means rerunning the 1,129, which is days of machine time.
- **The answer can be no.** A frequent gap ("prior EGFR TKI by generation", say) should become a fact now, and the affected labels are fixed in one commit.
- **Delegable:** the relabel needs no clinical judgment, and the owner may delegate the gate as before. Either way, `docs/facts.md` says no independent clinician checked the labels.

**Gate 2: run all 1,129 with this prompt, and on which model?** (spec §3.3, §3.4, §6.3)
- **What the owner sees:**
  - the held-out result against the spec's proposed bars: wrong rule-outs at most 3% of mappings and in at most 2 of 30 trials; mapping recall at least 0.6;
  - every held-out wrong rule-out, with its quote and label;
  - the dev run's seconds per thousand characters, and the projected local time for 5.1M characters;
  - the dry-run estimate for Haiku 4.5, standard and batch, printed without `--spend`.
- **The choices:**
  - local, overnight or longer;
  - hosted at the estimate, which needs the owner's explicit go-ahead for `--spend`;
  - the 689 that name lung cancer first, and the rest later;
  - stop and fix the prompt or vocabulary, as a finding.
- **What it costs to be wrong:**
  - The long run is the slice's biggest spend.
  - Its mappings are what 0003 builds question choice on.
  - A prompt with wrong rule-outs, run over 1,129 trials, silently drops trials for every later profile.
- **Also decided here:** whether the run's files are committed. Committing makes every 0003 result checkable from a fresh clone, at roughly 1,129 small files. The size is reported from the dev run.

**Gate 2, as answered** (owner, 2026-10; `gate-2-finding.md`): **no model mapping rules a trial out.** A mapping is a "may not fit" hint, shown with the trial's words when the person's answer is among those it rules out, and a reason to ask a question when the person hasn't answered. The person's answers flag; the oncologist decides. The trust list tried first didn't hold up on held-out.

**Gate 3: map all 1,129 on which model, and commit the files?** (re-planned after Gate 2)
- **What the owner sees:** both models on the same 30 held-out trials with the frozen prompt `5fea50034aea`: recall, which is now the number that matters most because a missed rule is a missing hint or question, and the wrong-hint rate. Also the dry-run cost, and the size of a run directory.
- **The choices:**
  - the local model, about 5 hours, free;
  - Haiku 4.5, about $7.84, which needs `--spend`;
  - and, separately, whether the 1,129 files are committed.
- **What it costs to be wrong:** 0003 chooses questions from these mappings. Missed rules mean questions never asked, and a rerun on the other model costs hours or dollars.

Stages D′ and E′ need no gate of their own.

### Steps

Each step is one commit, through `npm run check && git commit`. No test mocks a module or stubs a global; the adapter is injected, as the parser's is. No commit carries a Co-Authored-By trailer.

**Stage A: vocabulary and labels**

1. **Commit this plan** as `work/0002-fact-vocabulary/plan.md`, with two spec amendments marked "amended in plan":
   - **§5.2:** passages come from `splitPassages`, already exported by `scripts/label-criteria.ts` (line 102). It is imported, not moved: the file runs `main` only under `import.meta.main`.
   - **§3.4 and §6.3:** the held-out set is scored before the long run, and Gate 2 decides the long run from it. So the candidates run always uses a prompt whose held-out result is known.

2. **Topics and the vocabulary (spec §2).**
   - `scripts/facts-topics.ts` (`facts:topics`):
     - counts how many of the 1,129 candidates' eligibility text (by `normalizeText`) mentions each of a fixed topic list, written in the script with a line on each;
     - the candidates come from `candidateIds`, below;
     - prints a table, and writes nothing.
   - `scripts/facts-candidates.ts`: `candidateIds(trials, vocabulary)`. These are the treatment or no-purpose trials where `reasonsFor` (`src/search/vocabulary.ts`) is non-empty, sorted, with the names-or-rules trials first. Exported, and tested in `tests/scripts/facts-candidates.test.ts` on made-up trials.
   - Claude runs `facts:topics`, records its table in Records, and writes `data/facts/vocabulary.json` from the spec's 31-fact draft, adjusted by the counts. Each adjustment is recorded with its count.
   - `src/facts/types.ts` gets the vocabulary types, and `src/facts/vocabulary.ts` gets `loadFactVocabulary(path)`, its validation (spec §2.1) and `sha256`. `src/facts/index.ts` starts here.
   - **Tests:** `tests/facts/vocabulary.test.ts` (the committed file loads; each rule rejects; all problems reported together).
   - `package.json`: `facts:topics`.

3. **The labelling tools (spec §5).**
   - `evals/cases/facts/ANNOTATION.md`: the convention.
     - Rule 1: map only a rule that clearly states a requirement on one fact.
     - Rule 2: `rulesOut` is exactly what the rule excludes. "Not tested" is unknown.
     - Rule 3: arm-scoped rules carry `appliesTo`.
     - Rule 4: the five `unmapped` categories, with a test for each.
     - Worked cases: brain metastases "unless treated and stable", immunotherapy allowed "if more than 6 months ago", a biomarker cohort, a "no other cancer within 3 years" rule (there's no 3-year answer, so it maps to the answers it clearly rules out, and the 2–5 year answer stays unmapped), and a lab threshold.
   - `evals/facts/labels.ts`: types, `loadFactLabels(dir)` (validates against the vocabulary and the snapshot text: facts and answers exist, quote equals `criteriaText.slice(start, end)`, each passage has mappings or an `unmapped` category but not both) and `labelsSha256`.
   - `scripts/facts-sample.ts` (`facts:sample`):
     - orders the candidates by `sha256("0002:" + nctId)`: the first 10 are dev, the next 30 held-out;
     - writes one skeleton per trial, with `splitPassages` passages and `mappings: [], unmapped: null`;
     - refuses to overwrite.
   - `scripts/facts-label-show.ts` (`facts:label-show`): prints the trial header, its numbered passages and the vocabulary.
   - **`tests/boundary.test.ts`:** a new block, "the facts labelling tools cannot see the mapper". `facts-sample.ts` and `facts-label-show.ts` reach no file under `src/facts/` but `vocabulary.ts` and `types.ts`, and nothing under `src/models/`. It walks a real graph and would catch an import, in the style of line 468's block.
   - **Tests:** `tests/evals/facts-labels.test.ts` (the loader's rejections, on made-up labels in a `mkdtemp` directory).

4. **Draw and label.**
   - Run `facts:sample` and commit the 40 skeletons before any label is written.
   - Claude labels them from `facts:label-show` output, following `ANNOTATION.md`, in three commits: the 10 dev, held-out 1–15, held-out 16–30.
   - No mapping code exists yet.
   - Each commit records any convention question in Records.

5. **Coverage from the labels, then stop at Gate 1.**
   - `evals/facts/coverage.ts` with `coverageOf(labels)`: passages by category, mapped share of rules, and gap notes grouped by text. It is deterministic and tested in `tests/evals/facts-coverage.test.ts`.
   - `facts:eval -- --coverage` prints it (`scripts/facts-eval.ts` starts here, coverage only).
   - Then the blind relabel: a separate agent labels the 5 trials ordered first by `sha256("gate1:" + nctId)` among the 40, from `ANNOTATION.md` and `facts:label-show` only. It doesn't see these labels. Disagreements are written to `work/0002-fact-vocabulary/gate-1-labels.md`.
   - **Stop for Gate 1.** Any vocabulary or label change from the gate is one commit, recorded.

**Stage B: the mapper, tuned and scored**

6. **The mapper (spec §3.1, §3.2).**
   - `src/facts/types.ts` gains `FactMapping`, `TrialFacts` and `RejectedMapping`.
   - `src/facts/prompt.ts` has `SYSTEM_PROMPT`, `buildUserPrompt(trial, normalizedText, facts)` and `PROMPT_VERSION` (a hash of the system prompt, as in `src/criteria/prompt.ts`).
   - `src/facts/validate.ts` has `readMappingEnvelope(raw)` and the per-mapping rejections in spec §3.2.
   - `src/facts/map.ts` has `mapTrialFacts(trial: SnapshotTrial, vocabulary, adapter, options)`. It:
     - normalizes with `normalize` from `src/criteria/normalize.ts` (imported directly, not through `src/criteria/index.ts`, which would pull in the parser);
     - locates quotes with `locateQuote` from `src/criteria/locate.ts`, from 0 each time;
     - builds spans with `toSourceSpan`;
     - uses `maxOutputTokens` 8,192, with `finishReason === "length"` raising `FactMappingError`;
     - records `run` with `monthStamp()`.
   - **Tests:** `tests/facts/map.test.ts` with `FakeModelAdapter` (`src/models/fake.ts`): located quotes, each rejection reason, out-of-order quotes, truncation, an unreadable envelope, and the run metadata.

7. **Status (spec §4).**
   - `src/facts/status.ts` has `validateProfile`, `statusFor` and `dependsOn`.
   - **Tests:** `tests/facts/status.test.ts`:
     - for every fact in the committed vocabulary, an unanswered fact never rules out;
     - arm-scoped mappings only partly rule out;
     - several mappings on one fact;
     - a trial with none;
     - profile errors;
     - `dependsOn` counts.
   - **`tests/boundary.test.ts`:**
     - "the status function reaches no model": `status.ts` and `vocabulary.ts` reach nothing under `src/models/`;
     - "the search can't see the facts": nothing under `src/search/` reaches `src/facts/`;
     - "no file under `src/facts/` imports `src/models/factory.ts`".

     Each has a would-catch case.

8. **The grader (spec §6).**
   - `evals/facts/grade.ts` has `gradeTrial(labels, trialFacts)`, the matching and grading in §6.1, and `metricsOf(rows)` for §6.2. It reuses `wilson` from `evals/search/metrics.ts`.
   - `evals/facts/result.ts` has the result type and `verifyFactsResult`, in the style of `evals/search/result.ts`.
   - `scripts/facts-eval.ts` gains:
     - `--run <dir> --set dev|heldout`, which writes `evals/results/facts/NN-<run name>.json` (`nextRunFile`, `evals/run-file.ts`);
     - `--check`, which regrades the latest result.
   - **Tests:**
     - `tests/evals/facts-grade.test.ts`: exact, safe, wrong and unplaced on small tables; the `appliesTo` rule.
     - `tests/evals/facts-result.test.ts`: every committed result re-derives from its rows; on none, it proves it would fail on a tampered made-up result.

9. **The run command (spec §3.4).**
   - `scripts/lib/model-flags.ts`, copied from the prescreening repository's file of the same path with its test. It uses only exports `src/models/index.ts` already has.
   - `scripts/facts-map.ts` (`facts:map`):
     - `--set dev|heldout|candidates`;
     - the model from `--model` via `readModelFlags`, `omlx` by default;
     - a frontier model goes through `planPaidRun`, so it's dry without `--spend`;
     - the local adapter is built with `createLocalAdapter`, and a frontier one only through `createAdapter`, inside its budget wrapper;
     - each trial is written when it returns, already-written trials are skipped, and failures go to `failures.json`;
     - per-trial timing is printed, plus a summary of seconds per thousand characters;
     - the manifest is written only when `candidates` completes.
   - `tests/boundary.test.ts`'s "concrete adapters stay out of `scripts/`" rule still holds, since the factory builds them. A run confirms it.
   - **Tests:**
     - `tests/scripts/model-flags.test.ts` (copied);
     - `tests/scripts/facts-map.test.ts` on `runName`, the skip-written logic and the manifest, with a fake adapter and a `mkdtemp` directory.
   - `package.json`: `facts:map`, `facts:eval`.

10. **Tune on dev.**
    - Run `facts:map -- --set dev` on the local model, then `facts:eval -- --set dev`, and commit the result.
    - Change the prompt only for dev errors, wrong rule-outs first.
    - At most three prompt revisions, each one commit with its dev result and the errors it targeted, recorded.
    - Then freeze the prompt.
    - Run directories for dev live under `data/facts/2026-10/`, committed so the result files can be regraded.

11. **Score held-out, estimate the long run, stop at Gate 2.**
    - `facts:map -- --set heldout`, then `facts:eval -- --set heldout`, once. Commit both and record every wrong rule-out.
    - If a bar is missed: one more dev-only round, one more held-out run, then the result as found.
    - `facts:map -- --set candidates --model anthropic:claude-haiku-4-5` and the same with `--batch`, without `--spend`. They print the estimates, which are recorded.
    - Record the dev and held-out local timings and the projection for 1,129, plus the size of a run directory.
    - **Stop for Gate 2.**

**Stage C: the long run** — *replaced after Gate 2. Steps 12–15 as first planned weren't done; steps 12–17 below replace them.*

**Stage C′: hints, not rule-outs** (re-planned after Gate 2)

12. **No mapping rules a trial out (spec §4, amended).**
    - `src/facts/status.ts`: `statusFor(trial, profile, vocabulary)` returns `hints` (whole-trial mappings whose `rulesOut` holds the person's answer, each with its quote), `partHints` (the same for scoped mappings), `fits` and `unknown`. There is no `status` field and no "ruled-out" state. A fact with a hint counts as unknown, not as a fit. `dependsOn` counts, for each unanswered fact, the trials that map it. Every trial still counts, because none is ever dropped.
    - Remove `data/facts/trusted.json`, `loadTrustedFacts` and the trusted-set argument. Result 05 keeps the nine facts it names, and the grader's `trustedMetrics` stays readable for it.
    - **Tests:** `tests/facts/status.test.ts` checks every fact and every answer of the committed vocabulary: a mapping ruling out that answer, given that answer, yields a hint and never anything that removes the trial. Scoped mappings give `partHints`. Profile validation and `dependsOn` stay.
    - The grader's words change in its printed output, from "wrong rule-outs" to "wrong hints"; its numbers and field names stay, so committed results 01–05 still verify.

13. **The local model on held-out, with the frozen prompt.**
    - `facts:map -- --set heldout` on the local model with prompt `5fea50034aea` (restored at step 10), then `facts:eval -- --set heldout`. It's free and takes about 20 minutes.
    - This isn't tuning. The prompt is the one Haiku was scored with, and the comparison is between models for Gate 3.
    - Record both models' held-out recall and wrong-hint rate side by side, plus the run directory's size.
    - **Stop for Gate 3.**

**Stage D′: the long run**

14. **Map the candidates, as Gate 3 decided.** As step 12 was first planned: in the background, resumable, with a manifest. Then record counts, failures and time, and commit the run directory, or don't, as decided. `facts:eval -- --check` still passes. If committed, a test samples 20 mapping files by hash and checks quotes and run metadata against the manifest.

15. **Show and try (spec §1).**
    - `facts:show` as first planned.
    - `facts:try` prints the 0001 funnel, then, for the profile:
      - how many trials have hints and how many have none, and the five with the most hints, each hint with its quote;
      - `dependsOn` for the top facts: "an answer to this would flag N trials".
    - The profile in `evals/cases/facts/profiles/example.json` is as first planned.
    - Formatting is tested in `tests/scripts/facts-cli.test.ts`. Claude runs `facts:try` on the Chicago and Pierre searches and records the output.

**Stage E′: written up**

16. **Docs.**
    - `docs/facts.md` covers:
      - the vocabulary and why these facts;
      - coverage and its gaps;
      - every dev and held-out run, with model, quantization, temperature and seed;
      - the Gate 2 finding and decision, in plain words;
      - the trust list that didn't hold up;
      - that the labels, vocabulary and prompt have one author.
    - `CLAUDE.md`: layout, commands and boundary sentences, as first planned. One sentence under "Non-negotiable constraints" says that no model mapping rules a trial out.
    - `README.md`: `facts:try` in "Run it", with no numbers.
    - `work/ROADMAP.md`: 0002 done. 0003 is to choose questions by how many trials an answer would flag.

17. **Review passes (`REVIEW.md`)**, as step 15 was first planned. The PR says how each gate was answered, including that held-out missed both bars and what was decided.

## Files that change

**New:**
- `src/facts/index.ts`, `types.ts`, `vocabulary.ts`, `prompt.ts`, `validate.ts`, `map.ts`, `status.ts`
- `data/facts/vocabulary.json`, `data/facts/2026-10/` (dev and held-out runs; the candidates run if Gate 2 says commit; `latest`)
- `scripts/facts-topics.ts`, `facts-candidates.ts`, `facts-sample.ts`, `facts-label-show.ts`, `facts-map.ts`, `facts-eval.ts`, `facts-show.ts`, `facts-try.ts`, `lib/model-flags.ts`
- `evals/facts/labels.ts`, `coverage.ts`, `grade.ts`, `result.ts`
- `evals/cases/facts/ANNOTATION.md`, 40 label files, `profiles/example.json`
- `evals/results/facts/`
- `tests/facts/vocabulary.test.ts`, `map.test.ts`, `status.test.ts`
- `tests/evals/facts-labels.test.ts`, `facts-coverage.test.ts`, `facts-grade.test.ts`, `facts-result.test.ts`
- `tests/scripts/facts-candidates.test.ts`, `facts-map.test.ts`, `facts-cli.test.ts`, `model-flags.test.ts`
- `docs/facts.md`, `work/0002-fact-vocabulary/plan.md`, `gate-1-labels.md`, `gate-1-relabel.txt`, `gate-2-finding.md`
- `data/facts/trusted.json` (added at Gate 2, removed at step 12), `scripts/lib/model-flags.ts`

**Modified:**
- `tests/boundary.test.ts`, `package.json`
- `biome.jsonc` (ignore `data/facts/2026-10` and `evals/results/facts`, as for search)
- `CLAUDE.md`, `README.md`, `work/ROADMAP.md`, `work/0002-fact-vocabulary/spec.md` (the two amendments)

**Not touched, checked at step 15:** `src/criteria/`, `src/screening/`, `src/models/`, `src/search/`, `src/trials/`, `data/snapshot/`, `data/cancer-types/`, `evals/cases/search/`, `evals/results/search/`.

## Reused, not rebuilt

- `normalize`, `toSourceSpan` (`src/criteria/normalize.ts`) and `locateQuote` (`src/criteria/locate.ts`): normalization and quote locating, imported by module path.
- `splitPassages` (`scripts/label-criteria.ts:102`): passages for label skeletons.
- `FakeModelAdapter` (`src/models/fake.ts`), `createLocalAdapter` and `createAdapter` (`src/models/factory.ts`), `monthStamp`, and the estimate and spend helpers (`src/models/`).
- `readModelFlags`, `planPaidRun` and `logSpend` (prescreening `scripts/lib/model-flags.ts`): copied with their test.
- `reasonsFor`, `loadVocabulary` and `normalizeText` (`src/search/`), and `loadSnapshot` (`src/trials/snapshot-load.ts`): the candidates.
- `parseArgs` (`scripts/search.ts`) and `searchTrials`: for `facts:try`.
- `wilson` (`evals/search/metrics.ts`), `nextRunFile` (`evals/run-file.ts`), and the result-verification pattern (`evals/search/result.ts`, `tests/evals/search-result.test.ts`).
- The prompt-versioning pattern (`src/criteria/prompt.ts`) and the write-as-you-go cache (`evals/runner.ts`).

## Risks

- **The local model isn't running, or is slow.** Prescreening timings were 30 s to 4 min a trial, degrading over a batch. That means 1,129 trials could take two or more days. Gate 2 decides with measured numbers, and the run resumes.
- **One author for the vocabulary, labels and prompt.** Mitigations:
  - labels are written before any prompt exists;
  - the prompt is tuned on dev only, and held-out is scored once or twice;
  - a blind relabel of 5 trials at Gate 1.

  It's still one author, and `docs/facts.md` says so.
- **Arm-scoped rules missed by the model** become whole-trial rule-outs, the worst error. The grader counts a missing `appliesTo` as wrong, so it shows in the safety number.
- **The vocabulary is too coarse,** for example time windows that don't match a trial's (3 years against a 2–5 year answer). The convention maps only what's clearly ruled out, and the labels make the cost visible as gaps.
- **Spend.** No `--spend` without the owner's go-ahead at Gate 2. Dry estimates come first.
- **Repository size** if the long run is committed. It's decided at Gate 2 with the measured size.

## Verification

- `npm run check` at every commit, with `npm test` still around a second.
- `facts:eval -- --coverage` at Gate 1; `facts:eval -- --check` and `search:eval -- --check` at steps 11, 12 and 15.
- `facts:try` with the 0001 Chicago and Pierre searches, output recorded.
- No `--spend` appears in any run without the owner's recorded go-ahead. `evals/results/spend.jsonl` grows only if Gate 2 chose hosted.
- `git diff main` on the "not touched" paths is empty at step 15.

## Records

Written as the work goes: topic counts, vocabulary adjustments, convention questions, the gate answers, dev revisions, held-out numbers, timings and estimates, and the long run's counts.

- **Step 1.** Plan committed, with the two spec amendments.
- **Step 2, topic counts** (`npm run facts:topics`, 1,129 candidates; trials whose eligibility text mentions each topic):

  | Topic | Trials | | Topic | Trials |
  | --- | ---: | --- | --- | ---: |
  | performance status | 948 (84%) | | EGFR | 274 (24%) |
  | metastatic or recurrent | 825 (73%) | | resectable or early stage | 236 (21%) |
  | measurable disease | 755 (67%) | | platinum chemotherapy | 213 (19%) |
  | radiation | 697 (62%) | | lines of therapy | 188 (17%) |
  | brain metastases | 675 (60%) | | organ transplant | 181 (16%) |
  | pregnancy or breastfeeding | 633 (56%) | | ALK | 172 (15%) |
  | corticosteroids | 527 (47%) | | HER2 | 149 (13%) |
  | locally advanced, unresectable | 508 (45%) | | QTc | 135 (12%) |
  | HIV | 507 (45%) | | KRAS | 114 (10%) |
  | PD-1 or PD-L1 inhibitor | 503 (45%) | | antibody-drug conjugate | 111 (10%) |
  | hepatitis B or C | 474 (42%) | | BRAF | 104 (9%) |
  | heart attack, stroke, heart failure | 449 (40%) | | ROS1 | 95 (8%) |
  | interstitial lung disease or pneumonitis | 421 (37%) | | EGFR TKI | 90 (8%) |
  | labs: kidney and liver | 385 (34%) | | PD-L1 level | 66 (6%) |
  | labs: blood counts | 380 (34%) | | NTRK | 48 (4%) |
  | autoimmune disease | 367 (33%) | | MET | 37 (3%) |
  | leptomeningeal disease | 331 (29%) | | docetaxel | 28 (2%) |
  | squamous | 313 (28%) | | small cell component | 14 (1%) |
  | another cancer | 297 (26%) | | RET | 13 (1%) |

  Counts are floors: whole-word matches only, and a rule phrased differently is missed. The lab counts are low because most trials say "adequate organ function" and give the numbers in a table the words don't catch.
- **Step 2, the vocabulary.** The spec's draft has 30 facts, not the 31 it says. Three changes from the counts give 31:
  - **docetaxel dropped:** 28 trials (2%).
  - **daily steroids added** (`steroids_daily`): 527 trials (47%) mention corticosteroids, mostly "requiring systemic steroids" exclusions, which a person can answer.
  - **prior antibody-drug conjugate added** (`prior_adc`): 111 trials (10%), mostly excluding people who've had one with the same payload.
  - RET (13) and MET (37) stay. Few trials mention them, but for those trials they decide the cohort.
- **Step 3.** The labelling tools as planned. `skeleton` and `drawSample` are tested in `tests/evals/facts-labels.test.ts` beside the loader, which the plan didn't list. `ANNOTATION.md` has eight worked cases, three more than planned: histology from "confirmed NSCLC", extent from "stage IV or recurrent", and "squamous or non-squamous".
- **Step 4, the draw.** 1,515 passages across the 40 trials, from the splitter.
- **Step 4, the dev labels.** 10 trials. The convention gained a "Defaults for rules that recur" section while reading the first three, before any were saved. It covers age, sex and cancer type, which the search handles; washouts; ECG readings; recurring trial-specific rules; one fact with a different window; permitting and exception sentences; and pregnancy and breastfeeding. Questions that came up:
  - **Windows and thresholds that don't match a fact are frequent.** Autoimmune disease "currently requiring treatment", steroids "except up to 10 mg prednisone", pneumonitis "that required steroids", other cancer "active only", and brain metastases "symptomatic only" are all recorded as `vocabulary-gap`. Gate 1 sees how often each occurs.
  - **HER2 "expression" (IHC 1+ to 3+, HER2-low)** can't be ruled out from `her2: none_found`: someone with no HER2 mutation or amplification may still be IHC 1+. Recorded as a gap.
  - **Prior ADC rules name a payload or a drug** (T-DXd, topoisomerase inhibitors). `prior_adc: received` would over-exclude, so these are gaps.
  - **Rules conditional on another fact** ("if you have a driver mutation, you must have had its targeted therapy") can't be expressed by one mapping. They're `trial-specific`, note "conditional".
- **Step 4, the held-out labels.** 30 trials, in two commits as planned.
  - **Consistency fix.** While labelling the second half, a pattern turned out to have been labelled two ways: "pneumonitis that required steroids, or current pneumonitis". Two labels in the first commit (NCT06865339 and NCT07432295) treated it as a gap only. All three now map the current part to `ild: current`, with the steroid history as a note. No prompt existed yet, so this is a label fix, not tuning.
  - **More of the same window and threshold gaps** as in dev, plus three new kinds:
    - prior targeted therapy named by its target (KRAS, RAS, HER2, or EGFR/ALK/ROS1);
    - "able to stop steroids", as distinct from taking them;
    - transplant limited to allogeneic, bone marrow only, or on immunosuppressants.
- **Step 5.** `facts:eval -- --coverage` as planned. The blind relabel and its comparison are in `gate-1-labels.md`, with the relabel's own answers in `gate-1-relabel.txt` (a file the plan didn't list).
  - 88.2% of passages agreed before fixes, 90.0% after. Of passages both labellers mapped, 49 of 49 now match.
  - It caught a notation error in these labels: in four passages a cohort scope had attached to only the last of two mappings. Those are fixed, along with seven passages that missed worked cases 6 and 8, three of them found by searching all 40 trials for the same miss. Two convention points were added to `ANNOTATION.md`.
  - Coverage after the fixes: rules about the person mapped 40.7% (all 40 trials) and 41.3% (held-out).
  - **Stopped for Gate 1.**
- **Gate 1, answered (owner, 2026-10): make the four vocabulary changes, then go on to stage B.** The changes are steroids by dose, prior ADC by payload, brain metastases with symptoms split out, and autoimmune reworded. Details and before-and-after coverage are in `gate-1-labels.md`. Rules about the person mapped: 43.3% overall, 43.8% held-out.
- **Step 6.** The mapper as planned. `map.ts` imports `locateQuote`, `normalize` and `monthStamp` from their modules, not from the `src/criteria/` and `src/models/` barrels, so it reaches neither the parser nor the factory. Two things the plan didn't say: an exact repeat (same fact, same quote, same answers) is rejected; and `run` records the cancer type.
- **Step 7.** Status and its tests as planned. The "search can't see the facts" rule widens the existing search block's forbidden list rather than adding a block. The other two rules are one new block.
- **Step 8.** The grader. Two changes from the spec, both amended in plan:
  - **Displaced matches.** A model mapping that overlaps no labelled mapping of its fact is compared with that fact's other labelled mappings in the same trial, and marked `displaced`. A model that quotes the exception sentence beside a rule, with the right answers, would otherwise be graded wrong.
  - **Result file names** are `NN-<prompt version>.json`, which is what `nextRunFile` accepts. The run name, which carries the model, is recorded inside.
  - `biome.jsonc` ignores `evals/results/facts` and `data/facts/2026-10`, as planned.
- **Step 9.** `scripts/lib/model-flags.ts` and its test are copied from the prescreening repository. The test drops its block on that repository's two eval scripts, which aren't here, and `tests/scripts/facts-map.test.ts` tests this script's dry plan instead. `facts:map` gained `--limit N`, for timing a few trials. `--batch` changes only the estimate: a batch run, if Gate 2 chooses one, needs `createAdapter`'s batch ledger wired in first.
- **Step 10, the local model.** `facts:map` loads `.env` with `node --env-file-if-exists=.env`, as the prescreening repository's model scripts did. The plan didn't say how the key reaches the script. The owner put it in `.env`; Claude didn't edit that file.
- **Step 10, dev run 1** (prompt `5fea50034aea`; `evals/results/facts/01-5fea50034aea.json`). Qwen3.6-35B-A3B-MLX-8bit, 8-bit, temperature 0, seed 20260921. 10 trials, 107 mappings, 109 labelled.
  - Wrong rule-outs 32 (29.9%): 20 whole-trial, in 8 of 10 trials. Mapping recall 62.4%. Exact share of matched mappings 87.8%.
  - Timing: 3.4 s per 1,000 characters after the first trial (36 s for a 3,000-character trial while the model loaded).
  - What the wrong mappings are:
    - rules inside another cancer type's cohort, mapped with a scope (10);
    - the same fact with a different window or condition (7), e.g. a 3-year other-cancer window ruling out `two_to_5_years`, or "pneumonitis that required steroids";
    - "symptomatic" brain metastases ruling out `not_stable_no_symptoms` too (3);
    - permission sentences read as exclusions (5), including "active brain metastases are eligible if…";
    - misreadings (7), e.g. "active uncontrolled HIV" ruling out `controlled`.
- **Step 10, revision 1** (prompt `5ecc777c8cf0`; `evals/results/facts/02-5ecc777c8cf0.json`). Concrete rules were added: permissions rule nothing out, qualifiers limit the answers, conditions no answer states, "advanced" means `early_resectable` only, and other cancers' cohorts are skipped. **Worse:** wrong rule-outs 40 of 108 (37.0%), 28 whole-trial, in 8 trials; recall 57.8%.
  - The new failure: vague lines ("progressed on or unsuitable for standard therapies") became `never` on five prior-therapy facts at once.
  - Scopes written in parentheses ("(Phase 2)") were still missed.
  - Rules with conditions no answer states were still mapped.
  - The model doesn't apply rules stated in prose to each answer.
- **Step 10, revision 2** (prompt `9fc7daa0b186`; `evals/results/facts/03-9fc7daa0b186.json`). The model gives a verdict on every answer (`excluded`, `allowed`, `unclear`), and only `excluded` answers are ruled out. Amended in plan: the validator accepts either form. **Worse again:** wrong rule-outs 53 of 124 (42.7%), 42 whole-trial, in 9 trials; recall 60.6%. 27 mappings had no `excluded` answer and were rejected.
  - Still mapping whole-trial rules the labels scope, reading permissions and "any significant medical condition" as rules, and ruling out answers the rule's condition doesn't cover.
  - Slower: 5.5 s per 1,000 characters.
  - **Finding after three dev runs:** on this local model, every added instruction raised the wrong rule-out rate (29.9%, 37.0%, 42.7%), against a 3% bar. One revision is left in the plan. Claude stopped to ask the owner rather than spend it or the held-out set's one look.
- **Step 10, Haiku 4.5 on dev** (owner's go-ahead for `--spend --max-usd 0.50`; original prompt `5fea50034aea`, restored; `evals/results/facts/04-5fea50034aea.json`). claude-haiku-4-5, temperature 0, no seed (the API has none). $0.08 spent, logged in `evals/results/spend.jsonl`.
  - 9 of 10 trials graded. NCT05215353 failed: Haiku wrapped `{"mappings": []}` in prose, and it wasn't paid for again.
  - Wrong rule-outs 19 of 79 (24.1%), 17 whole-trial, across the 9 graded trials. Recall 55.6%. 10 mappings were rejected because their quotes weren't in the text.
  - 1.0 s per 1,000 characters.
- **Step 11, brought forward: Gate 2 before held-out.** All four dev runs missed the bar by eight times or more, so held-out's one look wasn't spent on a prompt that couldn't pass. `gate-2-finding.md` has the four runs, the errors by fact and by kind, the costs, and Claude's recommendation:
  - rule out only on nine facts that had no wrong rule-out on Haiku's dev run;
  - count mappings on every other fact as unknown, shown with their quotes;
  - fix that list before held-out, then score held-out once on Haiku.

  **Stopped for Gate 2.**
- **Gate 2, answered (owner, 2026-10): take the recommendation.** The nine trusted facts are in `data/facts/trusted.json`, a list of per-fact flags. It sits beside `vocabulary.json`, so labels and runs keep naming the same vocabulary checksum. `statusFor` takes the trusted set: a mapping on an untrusted fact goes to `mayNotFitBy`, and its fact counts as unknown. Tests check every untrusted fact. Then held-out is scored once on Haiku.
- **Step 11, held-out, scored once** (owner's go-ahead; Haiku 4.5, original prompt `5fea50034aea`; `evals/results/facts/05-5fea50034aea.json`). $0.20 spent, logged. 30 trials in 168 s.
  - **All facts:** wrong rule-outs 60 of 230 (26.1%, 95% interval 20.8% to 32.1%); 59 whole-trial, in 21 of 30 trials. Recall 72.7% (170 of 234). Exact share of matched 90.7%.
  - **The 9 trusted facts:** wrong rule-outs 19 of 95 (20.0%, 13.2% to 29.1%); 18 whole-trial, in 13 trials. Recall 67.3% (76 of 113). **The trust list didn't hold up:** 0 of 34 on dev, where it was chosen, and 19 of 95 on held-out.
  - About 5 of the 19 are arguable grading artefacts: extent rules in trials for other cancers, which the labels call the search's, and two staging readings. The rest are real: steroid thresholds and "unable to stop", "heart attack within 1 year", a pregnancy-only rule, and missed scopes ("0-1 in 1a", KRAS in dose escalation).
  - Both bars are missed for all facts and for the trusted facts. **Stopped to report.**
- **Gate 2, after held-out (owner, 2026-10): no model mapping rules a trial out.** Mappings become "may not fit" hints with quotes, and drive which questions to ask; the person's answers flag and the oncologist decides. The finding is in `gate-2-finding.md`. Steps 12–15 as first planned are replaced by steps 12–17 above, with Gate 3 deciding the long run's model.
- **Step 12.** `statusFor` returns `hints`, `partHints`, `fits` and `unknown`, with no status. A test runs every answer of every fact and checks that each yields only a hint. `dependsOn` counts every trial for each fact the person hasn't answered. One change from the re-plan: `dependsOn` skips a fact the person answered even where a hint covers it, since a hinted fact is unknown only in the sense of unsettled, and the question has been asked. `data/facts/trusted.json` and its loader are removed. `evals/facts/result.ts` keeps reading result 05's record of the list. The grader prints "wrong hints".
- **Step 13, the local model on held-out** (frozen prompt `5fea50034aea`; `evals/results/facts/06-5fea50034aea.json`). Qwen3.6-35B-A3B-MLX-8bit, 8-bit, temperature 0, seed 20260921. 29 of 30 graded. NCT06710379 timed out: one request was aborted after about 30 minutes, and the run went on.
  - Wrong hints 89 of 254 (35.0%), in 26 of 29 trials. Recall 71.8% (163 of 227). Exact share of matched 80.2%.
  - Time: 2,482 s in all. Of that, 716 s mapped 118,831 characters (6.0 s per 1,000), and about 1,770 s was the one timeout.
  - Run directories are about 5.5 KB a trial, so about 6 MB for 1,129.
  - Beside Haiku on the same prompt (result 05, all 30 trials): wrong hints 26.1%, recall 72.7%, 1.4 s per 1,000 characters, $0.20.
  - **Stopped for Gate 3.**
- **Gate 3, answered (owner, 2026-10): run all 1,129 on Haiku 4.5** with `--spend --max-calls 1200 --max-usd 10`, and commit the run files (about 6 MB). It goes in the same run directory as the dev and held-out Haiku mappings, which are skipped as already written.
- **Gate 3, changed (owner, 2026-10): the local model, not Haiku.** The Haiku long run started and was stopped by the owner after 28 new trials (67 of 1,129 in its directory) and about $0.20. The stop skipped the script's spend line, so an estimated line, marked `"estimated": true`, is in `evals/results/spend.jsonl`. The 67 stay committed as a partial run with no manifest.
  - Why local: with mappings only giving hints, Haiku's lower wrong-hint rate matters less. Recall is about the same (71.8% local, 72.7% Haiku). And the local model is the project's default.
  - The local long run uses the local run directory, which already holds the dev and held-out trials, so the whole set comes from one model and one prompt.
- **Step 14, the long run** (local model, free; Qwen3.6-35B-A3B-MLX-8bit, 8-bit, temperature 0, seed 20260921, prompt `5fea50034aea`). Kept awake with `caffeinate -i`.
  - **First pass:** 1,090 trials in 26,291 s (7.3 h), 5.6 s per 1,000 characters. 27 failed.
  - **Retry of the 27:** 9 recovered, in 3,085 s.
  - **Manifest:** 1,111 of 1,129 mapped, 18 failed, 9,625 mappings, 949 rejected. Run directory 6.3 MB, committed. `data/facts/2026-10/latest` names it.
  - **The 18 failures:** 17 replies put the whole answer in `reasoning_content`, the model's thinking channel, and left `content` empty. One reply wasn't a JSON object. Reading `reasoning_content` would mean changing the inherited oMLX adapter, which this slice doesn't touch. A trial with no mappings has no hints and is never dropped, so the 18 stay unmapped and named in `failures.json`.
  - **Two changes from the plan:** the manifest is written whenever a candidates run ends without hitting its budget, counting failures as spec §3.4 says, rather than only when nothing failed; and it has no `seconds` field, since a run done in several invocations has no single time. `--limit 0` rewrites the manifest from the files.
  - **Checks:** `tests/facts/run-sample.test.ts` checks 20 files by hash against the manifest and vocabulary. A one-off script checked all 9,625 quotes against the snapshot text: 0 mismatched.
- **Step 15.** `facts:show` and `facts:try` as re-planned, with formatting tested in `tests/scripts/facts-cli.test.ts`.
  - **Two choices made while writing them:**
    - whole-trial hints rank the "most hints" list, with part-of-trial hints counted separately, because the model still maps rules inside other cancers' cohorts (with a scope) despite the prompt;
    - `dependsOn` lists the facts the person hasn't answered.
  - **The example profile:** stage IV adenocarcinoma, no brain metastases, ECOG 1, progressed on a PD-1 inhibitor and on platinum, one line for advanced disease. EGFR, ALK and the rest are unknown.
  - **Chicago 60611, 50 miles:** 188 trials; 181 mapped, 7 not (among the 18 failures).
    - 59 have a whole-trial hint, 12 a hint only for part of the trial, 110 none. All 188 stay.
    - Top hint: NCT02984761, a stage I surgery-or-radiotherapy trial, hinted on extent four times with its own words.
    - The questions that would flag the most trials: measurable disease (120 trials), another cancer (78), pneumonitis or ILD (75), pregnancy (73), leptomeningeal disease (66), HIV (62), autoimmune (59), hepatitis (51).
  - **Pierre 57501, 100 miles:** 2 trials, both mapped; 1 with a hint. Measurable disease would flag both.
- **Step 16.** `docs/facts.md`, `CLAUDE.md` (layout, commands, boundary sentences, and a constraint that no rule a model reads removes a trial), `README.md` (`facts:try`, with no numbers) and `work/ROADMAP.md` (0002 done; 0003 chooses questions by how many trials an answer would flag).
