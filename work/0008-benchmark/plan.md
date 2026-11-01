# plan: 0008 benchmark

**Intent:** [intent.md](intent.md). **Spec:** [spec.md](spec.md). Spec sections are cited as §n.

## Context

Every number in this repository so far is scored against one author's labels. `docs/questions.md` says the record arm "is what the mapper says … that needs the benchmark in slice 0008". 0007's check was scored against labels by the author of its patients. The roadmap measures this slice by research §6's three-way comparison.

The two public benchmarks were checked while writing the intent (2026-10). Neither fits that comparison for NSCLC:
- **TREC 2021/2022** has 9 notes about a current cancer and none about lung cancer.
- **NIH-TrialBench** (public domain, NLM notice) has 41 NCI vignettes, 2 of them NSCLC, with 395 clinician-labelled pairs.

So this slice measures what the benchmarks can test:
1. **the search on TREC's nine cancer notes,** over their 4,297 judged trials in 2021's text, no model (§3, §5);
2. **the search on NIH-TrialBench's 41 NCI vignettes** over the 2026-10 snapshot, keeping each vignette's target trial, no model (§6);
3. **the deeper check against clinicians' labels** on 70 NIH-TrialBench pairs, in two arms: from the full file, and from what a patient would know. Local model; dev, then held-out once after Gate 2 (§7);
4. **the comparison write-up,** `docs/benchmark.md` (§8).

Twenty search-only vocabularies for other cancers make parts 1 and 2 possible (§4). Nothing on the page changes. No hosted spend is proposed.

**What exists to build on:**
- **`src/search/`:**
  - `searchTrials(trials, manifest, vocabulary, zipPoints, request, others)` runs purpose, cancer, age and sex, then distance (`search.ts:20`), over any `SnapshotTrial[]`;
  - `reasonsFor`, `loadVocabulary(id)` and `CancerType.measured`;
  - `scripts/search.ts:147` already prints "hasn't been measured yet" for an unmeasured type.
- **`src/trials/`:** `SnapshotTrial` (`snapshot-types.ts`), `loadSnapshot` (`snapshot-load.ts`).
- **`evals/search/`:** `wilson` and `metricsFor` (`metrics.ts`); `scripts/search-eval.ts`'s result writing and `--check` pattern; `evals/run-file.ts`'s `nextRunFile`.
- **`src/check/`:**
  - `startCheck({ study, criteriaText, parsed, facts: undefined, answers: new Map(), adapter })` is the inherited path with nothing carried;
  - `recordOf`, `MAY_NOT_FIT`, `MAY_NOT_FIT_PART`, `LINK_THRESHOLD` and `overlap` (`link.ts`);
  - `parseWithCache(trial, adapter, dir)`, `findParse`, `latestCriteriaRun(month, root)`, which reads `<root>/<month>/latest` and so works for `"trialbench"` unchanged.
- **`src/criteria/`:** `ParseableTrial` is `nctId`, `briefTitle`, `conditions`, `phases`, `eligibility`.
- **`evals/check/`:** `checkPair`'s loop, `MAX_TURNS`, `CHECK_REVISION` (`run.ts`); `PairTranscript` (`transcript.ts`); `runHash`, `fileSha256`, `regradeProblems` (`result.ts`); the scoring in `metrics.ts`, including the never-a-verdict and unknowns checks.
- **`evals/participant/`:**
  - `patient.ts`, 0007's participant: blind by signature, `readReply`'s one retry;
  - `fidelity.ts`: `deterministicFlags`, `modelFidelityCheck`, `UNCITED_LENGTH`, `NOT_KNOWING`;
  - `prompt.ts`: `hashPrompt`-based versions.
- **`scripts/check-parse.ts` and `scripts/check-eval.ts`:** the local adapter with `thinking: false` for the check, resumable run directories, `failures.json`, the held-out refusal, and `planPaidRun` / `logSpend` from `scripts/lib/model-flags.ts`.
- **`src/shortlist/words.ts`:** `verdictHits`.
- **`tests/boundary.test.ts`:** "no network under src/" (line 268) and the graph-walking blocks, one per rule.

**Checked while writing this plan:**
- NIH-TrialBench at commit `1c5f9ebc3b98`: 41 NCI vignettes; 395 NCI pairs over 106 trials (274 recommended, 86 eligible but not recommended, 35 ineligible, 33 of them with a comment); all 13 targets are among the 106; 10 targets in the 2026-10 snapshot, covering 29 vignettes.
- The pair draw and split of §7.1: 70 pairs over 42 trials and 35 vignettes; dev 14 pairs (5 ineligible) over 12 trials and 8 vignettes; held-out 56 (30 ineligible).
- TREC: the nine notes of §3.1 hold 4,672 judgments of 4,297 trials (888 eligible, 781 excluded, 3,003 not relevant). The corpus is five zips, 1.8 GB.

## Order of work

### Stages and gates

| Stage | Steps | Ends at | What you can see at the end |
| --- | --- | --- | --- |
| **A. Inputs, frozen** | 1–6 | **Gate 1** | the benchmark data imported and committed; `personStages`; 20 vocabularies and every profile; `KNOWING.md`, 35 accounts and a second derivation of 8; the clinicians' named rules; the 70 pairs. Nothing scored, nothing parsed |
| **B. The search, scored once** | 7–8 | — | the TREC result and the NIH-TrialBench search result |
| **C. The check, dev** | 9–12 | **Gate 2** | the summary participant; dev's 12 trials parsed; 14 dev pairs checked in both arms on the local model; `gate-2-dev.md` |
| **D. The check, held-out** | 13–14 | — | the other 30 trials parsed; 56 held-out pairs checked once in both arms |
| **E. Written up** | 15–16 | PR | `docs/benchmark.md`, the Limits elsewhere, roadmap, README, CLAUDE.md, review passes |

**Before step 3, a person downloads the benchmark files** (§2.1) into `local/benchmark/`: the owner, or the implementer after the owner says so in chat. It's 1.8 GB from `trec-cds.org` and about 15 MB more. It isn't a gate, since nothing is decided, but no step past 2 can start without it. The implementer stops and asks if `local/benchmark/` is missing.

**Gate 1: freeze the inputs, and spend local-model time on the check?** (§3.1, §4.1, §7.1, §7.3, §7.5, OQ 3, OQ 4, OQ 5, OQ 9)
- **What's decided:**
  - **The nine notes** (§3.1): whether 2021's 13, 20 or 56 should count, or any of the nine shouldn't.
  - **The twenty vocabularies and every profile's type,** especially the four mappings §4.1 flags: urachal to `bladder`, small-cell and squamous bladder to `bladder`, renal medullary to `kidney`, NCI 19 to `urethral`. The owner can correct a word or a mapping now. After step 7 a change makes the result tuned.
  - **The accounts:** whether `KNOWING.md` hides the right things, read on the 35 accounts and on the 8 where a second agent derived its own, with every disagreement listed. This is the one judgment in the slice only a person can make: what a patient would know.
  - **The named rules** in `reasons.json`: each ineligible pair's comment beside the quote chosen for it, and which comments were read as "disease" or "no rule".
  - **Go on to the check, or stop after the search.** Stage C spends about an hour parsing 12 trials and roughly 3 to 7 hours checking 28 dev arms on the owner's machine. Stopping cuts stages C and D; the slice ships A, B and E, and the write-up says the check wasn't run against clinicians.
- **What the owner sees:** `work/0008-benchmark/gate-1-inputs.md`:
  - the nine notes' first lines, with their profiles;
  - each vocabulary's names, MeSH headings and biomarkers in one table;
  - the vignette-to-type mapping;
  - the 8 doubly derived accounts side by side, with their disagreements;
  - `reasons.json` beside each comment;
  - the 70 pairs by label and set.
- **What it costs to be wrong:**
  - Both searches are scored once. A vocabulary or mapping fixed after step 7 or 8 is tuned on the result, and says so.
  - The accounts are the "what they'd know" arm. If they hide too little, the two arms measure the same thing. If they hide too much, the arm measures a patient who knows nothing. Either way, about a day of local-model time across stages C and D goes on the wrong question.
  - A wrong named rule miscounts "caught for the named rule", and can't be corrected after the run without seeing outcomes.
- **Can be no:**
  - **"revise":** any input above, then Gate 1 again;
  - **"stop after the search":** stages B and E only.

**Gate 2: spend held-out's one look?** (§7.8, OQ 6)
- **What's decided:**
  - **Run held-out or not.** Stage D, once: parse 30 more trials, then `benchmark:check` with no flag, both arms. The alternatives are a revision on dev, or stopping with the dev finding beside the search results.
  - **Whether the account arm earns its hours.** If dev's two arms differ on nothing, the owner can run held-out on the full file only, halving stage D.
- **The bar, frozen now, before dev runs.** Dev must show, in both arms:
  1. no `verdictHits` in any agent turn or record string;
  2. every `unresolved`, `chart-review` or not-asked criterion on its record;
  3. every fidelity flag on dev's replies read and explained in the gate page, and no finding scored from a flagged turn;
  4. every dev pair finished, or listed with why (`parse: "failed"`, `MAX_TURNS`).

  Caught and false alarms are shown, not barred: 14 pairs can't measure a rate.
- **What the owner sees:** `work/0008-benchmark/gate-2-dev.md`:
  - every measure in §7.7, per pair and per arm;
  - each caught, missed and false-alarm pair, with its "may not fit" lines, the trial's words, the participant's words and the clinician's comment;
  - each fidelity flag with its reply;
  - the arms' differences pair by pair;
  - two dev records rendered as text;
  - how long dev took per check, and the estimate for held-out.
- **What it costs to be wrong:**
  - Held-out is read once; anything changed after it is tuned on it.
  - Stage D spends about 112 checks of local time. At 0007's held-out pace (9 minutes a pair, long trials up to 52) that's roughly 15 to 30 hours. NIH Clinical Center trials have long criteria, so the gate page's dev timing sets the real estimate.
- **Can be no:**
  - **"revise on dev":** the participant's prompt or a fix in the runner, never the agent's prompts; then Gate 2 again;
  - **"stop":** the slice ships A to C and E, with dev reported as a dev finding.

Stages B, D and E need no gate.
- **Stage B:** Gate 1 froze its inputs, and it's reported whatever it shows.
- **Stage D:** Gate 2 decided whether to look.
- **Stage E:** documentation.

**No hosted run is in this plan.** Every model run is on the local model (Qwen3.6-35B-A3B-MLX-8bit, temperature 0, seed 20260921), which the owner's machine must be serving. If the owner asks for a hosted run at either gate, it's a new gate: dry first with `--model <spec>` and no `--spend`, recorded here before it runs. Nothing creates or edits `.env`.

### Steps

Each step is one commit, through `npm run check && git commit`. No commit carries a Co-Authored-By trailer. No test mocks a module or stubs a global. Dates are months. No test reads `local/`.

**Stage A: inputs, frozen**

1. **Commit intent, spec and this plan.** Record the baseline in Records:
   - `npm run check` exits 0, with the test count and `npm test`'s time;
   - `npm run test:e2e` passes;
   - `search:eval -- --check`, `questions:eval -- --check` and `-- --check --dev`, `facts:eval -- --check`, and `check:eval -- --check` and `-- --check --dev` pass;
   - `other:eval -- --check` and `-- --check --dev` fail with only "labelsSha256 differs", as 0006 and 0007 recorded. A separate task; "unchanged" for these two means that one difference.

2. **`personStages`** (§3.4).
   - **`src/search/search.ts`:** `export function personStages(trials, vocabulary, request): { entries: { trial, reasons, age }[]; funnel: SearchResult["funnel"] }`, the purpose, cancer, and age-and-sex stages moved out of `searchTrials` as they are. `searchTrials` calls it, then places. `src/search/index.ts` exports it.
   - **Tests, `tests/search/search.test.ts`:** on the existing fixtures, `personStages`' entries are the trials `searchTrials` places before distance, and its funnel is `searchTrials`' first four stages; the existing search tests pass unchanged.
   - `search:eval -- --check`, `other:eval -- --check` (its one known difference) and `questions:eval -- --check` are rerun and recorded as unchanged.

3. **The TREC XML reader** (§3.3).
   - **`evals/benchmark/trec-xml.ts`:** `readTrecTrial(xml: string): SnapshotTrial`. A small tag reader for the fields in §3.3's table:
     - `textOf(xml, path)` and `allOf(xml, path)` over nested tags;
     - decoding of `&amp; &lt; &gt; &quot; &apos;` and numeric entities;
     - `primaryPurpose` upper-cased with spaces as `_`;
     - `phases` from "Phase 1/Phase 2" to `["PHASE1", "PHASE2"]`, and "N/A" to `[]`, as the snapshot spells them;
     - `sites: []`, `conditionAncestors: []`.

     A missing required tag (`nct_id`, `brief_title`) throws, naming the trial and the tag. A missing `criteria` gives `criteriaText: ""`, as the snapshot does.
   - **Fixtures:** three judged trials' files from the downloaded corpus, copied whole to `tests/benchmark/fixtures/`. They're public registry records. One has MeSH terms and a two-phase label, one has no `condition_browse`, one has entities in its criteria.
   - **Tests, `tests/benchmark/trec-xml.test.ts`:** every field on each fixture, entity decoding, the throws.
   - If the reader can't read a judged trial at step 4, the step stops and Records say how many. A parser dependency is then a plan change for the owner, not an implementation detail.

4. **The import** (§2).
   - **`evals/benchmark/sources.ts`:** the manifest type, `checkSources(dir, manifest)` returning each mismatch, and the paths under `local/benchmark/`.
   - **`evals/benchmark/trec.ts`:** `TREC_TOPICS` (the nine `{ year, number }` of §3.1), `readTopics(xml, year)`, `readQrels(text, year)`, and the committed files' loaders with their checks.
   - **`evals/benchmark/trialbench.ts`:** the release's row types; `readNciRows(rawDir)` keeps `ic === "NCI"`; the committed files' loaders with their checks.
   - **`scripts/benchmark-import.ts`** (`npm run benchmark:import`):
     - on first run, with `--record`, writes `data/benchmark/sources.json`: each input's sha256, NIH-TrialBench's commit, the licenses as stated, and the citations;
     - afterwards, refuses on any checksum mismatch;
     - writes `data/benchmark/trec/{topics,qrels}.json` and `trials.jsonl.gz` (the judged trials of the nine notes, read from `corpus/` by NCT ID's folder);
     - writes `data/benchmark/trialbench/{vignettes,labels}.json` and `trials.jsonl.gz` (the 106 labelled trials).

     The output is sorted and pretty-printed, so a rerun is byte-identical.
   - `biome.jsonc` excludes `data/benchmark/**/*.gz`. The JSON files are formatted, so they stay linted.
   - **Tests, `tests/benchmark/import.test.ts`:** `checkSources` on a temporary directory with one wrong checksum; `readTopics`, `readQrels` and `readNciRows` on small inline strings; the loaders' checks.
   - **Records:** the counts written (9 notes, 4,672 judgments, 4,297 trials; 41 vignettes, 395 labels, 106 trials), any judged trial missing from the corpus, and each file's size.

5. **Vocabularies and profiles** (§3.2, §4). One commit, before any scoring code exists.
   - **`data/cancer-types/`:** the twenty files of §4.1, each `measured: false`, written by §4.2 from each cancer's names and MeSH entry, without opening `data/benchmark/*/trials.jsonl.gz` or `qrels.json` or `labels.json`.
   - **`data/benchmark/trec/profiles.json`:** `{ year, number, cancerType, age, sex }` for the nine notes.
   - **`data/benchmark/trialbench/profiles.json`:** `{ patient, cancerType, age, sex }` for the 41 vignettes, by §4.1's table.
   - **`data/benchmark/trec/README.md`:** judgments 1 and 2 count as "for the patient's condition" (§5), and what's committed and why.
   - **`data/benchmark/trialbench/README.md`:** what's kept, the license and the citation.
   - **Tests:** `tests/search/vocabulary.test.ts` loads every file in `data/cancer-types/` and checks each new one is `measured: false`; `tests/benchmark/import.test.ts` checks every profile's type loads, and every note and vignette has exactly one profile.

6. **The check's inputs** (§7.1, §7.3, §7.5).
   - **`evals/benchmark/pairs.ts`:** `drawPairs(labels)` and `splitOf(patient)` by §7.1, and `PAIRS_PATH`. `evals/cases/benchmark/pairs.json` is written by `npm run benchmark:import -- --pairs`, which refuses to overwrite. Records confirm 70 pairs, 14 dev (5 ineligible), 56 held-out (30 ineligible), 42 trials.
   - **`evals/cases/benchmark/KNOWING.md`:** the convention of §7.3, with two worked examples on made-up text (not a vignette).
   - **`evals/cases/benchmark/accounts/<patient>.md`:** one account for each of the 35 vignettes in the pairs, written from `KNOWING.md` and the summary alone. Each starts with a line naming its source vignette.
   - **The second derivation:** 8 vignettes drawn by `sha256("0008-second:" + patient)`. A separate agent, given only `KNOWING.md` and those summaries, writes `evals/cases/benchmark/accounts-second/<patient>.md`. `evals/cases/benchmark/accounts-diff.md` then lists, per vignette, the treatments, sites, conditions, results and activity each version keeps or drops, read side by side by hand: the comparison is of content, not wording, so no script does it. Disagreements aren't reconciled.
   - **`evals/cases/benchmark/reasons.json`:** for each of the 35 ineligible pairs, `{ patient, nctId, kind: "rule" | "disease" | "none", quote? }`, where `quote` is verbatim from the trial's `raw_criteria`. It's written from the comment and the trial text alone, before any parse.
   - **Tests, `tests/benchmark/pairs.test.ts`:** the draw and split are stable on a small fixed input; the committed pairs match `drawPairs` on the committed labels; every `reasons.json` quote is in its trial's text, and every ineligible pair has one entry; every pair's vignette has an account.
   - **`work/0008-benchmark/gate-1-inputs.md`,** as Gate 1 describes.
   - **Stop at Gate 1.**

**Stage B: the search, scored once**

7. **The search on TREC** (§3.4, §3.5, §5).
   - **`evals/benchmark/search-score.ts`:** `scoreTrec(trials, qrels, profiles, vocabularies)`. Per note, `personStages` with `purposes: "all"`, then each judged trial's row: `{ topic, nctId, judgment, kept, droppedAt, reasons }`. Then the summary of §3.5, per note, per type and pooled, with `wilson`.
   - **`scripts/benchmark-search.ts`** (`npm run benchmark:search -- --trec`):
     - writes `evals/results/benchmark/search/trec/01-<hash>.json`, with rows, summary, the sources' and files' checksums and each vocabulary's `sha256`;
     - refuses if a TREC result exists;
     - `-- --trec --check` rescores the latest and fails on any difference.
   - **Tests, `tests/benchmark/search-score.test.ts`:** hand-made trials and judgments: a kept 2, a dropped 1 at the cancer stage, a 1 dropped at age, a kept 0; the pooled and per-type sums; the Wilson bounds.
   - **Run it once.** Records give the headline, per note, and the misses' count.

8. **The search on NIH-TrialBench** (§6).
   - **`evals/benchmark/search-score.ts`:** `scoreTrialBench(snapshot, zipPoints, vignettes, profiles, labels, vocabularies, others)`. Per vignette, `searchTrials` with ZIP 20814, `radiusMiles: null`, and `purposes: ["TREATMENT"]` (the page's default), then again with `"all"`. Rows per labelled pair in the snapshot and per target; the summary of §6.2. The NSCLC vignettes pass `loadOthers("nsclc")`; the others pass `null`.
   - **`npm run benchmark:search -- --trialbench`**, with the same refusal and `--check`. The three targets not in the snapshot get a `notes` entry each, from a person reading today's registry page for that trial, written in the step. That's a browser read, not a script.
   - **Tests:** a hand-made snapshot of four trials: a target kept by `generic`, a target dropped at the cancer stage, a labelled trial not in the snapshot.
   - **Run it once.** Records give targets kept of 29, labelled pairs kept by label, and every missed target with its stage.

**Stage C: the check, dev**

9. **The summary participant** (§7.4).
   - **`evals/participant/prompt.ts`:**
     - `SUMMARY_PARTICIPANT_SYSTEM_PROMPT`: you're the person this text describes; answer only from it; anything it doesn't say, you don't know; return `{ reply, quotes }`;
     - `SUMMARY_FIDELITY_SYSTEM_PROMPT`: does this reply assert anything the text doesn't support;
     - `SUMMARY_SIMULATOR_LAYOUT = 1`, and `SUMMARY_SIMULATOR_VERSION` by `hashPrompt`.
   - **`evals/participant/summary.ts`:** `simulateFromSummary(text, transcript, adapter)`, `summaryFlags(text, reply)` (each quote must be in the text by `includes`; an assertion with no quote over `UNCITED_LENGTH` is flagged), and `summaryFidelityCheck`. It reuses `readReply`'s retry and `freshMemory`. Its signature takes the text and the transcript's lines only, never the session, the arm or the labels.
   - **Tests, `tests/evals/summary-participant.test.ts`:** the blindness as an `expectTypeOf` assertion; a quote not in the text is flagged; an uncited long reply is flagged; "I don't know" with no quotes isn't; replies from the fake adapter.

10. **Parse the check's trials** (§7.2).
    - **`scripts/benchmark-parse.ts`** (`npm run benchmark:parse -- --set dev|heldout`): the set's trials from `pairs.json`, built as `ParseableTrial`s from `data/benchmark/trialbench/trials.jsonl.gz` (`eligibility.criteriaText` is `raw_criteria`), parsed by `parseWithCache` into `data/criteria/trialbench/<criteriaRunName(...)>/`, with `latest` written beside it. It's resumable, with `failures.json` as `check:parse` keeps it. `--model <spec>` is dry without `--spend`.
    - **Tests, `tests/scripts/benchmark-parse.test.ts`:** building a `ParseableTrial` from a release row; the run directory's name. As 0007 did, the script's run itself isn't tested, because it would load the release.
    - **Run dev on the local model:** 12 trials. Records give the time, criteria kept and rejected, and any failure.

11. **The check's runner and scoring** (§7.5–§7.7).
    - **`evals/benchmark/check-run.ts`:** `checkBenchmarkPair({ pair, arm, text, trial, parsed, agent, participant, fidelity })`. It runs `startCheck` with `facts: undefined` and empty answers, then `simulateFromSummary` on the arm's text, until the session closes or `MAX_TURNS`, then `recordOf`. It returns a `BenchmarkTranscript`: 0007's `PairTranscript` fields that apply, plus `arm`, `label` and the participant's `quotes`. `ScreeningSession.stop()` closes a pair at `MAX_TURNS`, as 0007 did.
    - **`evals/benchmark/check-metrics.ts`:** `scoreBenchmarkPair(transcript, reason)` and `summarizeArms(rows)`, by §7.5 and §7.7. Verdict and unknowns checks reuse `evals/check/metrics.ts`'s helpers, exported there if they aren't already. "Caught for the named rule" uses `overlap` from `src/check/link.ts` at `LINK_THRESHOLD`.
    - **`evals/benchmark/check-result.ts`:** the result type; `runHash` over pairs, accounts, reasons, parse run, `AGENT_PROMPT_VERSION`, `SUMMARY_SIMULATOR_VERSION`, the model and `CHECK_REVISION`; `regradeProblems`.
    - **`scripts/benchmark-check.ts`** (`npm run benchmark:check`):
      - `-- --dev` runs both arms of dev's pairs;
      - with no flag, runs held-out once, refused once a held-out result exists;
      - `-- --check [--dev]` regrades the latest from its transcripts, with no model;
      - `--arm full` limits a run to one arm, for Gate 2's option.

      Transcripts go under `evals/results/benchmark/check/runs/<set>-<hash>/<patient>-<nct>-<arm>.json` as each finishes. The adapter is `createLocalAdapter` with `thinking: false` for all three roles, as `check:eval` builds it. `--model <spec>` is dry without `--spend`.
    - `biome.jsonc` excludes `evals/results/benchmark/check`.
    - **Tests, `tests/evals/benchmark-check.test.ts`:** a pair run on the fake adapter end to end; scoring a caught pair, a false alarm on one part of a trial, a disease-comment pair, a `parse: "failed"` pair, and a caught pair whose line doesn't overlap the named rule; the arms' comparison; `regradeProblems` on a changed transcript.

12. **Dev on the local model, both arms.**
    - `npm run benchmark:check -- --dev`: 14 pairs × 2 arms. Then `-- --check --dev` passes.
    - Fixes found while running dev, if any, are their own commit before the run's data, each recorded here, as 0007's step 12 did.
    - **`work/0008-benchmark/gate-2-dev.md`,** as Gate 2 describes, plus `gate-2-records.txt` with the records as text.
    - **Stop at Gate 2.**

**Stage D: the check, held-out**

13. **Parse held-out's trials:** `npm run benchmark:parse -- --set heldout`, the 30 trials not already parsed for dev. Records give the time and failures. Nothing reads the parses before step 14.

14. **Held-out, once:** `npm run benchmark:check`, both arms, or the full file only if Gate 2 chose that. Then `-- --check` and `-- --check --dev` pass. Records give the table of §7.7 for both sets, the time, and any pair that didn't finish.

**Stage E: written up**

15. **Docs** (§8, §11).
    - `docs/benchmark.md`, by §8's outline. Every number is cited to a committed result.
    - `docs/search.md`, `docs/check.md` and `docs/questions.md`: their Limits point to the benchmark where it now speaks. `questions.md`'s "needs the benchmark in slice 0008" says what the benchmark found and couldn't.
    - `work/ROADMAP.md`: 0008 **Done** with its measure, and open question 4 answered.
    - README: one line, no numbers.
    - `CLAUDE.md`: the four `benchmark:*` commands, `data/benchmark/`, `evals/benchmark/`, `evals/cases/benchmark/`, `data/criteria/trialbench/`, the download step, and the boundary.

16. **Review passes** (`REVIEW.md`), over `main...HEAD`, each finding fixed or recorded here.

## Files that change

**New:**
- `evals/benchmark/{sources,trec-xml,trec,trialbench,pairs,search-score,check-run,check-metrics,check-result}.ts`;
- `evals/participant/summary.ts`;
- `scripts/{benchmark-import,benchmark-search,benchmark-parse,benchmark-check}.ts`;
- `data/benchmark/sources.json`;
- `data/benchmark/trec/{topics,qrels,profiles}.json`, `trials.jsonl.gz`, `README.md`;
- `data/benchmark/trialbench/{vignettes,labels,profiles}.json`, `trials.jsonl.gz`, `README.md`;
- `data/cancer-types/{anal,bladder,breast,cervical,cutaneous-squamous,endometrial,gastroesophageal,germ-cell,glioma,head-and-neck,kidney,lymphoma,melanoma,merkel-cell,myeloma,pancreatic,penile,prostate,thyroid,urethral}.json`;
- `evals/cases/benchmark/{KNOWING.md,pairs.json,reasons.json,accounts-diff.md}`, `accounts/*.md` (35), `accounts-second/*.md` (8);
- `data/criteria/trialbench/<run>/*.json`, `failures.json`, `latest`;
- `evals/results/benchmark/search/{trec,trialbench}/01-*.json`;
- `evals/results/benchmark/check/{dev/,runs/}…` and the held-out result;
- `tests/benchmark/{trec-xml,import,pairs,search-score}.test.ts`, `tests/benchmark/fixtures/` (three corpus files);
- `tests/evals/{summary-participant,benchmark-check}.test.ts`, `tests/scripts/benchmark-parse.test.ts`;
- `docs/benchmark.md`;
- `work/0008-benchmark/{plan,gate-1-inputs,gate-2-dev}.md`, `gate-2-records.txt`.

**Changed:**
- `src/search/{search,index}.ts` (`personStages`, behavior unchanged);
- `evals/participant/prompt.ts` (the summary prompts and version);
- `evals/check/metrics.ts` (exports only, if the verdict and unknowns helpers aren't exported yet);
- `package.json` (scripts only); `biome.jsonc`;
- `tests/boundary.test.ts`; `tests/search/{search,vocabulary}.test.ts`;
- `docs/{search,check,questions}.md`, `README.md`, `work/ROADMAP.md`, `CLAUDE.md`.

**Not touched:**
- `src/check/`, `src/screening/`, `src/criteria/`: the agent, its prompts and the parser run as 0007 left them;
- `src/facts/`, `src/questions/`, `src/shortlist/`, `src/server/`, `src/web/`, `src/transport/`, `src/models/`, `src/trials/`;
- `data/cancer-types/{nsclc,nsclc-others,generic}.json`;
- every committed result, label, patient and parse run;
- `.env`.

**No new dependency.** The XML reader is about a hundred lines. Step 3 is where that's tested, and the plan changes if it fails.

## Reused, not rebuilt

- **The search whole:** `reasonsFor`, age and sex, `searchTrials`. `personStages` is a move, not a rewrite.
- **The check whole:** `startCheck` with nothing carried, `recordOf`, the agent's prompts, `CHECK_REVISION` 2, `READ_MAX_OUTPUT_TOKENS` 4,096, reasoning off.
- **The parser and its cache:** `parseWithCache`, `criteriaRunName`, `latestCriteriaRun`.
- **The participant's machinery:** `readReply`'s retry, `freshMemory`, `deterministicFlags`' rules, the fidelity read.
- **Scoring:** `wilson`, `overlap` and `LINK_THRESHOLD`, 0007's verdict and unknowns checks, `runHash`, `regradeProblems`.
- **Scripts:** `nextRunFile`, the refusal-once-held-out and `--check` patterns of `other:eval` and `check:eval`, `planPaidRun` and `logSpend`.

## Risks

- **The vocabularies are one author's,** written in an afternoon, for cancers the project has never searched. A missing synonym is a miss the result shows; Gate 1 is the owner's chance to see them before scoring. They stay `measured: false`.
- **TREC's recall is of a judged pool.** Trials no participant retrieved were never judged, so the denominator isn't every relevant trial. The doc says so beside the number.
- **2021 text, 2026 search.** The vocabulary and generic terms were written for today's registry; condition naming has drifted a little since 2021. A miss caused by that is still a miss, and is listed.
- **The XML reader** may meet a field shape the fixtures don't. Step 4 fails loudly on any unreadable trial rather than skipping it.
- **The accounts are written by the author of the convention.** The second derivation on 8 shows whether the rules can be followed; it doesn't make them right. Gate 1 is where a person judges that.
- **The participant is a model,** and the full-file arm hands it long, dense notes. Fidelity flags exclude findings; Gate 2 reads every flag.
- **Clinicians labelled TrialGPT 2.0's favorites.** The 395 pairs are trials a matcher already ranked high, so "ineligible" here means a near miss, not a random trial. Both rates mean "on trials a matcher liked", and the doc says so.
- **Seventy pairs, 35 ineligible.** Intervals are wide, and the per-comment splits are small.
- **Time.** NIH Clinical Center trials have long criteria; a parse can run past the oMLX timeout, and a check past `MAX_TURNS`. Both are recorded and the run continues; the result names what's missing. Gate 2 sets the real estimate from dev.
- **Downloads.** 1.8 GB from `trec-cds.org` is a person's action. If the site moves, TREC's part waits; NIH-TrialBench's part doesn't depend on it.

## Verification

- `npm run check` exits 0 at every commit.
- Every `--check` from step 1 is unchanged at every step, `search:eval`'s and `questions:eval`'s especially at step 2.
- `benchmark:search -- --trec --check` passes from step 7, `-- --trialbench --check` from step 8, `benchmark:check -- --check --dev` from step 12, and `-- --check` from step 14.
- `npm run test:e2e` passes at step 1 and step 15. Nothing on the page changes, so this is a regression check only.
- `npm run benchmark:import` reruns byte-identical at step 4 and at step 15.
- **By hand at step 5:** `npm run search -- --cancer breast --zip 20814 --age 45 --sex female` runs and prints that the type is unmeasured.

## Records

**While writing the intent, spec and plan (2026-10), nothing committed:**
- NIH-TrialBench's raw files were read at commit `1c5f9ebc3b98` from `github.com/TrialGPT2/TrialGPT2.0`, and TREC's topics and judgments from `trec.nist.gov`, into a scratch directory outside the repository. The counts in the intent, the spec and this plan's Context come from them, and from the committed 2026-10 snapshot.
- The license of NIH-TrialBench is NLM's public-domain notice, added in the commit of 2026-10 that answered the repository's issue 1.
- **The owner approved this plan as written (2026-10).**
- **Step 1, baseline** (on `main` at `46a326a`):
  - `npm run check` exits 0; 1,195 tests (1,187 passed, 8 expected to fail) in 105 files; `npm test` about 0.8 s.
  - `npm run test:e2e`: 8 passed.
  - `search:eval -- --check`, `questions:eval -- --check` and `-- --check --dev`, `facts:eval -- --check`, and `check:eval -- --check` and `-- --check --dev` pass.
  - `other:eval -- --check` and `-- --check --dev` fail with "labelsSha256 differs" and nothing else, as 0006 and 0007 recorded. A separate task; at each step below, "unchanged" for these two means that single difference.
- **Step 2, `personStages`:**
  - `personStages(trials, vocabulary, request)` returns `{ entries: PersonStageEntry[], funnel }`. `request` is a `Pick` of `age`, `sex` and `purposes`, so no ZIP is needed. `searchTrials` still places its origin first, so an unknown ZIP is refused before any stage runs, as before. `PersonStageEntry` is exported with it.
  - 3 tests in `tests/search/search.test.ts`: the funnel and entries match `searchTrials`' before distance, each entry's reasons and age reading, and a trial with no sites kept. 1,198 tests (1,190 passed, 8 expected to fail).
  - `search:eval`, `questions:eval` (both sets), `facts:eval` and `check:eval` (both sets) `--check` pass; `other:eval`'s two are unchanged.
- **The downloads, before step 3** (the implementer, on the owner's go-ahead in chat, 2026-10):
  - TREC's two topic files and two judgment files from `trec.nist.gov/data/trials/`, into `local/benchmark/trec/`.
  - The five corpus zips from `trec-cds.org/2021_data/`, 1.79 GB, into `local/benchmark/trec/zips/`, and unzipped into `local/benchmark/trec/corpus/`. `unzip` warned on each archive's central directory ("76 extra bytes") but extracted every file: 375,580, the corpus's stated size. All 4,297 trials judged for the nine notes are present, and so is every trial in both years' judgments. The zips are kept, so the manifest checksums them rather than 375,580 files.
  - NIH-TrialBench's `data/nih_trialbench/raw/` and `trials/` (1,373 files), by a sparse clone checked out at `1c5f9ebc3b98d1f780ceea68043efdaa2daba880`, copied into `local/benchmark/trialbench/` and the clone removed.
- **Step 3, the TREC XML reader:**
  - `evals/benchmark/trec-xml.ts`: `readTrecTrial(xml)` and `TrecXmlError`, about 190 lines. Comments are stripped first: the registry puts one inside `condition_browse`. The legacy "Unknown status" becomes `UNKNOWN`, as the API spells it; a missing `primary_purpose` stays null, as the snapshot keeps it.
  - **Read over all 4,297 judged trials, with no failure:** 2 have no criteria text, 324 no condition MeSH, 1,068 no primary purpose (mostly observational studies, kept by `purposes: "all"`), and 328 no minimum age. Every `last_update_posted` read as an ISO date. So no parser dependency is needed.
  - Fixtures: NCT00032383 (two phases, MeSH), NCT00065078 (no `condition_browse`, healthy volunteers, unknown status), NCT00038233 (entities; an intervention MeSH term and a collaborator agency that mustn't be read). 5 tests in `tests/benchmark/trec-xml.test.ts`; 1,203 tests in all (1,195 passed, 8 expected to fail).
  - `biome.jsonc` now excludes `local`: Biome doesn't read `.gitignore` here, and the downloaded release's JSON failed its formatter. Not foreseen by the plan.
- **Step 4, the import:**
  - `evals/benchmark/{sources,trec,trialbench}.ts`, `scripts/benchmark-import.ts` (`npm run benchmark:import`), `data/benchmark/sources.json`, and `data/benchmark/trec/{topics,qrels}.json`, `trials.jsonl.gz` (3.9 MB) and `data/benchmark/trialbench/{vignettes,labels}.json`, `trials.jsonl.gz` (0.2 MB).
  - **Written:** TREC, 9 notes, 4,672 judgments (888 eligible, 781 excluded, 3,003 not relevant), 4,297 trials. NIH-TrialBench, 41 NCI vignettes, 395 labels, 106 trials (all 13 targets among them). No judged trial is missing from the corpus. A rerun wrote byte-identical files. `--record` with checksumming took 4.5 s.
  - **The manifest** checksums 13 files and one folder: the four TREC topic and judgment files, the five corpus zips (not the 375,580 unzipped files), NIH-TrialBench's four `raw/` files, and `trials/` by a hash of its files' names and checksums.
  - **Divergences:**
    - A TREC note is keyed `<year>-<number>`: 2021 and 2022 both have a topic 11.
    - **NIH-TrialBench's two trial sources disagree.** For 14 of the 106 trials, `trials/NCT*.json`'s criteria differ from `raw/trial_search_space.jsonl`'s, and for 2 the title does too. Title and criteria come from `raw/`, the release itself; conditions, phases, ages and sex, which `raw/` lacks, come from `trials/`. `trialbench.ts`'s header says so.
    - **The boundary asserts no fetch, not no host name.** §9 said no file names `trec.nist.gov`, `trec-cds.org` or `github.com`, but the manifest needs each download's URL as data. The new block in `tests/boundary.test.ts` walks `benchmark:import`'s graph and finds no network use, no model module and not `registry.ts`, with a "would catch" case.
    - The TREC citation names the track's pages rather than the overview papers' authors, which weren't checked first-hand.
    - `biome.jsonc` didn't need `data/benchmark/**/*.gz`: Biome doesn't read gzip.
  - 15 tests in `tests/benchmark/import.test.ts`, 4 in the boundary block; 1,220 tests in all (1,212 passed, 8 expected to fail), `npm test` about 0.74 s.
- **Step 5, vocabularies and profiles:**
  - **The twenty files of §4.1,** each `measured: false`, written from each cancer's common names, its MeSH headings and characteristic biomarkers, in `nsclc.json`'s shape. `trials.jsonl.gz`, `qrels.json` and `labels.json` weren't opened while writing them. **What was seen earlier, while writing the intent:** NIH-TrialBench's label counts, six ineligible pairs' comments, its 13 target IDs, and one target's title (NCT05483491, a TCR-T trial for gastric, breast, cervical and lung cancer). No list of TREC's judged trials was ever looked at.
  - **Choices in them the owner should see at Gate 1:**
    - recall first, as in `nsclc.json`: broad MeSH headings are included where a trial so tagged could take the patient (`Brain Neoplasms` for glioma, `Skin Neoplasms` for cutaneous squamous, `Uterine Neoplasms` for endometrial, `Urologic Neoplasms` for bladder and urethral);
    - `bladder` names "urachal" and "urothelial", and `urethral` names "urothelial carcinoma" and "upper tract urothelial";
    - `gastroesophageal` names esophageal cancer too, since gastroesophageal junction trials usually list both;
    - biomarkers only where characteristic: breast (hormone receptor positive, triple negative), gastroesophageal (claudin 18.2), glioma (MGMT, H3 K27M), kidney (VHL), bladder (FGFR3, nectin-4), lymphoma (CD30), myeloma (BCMA), prostate (PSMA). HER2, BRAF, KRAS, PD-L1 and HPV are shared and left out.
  - **Profiles:** `data/benchmark/trec/profiles.json` (9) and `data/benchmark/trialbench/profiles.json` (41). Three vignettes don't state everything, and their profiles carry a `note`: nci-05 states no sex (triple-negative breast cancer, read as female); nci-34 and nci-35 state no age (65 used; male, from the prostate cancer). `TrialBenchProfile` gains the optional `note`.
  - `data/benchmark/{trec,trialbench}/README.md`: what's committed, the convention (judgments 1 and 2 count as "for the patient's condition"; recall is of the judged pool), the licenses and the citation.
  - **By hand:** `npm run search -- --cancer breast --zip 20814 --age 45 --sex female` keeps 1,332 trials for breast cancer and 373 within 100 miles, and prints "The breast cancer vocabulary hasn't been measured yet."
  - Tests: every cancer type in `data/cancer-types/` loads and only `nsclc` is measured; every note and vignette has one profile whose type loads, and only the three have a note. 1,223 tests (1,215 passed, 8 expected to fail).
- **Step 6, the check's inputs:**
  - **The pairs:** `evals/benchmark/pairs.ts` (`drawPairs`, `splitOf`, `inputProblems`) and `npm run benchmark:import -- --pairs`, which reads the committed labels and needs no download. `evals/cases/benchmark/pairs.json`: 70 pairs over 42 trials and 35 vignettes; dev 14 (5 ineligible) over 8 vignettes, held-out 56 (30 ineligible), as the spec computed.
  - **`KNOWING.md`,** with two worked examples on made-up text. Two rules were added while writing the accounts, before the second derivation: an ECOG or Karnofsky score is said in a person's words, and a lab trend a patient is told in words is kept without its numbers.
  - **35 accounts** in `evals/cases/benchmark/accounts/`, written from `KNOWING.md` and each summary alone. nci-34 and nci-35 state no age, and their accounts give none.
  - **The second derivation:** 8 vignettes (nci-12, 14, 16, 21, 25, 31, 35, 37), written by a separate agent given only `KNOWING.md` and those 8 summaries, into `accounts-second/`. Compared by hand in `accounts-diff.md`:
    - the same cancer, treatments, endings, surgery, radiation, conditions and activity on all 8;
    - **two gaps in the convention:** drop 6 says to expand regimen acronyms, but worked example 2 keeps "R-CHOP" (the first writer kept FOLFOX, FOLFIRINOX, CHOP and ICE; the second expanded them), and nothing covers a stated absence ("it isn't in my brain");
    - **the first writer, who wrote the convention, broke it three times** (a pathology finding as a reason, a creatinine read as kidney failure, "mucinous") **and omitted spread sites twice** (nci-35's uncertain pelvic nodes, nci-37's nodes near the liver).

    Nothing was reconciled; Gate 1 chooses among three options, and the gate page recommends fixing the convention and reapplying it to all 35.
  - **`reasons.json`:** 35 ineligible pairs, 18 `rule` (every quote verbatim in its trial's criteria), 12 `disease` (trials for another disease or purpose: an MRI study, a procedure-tracking study, a neuromuscular study), 5 `none`. Of the 5, 2 have no comment, and 3 (NCT05327023) have comments naming a prior allogeneic transplant that no rule in the text requires. `PairReason` gains an optional `note`, used on 8 entries.
  - 6 tests in `tests/benchmark/pairs.test.ts`, including that the committed pairs are the draw of the committed labels, and that every input is complete.
  - `work/0008-benchmark/gate-1-inputs.md` written. **Stopped at Gate 1.**
- **Gate 1, first answer: fix the convention and reapply it to all 35 accounts** (option 2 of `accounts-diff.md`); the accounts alone come back to the gate. Recorded in `gate-1-inputs.md`, Answer.
- **Step 6b, the accounts reapplied** (its own commit):
  - `KNOWING.md`: drop 6 now expands every regimen acronym, and worked example 2 follows it; keep 8 (a stated absence) and drop 8 (measured values, vital signs included) are new; Form says a finding isn't turned into its consequence or given as a reason, and a word isn't explained beyond the summary.
  - 21 of the 35 accounts changed, each listed in `gate-1-inputs.md`. Two expansions needed knowledge beyond an abbreviation (nci-04's ddAC+T, nci-05's KEYNOTE 522 regimen) and are flagged for the owner.
  - `accounts-second/` is unchanged. The tests are unchanged and pass.
  - **Stopped at Gate 1** again, on the accounts.
