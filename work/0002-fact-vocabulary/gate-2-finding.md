# Gate 2: what the dev runs found, and what to do next

**Question:** is the mapper good enough to run over all 1,129 candidates, and on which model? The plan asked this after a held-out score. It's asked here first, because every dev run missed the bar by a factor of eight or more. Spending held-out's one look on a prompt that can't pass would waste it. Held-out hasn't been scored.

## The four dev runs

Ten dev trials, 109 labelled mappings (108 for Haiku, which failed one trial). "Wrong" means a mapping that rules out an answer the trial accepts. It includes a whole-trial mapping for a rule the labels scope to part of the trial. The bar is at most 3% of mappings, and at most 2 trials with a wrong whole-trial mapping.

| Run | Model | Prompt | Mappings | Wrong | Whole-trial wrong, trials | Recall | Time or cost |
| --- | --- | --- | ---: | ---: | --- | ---: | --- |
| [01](../../evals/results/facts/01-5fea50034aea.json) | Qwen3.6-35B-A3B, 8-bit, local | original `5fea5003` | 107 | **32 (29.9%)** | 20, in 8 | 62.4% | 3.4 s per 1,000 characters |
| [02](../../evals/results/facts/02-5ecc777c8cf0.json) | the same | revision 1 `5ecc777c` | 108 | 40 (37.0%) | 28, in 8 | 57.8% | 3.5 s |
| [03](../../evals/results/facts/03-9fc7daa0b186.json) | the same | revision 2 `9fc7daa0` | 124 | 53 (42.7%) | 42, in 9 | 60.6% | 5.5 s |
| [04](../../evals/results/facts/04-5fea50034aea.json) | Claude Haiku 4.5 | original `5fea5003` | 79 | **19 (24.1%)** | 17, in 9 | 55.6% | $0.08 for 10 trials |

All runs were at temperature 0. The local model's seed is 20260921; the Claude API has no seed. Every run is committed under `data/facts/2026-10/`, and `npm run facts:eval -- --check` regrades the latest.

**What the revisions showed:** on the local model, each added instruction raised the error rate. Revision 1 spelled out the rules the dev errors broke. Revision 2 asked for a verdict on every answer. The model applied neither consistently, and both made it map more. Haiku with the original, shorter prompt made fewer errors, but still eight times the bar.

## Where the errors are

By fact, mappings and wrong rule-outs. Labelled counts are in the result files.

| Fact | Local run 01 | Haiku run 04 |
| --- | --- | --- |
| ecog | 9, **0 wrong** | 9, **0 wrong** |
| extent | 13, 1 wrong | 5, **0** |
| hepatitis_active | 8, **0** | 5, **0** |
| pregnant_or_breastfeeding | 7, **0** | 4, **0** |
| leptomeningeal | 4, 1 | 5, **0** |
| cardiac_recent | 2, **0** | 2, **0** |
| prior_adc | 4, 2 | 2, **0** |
| kras, steroids | 1 each, **0** | 1 each, **0** |
| brain_mets | 9, 4 | 7, 4 |
| ild | 4, 2 | 6, 3 |
| autoimmune_active | 4, 3 | 3, 2 |
| her2 | 4, 3 | 2, 2 |
| histology | 7, 5 | 1, 1 |
| other_cancer | 5, 3 | 6, 2 |
| hiv | 7, 3 | 6, 1 |
| measurable_disease | 8, 1 | 8, 2 |
| transplant | 5, 1 | 5, 1 |
| prior_pd1, lines_advanced | 5, 3 | 1, 1 |

By kind, for Haiku's 19:
- 7 mapped a fact that is near but not right, where the labels record a vocabulary gap. "Known active malignancy" ruled out "within 2 years", which also covers people treated and now free of disease. "Pneumonitis that required steroids" ruled out any past pneumonitis.
- 4 ruled out too many answers. "Symptomatic brain metastases" also ruled out untreated ones without symptoms; "second primary malignancy" ruled out every history.
- 3 read a permission as a rule. "Patients with treated brain metastases are eligible if…" became an exclusion.
- 5 others: a biopsy-able lesion read as measurable disease (twice), a tumor-type list read as histology, and two more.

These errors aren't noise around a working mapper. They are the rules whose meaning sits in a condition (a window, a symptom, a steroid requirement, an exception) that the fact's answers don't carry. They concentrate in a few facts.

## What it would cost to go on

| | Local Qwen3.6 | Haiku 4.5 |
| --- | --- | --- |
| Held-out, 30 trials | about 20 minutes, free | about $0.25 |
| All 1,129 candidates (5.1M characters) | about 5 hours at 3.4 s per 1,000 characters, free | about $7.84, or $3.92 batched (the batch path isn't wired yet) |

## Recommendation

**Change what a mapping is allowed to do, then score held-out once on Haiku.**

1. **Rule out only on trusted facts.** A mapping on these nine facts may rule a trial out: `ecog`, `extent`, `leptomeningeal`, `hepatitis_active`, `pregnant_or_breastfeeding`, `cardiac_recent`, `prior_adc`, `kras`, `steroids`. A mapping on any other fact is kept and shown with its quote as "may not fit; check with your oncologist", but the status function counts it as unknown. That extends "an unknown never excludes" to "an uncertain mapping never excludes".
   - The nine are every fact with no wrong rule-out in Haiku's dev run. On dev they account for 34 mappings, none wrong, and 34 of 62 labelled mappings found (55%).
   - They cover 176 of the 343 labelled mappings across all 40 trials (51%), in 39 of 40 trials.
   - **The list is chosen from dev, so its dev score is zero by construction.** Held-out is the test.
2. **Fix the list before held-out is scored,** in `data/facts/vocabulary.json` as a per-fact `trusted` flag, with a test that the status function never rules out on an untrusted fact.
3. **Score held-out once on Haiku** (owner's go-ahead for about $0.25 with `--spend`). Report wrong rule-outs for all facts, and for the trusted facts against the 3% and 2-trial bar.
4. **Then decide the long run with that number:** Haiku for about $8, or the local model for about 5 hours, which made 4 wrong rule-outs in 49 on the same trusted facts.

**Why not another prompt revision:** the plan allows one more, but three prompts on the local model got worse with each change, and nothing in the errors suggests wording will fix them. Most errors are rules whose condition the vocabulary can't express. That is a vocabulary limit, met here a second time after Gate 1.

**Why not a bigger model first:** Sonnet 5 would cost about twice Haiku's price, around $15 for the long run, and is untested here. The trusted-facts change makes the mapper safe on whatever model runs it, because untrusted facts can no longer drop a trial. A bigger model would mainly raise recall, which is cheaper to try in 0003 than to bet on now.

**What this means for the product:** with the trusted facts, the conversation can rule trials out on activity level, extent, leptomeningeal disease, hepatitis, pregnancy, recent heart events, prior ADC, KRAS and steroids. Brain metastases, pneumonitis, autoimmune disease, HER2, histology, other cancers and prior therapy become questions to take to the oncologist, with the trial's own words, rather than reasons to drop a trial. For a patient-facing tool that never wants to drop a trial wrongly, that's arguably the right line regardless.

## Answer (owner, 2026-10), after held-out

The owner took the recommendation: rule out only on the nine trusted facts, then score held-out once on Haiku. Held-out ([05](../../evals/results/facts/05-5fea50034aea.json); claude-haiku-4-5, temperature 0, no seed, prompt `5fea50034aea`, $0.20):

| | Mappings | Wrong rule-outs | Whole-trial wrong, in trials | Recall |
| --- | ---: | ---: | --- | ---: |
| All facts | 230 | 60 (26.1%; 95% interval 20.8%–32.1%) | 59, in 21 of 30 | 72.7% (170 of 234) |
| The 9 trusted facts | 95 | 19 (20.0%; 13.2%–29.1%) | 18, in 13 of 30 | 67.3% (76 of 113) |

**The trust list didn't hold up.** Its dev score of 0 of 34 was chosen, not measured, and held-out found 19 of 95 wrong.
- About five of the 19 are arguable grading artefacts: extent rules in trials for other cancers, which the labels leave to the search, and two staging readings.
- The rest are the same kinds as on dev, now on facts that looked safe: a steroid threshold given as 2 mg dexamethasone, "unable to stop steroids", "heart attack within 1 year", a pregnancy-only rule, and missed scopes ("ECOG 0-1 in 1a", KRAS in dose escalation).

What the mapper does well is find the rules: 73% of the labelled mappings, and 91% of its matched mappings exact.

### The decision

**No model mapping rules a trial out.** That holds on any fact, any model, and any profile. A mapping becomes:

- **a "may not fit" hint,** shown with the trial's own words, when the person's answer is among the answers it rules out. The person and their oncologist read it; nothing is dropped.
- **a reason to ask a question:** a fact the person hasn't answered, which many open trials depend on, is worth asking about.

The person's answers flag; the oncologist decides. This is "an unknown never excludes" taken one step further: the mapping itself counts as uncertain.

**What it means for the product:**
- The shortlist can't be narrowed by facts the model read. It is narrowed by the search (cancer type, age, sex, distance) and ordered with hints. A trial with several "may not fit" hints, each quoted, is still on the list.
- The intent's question, whether one answer can settle many trials, gets a qualified answer. One answer can **flag** many trials at once, and 0003 can choose questions by how many trials an answer would flag. It can't **settle** them.
- The wrong rule-out rate stops being a safety number. It becomes a hint-quality number: a wrong hint costs the person a question to their oncologist, not a trial.

The trust list (`data/facts/trusted.json`) and the code that reads it are removed in the next step. This record and result 05, which names the nine facts, stay.
