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
4. **Distance.** The nearest recruiting US site within the radius, or anywhere with `--miles anywhere`. A trial with no recruiting site in range is still kept if one of its recruiting sites has no location, with a flag.

Each trial is listed with its reasons, its nearest site and any flags: record not updated in the year before the snapshot, completion date already past, age limit unreadable, nearest site with no location. Flags never drop a trial.

Recall comes first. A trial wrongly kept costs the next stage a little work; a trial wrongly dropped can never be found again. So "mentions it in its rules" also matches exclusions ("no history of non-small cell lung cancer"), and anything the record doesn't say keeps the trial.

Three made-up searches (age 64, female, treatment trials, non-small cell lung cancer):

| Search | For the cancer | Open to the person | Within the distance |
| --- | --- | --- | --- |
| Chicago 60611, 50 miles | 1,129 | 1,087 | 191 |
| Pierre, South Dakota 57501, 100 miles | 1,129 | 1,087 | 19 |
| 60611, anywhere in the US | 1,129 | 1,087 | 1,061 |

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

## What the measurement can't tell you

- **One labeller.** Claude wrote the labels, the convention and the vocabulary. The labels were written before any search code existed, and the vocabulary's first version was written without opening them. A separate agent relabelled 20 of them blind and agreed on all 20. No clinician and no independent person checked them.
- **The dev numbers are flattering.** A second pool of 80 trials, for tuning, scored 100% recall. It was drawn from trials whose eligibility text mentions lung cancer, which is close to what the "mentions it in its rules" reason looks for, so it was always going to be easy. It gave nothing to tune on, and the vocabulary was never changed after it was first written.
- **The interval is wide.** 82 relevant trials put the true recall somewhere between about 85% and 97%.
- **One cancer type.** Only non-small cell lung cancer has a vocabulary and a measurement.
- **One snapshot.** The numbers are for the 2026-10 snapshot. A refetch is a new snapshot and needs a new measurement.
