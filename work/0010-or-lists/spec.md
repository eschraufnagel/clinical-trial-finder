# spec: 0010 "or" lists

**Status:** Draft
**Date:** 2026-11
**Intent:** [intent.md](intent.md), committed as `0010 intent`.

The parser keeps splitting a list of alternatives one item per rule, as it does now, and marks the items as one list. The record reads a marked list as one requirement: "may not fit" only when every item conflicts. The agent and `ScreeningCriterion` are unchanged. Dev is reparsed and rerun from the full summary. Held-out is spent only if Gate 2 says so.

---

## 1. What exists at the end

- **A list mark on `Criterion`,** `anyOf`, and a parser prompt that sets it, with a new `PROMPT_VERSION` (§2, §3).
- **A record that reads a marked list as one requirement** (`src/check/record.ts`, and the page's `Record.tsx`), with `CHECK_REVISION` 4 (§4).
- **The parser checked before the check is run:** the five hand-labelled protocols graded under the old and new prompts, and dev's 12 trials compared old against new (§5).
- **A dev result,** 0008's 14 dev pairs from the full summary, reparsed, on the local model (§6).
- **A held-out result,** 0008's 56 held-out pairs from the full summary, only if Gate 2 says so (§6, §7).
- **The write-up** in `docs/check.md`, `docs/benchmark.md`, the roadmap row and `CLAUDE.md` (§8).

## 2. The shape: a mark, not a merged rule (OQ 1)

**Proposal:** each item of a list stays its own criterion, as the parser splits it today, and carries a shared label:

```ts
/**
 * Present when this criterion is one item of a list the trial accepts any one
 * of: the same short label on every item (slice 0010 here). Absent on parses
 * made before it, and on any criterion that stands alone.
 */
anyOf?: string;
```

Why the mark rather than one long rule:
- **The split doesn't change.** Quotes, ids, spans, polarity and type come out as they do now. Only the mark is new, so the graded labels and the old parses can show that nothing else moved (§5). A merged rule would change the split, which is exactly what the parser's history warns about: a wording that joined an "or" "made the model bundle every 'or' list" (`src/criteria/prompt.ts`, header).
- **The decision is in code.** Whether a list "may not fit" is worked out in `record.ts` from each item's reading, where a test can hold it. A merged rule would leave it to the model reading one long statement.
- **A wrong mark is visible** in the parse, item by item.

**Validation** (`src/criteria/validate.ts`, `parse.ts`), so a bad mark is dropped rather than trusted:
- a label on one criterion only is dropped (a list has two or more items);
- a list whose items differ in polarity, or in `appliesTo`, loses its mark;
- **a list of exclusions loses its mark.** An exclusion list already reads right split ("no A, or B": either one excludes). Only inclusions are "any one of these".

Each dropped mark is recorded in the parse with its reason, the way `rejected` records a dropped criterion today, so a parse that marks badly looks bad. Whether that is `rejected` itself or a field beside it is the plan's choice: `RejectedCriterion` describes a criterion thrown out, and here the criterion stays.

Gate 1 can overturn this: if the reparse shows the model can't mark lists without changing the split, the slice stops (intent, "narrow, or stop").

## 3. The parser prompt

`SYSTEM_PROMPT` in `src/criteria/prompt.ts`:

- **The output shape** gains `"anyOf": "a short label shared by items of one list, or null"`.
- **One splitting rule is added,** beside the existing alternation rule, which stays word for word: when a requirement offers alternatives as separate items or sentences ("…of the following types:" followed by items, or an item ending ", or"), each item is still its own criterion, and every item of that list gets the same `anyOf` label. Items joined by "and", or listed one after another with no "or" and no lead-in saying "any of", are separate requirements and get none.
- **The worked example** gains an invented list, from no real protocol and no benchmark trial: one inclusion lead-in with three items marked with one label, and next to it a pair of "and" requirements left unmarked. It's there so the model sees both sides, which is what the prescreening repository learned the hard way.
- **The overlap rule.** The prompt's examples share no five-word run with the twelve pinned protocols or the NIH-TrialBench trials. The prescreening repository's `eval:compare -- --overlap` didn't come over, so a test does it, as 0009's test does for the reading prompt (§10).

`PROMPT_VERSION` changes, so `parseIdentity` changes, and every parse made with the new prompt goes to a new run folder (`criteriaRunName`). Old run folders are untouched.

## 4. The record (OQ 2)

**Proposal:** the agent asks each item as it does now. `ScreeningCriterion` keeps its four fields, and nothing under `src/screening/` changes. The list is put together after the session, when the record is made.

**What carries the mark:** `startCheck` (`src/check/run.ts`) builds `lists: Map<criterionId, label>` from the parse, as it builds `parts`, and `recordOf` passes it to `recordFor` through a new optional `RecordInput.lists`. `benchmark:lines -- --record` reads the mark from the parse it already loads.

**How a list is read.** For each item, from its finding:
- **met:** `holds`, or `chart-review` with `reported: "holds"`;
- **conflicts:** what `conflicts()` already says for an inclusion (`does-not-hold`, or `chart-review` reporting it), or an earlier answer's "may not fit" hint;
- **open:** anything else.

Then the list:
- **any item met:** no item is "may not fit";
- **every item conflicts:** every item is "may not fit", as each would be today;
- **otherwise:** no item is "may not fit". An open item stays where it is placed today, under "Needs your records or your oncologist", and goes to "To ask your oncologist" as now.

**What the person sees:**
- Each item stays in the section its own finding places it in. Nothing moves between sections, so "every criterion lands in exactly one section" still holds.
- Each item's line gains `list: Words | null`, a fixed lead-in, "One of a list: the trial asks for any one of these." The page shows it on the line.
- An item that conflicts, in a list that doesn't, shows no flag: not "May not fit", and not "Nothing here conflicts", which would read as though the person had that cancer.
- **The counts line counts a list once.** A list where every item conflicts is "1 rule may not fit", not five. `counts.mayNotFit` counts it once too.

**The intent's wording.** Intent outcome 3 says "one line". This spec keeps one line per item, shown as one list, because merging lines would break the record's one-criterion-one-line rule that the measure and the page's keys rely on. See Concern 2.

**Never:** a list makes no item read as met that wasn't, and adds no "fits" wording. The lead-in is scanned for verdict words like every fixed sentence. A list of items the person couldn't answer stays open, never dropped.

**`CHECK_REVISION`** goes from 3 to 4. 0007's, 0008's and 0009's results regrade from their stored records and parses, which have no marks, so their figures don't move.

## 5. Checking the parser first (OQ 3)

Before any check runs, on the local model, in minutes:

1. **The five labelled protocols** (`evals/cases/labels/`), graded by the inherited runner (`evals/runner.ts`, `runEval`) and matcher (`evals/graders/match.ts`). No npm script runs it today; a script `criteria:eval` wires it, writing to `evals/results/criteria/`. Run once under the old prompt and once under the new, same model, temperature, seed and normalize version. **Shown:** recall, precision and type agreement under both. The mark isn't graded against the labels, which have no lists field; the point is that nothing else moves.
2. **Dev's 12 trials,** reparsed with `npm run benchmark:parse -- --set dev`, and compared criterion by criterion with the committed parses (`data/criteria/trialbench/qwen3.6-35b-a3b-mlx-8bit-e1e694b3-n2/`): same quotes, split, joined or lost; polarity and type changed. A small comparison script prints it, with no model.
3. **Every mark read by hand,** on dev's 12 and the five protocols: a real "any one of these", or a mark on an "and" list that would hide a requirement.
4. **0007's NSCLC picks, counted without a model** (OQ 6): how many of the 40 committed parses in `data/criteria/2026-10/` have items that look like a list (a span ending ", or", or a run of items after a lead-in ending ":"). An estimate of how often lists reach the check on NSCLC, labelled as one.

All four go on the Gate 1 page.

## 6. The runs (OQ 4, OQ 5, OQ 7)

| | Pairs | Trials parsed | Arm | Estimate |
| --- | --- | --- | --- | --- |
| **Parser check** | — | the five labelled protocols twice; dev's 12 | — | under an hour |
| **Dev rerun** | 0008's 14 | dev's 12, new prompt | full summary | about 5 hours, at 0009's 22.4 minutes a check |
| **Held-out, only if Gate 2 says so** | 0008's 56 | 30, new prompt | full summary | about 1 hour parsing, then 21 to 28 hours |

- **Model:** as 0009 ran it: Qwen3.6-35B-A3B-MLX-8bit, temperature 0, seed 20260921, reasoning off, the summary participant unchanged. Results record all of them and both prompt versions.
- **Commands:** `npm run benchmark:parse -- --set dev`, then `npm run benchmark:check -- --dev --arm full`. Held-out: `--set heldout`, then `npm run benchmark:check -- --arm full`, which refuses a second held-out run.
- **The parse run folders.** A new prompt is a new folder, and `data/criteria/trialbench/latest` moves to it. 0008's and 0009's dev results name their own `parseRun`, so their `--check` still regrades.
- **0007's parses and results** (`data/criteria/2026-10/`, `evals/results/check/`) are untouched, and so is the page's `--fake` mode, which checks only those committed parses. The page's live check caches parses by prompt version in `local/parses/`, so a trial checked after this slice is reparsed with the new prompt, with nothing to do (OQ 4).
- **No account arm** (OQ 7). `docs/benchmark.md` says it wasn't rerun.
- **No 0007 rerun** (OQ 6): its held-out is spent, and its dev is 9 pairs. §5's count stands in for it.
- **No hosted run.** One would be a new gate: dry first, no `--spend` without the owner's word.

## 7. Gates

- **Gate 1: freeze the parser prompt and the record, and spend about 5 hours on dev?** The owner sees §5's four results, the prompt's diff, and two dev records rendered with marks from their stored findings (`benchmark:lines -- --record` on the new parses). Wrong here costs a dev run on a parser that marks the wrong lists, or moves the split.
- **Gate 2: spend held-out's one look on this fix?** The owner sees the dev result in both measures beside 0009's, every "or" line from 0009's rerun with what happened to it, every new line, the bar and the estimate. Wrong here costs held-out: there's no other unread set, and the next fix would have nothing to be measured on.

**The bar for Gate 2, frozen at Gate 1** (OQ 5). From 0009, unchanged:
1. no `verdictHits`;
2. every unresolved, chart-review or not-asked criterion on its record;
3. every fidelity flag read and explained, and no finding scored from a flagged turn;
4. every dev pair finished, or listed with why.

And for this fix, read line by line:
5. each of 0009's four counted "or" lines (nci-17 × NCT06161532 P3, P4, P6; nci-41 × NCT02211755 P2) is gone and its list read right, or listed with why;
6. no list marked on "and" items, and no real requirement left without "may not fit" because of a mark.

The pair rate outside parts is reported, never barred: at best 5 of 9 becomes 4 of 9, inside 0009's run-to-run variation. Meeting the bar doesn't mean held-out is worth it. The gate page says so and gives the cost of keeping held-out for a larger fix. "Revise on dev" may change the parser prompt again: each revision is a reparse, a dev run and Gate 2 again.

## 8. Docs and the rest

- **`docs/check.md`:** how a list is read, the lead-in, the counts line, dev's numbers (and held-out's, if run), and what's still wrong: conditions the parser drops or joins, the restatement, "solid tumors" in the trial's words, no judgment of purpose. Its Limits say 0007's committed parses and results predate the mark.
- **`docs/benchmark.md`:** the dev rerun beside 0008's and 0009's, in both measures; held-out run or still unread.
- **`work/ROADMAP.md`:** a 0010 row and header. Only that is committed; the owner's Future scope section stays unstaged, as they chose.
- **`CLAUDE.md`:** `criteria:eval` and the comparison script in the command table; the `anyOf` field where the parser is described, if anywhere; no boundary sentence changes.
- **README:** no change, unless a sentence there describes the check's false alarms.

## 9. Boundaries

- **`ScreeningCriterion` keeps four fields** (`tests/boundary.test.ts`). Nothing under `src/screening/` changes.
- **`src/check/record.ts`** stays away from every model module and the parser: it reads the mark through `RecordInput.lists`, a map of strings, not through `Criterion`.
- **`criteria:eval`** gets its adapter from `createLocalAdapter`, like the other parse scripts, and is dry with `--model <spec>` unless given `--spend`. No concrete adapter in `scripts/`.
- **No new network host, no new dependency.** `tests/boundary.test.ts` gains, at most, the new script in the lists it already keeps.

## 10. Tests

Deterministic only, in `tests/`:
- **Validation:** a label on one item dropped; mixed polarity or `appliesTo` dropped; an exclusion list dropped; each with its reason recorded. A parse without `anyOf` loads as before.
- **`record.ts`:** a list with one item met has no "may not fit"; with every item conflicting, every item flagged and counted once; with one conflicting and one open, no flag, the open item under records and to ask; a conflicting item in a list that doesn't conflict shows no flag; a record with no lists is unchanged. No verdict words in the lead-in.
- **The parser prompt:** `PROMPT_VERSION` changed, and its examples share no five-word run with the twelve pinned protocols or the benchmark trials, beyond any runs it already shared, listed by name.
- **The comparison script:** on two small parses, it reports a split, a join, a lost quote and a new mark.
- Nothing asserts what the model parses or reads. That's the eval's job.

## 11. Out of scope

- Conditions the parser drops or joins, the restatement's errors, and "solid tumors" in the trial's own words.
- Exclusion lists, which already read right split.
- Any change to the agent, its prompts or `ScreeningCriterion`.
- The account arm; 0007's pairs; any change to the summary participant.
- Reparsing 0007's committed parses or the page's `--fake` parses.
- More cancer types.

## Concerns for the owner

1. **A parser prompt change, which nothing here fully re-measures.** The parser was measured in the prescreening repository on 12 protocols; here it can be graded on five, and compared old against new on dev's 12. A change that moves the split somewhere else could hurt the check on trials no one looks at. **Deciding:** whether §5's checks are enough before Gate 1, or the five protocols should be joined by the other seven, which would need labels written.
2. **"One line" becomes "one list".** Intent outcome 3 says the record shows a list as one line. This spec keeps a line per item with a shared lead-in, and counts the list once, because one line per criterion is what the measure, the page's keys and the "every criterion in one section" rule rely on. **Deciding:** accept the change, committed as `0010 intent: revised`, or ask for one merged line, which means a new kind of record line.
3. **A new script, `criteria:eval`.** It wires a runner that came over from the prescreening repository but has no command here. It runs the local model, so it's a model run, if a short one. **Deciding:** add it, or check the parser on dev's 12 alone and skip the labelled protocols.
4. **Exclusion lists are left as they are.** They read right split, so a mark on them is dropped. A trial that words an inclusion as an exclusion ("excluded unless one of…") won't be helped. **Deciding:** inclusions only, as proposed, or a rule for that wording too.
5. **The likely result is small.** At best one dev pair in nine moves outside parts, and Gate 2 may well end in "keep held-out". **Deciding:** whether the slice is still worth about 6 hours of local time and a parser change for a record that reads basket trials right, even if the rate doesn't move.
