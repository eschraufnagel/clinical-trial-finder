# The search

The first stage of the finder narrows a saved copy of ClinicalTrials.gov to the trials a person might be able to join. It is deterministic: no model, no network, no clock. This page covers what it does, how well it does it, and what the measurement can't tell you.

Built in slice 0001; the record is in [`work/0001-trial-snapshot/`](../work/0001-trial-snapshot/).

## What it searches

A snapshot of ClinicalTrials.gov, taken by `npm run snapshot:fetch` and committed under `data/snapshot/2026-10/`:

- recruiting, interventional cancer trials with at least one US site;
- 5,740 trials, from registry data of 2026-10-16;
- 11.3 MB gzipped, trimmed to the fields in use, with a sha256 in its manifest that every result names.

The registry's own "cancer" search, which the snapshot uses, lets in a few trials that aren't about cancer: spinal cord injury, insomnia, warts. Six of the 300 held-out trials were like that. The search doesn't remove them; for a cancer type they simply don't match.

ZIP codes are located with the Census Bureau's 2025 ZCTA gazetteer (`data/geo/zcta-2025.csv`, 33,791 ZIPs). Delivery-only ZIPs aren't in it, and the search says to try a nearby one.

## What it does

```
npm run search -- --cancer nsclc --zip 60611 --miles 50 --age 64 --sex female
```

The snapshot is narrowed in four stages, and the command prints how many trials survive each:

1. **Purpose.** Treatment trials, or every purpose with `--purpose all`. A trial with no purpose given is kept.
2. **Cancer type.** A trial is kept for one or more of three reasons, from a vocabulary in `data/cancer-types/`:
   - **names it:** its conditions, keywords, titles or MeSH headings name the cancer, or its conditions or keywords name a typical biomarker;
   - **mentions it in its rules:** its eligibility text names the cancer;
   - **open to many:** a condition is a generic term, such as "solid tumors", "brain metastases" or just "Cancer".
3. **Age and sex.** Dropped only when a limit clearly excludes the person. An age limit that doesn't read keeps the trial, with a flag.
4. **Distance.** The nearest recruiting US site within the radius, or anywhere with `--miles anywhere`. The registry places a site at its city's centre, so distances are good to a few miles. When it couldn't place a site, often because the city is misspelled, the site is placed by its ZIP code. A trial with no recruiting site in range is still kept if one of its sites can't be placed either way, with a flag.

Each trial is listed with its reasons, its nearest site and any flags: record not updated in the year before the snapshot, completion date already past, age limit unreadable, nearest site with no location. Flags never drop a trial.

Recall comes first. A trial wrongly kept costs the next stage a little work; a trial wrongly dropped can never be found again. So "mentions it in its rules" also matches exclusions ("no history of non-small cell lung cancer"), and anything the record doesn't say keeps the trial.

Three made-up searches (age 64, female, treatment trials, non-small cell lung cancer):

| Search | For the cancer | Open to the person | Within the distance |
| --- | --- | --- | --- |
| Chicago 60611, 50 miles | 1,129 | 1,087 | 188 |
| Pierre, South Dakota 57501, 100 miles | 1,129 | 1,087 | 2 |
| 60611, anywhere in the US | 1,129 | 1,087 | 1,061 |

Before sites without coordinates were placed by their ZIP, the Pierre search returned 19, and 17 of them were trials far away whose sites the registry couldn't place.

## How well it does

Only the cancer-type stage is measured. Purpose is fixed by how the sample was drawn, and age, sex and distance are arithmetic that the tests prove.

**The labels.** 300 treatment trials drawn at random from the snapshot (by `sha256("0001:" + nctId)`), each labelled for one question: could a person with non-small cell lung cancer take part, on disease alone? The convention is in [`evals/cases/search/ANNOTATION.md`](../evals/cases/search/ANNOTATION.md), and the labels are in [`evals/cases/search/nsclc.json`](../evals/cases/search/nsclc.json). 82 are relevant, 16 of them marked "unclear" because the convention had to be stretched to decide them.

**The result** ([`evals/results/search/01-a3e87584fb11.json`](../evals/results/search/01-a3e87584fb11.json)). No model, so no model name, quantization, temperature or seed applies; the run is fixed by the snapshot, label and vocabulary checksums it names, and `npm run search:eval -- --check` reproduces it row for row.

| | |
| --- | --- |
| Relevant trials kept (recall) | **76 of 82, 92.7%** (95% interval 84.9% to 96.6%) |
| Kept trials that are relevant (precision) | 76 of 87, 87.4% |
| Relevant trials not marked unclear, kept | 66 of 66 |
| Relevant trials marked unclear, kept | 10 of 16 |

The bar set before measuring was 95% recall. The search falls short of it, and that was accepted as the finding rather than tuned further.

**Every miss** is a trial about a site, a procedure or a side effect that takes any cancer, and lists other sites or the side effect as its conditions:

| Trial | What it is | Why it counts for lung cancer |
| --- | --- | --- |
| NCT04545957 | MR-guided radiation planning | any confirmed malignancy needing radiation |
| NCT05053555 | treatment of liver tumors | secondary liver tumors, so lung cancer that has spread to the liver |
| NCT05313191 | proton re-irradiation | previously irradiated tumors of any kind; "Thoracic Cancer" among its conditions |
| NCT06669416 | taste changes from chemotherapy | the most common cancer types, lung among them |
| NCT07410117 | preventing blood clots | advanced or metastatic solid tumors |
| NCT07817147 | ablation of pancreas or liver tumors | liver metastases from advanced cancer |

Finding these would take reading the eligibility text for "any malignancy" and similar phrases, or treating site words such as "liver" or "thoracic" as generic, which would cost precision. That is left for a later slice.

**What's kept wrongly** (11): four small cell lung cancer trials, matched by "lung cancer"; and seven trials whose conditions match a generic term while their eligibility text lists other cancers only.

**By reason** (relevant kept, of kept): names it 39 of 43; mentions it in its rules 39 of 41; open to many 54 of 61. A trial can have several reasons.

## Trials for other cancers: the mark

Built in slice 0005. The record is in [`work/0005-other-cancers/`](../work/0005-other-cancers/).

Recall first means the search keeps trials a person with NSCLC can't join. On 0004's held-out short lists, they held **35 of 162 places, for 15 of 17 patients**: prostate, breast and colorectal trials, small cell lung cancer, lymphoma, neuroendocrine tumors. Nothing a person answers moves them down. They got in through a generic term beside another cancer ("Metastatic Cancer; Neoplasm, Prostate"), a lung biomarker in another cancer's condition ("ALK-Positive Large B-Cell Lymphoma"), or "lung cancer" inside "small cell lung cancer".

**What it does.** After the cancer stage, `src/search/other.ts` marks a candidate whose record is about other cancers only. The words are in `data/cancer-types/nsclc-others.json`. No model; `nsclc.json` and the reasons are unchanged, so the search keeps the same 1,129 candidates and 0001's result still checks. A mark never drops a trial. The page's order puts a marked trial below every unmarked one ([page.md](page.md)).

It has four routes:

| Route | Marks a trial whose | Example |
| --- | --- | --- |
| `small-cell` | conditions name small cell lung cancer only | extensive-stage SCLC trials |
| `biomarker` | only link to NSCLC is a biomarker inside another cancer's condition | an ALK-negative lymphoma trial |
| `listing` | conditions name other cancers only, with no generic term | pancreatic neuroendocrine tumors |
| `rules` | conditions are generic, and whose inclusion rules require other cancers only | "Metastatic Cancer" and "confirmed adenocarcinoma of the prostate" |

**What keeps a trial unmarked:**
- its conditions, keywords or titles name NSCLC;
- its inclusion section names NSCLC;
- a title open to solid tumors;
- "lung" anywhere in the conditions, unless small cell lung cancer;
- for `rules`: any inclusion line open to solid tumors or "malignancy", any open phrase ("any solid tumor", "including but not limited to"), "lung" anywhere in the inclusion section, or no inclusion heading at all.

Exclusion text is never read.

**The labels.** 297 trials, labelled by [`ANNOTATION.md`](../evals/cases/search/ANNOTATION.md) before any check code existed ([`nsclc-other.json`](../evals/cases/search/nsclc-other.json)):
- every trial on 0004's short lists not already labelled (47 dev, 100 held-out);
- 150 NSCLC candidates drawn by hash.

Two blind passes by separate agents covered 90 of the held-out labels: 20 at random, then all 42 not relevant and the 28 riskiest relevant ones. They agreed on relevant or not for every one. Two edge cases were written into the convention at Gate 1, continuation studies and supportive-care trials.

**The result.** No model, so no model name, quantization, temperature or seed applies. Each result names the snapshot, label, vocabulary and others-file checksums, and `npm run other:eval -- --check` reruns it.

| | Dev ([`dev/01`](../evals/results/search/other/dev/01-d16e940b9df3.json)) | Held-out, scored once ([`01`](../evals/results/search/other/01-d16e940b9df3.json)) |
| --- | --- | --- |
| Labelled candidates | 197 | 250 |
| Not for NSCLC, marked | 17 of 26 | **29 of 43** |
| Relevant, marked | 0 | **1 of 207** (NCT03947385) |

The bar, set before held-out was labelled: on the 150-trial sample, no relevant trial marked unless "unclear", and at most one of those. Every route passes it.

**The one relevant trial marked:**
- **NCT03947385** names uveal melanoma, cutaneous melanoma and colorectal cancer beside "Other Solid Tumors". Its inclusion lines name only melanoma, so `rules` marks it.
- It's a short-list trial, not in the sample, so the bar didn't catch it.
- Gate 3 kept it as the known cost, rather than change `rules` after seeing held-out.

**On the page,** places held by trials not for NSCLC on held-out short lists fall from 35 to 6, for 15 to 5 patients ([page.md](page.md)).

**What it can't tell you:**
- **The lists were tuned on dev** while the check was written, so dev's zero cost is the least it could show. Held-out is the measure, and was scored once.
- **14 of 43 held-out trials not for NSCLC are left unmarked.** Mostly they list their cancers inside a "solid tumor" line, or exclude NSCLC in words. Reading those safely would take more than fixed lists.
- **Three labellers, all models,** working from one written convention. No clinician checked a label.
- **The 22 trials that first reached a short list under the new order** were labelled after the check existed, to count places.
- **About one relevant trial in 200** is marked, on held-out. A mark moves it down; it doesn't hide it.

## What the measurement can't tell you

- **One labeller.** Claude wrote the labels, the convention and the vocabulary. The labels were written before any search code existed, and the vocabulary's first version was written without opening them. A separate agent relabelled 20 of them blind and agreed on all 20. No clinician and no independent person checked them.
- **The dev numbers are flattering.** A second pool of 80 trials, for tuning, scored 100% recall. It was drawn from trials whose eligibility text mentions lung cancer, which is close to what the "mentions it in its rules" reason looks for, so it was always going to be easy. It gave nothing to tune on, and the vocabulary was never changed after it was first written.
- **The interval is wide.** 82 relevant trials put the true recall somewhere between about 85% and 97%.
- **One cancer type measured.** Only non-small cell lung cancer has a measured vocabulary. Slice 0008 added 20 search-only vocabularies for its benchmarks, each measured once there and not tuned ([benchmark.md](benchmark.md)).
- **Outside judgments, on other cancers.** TREC's assessors' relevant trials are kept 77.3% of the time, pooled over nine notes. Many of the misses are trials for a patient's other conditions, which a cancer search drops by design. Of NIH clinicians' recruiting target trials, 26 of 29 are kept with the treatment purpose; the three misses are one trial registered as a device study. Basket trials listing several cancers can be dropped at the cancer stage. None of this is NSCLC, so it doesn't replace the number above ([benchmark.md](benchmark.md)).
- **One snapshot.** The numbers are for the 2026-10 snapshot. A refetch is a new snapshot and needs a new measurement.
