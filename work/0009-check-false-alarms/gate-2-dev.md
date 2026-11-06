# Gate 2: spend held-out's one look?

Slice 0009, step 8. Dev was rerun from the full summary with the frozen fix. This page shows what changed, and asks whether to spend held-out now. 2026-11.

- **Beside this page:** [`gate-2-flags.txt`](gate-2-flags.txt) has every fidelity flag with its reply, by class.
- **The run:** [`dev/02-17a5dbee2eb0.json`](../../evals/results/benchmark/check/dev/02-17a5dbee2eb0.json). 0008's 14 dev pairs, from the full summary, on Qwen3.6-35B-A3B-MLX-8bit at temperature 0, seed 20260921, reasoning off. Agent prompt `f8b60faffee1`, `CHECK_REVISION` 3. The summary participant is unchanged.
- **"Before"** is 0008's dev result, [`dev/01-5ed77c679dad.json`](../../evals/results/benchmark/check/dev/01-5ed77c679dad.json), full arm. The account arm wasn't rerun.

## In short

- **The bar is met.** No verdict wording, every unknown on its record, every flag read and every finding resting on one set aside, all 14 pairs finished.
- **The fix fixed most of the lines it was aimed at, and the false-alarm rate didn't move.**
  - Of the six full-summary lines in causes 3 and 4, four are gone and read right this time. Two are still there: nci-13's permission (P13) and nci-37's contraception rule (P5).
  - Outside parts, false alarms are **5 of 9 before and 5 of 9 after**, on the same five pairs. Each pair that lost a line still has another one. On two of them it's a line that's new this run.
  - 0008's frozen measure moves from 8 of 9 to 7 of 9: nci-06 has no line left. Counted false-alarm lines fall from 27 to 20.
- **Two new lines on eligible pairs,** both on questions answered "I don't know" in 0008 and answered this time:
  - nci-12's P7, an inclusion whose statement the agent turned upside down;
  - nci-17's P67, where the person's own cancer was read as a "prior malignancy".
- **The widened "does-not-apply" didn't overreach.** It was used 7 times, every time on a rule for a group or a step the person isn't in. No real requirement was closed as "not about you".
- **Recommendation: stop. Ship stages A, B and D with dev reported as a dev finding, and keep held-out unread.**
  - Dev's line-by-line reading already shows what held-out would put a number on: pair-level false alarms don't move.
  - What still causes them is mostly out of this slice: "or" lists, the trial's own wording, and statement errors that come and go between runs.
  - Held-out is the only unread set. Spent now, it measures a fix that doesn't move the rate, and the next fix (the "or" lists) would have nothing unread to be measured on.

## 1. The bar

| | Required | Dev, full summary |
| --- | --- | --- |
| 1 | no `verdictHits` | 0 |
| 2 | every unresolved, chart-review or not-asked criterion on its record | `unknownsMissing` 0 |
| 3 | every flag read and explained; no finding scored from a flagged turn | 118 flags on 109 replies, all in `gate-2-flags.txt` and classed below; 110 findings excluded, none scored |
| 4 | every pair finished, or listed with why | 14 of 14; `failures.json` empty |

The first attempt's first three checks were refused by the local server's memory guard. Their transcripts weren't kept, and the rerun finished all 14.

## 2. Both measures, before and after

| Full summary | Before, frozen | After, frozen | Before, outside parts | After, outside parts |
| --- | --- | --- | --- | --- |
| ineligible caught | 4 of 5 | 5 of 5 | 1 of 5 | 1 of 5 |
| false alarms | 8 of 9 | 7 of 9 | 5 of 9 | 5 of 9 |
| …recommended | 6 of 6 | 6 of 6 | 5 of 6 | 5 of 6 |
| …eligible but not recommended | 2 of 3 | 1 of 3 | 0 of 3 | 0 of 3 |
| named rule on the record | — | — | 1 of 1 | 1 of 1 |
| counted false-alarm lines (part / records / asked) | 27 (16 / 7 / 4) | 20 (12 / 5 / 3) | | |

- **Frozen "caught" rises to 5 of 5** because of nci-12 × NCT00102544, the prostate MRI study. In 0008 the agent read "I do not have a prostate" as "does-not-apply" to the MRI rules, and nothing was flagged. Now the prompt says a requirement isn't a group, so the same reply reads "does-not-hold". All three lines are on a part, so the parts measure doesn't count them.
- **The one catch outside parts is still nci-37,** on the contraception misreading (P5) the prompt was meant to fix.

Per pair:

| Pair | Label | Before: lines (outside parts?) | After: lines (outside parts?) |
| --- | --- | --- | --- |
| nci-01 × NCT01900132 | inel | 6 (no) | 6 (no) |
| nci-01 × NCT03331380 | inel | 5 (no) | 3 (no) |
| nci-06 × NCT01827384 | enr | 1 (no) | **0** |
| nci-12 × NCT00102544 | inel | 0 | 3 (no) |
| nci-12 × NCT03331380 | inel | 1 (no) | 1 (no) |
| nci-12 × NCT04708470 | rec | 3 (yes) | 1 (yes): **a new line** |
| nci-13 × NCT02465060 | rec | 5 (yes) | 1 (yes) |
| nci-17 × NCT03331380 | enr | 3 (no) | 2 (no) |
| nci-17 × NCT03493945 | enr | 0 | 0 |
| nci-17 × NCT06161532 | rec | 4 (yes) | 5 (yes) |
| nci-25 × NCT00003838 | rec | 9 (no) | 9 (no) |
| nci-25 × NCT03502733 | rec | 1 (yes) | 1 (yes) |
| nci-37 × NCT00924027 | inel | 9 (yes) | 12 (yes) |
| nci-41 × NCT02211755 | rec | 1 (yes) | 1 (yes) |

## 3. The diagnosis's lines, one by one

Every line in causes 3 and 4 that [`diagnosis.md`](diagnosis.md) listed for the full summary. The account-arm lines (nci-06 P28, nci-13 P2 and P3, nci-17 × NCT06161532 P47, nci-37 P5) weren't rerun. P3 and P47 were asked from the full summary this time and read right: P3 "holds" for "I am a 75-year-old male", and P47 "holds".

| Pair | Rule | Then | Now | What the agent did |
| --- | --- | --- | --- | --- |
| nci-06 × NCT01827384 | P28, breastfeeding to stop | may not fit | **gone** | Kept it as an instruction: "The person discontinues breastfeeding while on the trial…". Read "holds". |
| nci-12 × NCT04708470 | P28, exclusion "is not pregnant and is not nursing" | may not fit | **gone** | Restated by meaning, "is pregnant or is nursing". "No" read "does-not-hold", which fits. Addition 1 worked. |
| nci-13 × NCT02465060 | P8, "If … currently receiving therapy" | may not fit | **gone** | Kept the "if". Read "unknown", now chart-review. |
| nci-13 × NCT02465060 | P20, "If … brain metastases" | may not fit | **gone** | Kept the "if". Read "unknown", now chart-review. |
| nci-13 × NCT02465060 | P13, "may have received" | may not fit | **still there** | The statement still drops "may": "The participant has received…". "No" then reads "does-not-hold". Addition 2's permission example didn't carry. |
| nci-37 × NCT00924027 | P5, "of childbearing potential … willing to use" | may not fit | **still there** | The statement copies the parse's joined sentence, and "I am 65, so I am not of childbearing potential" reads "does-not-hold". Addition 3 names exactly this case and didn't carry. |

Lines on parts that the diagnosis listed and are gone: nci-13's P31 and P32 now read "does-not-apply" ("I am not currently receiving one", about Step 1 treatment), which is right. nci-17 × NCT03331380's P28 read "unknown". The other causes' lines on eligible pairs:
- nci-12's P5 (a misreading) and P17 (the washout) are now unresolved;
- the "or" lists (nci-17 × NCT06161532 P3, P4, P6; nci-41 P2) and the "solid tumors" rule (nci-25 P1) are still there, as expected.

## 4. Every new counted line

New against 0008's full-summary lines, by `diagnosis.md`'s classes.

| Pair | Label | Rule | Cause | Locus | Note |
| --- | --- | --- | --- | --- | --- |
| nci-12 × NCT04708470 | rec | P7 | 6 other | statement | An inclusion, "is not eligible to receive the above therapies or declines these standard treatment options". The statement inverted it: "is eligible … or accepts". "I am open to discussing standard treatments" then read "does-not-hold". Answered "I don't know" in 0008. Possibly addition 1's restating by meaning spilling onto an inclusion; one case can't say. |
| nci-17 × NCT06161532 | rec | P67 | 6 other | reading | An exclusion for a prior malignancy within 2 years, with exceptions and a permission sentence the statement dropped. "Diagnosed with a large cell neuroendocrine tumor of the bladder in October 2023" (the cancer the trial is for) read "holds". Answered "I don't know" in 0008. |
| nci-12 × NCT00102544 | inel | P7, P8, P9 | 2 part | measure | Prostate MRI rules. "I do not have a prostate" is now "does-not-hold" rather than "does-not-apply". A catch in the frozen measure, on a part. |
| nci-37 × NCT00924027 | inel | P9, P12, P17, P38 | 2 part | measure | Cohort rules. P9 (inoperable endometrial cancer) and P38 weren't on 0008's full record; P12 and P17 were, set aside as flagged. |
| nci-01 × NCT01900132 | inel | P11, P13 | 2 part | measure | Cohort rules set aside as flagged in 0008, counted now. P18 and P20 are gone. |
| nci-25 × NCT00003838 | rec | P11 | 2 part | measure | Group B, relapsed NHL. Several of Group A's lines are set aside as flagged this time, so the count is unchanged. |

No new line outside parts comes from causes 3 or 4.

## 5. Every rule read "does-not-apply"

| Pair | Rule | Polarity, type | Reply | Right? |
| --- | --- | --- | --- | --- |
| nci-13 × NCT02465060 | P31 | inclusion, clinical: no response < 6 months from Step 1 | "I am not currently receiving one" | yes: a Step 2 rule |
| nci-13 × NCT02465060 | P32 | inclusion, clinical: progression after Step 1 | same | yes |
| nci-13 × NCT02465060 | P35 | inclusion, clinical: progressed on Step 3 | same | yes |
| nci-25 × NCT03502733 | P16 | inclusion, patient: "Women of child-bearing potential must agree…" | "I am a 63-year-old male" | yes, and the statement kept the "if" |
| nci-37 × NCT00924027 | P32 | exclusion, clinical: inappropriate for breast conservation | "I do not have breast cancer" | yes |
| nci-37 × NCT00924027 | P33 | exclusion, patient: a male with breast cancer | same | yes |
| nci-41 × NCT02211755 | P26 | exclusion, patient: a nursing woman | "I am an 80-year-old male" | yes |

0008 had six. Three are the same (nci-37 P32 and P33, nci-41 P26). The three prostate MRI rules moved to "does-not-hold", and four new ones came in. None is a requirement closed as "not about you", so spec concern 2 didn't show on dev.

## 6. Fidelity flags

118 flags on 109 replies (0008: 114 on 107). Every one is in `gate-2-flags.txt`, by class. Every finding resting on a flagged reply is set aside, whatever the class.

| Class | Count | What they are |
| --- | --- | --- |
| quote not in the text, on an "I don't know" reply | 57 | The participant quotes its own sentence ("My text only mentions…"). Harmless: those findings are unresolved anyway. |
| model flag on an "I don't know" reply | 29 | The same replies, flagged by the model check. Harmless. |
| quote not in the text, on an answer | 16 | Mostly the participant quoting an earlier reply of its own instead of the text. |
| model flag on an answer | 11 | Read one by one, below. |
| uncited assertion | 5 | A long reply quoting nothing. |

**The 27 flags on answers, read one by one:**
- **Real participant errors, set aside:**
  - **nci-25 × NCT00003838, turn 20:** "never been diagnosed with non-Hodgkin lymphoma. I have peripheral T-cell lymphoma." The same error as 0008.
  - **nci-25 × NCT00003838, turns 22 and 24:** says it's "unable to have" or "ineligible for" an autologous transplant. The text doesn't say so.
  - **nci-06, turn 18:** agrees to stop breastfeeding, which the text can't support. The finding it rests on is "holds", so setting it aside removes no line.
- **Fair inferences the model check calls new facts:** "it seems there is no curative therapy available" after three lines of treatment (nci-25 × NCT03502733); "requires treatment" for a metastatic cancer (nci-13).
- **Denials of things the text doesn't mention:** other cancers, NIH employment, cognitive problems, renal medullary carcinoma. These mostly give "fits" findings, so they can hide a conflict but can't raise a false alarm.
- **The model check overreaching:** "No, I am a 47-year-old woman, not a child", flagged again as "a conversational denial".

nci-12's P7 rests on "I am open to discussing standard treatments with my doctor", which wasn't flagged. nci-17's P67 rests on a reply quoting the text.

## 7. Time, and held-out

| | Dev, measured | Held-out, estimated |
| --- | --- | --- |
| parse | none (dev's 12 parses stand) | 30 trials, about 1 hour |
| checks | 14 in 18,843 s: 5.2 hours, 22.4 minutes each (0008: 29.6) | 56 checks: 21 hours at this run's rate, 28 at 0008's |
| longest | nci-17 × NCT03331380, 58.5 minutes | NCT03331380 is in held-out pairs too |

## Options

1. **Stop** (recommended): stages A, B and D ship. Docs report dev as a dev finding: the four lines fixed, the two not, the two new ones, and the false-alarm rate unchanged on 14 pairs. Held-out stays unread for a fix that can move the rate. The record's part lines and the prompt's additions ship either way.
2. **Run held-out:** stage C as planned, about 22 hours. It measures this fix on 56 pairs with an interval, and reads every remaining line by cause. Afterwards there's no unread set for the next fix.
3. **Revise on dev:** for example, a fourth addition on permissions ("may have received") and the joined condition, then dev again (about 5 hours) and Gate 2 again. Each revision tunes the prompt further on dev's 14 pairs, and statement errors come and go between runs.

## Answer

**Stop** (2026-11). Stages A, B and D ship, with dev reported as a dev finding. Held-out stays unread, and stage C doesn't run.
