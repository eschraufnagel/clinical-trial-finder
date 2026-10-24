# plan: 0001 trial snapshot and search

**Intent:** `work/0001-trial-snapshot/intent.md` · **Spec:** `work/0001-trial-snapshot/spec.md`
**Branch:** `0001-trial-snapshot`, from `main` at `2198f9a`; intent and spec `54da4ef`.

---

## Context

Every later slice works on the trials this search returns, and the search is the one stage whose mistakes nothing downstream can recover. This slice builds:

- a pinned local copy of the 5,740 recruiting interventional cancer trials with a US site;
- ZIP code locations;
- an NSCLC vocabulary, as data;
- a deterministic search.

It then measures how many trials that could take a person with NSCLC the search keeps. TREC turned out to have no NSCLC cases, so ground truth is Claude-written disease-relevance labels on a random, held-out sample of this snapshot.

**Nothing here spends money.** No model is called. The network calls are made by two scripts: about seven requests to ClinicalTrials.gov through `src/trials/registry.ts`, and one file from the Census Bureau. Claude runs both at the steps named below, which plan approval covers; the owner can run them instead. No `--spend`, no `.env`, no new dependency.

**Baseline**, from `npm run check` on `54da4ef`: 42 test files, 661 passed and 8 expected fail (669), in about 0.5 s.

---

## Order of work

### Stages and gates

| Stage | Steps | Ends at | What you can see at the end |
| --- | --- | --- | --- |
| **A. The snapshot** | 1–5 | **Gate 1** | `data/snapshot/2026-10/` written (not yet committed) with its manifest; `data/geo/zcta-2025.csv` |
| **B. The labels** | 6–8 | **Gate 2** | 300 held-out and ~50 dev trials labelled with reasons, written before any search code exists |
| **C. The search and its measurement** | 9–13 | **Gate 3** | `npm run search -- ...` works; a committed result with held-out recall, precision and every miss |
| **D. Written up** | 14–15 | PR | docs, CLAUDE.md, README, roadmap, review passes |

**Gate 1: commit the full snapshot, or keep it on this machine? (intent, open question 1)**
- Claude reports the files' real sizes and the manifest.
- **Committing** makes every result checkable from a fresh clone, at about 11 MB per pinned version, permanently in git history.
- **Gitignored** keeps the repository small, but a result can then only be checked by refetching, and the registry will have moved.
- **What it costs to be wrong:** stage B's labels (several hours) are written against this snapshot's sample, and later slices pin their parses to it. Changing course after stage B means relabelling or living with a result nobody else can check.
- Claude recommends committing. The owner decides.

**Gate 2: do the labels follow their written convention? (spec §6.1)**
- Claude picks 20 labels by hash (`sha256("gate2:" + nctId)`, the first 20), 15 held-out and 5 dev, and lists each with its trial's conditions, its deciding quote and its reason.
- The question needs no clinical judgment: does each reason apply `ANNOTATION.md` as written? Where it doesn't, the convention or the label is fixed, and all labels are re-checked for the same fault.
- **What it costs to be wrong:** every recall number rests on these labels, and changing a held-out label after stage C has scored it would be tuning on the held-out set. This is the last point where labels change freely.
- **The answer can be no:** a convention that reads ambiguously on real trials, such as basket trials that list NSCLC among excluded cohorts, is a plausible finding.
- The owner may delegate this, as with earlier judgment gates. If so, Claude re-reads the 20 against the convention and records the outcome. Either way, `docs/search.md` says no independent labeller checked them.

**Gate 3: is the search good enough to build 0002 on? (spec §6.5)**
- The bar: held-out recall at least 0.95, with every held-out miss read and explained.
- Below the bar, one round of vocabulary changes on the dev pool, then the held-out sample is scored once more. A second miss is reported to the owner as a finding, not tuned further.
- **What it costs to be wrong:** 0002 parses overnight and maps facts for what the search keeps, and every later recall number inherits this one's gap.

Stage D needs no gate: it's documentation, and the review passes.

### Steps

Each step is one commit, made through `npm run check && git commit`. No test mocks a module or stubs a global; `fetch` is injected. No commit carries a Co-Authored-By trailer.

**Stage A: the snapshot**

1. **Commit this plan** as `work/0001-trial-snapshot/plan.md`, with three spec amendments, each marked "amended in plan":
   - §2.3: `month` is `dataTimestamp.slice(0, 7)`, not the clock, so a refetch's month is the registry's.
   - §6.2: the dev pool is defined by a fixed text rule, not by the first vocabulary, so it can be drawn before any search code exists (step 6).
   - §6.3: result files are named `NN-<first 12 hex of vocabularySha256>.json`, which is what `nextRunFile` in `evals/run-file.ts` accepts.

2. **The snapshot's shape (spec §2.2, §2.3).**
   - `src/trials/snapshot-types.ts`: `SnapshotTrial`, `Site`, `SnapshotManifest`.
   - `src/trials/snapshot-trim.ts`: `trimSnapshotStudy(raw, source)`, reusing `trimStudy`'s private helpers. Move `asRecord`, `required`, `optional`, `optionalBoolean` and `stringArray` from `trim.ts` into `src/trials/read.ts`, unchanged, and import them in both. `trimEligibility` is exported from `trim.ts` for reuse.
   - `src/trials/snapshot-validate.ts`: `validateSnapshotTrial(value, where)`, hand-written in the style of `validate.ts`.
   - `src/trials/snapshot-write.ts`: `serializeSnapshot(trials)` gives sorted JSON lines with keys in declaration order. `writeSnapshot(dir, trials, meta)` gzips at level 9 and writes `trials.jsonl.gz` and `manifest.json`, computing `count`, `sha256` and `fields`.
   - `src/trials/snapshot-load.ts`: `loadSnapshot(dir)`, as spec §2.4.
   - `src/trials/index.ts` exports the types and `loadSnapshot`. `trim` and `write` stay unexported, as `trim.ts` does today.
   - **Fixture:** `tests/trials/fixtures/snapshot-study.json`, one real registry record from the stage-A download with US sites. Every contact's name, phone and email is replaced by an invented value (`Site Contact`, `555-0100`, `contact@example.org`), and the file's sibling `README.md` says so.
   - **Tests:**
     - `tests/trials/snapshot-trim.test.ts`: the fixture trims to an expected `SnapshotTrial`. No invented contact value appears anywhere in the output. Non-US sites are dropped. Missing required fields are all reported.
     - `tests/trials/snapshot-load.test.ts`, on three made-up trials written to a `mkdtemp` directory: round trip; byte-identical rewrite; a checksum mismatch, a wrong count, unsorted or duplicate IDs, and a malformed line each throw `TrialFixtureError` naming the file and line.

3. **The registry request and the fetch script (spec §2.1, §2.4).**
   - `src/trials/registry.ts`:
     - `SNAPSHOT_QUERY`, the fixed parameter string;
     - `fetchSnapshotPage(pageToken, fetch)`, which builds the URL as a template literal with the host written out, from `SNAPSHOT_QUERY` and an `encodeURIComponent`'d token only;
     - `fetchDataTimestamp(fetch)`.
     - Same timeout, headers and error messages as `fetchStudy`.
   - `scripts/fetch-snapshot.ts`: pages with a 1.5 s pause, trims and validates each study, sorts, and writes with `writeSnapshot`. `--dry-run` loads the committed snapshot and prints `compareSnapshots(before, after)`: added, removed and changed counts with up to 20 IDs each, and a non-zero exit on any difference. `compareSnapshots` is exported; the script runs only under `import.meta.main`.
   - `package.json`: `snapshot:fetch`.
   - **Tests:** `tests/trials/registry.test.ts` gains page and version cases (exact URLs, a token with `&` encoded, errors, injected fetch). `tests/scripts/fetch-snapshot.test.ts` tests `compareSnapshots`.
   - `tests/boundary.test.ts` needs no change: `registry.ts` still names only `clinicaltrials.gov`. A run confirms it.

4. **ZIP code locations (spec §3).**
   - `src/search/geo.ts`: `loadZipPoints(path)`, `pointForZip(zip, points)`, `UnknownZipError` and `milesBetween(a, b)` (haversine, R = 3,958.8). `src/search/index.ts` starts here.
   - `scripts/fetch-zips.ts`: fetches the 2025 ZCTA gazetteer zip from `www2.census.gov`. `unzipSingle(buffer)` reads the local file header and inflates with `zlib.inflateRawSync`, refusing anything but one deflated entry. `toZipCsv(text)` keeps `GEOID`, `INTPTLAT` and `INTPTLONG`, sorted. Both are exported and tested. `package.json`: `geo:fetch`.
   - **Tests:**
     - `tests/search/geo.test.ts`: a five-line CSV fixture; ZIP+4; unknown and malformed ZIPs; `milesBetween` on two known city pairs within a mile.
     - `tests/scripts/fetch-zips.test.ts`: `unzipSingle` on a zip built in the test with `deflateRawSync`; `toZipCsv` on three gazetteer lines.
   - **Run** `npm run geo:fetch` and commit `data/geo/zcta-2025.csv`, then record its row count and size.
   - `biome.jsonc` ignores `data/geo` and `data/snapshot`.

5. **Fetch the snapshot, then stop at Gate 1.**
   - Claude runs `npm run snapshot:fetch` and records in "Records" the count, both file sizes, the checksum, `dataTimestamp`, the treatment-purpose count, and the time taken.
   - Then `npm run snapshot:fetch -- --dry-run` straight after, to show a re-run is clean, or what moved in minutes.
   - The files are left uncommitted, and Claude **stops for Gate 1**.
   - After the gate, they're committed as decided. If gitignored, `.gitignore` gains `snapshot/`, the default directory in `loadSnapshot`'s callers changes, and this plan and spec §2.3 say so.

**Stage B: the labels**

6. **The labelling tools, which can't see a search (spec §6.1, §6.2).**
   - `evals/cases/search/ANNOTATION.md`: the definition of relevant in spec §6.1, with worked cases drawn from the intent's examples: a basket trial, an NSCLC cohort inside a breast cancer trial, a small-cell-only trial, a brain-metastasis trial, and a "no history of NSCLC" exclusion.
   - `evals/search/labels.ts`: `SearchLabels` type, `loadSearchLabels(path)` (validates: unique IDs, every label boolean with a non-empty reason, `set` valid) and `labelsSha256`.
   - `scripts/search-sample.ts` (`search:sample`) draws both sets from the committed snapshot and writes the skeleton with `relevant: null` and empty reasons. It refuses to overwrite an existing file.
     - **Held-out:** treatment-purpose (or null-purpose) trials ordered by `sha256("0001:" + nctId)`, the first 300.
     - **Dev:** treatment trials not in the held-out set whose normalized title or eligibility text contains `non small cell`, `nsclc`, `lung cancer`, `lung carcinoma`, `lung adenocarcinoma` or `thoracic`, and whose conditions, keywords and MeSH terms contain none of `lung`, `nsclc`, `thoracic`. That's the "mentions it but doesn't name it" pool, drawn by a fixed rule. If it exceeds 80, the first 80 by `sha256("dev:" + nctId)`.
   - `scripts/search-show.ts` (`search:show -- <NCT ID>`): prints a trial for labelling. `--next` prints the next unlabelled one in the file.
   - `normalizeText` from spec §4 is written here, as `src/search/normalize.ts`, because the dev rule uses it. It's a leaf module that imports nothing.
   - **`tests/boundary.test.ts`:** a new block, "the search labelling tools cannot see the search". `search-sample.ts` and `search-show.ts` reach no file under `src/search/` except `normalize.ts`, and nothing under `src/models/`. It walks a real graph and would catch an import, in the style of the existing labelling-tool block.
   - **Tests:** `tests/evals/search-labels.test.ts` covers the loader's rejections. `tests/search/normalize.test.ts` covers the spec §4 cases.
   - `package.json`: `search:sample`, `search:show`.

7. **Draw the sets and label them.**
   - Run `search:sample`, then commit the skeleton, so the sets are fixed before any label is written.
   - Claude labels every trial from `search:show` output only, following `ANNOTATION.md`, in four commits: three of 100 held-out labels each, then the dev pool.
   - No search code exists yet, so no label can be informed by a search result.
   - Each commit records any convention question that came up, in "Records".

8. **Stop at Gate 2.** Print the 20 chosen labels as described above. Any changes from the gate are one commit, recorded.

**Stage C: the search and its measurement**

9. **The vocabulary (spec §4).**
   - `data/cancer-types/nsclc.json` with `measured: false` and `data/cancer-types/generic.json`, both written from the intent's examples, not from the labels. Claude doesn't open the labels file while writing them.
   - `src/search/vocabulary.ts`: `loadVocabulary(dir, id)`, its rejections, `vocabularySha256`, and `reasonsFor(trial, type, generic)`.
   - **Tests:** `tests/search/vocabulary.test.ts`, with each reason firing and not firing on made-up trials, and the loader's rejections.

10. **The search (spec §5).**
    - `src/search/types.ts` and `src/search/search.ts`, with `searchTrials`, `parseAgeLimit` and `flagsFor`, all pure.
    - `src/search/index.ts` exports the public surface.
    - **Tests:** `tests/search/search.test.ts` on about ten hand-built trials and a three-ZIP table, covering every case in spec §7's search bullet, and that the funnel counts agree with the candidates.
    - **`tests/boundary.test.ts`:** `src/search/` imports nothing from `src/models/`, `src/criteria/` or `src/screening/`, and would catch it.

11. **The command (spec §1).**
    - `scripts/search.ts` (`npm run search`): parses flags, loads the snapshot, ZIPs and vocabulary, and prints the funnel and rows, or JSON.
    - `formatResult(result)` is exported and tested in `tests/scripts/search-cli.test.ts`: the funnel lines, a row with each flag, and an unknown distance.

12. **The measurement (spec §6.3).**
    - `evals/search/metrics.ts`: `metricsFor(rows)` with the Wilson interval.
    - `scripts/search-eval.ts` (`search:eval`): runs the cancer-type stage on labelled trials and writes `evals/results/search/NN-<vocab12>.json`.
      - `--dev` scores only the dev set and writes to `evals/results/search/dev/`.
      - `--check` reruns the latest committed result and exits non-zero if any row differs.
    - `tests/evals/search-result.test.ts`, as spec §7: every committed result's metrics are re-derived from its rows, rows are checked against the committed labels, and the checksums against the labels, vocabulary and manifest. When there's no result yet, it checks that it can find none and would fail on a tampered one, using a made-up result in the test.
    - `tests/evals/search-metrics.test.ts`: Wilson on known values; recall and precision on a small table.

13. **Measure, then stop at Gate 3.**
    - Run `search:eval -- --dev` and commit the result.
    - Improve `nsclc.json` and `generic.json` only for dev misses, one commit, recording each term added and why. Rerun `--dev` and commit.
    - Freeze the vocabulary. Run `search:eval` once on held-out and dev, then commit.
    - Record held-out recall and its interval, precision, the per-reason breakdown, and every held-out miss with its label reason. `search:eval -- --check` passes.
    - Try three made-up searches with `npm run search` (Chicago 60611 at 50 miles, a rural ZIP at 100 miles, `--miles anywhere`) and record their funnels.
    - **Stop for Gate 3.**
    - If held-out recall misses the bar: one more dev-only round, one more held-out run, then the result as found.
    - Set `measured: true` in `nsclc.json` only when a committed held-out result exists.

**Stage D: written up**

14. **Docs.**
    - `docs/search.md`: what the search does, the result, every held-out miss, the labeller's limits, and that the dev numbers are tuned.
    - `CLAUDE.md`: "Where things live" (`src/search/`, `data/snapshot/`, `data/geo/`, `data/cancer-types/`, `evals/cases/search/`, `evals/search/`) and commands (`snapshot:fetch`, `geo:fetch`, `search`, `search:sample`, `search:show`, `search:eval`). The labelling-tool boundary sentence gains the search's, and the network exception lines name the snapshot request.
    - `README.md`: "Run it" gains the search command, with no numbers.
    - `work/ROADMAP.md`: the 0001 row marked done, its "Measured by" corrected (TREC has no NSCLC cases; noted under 0006).

15. **Review passes (`REVIEW.md`), recorded here.**
    - All five passes against `git diff main`.
    - `npm run check` again, and `search:eval -- --check`.
    - "Files that change" checked against `git diff --stat main`.
    - Then stop. The PR is opened on the owner's word, saying which gates were held and how each was answered.

## Files that change

**New:**
- `src/trials/read.ts`, `snapshot-types.ts`, `snapshot-trim.ts`, `snapshot-validate.ts`, `snapshot-write.ts`, `snapshot-load.ts`
- `src/search/index.ts`, `normalize.ts`, `geo.ts`, `vocabulary.ts`, `search.ts`, `types.ts`
- `scripts/fetch-snapshot.ts`, `fetch-zips.ts`, `search.ts`, `search-sample.ts`, `search-show.ts`, `search-eval.ts`
- `evals/search/labels.ts`, `metrics.ts`
- `evals/cases/search/ANNOTATION.md`, `nsclc.json`
- `evals/results/search/` (`dev/` too)
- `data/snapshot/2026-10/` (if Gate 1 says commit), `data/geo/zcta-2025.csv`, `data/cancer-types/nsclc.json`, `generic.json`
- `tests/trials/snapshot-trim.test.ts`, `snapshot-load.test.ts`, `fixtures/snapshot-study.json`, `fixtures/README.md`
- `tests/search/geo.test.ts`, `normalize.test.ts`, `vocabulary.test.ts`, `search.test.ts`
- `tests/scripts/fetch-snapshot.test.ts`, `fetch-zips.test.ts`, `search-cli.test.ts`
- `tests/evals/search-labels.test.ts`, `search-metrics.test.ts`, `search-result.test.ts`
- `docs/search.md`, `work/0001-trial-snapshot/plan.md`

**Modified:**
- `src/trials/trim.ts` (helpers moved out, `trimEligibility` exported), `registry.ts`, `index.ts`
- `tests/trials/registry.test.ts`, `tests/boundary.test.ts`
- `package.json`, `biome.jsonc`, `.gitignore` (only if Gate 1 says gitignore)
- `CLAUDE.md`, `README.md`, `work/ROADMAP.md`, `work/0001-trial-snapshot/spec.md` (the three amendments)

**Not touched, checked with `git diff main` at step 15:** `src/models/`, `src/criteria/`, `src/screening/`, `src/plain/`, `src/transport/`, `data/trials/`, `data/plain/`, `evals/cases/labels`, `evals/cases/vignettes`.

## Reused, not rebuilt

- **Registry requests:** `fetchStudy`'s timeout, headers, error messages and injected-`fetch` pattern (`src/trials/registry.ts`).
- **Trimming:** `trimStudy`'s field helpers and `trimEligibility` (`src/trials/trim.ts`), moved, not copied.
- **Validation and errors:** `validateTrial`'s style and `TrialFixtureError` (`src/trials/validate.ts`, `types.ts`).
- **Dry run and drift:** `fetch-trials.ts`'s `--dry-run`, non-zero exit and `import.meta.main` guard.
- **Run numbering:** `nextRunFile` (`evals/run-file.ts`).
- **Labelling independence:** the boundary test's labelling-tool block, which is the model for the new block.
- **Registry test harness:** `answering()` in `tests/trials/registry.test.ts`.

## Risks

- **The snapshot is large for git.** That's Gate 1's question.
- **The registry moves between fetch and labelling.** Labels are pinned to the committed snapshot's month. A refetch is a new snapshot and a new measurement, never a silent replacement.
- **Labeller bias.** Claude writes both labels and vocabulary. Mitigations: labels are written before any search code exists; the vocabulary's first version is written without opening the labels; tuning uses the dev pool only; the held-out set is scored once (twice at most, per Gate 3). It's still one labeller, and `docs/search.md` says so.
- **`rules` matching hurts precision** by matching exclusions. It's reported per reason. If precision collapses, it's a Gate 3 finding, and the reason can be dropped for 0002 without changing the labels.
- **Loading the full snapshot takes about a second.** Only scripts load it. A test that did would show in `npm test`'s time.
- **Gazetteer gaps.** Delivery-only ZIPs aren't ZCTAs. The error says to try a nearby ZIP.
- **A real record as a fixture.** Its contacts are replaced before it's committed, and a test proves none survives trimming.

## Verification

- `npm run check` at every commit; `npm test` stays under a second.
- `npm run snapshot:fetch -- --dry-run` straight after the fetch: clean, or the minutes' drift recorded.
- `npm run search:eval -- --check` passes at steps 13 and 15.
- `npm run search` with the three made-up searches in step 13, funnels recorded.
- `grep -rn "fetch(" src` shows only `src/models/` and `src/trials/registry.ts` (plus the transport's relative client).
- `git diff main` on the "not touched" paths is empty at step 15.

## Records

Written as the work goes: the snapshot's real numbers, the gate answers, convention questions from labelling, vocabulary changes with reasons, and the measured result.

- **Step 2.** The fixture is NCT07148128: a basket trial with two US and two non-US sites, central and site contacts, keywords and MeSH terms. Its contacts and the responsible party were replaced before it was written. `npm test`: 677 passed, 0.58 s.
- **Step 3.** Two choices the plan didn't spell out:
  - The script writes to `data/snapshot/<month>/`, the month taken from the registry, and refuses a month that already has a manifest unless given `--force`. A same-month refetch would otherwise overwrite the snapshot that labels are pinned to.
  - The three requests share one `API` base constant, so `registry.ts` still names its host exactly once, which the boundary test's `findHosts` check expects.
- **Step 4.** `data/geo/zcta-2025.csv`: 33,791 ZIPs, 0.91 MB. The gazetteer is pipe-separated with a single deflated entry and no data descriptor. The test fixture's five rows are copied from the committed table.
- **Step 5, the snapshot.** `npm run snapshot:fetch`: six pages, 21 s.
  - Registry data of 2026-10-16T09:00:05; month 2026-10.
  - 5,740 trials. `trials.jsonl.gz` is 11.3 MB (43.2 MB uncompressed), `manifest.json` 0.7 KB, sha256 `76099a0e…f1cf6a3d`.
  - 80,137 US sites, 167 without coordinates.
  - Purposes: treatment 4,241; supportive care 527; diagnostic 296; prevention 189; health services research 147; screening 131; other 125; basic science 57; device feasibility 27; none missing.
  - `--dry-run` straight after: 0 added, 0 removed, 0 changed.
  - `loadSnapshot` on the full snapshot: 0.33 s, faster than the spec's estimate of about a second.
  - **The files are not committed. Stopped for Gate 1.**
- **Gate 1, answered (owner, 2026-10): commit the snapshot.** The owner looked at a readable preview first (what takes the space: eligibility text 53%, US sites 29%; three trials as stored; 25 at random), then agreed with the recommendation.
- **Step 6.** The labelling tools as planned, and one test the plan didn't list, `tests/scripts/search-sample.test.ts`, for the draw's two rules.
- **Step 7, the draw.** 4,241 treatment trials; held-out 300. The dev rule matched 128 trials, so the cap applied: 80 by `sha256("dev:" + nctId)`.
- **Step 7, a change to the labelling tool.** After 15 labels read in full (about 3,000 tokens a trial), `search:show` gained `--brief`. It prints the header and only the eligibility lines containing a fixed list of disease words (cancer, carcinoma, tumor, malignancy, neoplasm, sarcoma, lymphoma, leukemia, myeloma, melanoma, glioma, blastoma, metastasis, cohort, histology, cytology, solid, lung, NSCLC, thoracic), plus an `Ages` line. The list is the same for every trial, and nothing in it comes from the search. Full text was read whenever the brief view left the disease scope unclear: eight trials, each noted "full text read" in its reason.
- **Step 7, the labels.** Held-out: 82 of 300 relevant (27%), 16 marked unclear. Dev: 57 of 80 relevant, 2 unclear. Commits: 98, then 99–198, then 199–300, then the dev pool, close to the plan's three hundreds.
- **Step 7, convention questions that came up**, each decided by `ANNOTATION.md` as written and marked "unclear:":
  - Trials that treat a complication rather than the cancer, but take any cancer: malignant pleural effusion, thrombosis prevention, taste changes, virtual reality for symptoms, navigation. Labelled relevant, under the "symptom being treated" rule.
  - Pediatric-framed trials with an upper age of 30 that take any solid tumor. Labelled relevant, because age isn't part of the label.
  - Small cell lung cancer transformed from EGFR-mutant NSCLC, which requires an NSCLC history. Labelled relevant.
  - "Selected solid tumors" with the selection not in the record. Labelled relevant.
  - A biomarker-specific NSCLC exclusion (HER2-mutant NSCLC excluded, HER2-overexpressed not). Labelled relevant.
  - Not unclear, but worth knowing: rollover studies for people already on a drug are not relevant (they don't enroll by cancer type). Lung carcinoid and large-cell neuroendocrine tumors are not NSCLC.
- **Step 7, a finding about the snapshot.** The registry's own `cancer` search returns some trials that aren't about cancer: spinal cord injury, insomnia, common warts, myasthenia gravis, heavy drinking. Six turned up in the held-out sample, labelled not relevant. `docs/search.md` will say so.
- **Step 8.** The 20 labels for Gate 2 are in `work/0001-trial-snapshot/gate-2-labels.md`: 15 held-out and 5 dev, 7 relevant and 13 not, one marked unclear. **Stopped for Gate 2.**
- **Gate 2, answered (2026-10): delegated by the owner, and checked by a blind relabel.** A separate agent labelled the 20 from `ANNOTATION.md` and the trials' text, without seeing these labels: 20 of 20 agreed. Its four questions about where the convention was silent were checked across all 380 labels. Each had been decided one way throughout, so they're now written into `ANNOTATION.md`, and no label changed. Details in `gate-2-labels.md`. On to stage C.
- **Step 9.** The vocabulary, written from the intent's examples, with the labels not opened. One change to spec §4: the generic list has two parts. `containedTerms` ("solid tumor", "brain metastases") match inside a condition. `wholeConditions` ("cancer", "neoplasms") match only a whole condition, because "cancer" inside "breast cancer" would make every trial generic. NSCLC's first version: names (non small cell lung, nsclc, lung cancer, lung carcinoma, lung adenocarcinoma, adenocarcinoma of the lung, lung neoplasm(s), lung non small cell), three MeSH headings, and biomarkers (EGFR, ALK, ROS1, KRAS G12C, MET exon 14). "lung cancer" also matches small cell lung cancer trials, a precision cost the measurement will show.
- **Step 13, dev.** The first vocabulary kept all 57 relevant dev trials (recall 100%, precision 90.5%), so there was nothing to tune and the vocabulary was frozen as written. That number flatters it: the dev pool was drawn by trials whose title or eligibility text mentions lung cancer, which is close to what the `rules` reason matches, so the pool was always going to be easy for it.
- **Step 13, held-out** (`evals/results/search/01-a3e87584fb11.json`, vocabulary `a3e87584fb11`). 300 labelled, 82 relevant, 87 kept.
  - Recall **92.7%** (76 of 82; 95% interval 84.9% to 96.6%). Precision 87.4%.
  - By reason, relevant kept of kept: names 39/43, rules 39/41, generic 54/61.
  - Of the 66 relevant labels not marked unclear, all 66 were kept. All six misses are among the 16 marked unclear.
  - The six misses, with their label reasons:
    - NCT04545957: MR-guided radiation simulation for any confirmed malignancy needing radiation; conditions list other sites.
    - NCT05053555: unresectable liver tumors, primary or secondary, so lung cancer spread to the liver counts.
    - NCT05313191: proton re-irradiation of previously irradiated tumors; "Thoracic Cancer" among conditions, no tumor type required.
    - NCT06669416: chemotherapy taste changes in the top cancer types, of which lung is one.
    - NCT07410117: preventing cancer-associated clots in locally advanced or metastatic solid tumors.
    - NCT07817147: microwave ablation of a pancreas or liver tumor in advanced cancer; liver metastases count.
  - All six are trials about a site, a procedure or a side effect that take any cancer, and none names lung cancer or a generic condition the vocabulary knows ("Thoracic Cancer", "Liver Metastases", "Malignant Solid Tumor" as written).
  - The 11 kept but not relevant: four small cell lung cancer trials (`names`, the cost step 9 predicted), and seven `generic` trials whose conditions say "cancer" or "solid tumor" while the eligibility text lists other cancers only.
  - `search:eval -- --check`: matches a rerun, row for row.
- **Step 13, three made-up searches** (age 64, female, treatment trials):

  | Search | Cancer type | Age and sex | Distance | names · rules · generic |
  | --- | --- | --- | --- | --- |
  | Chicago 60611, 50 miles | 1,129 | 1,087 | 191 | 127 · 121 · 91 |
  | Pierre, South Dakota 57501, 100 miles | 1,129 | 1,087 | 19 | 17 · 15 · 4 |
  | 60611, anywhere | 1,129 | 1,087 | 1,061 | 579 · 539 · 627 |

  "Anywhere" drops 26: trials whose US sites aren't recruiting.
- **Held-out recall is below the 0.95 bar. Stopped for Gate 3.** The plan's one more round is dev-only, and the dev pool has no misses to tune on. `measured` stays `false` until the gate is answered.
- **Gate 3, answered (owner, 2026-10): accept 92.7% as the finding.** No second round. Every held-out miss was a trial about a site, a procedure or a side effect that takes any cancer, and every relevant trial not marked unclear was kept. 0002 builds on the search as it is, and `docs/search.md` reports the gap with the misses.
- **After Gate 3, a change the plan didn't foresee.** `measured` sits inside the vocabulary file, so setting it would have changed the vocabulary's checksum and left the committed result naming a vocabulary that no longer exists. The checksum now reads `measured` as false, tested in `tests/search/vocabulary.test.ts`. `nsclc.json` has `measured: true`, its checksum is still `a3e87584fb11…`, and `search:eval -- --check` still passes.
