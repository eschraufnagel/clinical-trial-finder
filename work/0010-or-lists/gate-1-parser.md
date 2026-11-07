# Gate 1: freeze the parser prompt, and spend about 5 hours on dev?

Slice 0010, step 7. The new parser prompt (`08edc407302c`, was `e1e694b399d4`) was tried on the five hand-labelled protocols and on NIH-TrialBench dev's 12 trials, on Qwen3.6-35B-A3B-MLX-8bit at the parser's defaults (temperature 0, seed 20260921, reasoning at the runtime's default). No check has run. 2026-11.

- **Beside this page:** [`gate-1-compare.md`](gate-1-compare.md) has `criteria:compare`'s full output for both sets: every rule split, joined or lost, every changed field, every list and every dropped mark.
- **The runs:**
  - [`evals/results/criteria/01-e1e694b399d4.json`](../../evals/results/criteria/01-e1e694b399d4.json) and [`02-08edc407302c.json`](../../evals/results/criteria/02-08edc407302c.json);
  - dev's new parses in `data/criteria/trialbench/qwen3.6-35b-a3b-mlx-8bit-08edc407-n2/`, beside the old ones in `…-e1e694b3-n2/`.

## In short

- **The marks land where they were meant to.**
  - NCT02211755's "solid tumors …, or" and "myelodysplastic syndrome" are one list.
  - NCT06161532's five histologies are one list.

  Re-rendered from 0009's stored findings, both lists lose their "may not fit" lines (§4).
- **But the prompt moved the split, and not only where lists are.** On dev, 86 old rules have no match in the new parses and 153 new rules have none in the old. Most of that is harmless, but one change makes a new false alarm:
  - **NCT04708470 went from 28 rules to 71.** Two exclusions with exceptions ("active autoimmune disease … with exception of: diabetes type I, eczema, vitiligo…"; "second malignancy within 3 years … except for …") were split into their exceptions, **each parsed as an inclusion** ("The participant has eczema") and marked as a list. A person with none of the exceptions, nearly everyone, would "may not fit" that list. Under the old prompt each exclusion stayed one rule, exceptions inside.
- **Against the labels, the parser got better.** Strict recall on the five protocols went from 77.8% to 84.9%, and merged rules from 40 to 23. The new prompt splits more, and the labels were written split finer than the old parser split.
- **One dev trial won't parse.** NCT02465060 failed twice, the same way: the model writes its whole answer into the reasoning channel and returns no content. It parsed under the old prompt. Its pair, nci-13 × NCT02465060, is one of the five eligible pairs still flagged outside parts.
- **Recommendation: revise, then try again.** Two lines in the prompt (below), then step 7 again: about an hour. Spending 5 hours of dev on this parse would measure a parser that adds a false alarm on a recommended pair (nci-12 × NCT04708470), and one pair would be missing.

## 1. The five labelled protocols

| | Labels | Predictions, old → new | Strict recall | Coverage recall | Precision | Merged |
| --- | --- | --- | --- | --- | --- | --- |
| NCT00077350 | 37 | 22 → 40 | 59% → 95% | 100% → 100% | 100% → 88% | 15 → 2 |
| NCT03433469 | 73 | 72 → 72 | 96% → 96% | 100% → 100% | 97% → 97% | 3 → 3 |
| NCT04316364 | 24 | 21 → 21 | 88% → 88% | 100% → 100% | 100% → 100% | 3 → 3 |
| NCT04385368 | 74 | 62 → 64 | 74% → 77% | 78% → 80% | 89% → 89% | 3 → 2 |
| NCT06728852 | 44 | 29 → 32 | 64% → 70% | 100% → 100% | 97% → 97% | 16 → 13 |
| **Pooled** | 252 | 206 → 229 | 77.8% → 84.9% | 93.7% → 94.0% | 95.1% → 93.4% | 40 → 23 |

Type accuracy went from 91.3% to 93.0%, polarity accuracy from 98.5% to 99.5%. Times: 481 s and 537 s.

**Marks on the five:**
- NCT00077350's "creatinine ≤ 1.5, or clearance ≥ 60", split into two rules from one sentence and marked: **right**.
- NCT03433469's acceptable contraception methods: **right**.
- NCT03433469's *unacceptable* methods, parsed as inclusions ("… are an unacceptable contraception method") and marked: **harmless**. Rules like that aren't something a person meets either way, but they're not a list a person meets by any one item.
- Two marks were dropped by the code: an exclusion list, and a list of one.

## 2. Dev's 12 trials, old against new

| | Count |
| --- | --- |
| trials compared | 11 (NCT02465060 failed) |
| matched rules | 378 |
| old only / new only | 86 / 153 |
| polarity changed | 3 |
| type changed | 10 |
| part changed | 37 |
| lists kept | 16 |
| marks dropped | 7 |

**Where the split moved:**
- **NCT01827384 matches nothing, but nothing changed in what it says.** The new parse quotes each item without its "TUMOR BIOPSY SEQUENCING:" heading, so every span, and every id, starts later.
- **NCT04708470, 28 → 71:** the exceptions above, and "Cohort 2 includes: cervical, P16+ oropharyngeal, anal …", one alternation in the old parse, now eight marked items. The second is harmless with the mark; the first isn't.
- **NCT00003838, 17 old only / 22 new only:** group A's and group B's disease lists, split into marked items.
- **NCT03502733, 13 / 18; NCT02211755, 2 / 4:** finer splits of long rules, as on the labelled protocols.

**Every list kept on dev, read by hand:**

| Trial | List | Items | Read |
| --- | --- | --- | --- |
| NCT02211755 | tumor type | 2 | **right**: the target |
| NCT06161532 | histology | 5 | **right**: the target |
| NCT01900132 | neuromuscular condition | 4 | right: "motor neuron disease or … myopathy or …" |
| NCT03331380 | heart, brain, musculoskeletal, abdominal, lung disease | 9, 10, 13, 9, 9 | right: an MRI study's indications |
| NCT00003838 | diseases to be included | 16 | right |
| NCT00003838 | group A history, group B history | 4, 3 | right: "a history of one of the following" |
| NCT04708470 | Cohort 2 | 8 | right, but the old parse had it as one rule |
| NCT04708470 | autoimmune exception | 7 | **wrong**: exceptions to an exclusion, parsed as inclusions |
| NCT04708470 | second malignancy exception | 5 | **wrong**: the same |
| NCT00924027 | site-specific inclusion criteria | 15 | **mixed**: cohort headings ("Endometrial cancer") and the rules under each, all marked as one list |
| NCT01827384 | contraception | 9 | **mixed**: seven methods, right; two rules that aren't methods ("In case of use of oral contraception …", "Sexually active males must use a condom") marked with them |

**Dropped marks (7):** three lists of one in NCT03493945, one in NCT00102544, and three exclusion lists (NCT00924027 twice, NCT03331380).

**The wrong and mixed marks, and what they'd do on the record:**
- **NCT04708470's exceptions:** a new false alarm on a recommended pair. Without the mark, seven separate "may not fit" lines; with it, one.
- **NCT00924027 and NCT01827384:** a list item that's really a requirement would lose its "may not fit" if any other item is met. NCT00924027's pairs are ineligible (nci-37); NCT01827384's is eligible (nci-06), and its two misplaced items are conditional rules a 0009 reading already handles.

## 3. The two target records, re-rendered

`npm run benchmark:lines -- evals/results/benchmark/check/dev/02-17a5dbee2eb0.json --pair <pair> --record --parses data/criteria/trialbench/qwen3.6-35b-a3b-mlx-8bit-08edc407-n2`: 0009's stored findings, read with the new parse's marks. Ids are ordinals, so they carry over only as far as the new parse keeps the old order. On both trials, P1 to P9 carry over and P10 onwards don't (`parseDrift` lists them). So only the list lines below mean anything.

- **nci-41 × NCT02211755:** P1 "solid tumors …, or" and P2 "myelodysplastic syndrome …", both under "Needs your records or your oncologist", each with "One of a list: the trial asks for any one of these." **P2's "may not fit" is gone.**
- **nci-17 × NCT06161532:** P2 to P6, the five histologies, each with the lead-in. The person said "large cell neuroendocrine tumor of the bladder" (P2's item). **P3, P4 and P6's "may not fit" lines are gone.**

The counts on these renderings aren't meaningful, because of the drift past P9. The dev rerun is the measure.

## 4. NCT02465060

Twice, `benchmark:parse` got a response with `reasoning_content` holding the whole JSON answer and no `content`, after about 340 s. At temperature 0 a third try would do the same. It's recorded in the run's `failures.json`.

Options, if the next attempt fails the same way:
- parse that trial with reasoning off: a different parse identity from the other eleven, in its own folder;
- leave it out, and run 13 dev pairs.

Neither is chosen here.

## 5. The proposed revision

Two lines, in `SYSTEM_PROMPT`'s "Splitting":

1. **"An exception to an exclusion ('except for …', 'with the exception of …') stays inside that exclusion, as one criterion. Never make its exceptions into criteria of their own."** This answers NCT04708470.
2. **"A list is only items the participant meets by any one of. A heading that names a group of items is not an item, and a rule that adds a condition to the items isn't one either."** This answers NCT00924027 and NCT01827384.

The existing alternation rule stays word for word. The split moving elsewhere (headings no longer quoted, finer splits) isn't reverted. It's what the labels prefer, and the dev rerun will measure on whatever split the frozen prompt gives.

**Then:** step 6's prompt edit and its test, step 7 again (about an hour), and this page rewritten.

## The Gate 2 bar, for freezing

Unchanged from the plan:
1. no `verdictHits`;
2. `unknownsMissing` 0;
3. every flag read and explained, and no finding scored from a flagged turn;
4. every dev pair finished, or listed with why;
5. each of 0009's four counted "or" lines gone and its list read right, or listed with why;
6. no list marked on "and" items, and no real requirement without "may not fit" because of a mark.

The pair rate is reported, never barred.

## Estimate for dev

14 checks from the full summary at 0009's 22.4 minutes each: about 5.2 hours. NCT04708470 grows from 28 rules to 71 under this prompt, so its pair would take longer; nci-12 × NCT04708470 took 0009's average.

## Options

1. **Revise** (recommended): the two lines above, then step 7 again and this page again. About an hour.
2. **Go:** freeze this prompt and run dev. The NCT04708470 false alarm and the missing NCT02465060 pair are measured as they are.
3. **Stop:** revert the prompt in its own commit. The field, the validation, the record's list reading and the scripts ship; with no marks they change nothing. Stage D writes it up.

## Answer

(The owner's.)
