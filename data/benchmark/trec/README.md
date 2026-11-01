# TREC 2021 and 2022, the cancer notes

Written by `npm run benchmark:import` from the downloads named in [`../sources.json`](../sources.json), except `profiles.json` and this file, which are written by hand. Slice 0008 measures the search on them ([`work/0008-benchmark/`](../../../work/0008-benchmark/)).

- **`topics.json`:** the nine notes about a cancer under treatment (spec 0008 §3.1), verbatim. A note is named by year and number, as `2022-11`, because both years have a topic 11.
- **`qrels.json`:** the 4,672 physician judgments of those nine notes. 0 is not relevant, 1 excluded, 2 eligible, as TREC judges.
- **`trials.jsonl.gz`:** the 4,297 judged trials, read from TREC's registry copy of 2021-04-27, the text the physicians judged, into the snapshot's trial shape (`evals/benchmark/trec-xml.ts`). Distance and status don't apply to 2021 trials, so sites aren't kept.
- **`profiles.json`:** each note's cancer type, age and sex.

## The convention, written before scoring

**A trial judged 1 or 2 is "for the patient's condition".** TREC's 1, excluded, means the patient has the condition the trial studies but fails another of its rules. Both judgments say the trial is for this patient's disease. That's the question 0001's labels asked of the NSCLC search, on disease alone, so it's the headline. Recall of judgment 2 alone is reported beside it.

**A trial judged 0 isn't a precision count.** Not relevant can still be a trial for the right cancer that doesn't suit this patient for another reason.

**Recall is of the judged pool.** TREC judged the trials that participating systems retrieved, not every trial in the registry.

**The license.** TREC's pages state none. Only these trimmed files are committed, with their source named.
