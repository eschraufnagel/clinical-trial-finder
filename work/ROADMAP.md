# Roadmap

0001 to 0011 and 0013 are done; the rest are proposed. Each slice gets its own intent, spec and plan before any code, and none starts without the owner's go-ahead. The sketch comes from section 9 of [the research](0000-product/research.md) and will change as slices are planned.

| Slice | What | Measured by | Model? |
| --- | --- | --- | --- |
| 0000 Product | `intent.md`, written from the research | — | No |
| 0001 Snapshot | **Done.** Fetch and pin recruiting US cancer trials; local search with basket terms, distance and status | Search-stage recall on a held-out random sample of the snapshot, labelled for NSCLC ([docs/search.md](../docs/search.md)). TREC has no NSCLC topics, so it moves to 0008 | No |
| 0002 Fact vocabulary | **Done.** 31 patient facts; every NSCLC candidate's rules mapped onto them offline by the local model. Mappings are hints, never rule-outs: on held-out a quarter would have wrongly ruled a trial out ([docs/facts.md](../docs/facts.md)) | Coverage from hand labels (43% of person-level rules), and recall and wrong-mapping rate on 30 held-out trials | Yes, overnight local |
| 0003 Question selection | **Done.** A pinned order, a fixed intake of 8, and a deterministic chooser: the question whose answers would change the short list most, 8 follow-ups at most. 20 made-up patients who know part of their record. A model reads replies in a person's words ([docs/questions.md](../docs/questions.md)) | On 17 held-out patients, 89% of the full record's short list, against 79% from the intake alone. The reader got 326 of 326 known replies and invented 1 of 201 unknowns, on replies written to be clear | Yes, local |
| 0004 Shortlist and handoff | **Done.** The page, on this computer only: free-text answers, each reading confirmed; the short list, with how much of each trial's rules were read; the oncologist sheet; and Settings for the local model or a hosted one with a saved key. The order now puts trials with readings before trials with none, chosen at Gate 1 ([docs/page.md](../docs/page.md)) | Held-out short-list places held by trials with no readings, 30 to 2; no verdict words in any patient's list or sheet, and every unknown on the sheet; a browser test. On Claude Haiku 4.5, the reader's prompt could read 45% of held-out replies, all of them right; the rest fall back to the buttons | Yes, one hosted held-out reading run |
| 0005 Trials for other cancers | **Done.** A deterministic mark, four routes, on trials whose record is about other cancers only. The order `other-last` moves them below the short list, and nothing is removed ([docs/search.md](../docs/search.md)) | Held-out short-list places held by trials not for NSCLC, 35 of 162 to 6. On 250 held-out labels, 29 of 43 such trials marked, and 1 of 207 relevant ones | No |
| 0006 Reader on hosted models | **Done.** The Anthropic request carries the reader's answer schema as structured output; the prompt is unchanged, so the local model's numbers stand ([docs/questions.md](../docs/questions.md#on-a-hosted-model)) | On the same 527 held-out pairs, Claude Haiku 4.5 read 527, against 0004's 237 (45%). 324 of 326 stated answers read exactly, 2 plain "No"s read as "Yes"; 0 of 201 "don't know"s invented. Held-out was read after the owner overturned a dev bar at Gate 2 | Yes, one hosted dev and one held-out reading run, $0.34 |
| 0007 Deeper check | **Done.** The person ticks up to three trials; the screening agent starts from what the conversation settled, asks only what's left, and writes a record per trial; on the page and measured ([docs/check.md](../docs/check.md)) | On 50 held-out pairs, local model, run once after Gate 1: 27% of questions saved; 5 of 16 clearly-ruled-out trials caught, all 5 among the 9 the person could know; false alarms on 27 of 34 others; no verdict words, no unknown dropped, no list moved. The labelled pairs held no trial for another cancer. "End to end on vignettes" became the 20 made-up patients' top three | No; local model only |
| 0008 Benchmark | **Done.** The search scored against TREC 2021/22's nine cancer notes and NIH-TrialBench's NCI vignettes, with 20 search-only vocabularies; the deeper check against NIH clinicians' labels on dev, from the full summary and from a patient's account ([docs/benchmark.md](../docs/benchmark.md)) | Search: TREC's relevant trials kept 77.3% pooled (many misses are trials for other conditions); 26 of 29 recruiting NIH-TrialBench targets kept with treatment, 29 of 29 with every purpose. Check, dev only: false alarms on 8 of 9 eligible pairs (full) and 4 of 9 (account), its catches on parts of trials the person isn't in. Held-out left unread at Gate 2. The three-way comparison can't be measured on outside labels: two NSCLC vignettes | Yes, local only |
| 0009 Check false alarms | **Done.** The deeper check's agent keeps a rule's "if" and reads pregnancy rules both ways round; the record sets rules for one part of the trial apart and asks which part the person would be in ([docs/check.md](../docs/check.md#what-slice-0009-changed)) | NIH-TrialBench dev, full summary only: four of six pregnancy and conditional lines gone, but false alarms outside parts unchanged at 5 of 9 (0008's measure: 8 of 9 to 7 of 9). Held-out kept unread at Gate 2 for a fix that can move the rate | Yes, local only |
| 0010 "Or" lists | **Done, stopped at Gate 1.** A list mark (`anyOf`) on the parse, checked in code, and a record that reads a marked list as one rule; inert, since the parser's prompt was put back. Two prompt wordings each marked the target lists right and made other trials' parses worse ([docs/check.md](../docs/check.md#what-slice-0010-tried)) | No check run. The parser graded on 5 hand-labelled protocols (strict recall 77.8%, then 84.9% and 82.1%) and compared rule by rule on dev's 12; of the second try's 25 lists, 16 right, 7 wrong, 2 of them hiding required rules. Held-out still unread | Yes, local parses only |
| 0011 Finder design | **Done.** Every screen in Chart v2, the design the prescreening page uses, with its fonts, icons and stylesheet foundation shared: two registers, findings in neutral ink, dark mode from the system, a phone layout, print. Drawn first on a canvas the owner accepted; a check that can't start now says so ([docs/page.md](../docs/page.md#how-it-looks)) | The contrast test (17 pairs, AA, light, dark and print), the verdict scan, the browser test (10 cases) and the owner's look at Gate 1 | No |
| 0013 Ready to show | **Done.** The README for a first reader: the guardrails together, six measured results each linked to its committed file with what it doesn't show, and a diagram of the parts and the model boundary; a demo script on `--fake` following made-up patient p08 ([docs/demo.md](../docs/demo.md)); the GitHub description and topics; the history scanned for PHI and secrets, nothing real found | The owner's read of the README and run of the demo at Gate 1; gitleaks and a PHI pattern search over all 277 commits ([history-scan.md](0013-demo-ready/history-scan.md)) | No |

## Open questions

From the research, section 8, in order:

1. Can criteria be mapped onto a small shared fact vocabulary well enough for one answer to settle many trials?
2. How are basket and biomarker trials found when the patient doesn't know their biomarkers?
3. How is prior-therapy logic ("progressed on X with no treatment since") read from a patient's account?
4. Where does ground truth come from without a clinician? Check NIH-TrialBench's license and oncology share. Answered in 0008: NIH-TrialBench is public domain and all NCI, but has two NSCLC vignettes; TREC states no licence and has no lung cancer. Both measure the search on other cancers, and NIH-TrialBench the check. Neither measures the conversation; that needs clinician-labelled NSCLC patients, or facts for a benchmark cancer.
5. How is a shortlist ordered without implying "this one is best for you"? Partly answered in 0004: fewest conflicts first, then trials whose rules were read, then distance, with a note saying the order isn't a ranking and each card saying how much was read. What stays open is a list that still favors trials whose rules the model missed.
6. Added in 0004: the search keeps some trials for other cancers (prostate, lymphoma) through broad terms such as "metastatic cancer". Nothing in a person's answers flags them, so they can reach the short list. Answered in 0005: they held one held-out short-list place in five. A mark without a model now moves most of them below the short list, removing nothing, at a cost of one relevant trial in about 200. What stays open is the third that a fixed check can't read: cancers listed inside a "solid tumor" line, and trials that exclude NSCLC in words. 0007 hoped its check would catch some of them on a picked trial's own rules; none of the 59 pairs it labelled was one, so that stays untested.

## Future scope, not yet planned

Recorded 2026-10 at the owner's request. None of this is a slice yet. Each item needs its own intent, spec and plan before any work.

**Today the finder is built for one cancer.**
- The search can run for any cancer once it has a vocabulary in `data/cancer-types/`. Only `nsclc.json` is measured. Slice 0008 adds twenty more, unmeasured and search-only, for its benchmarks.
- The questions, the order and the short list rest on 31 facts written for NSCLC (`docs/facts.md`), so the conversation on the page works only for NSCLC.
- The deeper check reads any trial's own rules, so it doesn't depend on the cancer type. Slice 0008 measures it on other cancers.

**The direction: more cancers.** Rare disease was considered and set aside (2026-10): the product stays oncology only, as its intent says.

For each new cancer type:
- a search vocabulary, measured on held-out labels as 0001 measured NSCLC;
- the facts that knock its trials off a list, and each trial's rules mapped onto them;
- made-up patients with knowledge profiles;
- the three arms measured, as 0003 did.

Likely first candidates are the cancers 0008's benchmarks cover (breast, lymphoma, cervical, others), since outside labels already exist for their search.

**Open questions for that work:**
- How much of the fact vocabulary is shared across cancers, and how much is per cancer?
- Can the questions be chosen the same way for a cancer with few trials?
- Where do labels come from for each new cancer: written here, as for NSCLC, or from a benchmark?
