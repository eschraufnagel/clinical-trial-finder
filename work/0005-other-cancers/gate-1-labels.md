# Gate 1: do the labels hold?

**Question:** are slice 0005's 297 labels, and the convention they follow, good enough to measure the check on? After this gate, `places-heldout` and `sample` are scored once (step 9) and can't be relabelled. Plan, Gate 1.

**What's decided:**
- each blind-relabel disagreement, and which label stands;
- whether the two cases below go into `ANNOTATION.md` as written edge cases;
- whether the slice goes on, given how many places these trials take today.

## The labels

[`evals/cases/search/nsclc-other.json`](../../evals/cases/search/nsclc-other.json), by [`ANNOTATION.md`](../../evals/cases/search/ANNOTATION.md), unchanged. Each one was written from `search:show` output before any check code existed (steps 4 and 5).

| Set | Trials | Relevant | of them "unclear" | Not relevant |
| --- | ---: | ---: | ---: | ---: |
| `places-dev` | 47 | 38 | 1 | 9 |
| `places-heldout` | 100 | 81 | 4 | 19 |
| `sample` | 150 | 125 | 8 | 25 (1 "unclear") |

A further 24 short-list trials were already in 0001's labels and keep them.

**What the trials not for NSCLC are,** across all three sets: small cell lung cancer only (the largest group), blood cancers only, neuroendocrine tumors only, mesothelioma only, and trials limited to one or a few named cancers (prostate, breast, colorectal, GIST, head and neck, endometrial, ovarian, thyroid).

## The blind relabel

A separate agent was given `ANNOTATION.md` and `search:show` output only, and labelled 20 trials blind: 10 from `places-heldout` and 10 from `sample`, drawn by `sha256("0005-blind:" + nctId)`.

| Trial | Set | Mine | Blind |
| --- | --- | --- | --- |
| NCT04300556 | places-heldout | yes | yes |
| NCT05103683 | places-heldout | yes | yes |
| NCT05203172 | places-heldout | yes (unclear) | yes (unclear) |
| NCT05301101 | sample | yes | yes |
| NCT05632809 | places-heldout | yes | yes |
| NCT05877430 | sample | yes | yes |
| NCT06190886 | places-heldout | yes | yes |
| NCT06326411 | places-heldout | yes | yes |
| NCT06580002 | sample | yes | **yes (unclear)** |
| NCT06582017 | places-heldout | yes | **yes (unclear)** |
| NCT06589596 | sample | yes | yes |
| NCT06686771 | places-heldout | yes | yes |
| NCT06747585 | sample | yes | yes |
| NCT06788990 | places-heldout | no | no |
| NCT06918132 | sample | yes | yes |
| NCT07159126 | sample | yes | yes |
| NCT07229313 | places-heldout | yes | yes |
| NCT07300150 | sample | yes | yes |
| NCT07428044 | sample | yes | yes |
| NCT07488923 | sample | no | no |

**20 of 20 agree on relevant or not.** The two disagreements are only about "unclear":
- **NCT06580002,** a trial for cognitive problems after cancer treatment. Its conditions name lung cancer, and its rules take "non-breast cancer patients exposed to ... anticancer therapies". The blind labeller marked it unclear because the kind of lung cancer isn't said.
- **NCT06582017,** whose inclusion lists "lung" among the solid tumors without a subtype. Blind: unclear for the same reason.

The convention says a trial for "lung cancer without saying which kind" is relevant, so I'd keep both labels as they are, not unclear. Either way it changes no relevant-or-not count, and the bar (spec §7) treats "unclear" labels more leniently, not more strictly.

**What the blind relabel can't tell you.** The draw gave 18 relevant trials and 2 not relevant. Most of the 18 are trials for NSCLC by name or for any solid tumor, which are easy. The labels that matter most are:
- the not-relevant ones, which become the check's gains;
- the relevant basket trials whose listing names other cancers, which become its costs.

20 trials drawn at random can't check those. A second blind pass aimed at them would cost an agent's time and no money. It would take, say, every not-relevant held-out label, plus the relevant ones whose listing names another cancer. That's a choice for this gate (below).

## Two recurring cases, decided by the convention as it stands

Neither is a new rule. Each came up several times and was decided the same way each time. Written down here so it can be argued with, and added to `ANNOTATION.md` if you agree.

1. **Continuation and extension studies** take only people already in a parent study, and don't limit cancer type: NCT03486873, NCT05203172, NCT07415031. Labelled **relevant, "unclear"**. Someone with NSCLC in the parent study can join, but nobody new can.
2. **Supportive-care trials** treat a side effect or symptom in anyone with cancer: myocarditis from immunotherapy, cardiotoxicity, depression, cognitive problems, chemotherapy nausea, smoking cessation, pain after lung surgery. Labelled **relevant** when they take any cancer type or name lung cancer, under the convention's "a symptom being treated" rule. The one exception is pain after abdominal surgery only (NCT06731998), which is labelled not relevant.

## How many places these trials take today

`npm run other:eval -- --places <result>`, on 0004's committed `read-first` results, with 0001's labels and these together. Every short-list trial has a label, so the unlabelled count is 0 in every row.

[`05-7543ffb2cb2e.json`](../../evals/results/questions/05-7543ffb2cb2e.json):

| Set | Arm | Scorer | Places | Held by trials not for NSCLC | Patients with any |
| --- | --- | --- | ---: | ---: | ---: |
| held-out (17) | record | — | 162 | 38 (23%) | 14 |
| | intake | — | 162 | 36 | 15 |
| | conversation | **shortlist** | 162 | **35 (22%)** | **15** |
| | knows all | shortlist | 162 | 36 | 14 |
| dev (3) | conversation | shortlist | 30 | 6 (20%) | 3 |

[`with-reads/03-7543ffb2cb2e.json`](../../evals/results/questions/with-reads/03-7543ffb2cb2e.json), the conversation answered from the reader's held-out readings: 34 of 162, 14 patients.

**About one short-list place in five goes to a trial a person with NSCLC couldn't join, for 15 of the 17 held-out patients.** That holds in every arm, and even the full record's short list carries them (38 places). That fits the intent's account: nothing a person answers moves them down.

**By kind**, the 35 places in the held-out conversation arm:

| Kind | Places | Trials |
| --- | ---: | --- |
| limited to one or a few named cancers | 14 | prostate NCT05422911; breast NCT05386108, NCT07174336; ovarian NCT04516447; colorectal NCT04929223, NCT04511039; GIST NCT05208047; head and neck NCT06788990; gastroesophageal and colorectal NCT06657144; lists of others NCT05394103, NCT06253130, NCT03460977 |
| neuroendocrine tumors only | 7 | NCT06943755 (pancreatic and other NETs), NCT04665739 (lung carcinoid) |
| small cell lung cancer only | 6 | NCT06646276, NCT06769126, NCT04342429, NCT06203210, NCT06801834 |
| blood cancers only | 6 | NCT05544019, NCT06724237 (both kept by "ALK"), NCT05053867, NCT06150157 |
| mesothelioma only | 2 | NCT04515836 |

Two trials will be hard for any check without a model:
- **NCT04665739 (lung carcinoid)** names "lung" in every condition;
- **NCT06943755** reached the search through its rules alone ("neuroendocrine carcinomas (including small cell lung cancer)" in an exclusion).

Together they hold 7 of the 35 places.

## Recommendation

- **The labels stand,** including NCT06580002 and NCT06582017 as relevant and not unclear.
- **Add the two cases above to `ANNOTATION.md`** as edge cases settled at Gate 1, so they're applied the same way next time. That changes no label.
- **Go on to stage B.** One place in five is far from "near zero". It's the size of problem the intent guessed at, and it's now measured.
- **Your call: a second blind pass** on the labels the check will be scored on, as above, before held-out is used. I lean towards yes. It's cheap, and the first pass checked mostly easy trials.

## What it costs to be wrong

- **Every number after this is measured on these labels.** `places-heldout` and `sample` can't be relabelled once step 9 scores them.
- **A basket trial wrongly labelled "not relevant"** would let a route that marks it pass the bar. It would then be moved down for real patients, without the measurement showing it.
- **A wrongly labelled "relevant" trial** costs less: a route that marks it would fail the bar it should have passed.

## Answer

(The owner's, at the gate.)
