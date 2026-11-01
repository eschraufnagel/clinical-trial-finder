# intent: 0008 benchmark

**Author:** the repository owner
**Status:** Draft
**Date:** 2026-10
**Scope:** One slice. The finder's search and its deeper check are measured against judgments the project didn't write: the physicians' judgments in TREC 2021 and 2022, and the clinicians' in NIH-TrialBench. A comparison write-up follows from research §6. Two measurements need no model. One runs on the local model, behind a gate.

---

## In plain words

Every number this project has reported so far was checked against labels its own author wrote. That covers which trials suit someone with lung cancer, which rules the model read correctly, and which trials were clearly ruled out. The labels were written carefully, before any run, but they're one author's, and no doctor has read them.

Two public benchmarks were written by doctors:
- **TREC's Clinical Trials track** (2021 and 2022). Physicians judged, for made-up patients, whether each of thousands of trials was one the patient could join.
- **NIH-TrialBench** (2026). NIH investigators wrote made-up patients, each built around a trial they knew, and clinicians labelled trials for them as recommended, eligible but not recommended, or ineligible.

This slice runs the finder against both. It asks three things:
1. **Does the search keep the trials doctors judged a patient could join?** Measured on TREC's cancer patients.
2. **Does the search keep the trial an NIH investigator built a patient around?** Measured on NIH-TrialBench's cancer patients.
3. **Does the deeper check flag the trials clinicians called ineligible, and leave the rest alone?** Measured on NIH-TrialBench, first with everything the patient's file says, then with only what a patient would know.

Then it writes up how close the finder gets, and what still can't be compared.

There's a catch, and it shapes the slice. **Neither benchmark has lung cancer in any number.** TREC has no lung cancer patient. NIH-TrialBench has two among 126. The finder's questions are built for non-small cell lung cancer (NSCLC) only. So these benchmarks can't test the conversation itself, the part research §6 most wanted compared. They can test the parts that don't depend on the cancer type: the search, once it has words for another cancer, and the deeper check, which reads any trial's rules.

## Problem

**Nothing measured here has outside ground truth.**
- `docs/questions.md` says so in its Limits: "Agreement is with the mapper, not with the truth … Nothing here says which trials actually suit a person; that needs the benchmark in slice 0008."
- 0007's check was scored against labels by the same author as its patients and its spec (`docs/check.md`, Limits: "One author wrote the patients, the labels and the spec").
- 0001's search recall was scored against Claude-written relevance labels (`docs/search.md`).
- The product intent's open question 3 asks where ground truth comes from. It names Claude-authored vignettes, NIH-TrialBench and TREC, "one answer, or a combination" (`work/0000-product/intent.md`). The roadmap's open question 4 says to check NIH-TrialBench's license and oncology share first (`work/ROADMAP.md`).

**What the roadmap measures this slice by:** "The three-way comparison in research section 6" (`work/ROADMAP.md`, 0008). Section 6 has three parts:
- the same patient run three ways: full record to a matcher, the intake form alone, and the conversation;
- recall first;
- excluded trials in the top ten, questions asked, and unknowns turned into questions for the oncologist.

0003 already ran the three arms, on 20 made-up NSCLC patients, scored against the mapper (`docs/questions.md`: 89% of the record arm's short list from the conversation, 79% from the intake).

**What the benchmarks hold, checked while writing this intent (2026-10):**

*TREC 2021 and 2022* (`trec.nist.gov/data/trials2021.html`, `trials2022.html`):
- 125 patient notes (75 and 50), written as admission notes. Each judged trial is 0 not relevant, 1 excluded, or 2 eligible.
- About 35,000 judgments a year, against a registry copy of 2021-04-27: 375,580 trials, in five zip files totalling 1.8 GB (`trec-cds.org/2021.html`).
- **Nine notes are about a current cancer:**
  - eight from 2021: topic 1, anaplastic astrocytoma; 4, Burkitt's lymphoma; 11, papillary thyroid cancer; 15, pancreatic adenocarcinoma; 17, multiple myeloma; 25 and 61, breast cancer; 31, cervical cancer;
  - one from 2022: topic 11, gastric adenocarcinoma.
- **None is lung cancer.** Topics 13, 20 and 56 mention a past lymphoma or a pituitary adenoma, but they aren't about a cancer being treated.
- Across the nine: 4,672 judgments of 4,297 trials, of which 888 are eligible, 781 excluded and 3,003 not relevant.
- 0001's intent counted "about fourteen" cancer topics in 2021 (`work/0001-trial-snapshot/intent.md`). The count here is by reading each note for a cancer under treatment. The spec lists the nine so the owner can correct it.
- The TREC pages state no license for topics or judgments.

*NIH-TrialBench* (`github.com/TrialGPT2/TrialGPT2.0`, `data/nih_trialbench/raw/`, at commit `1c5f9eb`, 2026-10):
- **License:** an NLM public-domain notice ("United States Government Work … no restriction on its use or reproduction"), added 2026-10 in answer to an issue asking for one. It asks that the authors be cited.
- **126 vignettes from 11 NIH institutes. 41 are NCI's,** each a free-text oncology history (diagnosis, treatment lines with dates, biomarkers, labs, performance).
- **Their cancers vary widely:** cervical, endometrial, breast, head and neck, anal, gastroesophageal, penile, urachal, renal, bladder, prostate, urethral, germ cell, T-cell lymphoma, DLBCL, cutaneous squamous cell, Merkel cell, melanoma. **Two are NSCLC** (nci-11, nci-38).
- **One target trial each,** 13 targets for the 41 NCI vignettes. Many are baskets open to several cancers. 10 of the 13 are in this repository's 2026-10 snapshot, covering 29 of the 41 vignettes.
- **Clinician labels on 395 NCI pairs over 106 trials:** 274 recommended, 86 eligible but not recommended, 35 ineligible. The 35 ineligible pairs cover 20 trials and 23 vignettes.
  - The labelled trials were TrialGPT 2.0's top ten, so the labels are about trials a matcher already liked.
  - 101 of the 395 pairs are on trials in the snapshot: 73 recommended, 18 eligible but not recommended, 10 ineligible.
- Each trial's criteria come as raw text, with title, age, sex and conditions, in `trial_search_space.jsonl` and the packaged `trials/NCT*.json`.

**What that means for each part:**
- **The search** has words for NSCLC only (`data/cancer-types/nsclc.json`, plus `generic.json` for "solid tumor" and the like). To run on TREC's breast or myeloma patients, or NIH-TrialBench's, it needs a vocabulary for each of their cancers. `CancerType.measured` exists for exactly this: a type the search can use that no result has measured (`src/search/vocabulary.ts`).
- **The questions, the order and the short list** rest on the 31 NSCLC facts and the NSCLC mappings (`docs/facts.md`). Neither benchmark gives them clinician-labelled NSCLC patients at a usable number. With two NSCLC vignettes, a three-way comparison against clinician labels would be two anecdotes.
- **The deeper check** is cancer-agnostic. It parses any trial's rules (`src/criteria/`), and the screening agent asks about them (`src/screening/`). With nothing carried in, its path is the inherited one; 0007 OQ 10 said "0008's benchmark is where the agent is compared" (`work/0007-deeper-check/intent.md`). NIH-TrialBench's 35 ineligible pairs and 360 others are outside labels for 0007's two measures: clearly-ruled-out trials caught, and false alarms.

**Carried in, and where they go:**
- **The roadmap row** (`work/ROADMAP.md`, 0008): "NIH-TrialBench and TREC runs, including the search on TREC's other cancer topics; the comparison write-up". This slice's outcome, parts 1 to 4.
- **0001 moved TREC here:** "TREC has no NSCLC topics, so it moves to 0008" (`work/ROADMAP.md`, 0001). It found TREC's trials "come from a 2021 copy of the registry and have mostly closed" (`work/0001-trial-snapshot/intent.md`). OQ 2.
- **0005 and 0006 sent the unmarked trials for other cancers here,** "for 0008's run on TREC's other cancer topics" (`work/0006-hosted-reader/intent.md`, OQ 6). The roadmap's open question 6 adds that 0007's picks held none of them. Weighed in OQ 7.
- **0007's measures and what they found** (`docs/check.md`; `work/0007-deeper-check/plan.md`, Records, step 14):
  - on 50 held-out pairs, 5 of 16 clearly-ruled-out trials caught, all among the 9 the patient could know;
  - false alarms on 27 of 34 others;
  - the false alarms were mostly "needs your records" lines and rules for one part of a trial.

  This slice measures the same two numbers against clinicians, and splits them the same way: what the full file says, and what a patient would know (OQ 4, OQ 5).
- **0007's Gate 1 runs:** reasoning off for the check, `READ_MAX_OUTPUT_TOKENS` at 4,096, and `CHECK_REVISION` 2 (`work/0007-deeper-check/plan.md`, Records, step 12). 0007's held-out took 7.8 hours for 50 pairs, and long trials took up to 52 minutes each. These set this slice's sizes (OQ 6).
- **Known and left open,** recorded at the baseline as 0007 recorded them:
  - `other:eval -- --check` and `-- --check --dev` fail only on "labelsSha256 differs";
  - a failed **Check these** on the page says nothing.

  This slice touches neither.

## Proposed outcome

At the end of this slice:

1. **The benchmark data, in the repository, trimmed.**
   - TREC's nine cancer notes, their judgments, and the 4,297 judged trials, read from the 2021-04-27 copy a person downloads.
   - NIH-TrialBench's 41 NCI vignettes, their labels, and the trials they name.

   Each comes with its source, its checksum and its license, as far as one is stated (OQ 1, OQ 2).
2. **A vocabulary for each benchmark cancer,** in `data/cancer-types/`, marked unmeasured. Each is written from the cancer's name and its MeSH heading, before any judged trial is looked at (OQ 3).
3. **The search on TREC's cancer notes.** For each note, the search's cancer and person stages run over that note's judged trials. It reports how many trials judged eligible or excluded the search keeps, and how many judged not relevant. No model. Scored once (OQ 2, OQ 3).
4. **The search on NIH-TrialBench's NCI vignettes,** over the 2026-10 snapshot. It reports whether each vignette's target trial is kept, and how many of its clinician-labelled trials in the snapshot are kept, by label. No model. Scored once.
5. **The deeper check against clinicians' labels,** on NIH-TrialBench pairs, on the local model. Two arms, the same trials and the same pairs:
   - **from the full file:** a simulated patient answers from the whole vignette;
   - **from what they'd know:** a simulated patient answers from a version of the vignette with what patients often don't know taken out, by written rules.

   It reports ineligible pairs flagged and eligible pairs falsely flagged, in each arm. It also reports no verdict words, every unknown on the record, and questions asked. Dev first, then held-out once, after a gate (OQ 4, OQ 5, OQ 6).
6. **The comparison write-up,** `docs/benchmark.md`. It covers:
   - what each benchmark could test, and what it couldn't, including the three-way comparison for NSCLC;
   - the numbers from parts 3 to 5, beside this project's own-label numbers for the same stage;
   - TrialGPT 2.0's published figures as context, not as a like-for-like comparison.

   The roadmap's open question 4 is answered (OQ 8).

## Affected users and systems

- **People using the finder:** nothing changes on the page. The new vocabularies make other cancers searchable from `npm run search`, marked unmeasured until this slice's result. The page and the conversation stay NSCLC only (OQ 3).
- **The search** (`src/search/`): unchanged in code. New files in `data/cancer-types/`. `searchTrials` already takes any trial list, so the TREC trials, converted to `SnapshotTrial`, run through it unchanged.
- **The check** (`src/check/`, `src/screening/`, `src/criteria/`): unchanged in code. It runs with nothing carried in, as 0007's `startCheck` allows, on trials built from NIH-TrialBench's records.
- **The eval harness:** new `evals/benchmark/` for the loaders, the scoring and the result checks. A new participant answers from a free-text summary, under `evals/participant/`.
- **Scripts:** a TREC extractor, an NIH-TrialBench loader, `benchmark:search`, and runners for parsing and checking NIH-TrialBench pairs. Every one is run by a person.
- **Data:** `data/benchmark/` holds the trimmed TREC and NIH-TrialBench files. NIH-TrialBench pair parses go under `data/criteria/`, as 0007's did. Results go under `evals/results/benchmark/`.
- **Docs:** `docs/benchmark.md` (new), and the Limits in `docs/search.md`, `docs/check.md` and `docs/questions.md`. Also `work/ROADMAP.md`, the README (one line, no findings) and `CLAUDE.md` (commands, layout, any boundary).
- **Not touched:** the page, the server, the transport, the fact vocabulary and its mappings, the conversation, the order, the reader.

## Constraints

- **No PHI.** Both benchmarks are synthetic: TREC's notes were written for the track, and NIH-TrialBench's vignettes are "synthetic patient summaries". Nothing real is added. Any knowledge-limited version of a vignette is derived by written rules and committed beside its source.
- **No network at runtime, and no new host in code.**
  - TREC's corpus and NIH-TrialBench's release are downloaded by a person, into gitignored `local/`.
  - Scripts read them from there. No file under `src/` or `scripts/` names `trec.nist.gov`, `trec-cds.org` or `github.com`, and `tests/boundary.test.ts` keeps it so (OQ 1).
  - If the plan chose registry fetches instead, they'd go through `src/trials/registry.ts`'s existing host.
- **Licenses respected and recorded.**
  - NIH-TrialBench is public domain by NLM's notice; its authors are cited in `docs/benchmark.md` and beside the data.
  - TREC's pages state no license. Only the nine notes, their judgments and trimmed records of the judged trials are committed, with the source named (OQ 1).
- **Every spending run is a gate.** Local-model hours are spent only after a gate. A hosted run is dry without `--spend`, capped, and run only with the owner's go-ahead. The plan proposes none.
- **No verdict, unknowns never exclude, nothing removed.** The check runs as on the page. Its records are scanned for verdict words, and every unknown must reach the record.
- **The benchmarks' labels are not ours to change.** Clinicians' and physicians' labels are used as given. Where this project reads them differently (excluded counted as relevant to the disease, for instance), the convention is written before scoring and stated beside the result.
- **Held-out once.** The vocabularies and the participant's rules are fixed before their result is computed. The check's held-out pairs are run once, after a dev gate.
- **Results record model, quantization, temperature and seed,** or say why none applies. Months, not days.
- **Proportionate.** The slice measures what the benchmarks can test. It doesn't build what the finder lacks to use them more fully, such as facts for other cancers. That is named as what would be needed.

## Open questions

1. **How do the benchmarks' files get here?**
   - NIH-TrialBench is small (about 6 MB of raw JSONL). TREC's judgments and notes are about 1.4 MB. TREC's registry copy is 1.8 GB zipped, of which 4,297 trials are needed.
   - A script fetching any of them would need a new host in the network exceptions.
   - **Leaning:** a person downloads all three into `local/benchmark/`, as `README`-style steps say: TREC's five zips unzipped, TREC's two topic files and two judgment files, and NIH-TrialBench's `raw/` and `trials/` folders at a pinned commit. A script checks each file's sha256 against a committed manifest, reads what it needs, and writes trimmed, committed files under `data/benchmark/`. No new host.
   - For TREC, only the nine notes and their judgments are committed, with the judged trials trimmed to the search's fields. For NIH-TrialBench, only NCI's rows, and the 106 labelled trials, which include all 13 targets.
2. **Which registry text do TREC's trials use: 2021's or today's?**
   - The judgments were made on the 2021-04-27 text. Today's records would come from the existing registry host, but five years of amendments would sit between the text judged and the text searched.
   - **Leaning:** 2021's, from the corpus. The corpus is XML, and a small extractor for the dozen fields the search reads avoids a new dependency. A dependency is the plan's call if the extractor proves fragile on the judged trials.
   - Distance and status don't apply to 2021 trials, so the search runs its purpose, cancer, and age-and-sex stages, with every purpose kept.
3. **How are the other cancers' vocabularies written, and what do they claim?**
   - The search needs one per benchmark cancer. That's 8 for TREC (glioma, lymphoma, thyroid, pancreatic, myeloma, breast, cervical, gastric), and about 20 for NIH-TrialBench's NCI vignettes, overlapping on breast, cervical, lymphoma and gastroesophageal.
   - **Leaning:** one file per cancer, written before any judged trial or label is read. Each has names, MeSH headings and biomarkers, from the cancer's name, its MeSH entry and what NSCLC's file does. Every file has `measured: false`.
   - A vignette whose cancer fits no sensible single type (a urachal or SMARCB1-deficient renal cancer, say) gets the nearest broad type, and the spec lists the mapping.
   - The result reports each type's numbers but doesn't set `measured` to true. One benchmark's few patients per type aren't the held-out sample 0001 measured NSCLC on.
   - These files are search-only: no facts, no conversation. The page doesn't offer them.
4. **What does the check's "from what they'd know" arm hide?**
   - The full vignette is the upper bound, research §6's "full record".
   - Research §1 and 0003's patients say what people often don't know: biomarker results, lab values, exact dates and stage details.
   - **Leaning:** a written convention, `evals/cases/benchmark/KNOWING.md`, saying what a patient's own account keeps and drops: it keeps the cancer, where it has spread, treatments by name and how each ended, and day-to-day activity; it drops biomarker and test results, lab values, scan details and staging codes. It's applied by hand, once, to each vignette in the check's pairs, before any check runs, and committed beside the vignette.
   - A second derivation by a separate agent, on a sample, checks the convention can be followed. Disagreements are shown at the gate, not resolved silently.
5. **Which pairs does the check run, and what counts as a catch?**
   - **Leaning: every pair on a trial whose rules can be parsed,** for the 35 ineligible pairs, plus 35 of the 360 others, drawn by hash, stratified to keep recommended and eligible-but-not-recommended in their proportions. That's 70 pairs over 42 trials and 35 vignettes, split by vignette hash into dev and held-out.
   - **A catch** is an ineligible pair whose record holds at least one "may not fit" line. **A false alarm** is the same on an eligible pair.
   - Clinicians wrote a comment on 33 of the 35 ineligible pairs. Some name a rule ("Tumor does not meet RARECARE definition"), and some say the trial is for another disease or another purpose. A catch "for the right rule" is reported only where the comment names one. A person matches the comment to the trial's words before the run, and writes the match down.
   - "Eligible but not recommended" counts as eligible: the check never judges whether a trial is worth it.
6. **Which model, and how big a run?**
   - 0007's held-out averaged about 9 minutes a pair on the local model, and long trials took much longer. Two arms of 70 pairs is about 140 checks, so roughly 20 to 25 hours of local time, plus about an hour of parsing.
   - **Leaning:** the local model, as 0007 ran, with the same settings and `CHECK_REVISION`. Dev is 14 pairs in both arms, then held-out once after a gate.
   - A hosted run would be faster. It's proposed only if the owner asks, with a dry-run estimate at the gate, because the check is unmeasured on hosted models (`docs/check.md`, Limits) and a hosted arm wouldn't compare with 0007's numbers.
7. **Does the slice measure the other-cancer mark on TREC?**
   - 0006 hoped TREC would help with the 14 trials for other cancers that the mark leaves unmarked.
   - TREC's judgments say whether a trial suits a breast cancer patient, not whether it's closed to NSCLC. A trial eligible for one is often a basket trial open to both. Labels for "not for NSCLC" would still have to be written here, as 0005's were.
   - **Leaning:** no. The search on TREC's other cancers (part 3) is what the roadmap names, and the mark stays measured by 0005's labels. `docs/benchmark.md` says why TREC can't settle it.
8. **What does the comparison write-up claim, and what does it leave out?**
   - Research §6's three-way comparison needs one patient run three ways against outside labels, and for NSCLC no benchmark has enough patients.
   - **Leaning:** `docs/benchmark.md` lays out what each part was measured against before and after:
     - **search recall:** own labels for NSCLC, beside TREC's and NIH-TrialBench's for other cancers;
     - **the three arms:** against the mapper only, in 0003;
     - **the check:** own labels in 0007, beside clinicians' here, in both arms.
   - It says plainly that the conversation's three-way comparison against outside truth isn't possible on these benchmarks, and names what would make it possible: clinician-labelled NSCLC patients against the snapshot.
   - TrialGPT 2.0's NIH-TrialBench figures are quoted as context. Its task (rank 1,373 trials from a full note) isn't this one (keep a target trial through a structured search, or flag one).
   - The two NSCLC vignettes are shown as worked examples, with no rate.
9. **Is this one slice or two?**
   - The data and the two search measurements need no model and could land alone. The check against clinicians spends a day of local time.
   - **Leaning:** one slice, with the check behind a gate. That gate can stop the slice at the search measurements and the write-up, and the plan's stages make that a clean cut.
