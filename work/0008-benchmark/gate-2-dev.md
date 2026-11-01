# Gate 2: spend held-out's one look?

Slice 0008, step 12. The deeper check on dev's 14 NIH-TrialBench pairs, in both arms, on the local model. 2026-11.

- **Result:** [`evals/results/benchmark/check/dev/01-5ed77c679dad.json`](../../evals/results/benchmark/check/dev/01-5ed77c679dad.json). `npm run benchmark:check -- --check --dev` regrades it from its transcripts row for row.
- **Transcripts:** `evals/results/benchmark/check/runs/dev-5ed77c679dad/`, one per pair and arm.
- **Agent, participant and fidelity check:** Qwen3.6-35B-A3B-MLX-8bit, 8bit, temperature 0, seed 20260921, oMLX, reasoning off. Agent prompt `8fda2872b52a`, summary participant `29afc83c7df6`.
- **Parses:** `trialbench/qwen3.6-35b-a3b-mlx-8bit-e1e694b3-n2`, parser prompt `e1e694b399d4`, normalize 2.
- **Beside this page:** [`gate-2-records.txt`](gate-2-records.txt) has two records as text, and [`gate-2-flags.txt`](gate-2-flags.txt) has every fidelity flag with its reply.

## In short

- **The bar is met in both arms.** No verdict wording, every unknown on its record, every flag read and every finding resting on one excluded, every pair finished.
- **The check flags almost everything.** It raises at least one "may not fit" line on 8 of 9 eligible pairs from the full file, and on 4 of 9 from the account. So catching 4 of 5 and 5 of 5 ineligible pairs means little: a check that flags nearly every pair catches nearly every ineligible one.
- **The catches come from "one part of the trial" lines.** Four of the five ineligible pairs are trials for another purpose: an MRI study, a neuromuscular study, a procedure-tracking study. The check flags the cohort the person isn't in, such as "Currently healthy" in a healthy-volunteer arm. Count only lines that aren't on one part, and one ineligible pair is caught in each arm. That one rests on a misreading: "I am 65, so I am not of childbearing potential", read as "may not fit" against the contraception rule.
- **Most false alarms have one of four causes,** and all four are in the parser or the agent, not the participant:
  1. lists of alternatives parsed as separate requirements;
  2. cohorts the person isn't in;
  3. pregnancy, nursing and contraception rules read the wrong way round (0007 saw the same thing);
  4. conditional rules read as requirements.
- **The account arm's fewer false alarms are half an artefact.** It loses four false alarms. Two of them are lost only because the line rested on a reply the fidelity checks flagged, and the account arm has nearly twice the flagged replies.
- **The one rule a clinician named lands where the clinician said it should,** as a question. nci-37's "…for which high-dose rate brachytherapy is appropriate…" is on both records under "Needs your records or your oncologist". The named-rule measure counts only "may not fit" lines, so it scores this as `rule-other`.
- **Held-out is about 42 hours in both arms,** or 28 for the full file alone. That's longer than the plan's 15 to 30.
- **Recommendation: stop.** Don't spend held-out on a check whose false alarms have known causes that this slice may not fix. The reasons, and the other options, are under Options.

## The bar

Frozen in the plan before dev ran.

| | full | account |
| --- | --- | --- |
| 1. `verdictHits` in any agent turn or record | 0 | 0 |
| 2. an unresolved, chart-review or not-asked criterion left off its record | 0 | 0 |
| 3. fidelity flags read and explained; findings scored from a flagged turn | 114 flags on 107 replies, all in `gate-2-flags.txt`, classed below; 117 findings excluded, none scored | 218 flags on 198 replies; 210 findings excluded, none scored |
| 4. pairs finished | 14 of 14 | 14 of 14 |

Two kinds of stop happened along the way, and neither is left:
- **Memory.** Two full-arm pairs were refused by the local server's memory guard, an HTTP 400 on prefill memory. Both finished on a rerun.
- **Cut-off replies.** Two pairs on NCT03331380, one in each arm, stopped because the participant's reply was cut off at 300 tokens. Asked about a heart condition its summary doesn't mention, it said it didn't know, then quoted most of the summary to show what the summary does say. The limit is now 1,024 tokens, in its own commit (`026624f`), and both pairs finished. The limit only cuts a reply short, so at temperature 0 every reply that had finished under 300 tokens is unchanged, and the run hash, which covers the prompts, stayed the same.

## The measures (§7.7)

| | full | account |
| --- | --- | --- |
| ineligible pairs caught | **4 of 5**, 80% (38–96%) | **5 of 5**, 100% (57–100%) |
| …by what the comment named | disease 4 (all caught), rule 1 (`rule-other`) | the same |
| false alarms, all eligible | **8 of 9**, 89% (57–98%) | **4 of 9**, 44% (19–73%) |
| …recommended | 6 of 6 | 3 of 6 |
| …eligible but not recommended | 2 of 3 | 1 of 3 |
| false-alarm lines by where they sit: one part / records / asked | 16 / 7 / 4 | 10 / 5 / 1 |
| questions asked, per pair | 580, 41.4 | 575, 41.1 |
| verdict hits / unknowns missing | 0 / 0 | 0 / 0 |
| flags / findings excluded | 114 / 117 | 218 / 210 |

Fourteen pairs can't measure a rate. The intervals are there to say so.

**A reading, not a committed measure.** These figures come from the result's rows, with lines that sit on one part of a trial left out:

| | full | account |
| --- | --- | --- |
| caught | 1 of 5 (nci-37, on the contraception misreading) | 1 of 5 (the same) |
| false alarms | 5 of 9 | 2 of 9 |

### Per pair

`lines` counts the "may not fit" lines that count, by where they sit.

| pair | label | full: flagged, lines | account: flagged, lines | asked full / account | flags full / account |
| --- | --- | --- | --- | --- | --- |
| nci-01 NCT01900132 | ineligible (disease) | yes, part 6 | yes, part 4 | 19 / 25 | 7 / 22 |
| nci-01 NCT03331380 | ineligible (disease) | yes, part 5 | yes, part 7 | 89 / 79 | 12 / 38 |
| nci-12 NCT00102544 | ineligible (disease) | **no** | yes, part 3 | 8 / 12 | 0 / 4 |
| nci-12 NCT03331380 | ineligible (disease) | yes, part 1 | yes, part 2 | 87 / 86 | 25 / 53 |
| nci-37 NCT00924027 | ineligible (rule) | yes, asked 1, part 8 | yes, asked 1, part 8 | 29 / 29 | 10 / 7 |
| nci-06 NCT01827384 | eligible, not recommended | yes, part 1 | **no** | 30 / 31 | 8 / 9 |
| nci-17 NCT03331380 | eligible, not recommended | yes, part 3 | yes, part 3 | 87 / 84 | 6 / 4 |
| nci-17 NCT03493945 | eligible, not recommended | **no** | **no** | 40 / 33 | 3 / 6 |
| nci-12 NCT04708470 | recommended | yes, asked 3 | **no** | 21 / 24 | 0 / 6 |
| nci-13 NCT02465060 | recommended | yes, asked 1, records 2, part 2 | yes, asked 1, records 1 | 27 / 29 | 8 / 15 |
| nci-17 NCT06161532 | recommended | yes, part 1, records 3 | yes, records 4 | 58 / 59 | 12 / 9 |
| nci-25 NCT00003838 | recommended | yes, part 9 | yes, part 7 | 32 / 34 | 12 / 25 |
| nci-25 NCT03502733 | recommended | yes, records 1 | **no** | 31 / 29 | 7 / 9 |
| nci-41 NCT02211755 | recommended | yes, records 1 | **no** | 22 / 21 | 4 / 11 |

Every pair's lines are in the Appendix, with:
- the trial's words;
- the participant's words;
- the clinician's comment;
- which lines were set aside because they rest on a flagged reply.

## What the "may not fit" lines are

I read every line on every pair. Most fall into one of five kinds.

**1. Lists of alternatives parsed as separate requirements.** The parser keeps each item of an "or" list as its own criterion, and the check treats each one as required. A person who has one of the alternatives "may not fit" all the others.
- **nci-41 × NCT02211755, full:** "Histologically confirmed solid tumors … or" (P1) and "histologically confirmed myelodysplastic syndrome …" (P2) are two criteria. Asked about the second, the participant said "No, I have not been diagnosed with myelodysplastic syndrome". That's the only line on a pair the clinicians recommended. The record is in `gate-2-records.txt`.
- **nci-17 × NCT06161532, both arms:** a basket trial's list of eligible histologies, "Squamous cell carcinoma of the bladder…", "Renal medullary carcinoma", "Squamous cell carcinoma of the penis" (P3 to P6). The person has a neuroendocrine bladder cancer, which the trial also takes, and "may not fit" each of the others.
- **nci-13 × NCT02465060, full:** step 2's two alternative routes, progression before or after 6 months (P31, P32).

**2. Cohorts the person isn't in.** In a trial with several parts, the check says the person "may not fit one part". That's true, and it's what the record is built to say. A clinician's "eligible" means eligible for some part, so the measure calls it a false alarm, and calls it a catch on an ineligible pair.
- **NCT03331380, the MRI study, in all four of its pairs:** "Currently healthy, self-reported" in the healthy-volunteer arm, with "Headache", "Persistent neck pain" and "Fracture evaluation" as conditions for the non-cardiac arm.
- **nci-25 × NCT00003838:** Group A's diseases and "MM subjects must be between the ages of 8 and 65" (Group A).
- **nci-12 × NCT00102544, account only:** the prostate biopsy cohort, against "I am a woman with cervical cancer, so I don't have a prostate."

**3. Pregnancy, nursing and contraception rules read the wrong way round.** Each of these replies satisfies its rule, and each became "may not fit":
- nci-06's "No, I am not breastfeeding";
- nci-12's "I am not pregnant or nursing";
- nci-13's "I'm a 75-year-old man";
- nci-37's "I am 65 years old, so I am not of childbearing potential".

0007's p08 record has the same pattern ("No, I'm a guy." → "May not fit"). It's the agent's reading. The plan's "revise on dev" may not change the agent's prompts.

**4. Conditional rules read as requirements.**
- **nci-13, P8:** "if the patient is currently receiving therapy, the clinician must have assessed…", answered "I am not currently receiving any cancer therapy".
- **nci-13, P20:** "Patients with brain metastases … must have completed treatment…", answered "no mention of brain involvement".

**5. Lines a clinician might also raise.**
- **nci-12 × NCT04708470, full:** "currently on palliative topotecan" against a 28-day washout (P17). It's a real question for the oncologist, even on a recommended pair. The same pair's "more than two lines of systemic treatment", against "must have received one prior line" (P5), is a misreading.
- **nci-25 × NCT03502733, full:** "I have peripheral T-cell lymphoma, which is a blood cancer, not a solid tumor", against "solid tumors…" (P1). The trial's words say solid tumors, and the clinicians recommended it.

## Caught, and the named rule

- **Four of the five ineligible pairs have a `disease` reason.** Each is a trial for another purpose. In both arms the check flagged each one on parts the person isn't in, which is kind 2 above. The exception is nci-12 × NCT00102544 in the full arm, where nothing was flagged in 8 questions. No record says the trial isn't a cancer-treatment trial.
- **nci-37 × NCT00924027 is the only `rule` pair.** The clinician named "Pathologically confirmed malignancy for which high-dose rate brachytherapy is appropriate…" and wrote that it "should be've been picked up in either missing info or Rationale as a question".
  - The check asked about it in both arms. The participant answered "I don't know if that's appropriate for me", or in the account arm "I don't know if brachytherapy is appropriate for my serous endometrial cancer."
  - It's on both records under "Needs your records or your oncologist". That record is in `gate-2-records.txt`.
  - The measure scores it `rule-other`, because it credits only a "may not fit" line on the named rule. The pair was flagged on other lines: cohorts for other cancers, and the contraception misreading.
  - Held-out has 17 rule pairs. If held-out runs, I'd report alongside `rule-caught` how many named rules end up on the record under "Needs your records or your oncologist" or "To ask your oncologist". That's a reading on top of the frozen measure, not a change to it.

## The arms

- **Caught:** the same in both arms, except nci-12 × NCT00102544, caught in the account arm only, on prostate-cohort lines.
- **False alarms:** account loses nci-06, nci-12 × NCT04708470, nci-25 × NCT03502733 and nci-41.
  - **Two of those are because a line was set aside.** nci-06's breastfeeding line (P28) and nci-25's solid-tumor line (P1) are on the account records, but each rests on a reply the fidelity checks flagged.
  - **Two are real.** On nci-12 × NCT04708470 and nci-41, the account conversations produced no "may not fit" line at all.
- **Flags:** the account arm has 198 flagged replies to the full arm's 107. The account is shorter and in the patient's own words. The participant then quotes its own earlier replies, or rewords the account, and those quotes don't match the text.
- **So the account arm's lower false-alarm rate is half artefact, half real**, on 9 pairs. It's no evidence that knowing less makes the check flag less.

## Fidelity flags

Every flag, with the question and the reply, is in `gate-2-flags.txt`, grouped by class. Every finding resting on a flagged reply is set aside, whatever the class.

| class | count | what they are |
| --- | --- | --- |
| "I don't know" reply quoting itself | 134 | The participant says it doesn't know and "quotes" its own sentence, e.g. "My text only mentions my cervical cancer and its spread to my lungs and liver." Harmless: these findings are unresolved anyway. |
| model flag on an "I don't know" reply | 68 | The same replies, flagged by the model check, mostly for saying what the text doesn't mention. Harmless. |
| "I don't know" reply, other quote | 57 | An "I don't know" with a reworded quote from the account, or a quote of an earlier reply. Harmless. |
| model flag on an answer | 37 | Read one by one, below. |
| reworded or invented quote on an answer | 15 | Mostly quotes of the participant's own earlier replies instead of the text. Two are worth reading, below. |
| uncited assertion | 11 | A long reply quoting nothing. |
| answer quoting itself | 10 | An answer whose quote is its own sentence. |

**The 37 model flags on answers and the 15 reworded quotes,** read one by one:

- **Real participant errors, five of them.** Each would mislead the check, and each is set aside:
  - **nci-41, full:** gave its treatment start date (13 September 2024) as its last dose, twice.
  - **nci-06, account:** said the cancer spread after treatment stopped. The text says it grew during treatment.
  - **nci-25, full:** "No, I have never been diagnosed with non-Hodgkin lymphoma. I have peripheral T-cell lymphoma." Peripheral T-cell lymphoma is a non-Hodgkin lymphoma.
  - **nci-37, account:** claimed it managed its treatment "on my own", against a text describing emergency care.
  - **nci-17 × NCT06161532, account:** "Yes, I was diagnosed with a large meningioma…" to a question about cancer spread to the brain. A meningioma is a brain tumor, not spread to the brain. The question that asked about "lesions" makes this arguable.
- **Fair inferences the model check calls new facts:** atezolizumab is anti-PD-L1; carboplatin is a platinum drug; a 63-year-old isn't pregnant; "I had my prostate removed" means a man; cervical adenocarcinoma is HPV-associated; "light work, heavy things tire me" is ECOG 2.
- **Denials of things the text doesn't mention:** "I haven't had a stroke or spine surgery", "not taking investigational agents". The participant should have said it didn't know. These mostly give "fits" findings, not "may not fit", so they can hide a mismatch but can't raise a false alarm.
- **The model check overreaching,** for example on "No, I am a 47-year-old woman, not a child", flagged as "a conversational denial … not present in the source text".

**What the flags cost.** The full arm set aside 117 findings and the account arm 210. That's a lot. Most rest on harmless "I don't know" replies, which give unresolved findings anyway. But setting a finding aside can only remove "may not fit" lines, never add one. So in the account arm especially, flagging pulls caught and false alarms both down.

## Time, and held-out

| | dev, measured | held-out, estimated |
| --- | --- | --- |
| a finished check, full file | 29.6 min average | 56 × 29.6 ≈ 27.7 h |
| a finished check, account | 15.6 min average | 56 × 15.6 ≈ 14.5 h |
| both arms | 11.4 h wall time, failed attempts included | ≈ 42 h, plus about 1 h to parse held-out's 30 trials |

- **The longest checks are on NCT03331380,** 79 to 89 questions and up to 79 minutes. It's in 4 of dev's pairs.
- **The plan's estimate was 15 to 30 hours,** from 0007's pace.
- **Held-out has 56 pairs:** 30 ineligible (17 `rule`, 8 `disease`, 5 `none`), 21 recommended and 5 eligible but not recommended.

## Options

1. **Stop** (recommended). The slice ships stages A to C and E, with this page reported as a dev finding beside the search results.
   - **For:** dev already shows the behavior held-out would measure. The check flags nearly every pair, for four causes in the parser and the agent. "Revise on dev" may change only the participant or the runner, so none of those causes can be fixed in this slice. Held-out would spend its one look, and about 42 hours, measuring a false-alarm rate whose causes are known. It's better kept for after they're fixed.
   - **Against:** no held-out number for the check against clinicians in this slice.
2. **Run held-out on the full file only,** about 28 hours. This gives a held-out number now: caught, false alarms and named rules, on 30 ineligible pairs with 17 named rules. The account arm is dropped, which dev says is half artefact anyway. **Against:** the look is spent on a version whose false alarms are about to be worked on.
3. **Run held-out in both arms,** about 42 hours, as planned.
4. **Revise on dev,** then Gate 2 again. The only revisions allowed (participant, runner) would reduce flags, not false alarms. One candidate: the participant could stop quoting itself on "I don't know". That changes the participant's prompt, so dev reruns, about 11 hours. I don't recommend it, because it doesn't touch the four causes.

Whichever you choose, I'd name the four causes as the next work for the check: alternatives, cohorts, pregnancy rules, conditional rules. Held-out stays unread until after them, if you stop.

## Answer

**Stop, keep held-out** (2026-11). Stage D doesn't run: held-out's 30 trials aren't parsed and its 56 pairs aren't checked, so its one look is still unspent. The slice ships stages A to C and E, with this page's finding reported as dev's, beside the search results.

## Appendix: every dev pair's "may not fit" lines

Generated from the transcripts. For each pair and arm:
- whether it's flagged, the questions asked and the flags;
- the findings set aside;
- each "may not fit" line on the record, with its section, the trial's words, the part it sits on and the participant's words.

A line marked EXCLUDED rests on a flagged reply and doesn't count.
### nci-01 NCT01900132 — ineligible (reason: disease)
Clinician: This is a study for patients with neuromuscular disorders. TrialGPT noted the patient has chemotherapy-induced neuropathy, which is not a neuromuscular disorder. Further, this patient is presumedly searching for a cancer treatment trial, which this is not.

#### full: flagged true, asked 19, flags 7, excluded [P4,P5,P7,P8,P11,P13,P15,P16,P21], named disease
- told P1: "Healthy adults, male or female, aged 18 years old or older," — part: HEALTHY VOLUNTEERS-ADULTS
    said: "Yes, I am 47 years old, so I am definitely 18 or older."
    said: "No, I have metastatic cervical carcinoma"
- told P5 [EXCLUDED: rests on a flagged reply]: "Healthy children, male or female, age 7-18," — part: HEALTHY VOLUNTEERS-PEDIATRIC
    said: "No, I am a 47-year-old woman, not a child."
- records P2: "In good general health as evidenced by medical history" — part: HEALTHY VOLUNTEERS-ADULTS
    said: "No, I have metastatic cervical carcinoma"
    why: Only your records can settle this, whatever you said.
- records P6: "In good general health as evidenced by medical history" — part: HEALTHY VOLUNTEERS-PEDIATRIC
    said: "No, I have metastatic cervical carcinoma"
    why: Only your records can settle this, whatever you said.
- records P10: "Suspected motor neuron disease or" — part: SUBJECTS WITH NEUROMUSCULAR DISEASE
    said: "No, I have never been told I might have motor neuron disease"
    why: Only your records can settle this, whatever you said.
- records P11 [EXCLUDED: rests on a flagged reply]: "Suspected myopathy or" — part: SUBJECTS WITH NEUROMUSCULAR DISEASE
    said: "No, I have never been told I have myopathy"
    why: Only your records can settle this, whatever you said.
- records P13 [EXCLUDED: rests on a flagged reply]: "Suspected movement disorders that impair intracortical processes" — part: SUBJECTS WITH NEUROMUSCULAR DISEASE
    said: "No, I have never been told I have a suspected movement disorder"
    why: Only your records can settle this, whatever you said.
- records P18: "History of stroke, muscle disorders, peripheral neuropathy or spine surgery" — part: HEALTHY VOLUNTEERS-ADULTS
    said: "I also have mild neuropathy in my fingertips and toes"
    why: Only your records can settle this, whatever you said.
- records P20: "History of stroke, muscle disorders, peripheral neuropathy or spine surgery" — part: HEALTHY VOLUNTEERS-PEDIATRIC
    said: "I also have mild neuropathy in my fingertips and toes"
    why: Only your records can settle this, whatever you said.

#### account: flagged true, asked 25, flags 22, excluded [P3,P4,P7,P8,P9,P10,P11,P12,P13,P15,P17,P19,P21], named disease
- told P1: "Healthy adults, male or female, aged 18 years old or older," — part: HEALTHY VOLUNTEERS-ADULTS
    said: "Yes, I am 47 years old, so I am definitely 18 or older."
    said: "No, I am not in good health. I have cervical cancer"
- told P5: "Healthy children, male or female, age 7-18," — part: HEALTHY VOLUNTEERS-PEDIATRIC
    said: "No, I am not between 7 and 18. I am 47 years old."
- records P2: "In good general health as evidenced by medical history" — part: HEALTHY VOLUNTEERS-ADULTS
    said: "No, I am not in good health. I have cervical cancer"
    why: Only your records can settle this, whatever you said.
- records P6: "In good general health as evidenced by medical history" — part: HEALTHY VOLUNTEERS-PEDIATRIC
    said: "No, I am not in good health. I have cervical cancer"
    why: Only your records can settle this, whatever you said.
- records P9 [EXCLUDED: rests on a flagged reply]: "Adult and pediatric, male or female, patients with a neuromuscular disorder are eligible even if the exact etiology of the disorder is unknown at the time of enrollment into this study. This will include neuropathy, myop" — part: SUBJECTS WITH NEUROMUSCULAR DISEASE
    said: "I have cervical cancer that has spread to my liver and lungs"
    said: "I don't have a diagnosis of a neuromuscular disorder like neuropathy or myopathy"
    said: "I don't have a diagnosis of a motor neuron disorder or a movement disorder"
    said: "I don't have a diagnosis of a neuromuscular disorder"
    why: Only your records can settle this, whatever you said.
- records P10 [EXCLUDED: rests on a flagged reply]: "Suspected motor neuron disease or" — part: SUBJECTS WITH NEUROMUSCULAR DISEASE
    said: "I don't have a diagnosis of a neuromuscular disorder like neuropathy or myopathy"
    said: "I don't have a diagnosis of a motor neuron disorder"
    why: Only your records can settle this, whatever you said.
- records P11 [EXCLUDED: rests on a flagged reply]: "Suspected myopathy or" — part: SUBJECTS WITH NEUROMUSCULAR DISEASE
    said: "I don't have a diagnosis of a neuromuscular disorder like neuropathy or myopathy"
    why: Only your records can settle this, whatever you said.
- records P12 [EXCLUDED: rests on a flagged reply]: "Suspected neuropathy or" — part: SUBJECTS WITH NEUROMUSCULAR DISEASE
    said: "I don't have a diagnosis of a neuromuscular disorder like neuropathy or myopathy"
    why: Only your records can settle this, whatever you said.
- records P13 [EXCLUDED: rests on a flagged reply]: "Suspected movement disorders that impair intracortical processes" — part: SUBJECTS WITH NEUROMUSCULAR DISEASE
    said: "I don't have a diagnosis of a neuromuscular disorder like neuropathy or myopathy"
    said: "No, I don't have any suspected movement disorders"
    why: Only your records can settle this, whatever you said.

### nci-01 NCT03331380 — ineligible (reason: disease)
Clinician: This is a study to test a new kind of MRI. TrialGPT flagged cancer as a "non cardiac disease" which while technically true is not what the study elibility criteria means. Further, the patient is searching for a cancer treatment trial, which this is not.

#### full: flagged true, asked 89, flags 12, excluded [P19,P38,P58,P59,P63,P66,P74,P80,P81,P84,P85,P89,P93], named disease
- told P4: "Currently healthy, self-reported" — part: Healthy Volunteers (Objectives 1 and 2)
    said: "No, I would not describe myself as currently healthy."
- records P23: "Headache" — part: Subjects with Non-Cardiac Disease (Objective 4)
    said: "No, I do not currently have a headache"
    why: Only your records can settle this, whatever you said.
- records P27: "Persistent neck pain or radiculopathy" — part: Subjects with Non-Cardiac Disease (Objective 4)
    said: "No, I do not currently have persistent neck pain"
    why: Only your records can settle this, whatever you said.
- records P32: "Fracture evaluation" — part: Subjects with Non-Cardiac Disease (Objective 4)
    said: "No, I am not currently undergoing an evaluation for a bone fracture"
    why: Only your records can settle this, whatever you said.
- records P38 [EXCLUDED: rests on a flagged reply]: "Mechanical knee symptoms" — part: Subjects with Non-Cardiac Disease (Objective 4)
    said: "No, I do not have mechanical symptoms in my knees"
    why: Only your records can settle this, whatever you said.
- records P87: "Important past medical illness" — part: Healthy Volunteers (Objectives 1 and 2)
    said: "I have significant hepatic disease and some pulmonary disease"
    why: Only your records can settle this, whatever you said.

#### account: flagged true, asked 79, flags 38, excluded [P3,P8,P13,P14,P16,P17,P19,P21,P26,P30,P32,P33,P35,P38,P41,P43,P46,P48,P61,P63,P65,P66,P68,P69,P74,P75,P76,P78,P79,P80,P81,P84,P86,P88,P89,P92,P94], named disease
- told P4: "Currently healthy, self-reported" — part: Healthy Volunteers (Objectives 1 and 2)
    said: "No, I definitely don't describe myself as healthy"
- records P6: "Stable angina pectoris due to epicardial coronary artery obstruction" — part: Subjects with Heart Disease (Objective 3)
    said: "No, I don't have chest pain"
    why: Only your records can settle this, whatever you said.
- records P23: "Headache" — part: Subjects with Non-Cardiac Disease (Objective 4)
    said: "No, I don't have a headache"
    why: Only your records can settle this, whatever you said.
- records P27: "Persistent neck pain or radiculopathy" — part: Subjects with Non-Cardiac Disease (Objective 4)
    said: "I don't have persistent neck pain"
    why: Only your records can settle this, whatever you said.
- records P28: "Cancer or tumors of the spine" — part: Subjects with Non-Cardiac Disease (Objective 4)
    said: "No, I don't have cancer in my spine"
    why: Only your records can settle this, whatever you said.
- records P32 [EXCLUDED: rests on a flagged reply]: "Fracture evaluation" — part: Subjects with Non-Cardiac Disease (Objective 4)
    said: "No, I am not currently undergoing an evaluation for a bone fracture"
    why: Only your records can settle this, whatever you said.
- records P38 [EXCLUDED: rests on a flagged reply]: "Mechanical knee symptoms" — part: Subjects with Non-Cardiac Disease (Objective 4)
    said: "No, I don't have any mechanical knee symptoms"
    why: Only your records can settle this, whatever you said.
- records P47: "Iron content determination" — part: Subjects with Non-Cardiac Disease (Objective 4)
    said: "No, I am not currently undergoing any tests to determine my iron levels"
    why: Only your records can settle this, whatever you said.
- records P87: "Important past medical illness" — part: Healthy Volunteers (Objectives 1 and 2)
    said: "I have cervical cancer that has spread to my liver and lungs"
    why: Only your records can settle this, whatever you said.

### nci-06 NCT01827384 — eligible_but_not_recommended
Clinician: Patient is implied to already have undergone recent biopsy so likely would not proceed with this study

#### full: flagged true, asked 30, flags 8, excluded [P4,P16,P19,P36,P37,P43,P44,P45,P46]
- told P28: "TREATMENT: Because there may be a risk for adverse events in nursing infants secondary to treatment of the mother with these agents, breastfeeding should be discontinued while the patient is on this trial and for 30 days" — part: TREATMENT
    said: "No, I am not breastfeeding."

#### account: flagged false, asked 31, flags 9, excluded [P4,P12,P19,P28,P33,P34,P37,P40,P41,P45]
- told P28 [EXCLUDED: rests on a flagged reply]: "TREATMENT: Because there may be a risk for adverse events in nursing infants secondary to treatment of the mother with these agents, breastfeeding should be discontinued while the patient is on this trial and for 30 days" — part: TREATMENT
    said: "The text does not mention anything about breastfeeding, so I assume I am not doing it."
    said: "No, I am not currently breastfeeding."

### nci-12 NCT00102544 — ineligible (reason: disease)
Clinician: This is a study for patients already enrolled on another NIH protocol scheduled for a procedure. It is not a treatment trial for cancer patients which this patient is looking for.

#### full: flagged false, asked 8, flags 0, excluded [], named disease

#### account: flagged true, asked 12, flags 4, excluded [P4,P10,P11,P14], named disease
- records P7: "Patients are eligible if they have undergone a prostate MRI and have had abnormalities identified as follows:" — part: PROSTATE BIOPSY COHORT (Cohorts 1 and 9)
    said: "I am a woman with cervical cancer, so I don't have a prostate."
    why: Only your records can settle this, whatever you said.
- records P8: "PSA \>2.5 OR abnormal digital rectal exam OR an abnormality identified on prostate MRI with a clinical indication for fusion biopsy" — part: PROSTATE BIOPSY COHORT (Cohorts 1 and 9)
    said: "I am a woman with cervical cancer, so I don't have a prostate."
    why: Only your records can settle this, whatever you said.
- records P9: "Pre-biopsy prostate MRI showing targetable lesions" — part: PROSTATE BIOPSY COHORT (Cohorts 1 and 9)
    said: "I am a woman with cervical cancer, so I don't have a prostate."
    why: Only your records can settle this, whatever you said.

### nci-12 NCT03331380 — ineligible (reason: disease)
Clinician: This trial is to test a new MRI in healthy volunteers or patients with cardiac disease, but the vignette patient is looking for a cancer treatment trial

#### full: flagged true, asked 87, flags 25, excluded [P9,P10,P11,P12,P13,P14,P18,P30,P35,P36,P49,P52,P55,P56,P57,P58,P59,P75,P76,P79,P81,P83,P86,P90,P92], named disease
- told P4: "Currently healthy, self-reported" — part: Healthy Volunteers (Objectives 1 and 2)
    said: "No, I am not healthy in that sense"

#### account: flagged true, asked 86, flags 53, excluded [P9,P10,P11,P12,P13,P14,P15,P16,P17,P18,P19,P20,P21,P22,P24,P25,P26,P27,P28,P29,P30,P31,P32,P33,P34,P35,P36,P37,P38,P39,P41,P43,P46,P48,P49,P50,P52,P53,P54,P55,P56,P57,P58,P59,P60,P68,P74,P78,P80,P83,P84,P89,P90,P91,P93,P94], named disease
- told P4: "Currently healthy, self-reported" — part: Healthy Volunteers (Objectives 1 and 2)
    said: "No, I am not currently healthy."
- records P50 [EXCLUDED: rests on a flagged reply]: "Have known lung disease including but not limited to:" — part: Subjects with Non-Cardiac Disease (Objective 4)
    said: "cancer that has spread to my lungs"
    said: "it doesn't say I have a separate lung disease"
    why: Only your records can settle this, whatever you said.
- records P60 [EXCLUDED: rests on a flagged reply]: "Have other known non-cardiovascular disease" — part: Subjects with Non-Cardiac Disease (Objective 4)
    said: "No, I don't have any other known non-cardiovascular diseases"
    why: Only your records can settle this, whatever you said.
- records P87: "Important past medical illness" — part: Healthy Volunteers (Objectives 1 and 2)
    said: "I have cervical cancer that has spread to my lungs and liver"
    why: Only your records can settle this, whatever you said.

### nci-12 NCT04708470 — recommended

#### full: flagged true, asked 21, flags 0, excluded []
- told P5: "Subjects with HPV associated malignancies must have received one prior line of systemic chemotherapy as well as checkpoint therapy if checkpoint therapy is FDA approved for that specific tumor type (e.g., HNSCC and PDL1+"
    said: "I have received more than two lines of systemic treatment"
- told P17: "Participants with prior investigational drug, chemotherapy, immunotherapy or any prior radiotherapy (except for palliative bone directed therapy) within the past 28 days prior to enrollment except if the investigator has"
    said: "I am currently on palliative topotecan"
- told P28: "Pregnant individuals are excluded from this study because these drugs have not been tested in pregnant individuals and there is potential for teratogenic or abortifacient effects. Because there is an unknown but potentia"
    said: "I am not pregnant or nursing."

#### account: flagged false, asked 24, flags 6, excluded [P1,P2,P3,P7]

### nci-13 NCT02465060 — recommended

#### full: flagged true, asked 27, flags 8, excluded [P2,P3,P4,P5,P18,P21,P27,P28]
- told P13: "Patients may have received other non-targeted, immunotherapy or targeted treatment between the prior genetic testing at the outside lab and registration to Step 0. The decision to stop such treatment in favor of particip"
    said: "My text only mentions TIP chemotherapy and chemoradiation with 5-fluorouracil and mitomycin"
    said: "No, I have not received any treatments specifically called immunotherapy or targeted therapy"
- records P8: "if the patient is currently receiving therapy, the clinician must have assessed that the current therapy is no longer benefitting the patient prior to enrolling on MATCH, regardless of whether it is considered standard"
    said: "I am not currently receiving any cancer therapy"
    why: Only your records can settle this, whatever you said.
- records P20: "Patients with brain metastases or primary brain tumors must have completed treatment, surgery or radiation therapy \>= 4 weeks prior to start of treatment"
    said: "no mention of brain involvement"
    why: Only your records can settle this, whatever you said.
- records P31: "No response and progression (or inability to tolerate further treatment) occurred \< 6 months from start of step 1 treatment" — part: Step 2
    said: "progressive disease, which is within 6 months of starting that treatment"
    why: Only your records can settle this, whatever you said.
- records P32: "Progression (or inability to tolerate further treatment) occurred after a (1) response OR (2) after \>= 6 months from start of step 1 treatment; patient must have tumor amenable to percutaneous biopsy and be willing and " — part: Step 2
    said: "progressive disease, which is within 6 months of starting that treatment"
    why: Only your records can settle this, whatever you said.

#### account: flagged true, asked 29, flags 15, excluded [P4,P6,P7,P9,P20,P27,P28,P29,P30,P31,P32,P34,P35]
- told P3: "patients that are pregnant or breast feeding are excluded"
    said: "I'm a 75-year-old man, so I don't have a uterus or ovaries"
- records P2: "Patients of childbearing potential must have a negative serum pregnancy test within 2 weeks prior to registration"
    said: "I certainly haven't had a pregnancy test"
    why: Only your records can settle this, whatever you said.

### nci-17 NCT03331380 — eligible_but_not_recommended
Clinician: Not relevant

#### full: flagged true, asked 87, flags 6, excluded [P18,P49,P52,P81,P83,P95,P96,P97]
- told P4: "Currently healthy, self-reported" — part: Healthy Volunteers (Objectives 1 and 2)
    said: "No, I would not describe myself as currently healthy."
- records P28: "Cancer or tumors of the spine" — part: Subjects with Non-Cardiac Disease (Objective 4)
    said: "No, I do not have cancer or tumors of the spine"
    why: Only your records can settle this, whatever you said.
- records P87: "Important past medical illness" — part: Healthy Volunteers (Objectives 1 and 2)
    said: "Yes, I have a history of cancer."
    why: Only your records can settle this, whatever you said.

#### account: flagged true, asked 84, flags 4, excluded [P63,P81,P92,P94]
- told P4: "Currently healthy, self-reported" — part: Healthy Volunteers (Objectives 1 and 2)
    said: "No, I definitely do not describe myself as currently healthy"
- records P28: "Cancer or tumors of the spine" — part: Subjects with Non-Cardiac Disease (Objective 4)
    said: "No, I don't have cancer or tumors of the spine"
    why: Only your records can settle this, whatever you said.
- records P87: "Important past medical illness" — part: Healthy Volunteers (Objectives 1 and 2)
    said: "Yes, I have important past medical illnesses"
    why: Only your records can settle this, whatever you said.

### nci-17 NCT03493945 — eligible_but_not_recommended
Clinician: Patient unlikely to benefit

#### full: flagged false, asked 40, flags 3, excluded [P9,P33,P35]

#### account: flagged false, asked 33, flags 6, excluded [P14,P28,P35,P41,P42,P46]

### nci-17 NCT06161532 — recommended

#### full: flagged true, asked 58, flags 12, excluded [P5,P28,P29,P30,P37,P38,P39,P50,P61,P67]
- told P66: "Prior treatment with immune checkpoint blockade therapies, including anti-PD-1, and anti-PD-L1 therapeutic antibodies (for Arm 2 only)." — part: Arm 2
    said: "Yes, I have received immune checkpoint blockade therapy. The text states I was treated with atezolizumab, which is an anti-PD-L1 drug."
- records P3: "Squamous cell carcinoma of the bladder or urinary tract"
    said: "No, I have not been diagnosed with squamous cell carcinoma."
    why: Only your records can settle this, whatever you said.
- records P4: "Primary adenocarcinoma of the bladder or urinary tract (urachal or non-urachal)"
    said: "No, I have not been diagnosed with primary adenocarcinoma."
    why: Only your records can settle this, whatever you said.
- records P5 [EXCLUDED: rests on a flagged reply]: "Renal medullary carcinoma"
    said: "No, I have not been diagnosed with renal medullary carcinoma."
    why: Only your records can settle this, whatever you said.
- records P6: "Squamous cell carcinoma of the penis"
    said: "No, I have not been diagnosed with squamous cell carcinoma of the penis."
    why: Only your records can settle this, whatever you said.

#### account: flagged true, asked 59, flags 9, excluded [P12,P24,P25,P28,P36,P38,P47,P48,P50]
- told P47 [EXCLUDED: rests on a flagged reply]: "Nursing participants must discontinue nursing and/or not begin nursing until 1 month after the last dose of study drug(s)."
    said: "No, I am not currently breastfeeding."
- records P3: "Squamous cell carcinoma of the bladder or urinary tract"
    said: "diagnosed with a neuroendocrine cancer of the bladder, specifically a large cell kind"
    why: Only your records can settle this, whatever you said.
- records P4: "Primary adenocarcinoma of the bladder or urinary tract (urachal or non-urachal)"
    said: "diagnosed with a neuroendocrine cancer of the bladder, specifically a large cell kind"
    why: Only your records can settle this, whatever you said.
- records P5: "Renal medullary carcinoma"
    said: "diagnosed with a neuroendocrine cancer of the bladder"
    why: Only your records can settle this, whatever you said.
- records P6: "Squamous cell carcinoma of the penis"
    said: "diagnosed with a neuroendocrine cancer of the bladder"
    why: Only your records can settle this, whatever you said.

### nci-25 NCT00003838 — recommended

#### full: flagged true, asked 32, flags 12, excluded [P4,P5,P6,P7,P8,P9,P10,P11,P21,P25,P26]
- told P17: "MM: MM subjects must be between the ages of 8 and 65 (both inclusive)" — part: Group A
    said: "my diagnosis is peripheral T-cell lymphoma, NOS"
- told P20: "with a history of one of the following

* PNH associated with either life-threatening thrombosis, cytopenia, transfusion dependence or recurrent and debilitating hemolytic crisis.
* Aplastic anemia or PRCA (acquired or c" — part: Group B
    said: "my diagnosis is peripheral T-cell lymphoma, NOS"
- told P26 [EXCLUDED: rests on a flagged reply]: "Ability of donor or guardian of donor to comprehend the investigational nature of the study and provide informed consent." — part: Donor
    said: "Yes, I am able to understand the study details and provide informed consent myself."
- records P3: "CML chronic phase" — part: Group A
    said: "No, I have never been diagnosed with chronic myelogenous leukemia."
    why: Only your records can settle this, whatever you said.
- records P4 [EXCLUDED: rests on a flagged reply]: "Acute lymphoblastic leukemia (ALL), all subjects in complete or partial remission." — part: Group A
    said: "No, I have never been diagnosed with acute lymphoblastic leukemia."
    why: Only your records can settle this, whatever you said.
- records P5 [EXCLUDED: rests on a flagged reply]: "AML: AML in first complete or partial remission Exceptions: AML with good risk karyotypes: AML M3 t(15:17), AML M4Eo (inv. 16), AML t(8;21). All AML in second or subsequent complete remission." — part: Group A
    said: "No, I have never been diagnosed with acute myeloid leukemia."
    why: Only your records can settle this, whatever you said.
- records P6 [EXCLUDED: rests on a flagged reply]: "MDS: refractory anemia with excess blasts (RAEB), or chronic myelomonocyte leukemia (CMML)." — part: Group A
    said: "No, I have never been diagnosed with MDS or CMML."
    why: Only your records can settle this, whatever you said.
- records P7 [EXCLUDED: rests on a flagged reply]: "Myeloproliferative diseases associated with either cytopenia or uncontrolled proliferation." — part: Group A
    said: "No, I have never been diagnosed with a myeloproliferative disease."
    why: Only your records can settle this, whatever you said.
- records P8 [EXCLUDED: rests on a flagged reply]: "CLL or small lymphocytic lymphoma (SLL) with bulky or progressive disease despite prior treatment with chemotherapy which includes purine analogs." — part: Group A
    said: "No, I have never been diagnosed with CLL or SLL."
    why: Only your records can settle this, whatever you said.
- records P9 [EXCLUDED: rests on a flagged reply]: "NHL" — part: Group A
    said: "I have peripheral T-cell lymphoma."
    said: "No, I have never been diagnosed with non-Hodgkin lymphoma."
    why: Only your records can settle this, whatever you said.
- records P12: "C) Low grade follicular or small lymphocytic lymphoma (1) high risk patients who have relapsed following conventional chemotherapy, (2) relapsed following autologous marrow or PBSC transplant, or (3) chemo resistant dise" — part: Group A
    said: "my diagnosis is peripheral T-cell lymphoma, NOS, not follicular or small lymphocytic lymphoma"
    why: Only your records can settle this, whatever you said.
- records P13: "D) Mantle cell lymphoma" — part: Group A
    said: "my diagnosis is peripheral T-cell lymphoma, NOS, not follicular or small lymphocytic lymphoma"
    why: Only your records can settle this, whatever you said.
- records P14: "E) NHL intermediate or high grade with concurrent BCL2 and MYC translocations who are at high risk for relapsed and who have low survival with conventional chemotherapy." — part: Group A
    said: "my diagnosis is peripheral T-cell lymphoma, NOS"
    why: Only your records can settle this, whatever you said.
- records P15: "HD, relapsed after prior autologous transplant or after 2 or more combination chemotherapy regimens and ineligible for autologous PBSC transplant." — part: Group A
    said: "my diagnosis is peripheral T-cell lymphoma, NOS"
    why: Only your records can settle this, whatever you said.
- records P16: "EBV driven lymphoproliferative disorders progressing despite standard therapies." — part: Group A
    said: "my diagnosis is peripheral T-cell lymphoma, NOS"
    why: Only your records can settle this, whatever you said.
- records P18: "Mycosis fungoides, which has been shown to be amenable to allogeneic stem cell transplants." — part: Group A
    said: "my diagnosis is peripheral T-cell lymphoma, NOS"
    why: Only your records can settle this, whatever you said.

#### account: flagged true, asked 34, flags 25, excluded [P2,P4,P5,P6,P7,P8,P9,P10,P11,P20,P21,P24,P25,P26,P27,P30,P31,P32,P33,P34,P38,P40]
- told P17: "MM: MM subjects must be between the ages of 8 and 65 (both inclusive)" — part: Group A
    said: "I have peripheral T-cell lymphoma"
- records P12: "C) Low grade follicular or small lymphocytic lymphoma (1) high risk patients who have relapsed following conventional chemotherapy, (2) relapsed following autologous marrow or PBSC transplant, or (3) chemo resistant dise" — part: Group A
    said: "No, I don't have low grade follicular lymphoma or small lymphocytic lymphoma"
    why: Only your records can settle this, whatever you said.
- records P13: "D) Mantle cell lymphoma" — part: Group A
    said: "I have peripheral T-cell lymphoma"
    why: Only your records can settle this, whatever you said.
- records P14: "E) NHL intermediate or high grade with concurrent BCL2 and MYC translocations who are at high risk for relapsed and who have low survival with conventional chemotherapy." — part: Group A
    said: "I have peripheral T-cell lymphoma"
    why: Only your records can settle this, whatever you said.
- records P15: "HD, relapsed after prior autologous transplant or after 2 or more combination chemotherapy regimens and ineligible for autologous PBSC transplant." — part: Group A
    said: "I have peripheral T-cell lymphoma"
    why: Only your records can settle this, whatever you said.
- records P16: "EBV driven lymphoproliferative disorders progressing despite standard therapies." — part: Group A
    said: "I have peripheral T-cell lymphoma"
    why: Only your records can settle this, whatever you said.
- records P18: "Mycosis fungoides, which has been shown to be amenable to allogeneic stem cell transplants." — part: Group A
    said: "I have peripheral T-cell lymphoma"
    why: Only your records can settle this, whatever you said.

### nci-25 NCT03502733 — recommended

#### full: flagged true, asked 31, flags 7, excluded [P13,P14,P17,P18,P20,P23,P30]
- records P1: "Patients with histologically documented metastatic, recurrent, or locally unresectable solid tumors which have progressed after one line of therapy, or for which no curative therapy is available."
    said: "I have peripheral T-cell lymphoma, which is a blood cancer, not a solid tumor."
    why: Only your records can settle this, whatever you said.

#### account: flagged false, asked 29, flags 9, excluded [P1,P2,P14,P16,P19,P20,P23,P30,P35]
- records P1 [EXCLUDED: rests on a flagged reply]: "Patients with histologically documented metastatic, recurrent, or locally unresectable solid tumors which have progressed after one line of therapy, or for which no curative therapy is available."
    said: "I have peripheral T-cell lymphoma, which is a blood cancer, not a solid tumor."
    why: Only your records can settle this, whatever you said.

### nci-37 NCT00924027 — ineligible (reason: rule: "Pathologically confirmed malignancy for which high-dose rate brachytherapy is appropriate as a component of their therapeutic regimen.")
Clinician: "for which high-dose rate brachytherapy is appropriate as a component of their therapeutic regimen" => Hard for TrialGPT to know if brachy is (not) appropriate here, but should be've been picked up in either missing info or Rationale as a question

#### full: flagged true, asked 29, flags 10, excluded [P4,P8,P11,P12,P15,P17,P21,P26,P30,P32,P33], named rule-other
- told P5: "Participants of childbearing or child- fathering potential must be willing to use a medically acceptable form of birth control, which includes abstinence, while they are being treated on this study."
    said: "I am 65 years old, so I am not of childbearing potential"
- records P10: "Cervical cancer" — part: Gynecologic Cancers
    said: "No, I have not been diagnosed with cervical cancer."
    why: Only your records can settle this, whatever you said.
- records P11 [EXCLUDED: rests on a flagged reply]: "Participants who are unable to undergo surgery and must have treatment for an inoperable primary cervical cancer." — part: Gynecologic Cancers
    said: "I don't know if I am unable to undergo surgery for cervical cancer, because I don't have cervical cancer."
    why: Only your records can settle this, whatever you said.
- records P12 [EXCLUDED: rests on a flagged reply]: "Participants with locally advanced cervical cancer in whom brachytherapy will be integrated as a boost to external beam radiation either in a palliative or curative setting (definitive or post-operative setting)." — part: Gynecologic Cancers
    said: "because I don't have cervical cancer."
    why: Only your records can settle this, whatever you said.
- records P13: "Lung cancer" — part: Lung cancer
    said: "No, I have not been diagnosed with lung cancer."
    why: Only your records can settle this, whatever you said.
- records P16: "Breast cancer" — part: Breast cancer
    said: "No, I have not been diagnosed with breast cancer."
    why: Only your records can settle this, whatever you said.
- records P17 [EXCLUDED: rests on a flagged reply]: "Infiltrating ductal carcinoma or ductal carcinoma in-situ (DCIS), stage T0, T1, and T2 less than or equal to 3.0 cm, N0 and M0," — part: Breast cancer
    said: "No, I have not been diagnosed with breast cancer or any type of ductal carcinoma."
    why: Only your records can settle this, whatever you said.
- records P18: "Participants benefiting from high dose radiation (HDR) as either as a boost or accelerated partial breast irradiation regimen." — part: Breast cancer
    said: "No, I am not currently receiving high-dose radiation."
    why: Only your records can settle this, whatever you said.
- records P19: "Prostate Cancer" — part: Prostate Cancer
    said: "No, I have not been diagnosed with prostate cancer."
    why: Only your records can settle this, whatever you said.
- records P20: "-Participants with localized prostate cancer (T1b-T3b) in whom brachytherapy will be integrated as a boost to external beam radiation or used as monotherapy for definitive management." — part: Prostate Cancer
    said: "No, I have not been diagnosed with prostate cancer."
    why: Only your records can settle this, whatever you said.
- records P35: "distant metastases;" — part: Breast cancer
    said: "My scans show progression in the liver and lymph nodes"
    why: Only your records can settle this, whatever you said.
- records P37: "distant metastases" — part: Prostate cancer
    said: "My scans show progression in the liver and lymph nodes"
    why: Only your records can settle this, whatever you said.

#### account: flagged true, asked 29, flags 7, excluded [P16,P17,P19,P20,P21,P31,P32,P33,P34,P36], named rule-other
- told P5: "Participants of childbearing or child- fathering potential must be willing to use a medically acceptable form of birth control, which includes abstinence, while they are being treated on this study."
    said: "I am 65 years old, so I am not of childbearing potential"
- records P10: "Cervical cancer" — part: Gynecologic Cancers
    said: "No, I have endometrial cancer, not cervical cancer."
    why: Only your records can settle this, whatever you said.
- records P11: "Participants who are unable to undergo surgery and must have treatment for an inoperable primary cervical cancer." — part: Gynecologic Cancers
    said: "No, I do not have cervical cancer."
    why: Only your records can settle this, whatever you said.
- records P12: "Participants with locally advanced cervical cancer in whom brachytherapy will be integrated as a boost to external beam radiation either in a palliative or curative setting (definitive or post-operative setting)." — part: Gynecologic Cancers
    said: "No, I do not have cervical cancer."
    why: Only your records can settle this, whatever you said.
- records P13: "Lung cancer" — part: Lung cancer
    said: "No, I have never been diagnosed with lung cancer."
    why: Only your records can settle this, whatever you said.
- records P16 [EXCLUDED: rests on a flagged reply]: "Breast cancer" — part: Breast cancer
    said: "No, I have never been diagnosed with breast cancer."
    why: Only your records can settle this, whatever you said.
- records P17 [EXCLUDED: rests on a flagged reply]: "Infiltrating ductal carcinoma or ductal carcinoma in-situ (DCIS), stage T0, T1, and T2 less than or equal to 3.0 cm, N0 and M0," — part: Breast cancer
    said: "No, I have never been diagnosed with breast cancer."
    why: Only your records can settle this, whatever you said.
- records P18: "Participants benefiting from high dose radiation (HDR) as either as a boost or accelerated partial breast irradiation regimen." — part: Breast cancer
    said: "No, I am not currently receiving high-dose radiation."
    why: Only your records can settle this, whatever you said.
- records P19 [EXCLUDED: rests on a flagged reply]: "Prostate Cancer" — part: Prostate Cancer
    said: "No, I have never been diagnosed with prostate cancer."
    why: Only your records can settle this, whatever you said.
- records P20 [EXCLUDED: rests on a flagged reply]: "-Participants with localized prostate cancer (T1b-T3b) in whom brachytherapy will be integrated as a boost to external beam radiation or used as monotherapy for definitive management." — part: Prostate Cancer
    said: "No, I have never been diagnosed with prostate cancer."
    why: Only your records can settle this, whatever you said.
- records P35: "distant metastases;" — part: Breast cancer
    said: "My text mentions cancer in my liver and lymph nodes"
    why: Only your records can settle this, whatever you said.
- records P37: "distant metastases" — part: Prostate cancer
    said: "My text mentions cancer in my liver and lymph nodes"
    why: Only your records can settle this, whatever you said.
- records P38: "lymph node metastases" — part: Prostate cancer
    said: "cancer spread to my liver and lymph nodes"
    why: Only your records can settle this, whatever you said.

### nci-41 NCT02211755 — recommended

#### full: flagged true, asked 22, flags 4, excluded [P14,P20,P22]
- records P2: "histologically confirmed myelodysplastic syndrome that has progressed on standard therapy or for which no standard treatment options exist."
    said: "No, I have not been diagnosed with myelodysplastic syndrome"
    why: Only your records can settle this, whatever you said.

#### account: flagged false, asked 21, flags 11, excluded [P1,P2,P4,P5,P12,P13,P16,P17,P19,P20,P25,P26,P28]
