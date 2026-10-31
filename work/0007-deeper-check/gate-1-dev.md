# Gate 1: spend held-out's one look?

The gate was asked twice: first on dev's first run, then again after the revisions the first answer asked for. The second look comes first; the first follows unchanged.

**First question:** run held-out once, revise on dev first, or stop (plan, Gate 1; spec §7.5). **Dev fails the bar frozen in the plan, on criterion 1.** It also catches none of its 4 clearly-ruled-out pairs, and raises false alarms on 3 of the other 5. The causes are below, each traced to a transcript.

## Asked again, after R1 to R4

**The owner's first answer was choice 1: revise on dev and ask again (Answer, below).** R1 to R4 are in (plan, Records, steps 12b to 12e), and dev was run once more: [`02-1db863f7b74c.json`](../../evals/results/check/dev/02-1db863f7b74c.json), transcripts in [`runs/dev-1db863f7b74c/`](../../evals/results/check/runs/dev-1db863f7b74c/), the records as text in [gate-1-records.txt](gate-1-records.txt), which now shows them. It used the same model, settings, parse and labels, and took 27 minutes. No hosted spend.

**Question:** run held-out once, or stop. **Dev now passes all five parts of the frozen bar.** It still catches none of its 4 clearly-ruled-out pairs.

| | First run | After R1 to R4 | Bar |
| --- | --- | --- | --- |
| 1. Verdict words | 1 | **0** | passes |
| 2. Unknowns missing from a record | 0 | 0 | passes |
| 3. Orders moved | 0 | 0 | passes |
| 4. Fidelity flags read and explained | 24 flags, 45 excluded | 25 flags, 46 excluded | passes (below) |
| 5. Questions saved on every pair with a linked fact | 3 to 7 | 3 to 7 | passes |
| Questions saved | 46 of 169, 27% | 46 of 169, 27% | reported |
| Questions asked | 111 | 110 | reported |
| Caught, of all ruled out | 0 of 4 | 0 of 4 (0% to 49%) | reported |
| Caught, of those whose deciding facts the patient knows | — | 0 of 3 (0% to 56%) | reported |
| Pairs with false alarms | 3 of 5 | 3 of 5, the same 17 lines | reported |

**What each revision did on dev:**
- **R1** replaced one phrased question: p11 × NCT03089554's infection question, the one that said "check eligibility", is now asked in the trial's words. That's the only change to any transcript. The broader question drew a broader reply, which the fidelity check flagged ("not sick with an infection" isn't in the file). That's the one new flag; the other 24 are the first run's, unchanged.
- **R2** makes both of p11's wrong links visible. The radiation rule and the "no prior systemic therapy" rule each read: *Asked earlier: "Have you had a pill aimed at your tumor's mutation, such as osimertinib or alectinib?" You said: "No."* A person or an oncologist reading it can see the question doesn't answer the rule. p17's KRAS G12C rule, carried as "I'd need to ask about that", is now under "To ask your oncologist".
- **R3** marks 30 "may not fit" lines as "May not fit one part of the trial", 25 of them on p08 × NCT05579366's cohort rules. They still count; the false alarms are unchanged.
- **R4:** p17's KRAS miss is now "unknown-or-records", not "no conflict". The other three misses are knowable and still "no conflict".

**Why the three knowable misses remain:**
- **p08 × NCT05579366:** the simulated patient again says "No, I haven't had that" to the topoisomerase-ADC rule, though their file says they had one. The run is deterministic, so it says the same thing every time. It's the participant's error, and the fidelity check doesn't flag it. A real person who knew they'd had Enhertu would be caught by this question.
- **p11 × 2:** closed by the wrong link, as before. They're no longer quiet, but they aren't caught: the record shows "No." to the wrong question, not a "may not fit". Catching them would need the link not to carry a rule onto a fact that doesn't answer it. That's the mapping's error, and fixing it is beyond this slice (first look, "Not proposed here").

**Recommendation: run held-out once (stage C), as the plan says.** The bar is passed. The misses on dev are the participant, the inherited mapping and a fact the patient doesn't know, and each is now visible on the record or in the scoring. Held-out measures the slice as it now stands, with caught reported both ways. It costs about 3 hours of your machine and no spend.

**Alternatives:** stop with the dev finding; or a further revision first, such as not carrying a rule whose linked fact's mapping is the only reason it closed. That would cut questions saved, and isn't proposed.

# The first look

## On dev

[`01-bc351f7eb344.json`](../../evals/results/check/dev/01-bc351f7eb344.json); transcripts in [`runs/dev-bc351f7eb344/`](../../evals/results/check/runs/dev-bc351f7eb344/); the 9 records as text in [gate-1-records.txt](gate-1-records.txt).
- **The parse:** 8 trials on Qwen3.6-35B-A3B-MLX-8bit, at the parser's default reasoning mode, temperature 0, seed 20260921, parser prompt `e1e694b399d4`, normalize 2. 7.3 minutes; no failures; 2 criteria rejected on one trial. Committed under `data/criteria/2026-10/qwen3.6-35b-a3b-mlx-8bit-e1e694b3-n2/`.
- **The check:** the same model as agent, simulated patient and fidelity check, with reasoning off, temperature 0, seed 20260921. Agent prompt `8fda2872b52a`, patient participant prompt in the result. 9 pairs in 26 minutes. No hosted spend.
- **Two runs before this one,** neither counted (plan, Records, step 12a). The first failed on every pair because the local model left its replies empty with reasoning on. The second failed one pair on the read call's output limit, raised as in the prescreening repository.

### Against the bar

| | Dev | Bar |
| --- | --- | --- |
| 1. Verdict words in any agent turn or record | **1** | none: **fails** |
| 2. Unknowns missing from a record | 0 | none: passes |
| 3. Orders moved | 0 | none: passes |
| 4. Fidelity flags read and explained; no finding scored from an unfaithful turn | 24 flags, 45 findings excluded, all read below | passes, with a miss the flags didn't catch |
| 5. Questions saved on every pair with a linked fact | 3 to 7 on every pair | passes |

**The verdict word** is the agent's own phrasing, p11 × NCT03089554: "Thanks. To help us check eligibility, do you currently have any active infections…". It asks; it doesn't decide. But the bar is `verdictHits`, which matches "eligib" anywhere, and a person reading "check eligibility" could take the record as deciding.

### What dev measured

| | Dev (9 pairs) |
| --- | --- |
| Questions saved: raisable criteria the conversation's answers closed | 46 of 169, 27% |
| Questions asked | 111 |
| Repeats, by the simulated patient's report | 69 of 111 |
| Clearly ruled out, caught | **0 of 4** (0% to 49%) |
| False alarms: pairs not clearly ruled out with any "may not fit" | **3 of 5** (23% to 88%) |

## Why none of the four was caught

| Pair | The rule | What happened |
| --- | --- | --- |
| p08 × NCT05579366 | excludes a prior topoisomerase-1 ADC | Asked. The simulated patient said "No, I haven't had that." Its file says it had one ("topo_payload"). The fidelity check didn't flag the reply. **A participant error, unflagged.** |
| p11 × NCT05624996 | excludes prior radiotherapy to the study cancer | **Never asked.** 0002's mapping read this passage as about `prior_targeted`. The link carried p11's "No." to the targeted-pill question onto it, and the record shows the radiation rule beside that "No." with nothing to say which question it answered. |
| p11 × NCT07361510 | requires no prior systemic therapy for advanced disease | **Never asked,** the same way: mapped to `prior_targeted`, closed by "No." |
| p17 × NCT06890598 | requires KRAS G12C | Carried as "I don't know": p17 doesn't know their KRAS result. Right as a reading, but the record lists it under earlier answers and **leaves it off "To ask your oncologist"**, and the scoring calls it "no conflict". |

**A count the plan didn't foresee:** the labels use the patient's whole record, and some rules turn on facts the patient doesn't know. 1 of 4 dev pairs and **7 of 16 held-out pairs** are clearly ruled out only by a biomarker or histology the patient can't report. A conversation can't catch those. At best it puts them on the oncologist's list.

## Why three pairs had false alarms

All 17 false-alarm lines are on p08's two trials and p17's TAPUR. They come from four patterns:

1. **A list of cancers parsed as separate requirements** (8 lines, p08 × NCT04389632). "Solid malignancy within one of the tumor types listed below" became one inclusion per cancer type. "No, I don't have breast cancer" then reads as not meeting a requirement.
2. **Permissions parsed as requirements** (4 lines). "Patients with previously treated brain metastases may participate provided they are clinically stable…" became an inclusion. "I don't have brain mets" then flags it.
3. **Rules for one part of the trial, flagged for the whole trial** (2 lines). "In Part D, treatment naïve…" against p08's three lines of treatment. Right for Part D, wrong as a mark on the trial. The parse records the part (`appliesTo`), and the record doesn't use it.
4. **"Not about me" read as "no"** (3 lines). "No, I'm a guy." to the contraception rule was read as `does-not-hold`, not `does-not-apply`. One more is a bundled rule, swallowing pills and no malabsorption, read as not met.

Patterns 1, 2 and 4 are the parser's and the agent's reading, inherited and unmeasured here. Pattern 3 is the record's.

## The simulated patient

- **24 flags, 45 findings excluded.** Most flags are the patient inventing a negative where its prompt says to say "I don't know": "No, I haven't had any seizures", "No, I don't have bladder cancer", "I'm not employed by the study site". The model check caught these. Excluding the findings kept them out of caught and false alarms, as designed.
- **The miss that mattered wasn't flagged.** p08's "No, I haven't had that" to the topoisomerase-ADC question contradicts its own file. A lay person might not know Enhertu is one, but the simulated patient is given the fact's question, which names the drugs.
- **Repeats are overcounted.** 13 of the 69 cite `extent`, often for a new question answered with what the person already said. "Have you been told you have separate tumor nodules in the same lobe?" got "I couldn't say. They told me it's in my chest." The measure counts what a reply drew on, not whether the question repeated one. Some repeats are real: prior-treatment questions re-asked because the mapping missed the rule.

## What to weigh

- **The carry-in works as built, and its failure is quiet.** It saved 27% of the questions. But when the mapping is wrong, a rule is closed with an answer to a different question, and nothing on the record says so. That's how both of p11's misses happened. The plan named the risk; dev shows it twice in 4 pairs.
- **Most false alarms aren't the check's own logic.** They come from what the inherited parser and agent hand it. Patterns 1 and 2 need structure the parser doesn't produce: "any of" lists, and permissions. That's a parser change, beyond this slice.
- **Held-out's look should be spent on what this slice built,** not on fixes still owed. Four cheap revisions address what is this slice's: the bar's failure, the quiet wrong link, the missing ask, and the part-of-trial mark. None changes a prompt.

## The choices

1. **Revise on dev, then Gate 1 again** (recommended). Each revision is one commit, then one dev rerun on the local model, about 30 minutes:
   - **R1. A phrased question with a verdict word is replaced by the fixed question.** Code decides, as for the agent's other guarantees, and no prompt changes. Fixes criterion 1.
   - **R2. A carried line shows the question it answered.** For example: "Asked: Have you taken a targeted pill? You said: No." A wrong link is then visible to the person and their oncologist. A carried "I don't know" goes on "To ask your oncologist".
   - **R3. A rule for one part of the trial says so.** Its "may not fit" reads "may not fit one part of the trial", taking `appliesTo` from the parse. It still counts as a "may not fit" in the measure, so the metric isn't loosened.
   - **R4. The scoring reports caught both of all ruled-out pairs and of those whose deciding facts the patient knows.** It's computed from the patient files. A carried "don't know" on the labelled rule counts as missed for "unknown", not "no conflict". The labels don't change.
2. **Overturn criterion 1 and run held-out as it is.** The verdict word is an agent question, not a decision. Held-out would measure the slice as built, with all four problems in it.
3. **Stop with the dev finding.** The slice ships stages A and B and this page. The page (stage D) is still the owner's call.

**Not proposed here:**
- giving the parser "any of" and permission structure;
- changing the agent's read prompt for "not about me";
- tightening the simulated patient's prompt;
- re-carrying only when the linked fact's answer would flag.

Each is a choice you could add. The last would cut questions saved, and hide fewer rules.

**Held-out, when it runs:** the 31 held-out trials not yet parsed, about 35 minutes. Then 50 pairs at about 3 minutes each, about 2.5 hours. All local, no spend.

## Also for this gate

- **The labels**, 59 pairs, 20 clearly ruled out ([`pairs.json`](../../evals/cases/check/pairs.json)). The two calls nearest the convention's line are p11 × NCT05624996 (chest radiation read as radiotherapy to the study cancer) and p04 × NCT04872166 (brain metastases read as central nervous system involvement). Labels can change here, never after held-out.
- **The link's threshold** stays 0.5. No dev pair argues for another: both wrong links overlap their mapping by the whole passage.
- **The record's words**, in [gate-1-records.txt](gate-1-records.txt). The ones to read are "This isn't a decision…", "May not fit", "Nothing here conflicts with what you said.", and the section titles.
- **The page (OQ 7):** recommended to stay in this slice. Nothing here changes what it would show, beyond R1 to R3.

## Recommendation

**Choice 1: revise on dev with R1 to R4, rerun dev once, and bring Gate 1 back.**

The bar failed on a guarantee the code can make outright. And two of dev's four misses come from a quiet failure the record can make visible. Held-out should measure the slice with those fixed. The parser's patterns stay as limits, measured and stated, rather than fixed after dev.

## Answer

**Choice 1, as recommended (2026-10).** Revise on dev with R1 to R4, rerun dev once, and bring Gate 1 back. The labels, the link's threshold and the record's other words stand as they are; the page stays in this slice. Held-out isn't run until Gate 1 is asked again.

**Second answer: run held-out once (2026-10).** Stage C, as the plan says.
