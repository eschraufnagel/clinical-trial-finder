# plan: 0009 check false alarms

**Intent:** [intent.md](intent.md), committed as `0009 intent`. **Spec:** [spec.md](spec.md), committed as `0009 spec`. Section numbers (§) below are the spec's.

## Context

On NIH-TrialBench's dev pairs, slice 0008 found that the deeper check says "may not fit" on 8 of 9 trials clinicians called eligible. Reading every line found four causes (`work/0008-benchmark/gate-2-dev.md`). The owner chose a small slice on the cheap ones:
- pregnancy and contraception rules read the wrong way round;
- conditional rules read as requirements;
- lines on parts of a trial the person isn't in.

0008's held-out (56 pairs, 30 trials unparsed) was left unread to measure exactly this fix.

Reading 0008's transcripts while writing the spec placed most of these lines in the screening agent: its restated "statement" drops a rule's "if", and its reading gets the pregnancy example the wrong way round. The parser caused two lines, and `apply.ts` and `record.ts` are correct (§2).

**So the slice:**
- changes the agent's reading prompt (§3);
- sets part lines apart on the record (§4);
- adds a second measure beside 0008's frozen one (§5);
- reruns dev from the full summary (§6);
- spends held-out once, from the full summary (§6).

No parser change, no schema change, no boundary widened.

**What the code is today:**
- **The reading prompt:** `READ_SYSTEM_PROMPT` in `src/screening/prompts.ts`. `PROMPT_VERSION` hashes it and is pinned in `tests/screening/prompts.test.ts` (`"8fda2872b52a"`).
- **The record:** `src/check/record.ts`.
  - `countsLine(mayNotFit, records)` writes "N rules may not fit what you said. M rules need your records or your oncologist."
  - `withPart` sets `MAY_NOT_FIT_PART` on lines whose criterion has an `appliesTo`.
  - `assemble` builds `toAsk.items` as `{ rule, question }`, with every "may not fit" line first (`ASK_MAY_NOT_FIT`), then records lines (`ASK_RECORDS`).
- **The page:** `src/web/Record.tsx` renders `counts.line` and `toAsk.items` as given, so it needs no change when their content changes.
- **The scoring:** `evals/benchmark/check-metrics.ts` (`scoreBenchmarkPair`, `summarizeArm`, `compareArms`). `check-result.ts`'s `benchmarkRegradeProblems` compares rows, summaries and the comparison by `JSON.stringify`. So **no field can be added to `BenchmarkRow` or `ArmSummary`** without breaking 0008's dev regrade. The new measure goes in a separate, optional block.
- **The script:** `scripts/benchmark-check.ts`.
  - `--check` regrades only the latest result in a folder.
  - Held-out is refused once `evals/results/benchmark/check/` holds a result; none does.
  - The run hash covers `AGENT_PROMPT_VERSION` and `CHECK_REVISION` (`evals/check/run.ts`, now 2).
- **The parse:** `npm run benchmark:parse -- --set heldout` adds held-out's trials to the run named in `data/criteria/trialbench/latest` (`qwen3.6-35b-a3b-mlx-8bit-e1e694b3-n2`). With the parser unchanged, dev's 12 parses stand and the parse run's name is the same.

## Order of work

### Stages and gates

| Stage | Steps | Ends at | What you can see at the end |
| --- | --- | --- | --- |
| **A. The fix, frozen** | 1–6 | **Gate 1** | the baseline; `benchmark:lines`; `diagnosis.md` for every counted dev line; the parts measure, with 0008's dev measured by it; the record's part lines; the revised reading prompt; `gate-1-fix.md`. No model run |
| **B. Dev, from the full summary** | 7–8 | **Gate 2** | 14 dev pairs rechecked on the local model; `gate-2-dev.md` |
| **C. Held-out, once** | 9–10 | — | 30 trials parsed; 56 pairs checked from the full summary; remaining false-alarm lines classed by cause |
| **D. Written up** | 11–12 | PR | `docs/check.md`, `docs/benchmark.md`, roadmap row, `CLAUDE.md`, review passes |

**Gate 1: freeze the fix, and spend about 7 hours of local time on dev?** (§2, §3, §4, §5.2, §7)
- **What's decided:**
  - **The diagnosis:** whether `diagnosis.md` places each counted dev line in causes 3 and 4 correctly, by parse, statement or reading, and whether any line it adds changes what §3 should fix.
  - **The prompt's three additions** (§3), read as a diff. Especially the widened "does-not-apply", which moves rules with an unmet condition to "Needs your records" with "You said this isn't about you." (spec concern 2).
  - **The record's new wording:** the counts line and the part question, on two dev records rendered with the new `record.ts` from their stored findings.
  - **The second measure and the named-rule reading** (§5.2), as computed on 0008's dev result. They're frozen here, before dev runs.
  - **The bar for Gate 2** (§7), frozen here.
- **What the owner sees:** `work/0009-check-false-alarms/gate-1-fix.md`.
- **What it costs to be wrong:** stage B spends about 7 hours of the owner's machine. A prompt that misses the causes wastes that run, and revising afterwards means another one. A measure changed after dev is tuned on dev.
- **Can be no:**
  - **"revise":** the prompt, the record's wording or the measure, then Gate 1 again;
  - **"stop":** the slice ships stage A and a short write-up, with no model run.

**Gate 2: spend held-out's one look?** (§5, §6, §7)
- **What's decided:** run held-out (stage C, about 1 hour of parsing and 28 hours of checks), revise on dev, or stop with dev's figures.
- **The bar, frozen at Gate 1.** Dev, from the full summary, must show:
  1. no `verdictHits`;
  2. every unresolved, chart-review or not-asked criterion on its record;
  3. every fidelity flag read and explained in the gate page, and no finding scored from a flagged turn;
  4. every dev pair finished, or listed with why.

  Caught and false alarms are shown in both measures, not barred: 14 pairs can't measure a rate.
- **What the owner sees:** `work/0009-check-false-alarms/gate-2-dev.md`:
  - both measures, before (0008's dev) and after;
  - every line `diagnosis.md` listed, marked gone, still there, or not asked this time;
  - every new counted line, with its cause;
  - the bar;
  - flags;
  - timing and the held-out estimate.
- **What it costs to be wrong:** held-out is read once, and anything changed afterwards is tuned on it. Stage C spends about 29 hours of local time.
- **Can be no:**
  - **"revise on dev":** the reading prompt or the record again. Each revision reruns dev (about 7 hours) and comes back to Gate 2.
  - **"stop":** stages A, B and D ship, with dev reported as a dev finding, and held-out stays unread.

**Stages C and D need no gate.** Gate 2 decided whether to look, and stage D is documentation.

**No hosted run is in this plan.** Every model run is on the local model (Qwen3.6-35B-A3B-MLX-8bit, temperature 0, seed 20260921, reasoning off), which the owner's machine must be serving. If the owner asks for a hosted run at either gate, it's a new gate: dry first with `--model <spec>` and no `--spend`, recorded here before it runs. Nothing creates or edits `.env`.

### Steps

**Rules for every step:**
- Each step is one commit, through `npm run check && git commit`.
- No commit carries a Co-Authored-By trailer.
- No test mocks a module or stubs a global, and no test reads `local/`.
- Dates are months.
- `work/ROADMAP.md`'s uncommitted Future scope section is the owner's: never staged unless they say so. Stage files by name.

**Stage A: the fix, frozen**

1. **Baseline.** Record in Records, on this branch at the plan's commit:
   - `npm run check` exits 0, with the test count and `npm test`'s time;
   - `npm run test:e2e` passes;
   - `search:eval -- --check`, `questions:eval -- --check` and `-- --check --dev`, `facts:eval -- --check`, `check:eval -- --check` and `-- --check --dev`, `benchmark:search -- --trec --check` and `-- --trialbench --check`, and `benchmark:check -- --check --dev` all pass;
   - `other:eval -- --check` and `-- --check --dev` fail with only "labelsSha256 differs", as recorded since 0006. "Unchanged" below means that one difference.

   The commit is `plan.md`'s Records alone.

2. **`benchmark:lines`, a printer for a result's "may not fit" lines** (§2, §5.3). No model.
   - **`scripts/benchmark-lines.ts`, `npm run benchmark:lines -- <result.json> [--pair nci-13:NCT02465060] [--record]`.** It reads the result and its transcripts, and for every counted "may not fit" line prints:
     - pair, arm and label;
     - criterion id;
     - the parse's text and polarity, and type (from the transcript's `criteria`);
     - `part`;
     - `kind` (from the row's `mayNotFit`);
     - each piece of evidence: the agent's `statement`, `reading`, `quote` and `withheld`;
     - the finding's `status`, `reason` and `reported`;
     - lines excluded as resting on a flagged reply, marked as such.
   - **`--record`** renders a pair's record as text, re-assembled with the current `recordFor` from the transcript's `criteria` and `findings`. `wording` and `parts` are rebuilt from the cached parse the way `startCheck` builds them (`src/check/run.ts`: the source text by ordinal id, and `appliesTo`), using `findParse` and `fromParse`. This replaces 0008's scratch renderer (its review-pass nit).
   - **Tests**, `tests/scripts/benchmark-lines.test.ts`, on a small transcript fixture in the test: the line listing names polarity, statement and reading, marks an excluded line, and `--record`'s text holds every section heading.
   - **`tests/boundary.test.ts`:** a new case, in the pattern of the `benchmark:import` block. The script's import graph reaches no model module, no factory and no network use, with a "would catch" case. It does reach `recordFor`, `findParse` and `fromParse`, which call no model. This adds a test; it widens no exception.

3. **`diagnosis.md`** (§2, OQ 1).
   - Run `benchmark:lines` on `evals/results/benchmark/check/dev/01-5ed77c679dad.json`, both arms.
   - Write `work/0009-check-false-alarms/diagnosis.md` by hand. Every counted line, both arms, goes in one table: pair, arm, criterion, cause, and locus.
     - **Cause** is one of:
       1. "or" list;
       2. part;
       3. pregnancy, nursing or contraception;
       4. conditional;
       5. records;
       6. other.
     - **Locus** is one of:
       - `parse`: text or polarity;
       - `statement`: the agent's restatement;
       - `reading`;
       - `code`.
   - §2's seven rows are among them. Below the table, say which lines §3 should reach and which it can't (parse-locus lines whose condition is gone, like nci-13's P2).
   - If a cause-3 or cause-4 line has locus `code`, stop and raise it at Gate 1 rather than fixing it here: that would contradict §2.

4. **The parts measure** (§5.2). No model.
   - **`evals/benchmark/check-parts.ts`:**
     - `scorePartsPair(t, reason, criteriaText): PartsRow`, with fields `patient`, `nctId`, `arm`, `label`, `parse`, `flaggedOutsideParts: boolean` and `namedOnRecord: boolean | null`.
       - **`flaggedOutsideParts`:** a counted "may not fit" line with `part === null`. "Counted" uses the same exclusion of flagged replies as `scoreBenchmarkPair`; move that filter into a shared exported helper in `check-metrics.ts` rather than copying it. The helper's output must leave `scoreBenchmarkPair`'s rows identical.
       - **`namedOnRecord`:** for `rule` pairs, whether the reason's quote overlaps, by `overlap` ≥ `LINK_THRESHOLD`, the source of any line that is "may not fit", in the `records` section, or whose rule is among `toAsk.items`. Null for other pairs.
     - `summarizeParts(arm, rows): PartsSummary`: caught and false alarms on `flaggedOutsideParts`, using `rate`, false alarms by label, and the count of `namedOnRecord` among rule pairs.
   - **`evals/benchmark/check-result.ts`:**
     - `BenchmarkCheckResult` gains optional `parts?: { rows: PartsRow[]; byArm: PartsSummary[] }`.
     - `scoreBenchmark` returns it.
     - `benchmarkRegradeProblems` compares `parts` only when the committed result has it, so 0008's dev result regrades unchanged.
     - `version` stays 1: the block is additive and optional.
   - **`scripts/benchmark-check.ts`:**
     - writes `parts` into new results;
     - **`--check --result <path>`** regrades a named result instead of the latest (needed once dev has two);
     - **`--parts <path>`** prints `summarizeParts` for any result, from its transcripts, without writing. That gives 0008's dev "before" figures.
   - **Tests**, `tests/evals/benchmark-check.test.ts`:
     - a pair whose only counted line has a part is flagged but not `flaggedOutsideParts`;
     - a pair with a part-free line is both;
     - `namedOnRecord` is true for a records line on the rule and false when the rule isn't on the record;
     - a committed-style result without `parts` regrades with no problem;
     - one with a changed `parts` reports it.
   - Run `benchmark:check -- --check --dev`, which must still pass, and `--parts` on 0008's dev result. Record the figures in Records.

5. **The record's part lines** (§4).
   - **`src/check/record.ts`:**
     - `counts` gains `onePart: number`, the "may not fit" lines with a part. `counts.mayNotFit` still counts every one.
     - `countsLine(mayNotFit, records, onePart)` writes "N rules may not fit what you said." with N = `mayNotFit - onePart`. When `onePart > 0`, it adds "K more are for one part of the trial, which you may not be in." Then the records sentence as now.
     - New `ASK_PART = "Which part of the trial would I be in, and is this rule for it?"`.
     - In `assemble`, `toAsk.items` lists:
       1. "may not fit" lines without a part, with `ASK_MAY_NOT_FIT`;
       2. records lines, as now;
       3. part lines last, with `ASK_PART`.
   - **Departure from §4, recorded here:** the spec said "a fixed lead-in" before part lines. A per-item question gives the same reading with no change to `toAsk`'s shape or to `Record.tsx`. The page then needs no code change.
   - **`evals/check/run.ts`:** `CHECK_REVISION = 3`, with a comment line saying 0009 changed the record.
   - **Tests**, `tests/check/record.test.ts`:
     - the existing part test also asserts `counts.onePart` and the new counts sentence;
     - part lines come last in `toAsk` with `ASK_PART`;
     - a record with no part lines has today's counts sentence exactly;
     - a clinical finding with `reported: "does-not-apply"` isn't "may not fit" and sits under records with `WHY.notAboutYou`;
     - `ASK_PART` and the new counts sentence pass the existing verdict-word scan for `ours` strings.
   - Run `npm run test:e2e`. If `e2e/check.spec.ts` asserts a counts sentence or a `toAsk` order that changed, update the expectation in this commit and say so in Records. `check:eval -- --check` and `-- --check --dev`, and `benchmark:check -- --check --dev`, still pass: they regrade stored records.

6. **The reading prompt** (§3).
   - **`src/screening/prompts.ts`, `READ_SYSTEM_PROMPT`.** Three additions, each with an invented example, using no words from a benchmark trial or the twelve pinned protocols:
     1. **Under "statement":** a criterion that applies only if something is true ("if…", "patients who…", "participants of … must", "… should be discontinued") keeps its condition: "If the person X, then Y." The example is an invented rule about, say, people who wear contact lenses.
     2. **Under "statement", for exclusions:** restate by meaning even when the criterion's text reads as a requirement. An invented example, such as "The person does not smoke" given as an exclusion becoming "The person smokes."
     3. **Under "does-not-apply":** it also covers a reply establishing that a rule's condition isn't true of the person. A criterion whose text joins who it's for with what they must do ("is X and is willing to Y") is read the same way when X names who the rule is for. Keep the existing sentence that "pregnant" names a condition, and add beside it: against an inclusion "The person is not pregnant", a man saying he isn't pregnant gives "holds".
   - No change to `ASK_SYSTEM_PROMPT`, the templates or `PROMPT_LAYOUT`.
   - **Tests**, `tests/screening/prompts.test.ts`:
     - update the `PROMPT_VERSION` pin to the new value; the visible test change is the record of the prompt change;
     - the does-not-apply test also matches the new condition sentence;
     - the existing verdict-language test passes;
     - **a new five-word-run test, beside the vignettes one:** `READ_SYSTEM_PROMPT` shares no run of five words with any committed NIH-TrialBench trial's criteria text (`data/benchmark/trialbench/trials.jsonl.gz`, via the existing loader `loadTrialBench` or its committed-file reader) or with the twelve pinned protocols (`src/trials/corpus.ts`).
   - **Then write `work/0009-check-false-alarms/gate-1-fix.md`:**
     - the diagnosis's summary, by cause and locus;
     - the prompt's diff;
     - two dev records re-rendered with `benchmark:lines --record`: nci-13 × NCT02465060 (account), and one pair with part lines, such as nci-25 × NCT00003838;
     - 0008's dev figures in both measures (step 4);
     - the bar;
     - the estimate for dev.

     The page goes in the same commit. **Stop at Gate 1.**

**Stage B: dev, from the full summary**

7. **Dev rerun.** `npm run benchmark:check -- --dev --arm full`, on the local model. About 7 hours; resumable.
   - A pair refused by the local server's memory guard is rerun, as in 0008.
   - Commit the result (`evals/results/benchmark/check/dev/02-<hash>.json`, with its `parts` block) and its transcripts.
   - `benchmark:check -- --check --dev` and `-- --check --result evals/results/benchmark/check/dev/01-5ed77c679dad.json` both pass.
   - Record the run's model, prompt version, timing and any stops in Records.

8. **`gate-2-dev.md`.** From `benchmark:lines` on the new result, and the before figures from step 4, as Gate 2's "What the owner sees" lists. For each line in `diagnosis.md`, say whether it's gone, still there, or its question wasn't asked this time. Every new counted line gets a cause, using `diagnosis.md`'s classes. Recommend.
   - If the owner chooses "revise on dev": change the prompt or record in its own commit, rerun step 7 (a new run folder, since the hash covers the prompt), rewrite this page, and stop again.
   - **Stop at Gate 2.**

**Stage C: held-out, once** (only on Gate 2's "run")

9. **Parse held-out.** `npm run benchmark:parse -- --set heldout`, about 1 hour, resumable. Commit the 30 parses into the same run folder. Record criteria kept and rejected, and any failures and retries.

10. **Held-out.** `npm run benchmark:check -- --arm full`, about 28 hours, resumable, once.
    - Commit the result (`evals/results/benchmark/check/01-<hash>.json`) and its transcripts. `benchmark:check -- --check` passes.
    - **Then, by hand,** class every remaining counted false-alarm line by `diagnosis.md`'s causes, from `benchmark:lines`. Record the counts in Records, labelled as a reading, not a measure.
    - Nothing in `src/` or the scoring changes after this step.

**Stage D: written up**

11. **Docs.**
    - **`docs/check.md`:**
      - "How it works": the reading's condition rule and the record's part lines;
      - the measured section: held-out from the full summary, both measures, by reason;
      - False alarms: what remains, by cause;
      - Limits: "or" lists, conditions the parser drops, no judgment of purpose, the account arm not rerun.
    - **`docs/benchmark.md`:** the check section gains held-out beside 0008's dev, and the new dev; the account arm is marked not rerun.
    - **`work/ROADMAP.md`:** a 0009 row. Only that row, staged with `git add -p`. The Future scope section stays unstaged unless the owner says otherwise.
    - **`CLAUDE.md`:**
      - the `benchmark:lines` command;
      - `benchmark:check`'s `--check --result` and `--parts`;
      - the boundary sentence for `benchmark:lines` if step 2 added one.
    - **README:** change only if a sentence describes the check's false alarms. No numbers.
    - If Gate 2 was "stop", the docs report dev only and say held-out is still unread.

12. **Review passes** (`REVIEW.md`, five passes over `main...HEAD`). Record findings and fixes in Records.

## Files that change

- `work/0009-check-false-alarms/plan.md`, `diagnosis.md`, `gate-1-fix.md`, `gate-1-records.txt`, `gate-2-dev.md`, `gate-2-flags.txt`
- `src/screening/prompts.ts`: `READ_SYSTEM_PROMPT`
- `src/check/record.ts`: `counts.onePart`, `countsLine`, `ASK_PART`, `toAsk` order
- `evals/check/run.ts`: `CHECK_REVISION` 3
- `evals/benchmark/check-metrics.ts`: the counted-lines helper, exported, with rows unchanged
- `evals/benchmark/check-parts.ts`: new
- `evals/benchmark/check-result.ts`: the optional `parts` block and its regrade
- `scripts/benchmark-check.ts`: writes `parts`; `--check --result`, `--parts`
- `scripts/benchmark-lines.ts`: new; `package.json`: `benchmark:lines`
- `tests/screening/prompts.test.ts`, `tests/check/record.test.ts`, `tests/evals/benchmark-check.test.ts`, `tests/scripts/benchmark-lines.test.ts` (new), `tests/boundary.test.ts`
- `e2e/check.spec.ts`: only if step 5 finds an expectation on the changed wording
- `evals/results/benchmark/check/dev/02-*.json`, `evals/results/benchmark/check/01-*.json`, and their `runs/` folders
- `data/criteria/trialbench/qwen3.6-35b-a3b-mlx-8bit-e1e694b3-n2/`: held-out's 30 parses
- `docs/check.md`, `docs/benchmark.md`, `work/ROADMAP.md` (0009 row only), `CLAUDE.md`, possibly `README.md`

**Not changed:**
- `src/criteria/`;
- `src/screening/` beyond `prompts.ts`;
- `src/web/`;
- the summary participant and `KNOWING.md`;
- 0007's and 0008's committed results.

## Reused, not rebuilt

- **The run:** `checkBenchmarkPair`, `benchmark:parse`, `benchmark:check`'s run hash, resumption, failures file and held-out guard.
- **The scoring:** `scoreBenchmarkPair`, `summarizeArm`, `rate`, `overlap` and `LINK_THRESHOLD`.
- **The record:** `recordFor` and `withPart`.
- **Building `wording` and `parts`:** `findParse`, `fromParse`, and `startCheck`'s construction of both.
- **The guards:** `verdictHitsOf`, `unknownsMissingOf`, and the verdict-word scan for `ours`.
- **The prompt tests:** the five-word-run pattern in `tests/screening/prompts.test.ts`.

## Risks

- **The widened "does-not-apply" overreaches.** The model may call a real requirement conditional, and close it as "not about you". It stays on the record under "Needs your records", so nothing is dropped, but a real conflict could lose its "may not fit". The gate-2 page lists every dev rule read "does-not-apply" so the owner can see this.
- **Prompt changes at temperature 0 change the conversation's path,** so a line can vanish because its question wasn't asked, not because it was read right. The gate page tells "gone" from "not asked".
- **Dev's 14 pairs can't show a rate.** Gate 2 decides on lines, not rates.
- **Held-out's false alarms may stay high from "or" lists alone,** which this slice leaves. The by-cause reading makes that visible rather than hiding it in one number.
- **Long trials:** NCT03331380 took up to 79 minutes a check in 0008. The estimate is from 0008's average and may run longer. Runs are resumable.
- **The local server's memory guard** refused some prefills in 0008. A rerun finishes them.

## Verification

- **Every step:** `npm run check` exits 0.
- **After steps 4, 5, 7 and 10:**
  - the `--check` regrades named in step 1 still pass, with `other:eval`'s known difference unchanged;
  - `benchmark:check -- --check --result evals/results/benchmark/check/dev/01-5ed77c679dad.json` passes;
  - 0007's `check:eval -- --check` passes.
- **After step 5:** `npm run test:e2e` passes.
- **By hand, after step 5:** `npm run app -- --fake`. Check a trial with a part rule and read the counts sentence and the "To ask your oncologist" list on the page.
- **The spec's requirements, step by step:**

  | Spec | Step |
  | --- | --- |
  | §2 | steps 2 and 3 |
  | §3 | step 6 |
  | §4 | step 5 |
  | §5.1 | unchanged; regraded in step 4 |
  | §5.2 | step 4 |
  | §5.3 | steps 8 and 10 |
  | §6 | steps 7, 9 and 10 |
  | §7 | the gates |
  | §8 | step 11 |
  | §9 | the boundary test, unchanged except for step 2's addition |
  | §10 | steps 2, 4, 5 and 6 |

## Records

- **The owner approved this plan as written (2026-11).**
- **Step 1, baseline** (on `0009-check-false-alarms` at `ce089f5`, `main` at `f250cf4` plus intent, spec and plan):
  - `npm run check` exits 0; 1,253 tests (1,245 passed, 8 expected to fail) in 112 files; `npm test` about 0.8 s.
  - `npm run test:e2e`: 8 passed.
  - `search:eval -- --check`, `questions:eval -- --check` and `-- --check --dev`, `facts:eval -- --check`, `check:eval -- --check` and `-- --check --dev`, `benchmark:search -- --trec --check` and `-- --trialbench --check`, and `benchmark:check -- --check --dev` pass.
  - `other:eval -- --check` and `-- --check --dev` fail with "labelsSha256 differs" and nothing else, as recorded since 0006.
- **Step 2, `benchmark:lines`:** `scripts/benchmark-lines.ts` (`formatLines`, `readParse`, `rebuildRecord`, `formatRecord`) and `npm run benchmark:lines`. 4 tests in `tests/scripts/benchmark-lines.test.ts`, and a boundary block of 4: the script's graph reaches no `src/models/` module, not `src/criteria/parse.ts`, not the agent's `session.ts` or `calls.ts`, and no network.
  - **Divergence:** the script reads a parse's JSON from the result's `parseRun` folder itself, rather than through `findParse`. `src/check/parse-cache.ts` imports the parser, which imports `src/models/types.ts`, and the boundary would then have to allow a model module. The parse is only read for its passages and parts; its checksum against the criteria text isn't needed for printing.
  - On 0008's dev result it prints 899 lines over 28 pair-arms; `--record` on nci-41 × NCT02211755 renders every section.
- **Step 3, `diagnosis.md`:** 120 "may not fit" lines on 0008's dev, both arms; 89 counted, 31 resting on a flagged reply.
  - **Causes 3 and 4: 11 lines, 9 counted.** None has locus `code`, so §2 holds. The prompt can reach 8 and may reach 2 (nci-37's P5, a condition the parse joined into a conjunction). It can't reach 1 (nci-13's P2, a condition the parse dropped).
  - **Cause 2: 95 lines, 69 counted. Cause 1, outside a part: 9, 8 counted.**
  - **At best, from the full summary, 8 of 9 false alarms become 4 of 9.** The four left are two "or" lists, a fair washout question and a "solid tumors" rule. On ineligible pairs, catches outside parts drop to nci-37's alone, which rests on the contraception misreading: the check reads rules, not purpose.
  - **Divergence:** a fifth locus, `measure`, for part lines. The plan listed `parse`, `statement`, `reading` and `code`.
- **Step 4, the parts measure:** `evals/benchmark/check-parts.ts` (`scorePartsPair`, `summarizeParts`). `check-metrics.ts` exports `countedLines` and `linesOf`, which `scoreBenchmarkPair` now uses with no change to its rows. `BenchmarkCheckResult.parts` is optional and is regraded only when present. `benchmark:check` gains `--check --result <path>` and `--parts <path>`. 5 tests, 1,266 in all (1,258 passed, 8 expected to fail).
  - `benchmark:check -- --check --dev` and `-- --check --result …/dev/01-5ed77c679dad.json` pass. So do `check:eval -- --check` and `-- --check --dev`.
  - **0008's dev, in the parts measure** (`--parts`), the before figures:

    | | full | account |
    | --- | --- | --- |
    | caught outside parts | 1 of 5 | 1 of 5 |
    | false alarms outside parts | 5 of 9 (recommended 5 of 6, eligible but not recommended 0 of 3) | 2 of 9 (2 of 6, 0 of 3) |
    | named rule on the record | 1 of 1 | 1 of 1 |

    These match the reading on 0008's gate page.
- **Step 5, the record's part lines:** `counts.onePart`, `countsLine(mayNotFit, records, onePart)`, `ASK_PART`, and part lines last on "To ask your oncologist", in `src/check/record.ts`. `CHECK_REVISION` is 3. 4 tests, 1,269 in all (1,261 passed, 8 expected to fail).
  - **Divergence, wording:** when every "may not fit" is on one part, the second sentence drops "more": "0 rules may not fit what you said. 7 are for one part of the trial, which you may not be in." Found by rendering nci-25 × NCT00003838.
  - `npm run test:e2e`: 8 passed, with no expectation changed. `check:eval -- --check` and `-- --check --dev`, and `benchmark:check -- --check --dev`, pass.
  - **Not done by hand:** the plan's check of `npm run app -- --fake` in a browser. `Record.tsx` is unchanged and renders `counts.line` and `toAsk.items` as given. The new wording was read on dev records through `benchmark:lines --record` instead.
- **Step 6, the reading prompt:** the three additions of §3 in `READ_SYSTEM_PROMPT`. `PROMPT_VERSION` is `f8b60faffee1` (was `8fda2872b52a`). 3 tests, 1,272 in all (1,264 passed, 8 expected to fail).
  - **Divergence, the overlap test:** the plan said `READ_SYSTEM_PROMPT` shares no five-word run with NIH-TrialBench's trials or the twelve pinned protocols. Before this slice it already shared five, all from the prescreening repository's aspirin and gemcitabine examples. The test lists those five and holds that nothing added shares another.
  - **One phrase replaced, not added:** "never about its condition" became "never about what it requires", since "condition" now names the "if".
  - `gate-1-fix.md` written, and its two records in `gate-1-records.txt`. **Stopped at Gate 1.**
- **Gate 1's answer: go.** The fix, the measures and the bar are frozen; stage B runs. Recorded in `gate-1-fix.md`, Answer.
- **Step 7, dev rerun:** `npm run benchmark:check -- --dev --arm full`, run `dev-17a5dbee2eb0`, on Qwen3.6-35B-A3B-MLX-8bit at temperature 0, seed 20260921, reasoning off; agent prompt `f8b60faffee1`, `CHECK_REVISION` 3. Result `evals/results/benchmark/check/dev/02-17a5dbee2eb0.json`.
  - **Stops:** the first attempt's first three checks were refused by the local server's memory guard (prefill about 35.7 GB of 35.77 GB). Their transcripts weren't kept. The owner freed memory, and the rerun finished all 14 with no stop and an empty `failures.json`.
  - **Timing:** 18,843 s of checks, about 5.2 hours; 22.4 minutes a check (0008: 29.6). The longest, nci-17 × NCT03331380, took 58.5 minutes.
  - `benchmark:check -- --check --dev` and `-- --check --result …/dev/01-5ed77c679dad.json` pass.
- **Step 8, `gate-2-dev.md`:** the bar is met (0 `verdictHits`, 0 `unknownsMissing`, 118 flags on 109 replies read and classed, 110 findings excluded, 14 of 14 finished).
  - **Before and after, full summary:** frozen caught 4 → 5 of 5, false alarms 8 → 7 of 9; outside parts, caught 1 → 1 of 5, false alarms 5 → 5 of 9, named rule 1 of 1. Counted false-alarm lines 27 → 20.
  - Of the six full-summary lines in causes 3 and 4, four are gone and read right; nci-13 P13 (a permission) and nci-37 P5 (a joined condition) are still there. Two new lines outside parts on eligible pairs: nci-12 × NCT04708470 P7 (statement inverted) and nci-17 × NCT06161532 P67 (reading). "Does-not-apply" was read 7 times, none an overreach.
  - **Divergence:** the flags are listed in their own file, `gate-2-flags.txt`, as in 0008.
  - **Recommendation: stop,** keeping held-out unread. **Stopped at Gate 2.**
- **Gate 2's answer: stop.** Stage C (steps 9 and 10) doesn't run, and held-out stays unread. Stage D reports dev as a dev finding. Recorded in `gate-2-dev.md`, Answer.
- **Step 11, docs:** `docs/check.md` (the reading's three additions under "How it works", the counts sentence and the part question under the record, a "What slice 0009 changed" section, and Limits by cause), `docs/benchmark.md` (the dev rerun beside 0008's, in both measures; held-out still unread; the new commands), the roadmap's 0009 row and header, and `CLAUDE.md` (`benchmark:lines`, `benchmark:check`'s `--check --result` and `--parts`, and the boundary sentence). The README has no sentence on the check's false alarms and is unchanged.
  - **As Gate 2 was "stop",** the docs report dev only and say held-out is still unread. Stage C's steps 9 and 10 weren't done.
  - The roadmap's uncommitted Future scope section stays unstaged: the 0009 row was staged from the committed file.
