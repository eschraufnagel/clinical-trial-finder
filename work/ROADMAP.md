# Roadmap

0001, 0002 and 0003 are done; the rest are proposed. Each slice gets its own intent, spec and plan before any code, and none starts without the owner's go-ahead. The sketch comes from section 9 of [the research](0000-product/research.md) and will change as slices are planned.

| Slice | What | Measured by | Model? |
| --- | --- | --- | --- |
| 0000 Product | `intent.md`, written from the research | — | No |
| 0001 Snapshot | **Done.** Fetch and pin recruiting US cancer trials; local search with basket terms, distance and status | Search-stage recall on a held-out random sample of the snapshot, labelled for NSCLC ([docs/search.md](../docs/search.md)). TREC has no NSCLC topics, so it moves to 0006 | No |
| 0002 Fact vocabulary | **Done.** 31 patient facts; every NSCLC candidate's rules mapped onto them offline by the local model. Mappings are hints, never rule-outs: on held-out a quarter would have wrongly ruled a trial out ([docs/facts.md](../docs/facts.md)) | Coverage from hand labels (43% of person-level rules), and recall and wrong-mapping rate on 30 held-out trials | Yes, overnight local |
| 0003 Question selection | **Done.** A pinned order, a fixed intake of 8, and a deterministic chooser: the question whose answers would change the short list most, 8 follow-ups at most. 20 made-up patients who know part of their record. A model reads replies in a person's words ([docs/questions.md](../docs/questions.md)) | On 17 held-out patients, 89% of the full record's short list, against 79% from the intake alone. The reader got 326 of 326 known replies and invented 1 of 201 unknowns, on replies written to be clear | Yes, local |
| 0004 Shortlist and handoff | The page: conversation, shortlist with reasons and unknowns, a sheet for the oncologist, and Settings to choose the local model or Anthropic, OpenAI or xAI with a saved key. Answers in free text, each reading shown back for the person to confirm (0003 Gate 3). First question: the order, which favors trials the mapper read little (0003 Gate 2) | Browser test; a test that no output states a verdict | No (fake mode) |
| 0005 Deeper check | The person picks two or three shortlisted trials; the per-trial screening agent starts from what the conversation already settled and asks only what's left; a record per trial for the person and their oncologist | Questions saved by not repeating any; clearly-ruled-out trials caught; end to end on vignettes | Yes |
| 0006 Benchmark | NIH-TrialBench and TREC runs, including the search on TREC's other cancer topics; the comparison write-up | The three-way comparison in research section 6 | Yes |

## Open questions

From the research, section 8, in order:

1. Can criteria be mapped onto a small shared fact vocabulary well enough for one answer to settle many trials?
2. How are basket and biomarker trials found when the patient doesn't know their biomarkers?
3. How is prior-therapy logic ("progressed on X with no treatment since") read from a patient's account?
4. Where does ground truth come from without a clinician? Check NIH-TrialBench's license and oncology share.
5. How is a shortlist ordered without implying "this one is best for you"?
