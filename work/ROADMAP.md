# Roadmap

0001 to 0004 are done; the rest are proposed. Each slice gets its own intent, spec and plan before any code, and none starts without the owner's go-ahead. The sketch comes from section 9 of [the research](0000-product/research.md) and will change as slices are planned.

| Slice | What | Measured by | Model? |
| --- | --- | --- | --- |
| 0000 Product | `intent.md`, written from the research | — | No |
| 0001 Snapshot | **Done.** Fetch and pin recruiting US cancer trials; local search with basket terms, distance and status | Search-stage recall on a held-out random sample of the snapshot, labelled for NSCLC ([docs/search.md](../docs/search.md)). TREC has no NSCLC topics, so it moves to 0006 | No |
| 0002 Fact vocabulary | **Done.** 31 patient facts; every NSCLC candidate's rules mapped onto them offline by the local model. Mappings are hints, never rule-outs: on held-out a quarter would have wrongly ruled a trial out ([docs/facts.md](../docs/facts.md)) | Coverage from hand labels (43% of person-level rules), and recall and wrong-mapping rate on 30 held-out trials | Yes, overnight local |
| 0003 Question selection | **Done.** A pinned order, a fixed intake of 8, and a deterministic chooser: the question whose answers would change the short list most, 8 follow-ups at most. 20 made-up patients who know part of their record. A model reads replies in a person's words ([docs/questions.md](../docs/questions.md)) | On 17 held-out patients, 89% of the full record's short list, against 79% from the intake alone. The reader got 326 of 326 known replies and invented 1 of 201 unknowns, on replies written to be clear | Yes, local |
| 0004 Shortlist and handoff | **Done.** The page, on this computer only: free-text answers, each reading confirmed; the short list, with how much of each trial's rules were read; the oncologist sheet; and Settings for the local model or a hosted one with a saved key. The order now puts trials with readings before trials with none, chosen at Gate 1 ([docs/page.md](../docs/page.md)) | Held-out short-list places held by trials with no readings, 30 to 2; no verdict words in any patient's list or sheet, and every unknown on the sheet; a browser test. On Claude Haiku 4.5, the reader's prompt could read 45% of held-out replies, all of them right; the rest fall back to the buttons | Yes, one hosted held-out reading run |
| 0005 Deeper check | The person picks two or three shortlisted trials; the per-trial screening agent starts from what the conversation already settled and asks only what's left; a record per trial for the person and their oncologist | Questions saved by not repeating any; clearly-ruled-out trials caught; end to end on vignettes | Yes |
| 0006 Benchmark | NIH-TrialBench and TREC runs, including the search on TREC's other cancer topics; the comparison write-up | The three-way comparison in research section 6 | Yes |

## Open questions

From the research, section 8, in order:

1. Can criteria be mapped onto a small shared fact vocabulary well enough for one answer to settle many trials?
2. How are basket and biomarker trials found when the patient doesn't know their biomarkers?
3. How is prior-therapy logic ("progressed on X with no treatment since") read from a patient's account?
4. Where does ground truth come from without a clinician? Check NIH-TrialBench's license and oncology share.
5. How is a shortlist ordered without implying "this one is best for you"? Partly answered in 0004: fewest conflicts first, then trials whose rules were read, then distance, with a note saying the order isn't a ranking and each card saying how much was read. What stays open is a list that still favors trials whose rules the model missed.
6. Added in 0004: the search keeps some trials for other cancers (prostate, lymphoma) through broad terms such as "metastatic cancer". Nothing in a person's answers flags them, so they can reach the short list. How many short-list places they take, and whether a check after the search can remove them without losing basket trials, is the next slice to plan.
