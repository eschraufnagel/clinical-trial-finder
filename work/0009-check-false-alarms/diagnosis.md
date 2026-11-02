# Diagnosis: where dev's "may not fit" lines come from

Slice 0009, step 3. Every "may not fit" line on 0008's dev result ([`dev/01-5ed77c679dad.json`](../../evals/results/benchmark/check/dev/01-5ed77c679dad.json)), both arms, read with `npm run benchmark:lines`. No model was run. 2026-11.

## In short

- **120 "may not fit" lines** over 28 pair-arms. 89 are counted. 31 rest on a reply the fidelity checks flagged, so the measure sets them aside. They're listed too, because a rerun may not flag the same reply.
- **No line in causes 3 or 4 comes from the code.** `apply.ts` and `record.ts` do what each reading tells them. Every one comes from the parse, the agent's restated statement, or its reading, as the spec's §2 found.
- **Causes 3 and 4, pregnancy and conditional rules: 11 lines.** 9 are counted: 7 on eligible pairs, 2 on ineligible ones (nci-37's contraception line, in both arms).
  - **The agent's prompt can reach 8 of the 11:**
    - the statement drops a rule's "if" (nci-13's P8 and P20) or its permission (P13);
    - the statement becomes the condition alone ("is currently breastfeeding": nci-06 account, nci-17 account);
    - an instruction is read as being about everyone (nci-06 full);
    - an exclusion's statement isn't restated (nci-12, P28, which is also a parse error);
    - the reading gets "is not pregnant" the wrong way round for a man (nci-13 account, P3).
  - **Two it may reach:** nci-37's P5 in both arms. The parse made a condition into a conjunction, which §3's third addition is written for.
  - **One it can't reach:** nci-13's P2. The parse dropped "of childbearing potential" entirely.
- **Cause 2, parts of a trial: 95 lines, 69 counted.** Nearly all are on NCT03331380, NCT01900132, NCT00003838 and NCT00924027, trials with several cohorts. On ineligible pairs they're every counted line except nci-37's P5.
- **Cause 1, "or" lists not inside a part: 9 lines, 8 counted,** all on eligible pairs: nci-17 × NCT06161532's basket list, and nci-41's "solid tumors … or myelodysplastic syndrome". Out of this slice.

## What a perfect fix would leave, from the full summary

Taking out causes 2, 3 and 4 from dev's full-summary arm, on the 9 eligible pairs:

| Pair | Today's counted lines, by cause | Left |
| --- | --- | --- |
| nci-06 × NCT01827384 | 3 | none |
| nci-12 × NCT04708470 | 3, 5, 6 | P17 (a 28-day washout, a fair question) and P5 (a misreading) |
| nci-13 × NCT02465060 | 4, 4, 4, 2, 2 | none |
| nci-17 × NCT03331380 | 2, 2, 2 | none |
| nci-17 × NCT03493945 | none (not flagged) | none |
| nci-17 × NCT06161532 | 2, 1, 1, 1 | the basket list |
| nci-25 × NCT00003838 | 2 × 9 | none |
| nci-25 × NCT03502733 | 6 | P1, "solid tumors" in the trial's own words |
| nci-41 × NCT02211755 | 1 | the "or" list |

So **at best, 8 of 9 false alarms become 4 of 9.** Two of the four are "or" lists, one is a question a clinician might also raise, and one is the trial's own wording.

**On the ineligible pairs, the fix takes away catches as well as false alarms.** Four of the five are trials for another purpose, flagged today only on parts the person isn't in. With part lines left out, the only catch outside parts is nci-37, and it rests on the contraception misreading that §3 is meant to fix. The parts measure (§5.2) will likely show few or no ineligible pairs caught. That's expected, not a regression: the check reads rules, not purpose.

## Which lines §3 reaches

| §3 addition | Lines |
| --- | --- |
| 1. A rule with a condition keeps it | nci-13 full P8, P20, P13; nci-06 full and account P28; nci-17 account P47 |
| 2. An exclusion is restated by meaning | nci-12 × NCT04708470 full P28 |
| 3. "Does-not-apply" covers an unmet condition; the pregnancy example both ways round | nci-13 account P3; nci-37 full and account P5 |
| Not reached | nci-13 account P2: the parse dropped the condition |

## Causes and loci

- **Causes:**
  1. "or" list: one alternative of a list parsed as its own required rule, outside any part;
  2. part: a rule for one part of the trial (`appliesTo`);
  3. pregnancy, nursing or contraception;
  4. conditional: a rule that applies only if something is true, or a permission;
  5. records: a fair question for the oncologist;
  6. other.
- **Loci:**
  - `parse`: the criterion's text or polarity;
  - `statement`: the agent's restatement in the read call;
  - `reading`: its reading of the reply;
  - `measure`: how the record and the measure count part lines, added for cause 2. The plan's list of loci didn't name it.
  - `code` was the fourth locus, and no line needed it.

A line on a part is cause 2 even when it's also one item of a list, except nci-06 full P28, which is cause 3 and on a part.

## Every line

`counted` is "no" when the line rests on a reply the fidelity checks flagged. Labels: `inel` ineligible, `rec` recommended, `enr` eligible but not recommended.

| Pair | Arm | Label | Rule | Counted | Part | Cause | Locus | Note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| nci-01 × NCT01900132 | account | inel | P1 | yes | yes | 2 part | measure |  |
| nci-01 × NCT01900132 | account | inel | P5 | yes | yes | 2 part | measure |  |
| nci-01 × NCT01900132 | account | inel | P2 | yes | yes | 2 part | measure |  |
| nci-01 × NCT01900132 | account | inel | P6 | yes | yes | 2 part | measure |  |
| nci-01 × NCT01900132 | account | inel | P9 | no | yes | 2 part | measure |  |
| nci-01 × NCT01900132 | account | inel | P10 | no | yes | 2 part | measure |  |
| nci-01 × NCT01900132 | account | inel | P11 | no | yes | 2 part | measure |  |
| nci-01 × NCT01900132 | account | inel | P12 | no | yes | 2 part | measure |  |
| nci-01 × NCT01900132 | account | inel | P13 | no | yes | 2 part | measure |  |
| nci-01 × NCT01900132 | full | inel | P1 | yes | yes | 2 part | measure |  |
| nci-01 × NCT01900132 | full | inel | P5 | no | yes | 2 part | measure |  |
| nci-01 × NCT01900132 | full | inel | P2 | yes | yes | 2 part | measure |  |
| nci-01 × NCT01900132 | full | inel | P6 | yes | yes | 2 part | measure |  |
| nci-01 × NCT01900132 | full | inel | P10 | yes | yes | 2 part | measure |  |
| nci-01 × NCT01900132 | full | inel | P11 | no | yes | 2 part | measure |  |
| nci-01 × NCT01900132 | full | inel | P13 | no | yes | 2 part | measure |  |
| nci-01 × NCT01900132 | full | inel | P18 | yes | yes | 2 part | measure |  |
| nci-01 × NCT01900132 | full | inel | P20 | yes | yes | 2 part | measure |  |
| nci-01 × NCT03331380 | account | inel | P4 | yes | yes | 2 part | measure |  |
| nci-01 × NCT03331380 | account | inel | P6 | yes | yes | 2 part | measure |  |
| nci-01 × NCT03331380 | account | inel | P23 | yes | yes | 2 part | measure |  |
| nci-01 × NCT03331380 | account | inel | P27 | yes | yes | 2 part | measure |  |
| nci-01 × NCT03331380 | account | inel | P28 | yes | yes | 2 part | measure |  |
| nci-01 × NCT03331380 | account | inel | P32 | no | yes | 2 part | measure |  |
| nci-01 × NCT03331380 | account | inel | P38 | no | yes | 2 part | measure |  |
| nci-01 × NCT03331380 | account | inel | P47 | yes | yes | 2 part | measure |  |
| nci-01 × NCT03331380 | account | inel | P87 | yes | yes | 2 part | measure |  |
| nci-01 × NCT03331380 | full | inel | P4 | yes | yes | 2 part | measure |  |
| nci-01 × NCT03331380 | full | inel | P23 | yes | yes | 2 part | measure |  |
| nci-01 × NCT03331380 | full | inel | P27 | yes | yes | 2 part | measure |  |
| nci-01 × NCT03331380 | full | inel | P32 | yes | yes | 2 part | measure |  |
| nci-01 × NCT03331380 | full | inel | P38 | no | yes | 2 part | measure |  |
| nci-01 × NCT03331380 | full | inel | P87 | yes | yes | 2 part | measure |  |
| nci-06 × NCT01827384 | account | enr | P28 | no | yes | 3 pregnancy | statement | statement became the condition: "is currently breastfeeding" |
| nci-06 × NCT01827384 | full | enr | P28 | yes | yes | 3 pregnancy | statement | also a part line ("TREATMENT"); an instruction for those breastfeeding, read as about everyone |
| nci-12 × NCT00102544 | account | inel | P7 | yes | yes | 2 part | measure |  |
| nci-12 × NCT00102544 | account | inel | P8 | yes | yes | 2 part | measure |  |
| nci-12 × NCT00102544 | account | inel | P9 | yes | yes | 2 part | measure |  |
| nci-12 × NCT03331380 | account | inel | P4 | yes | yes | 2 part | measure |  |
| nci-12 × NCT03331380 | account | inel | P50 | no | yes | 2 part | measure |  |
| nci-12 × NCT03331380 | account | inel | P60 | no | yes | 2 part | measure |  |
| nci-12 × NCT03331380 | account | inel | P87 | yes | yes | 2 part | measure |  |
| nci-12 × NCT03331380 | full | inel | P4 | yes | yes | 2 part | measure |  |
| nci-12 × NCT04708470 | full | rec | P5 | yes |  | 6 other | reading | "more than two lines" against "one prior line": a misreading |
| nci-12 × NCT04708470 | full | rec | P17 | yes |  | 5 records | — | "currently on palliative topotecan" against a 28-day washout: a fair question |
| nci-12 × NCT04708470 | full | rec | P28 | yes |  | 3 pregnancy | parse, statement | an exclusion worded as its requirement; the statement copied it instead of restating |
| nci-13 × NCT02465060 | account | rec | P3 | yes |  | 3 pregnancy | reading | a man, against inclusion "is not pregnant", read does-not-hold |
| nci-13 × NCT02465060 | account | rec | P2 | yes |  | 3 pregnancy | parse | the parse dropped "of childbearing potential" |
| nci-13 × NCT02465060 | full | rec | P13 | yes |  | 4 conditional | statement | a permission ("may have received"); the statement made it a requirement |
| nci-13 × NCT02465060 | full | rec | P8 | yes |  | 4 conditional | statement | the parse kept "If…"; the statement dropped it |
| nci-13 × NCT02465060 | full | rec | P20 | yes |  | 4 conditional | statement | the parse kept "If…"; the statement kept the condition and dropped the requirement |
| nci-13 × NCT02465060 | full | rec | P31 | yes | yes | 2 part | measure |  |
| nci-13 × NCT02465060 | full | rec | P32 | yes | yes | 2 part | measure |  |
| nci-17 × NCT03331380 | account | enr | P4 | yes | yes | 2 part | measure |  |
| nci-17 × NCT03331380 | account | enr | P28 | yes | yes | 2 part | measure |  |
| nci-17 × NCT03331380 | account | enr | P87 | yes | yes | 2 part | measure |  |
| nci-17 × NCT03331380 | full | enr | P4 | yes | yes | 2 part | measure |  |
| nci-17 × NCT03331380 | full | enr | P28 | yes | yes | 2 part | measure |  |
| nci-17 × NCT03331380 | full | enr | P87 | yes | yes | 2 part | measure |  |
| nci-17 × NCT06161532 | account | rec | P47 | no |  | 3 pregnancy | statement | statement became the condition: "is currently breastfeeding" |
| nci-17 × NCT06161532 | account | rec | P3 | yes |  | 1 "or" list | parse | one histology of a basket list |
| nci-17 × NCT06161532 | account | rec | P4 | yes |  | 1 "or" list | parse | one histology of a basket list |
| nci-17 × NCT06161532 | account | rec | P5 | yes |  | 1 "or" list | parse | one histology of a basket list |
| nci-17 × NCT06161532 | account | rec | P6 | yes |  | 1 "or" list | parse | one histology of a basket list |
| nci-17 × NCT06161532 | full | rec | P66 | yes | yes | 2 part | measure |  |
| nci-17 × NCT06161532 | full | rec | P3 | yes |  | 1 "or" list | parse | one histology of a basket list |
| nci-17 × NCT06161532 | full | rec | P4 | yes |  | 1 "or" list | parse | one histology of a basket list |
| nci-17 × NCT06161532 | full | rec | P5 | no |  | 1 "or" list | parse | one histology of a basket list |
| nci-17 × NCT06161532 | full | rec | P6 | yes |  | 1 "or" list | parse | one histology of a basket list |
| nci-25 × NCT00003838 | account | rec | P17 | yes | yes | 2 part | measure |  |
| nci-25 × NCT00003838 | account | rec | P12 | yes | yes | 2 part | measure |  |
| nci-25 × NCT00003838 | account | rec | P13 | yes | yes | 2 part | measure |  |
| nci-25 × NCT00003838 | account | rec | P14 | yes | yes | 2 part | measure |  |
| nci-25 × NCT00003838 | account | rec | P15 | yes | yes | 2 part | measure |  |
| nci-25 × NCT00003838 | account | rec | P16 | yes | yes | 2 part | measure |  |
| nci-25 × NCT00003838 | account | rec | P18 | yes | yes | 2 part | measure |  |
| nci-25 × NCT00003838 | full | rec | P17 | yes | yes | 2 part | measure |  |
| nci-25 × NCT00003838 | full | rec | P20 | yes | yes | 2 part | measure |  |
| nci-25 × NCT00003838 | full | rec | P26 | no | yes | 6 other | parse | a rule about the donor, not the patient |
| nci-25 × NCT00003838 | full | rec | P3 | yes | yes | 2 part | measure |  |
| nci-25 × NCT00003838 | full | rec | P4 | no | yes | 2 part | measure |  |
| nci-25 × NCT00003838 | full | rec | P5 | no | yes | 2 part | measure |  |
| nci-25 × NCT00003838 | full | rec | P6 | no | yes | 2 part | measure |  |
| nci-25 × NCT00003838 | full | rec | P7 | no | yes | 2 part | measure |  |
| nci-25 × NCT00003838 | full | rec | P8 | no | yes | 2 part | measure |  |
| nci-25 × NCT00003838 | full | rec | P9 | no | yes | 2 part | measure |  |
| nci-25 × NCT00003838 | full | rec | P12 | yes | yes | 2 part | measure |  |
| nci-25 × NCT00003838 | full | rec | P13 | yes | yes | 2 part | measure |  |
| nci-25 × NCT00003838 | full | rec | P14 | yes | yes | 2 part | measure |  |
| nci-25 × NCT00003838 | full | rec | P15 | yes | yes | 2 part | measure |  |
| nci-25 × NCT00003838 | full | rec | P16 | yes | yes | 2 part | measure |  |
| nci-25 × NCT00003838 | full | rec | P18 | yes | yes | 2 part | measure |  |
| nci-25 × NCT03502733 | account | rec | P1 | no |  | 6 other | — | "solid tumors": the trial's words; clinicians recommended it |
| nci-25 × NCT03502733 | full | rec | P1 | yes |  | 6 other | — | "solid tumors": the trial's words; clinicians recommended it |
| nci-37 × NCT00924027 | account | inel | P5 | yes |  | 3 pregnancy | parse | the parse joined "of childbearing potential … must use" into "is … and is willing" |
| nci-37 × NCT00924027 | account | inel | P10 | yes | yes | 2 part | measure |  |
| nci-37 × NCT00924027 | account | inel | P11 | yes | yes | 2 part | measure |  |
| nci-37 × NCT00924027 | account | inel | P12 | yes | yes | 2 part | measure |  |
| nci-37 × NCT00924027 | account | inel | P13 | yes | yes | 2 part | measure |  |
| nci-37 × NCT00924027 | account | inel | P16 | no | yes | 2 part | measure |  |
| nci-37 × NCT00924027 | account | inel | P17 | no | yes | 2 part | measure |  |
| nci-37 × NCT00924027 | account | inel | P18 | yes | yes | 2 part | measure |  |
| nci-37 × NCT00924027 | account | inel | P19 | no | yes | 2 part | measure |  |
| nci-37 × NCT00924027 | account | inel | P20 | no | yes | 2 part | measure |  |
| nci-37 × NCT00924027 | account | inel | P35 | yes | yes | 2 part | measure |  |
| nci-37 × NCT00924027 | account | inel | P37 | yes | yes | 2 part | measure |  |
| nci-37 × NCT00924027 | account | inel | P38 | yes | yes | 2 part | measure |  |
| nci-37 × NCT00924027 | full | inel | P5 | yes |  | 3 pregnancy | parse | the parse joined "of childbearing potential … must use" into "is … and is willing" |
| nci-37 × NCT00924027 | full | inel | P10 | yes | yes | 2 part | measure |  |
| nci-37 × NCT00924027 | full | inel | P11 | no | yes | 2 part | measure |  |
| nci-37 × NCT00924027 | full | inel | P12 | no | yes | 2 part | measure |  |
| nci-37 × NCT00924027 | full | inel | P13 | yes | yes | 2 part | measure |  |
| nci-37 × NCT00924027 | full | inel | P16 | yes | yes | 2 part | measure |  |
| nci-37 × NCT00924027 | full | inel | P17 | no | yes | 2 part | measure |  |
| nci-37 × NCT00924027 | full | inel | P18 | yes | yes | 2 part | measure |  |
| nci-37 × NCT00924027 | full | inel | P19 | yes | yes | 2 part | measure |  |
| nci-37 × NCT00924027 | full | inel | P20 | yes | yes | 2 part | measure |  |
| nci-37 × NCT00924027 | full | inel | P35 | yes | yes | 2 part | measure |  |
| nci-37 × NCT00924027 | full | inel | P37 | yes | yes | 2 part | measure |  |
| nci-41 × NCT02211755 | full | rec | P2 | yes |  | 1 "or" list | parse | "solid tumors … or" / "myelodysplastic syndrome" as two rules |
