# The benchmark: other people's judgments

Every earlier number in this repository was measured against labels written here, by the same author who built what they measure. This part measures the search and the deeper check against judgments made elsewhere, by two public sources:
- **TREC Clinical Trials, 2021 and 2022.** NIST's assessors judged which trials suit each patient note.
- **NIH-TrialBench.** NIH clinicians labelled trials for patient vignettes: recommended, eligible but not recommended, or ineligible, often with a comment.

Built in slice 0008. The record is in [`work/0008-benchmark/`](../work/0008-benchmark/). The check's dev finding, with every pair's lines, is in [gate-2-dev.md](../work/0008-benchmark/gate-2-dev.md). Slice 0009 reran the check's dev pairs after a fix ([`work/0009-check-false-alarms/`](../work/0009-check-false-alarms/)).

```
npm run benchmark:import                        rebuild data/benchmark/ from the downloads; -- --record writes the manifest
npm run benchmark:search -- --trec|--trialbench score the search, once; -- --check reruns the latest
npm run benchmark:parse -- --set dev|heldout    parse the check's trials, on the local model
npm run benchmark:check -- --dev                check dev's pairs in both arms; -- --check [--dev] regrades
npm run benchmark:check -- --check --result <f> regrade a named result, not the latest
npm run benchmark:check -- --parts <f>          print a result's outside-parts measure, without writing
npm run benchmark:lines -- <f>                  every "may not fit" line on a result; --pair <p:NCT> [--record]
```

## In plain words

**On other cancers, the search keeps about three in four of the trials TREC's assessors judged relevant.** Pooled over nine notes, it keeps 1,290 of 1,669 (77.3%). That's lower than its 92.7% on its own NSCLC labels, but the two numbers measure different things. TREC judged every trial in its pool, including trials for a patient's other conditions: heart disease, an infection, reflux. A cancer search drops those by design. By note, it ranges from 40% (pancreatic, a note with heart and kidney disease) to 99% (one breast note).

**It keeps 26 of the 29 target trials NIH clinicians chose that are still recruiting, and all 29 with every purpose allowed.** The three it drops are one trial, registered as a device study. Among all the labelled trials in the snapshot, it drops 13 for good: basket trials that list several cancers, none matching the patient's words.

**The deeper check flags almost every trial.** On dev's 14 pairs, it raised a "may not fit" on 8 of 9 trials clinicians called eligible, and on 4 or 5 of the 5 they called ineligible. Its catches mostly come from the parts of a trial a person isn't in. The false alarms have four causes, all in the parser and the agent. Held-out was not run: it's kept for after those causes are worked on.

**Neither benchmark can measure the conversation.** TREC has no lung cancer notes, and NIH-TrialBench has two.

No number here came from a model except the check's. The check ran on one local model, Qwen3.6-35B-A3B in 8-bit, at temperature 0, seed 20260921, reasoning off. That model played the agent, the participant and the fidelity check.

## What each benchmark could test

| | TREC 2021/22 | NIH-TrialBench | Neither |
| --- | --- | --- | --- |
| Search: does it keep the trials judged to suit a patient? | yes, on 9 cancer notes and the 2021 corpus | yes, on 41 NCI vignettes and the 2026-10 snapshot | — |
| The deeper check: does it flag ineligible trials, and not eligible ones? | no | yes, on 70 pairs (14 dev, 56 held-out) | — |
| The conversation, the order and the short list for NSCLC | no lung cancer notes | two NSCLC vignettes | **yes** |

**TREC.**
- **The notes:** 9 of its 125 topics are cancer patients:
  - 2021: 1 glioma, 4 lymphoma, 11 thyroid, 15 pancreatic, 17 myeloma, 25 and 61 breast, 31 cervical;
  - 2022: 11 gastroesophageal.
- **The judgments:** 4,672 for those notes, over 4,297 trials from the 2021-04-27 corpus.
- **Relevant** means judged 1 or 2, "for the patient's condition"; 2 is "eligible".

**NIH-TrialBench.**
- **The labels:** 41 NCI vignettes, with 395 clinician labels over 106 trials: 274 recommended, 86 eligible but not recommended, 35 ineligible. Each vignette has a target trial, 13 distinct in all.
- **What the labelled trials are:** TrialGPT 2.0's top ten for each vignette, so they're trials a matcher already liked.

## Search recall, own labels and outside ones

| | Labeller | Disease | Registry | What counts | Kept |
| --- | --- | --- | --- | --- | --- |
| Own labels ([search.md](search.md)) | this repository, one author | NSCLC | 2026-10 snapshot, 300 random treatment trials | could the person take part, on disease alone | **76 of 82, 92.7%** (84.9–96.6%) |
| TREC, pooled | NIST assessors | 8 other cancers | 2021-04-27 corpus, the judged pool | judged 1 or 2 | **1,290 of 1,669, 77.3%** (75.2–79.2%) |
| TREC, judged eligible (2) | | | | | 745 of 888, 83.9% |
| NIH-TrialBench targets | NIH clinicians | 17 cancer types | 2026-10 snapshot, recruiting | the vignette's target trial | **26 of 29** with treatment, **29 of 29** with every purpose |
| NIH-TrialBench recommended | | | | labelled recommended | 58 of 73 with treatment, 65 of 73 with every purpose |

Each result names the checksum of every input, and `--check` reruns it.
- TREC: [`trec/01-80fcdb226e48.json`](../evals/results/benchmark/search/trec/01-80fcdb226e48.json).
- NIH-TrialBench: [`trialbench/01-4399149b1b7a.json`](../evals/results/benchmark/search/trialbench/01-4399149b1b7a.json).

There's no model in either run.

**The vocabularies.** Each benchmark cancer got a search vocabulary in `data/cancer-types/`, 20 in all. They were written before scoring and frozen at the slice's first gate. They're marked `measured: false`: this is their first and only measurement, so nothing was tuned on it.

### TREC, by note

| Note | Type | Relevant kept | Judged eligible kept | Judged not relevant, kept |
| --- | --- | --- | --- | --- |
| 2021-1 | glioma | 143 of 169, 84.6% (78.4–89.3%) | 45 of 47 | 31 of 238 |
| 2021-4 | lymphoma | 87 of 95, 91.6% (84.3–95.7%) | 43 of 44 | 107 of 415 |
| 2021-11 | thyroid | 104 of 126, 82.5% (75.0–88.2%) | 49 of 53 | 44 of 269 |
| 2021-15 | pancreatic | **104 of 260, 40.0%** (34.2–46.1%) | 54 of 143 | 17 of 293 |
| 2021-17 | myeloma | 244 of 251, 97.2% (94.4–98.6%) | 125 of 127 | 71 of 242 |
| 2021-25 | breast | 89 of 102, 87.3% (79.4–92.4%) | 74 of 74 | 285 of 411 |
| 2021-31 | cervical | 109 of 172, 63.4% (56.0–70.2%) | 38 of 45 | 153 of 293 |
| 2021-61 | breast | 188 of 190, 99.0% (96.2–99.7%) | 119 of 120 | 236 of 324 |
| 2022-11 | gastroesophageal | 222 of 304, 73.0% (67.8–77.7%) | 198 of 235 | 29 of 518 |

**What the misses are.** TREC judged each note against every trial in its pool, not only cancer trials. So many trials judged relevant are for the patient's other conditions:
- 2021-15's misses are mostly heart, kidney and infection trials (the patient has coronary disease and a fever);
- 2021-31's are HPV vaccine and screening trials;
- 2022-11's are dyspepsia and reflux trials.

The headline was frozen before scoring and isn't changed, but it mixes two things: missing a trial for the cancer, and dropping a trial for another condition. As a keyword screen, not a label, 115 of the 379 misses have a cancer word in their conditions or title, and 264 don't.

**Age and sex.** These drop 70 relevant trials across the nine notes.

### NIH-TrialBench

- **The search request:** each vignette's cancer type, age and sex, ZIP 20814 (the NIH Clinical Center), any distance, and the page's purpose (treatment).
- **The device study:** the 3 targets missed with treatment are one trial, NCT07067138, the target of nci-04, 05 and 06. It's an algorithm-guided treatment trial registered as `DEVICE_FEASIBILITY`, and the purpose filter drops it.
- **Why targets were kept:** 24 by name, 17 by rules, 6 by the generic terms (a trial can have more than one reason).
- **3 targets aren't in the snapshot,** which keeps recruiting trials only. Read by hand from the registry in 2026-10: NCT03476681 is active, not recruiting; NCT06865677 terminated; NCT07055477 suspended. They're the targets of 12 vignettes.
- **Labelled trials missed with every purpose:** all 13 are basket trials dropped at the cancer stage. NCT06041503 (rare genitourinary cancers, recommended for nci-13 and nci-19) matches neither `penile` nor `urethral`. NCT06041516 (neuroendocrine carcinomas) matches neither `bladder` for nci-17 nor `merkel-cell` for nci-40. Reported, not tuned.
- **Ineligible trials:** all 10 in the snapshot are kept. The search doesn't read eligibility, so that's expected.

## The check, own labels and clinicians'

| | Own labels ([check.md](check.md)), held-out | NIH-TrialBench, dev, full file | NIH-TrialBench, dev, account |
| --- | --- | --- | --- |
| Labeller | this repository, one author | NIH clinicians | NIH clinicians |
| Patients | 20 made-up NSCLC patients | NCI vignettes, 9 patients in dev | the same, as the patient would tell it |
| "Ruled out" means | a rule's plain words exclude the record | "ineligible", for any reason, often a trial for another purpose | the same |
| A reason given | always, a rule | 1 rule, 4 "another disease or purpose" in dev | the same |
| Caught | 5 of 16, 31% (14–56%) | 4 of 5 | 5 of 5 |
| False alarms | 27 of 34, 79% (63–90%) | **8 of 9** (57–98%) | **4 of 9** (19–73%) |

- **Result:** [`check/dev/01-5ed77c679dad.json`](../evals/results/benchmark/check/dev/01-5ed77c679dad.json), with every transcript under `runs/`. `-- --check --dev` regrades it row for row.
- **Two arms.** The full-file arm's participant answers from the vignette's clinical summary. The account arm's answers from a short account of the same patient, written to [`KNOWING.md`](../evals/cases/benchmark/KNOWING.md)'s rules for what a patient would know. The accounts are committed in [`evals/cases/benchmark/accounts/`](../evals/cases/benchmark/accounts/).
- **Pairs.** 35 ineligible pairs and 35 eligible ones were drawn from the labels. They were split by hash into 14 dev and 56 held-out.

**What dev shows.** Every line on every pair was read; they're in [gate-2-dev.md](../work/0008-benchmark/gate-2-dev.md).
- **Catching means little here.** A check that flags nearly every pair catches nearly every ineligible one.
- **Four of dev's five ineligible pairs are trials for another purpose:** an MRI study, a neuromuscular study, a procedure-tracking study. The check flagged them only on the parts of the trial the person isn't in, such as "Currently healthy" in a healthy-volunteer arm. No record says the trial isn't a cancer-treatment trial.
- **Leave out lines on one part of a trial, and one ineligible pair is caught in each arm,** on a contraception rule read the wrong way round.
- **The false alarms come from four causes:**
  1. lists of alternatives parsed as separate requirements ("solid tumors … or" and "myelodysplastic syndrome…" become two rules);
  2. parts of the trial the person isn't in;
  3. pregnancy, nursing and contraception rules read the wrong way round, as in slice 0007;
  4. conditional rules read as requirements.

  The first and fourth are the parser's, the third the agent's reading, and the second is how the record and the measure treat a trial's parts.
- **The one rule a clinician named,** for nci-37 ("…for which high-dose rate brachytherapy is appropriate…"), is on both arms' records under "Needs your records or your oncologist". That's where the clinician said it belonged. The measure credits only a "may not fit" line on it, so it isn't scored as caught.
- **The account arm's fewer false alarms are half an artefact.** Two of the four pairs it doesn't flag lose their only line because that line rests on a reply the fidelity checks flagged. The account arm has nearly twice the flagged replies (198 to 107), mostly harmless ones where the participant quotes its own words.

**Slice 0009 fixed the agent's side of causes 3 and 4, and reran dev from the full summary.** The account arm wasn't rerun. Result: [`check/dev/02-17a5dbee2eb0.json`](../evals/results/benchmark/check/dev/02-17a5dbee2eb0.json); every line is read in [gate-2-dev.md](../work/0009-check-false-alarms/gate-2-dev.md). Beside 0008's measure, every new result also scores **outside parts**: a pair counts only for a "may not fit" line on a rule that isn't for one part of the trial.

| Dev, full summary | 0008 | 0009 | 0008, outside parts | 0009, outside parts |
| --- | --- | --- | --- | --- |
| ineligible caught | 4 of 5 | 5 of 5 | 1 of 5 | 1 of 5 |
| false alarms | 8 of 9 | 7 of 9 | 5 of 9 | 5 of 9 |
| the named rule on the record | — | — | 1 of 1 | 1 of 1 |

- Four of the six pregnancy and conditional lines are gone. The other two are a permission restated as a requirement and a contraception rule the parser joined to who it's for.
- Outside parts, the same five eligible pairs are flagged. Each kept another line: two "or" lists, the trial's own "solid tumors", and two new lines on questions answered "I don't know" in 0008.
- "Caught" rises to 5 of 5 on 0008's measure only because the prostate MRI study's rules are now read "does-not-hold" for a woman, on a part of the trial.

**Slice 0010 didn't rerun dev.** It tried a parser change for "or" lists and stopped before any check, because the change made other trials' parses worse ([check.md](check.md#what-slice-0010-tried)).

**Held-out is unread.** It was estimated at about 42 hours in both arms. At 0008's second gate the owner chose not to spend its one look on a check whose false alarms have known causes. At 0009's, with the rate unchanged on dev, the owner kept it for a fix that can move the rate. Slice 0010's fix never reached a check. Held-out's 30 trials aren't parsed, and its 56 pairs (30 ineligible, 17 with a named rule) are untouched.

## The three-way comparison

**What slice 0003 compared.** Slice 0003 ([questions.md](questions.md)) compared three short lists for made-up NSCLC patients:
- one from the conversation;
- one from what the patient knows;
- one from the full record.

All three were scored by the mapper's hints, so they agree with the mapper, not with the truth.

**Why the benchmarks can't measure it.** Measuring it against outside labels needs NSCLC patients labelled against this snapshot. TREC has no lung cancer notes. NIH-TrialBench has two NSCLC vignettes, and the facts and questions exist only for NSCLC.

**What would.** Clinician-labelled NSCLC patients, judged against the snapshot, with knowledge profiles. Alternatively, facts for one of the benchmark cancers, which would let the conversation run on them. Neither is built.

**The mark.** TREC doesn't settle slice 0005's mark either. Its notes aren't NSCLC, so it can't say which trials for other cancers an NSCLC search keeps.

## TrialGPT 2.0, as context

NIH-TrialBench comes from the TrialGPT 2.0 paper. Its reported figures are a target-trial Recall@10 of 70%, macro-averaged across institutes, and a hit rate of 0.95 at 10. They don't compare with anything here:
- **TrialGPT 2.0** ranks 1,373 trials from the full note.
- **The finder** keeps or drops trials by structure, then checks the few a person picks.

## Worked examples: the two NSCLC vignettes

nci-11 (59, male) and nci-38 (45, male) are NSCLC, so they're searched with the measured `nsclc.json`. No rate is drawn from two.

- **nci-11:**
  - **The target:** NCT05483491 is kept, by name and by rules.
  - **The labelled trials:** of 10, 2 are in the snapshot, NCT02133196 and the target, both recommended and both kept. The other 8 aren't recruiting.
- **nci-38:**
  - **The target:** NCT03476681 isn't in the snapshot (active, not recruiting).
  - **The labelled trials:** of 10, 3 are in the snapshot and all 3 are kept: NCT02133196 and NCT05687136, recommended, and NCT03816345, ineligible.

Both vignettes' check pairs are in held-out, so they have no records here.

## Getting the data

Nothing in the repository fetches the benchmarks, so no new host enters the network rules. A person downloads them into `local/benchmark/`, which is gitignored:

| Into | From | Size |
| --- | --- | --- |
| `local/benchmark/trec/topics2021.xml`, `topics2022.xml`, `qrels2021.txt`, `qrels2022.txt` | `trec.nist.gov/data/trials/` | about 1.4 MB |
| `local/benchmark/trec/corpus/` | the five `ClinicalTrials.2021-04-27.partN.zip` files from `trec-cds.org/2021_data/`, unzipped | 1.8 GB zipped |
| `local/benchmark/trialbench/raw/`, `trials/` | `github.com/TrialGPT2/TrialGPT2.0`, `data/nih_trialbench/`, at commit `1c5f9ebc3b98` | about 13 MB |

**After downloading:**
- `npm run benchmark:import` checks every file against the sha256s in [`data/benchmark/sources.json`](../data/benchmark/sources.json), and rebuilds `data/benchmark/` from them.
- The rebuilt files are committed, trimmed to the fields in use, so the scoring and the tests need no download.
- `-- --pairs` redraws the check's pairs.

## Limits

- **The search measures aren't like for like with slice 0001.** The differences are the disease, the labeller, the registry year and the pool that was judged. TREC's headline also counts trials for other conditions as misses.
- **The 20 new vocabularies are search-only.** Each was measured once, here, on a few notes or vignettes at most. They aren't measured the way `nsclc.json` was.
- **NIH-TrialBench's labelled trials were a matcher's top ten,** so they're trials that already looked plausible. Most aren't recruiting: 101 of the 395 labels are on trials in the snapshot.
- **The check was measured on dev only:** 14 pairs, one model. The intervals span most of the range. Slice 0009's rerun is from the full summary only.
- **"Ineligible" isn't what the check looks for.** Most of dev's ineligible pairs are trials for another purpose. The check reads rules, not purpose, and the record has no line for purpose.
- **The participant is a model,** answering from a summary or an account. About a quarter of its replies were flagged (305 of 1,155), mostly harmlessly. Findings resting on a flagged reply aren't counted, and that pulls caught and false alarms both down. Five flagged replies were real errors, all set aside.
- **The accounts were written here,** to rules written here. No patient or clinician wrote or checked them.
- **TREC states no licence** on `trec.nist.gov` or `trec-cds.org`. Only the fields in use are committed, with the sources' checksums.

## Sources and citations

- **TREC 2021 and 2022 Clinical Trials Track,** National Institute of Standards and Technology: https://trec.nist.gov/data/trials2021.html and https://trec.nist.gov/data/trials2022.html. Document collection from https://www.trec-cds.org/2021.html.
- **NIH-TrialBench:** Fang Y, Jin Q, et al. *Towards AI-Assisted Clinical Trial Matching: Practical Considerations, Multicenter Evaluation, and Real-World Deployment.* arXiv:2609.01202 (TrialGPT 2.0). Public domain: the National Library of Medicine's notice in `LICENSE` at the pinned commit calls it "a United States Government Work" with no restriction on its use or reproduction.
