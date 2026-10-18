# Roadmap

Proposed, not started. Each slice gets its own intent, spec and plan before any code, and none starts without the owner's go-ahead. The sketch comes from section 9 of [the research](0000-product/research.md) and will change as slices are planned.

| Slice | What | Measured by | Model? |
| --- | --- | --- | --- |
| 0000 Product | `intent.md`, written from the research | — | No |
| 0001 Snapshot | Fetch and pin recruiting US cancer trials; local search with basket terms, distance and status | Search-stage recall on TREC cancer topics and a first set of vignettes | No |
| 0002 Fact vocabulary | 25–40 canonical patient facts; map NSCLC criteria onto them offline | Coverage (share of criteria mapped) and mapping accuracy on hand-labelled trials | Yes, overnight local |
| 0003 Question selection | Deterministic next-question choice; simulated patient with a knowledge profile | Questions to a stable shortlist; recall against a full record | Yes |
| 0004 Shortlist and handoff | The page: conversation, shortlist with reasons and unknowns, a sheet for the oncologist, and Settings to choose the local model or Anthropic, OpenAI or xAI with a saved key | Browser test; a test that no output states a verdict | No (fake mode) |
| 0005 Deeper check | The person picks two or three shortlisted trials; the per-trial screening agent starts from what the conversation already settled and asks only what's left; a record per trial for the person and their oncologist | Questions saved by not repeating any; clearly-ruled-out trials caught; end to end on vignettes | Yes |
| 0006 Benchmark | NIH-TrialBench and TREC runs; the comparison write-up | The three-way comparison in research section 6 | Yes |

## Open questions

From the research, section 8, in order:

1. Can criteria be mapped onto a small shared fact vocabulary well enough for one answer to settle many trials?
2. How are basket and biomarker trials found when the patient doesn't know their biomarkers?
3. How is prior-therapy logic ("progressed on X with no treatment since") read from a patient's account?
4. Where does ground truth come from without a clinician? Check NIH-TrialBench's license and oncology share.
5. How is a shortlist ordered without implying "this one is best for you"?
