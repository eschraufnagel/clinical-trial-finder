# plan: 0010 "or" lists

**Intent:** [intent.md](intent.md), committed as `0010 intent` and revised as `0010 intent: revised`. **Spec:** [spec.md](spec.md), committed as `0010 spec`. Section numbers (§) below are the spec's.

## Context

Slice 0009 fixed most of the deeper check's pregnancy and conditional lines on NIH-TrialBench dev. False alarms outside parts stayed at 5 of 9. The largest cause left in one place is the parser splitting a list of alternatives into separate requirements:
- NCT02211755: "solid tumors …, or" and "myelodysplastic syndrome" became P1 and P2;
- NCT06161532: a lead-in "…of the following histologies:" and five items, P2 to P6.

A person with one item then "may not fit" each of the others. 0009's rerun still has four counted lines from this: nci-17 × NCT06161532 P3, P4, P6, and nci-41 × NCT02211755 P2 (`work/0009-check-false-alarms/gate-2-dev.md`, §3).

**The owner chose, for this slice:**
- "or" lists only;
- `Criterion` may gain a field;
- held-out's one look is spent only if a gate after dev says so.

**So the slice** (§2 to §4):
- the parser keeps splitting lists one item per criterion, and marks the items of one list with a shared `anyOf` label;
- invalid marks are dropped in code;
- the record reads a marked list as one requirement: "may not fit" only when every item does;
- the agent and `ScreeningCriterion` are unchanged.

**What the code is today:**
- **The parser.** `src/criteria/prompt.ts`:
  - `SYSTEM_PROMPT`, hashed into `PROMPT_VERSION` (`e1e694b399d4`); `parseIdentity` names parse files and run folders.
  - Its "Splitting" section already says an alternation within one test is one criterion. The lists that go wrong are separate items or sentences.
  - `src/criteria/validate.ts` reads each raw criterion (`readCriterion`, `readAppliesTo`) into `RawCriterion`.
  - `src/criteria/parse.ts` `locateAll` turns raw criteria into `Criterion` (id from the span, optional `appliesTo`, `loose`, `heading`), then `parseCriteria` returns `ParsedCriteria { criteria, rejected, unclaimed, run }`.
  - No test pins `PROMPT_VERSION`'s value. `tests/criteria/identity.test.ts` uses it relatively.
- **Parse runs.** `npm run benchmark:parse -- --set dev|heldout` writes to `data/criteria/trialbench/<criteriaRunName(model, PROMPT_VERSION, NORMALIZE_VERSION)>/` and moves `latest`. Today that's `qwen3.6-35b-a3b-mlx-8bit-e1e694b3-n2`, holding dev's 12. A new prompt is a new folder.
- **The check.**
  - `startCheck` (`src/check/run.ts`) builds `criteria` with `fromParse`, plus `wording` and `parts` maps from the parse, and `recordOf` passes them to `recordFor` (`src/check/record.ts`).
  - In `recordFor`, `lineFor` decides each line's place, flag and `mayNotFit`; `withPart` relabels part lines; `assemble` counts and builds `toAsk`.
  - The page renders `RecordLine` in `src/web/Record.tsx` (`line.part` with `COPY.record.part`).
  - `scripts/benchmark-lines.ts` `rebuildRecord` rebuilds `wording` and `parts` from the parse JSON it reads itself.
- **The benchmark run.**
  - `scripts/benchmark-check.ts`' run hash covers the parse run folder (`parseRun`), the agent's prompt version and `CHECK_REVISION` (`evals/check/run.ts`, now 3).
  - Results record `parseRun`, so 0008's and 0009's dev results keep regrading from their own parses.
  - Held-out is refused once a held-out result exists; none does.
- **The inherited parser eval.**
  - `evals/runner.ts` `runEval(adapter, { studies, resultsDir, onProgress })` parses the labelled studies (`evals/cases/labels/`: NCT00077350, NCT03433469, NCT04316364, NCT04385368, NCT06728852), grades them with `evals/graders/match.ts` and `metrics.ts`, and writes a run file and cached parses under `resultsDir`.
  - No npm script calls it here, and it uses the current `SYSTEM_PROMPT`. So the old-prompt run has to happen before the prompt changes.
- **The overlap test pattern:** `tests/screening/prompts.test.ts` ("shares no new run of five words …", with a `BEFORE_0009` list).

## Order of work

### Stages and gates

| Stage | Steps | Ends at | What you can see at the end |
| --- | --- | --- | --- |
| **A. The mark, built and tried** | 1–7 | **Gate 1** | the baseline; `criteria:eval`, run under the old prompt; `criteria:compare`; the `anyOf` field and its validation; the record reading lists; the new parser prompt; the five protocols and dev's 12 reparsed; `gate-1-parser.md` |
| **B. Dev, from the full summary** | 8–9 | **Gate 2** | 14 dev pairs rechecked on the new parses; `gate-2-dev.md` |
| **C. Held-out, once** | 10–11 | — | 30 trials parsed; 56 pairs checked; remaining lines classed by cause |
| **D. Written up** | 12–13 | PR | docs, roadmap row, `CLAUDE.md`, review passes |

**Stage A's model runs.** Steps 2 and 7 parse on the local model: the five protocols twice, and dev's 12 trials once, under an hour in all. The intent says every model run is a gate. **Accepting this plan is the go-ahead for those parses,** recorded here so it can be argued with. No check runs in stage A.

**Gate 1: freeze the parser prompt and the record, and spend about 5 hours on dev?** (§2 to §5, §7)
- **What's decided:**
  - **whether the new prompt marks lists without moving the split.** The five protocols' grades under the old and new prompts; dev's 12 compared criterion by criterion; every mark read by hand, as real "any one of these", or a mark that would hide a requirement;
  - **the dropped marks:** how many, and why;
  - **the record's lead-in and counts,** on two dev records re-rendered with marks from their stored findings;
  - **the estimate of lists on NSCLC,** from 0007's committed parses;
  - **the Gate 2 bar,** frozen here.
- **What the owner sees:** `work/0010-or-lists/gate-1-parser.md`.
- **What it costs to be wrong:** stage B spends about 5 hours of the owner's machine. A parser that marks "and" lists would hide real conflicts on the dev run. One that moves the split would measure a different parser from the one 0009 measured. Either way the run is wasted, and a revision costs another.
- **Can be no:**
  - **"revise":** the prompt or the validation, then step 7 again and Gate 1 again;
  - **"stop":** the prompt change is reverted in its own commit, so the page never parses with an unmeasured prompt. The field, validation, record and scripts ship; with no marks they change nothing. Stage D writes it up.

**Gate 2: spend held-out's one look on this fix?** (§6, §7)
- **What's decided:** run held-out (stage C, about 1 hour of parsing and 21 to 28 hours of checks), revise on dev, or stop.
- **The bar, frozen at Gate 1:**
  1. no `verdictHits`;
  2. every unresolved, chart-review or not-asked criterion on its record (`unknownsMissing` 0);
  3. every fidelity flag read and explained in the gate page, and no finding scored from a flagged turn;
  4. every dev pair finished, or listed with why;
  5. each of 0009's four counted "or" lines is gone and its list read right, or listed with why;
  6. no list marked on "and" items, and no real requirement without "may not fit" because of a mark.

  The pair rate outside parts is shown in both measures, never barred: at best 5 of 9 becomes 4 of 9, inside 0009's run-to-run variation. Meeting the bar doesn't mean held-out is worth it.
- **What the owner sees:** `work/0010-or-lists/gate-2-dev.md`:
  - both measures, before (0009's dev `02-17a5dbee2eb0.json`) and after;
  - the four "or" lines, and every line on a marked list;
  - every new counted line, with a cause from 0009's `diagnosis.md` classes;
  - flags;
  - timing, the held-out estimate, and what keeping held-out for a larger fix would buy.
- **What it costs to be wrong:** held-out is the last unread set. Spent on a fix that can move one pair in nine, the next fix has nothing unread to be measured on.
- **Can be no:**
  - **"revise on dev":** the prompt or the record again. Each revision reparses dev, reruns it (about 5 hours), and comes back to Gate 2.
  - **"stop":** stages A, B and D ship, with dev reported as a dev finding, and held-out stays unread.
  - **"stop and revert":** the same, with the prompt reverted, if dev shows the marks did harm.

**Stages C and D need no gate.** Gate 2 decided whether to look, and stage D is documentation.

**No hosted run is in this plan.** Every model run is on the local model (Qwen3.6-35B-A3B-MLX-8bit, temperature 0, seed 20260921), which the owner's machine must be serving:
- parses at `benchmark:parse`'s and the runner's defaults, as 0008 parsed;
- checks with reasoning off, as `benchmark:check` sets it.

A hosted run, if asked for at a gate, is a new gate: dry first with `--model <spec>` and no `--spend`. Nothing creates or edits `.env`.

### Steps

**Rules for every step:**
- One commit per step, through `npm run check && git commit`.
- No Co-Authored-By trailer.
- No test mocks a module or stubs a global; no test reads `local/` or a gitignored file.
- Dates are months.
- `work/ROADMAP.md`'s uncommitted Future scope section is the owner's: never staged. Stage files by name.

**Stage A: the mark, built and tried**

1. **Baseline.** On this branch at the plan's commit, record in Records:
   - `npm run check` exits 0, with the test count and `npm test`'s time;
   - `npm run test:e2e` passes;
   - these regrades pass: `search:eval -- --check`, `questions:eval -- --check` and `-- --check --dev`, `facts:eval -- --check`, `check:eval -- --check` and `-- --check --dev`, `benchmark:search -- --trec --check` and `-- --trialbench --check`, `benchmark:check -- --check --dev`, and `benchmark:check -- --check --result evals/results/benchmark/check/dev/01-5ed77c679dad.json`;
   - `other:eval -- --check` and `-- --check --dev` fail with only "labelsSha256 differs", as since 0006. "Unchanged" below means that one difference.

   The commit is `plan.md`'s Records alone.

2. **`criteria:eval`, and the old prompt's grades** (§5, item 1).
   - **`scripts/criteria-eval.ts`, `npm run criteria:eval`** (with `node --env-file-if-exists=.env --import tsx`, like `benchmark:parse`):
     - model flags as `scripts/benchmark-parse.ts` reads them (`readModelFlags`, `planPaidRun`), so `--model <spec>` is dry without `--spend`;
     - the adapter from `createLocalAdapter(spec)` by default;
     - calls `runEval(adapter, { resultsDir: "evals/results/criteria", onProgress: console.log })` over every labelled study;
     - prints the pooled recall, precision and type agreement and the run file's path.
   - **Boundary:** no change. The script names no concrete adapter and reaches the factory only, which `tests/boundary.test.ts` already allows for `scripts/`.
   - **Run it once, now, under the old prompt.** Commit the run file and its parses under `evals/results/criteria/`. Record the pooled figures and the time.

3. **`criteria:compare`** (§5, items 2 and 4). No model.
   - **`scripts/criteria-compare.ts`, `npm run criteria:compare -- <old dir|file> <new dir|file>`.** For each trial present in both, matched by NCT ID from the parse file:
     - criteria matched by `id`, which comes from the span;
     - ids only in the old, and only in the new, each listed with its quote: split, joined or lost;
     - matched criteria whose `polarity`, `type`, `appliesTo` or `text` changed;
     - every `anyOf` label, with its items' quotes;
     - every dropped mark, with its reason.

     Then totals.
   - **`--lists <dir>`:** a no-model estimate over one run folder. It counts trials, and list-like runs among them:
     - a criterion whose source text ends in ", or" or " or";
     - two or more consecutive criteria following one whose source text ends in ":".

     Labelled in its output as an estimate.
   - It reads parse JSON with `JSON.parse` and the `ParsedCriteria` type only, as `benchmark-lines.ts` does, and imports nothing from `src/criteria/parse.ts`, `src/check/parse-cache.ts` or `src/models/`.
   - **Tests**, `tests/scripts/criteria-compare.test.ts`, on two small parses built in the test: a split, a join, a lost quote, a changed type, a new mark, a dropped mark; and `--lists` on a run with one ", or" pair and one lead-in with three items.
   - **`tests/boundary.test.ts`:** a block in the pattern of the `benchmark:lines` one: the script's import graph reaches no model module, not the parser, not `parse-cache.ts`, and no network, with a "would catch" case.
   - **Run** `--lists` on `data/criteria/2026-10/qwen3.6-35b-a3b-mlx-8bit-e1e694b3-n2/` (0007's 40) and on dev's 12. Record the counts.

4. **The `anyOf` field and its validation** (§2). No prompt change yet, so `PROMPT_VERSION` is unchanged.
   - **`src/criteria/types.ts`:**
     - `Criterion` gains `anyOf?: string`, with the spec's comment;
     - `ParsedCriteria` gains `droppedMarks?: DroppedMark[]`, where `DroppedMark` is `{ label: string; ids: string[]; reason: string }`, present only when non-empty;
     - a comment saying why it's not in `rejected`: the criteria stay, and only their mark goes.
   - **`src/criteria/validate.ts`:** `RawCriterion.anyOf: string | null`, read by a `readAnyOf` like `readAppliesTo`. A non-string is a problem; an empty string is null.
   - **`src/criteria/parse.ts`:**
     - `locateAll` copies `anyOf` onto `Criterion` when non-null.
     - A new exported `settleLists(criteria): { criteria; dropped: DroppedMark[] }` runs after `locateAll` and drops a label (removing `anyOf` from its items) when it has:
       - one item: "a list needs two or more items";
       - items differing in `polarity`: "items differ in polarity";
       - items differing in `appliesTo`: "items differ in the part they're for";
       - exclusions only: "an exclusion list already reads right split".
     - `parseCriteria` returns `droppedMarks` when any.
   - **Tests**, `tests/criteria/lists.test.ts`: each of the four drops, with its reason; a valid inclusion list kept; `readAnyOf` on a number, an empty string and null; a parse JSON without `anyOf` or `droppedMarks` (a committed dev parse) loads, and `fromParse` gives the same criteria as before.

5. **The record reads lists** (§4).
   - **`src/check/run.ts`:**
     - `Check` gains `lists: Map<string, string>`, criterion id to label, built in `startCheck` like `parts`;
     - `recordOf` passes `lists`.
   - **`src/check/record.ts`:**
     - `RecordInput.lists?: ReadonlyMap<string, string>`.
     - `RecordLine.list: Words | null`, null everywhere it's built today, including `recordWithoutParse`.
     - New `LIST_ANY = "One of a list: the trial asks for any one of these."`, as `ours`.
     - In `recordFor`: build each line with `lineFor` as now, then, per label with two or more lines:
       - if **every** item's line has `mayNotFit`, leave them;
       - otherwise set `mayNotFit: false` on each item, and `flag: null` on each item whose flag was `MAY_NOT_FIT`.
       - Every item gets `list: ours(LIST_ANY)`.
       - Then `withPart`, as now.

       The rule needs no separate "met" test: a list where any item isn't a conflict is not "may not fit". That covers both "any item met" and "otherwise" in §4.
     - In `assemble`, `counts.mayNotFit` and `counts.onePart` count a list once: lines with `mayNotFit` and no `list`, plus one per distinct label among lines with `mayNotFit`. That needs the label on the line, so `RecordLine` also carries `listId: string | null` (the label), which the page doesn't show. `toAsk` is unchanged: each item of a list that "may not fit" keeps its own question.
     - Nothing moves between sections.
   - **`src/web/Record.tsx`:** render `line.list` as a note beside the rule, like `line.part`, with `<W w={line.list} />` and no new copy string.
   - **`scripts/benchmark-lines.ts`:** `rebuildRecord` builds `lists` from the parse JSON the way it builds `parts`.
   - **`evals/check/run.ts`:** `CHECK_REVISION = 4`, with a comment line: 0010 reads lists on the record.
   - **Tests**, `tests/check/record.test.ts`:
     - a list with one item that holds and one that doesn't: no "may not fit", and the conflicting item's flag null;
     - every item conflicting: each "may not fit", counted once in `counts` and the counts sentence;
     - one conflicting and one unresolved: no flag; the unresolved item under records and in `toAsk`;
     - a list on a part: counted once in `onePart`;
     - a record with no lists is deep-equal to today's apart from `list: null` and `listId: null`;
     - `LIST_ANY` passes the verdict-word scan, and no key matches the existing verdict-key regex.
   - **Tests**, `tests/check/run.test.ts` (or the existing `startCheck` test): `lists` built from a parse with marks. Plus `tests/scripts/benchmark-lines.test.ts`: `--record` on a fixture parse with a list shows the lead-in.
   - Run `npm run test:e2e`. `--fake` checks only 0007's committed parses, which have no marks, so no expectation should change; if one does, stop and record why. The `--check` regrades named in step 1 still pass: they regrade stored records.

6. **The parser prompt** (§3).
   - **`src/criteria/prompt.ts`, `SYSTEM_PROMPT`:**
     - **The output shape** gains `"anyOf": "a short label shared by every item of one list the trial accepts any one of, or null"`.
     - **"Splitting"** gains one rule after the alternation rule, which stays word for word: when a requirement offers alternatives as separate items or sentences (a lead-in such as "…any of the following:" followed by items, or an item ending ", or"), each item is still its own criterion, and every item of that list gets the same `anyOf` label. Items joined by "and", or listed under a lead-in that doesn't say "any" or "or", are separate requirements and get `anyOf: null`.
     - **The worked example** gains, inside the invented block, an invented inclusion lead-in with three items marked with one label, and two adjacent "and" requirements left null. The example uses no condition, drug or wording from the twelve pinned protocols or NIH-TrialBench's trials; something like eye or skin conditions, as far from oncology as the existing example is. Every output entry in the example gains `"anyOf": null` or its label.
     - The header comment gains a paragraph: 0010 here, why a mark rather than a merged rule, and the history line it answers.
   - **Tests:**
     - **`tests/criteria/prompt-overlap.test.ts`, new,** with the five-word-run helper from `tests/screening/prompts.test.ts`: `SYSTEM_PROMPT` shares no run of five words with any NIH-TrialBench trial's criteria (`loadTrialBench`) or the twelve pinned protocols (`loadTrials`), beyond a `BEFORE_0010` list of the runs it already shared. Build that list by running the helper on the old prompt in this step, before the edit, and paste it in.
     - **`tests/criteria/identity.test.ts`** still passes (relative).
     - **`tests/criteria/parse.test.ts`:** a fake adapter returning entries with `anyOf` yields marked criteria.
   - The committed parses keep their old `promptVersion`; nothing reads the new one until step 7.

7. **The parser, tried** (§5). Local model, under an hour.
   - `npm run criteria:eval`: a new run file under `evals/results/criteria/`, new prompt, same model and seed.
   - `npm run benchmark:parse -- --set dev`: a new folder under `data/criteria/trialbench/`, and `latest` moves to it.
   - `npm run criteria:compare` twice:
     - old dev folder against new;
     - the five protocols' old parses against their new ones, from `evals/results/criteria/parses/`.
   - **Read every `anyOf` mark by hand,** on the five protocols and dev's 12.
   - **`work/0010-or-lists/gate-1-parser.md`:**
     - the five protocols' grades, old and new, side by side;
     - the comparison totals and every split, join, loss and changed polarity or type;
     - every mark, classed as a real list or not;
     - dropped marks;
     - `--lists` counts from step 3, as an estimate;
     - the prompt's diff;
     - two dev records re-rendered with `benchmark:lines -- --record` from 0009's dev result's transcripts with the new parses' marks: nci-41 × NCT02211755 and nci-17 × NCT06161532 (needs `rebuildRecord` to read marks from a parse folder given on the command line; add `--parses <dir>` to `benchmark:lines` in this step if it doesn't take one);
     - the Gate 2 bar;
     - the estimate for dev.
   - **The ids must match** for re-rendering 0009's findings on new parses: a criterion id the new parse doesn't share can't carry its finding. The page says which lines that affects.
   - Commit the parses, the run file, the gate page and any `--parses` flag together. **Stop at Gate 1.**

**Stage B: dev, from the full summary**

8. **Dev rerun.** `npm run benchmark:check -- --dev --arm full`, on the local model, about 5 hours, resumable. The run hash covers the new `parseRun` and `CHECK_REVISION` 4, so it's a new run folder.
   - A pair refused by the local server's memory guard is rerun, as in 0009.
   - Commit the result (`evals/results/benchmark/check/dev/03-<hash>.json`, with `parts`) and its transcripts.
   - `benchmark:check -- --check --dev` passes, and so does `--check --result` on `01-5ed77c679dad.json` and on `02-17a5dbee2eb0.json`.
   - Record model, prompt versions, timing and stops in Records.

9. **`gate-2-dev.md`,** from `benchmark:lines` on the new result and `--parts` on both, as Gate 2's "What the owner sees" lists, plus `gate-2-flags.txt` in 0009's form. For each of the four "or" lines: gone and read right, still there, or not asked this time. Recommend.
   - If "revise on dev": the change in its own commit, then step 7's dev reparse, step 8, and this page again.
   - **Stop at Gate 2.**

**Stage C: held-out, once** (only on Gate 2's "run")

10. **Parse held-out.** `npm run benchmark:parse -- --set heldout`, about 1 hour, into the new run folder. Commit the 30 parses. Record criteria kept, rejected, marks and dropped marks.

11. **Held-out.** `npm run benchmark:check -- --arm full`, 21 to 28 hours, resumable, once.
    - Commit the result (`evals/results/benchmark/check/01-<hash>.json`) and transcripts. `benchmark:check -- --check` passes.
    - **Then, by hand,** class every remaining counted false-alarm line by `diagnosis.md`'s causes, from `benchmark:lines`. Record the counts as a reading, not a measure.
    - Nothing in `src/`, the prompt or the scoring changes after this step.

**Stage D: written up**

12. **Docs.**
    - **`docs/check.md`:**
      - "How it works": the list mark and how the record reads it, with the lead-in;
      - a "What slice 0010 changed" section: dev in both measures, and held-out if run;
      - Limits: lists of exclusions untouched; 0007's committed parses and results predate the mark; conditions the parser drops or joins, the restatement and "solid tumors" remain.
    - **`docs/benchmark.md`:** the dev rerun beside 0008's and 0009's; held-out run, or still unread.
    - **The parser's doc,** wherever `docs/` describes the parser's output: the `anyOf` field, its validation, and the five protocols' grades before and after. If no doc describes it, `docs/check.md` carries it.
    - **`work/ROADMAP.md`:** a 0010 row and the header's count, staged with `git add -p`. Future scope stays unstaged.
    - **`CLAUDE.md`:**
      - `criteria:eval` and `criteria:compare` in the command table, and `benchmark:lines -- --parses` if added;
      - one boundary sentence: since slice 0010 the test keeps `criteria:compare` from the parser, the parse cache, every model module and the network.
    - **README:** only if a sentence describes the check's false alarms.
    - If Gate 1 or 2 was "stop", the docs say what ran and what didn't.

13. **Review passes** (`REVIEW.md`, five passes over `main...HEAD`). Record findings and fixes in Records.

## Files that change

- `work/0010-or-lists/plan.md`, `gate-1-parser.md`, `gate-2-dev.md`, `gate-2-flags.txt`
- `src/criteria/types.ts`: `anyOf`, `DroppedMark`, `droppedMarks`
- `src/criteria/validate.ts`: `RawCriterion.anyOf`, `readAnyOf`
- `src/criteria/parse.ts`: copying `anyOf`, `settleLists`, `droppedMarks`
- `src/criteria/prompt.ts`: `SYSTEM_PROMPT`, header comment
- `src/check/run.ts`: `Check.lists`, `recordOf`
- `src/check/record.ts`: `RecordInput.lists`, `RecordLine.list` and `listId`, `LIST_ANY`, list settling, counts
- `src/web/Record.tsx`: the list note
- `evals/check/run.ts`: `CHECK_REVISION` 4
- `scripts/criteria-eval.ts` and `scripts/criteria-compare.ts`, both new; `scripts/benchmark-lines.ts`: `lists`, and `--parses` if needed; `package.json`: two scripts
- `tests/criteria/lists.test.ts`, `tests/criteria/prompt-overlap.test.ts` and `tests/scripts/criteria-compare.test.ts`, all new; `tests/criteria/parse.test.ts`, `tests/check/record.test.ts`, the `startCheck` test, `tests/scripts/benchmark-lines.test.ts`, `tests/boundary.test.ts`
- `evals/results/criteria/`: two run files and their parses, new
- `data/criteria/trialbench/<new run>/`: dev's 12, plus held-out's 30 if run; `data/criteria/trialbench/latest`
- `evals/results/benchmark/check/dev/03-*.json` and `runs/`; a held-out result if run
- `docs/check.md`, `docs/benchmark.md`, `work/ROADMAP.md` (0010 row and header only), `CLAUDE.md`

**Not changed:**
- `src/screening/` and `ScreeningCriterion`;
- `src/search/`, `src/facts/`, `src/questions/`, `src/shortlist/`;
- the summary participant;
- `data/criteria/2026-10/` and 0007's results;
- the old `data/criteria/trialbench/qwen3.6-35b-a3b-mlx-8bit-e1e694b3-n2/` folder;
- 0008's and 0009's results;
- `e2e/`, unless step 5 finds otherwise.

## Reused, not rebuilt

- **Parser eval:** `runEval`, `matchCriteria`, `scoreStudy`, `poolMetrics`, the labels and their loader.
- **Parse runs:** `benchmark:parse`, `criteriaRunName`, `parseWithCache`, `latest`.
- **The check:** `startCheck`'s map-building pattern (`parts`), `recordFor`, `lineFor`, `withPart`, and `benchmark-lines.ts`' `rebuildRecord`.
- **The run and scoring:** `benchmark:check` (run hash, resumption, held-out guard, `--check --result`, `--parts`), `check-metrics.ts` and `check-parts.ts` unchanged.
- **Flags:** `readModelFlags` and `planPaidRun`.
- **Guards:** `verdictHits`, `oursIn`, the five-word-run helper pattern, and the `benchmark:lines` boundary block as the template.

## Risks

- **The model marks "and" lists.** The parser's history says it may. Validation can't see that; the hand reading at Gate 1 and bar item 6 can. A wrong mark clears a real conflict's "may not fit", which costs more than a false alarm.
- **The prompt change moves the split.** At temperature 0, a different prompt can split differently. Then ids change, 0009's findings can't be re-rendered on the new parses, and the dev rerun measures a different parse. `criteria:compare` shows it at Gate 1.
- **The model doesn't mark NCT06161532's lead-in list,** because the lead-in names no "or": "of the following histologies". The prompt's rule names lead-ins that say "any of" or list alternatives. If the model reads "of the following" as "and", that list stays split. Gate 1 shows it; "revise" can widen the rule.
- **Lines come and go between runs** (0009). A line can vanish because its question wasn't asked; the gate page tells the two apart.
- **The best case is one pair in nine.** Gate 2 is likely to be "stop", and the plan treats that as a good outcome, not a failure.
- **Long checks and the memory guard,** as in 0008 and 0009; runs are resumable.

## Verification

- **Every step:** `npm run check` exits 0.
- **After steps 5, 8 and 11:** the regrades named in step 1 still pass, with `other:eval`'s known difference unchanged, and `check:eval -- --check` passes.
- **After step 5:** `npm run test:e2e` passes.
- **By hand, after step 7:** `npm run app` on the local model. Check NCT06161532 if it's reachable from a conversation; otherwise read the re-rendered records on the gate page. `--fake` can't show a list: its parses have none.
- **The spec's requirements, step by step:**

  | Spec | Step |
  | --- | --- |
  | §2 | step 4 |
  | §3 | step 6 |
  | §4 | step 5 |
  | §5 item 1 | steps 2 and 7 |
  | §5 item 2 | steps 3 and 7 |
  | §5 item 3 | step 7 |
  | §5 item 4 | step 3 |
  | §6 | steps 7, 8, 10 and 11 |
  | §7 | the gates |
  | §8 | step 12 |
  | §9 | steps 2 and 3, and the boundary test |
  | §10 | steps 3 to 6 |

## Departures from the spec

- **`RecordLine.listId`.** §4 names only `list`. Counting a list once needs the label on the line, so `listId` is added beside it. The page doesn't show it.
- **`droppedMarks` beside `rejected`.** §2 left the choice to the plan. The criteria stay and only the mark goes, so `RejectedCriterion` doesn't fit.
- **`--parses` on `benchmark:lines`,** if needed, so Gate 1 can render 0009's findings with the new marks.

## Records

- **The owner approved this plan as written (2026-11).**
- **Step 1, baseline** (on `0010-or-lists` at `275c2ca`, `main` at `a1b3ca0` plus intent, revised intent, spec and plan):
  - `npm run check` exits 0; 1,272 tests (1,264 passed, 8 expected to fail) in 113 files; `npm test` about 0.9 s.
  - `npm run test:e2e`: 8 passed.
  - `search:eval -- --check`, `questions:eval -- --check` and `-- --check --dev`, `facts:eval -- --check`, `check:eval -- --check` and `-- --check --dev`, `benchmark:search -- --trec --check` and `-- --trialbench --check`, `benchmark:check -- --check --dev` (`dev/02-17a5dbee2eb0.json`) and `-- --check --result …/dev/01-5ed77c679dad.json` pass.
  - `other:eval -- --check` and `-- --check --dev` fail with "labelsSha256 differs" and nothing else, as recorded since 0006.
- **Step 2, `criteria:eval`:** `scripts/criteria-eval.ts` and `npm run criteria:eval`, over `runEval` with `resultsDir` `evals/results/criteria/`.
  - **The old prompt's grades** (`e1e694b399d4`), run file `evals/results/criteria/01-e1e694b399d4.json`, on Qwen3.6-35B-A3B-MLX-8bit at the runner's defaults (temperature 0, seed 20260921, reasoning at the runtime's default), 481 s: 5 studies, 252 labels, 206 predictions, 196 matched; coverage recall 93.7%, strict recall 77.8%, precision 95.1%; type accuracy 91.3%, polarity accuracy 98.5%; 40 merged.
- **Step 3, `criteria:compare`:** `scripts/criteria-compare.ts` (`readParses`, `compareTrial`, `compareSets`, `formatComparison`, `estimateLists`) and `npm run criteria:compare`, with `--old-prompt` and `--new-prompt` to pick parses out of one folder. 5 tests in `tests/scripts/criteria-compare.test.ts`, and a boundary block of 4: the script reaches no model module, not the parser, not the parse cache, and no network.
  - **`--lists`, an estimate from source text only:**

    | Parses | Trials | With a list-like run | Items ending "or" | Lead-ins ending ":" |
    | --- | --- | --- | --- | --- |
    | 0007's picks, `data/criteria/2026-10/…-e1e694b3-n2/` | 39 | 11 | 2 | 27 |
    | NIH-TrialBench dev's 12 | 12 | 7 | 5 | 15 |
    | the five labelled protocols, old prompt | 5 | 1 | 0 | 5 |

  - A lead-in ending ":" is often an "and" list ("adequate organ function:" then lab values), so that column overstates lists. The "or" column is the closer of the two.
  - **Divergence:** the plan said 0007's folder holds 40 parses; it holds 39 and a `failures.json`.
- **Step 4, the `anyOf` field:** `Criterion.anyOf`, `DroppedMark` and `ParsedCriteria.droppedMarks` (`src/criteria/types.ts`); `RawCriterion.anyOf` and `readAnyOf` (`validate.ts`); `settleLists`, run after `locateAll`, and `droppedMarks` on the parse (`parse.ts`); `DroppedMark` and `settleLists` exported from `src/criteria/index.ts`. `PROMPT_VERSION` unchanged. 12 tests in `tests/criteria/lists.test.ts`.
  - **An expectation changed on purpose:** `tests/criteria/validate.test.ts`' well-formed criterion now has `anyOf: null`, the new field's value when absent.
  - **Divergence:** the plan put the fake-adapter parse test with marks in step 6. It's here, in `lists.test.ts`, since it tests this step's code.
- **Step 5, the record reads lists:** `Check.lists` and `recordOf` (`src/check/run.ts`); `RecordInput.lists`, `RecordLine.list` and `listId`, `LIST_ANY`, `settleLists` (the record's, run before `withPart`) and counting a list once (`src/check/record.ts`); the list note in `src/web/Record.tsx`; `rebuildRecord` and `formatRecord` read and print lists (`scripts/benchmark-lines.ts`); `CHECK_REVISION` 4. 6 tests in `tests/check/record.test.ts`, 1 in `tests/check/run.test.ts`, 1 in `tests/scripts/benchmark-lines.test.ts`.
  - `formatRecord` tolerates a stored line with no `list` field, since records written before this step lack it.
  - `npm run test:e2e`: 8 passed, no expectation changed. `check:eval -- --check` and `-- --check --dev`, `benchmark:check -- --check --dev` and `-- --check --result …/dev/01-5ed77c679dad.json` pass.
- **Step 6, the parser prompt:** `SYSTEM_PROMPT` gains `anyOf` in the output shape, one splitting rule (items met by any one, inclusions only, exclusions and "and" items null), `"anyOf": null` on every entry of the first worked example, a second invented worked example (a skin-condition lead-in with three marked items, a contact-lens ", or" pair, and two "and" requirements left null), and a header paragraph. `PROMPT_VERSION` is `08edc407302c` (was `e1e694b399d4`). 3 tests in `tests/criteria/prompt-overlap.test.ts`.
  - **The overlap list:** before this step the prompt shared two five-word runs with NIH-TrialBench's trials, both from its consent boundary case ("to understand and sign informed", "understand and sign informed consent"), and none with the twelve pinned protocols. A first wording of the new example, "of one of the following types", shared two more; it became "being any of these".
- **Step 7, the parser tried:**
  - `criteria:eval`, new prompt: `evals/results/criteria/02-08edc407302c.json`, 537 s. Pooled strict recall 77.8% → 84.9%, coverage recall 93.7% → 94.0%, precision 95.1% → 93.4%, merged 40 → 23, predictions 206 → 229.
  - `benchmark:parse -- --set dev`: run `qwen3.6-35b-a3b-mlx-8bit-08edc407-n2`, 1,631 s for the first pass; `latest` moved to it. **NCT02465060 failed twice** the same way: the whole answer in `reasoning_content`, no `content` (about 340 s each). Recorded in the run's `failures.json`.
  - `criteria:compare`, old against new, both sets, in `gate-1-compare.md`. Dev: 378 matched, 86 old only, 153 new only, 3 polarity and 10 type changed, 16 lists, 7 dropped marks.
  - **The split moved.** NCT04708470 went from 28 rules to 71, and its two exclusions' exceptions became inclusions marked as lists: a new false alarm. Every mark is read in `gate-1-parser.md`.
  - **`benchmark:lines -- --record --parses <dir>`** and `parseDrift`, so 0009's findings can be read with another run's marks; 1 test. Ids are ordinals, and on both target trials they carry over only to P9.
  - **Divergence:** `gate-1-compare.md` holds the comparison output beside the gate page, as 0009 kept its records in `gate-1-records.txt`.
  - **Recommendation: revise** (two lines in "Splitting"), then step 7 again. **Stopped at Gate 1.**
- **Gate 1's answer: revise** (recorded in `gate-1-parser.md`, Answer).
- **Revision R1, the parser prompt:** two lines after the list rule in "Splitting": a list holds only its items (not a heading, not a rule adding a condition); an exception to an exclusion stays inside it. A header line says why. `PROMPT_VERSION` is `d62e4ce71f05`. The overlap test passes unchanged.
- **Step 7 again, after R1:**
  - `criteria:eval`: `evals/results/criteria/03-d62e4ce71f05.json`, 550 s. Pooled strict recall 82.1%, coverage recall 91.7%, precision 93.7%, type accuracy 86.5%, polarity accuracy 96.6%, merged 24, predictions 221.
  - `benchmark:parse -- --set dev`: run `qwen3.6-35b-a3b-mlx-8bit-d62e4ce7-n2`, all 12 in 1,585 s; `latest` moved to it. NCT02465060 parsed, as 145 rules.
  - `criteria:compare` against the old parses: 430 matched, 69 old only, 215 new only, 14 polarity, 13 type and 126 part changed; 25 lists (16 right, 7 wrong, 2 mixed by hand), 14 dropped marks. Two wrong lists hide real requirements (NCT06161532's organ function and "all of the following" brain-lesion conditions).
  - `gate-1-parser.md` gains the second try above the first; `gate-1-compare.md` gains R1's output.
  - **Recommendation: stop,** reverting the prompt. **Stopped at Gate 1 again.**
