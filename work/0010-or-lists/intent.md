# intent: 0010 "or" lists

**Author:** the repository owner
**Status:** Draft
**Date:** 2026-11
**Scope:** One small slice. The parser stops turning one "or" list into separate requirements, and the deeper check reads a list's alternatives together. Dev is rerun from the full summary. Held-out is spent only if a gate after dev says so. The other causes of false alarms stay out.

---

## In plain words

When a person picks a trial from their list, the deeper check goes through that trial's own rules with them. It ends with a record for them and their oncologist, and "may not fit" on that record should mean something.

Some trials are open to several cancers: "solid tumors, or myelodysplastic syndrome", or "small cell, squamous cell, or adenocarcinoma of the bladder". The parser that reads a trial's rules splits a list like that into one rule per cancer, each one a requirement. A person with one of the cancers then answers "no" to all the others, and each "no" becomes "may not fit". Someone with adenocarcinoma of the bladder is told they may not fit because they don't have squamous cell carcinoma.

Slice 0009 fixed the pregnancy and conditional lines, and the false-alarm rate didn't move. "Or" lists are the largest cause left that sits in one place, the parser. This slice fixes that one cause and measures it on dev. Held-out, the one unread set, is spent only if dev shows the rate moving.

This is still polish on part 4 of the product, the optional check on two or three picked trials. The product intent's "done" list is already met. The slice is worth doing because a basket trial is the kind of trial the product most wants a person to find (`work/0000-product/intent.md`, Problem), and the check currently flags the people it's open to.

**What would make it not worth doing.** On dev, the best this fix can do is small. Of the five eligible pairs still flagged outside parts, two have "or" lines. One of them (nci-17 × NCT06161532) also has another line, so at best 5 of 9 becomes 4 of 9. One pair in nine is inside the run-to-run variation 0009 saw. If the fix needs more than a parser change, a parse field and the code that reads it, the slice stops and says so rather than growing.

## Problem

**"Or" lists are the largest cause left** (`work/0009-check-false-alarms/diagnosis.md`, cause 1; `gate-2-dev.md`, §3):
- 9 lines on 0008's dev, both arms, 8 counted, all on eligible pairs. After 0009's rerun, four counted full-summary lines are still there: nci-17 × NCT06161532's P3, P4 and P6, and nci-41 × NCT02211755's P2.
- Every one has locus `parse`: "one histology of a basket list", and "'solid tumors … or' / 'myelodysplastic syndrome' as two rules".
- The committed parses show the shape. NCT02211755's P1 and P2 are two inclusions, "has histologically confirmed solid tumors…" and "has histologically confirmed myelodysplastic syndrome…". NCT06161532's P2 to P6 are five inclusions, one per histology, each a requirement.

**0007 saw the same on NSCLC:** "lists of cancers parsed one per type" is the first of its false-alarm patterns (`docs/check.md`, False alarms).

**Carried in:**
- **Gate 2 of 0009, Answer:** "Stop … Held-out stays unread, and stage C doesn't run" (`work/0009-check-false-alarms/gate-2-dev.md`). Its recommendation: "the next fix (the 'or' lists) would have nothing unread to be measured on" if held-out were spent then.
- **0009 left this cause out on purpose:** its intent's OQ 2 put "or" lists in "only if OQ 1 shows it can be fixed in the agent or the record without reparsing differently … Otherwise out, named as the next work". The diagnosis put them all in the parse.
- **The owner's choices for this slice (2026-11):**
  - "or" lists only; conditions the parser drops or joins, the restatement's errors and "solid tumors" in the trial's own words stay out;
  - `Criterion` may gain a field, for example one marking rules as alternatives of one list. `ScreeningCriterion` stays pinned to four fields;
  - held-out is spent only if a gate after the dev rerun decides so.
- **A warning in the parser's own history** (`src/criteria/prompt.ts`, header): in the prescreening repository, "a first replacement joining two different findings with 'or' made the model bundle every 'or' list (0011's dev v1)". An "or" that is one test with several answers, and an "or" between separate rules, have to come out differently.
- **0008's frozen measure and 0009's parts measure** (`evals/benchmark/check-metrics.ts`, `check-parts.ts`). Dev's latest figures: 7 of 9 frozen, 5 of 9 outside parts (`evals/results/benchmark/check/dev/02-17a5dbee2eb0.json`).
- **Held-out as 0008 left it:** 56 pairs over 30 trials not yet parsed, about 21 to 28 hours of checks and about an hour of parsing (`gate-2-dev.md`, §7).
- **Known and left open:** `other:eval -- --check` fails only on "labelsSha256 differs"; a failed **Check these** on the page says nothing; the page's browser check of 0009's part lines wasn't done by hand. This slice touches none of them.

## Proposed outcome

At the end of this slice:

1. **The parser keeps a list together.** A rule met by any one of several alternatives is no longer parsed as several requirements. Either it stays one rule, or its alternatives carry a mark saying they belong to one list (OQ 1). An "or" inside a single test ("exon 19 deletion or L858R") and separate rules stay as they are.
2. **The check reads a list as one rule.** "May not fit" is said on a list only when the person's answers rule out every alternative. An alternative the person has settles it. An alternative they don't know stays unknown, as now.
3. **The record shows it as one line,** in the trial's words, not one line per alternative.
4. **The parser checked against what it already did right,** with no model where possible: the hand-labelled protocols in `evals/cases/labels/`, and a count of how the new parses split against the old (OQ 3).
5. **Dev reparsed and rerun from the full summary,** on 0008's 14 pairs on the local model, reported in both measures beside 0009's rerun, with every "or" line read.
6. **A gate on held-out.** Dev's result decides whether held-out's one look is spent on this fix. If it is: 30 trials parsed, 56 pairs checked from the full summary, reported in both measures, once.
7. **Written up:** `docs/check.md` and `docs/benchmark.md`, the roadmap row, and `CLAUDE.md` if a command or a boundary changes.

## Affected users and systems

- **People using the check on the page:** a trial open to several cancers no longer flags them for the cancers they don't have. No verdict wording, no unknown dropped, nothing removed from a list.
- **The parser** (`src/criteria/`): its prompt, and its types if a field is added. A prompt change starts a new prompt version and a new parse run.
- **The check and the screening agent** (`src/check/`, `src/screening/`): how a list's alternatives are asked, read and turned into "may not fit". `ScreeningCriterion` keeps its four fields, so a list reaches the agent as one criterion or is put together in `src/check/` (OQ 2).
- **The record** (`src/check/record.ts`) and the page's rendering of it.
- **Parses:** dev's 12 trials reparsed under `data/criteria/trialbench/`. The page's cached parses in `local/parses/` and 0007's committed NSCLC parses in `data/criteria/2026-10/` were made under the old prompt (OQ 4).
- **The eval harness:** both measures unchanged. A new dev result, and a held-out one if the gate says so.
- **Not touched:** the search, the facts and their mappings, the conversation, the short list's order, the reader, the summary participant and its accounts, 0007's and 0008's results.

## Constraints

- **No verdict, unknowns never exclude, nothing removed.** Keeping a list together only changes when "may not fit" is said. A list the person can't answer stays on the record as unknown.
- **A list never hides a real requirement.** Two rules joined by "and", or two rules in a row, stay two rules. Bundling them would hide a conflict, which costs more than a false alarm.
- **Narrow, or stop.** A field on `Criterion` is allowed. `ScreeningCriterion` stays at four fields, held by `tests/boundary.test.ts`. If the fix needs more, it's named as the next work and left.
- **Held-out once, and only through the gate.** The parser prompt, the check's code and both measures are frozen before held-out runs. Nothing is changed after it and reported as held-out.
- **Every model run is a gate.** The dev reparse and rerun spend about 5 hours of local time; held-out about a day. No hosted run is proposed; one would be dry first, without `--spend`, and only on the owner's word.
- **Earlier results stay as they are.** 0008's and 0009's dev results keep regrading from their transcripts and their own parses.
- **The parser's examples come from outside the trials it's measured on,** as `src/criteria/prompt.ts` requires. Its overlap check (`eval:compare -- --overlap`) stayed in the prescreening repository, so this slice needs its own (spec).
- **Results record model, quantization, temperature and seed.** Months, not days. No PHI: the benchmark's vignettes are synthetic.

## Open questions

1. **Does a list stay one rule, or become several marked as one list?**
   - One rule needs no new field, but the statement has to carry every alternative, and the agent asks one long question. A mark (a list id on each alternative) keeps each alternative's quote and lets the check read them together, at the cost of a field and code that reads it.
   - The prompt's history says telling the model "keep 'or' lists together" can make it bundle everything.
   - **Leaning:** the mark. It lets the check decide, in code, when a list "may not fit", and a wrong mark is visible in the parse rather than hidden in a long sentence.
2. **Where does a list become one thing for the agent?**
   - `ScreeningCriterion` is pinned to four fields, so the agent can't receive a list id. The check could join a list's alternatives into one criterion before the agent sees it, or ask each and combine the readings after.
   - **Leaning:** ask each alternative as now, and combine in `src/check/` when the record is made: a list is "may not fit" only if every alternative does not hold. It changes no prompt in the agent, and the record still shows each reply.
3. **How is the parser change checked before a model run is spent on the check?**
   - The parser was measured in the prescreening repository, on 12 pinned protocols. This repository has hand labels for 5 of them (`evals/cases/labels/`) and graders (`evals/graders/match.ts`), but no runner.
   - **Leaning:** reparse the 5 labelled protocols and dev's 12 trials (minutes, local), and compare with the labels and with the old parses: rules split, joined or lost. Every new list mark read by hand. This is the first gate, before the dev rerun.
4. **What happens to parses made under the old prompt?**
   - 0007's NSCLC parses back its committed results. The page's cache is keyed by prompt version, so a new version reparses a trial the next time it's checked.
   - **Leaning:** leave 0007's parses and results as they are, and say so in `docs/check.md`. The page picks up the new prompt through its cache, with nothing to do.
5. **What does dev have to show for held-out to be spent?**
   - At best 5 of 9 becomes 4 of 9 outside parts, and 0009 saw lines come and go between runs on the same prompt.
   - **Leaning:** decide at the gate from line-level evidence, not the pair rate alone: every "or" line gone and read right, no new line from a bundled list, and no real requirement closed by a list. The pair rate is reported, not used as the bar. The gate page states plainly that a fix of one pair in nine may not be worth held-out's one look.
6. **Is 0007's NSCLC check rerun?**
   - "Lists of cancers parsed one per type" was 0007's first pattern, on the cancer the product is measured on. Its dev is 9 pairs; its held-out has been run once and refuses a second.
   - **Leaning:** no. Count, with no model, how many of 0007's picked trials get a list mark under the new prompt, and report it. A rerun of 0007's dev can be a later choice.
7. **Is the account arm run?**
   - **Leaning:** no, from the full summary only, as in 0009.
