# spec: 0008 benchmark

**Status:** Draft
**Date:** 2026-10
**Intent:** [intent.md](intent.md). Open questions are cited as OQ n.

This spec says:
- how the two benchmarks' files reach the repository, and what's kept;
- how TREC's 2021 trials become trials the search can read;
- which cancers get a vocabulary, and how each is written;
- how the search is scored on TREC and on NIH-TrialBench;
- how the deeper check is scored against clinicians' labels, in two arms;
- what the write-up claims;
- where the gates fall.

Each answer to an open question is a proposal, and says where a gate can overturn it.

---

## 1. What exists at the end

1. **`data/benchmark/`:** TREC's nine cancer notes, their judgments and their judged trials, and NIH-TrialBench's 41 NCI vignettes, their labels and their trials. Each part comes with the sources and checksums it was read from (§2).
2. **Twenty new files in `data/cancer-types/`,** each `measured: false` (§4).
3. **Two search results, no model,** each scored once: TREC (§5) and NIH-TrialBench (§6).
4. **A check result against clinicians' labels,** on the local model, in two arms: dev, then held-out once after Gate 2 (§7).
5. **`docs/benchmark.md`,** the comparison write-up (§8).

Nothing on the page changes.

## 2. The files (OQ 1)

### 2.1 What a person downloads

Into `local/benchmark/`, which is gitignored because `local/` is. The steps are in `docs/benchmark.md`:

| Into | From | Size |
| --- | --- | --- |
| `local/benchmark/trec/topics2021.xml`, `topics2022.xml`, `qrels2021.txt`, `qrels2022.txt` | `trec.nist.gov/data/trials/` | about 1.4 MB |
| `local/benchmark/trec/corpus/` | the five `ClinicalTrials.2021-04-27.partN.zip` files from `trec-cds.org/2021_data/`, unzipped | 1.8 GB zipped |
| `local/benchmark/trialbench/raw/`, `trials/` | `github.com/TrialGPT2/TrialGPT2.0`, `data/nih_trialbench/`, at commit `1c5f9ebc3b98` | about 13 MB |

**No script fetches them,** so no new host enters the network exceptions (§9).

### 2.2 The manifest

`data/benchmark/sources.json` names:
- each downloaded input: its path under `local/benchmark/`, its source URL, and its sha256, recorded when the import first ran;
- NIH-TrialBench's commit;
- each source's license as stated: NLM's public-domain notice for NIH-TrialBench, and "none stated" for TREC;
- the citation each source asks for.

The import refuses any input whose checksum differs, saying which.

### 2.3 What's committed

Written by `npm run benchmark:import`, deterministic, from the downloads alone:

**`data/benchmark/trec/`**
- **`topics.json`:** the nine notes (§3.1), each with year, number and text verbatim.
- **`qrels.json`:** the 4,672 judgments of those nine notes, as `{ topic, nctId, judgment }`.
- **`trials.jsonl.gz`:** the 4,297 judged trials, as `SnapshotTrial`s (§3.3).

**`data/benchmark/trialbench/`**
- **`vignettes.json`:** the 41 NCI vignettes: `patient_id`, `ic`, `target_trial_id` and `patient_summary` verbatim.
- **`labels.json`:** the 395 NCI clinician labels, each with its comment.
- **`trials.jsonl.gz`:** the 106 trials those labels name, as the release gives them. All 13 targets are among them. Each keeps NCT ID, title, conditions, phases, minimum and maximum age, sex and raw criteria.

Only NCI's rows are kept, since NCI is the oncology share. The other 85 vignettes are counted in `docs/benchmark.md` and not committed.

**Written by hand, beside them:** `trec/profiles.json` (§3.2) and `trialbench/profiles.json` (§4.2). They're kept apart so the import stays a pure function of the downloads.

## 3. TREC (OQ 2)

### 3.1 The nine notes

Read from the notes, one cancer each:

| Year | Topic | Cancer | Type id (§4) |
| --- | --- | --- | --- |
| 2021 | 1 | anaplastic astrocytoma of the spine | `glioma` |
| 2021 | 4 | Burkitt's lymphoma | `lymphoma` |
| 2021 | 11 | metastatic papillary thyroid cancer | `thyroid` |
| 2021 | 15 | pancreatic adenocarcinoma | `pancreatic` |
| 2021 | 17 | multiple myeloma | `myeloma` |
| 2021 | 25 | breast cancer, after lumpectomy | `breast` |
| 2021 | 31 | cervical cancer, stage 1B | `cervical` |
| 2021 | 61 | breast cancer | `breast` |
| 2022 | 11 | gastric adenocarcinoma, diffuse type | `gastroesophageal` |

**Not counted:** 2021's 13 (a lymphoma treated in 2003, admitted for urosepsis), and 20 and 56 (a pituitary adenoma with acromegaly). The owner can add or drop a note at Gate 1. This list is the only place the count is set.

### 3.2 A note's profile

Each note's age and sex, as it states them, and its type id. They're written by hand into `trec/profiles.json` before anything is scored. No ZIP is given: distance isn't scored (§3.4).

### 3.3 The 2021 text, read from the corpus

The judgments were made on the 2021-04-27 registry text, so that's the text searched. The corpus is ClinicalTrials.gov's legacy XML, one file per trial.

**`src/benchmark/` isn't created.** The extractor is `evals/benchmark/trec-xml.ts`, a pure function from one file's XML to a `SnapshotTrial`. It reads:

| `SnapshotTrial` | Legacy XML |
| --- | --- |
| `nctId` | `id_info/nct_id` |
| `briefTitle`, `officialTitle` | `brief_title`, `official_title` |
| `overallStatus` | `overall_status` |
| `phases` | `phase`, split on "/" |
| `primaryPurpose` | `study_design_info/primary_purpose`, upper-cased with `_` for spaces |
| `conditions`, `keywords` | every `condition`, every `keyword` |
| `conditionMesh` | every `condition_browse/mesh_term` |
| `conditionAncestors` | empty: the legacy XML has none, and the search doesn't read them |
| `interventions` | `intervention/intervention_type`, `intervention_name` |
| `leadSponsor` | `sponsors/lead_sponsor/agency` |
| `lastUpdatePostDate` | `last_update_posted` |
| `completionDate` | `completion_date` |
| `eligibility` | `criteria/textblock` verbatim, `gender`, `minimum_age`, `maximum_age`, `healthy_volunteers` |
| `sites` | empty: distance isn't scored |

- **No new dependency.** The XML is regular and machine-written: a small tag reader with entity decoding covers these fields.
- **A trial that can't be read** fails the import, with its ID and the field. If more than a handful fail, the plan reconsiders a parser dependency at that step, recorded in Records.
- **Unit tests** use three trimmed corpus files committed as fixtures under `tests/benchmark/fixtures/`.

### 3.4 What the search runs

- **The stages it runs:** purpose with `"all"` (TREC judged trials of every purpose), the cancer stage on the note's type, and age and sex on its profile.
- **What doesn't apply to 2021 trials:** distance and status. The record flags (stale, past completion) are computed against 2021-04-27, but they don't drop a trial and aren't scored.
- **The code:** `searchTrials` runs these stages, then distance. This slice moves the first three into an exported `personStages(trials, vocabulary, request)` in `src/search/search.ts`, which `searchTrials` calls. The behavior is unchanged, and `search:eval -- --check`, `other:eval -- --check` (bar its known difference) and `questions:eval -- --check` prove it.

### 3.5 What's scored

For each note, and pooled over the nine:

| Measure | Definition |
| --- | --- |
| **Kept, eligible or excluded** | Of trials judged 1 or 2, those that pass the three stages. **The headline:** both judgments mean the trial is for the patient's condition, and 0001's labels asked the same question, on disease alone |
| **Kept, eligible** | Of trials judged 2 |
| **Kept, judged not relevant** | Of trials judged 0. Not a precision: a 0 can be a trial for the right cancer that doesn't suit this note's patient |
| **By reason** | Names, rules, generic, among kept trials judged 1 or 2 |
| **Dropped at age and sex** | Trials judged 1 or 2 that the cancer stage kept and age or sex dropped. Each is listed: a structured limit that excludes a judged-eligible patient is worth seeing |
| **Every miss** | Trial, judgment, title, conditions. The list is short enough to read |

- **The intervals:** Wilson 95% (`evals/search/metrics.ts`'s `wilson`). The headline is also given per type, with its count.
- **Recall is of the judged pool.** TREC judged the trials participants' systems retrieved, not every trial. `docs/benchmark.md` says so.
- **No bar.** Nothing is tuned on this result, so a bar would only label it.
- **Scored once** by `npm run benchmark:search -- --trec`, which refuses once a TREC result exists. `-- --trec --check` reruns the latest and fails on any difference.
- **The result names:** the corpus manifest's checksums, the topics', judgments' and trials' files' checksums, and each vocabulary's `sha256`. No model, so no model, quantization, temperature or seed applies.

## 4. Vocabularies for other cancers (OQ 3)

### 4.1 Which, and for whom

Twenty new files in `data/cancer-types/`, each with `measured: false`:

| Type id | TREC notes | NIH-TrialBench NCI vignettes |
| --- | --- | --- |
| `anal` | | 09 |
| `bladder` | | 14, 16, 17, 18, 22, 23 |
| `breast` | 2021-25, 2021-61 | 04, 05, 06 |
| `cervical` | 2021-31 | 01, 02, 07, 12 |
| `cutaneous-squamous` | | 39 |
| `endometrial` | | 03, 37 |
| `gastroesophageal` | 2022-11 | 10 |
| `germ-cell` | | 24 |
| `glioma` | 2021-1 | |
| `head-and-neck` | | 08, 36 |
| `kidney` | | 15 |
| `lymphoma` | 2021-4 | 25–33 |
| `melanoma` | | 41 |
| `merkel-cell` | | 40 |
| `myeloma` | 2021-17 | |
| `pancreatic` | 2021-15 | |
| `penile` | | 13 |
| `prostate` | | 34, 35 |
| `thyroid` | 2021-11 | |
| `urethral` | | 19, 20, 21 |

NCI 11 and 38 are NSCLC and use the existing `nsclc.json`.

**Mappings the owner should check:**
- **Urachal adenocarcinoma** (14, 23) goes to `bladder`. The urachus is a remnant above the bladder, and the registry usually lists these trials under bladder or "rare genitourinary".
- **Small-cell and squamous cancers of the bladder** (16, 17, 18, 22) go to `bladder` too.
- **SMARCB1-deficient renal medullary carcinoma** (15) goes to `kidney`.
- **NCI 19** has a remote prostate cancer, and a current clear cell adenocarcinoma of the urethra. It goes to `urethral`.
- **`lymphoma`** covers Hodgkin and non-Hodgkin, B- and T-cell, so one file serves Burkitt's, the T-cell lymphomas and the DLBCLs.

### 4.2 How each is written

- **Written before any judged trial or label is read.** The writer works from the cancer's common names, its MeSH heading and entry terms, and the typical biomarkers named in its MeSH scope or in common use, in the shape `nsclc.json` has.
- **Its parts:**
  - `names`, matched in conditions, keywords, titles and eligibility text;
  - `meshHeadings`, matched exactly;
  - `biomarkerNames`, matched in conditions and keywords. A biomarker shared with many cancers (HER2, BRCA, PD-L1) is left out unless it's characteristic of this one, as `nsclc.json` names EGFR and ALK but not PD-L1.
- **One commit for all twenty,** before `benchmark:search` exists. `git log` shows the files predate every result.
- **Each NIH-TrialBench vignette's profile** (age, sex, type id) is written into `trialbench/profiles.json` in the same commit, read from its text.
- **`measured` stays false.** A benchmark's one to nine patients per type isn't a held-out sample of the snapshot, which is what `measured` means (`src/search/vocabulary.ts`). `docs/benchmark.md` gives each type's counts.
- **Search-only.** These types have no facts and no others-file, so the mark doesn't run for them, and the page and the conversation don't offer them. `npm run search -- --cancer breast` works and prints that the type is unmeasured, a line `scripts/search.ts` already prints for `measured: false`.

## 5. The search on TREC

As §3.4 and §3.5. The convention, judgments 1 and 2 counted as "for the patient's condition", is written into `data/benchmark/trec/README.md` before scoring.

## 6. The search on NIH-TrialBench

### 6.1 What runs

For each of the 41 NCI vignettes, `searchTrials` runs over the 2026-10 snapshot, with:
- the vignette's type, age and sex;
- ZIP 20814 (Bethesda, where the NIH Clinical Center is), anywhere in the US;
- `--purpose` as the page uses it (treatment), and again with `"all"`.

The NSCLC vignettes also get 0005's mark, as the page would.

### 6.2 What's scored

| Measure | Definition |
| --- | --- |
| **Target kept** | Of the 29 vignettes whose target is in the snapshot, those whose search keeps it. **The headline.** Each miss is listed with its stage and the target's conditions |
| **Targets not in the snapshot** | The 3 of 13, each with why: its registry status or study type in 2026-10, read from today's registry entry by a person, and written in the result's notes |
| **Labelled trials kept, by label** | Of the 101 NCI pairs on trials in the snapshot: recommended (73), eligible but not recommended (18), ineligible (10) |
| **By reason** | For the targets kept: names, rules, generic. Many targets are baskets, so the generic route matters |

- **Scored once** by `npm run benchmark:search -- --trialbench`, refused once a result exists. `--check` reruns the latest and fails on any difference.
- **The result names:** the snapshot's sha256, the vignettes' and labels' checksums, and every vocabulary's `sha256`.

### 6.3 The two NSCLC vignettes

NCI 11 and 38 are shown in `docs/benchmark.md` as worked examples. It gives their search, whether their target and labelled trials survive it, and, where their pairs are in the check's sample, their records. No rate is drawn from two.

They aren't run through the conversation. That would need their 31 facts and a knowledge profile written here, from two cases.

## 7. The check against clinicians (OQ 4, OQ 5, OQ 6)

### 7.1 The pairs

- **The ineligible pairs:** all 35 NCI pairs labelled `ineligible`.
- **The eligible pairs:** 35 of the 360 others, by `sha256("0008:" + patient + ":" + nctId)`, lowest first, within each label. That's 27 recommended and 8 eligible but not recommended, the 274 : 86 proportion rounded. "Eligible but not recommended" counts as eligible (OQ 5).
- **Dev and held-out by vignette:** a vignette is dev when `sha256("0008-split:" + patient)`'s first byte is below 0x55, about one in three. All of its pairs go with it.
- **The counts, computed while writing this spec:** 70 pairs over 42 trials and 35 vignettes. Dev is 14 pairs over 12 trials and 8 vignettes, 5 of them ineligible. Held-out is 56 pairs, 30 of them ineligible. The plan's step confirms them from the committed files. A cut at one in five gave dev 3 ineligible pairs, too few to see the check work.
- **No vignette is in both.** Trials are shared across the split, and so are their parses, as in 0007.
- **A trial whose criteria the parser can't read** stays in the result as `parse: "failed"`, counted in neither rate, and listed.

### 7.2 The trials and their parses

- **Each trial's criteria text is the release's `raw_criteria`,** the text the clinicians read. Title, conditions and phases come from the release too. That's a `ParseableTrial`, which is all the parser takes.
- **Parsed once on the local model**, at the parser's defaults, as 0007's step 13 ran it, through `parseWithCache`. The run is `data/criteria/trialbench/<run>/`, with `data/criteria/trialbench/latest` naming it. These trials aren't the 2026-10 snapshot's, so they don't go under its month, and 0007's `latest` is untouched. `latestCriteriaRun("trialbench")` reads it with no code change.
- **Run by** `npm run benchmark:parse -- --set dev|heldout`. It's resumable. `--model <spec>` is dry without `--spend`.

### 7.3 Two arms (OQ 4)

| Arm | The participant answers from |
| --- | --- |
| **From the full file** | the vignette's `patient_summary`, verbatim. Research §6's "full record" |
| **From what they'd know** | the vignette's **account**: the same summary with what a patient often doesn't know taken out, by `KNOWING.md` |

**`evals/cases/benchmark/KNOWING.md`, the convention.** An account keeps:
- the cancer, in the words a patient would use;
- where it has spread;
- each treatment by name or kind, roughly when, and how it ended (stopped working, side effects, finished);
- surgery and radiation;
- other conditions a person would know they have;
- day-to-day activity.

It drops:
- biomarker, genomic and receptor results, including whether a test was done;
- lab values;
- scan and pathology detail, and staging codes;
- exact dates (a month and year becomes "about a year ago", relative to the vignette's latest date);
- doses and cycle counts.

The account is written as a short first-person passage, in plain words, from the summary alone.

**How the accounts are made:**
- **Written once, for every vignette in the check's pairs, before any check runs.** Each goes into `evals/cases/benchmark/accounts/<patient>.md`, beside a link to its summary.
- **A second derivation by a separate agent,** working from `KNOWING.md` and the summaries alone, for 8 vignettes drawn by hash. Each item kept or dropped (a treatment, a site, a result) is compared, and the disagreements are listed for Gate 1. Nothing is reconciled before the gate.
- **The account is never shown to the agent.** It's the participant's knowledge.

### 7.4 The participant

`evals/participant/summary.ts`, the local model answering a check's questions as the person described by one text.
- **Given:** the text (summary or account), a persona line, and the transcript's text. Never the session's state, the trial's labels or the arm's name. A type test enforces it, as 0007's patient participant does.
- **Told:** answer the question asked from the text alone. What it doesn't say, you don't know, and you say so in plain words.
- **Returns:** the reply, and the sentence or sentences of the text it drew on (`quotes`). An empty list means "I don't know".
- **Fidelity:**
  - deterministic: every quote must be in the text, by `includes`. A reply asserting something with no quote, over `UNCITED_LENGTH`, is flagged;
  - and the existing local-model fidelity read, adapted to a text rather than a fact list. It's a flag for the gate, never a score.

  A finding resting on a flagged turn is excluded from scoring and counted, as `evals/check/` does.

### 7.5 What a catch is (OQ 5)

- **Flagged:** a pair whose record holds at least one "may not fit" line, `MAY_NOT_FIT` or `MAY_NOT_FIT_PART`. This is the record the person would carry, so a flag on one part of a trial counts.
- **Caught:** a flagged ineligible pair. **False alarm:** a flagged eligible pair.
- **Caught for the named rule:** where a clinician's comment on an ineligible pair names a rule, a person writes that rule's quote from the trial's text into `evals/cases/benchmark/reasons.json`, before any parse or check. A catch counts here when a "may not fit" line's criterion overlaps the quote under 0007's link threshold (`LINK_THRESHOLD`, 0.5). Pairs with no comment, or a comment naming no rule, are counted as "no reason given".
- **The comments are read for this alone.** A comment saying the trial suits another disease (as nci-01 × NCT01900132's does) is recorded as `kind: "disease"`, with no quote. The check isn't expected to catch those through a rule, and they're reported apart.

### 7.6 The run

`npm run benchmark:check -- --dev`, then held-out once with no flag, refused once a held-out result exists. For each pair and each arm:
1. the committed parse;
2. `startCheck` with no facts and no answers, the inherited path;
3. the participant on that arm's text, until the agent closes or 0007's `MAX_TURNS` is reached;
4. the record.

- **The same settings as 0007's held-out:** the local model, reasoning off for the agent, participant and fidelity read, `READ_MAX_OUTPUT_TOKENS` 4,096, and `CHECK_REVISION` 2.
- **Transcripts are committed** under `evals/results/benchmark/check/runs/<set>-<hash>/`. A rerun skips pairs already written, and `-- --check` regrades the latest result from them, with no model.
- **The run's hash covers:** the pairs, the accounts, the reasons, the parse run, both prompts' versions, the model and `CHECK_REVISION`.

### 7.7 What's reported

Per arm, per set, with Wilson 95% intervals:

| Measure | Definition |
| --- | --- |
| **Ineligible caught** | Of ineligible pairs with a parse, those flagged. Also split: rule named and caught for it; rule named and caught otherwise; disease comment; no reason given |
| **False alarms** | Of eligible pairs with a parse, those flagged. Split recommended and eligible-but-not-recommended. Each lists its "may not fit" lines' kinds, as `docs/check.md` counts 0007's: one part of the trial, needs records, asked |
| **Between the arms** | On the same pairs: caught in both, in the full file only, in the account only, and the same for false alarms |
| **Questions asked** | Per pair and in total, per arm |
| **Never a verdict** | `verdictHits` on every agent turn and every record string |
| **Every unknown on the record** | As 0007 defines it |
| **Fidelity** | Flags and excluded findings, per arm |

- **Every result records:** the parser's and agent's model, quantization, temperature, seed and prompt versions; the participant's version; the parse run; and the pairs', accounts' and reasons' checksums. No vocabulary is involved.
- **The comparison with 0007 is drawn in the doc,** not the result: same agent, same settings, different labeller and different patients.

### 7.8 Gate 2: spend held-out's one look? (OQ 6)

The bar is frozen in the plan before dev runs. Dev must show, in both arms:
1. no verdict words in any turn or record;
2. no unknown missing from a record;
3. no fidelity flag left unexplained on the dev replies;
4. every dev pair either finished or listed with why (`parse: "failed"`, turn limit).

Caught and false alarms are shown, not barred: 14 dev pairs can't measure a rate.

Below the bar, the gate chooses a revision on dev or stopping with the search results and the write-up. A hosted run is never part of this gate unless the owner asks, and then it's dry first.

## 8. The write-up (OQ 7, OQ 8)

`docs/benchmark.md`:

1. **In plain words:** what was measured against whose judgments, and the headline numbers.
2. **What each benchmark could test.** TREC: the search, on nine other-cancer notes. NIH-TrialBench: the search's keeping of a target trial, and the check against clinicians. Neither: the conversation, the order or the short list for NSCLC.
3. **Search recall, own labels and outside ones,** side by side:
   - 0001's 92.7% on NSCLC own labels;
   - TREC's per-type and pooled figures;
   - NIH-TrialBench's targets kept.

   Each with what's different: disease, labeller, registry year, judged pool.
4. **The check, own labels and clinicians'.** 0007's 5 of 16 caught and 27 of 34 false alarms, beside this slice's arms, with what differs: labeller, patients, what "ruled out" means, and whether a reason was given.
5. **The three-way comparison.** What 0003 measured against the mapper. Why outside labels can't measure it here: no NSCLC in TREC, two NSCLC vignettes in NIH-TrialBench. What would: clinician-labelled NSCLC patients against the snapshot, with knowledge profiles. Facts for the benchmark cancers would also let the conversation run on them. That's named, not built (OQ 7: why TREC doesn't settle the mark is said here too).
6. **TrialGPT 2.0 as context.** Its NIH-TrialBench figures (target-trial Recall@10 70% macro-averaged across institutes; hit rate 0.95 at 10), and why they don't compare: it ranks 1,373 trials from the full note, while the finder keeps or drops by structure and checks picked trials.
7. **The worked examples:** NCI 11 and 38.
8. **Getting the data:** §2.1's steps.
9. **Limits.**
10. **Sources and citations,** as each source asks.

## 9. Boundaries

`tests/boundary.test.ts`:
- **The network rule doesn't widen.** A new test holds that no file under `src/`, `scripts/` or `evals/` names `trec.nist.gov`, `trec-cds.org` or `github.com` in code, and that `scripts/benchmark-*.ts` import nothing from `src/trials/registry.ts`.
- **The benchmark's loaders** (`evals/benchmark/`) and `benchmark:import` reach no model module and no factory.
- **`benchmark:check` and `benchmark:parse`** get their adapters as the other model scripts do: `createLocalAdapter`, or `createAdapter` behind `--spend`.
- **`src/` still imports nothing from `evals/`.**
- **`personStages`** stays in `src/search/`, which still reaches no model.

## 10. Tests

All deterministic, none reading `local/`:
- **The XML reader** on three committed fixtures: every field of the table in §3.3, entity decoding, a trial with no MeSH, a phase "Phase 1/Phase 2", and a missing `criteria`.
- **`personStages`** gives the same trials as `searchTrials`'s first three funnel stages on the existing search fixtures, and `searchTrials`' results are unchanged.
- **Every new vocabulary** loads with `loadVocabulary`, has `measured: false`, and passes its validation.
- **The loaders** for `topics.json`, `qrels.json`, `vignettes.json`, `labels.json`, both `profiles.json` and `reasons.json`, including their checks: every qrels topic is one of the nine, every profile names a type that loads, every label's trial is in the trials file, every reason's quote is in its trial's text.
- **The pair draw and the split** are stable for a fixed input.
- **The scoring** for TREC, NIH-TrialBench and the check on hand-made rows, including a disease comment, a missing parse, and a false alarm on one part of a trial.
- **The summary participant's** blindness (a type test) and its quote check.
- **The import's manifest check** with a wrong checksum, on a temporary directory.

## 11. Docs, roadmap and the rest

- **`docs/benchmark.md`** (new, §8).
- **`docs/search.md`, `docs/check.md`, `docs/questions.md`:** each Limits section points to the benchmark where it now speaks. `questions.md`'s "needs the benchmark in slice 0008" becomes what the benchmark found and couldn't.
- **`work/ROADMAP.md`:** 0008 **Done**, with its measure, and open question 4 answered. Further rows only if the owner adds them.
- **README:** one line saying the finder was also run against two public benchmarks, with no numbers.
- **`CLAUDE.md`:** the new commands, `data/benchmark/`, `evals/benchmark/`, and the boundary.

## 12. Out of scope

- **Facts, questions or a conversation for any cancer but NSCLC.**
- **Tuning anything on a benchmark result.** A vocabulary changed after its result is a new, tuned result, said so.
- **The other 85 NIH-TrialBench vignettes** (not oncology).
- **TREC's other 116 notes,** and TREC 2023 (no cancer).
- **The other-cancer mark on TREC** (OQ 7).
- **Ranking against TrialGPT 2.0** on its own task.
- **A hosted run,** unless the owner asks at a gate.
- **The two known open items:** `other:eval -- --check`'s labelsSha256, and the silent **Check these** failure.
