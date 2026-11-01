# intent: 0009 check false alarms

**Author:** the repository owner
**Status:** Draft
**Date:** 2026-11
**Scope:** One small slice. Fix the deeper check's cheapest false-alarm causes, then measure the fix once on the held-out pairs slice 0008 left unread, from the full summary only. No schema change, no new measure replacing 0008's, no other part touched.

---

## In plain words

When a person picks a trial from their list, the deeper check goes through that trial's own rules with them. It ends with a record for them and their oncologist. "May not fit" on that record should mean something.

Slice 0008 checked it against NIH clinicians' labels. Clinicians called 9 of the dev pairs eligible, and the check said "may not fit" on 8 of them. A warning that shows up on nearly every trial tells a person nothing.

Reading every line showed why. The check gets some kinds of rule backwards:
- **"I'm not pregnant" or "I'm a 75-year-old man"** against a pregnancy or contraception rule became "may not fit". The reply satisfies the rule.
- **Conditional rules** ("if currently on therapy…", "patients with brain metastases must have completed treatment") were read as requirements. A person without brain metastases then "may not fit".
- **Rules for one part of a trial,** such as a healthy-volunteer arm, flag a person who was never going to be in that part. The record already says "one part of the trial", but the measure counts it the same as any other line.

This slice fixes those, as narrowly as it can, and measures the result once.

This is polish on part 4 of the product, the optional check on two or three picked trials. The product intent's "done" list is already met. The slice is worth doing only because "flags almost everything" is the one finding in `docs/` that makes a part look broken, and 0008 kept a held-out set unread to measure exactly this fix. If the fixes turn out to need a schema change or a rebuilt parser, the slice stops and says so instead of growing.

## Problem

**The check flags almost every pair** (`work/0008-benchmark/gate-2-dev.md`, "In short"):
- false alarms on 8 of 9 eligible dev pairs from the full summary, and 4 of 9 from the account;
- with lines on one part of a trial left out, 5 of 9 from the full summary;
- the one ineligible pair still caught on that reading (nci-37) "rests on a misreading: 'I am 65, so I am not of childbearing potential', read as 'may not fit' against the contraception rule."

**Four causes, all in the parser, the agent or how parts are counted** (`gate-2-dev.md`, "What the 'may not fit' lines are"; `docs/benchmark.md`):
1. "or" lists parsed as separate requirements (nci-41 × NCT02211755, nci-17 × NCT06161532, nci-13 × NCT02465060);
2. cohorts the person isn't in (NCT03331380 in all four of its pairs, nci-25 × NCT00003838, nci-12 × NCT00102544);
3. pregnancy, nursing and contraception rules read the wrong way round (nci-06, nci-12, nci-13, nci-37);
4. conditional rules read as requirements (nci-13, P8 and P20).

**0007 saw the same patterns on its own labels** (`docs/check.md`, False alarms): lists of cancers parsed one per type, a permission parsed as a requirement, rules for one part, and "No, I'm a guy" to a contraception rule. It put 27 of 34 held-out pairs as false alarms.

**Carried in:**
- **Gate 2 of 0008, Answer:** "Stop, keep held-out … its one look is still unspent" (`gate-2-dev.md`). Its options section: "I'd name the four causes as the next work for the check … Held-out stays unread until after them."
- **The rule that blocked a fix in 0008:** "revise on dev" could change only the participant or the runner, "never the agent's prompts" (`work/0008-benchmark/plan.md`, Gate 2). This slice is where the agent and parser may change.
- **The owner's choice for this slice (2026-11):** a small fix, the cheap causes only, held-out from the full summary only, kept small. The leaner alternative, stopping with a closing write-up, was weighed and not chosen.
- **Held-out as 0008 left it** (`gate-2-dev.md`, Time, and held-out): 56 pairs (30 ineligible: 17 `rule`, 8 `disease`, 5 `none`; 21 recommended; 5 eligible but not recommended), over 30 trials not yet parsed. The full-summary arm was estimated at about 28 hours of local time, plus about an hour to parse.
- **0008's frozen measure** (`evals/benchmark/check-metrics.ts`): a pair is flagged by any "may not fit" line, parts included. Its dev result is `evals/results/benchmark/check/dev/01-5ed77c679dad.json`.
- **A reading 0008 proposed for held-out:** count named rules that land under "Needs your records or your oncologist" or "To ask your oncologist", beside `rule-caught` (`gate-2-dev.md`, Caught, and the named rule).
- **Known and left open,** as 0008 recorded them: `other:eval -- --check` fails only on "labelsSha256 differs", and a failed **Check these** on the page says nothing. This slice touches neither.

**Where the causes sit isn't settled.** The agent's reading prompt already says that "a man who says he isn't pregnant gives 'does-not-hold'" (`src/screening/prompts.ts`), so cause 3 may be in how a reading becomes "may not fit" rather than in the prompt. Cause 4 may come from the agent's restated "statement" as much as from the parse. Finding out comes first, from 0008's committed dev transcripts, with no model (OQ 1).

## Proposed outcome

At the end of this slice:

1. **Each cause located,** from 0008's dev transcripts and parses, with no model run: for each false-alarm line, whether it comes from the parse, the agent's statement, its reading, or the code that turns a reading into "may not fit". Written down before anything changes.
2. **The fixes, as small as they can be:**
   - **pregnancy and contraception rules:** a reply that satisfies the rule, or places the person outside it, no longer gives "may not fit";
   - **conditional rules:** a rule that applies only if something is true doesn't flag a person for whom it isn't;
   - **one part of a trial:** "may not fit one part" lines are shown apart from the others on the record, and counted apart in the measure (OQ 3).

   Each fix is a prompt change, a code change in the screening agent or the record, or both. No change to `Criterion` or `ScreeningCriterion` (OQ 2).
3. **Dev rerun, from the full summary,** on 0008's 14 dev pairs, on the local model. It shows whether the fixed lines are gone and nothing new broke, before held-out is spent.
4. **Held-out, once, from the full summary:** 30 trials parsed, 56 pairs checked. Reported two ways:
   - **0008's frozen measure, unchanged,** so the number compares with dev's 8 of 9;
   - **the same measure without lines on one part of a trial,** frozen before held-out runs, with the named-rule reading beside it.
5. **Written up:** `docs/check.md` and `docs/benchmark.md` updated with held-out's numbers and what's still wrong; the roadmap row; `CLAUDE.md` if a command changes.

## Affected users and systems

- **People using the check on the page:** fewer "may not fit" lines on rules that don't apply to them, and lines for parts of a trial they aren't in set apart on the record. No verdict wording, no unknown dropped, nothing removed from a list.
- **The screening agent** (`src/screening/`): its reading prompt and possibly the code that applies a reading. A prompt change starts a new prompt version.
- **The parser** (`src/criteria/`): only if OQ 1 puts cause 4, or cause 1, there. A parser prompt change starts a new parse run, and the page's cached parses in `local/parses/` are made under the old prompt (OQ 5).
- **The record** (`src/check/record.ts`) and the page's rendering of it, for lines on one part of a trial.
- **The eval harness:** `evals/benchmark/check-metrics.ts` gains the second measure beside the frozen one. `benchmark:check` runs held-out with `--arm full`.
- **Data and results:** held-out's parses under `data/criteria/trialbench/`, results under `evals/results/benchmark/check/`.
- **Not touched:** the search, the facts and their mappings, the conversation, the short list's order, the reader, the summary participant and its accounts, the 0007 measure and its results.

## Constraints

- **No verdict, unknowns never exclude, nothing removed.** The fixes only change when "may not fit" is said. They never add "fits" or "eligible" wording, and a rule that's unclear stays on the record as unclear.
- **Narrow, or stop.** No new field on `Criterion` or `ScreeningCriterion`; that type is pinned to four fields by `tests/boundary.test.ts`. If a cause can't be fixed without a schema change, it's named as the next work and left.
- **Held-out once.** The fixes, the prompts and the second measure are frozen before held-out runs. Nothing is changed after it and reported as held-out.
- **Every model run is a gate.** The dev rerun and the held-out run each spend hours of local time. No hosted run is proposed; one would be dry first, without `--spend`, and only on the owner's word.
- **0008's dev result stays as it is.** The rerun is a new result; the old one keeps regrading from its transcripts.
- **Results record model, quantization, temperature and seed.** Months, not days. No PHI: the benchmark's vignettes are synthetic.

## Open questions

1. **Where does each cause actually sit?**
   - The reading prompt already covers men and pregnancy, so cause 3 may be in `apply.ts` or the record, not the prompt. Cause 4 may be the parse keeping a condition as a requirement, or the agent's statement dropping the "if".
   - **Leaning:** a first step reads 0008's dev transcripts and parses for every false-alarm line in causes 3 and 4, and writes where each one comes from. No model, no change. The fixes are chosen from that, not before.
2. **Is cause 1, "or" lists, in or out?**
   - It's the largest cause on recommended pairs (nci-41's only line, nci-17's basket list). The owner's choice named the cheap causes. The parser's prompt history (`src/criteria/prompt.ts`) shows that changing how it treats "or" has gone wrong before: one wording made it bundle every "or" list.
   - **Leaning:** in only if OQ 1 shows it can be fixed in the agent or the record without reparsing differently, for example by reading a list's siblings together. Otherwise out, named as the next work.
3. **What happens to lines on one part of a trial?**
   - The record already says "May not fit one part of the trial". Clinicians call a pair eligible if any part fits, so the frozen measure counts these as false alarms, and as catches on trials for another purpose.
   - **Leaning:** on the record, a separate group under "To ask your oncologist", worded as a question about which part the person would be in. In the measure, the second figure leaves them out. The frozen figure stays.
4. **How much dev before held-out?**
   - 0008's dev took 11.4 hours in both arms, 29.6 minutes a check from the full summary. A full-summary rerun of 14 pairs is about 7 hours.
   - **Leaning:** rerun all 14 from the full summary, after the fixes, as the slice's first gate. It's the only check that the fixes work on a model before held-out's one look.
5. **Do the parses need redoing?**
   - If no parser prompt changes, dev's 12 committed parses stand and only held-out's 30 trials are parsed. If one changes, dev is reparsed too, about 20 minutes. The page's cached parses and 0007's committed NSCLC parses stay under the old prompt.
   - **Leaning:** avoid a parser change if OQ 1 allows. If one is needed, reparse dev and held-out under it, and leave 0007's parses and results as they are.
6. **Is the account arm run?**
   - 0008 found the account arm's fewer false alarms "half an artefact" of flagged replies. It would add about 14 hours.
   - **Leaning:** no, from the full summary only, as the owner chose. `docs/benchmark.md` says the account arm wasn't rerun.
7. **What does the slice do about trials for another purpose?**
   - Eight held-out ineligible pairs are `disease`: an MRI study, a neuromuscular study. The check reads rules, not purpose, and on the page the search's treatment filter keeps most such trials off the list.
   - **Leaning:** nothing. Held-out's numbers are reported by reason (`rule`, `disease`, `none`), as 0008's measure already splits them, and the write-up says the check doesn't judge purpose.
