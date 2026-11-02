# Gate 1: freeze the fix, and spend about 7 hours on dev?

Slice 0009, step 6. Stage A is done, with no model run. This page shows what would be frozen before dev runs, and asks for the go-ahead to spend local time. 2026-11.

- **Beside this page:**
  - [`diagnosis.md`](diagnosis.md): every "may not fit" line on 0008's dev, by cause and locus;
  - [`gate-1-records.txt`](gate-1-records.txt): two dev records re-assembled with the new record.
- **What would run:** `npm run benchmark:check -- --dev --arm full`. 0008's 14 dev pairs, from the full summary, on Qwen3.6-35B-A3B-MLX-8bit at temperature 0, seed 20260921, reasoning off. The summary participant is unchanged. The agent's prompt version is now `f8b60faffee1` (was `8fda2872b52a`) and `CHECK_REVISION` is 3, so the run starts a new folder.

## In short

- **Every line in causes 3 and 4 comes from the parse, the agent's statement or its reading. None comes from the code.** The prompt can reach 8 of the 11 lines and may reach 2 more. One it can't: nci-13's P2, whose condition the parse dropped.
- **At best, from the full summary, false alarms go from 8 of 9 to 4 of 9.** The four left are:
  - two "or" lists, which are out of this slice;
  - a 28-day washout question a clinician might also ask;
  - a "solid tumors" rule in the trial's own words.
- **The parts measure is ready, and on 0008's dev it gives 5 of 9 false alarms from the full summary,** and 2 of 9 from the account. 1 of 5 ineligible pairs is caught in each arm. This is the "before" figure.
- **Caught will likely fall, and that's expected.** Four of dev's five ineligible pairs are trials for another purpose. They're flagged today only on parts the person isn't in. The one catch outside parts, nci-37, rests on the contraception misreading the prompt is meant to fix. The check reads rules, not purpose.
- **Recommendation: go.** Run dev from the full summary, about 7 hours.

## 1. The diagnosis

From [`diagnosis.md`](diagnosis.md): 120 "may not fit" lines over 28 pair-arms, 89 counted.

| Cause | Lines | Counted | On eligible pairs, counted | Locus |
| --- | --- | --- | --- | --- |
| 1. "or" list, outside a part | 9 | 8 | 8 | parse |
| 2. part of the trial | 95 | 69 | 25 | measure |
| 3. pregnancy, nursing, contraception | 8 | 6 | 4 | parse 3, statement 3, reading 1, parse and statement 1 |
| 4. conditional or permission | 3 | 3 | 3 | statement |
| 5. records, a fair question | 1 | 1 | 1 | — |
| 6. other | 4 | 2 | 2 | reading 1, parse 1, the trial's words 2 |

**What you're checking:** whether each cause-3 and cause-4 line is placed right. The table in `diagnosis.md` has the parse's words, the agent's statement and the reply for each one. Most telling:
- **nci-13, P8:** the parse kept "If the participant is currently receiving therapy…". The agent's statement was "The clinician has assessed that the current therapy is no longer benefitting the patient…". "I am not currently receiving any cancer therapy" then read as not meeting it.
- **nci-06 and nci-17, account:** "Nursing participants must discontinue nursing…" was restated as "The participant is currently breastfeeding." Against an inclusion, "No" then became "may not fit".
- **nci-13, P3, account:** against inclusion "The participant is not pregnant or breast feeding", "I'm a 75-year-old man" was read as "does-not-hold". The prompt's one pregnancy example was written for the other polarity.

## 2. The prompt's three additions

`READ_SYSTEM_PROMPT` in `src/screening/prompts.ts`. Every example is invented. A test holds that the additions share no run of five words with NIH-TrialBench's trials or the twelve pinned protocols. The prompt already shared five runs from the prescreening repository's aspirin and gemcitabine examples; they're listed in the test and unchanged.

**1. Exclusions, restated by meaning.** Appended to the EXCLUSION line:

> Do this even when the criterion's text reads as what the person must be: an exclusion given as "The person does not keep bees" becomes "The person keeps bees."

**2. A rule's condition, kept.** A new line after INCLUSION:

> When a criterion applies only to some people, or only if something is true, keep that in the statement as an "if", in front of what it requires. Look for "if", "patients who", "those with", "people of … must" and instructions such as "… should be stopped". "Anyone who wears contact lenses must take them out before each scan" becomes "If the person wears contact lenses, they take them out before each scan." A permission is the same: "Those who have had a tooth removed may take part after two weeks" becomes "If the person has had a tooth removed, it was at least two weeks ago."

**3. "does-not-apply" covers the "if", and pregnancy both ways round.** The does-not-apply line now reads:

> "does-not-apply": the criterion is written about one group of people (for example only men, or only women), and the reply places the person outside that group. **The group may also be set by the "if" a statement starts with: "If the person wears contact lenses, they take them out before each scan", answered "I don't wear contacts", is "does-not-apply". So is a sentence that joins who it is for to what they must do ("The person wears contact lenses and takes them out before each scan"), when the reply places the person outside the first part.** This is about who the criterion is for, never about **what it requires**. "Pregnant" or "breastfeeding" **named as what a criterion is about** applies to everyone: **against "The person is pregnant",** a man who says he isn't pregnant gives "does-not-hold", like anyone who says they aren't taking a medicine; **against "The person is not pregnant", the same reply gives "holds".** A criterion that names several groups ("women who could become pregnant and men must...") applies to anyone in any of them.

Bold is new. One phrase was replaced: "never about its condition" became "never about what it requires", because "condition" now means the "if".

**What "does-not-apply" does downstream is unchanged.**
- **A patient rule** becomes unresolved, under "Needs your records or your oncologist", with "You said this isn't about you."
- **A clinical rule** stays chart-review, with "does-not-apply" reported, which isn't a conflict. A test now pins that.
- **Neither is "may not fit", and neither reads as fitting.**

So the cost of the widening is the spec's concern 2: more rules sit under "Needs your records" rather than "What you told the check".

## 3. The record's new wording

From [`gate-1-records.txt`](gate-1-records.txt), on 0008's conversations:

- **nci-13 × NCT02465060, full:**
  - counts: "3 rules may not fit what you said. 2 more are for one part of the trial, which you may not be in. 28 rules need your records or your oncologist."
  - "To ask your oncologist" ends with Step 2's two rules (P31, P32), each with "Which part of the trial would I be in, and is this rule for it?"
- **nci-25 × NCT00003838, full:** "0 rules may not fit what you said. 16 are for one part of the trial, which you may not be in. 29 rules need your records or your oncologist." Group A's sixteen diseases are at the end of "To ask your oncologist", each with the part question.

**Before**, the same nci-25 record began "16 rules may not fit what you said." The rules and their sections are unchanged; only the count's wording and the order of the questions move. "More" is dropped when nothing else may not fit (a divergence from the plan's wording, recorded in its Records).

## 4. The measures, frozen here

- **0008's frozen measure, unchanged** (`scoreBenchmarkPair`, `summarizeArm`). 0008's dev result still regrades row for row.
- **The parts measure** (`evals/benchmark/check-parts.ts`), written into every new result as `parts`:
  - **flagged outside parts:** a counted "may not fit" line on a rule with no part;
  - **named rule on the record:** for a `rule` pair, the rule's quote overlaps, by the link's threshold, a line that is "may not fit", under "Needs your records", or on "To ask your oncologist".

**0008's dev, before:**

| | full, frozen | full, outside parts | account, frozen | account, outside parts |
| --- | --- | --- | --- | --- |
| ineligible caught | 4 of 5 | 1 of 5 | 5 of 5 | 1 of 5 |
| false alarms | 8 of 9 | 5 of 9 | 4 of 9 | 2 of 9 |
| …recommended | 6 of 6 | 5 of 6 | 3 of 6 | 2 of 6 |
| …eligible but not recommended | 2 of 3 | 0 of 3 | 1 of 3 | 0 of 3 |
| named rule on the record | — | 1 of 1 | — | 1 of 1 |

The rerun is from the full summary only. The account columns are there for the write-up.

## 5. The bar for Gate 2, frozen here

Dev, from the full summary, must show:
1. no `verdictHits` in any agent turn or record;
2. every unresolved, chart-review or not-asked criterion on its record;
3. every fidelity flag read and explained in the gate page, and no finding scored from a flagged turn;
4. every dev pair finished, or listed with why.

Caught and false alarms are shown in both measures, not barred: 14 pairs can't measure a rate. The gate page also lists:
- each `diagnosis.md` line in causes 3 and 4, marked gone, still there, or not asked this time;
- every rule read "does-not-apply", so an overreach shows.

## 6. The run

- **14 checks from the full summary,** at 0008's 29.6 minutes a finished check: about 7 hours.
- NCT03331380 is in 4 of the pairs and took up to 79 minutes a check in 0008.
- It's resumable, and a pair refused by the local server's memory guard is rerun.

## Options

1. **Go** (recommended): freeze all of the above and run dev.
2. **Revise:** change the prompt, the record's wording or the measure, then Gate 1 again. Nothing is spent.
3. **Stop:** ship stage A with a short write-up and no model run. Held-out stays unread.

## Answer

**Go** (2026-11). The diagnosis, the prompt's three additions, the record's wording, both measures and the bar are frozen as above. Dev runs from the full summary.
