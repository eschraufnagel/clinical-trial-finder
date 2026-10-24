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
| **C. The long run** | 12–13 | — | All 1,129 candidates mapped, with a manifest; `facts:show` and `facts:try` working |
| **D. Written up** | 14–15 | PR | docs, CLAUDE.md, README, roadmap, review passes |

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

Stage C needs no gate of its own; it carries out Gate 2's answer. Stage D is documentation and the review passes.

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

**Stage C: the long run**

12. **Map the candidates, as Gate 2 decided.**
    - The run goes in the background with progress in its log. It resumes if stopped.
    - When the manifest is written: record counts, failures and time, and commit the run directory, or don't, as decided.
    - `facts:eval -- --check` still passes.
    - A test samples 20 committed mapping files, chosen by hash, and checks each quote against the snapshot text at its span and the run metadata against the manifest.

13. **Show and try (spec §1).**
    - `scripts/facts-show.ts` (`facts:show`); `--run` defaults to the run named in `data/facts/2026-10/latest`, written at step 12.
    - `scripts/facts-try.ts` (`facts:try`): `parseArgs` from `scripts/search.ts` for the search flags, plus `--profile`. It prints the 0001 funnel, then ruled out, open and fitting, then `dependsOn` for the top facts.
    - `evals/cases/facts/profiles/example.json`: a made-up profile (stage IV adenocarcinoma, no brain metastases, ECOG 1, progressed on a PD-1 inhibitor and platinum, EGFR and ALK unknown).
    - Formatting functions are exported and tested in `tests/scripts/facts-cli.test.ts`.
    - Claude runs `facts:try` with the 0001 Chicago and Pierre searches and records the output.

**Stage D: written up**

14. **Docs.**
    - `docs/facts.md`:
      - what the vocabulary is and why these facts;
      - coverage and its gaps;
      - the held-out result with every wrong rule-out;
      - the model, quantization, temperature and seed;
      - that the labels and vocabulary have one author;
      - what the dev numbers are worth.
    - `CLAUDE.md`:
      - "Where things live": `src/facts/`, `data/facts/`, `evals/cases/facts/`, `evals/facts/`;
      - the commands;
      - the boundary sentences.
    - `README.md`: `facts:try` in "Run it", with no numbers.
    - `work/ROADMAP.md`: 0002 marked done.

15. **Review passes (`REVIEW.md`)**, recorded here.
    - All five against `git diff main`.
    - `npm run check`, `facts:eval -- --check` and `search:eval -- --check`.
    - "Files that change" against `git diff --stat main`.
    - Then stop. The PR is opened on the owner's word, saying how each gate was answered.

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
- `docs/facts.md`, `work/0002-fact-vocabulary/plan.md`, `gate-1-labels.md`

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
