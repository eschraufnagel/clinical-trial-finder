# intent: 0001 trial snapshot and search

**Author:** the repository owner
**Status:** Draft
**Date:** 2026-10
**Scope:** One slice. A pinned local copy of every recruiting cancer treatment trial with a US site, a deterministic search over it, and a measurement of how many trials that could take a person with non-small cell lung cancer (NSCLC) the search keeps. No model, no conversation, no page.

---

## In plain words

Before the assistant can ask anyone anything, it needs the trials, and a way to narrow 5,700 of them down to the ones near a person, for their cancer, open to someone their age. That's this slice. It also checks the one thing that matters most at this stage: **does the narrowing throw away trials that would have fit?** A trial thrown away here never reaches the person, however good the rest of the assistant is.

## Problem

Every later slice works on the trials this search hands it. The fact vocabulary (0002) is mapped onto them, the questions (0003) are chosen to split them, and the shortlist (0004) is drawn from them. The search is also the one stage whose mistakes nothing downstream can recover. A trial the conversation is unsure about stays on the list with its unknowns. A trial the search drops is gone.

Three things make the search harder than a filter on condition names:

**The registry's condition vocabulary is chaotic.** The 5,740 recruiting interventional cancer trials with a US site use 6,486 distinct condition strings, 271 of them containing "lung" (research §2). There's no controlled list to match against. The registry's MeSH coding helps but is incomplete: filtering on it finds 11,197 recruiting cancer trials worldwide where the registry's own search finds 14,360.

**Many of the trials that matter don't name the cancer.** About one in seven lists only a generic condition, such as "advanced solid tumor". Others name something that isn't a cancer type at all. A first look at the trials a simple lung-or-generic match drops found NSCLC trials listed under "Brain Metastases", "C-Met Exon 14 Mutation", "Leptomeningeal Disease" and "Advanced Solid Malignancies", and NSCLC cohorts inside trials listed under breast or gastric cancer. These are the biomarker-driven and brain-metastasis trials a person out of standard options is most likely to need.

**There's no ready-made ground truth for it.** The research expected to measure search recall on TREC's physician-judged cancer cases. Checking them while writing this intent: TREC 2021 has about fourteen cancer topics across a dozen cancer types, and its one topic mentioning the lung is a myeloma patient. TREC 2022 has essentially none. Neither can measure an NSCLC search. Its trials also come from a 2021 copy of the registry and have mostly closed. **The measurement has to be made on this snapshot, with labels written for it.**

## Proposed outcome

At the end of this slice:

1. **A pinned snapshot.** A script fetches every recruiting interventional study matching the registry's own `cancer` condition search with at least one US location, trims each to the fields this product uses, and writes them as one file with a readable manifest: the query, the registry's data timestamp, the count and a checksum. Site contact blocks, which name real coordinators, are dropped at fetch time, as the prescreening repository's trimmer already does. The snapshot is pinned by month. Refreshing it is a person's deliberate act and a new measurement. Measured while writing this intent: 5,740 trials, about 42 MB as compact JSON and 11 MB compressed, about half of it eligibility text.
2. **ZIP code locations.** The Census Bureau's public-domain ZIP Code Tabulation Area gazetteer, trimmed to ZIP, latitude and longitude, so a person's ZIP becomes a point on a map without any network call.
3. **A cancer-type vocabulary, as data.** One entry for NSCLC (the terms, MeSH headings and biomarker names that put a trial in scope) and one shared list of "open to many cancers" terms. Adding a cancer type later means adding an entry, measured or marked unmeasured.
4. **A search.** Given a cancer type, age, sex, ZIP code and travel radius, it returns the candidate trials. For each it gives the reason it was kept ("names your cancer" or "open to many cancer types"), the nearest recruiting US site and its distance, and flags for records that look stale. Treatment trials only, by default. Deterministic and pure: no model, no network, no clock.
5. **A measurement of what the search drops.** Disease-relevance labels say whether each trial would consider an adult with NSCLC at all. A random, held-out sample of the snapshot's treatment trials gives an estimate of recall (the share of relevant trials the search keeps) and precision. A separate dev pool of trials most likely to be missed is used to improve the vocabulary, and never to report the result. The result is committed, and a deterministic command reproduces it.
6. **A command to try it.** For example, `npm run search -- --cancer nsclc --zip 60611 --miles 50 --age 64 --sex female` prints how many trials it kept, why each was kept and how far away each is.

**Absent on purpose:** no criteria parsing, no model, no conversation, no ranking beyond nearest-site distance, no page, no NCI API. Stage, biomarkers and prior treatment can't be read from structured fields. They're 0002's job.

## Affected users and systems

**The owner,** who runs the fetch script once in this slice and decides the gates: whether the snapshot is committed, and whether the measured recall is good enough to build 0002 on.

**Slices 0002–0004,** the search's consumers. 0002 maps criteria onto shared facts for the trials the search can return, and parses overnight. If the search drops trials, every later number inherits the gap.

**ClinicalTrials.gov API v2,** read-only, called by a script through `src/trials/registry.ts`, the one file already allowed that host. About six paged requests.

**The Census Bureau,** one public file fetched by a script under `scripts/`, outside the application tree.

**Not touched:** no model, no adapter, no transport, no server, no page.

## Constraints

- **No network at runtime.** The search reads only committed files. The snapshot request is added to `src/trials/registry.ts`, which `tests/boundary.test.ts` already allows `clinicaltrials.gov` and nothing else. The gazetteer is fetched from `scripts/`. No boundary is widened.
- **No PHI.** Registry records describe protocols, not patients. Site contacts are discarded. Facility names, cities and coordinates are public and kept. The ZIP codes in tests and examples are made-up searches, never anyone's address.
- **Recall first.** When in doubt, the search keeps a trial. A trial with no age limit, no sex restriction, or a site with no coordinates is kept and marked, never dropped. The same rule as the product's "an unknown never excludes", applied to registry data.
- **Committed data, small tests.** Whatever the snapshot gate decides, `npm test` stays deterministic, reads no gitignored file, and stays under a second. Tests run on small committed fixtures. They don't load the full snapshot.
- **Labels are written for this snapshot and say why.** The owner isn't a clinician, so labels are Claude-authored with a written reason each, under conventions committed beside them, as in the prescreening repository. Measuring a second, independent labeller against them is the real fix, and this slice doesn't have one. The result says so.
- **Held-out means held out.** The vocabulary is improved using the dev pool only. The reported recall comes from the random sample, scored once the vocabulary is frozen.
- **No new dependencies.** Node's built-in `zlib` reads and writes the compressed snapshot and unpacks the gazetteer's single-file zip.
- **Months, not days.** The snapshot and result are named by month. The registry's own dates are kept as the registry gives them.

## Open questions

1. **Commit the full snapshot, or keep it on this machine?** Committing makes every result reproducible from a fresh clone, at about 11 MB per pinned version, forever in history. Keeping it gitignored keeps the repository small, but a result could no longer be checked from the repository alone. Leaning commit, refreshed rarely. This is the slice's first gate.
2. **Treatment trials only?** The persona is looking for treatment. 4,241 of the 5,740 are treatment trials; the rest are supportive care, diagnostic, prevention and others. Leaning treatment by default, with the others available as a search option.
3. **What does "relevant" mean in a label?** Proposed: "the trial would consider an adult with NSCLC, at some stage, for at least one arm". Stage, biomarkers and prior therapy are later slices' business. A narrower definition would make the search look worse for reasons it can't control.
4. **How big a sample?** About a quarter of treatment trials look relevant, so 300 sampled trials give roughly 75 relevant ones and a recall estimate within about ±5 points. More labels buy precision at a cost in hours. Leaning 300.
5. **Not-yet-recruiting trials?** Left out: a person can't enrol in one now, and the snapshot query already excludes them.
6. **What radius by default?** Leaning 100 miles, editable, with "anywhere in the US" as an option. A site with no coordinates (about 0.2% of sites) counts as distance unknown and doesn't exclude the trial.
