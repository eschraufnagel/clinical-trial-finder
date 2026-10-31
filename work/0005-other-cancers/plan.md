# plan: 0005 trials for other cancers

**Intent:** [intent.md](intent.md). **Spec:** [spec.md](spec.md). Spec sections are cited as §n.

## Context

The search keeps some trials for other cancers through broad terms, and they reach lung cancer patients' short lists (ROADMAP open question 6; `docs/page.md`, Limits). They get in three ways:
- a generic term beside another cancer, such as "Metastatic Cancer; Neoplasm, Prostate";
- an NSCLC biomarker inside another cancer's condition, such as "ALK-Positive Large B-Cell Lymphoma";
- "lung cancer" inside "small cell lung cancer".

No fact flags them, so nothing a person answers moves them down. This slice labels the trials that reach short lists, measures how many places they take, and adds a deterministic mark that moves them below the short list without removing anything. A trial open to many cancers must not be marked. The labels and a pre-set bar on held-out are how that's held. No model, and no spend.

What exists to build on:
- **`src/search/search.ts`** `searchTrials`, which builds each `Candidate`.
- **`src/search/vocabulary.ts`:**
  - `reasonsFor`, `loadVocabulary`, `checkTerms`;
  - the checksum trick that reads `measured` as false.
- **`src/search/normalize.ts`** `normalizeText`, `containsTerm`.
- **`src/shortlist/order.ts`** `ORDERS`, `keyOf`, `compareKeys`.
- **`src/questions/select.ts`** `shortlistChangeDownOnly`, and `shortlistChangeByRecount`, which a test holds equal to it.
- **`src/questions/settings.ts`,** which validates `"order"` against `ORDER_NAMES`.
- **`src/shortlist/explain.ts`** `describeOrder` (`ours` and `registry` words, `FLAG_WORDS`), and `src/shortlist/sheet.ts`.
- **The verdict scan** `src/shortlist/words.ts` `verdictHits`, and `questions:eval`'s `verdictHits` and `sheetMissing` rows.
- **The search's labelling tools:**
  - `scripts/search-sample.ts` (hash draw, refuses to overwrite);
  - `scripts/search-show.ts`;
  - `evals/search/labels.ts` `readSearchLabels`;
  - `scripts/search-eval.ts` `--check`.
- **`tests/boundary.test.ts`:** "the search labelling tools cannot see the search", and "the search reaches no model, parser…".
- **Committed results:**
  - `evals/results/questions/05-7543ffb2cb2e.json` and `with-reads/03-7543ffb2cb2e.json`: 171 distinct short-list trials, 24 already in 0001's labels;
  - `evals/results/search/01-a3e87584fb11.json`.

### Changes to the spec, made in step 1

- **§3.3:** `other:sample` draws the `sample` set from the NSCLC candidates, so it reaches `src/search/vocabulary.ts` (`reasonsFor`). What it must not see is the check. The boundary test holds `other:sample` away from `src/search/other.ts` and any model, rather than to `normalize.ts` alone.
- **§4.2:** the others file's checksum reads `routes` as empty, as the vocabulary reads `measured` as false. Changing which routes are adopted then doesn't rename the held-out result that measured them.
- **§4.3:** `other.ts` returns every route that applies (`routesFor`), not only the first. `other:eval` scores each route on its own, whatever is adopted. `Candidate.other` takes the first adopted route in the fixed order.
- **§4.6 and §8:** the places counts live in `other:eval --places <questions result>`, not in `questions:eval`. 0004's results and `--check` are then untouched.
- **§6.1:** the mark's sentences live in `explain.ts` beside `FLAG_WORDS`, as every card sentence does, not in `copy.ts`.

## Order of work

### Stages and gates

| Stage | Steps | Ends at | What you can see at the end |
| --- | --- | --- | --- |
| **A. Labels** | 1–6 | **Gate 1** | every label, the blind relabel, and how many short-list places go to trials not for NSCLC today |
| **B. The check, on dev** | 7–8 | **Gate 2** | each route's gains and costs on dev, every relevant trial it marks named |
| **C. Held-out and the order** | 9–11 | — | each route on held-out against the bar; `other-last`; the 20 patients rerun once, with places before and after |
| **D. The page** | 12 | **Gate 3** | the card and sheet with marks, from `--fake` |
| **E. Written up** | 13–14 | PR | docs, roadmap, review passes |

**Gate 1: do the labels hold?** (§3, §9)
- **What's decided:**
  - each blind-relabel disagreement, and which label stands;
  - any new edge case, written into `ANNOTATION.md`.
- **What the owner sees:** `work/0005-other-cancers/gate-1-labels.md`:
  - the counts per set, relevant and unclear;
  - the 20 relabelled trials, with both reasons where they differ;
  - places held today by trials labelled not relevant, per arm, held-out and dev.
- **What it costs to be wrong:**
  - every number after this is measured on these labels;
  - held-out labels can't be changed once stage C scores them;
  - a basket trial labelled wrong as "not relevant" would let a route that marks it pass the bar.
- **Can be no:** the disputed labels are redone and the gate asked again. If today's places held by trials not for NSCLC turn out near zero, the owner can stop the slice here: labels and a finding, no check.

**Gate 2: which routes go to held-out, and move or remove?** (§4.6, §5.3, OQ 3, OQ 4)
- **What's decided:**
  - the frozen others file (its lists);
  - which of `small-cell`, `biomarker`, `listing` and `rules` are scored on held-out;
  - whether any route removes rather than moves (leaning: none).
- **What the owner sees:** `gate-2-routes.md`:
  - per route on dev: trials marked not relevant, and trials marked relevant, each named with its label's reason;
  - not-relevant trials no route marks;
  - the others file in full.
- **What it costs to be wrong:**
  - held-out is scored once, and lists tuned after it are tuned on it;
  - a route sent with a basket trial at risk spends the one clean look at held-out on it.
- **Can be no to all:** no route goes to held-out. The slice ships the labels and the measurement, and stage C is skipped.

**Gate 3: do the page's words, read as a person would, imply a verdict? Keep `other-last`?** (§6, §8)
- **What's decided:**
  - the mark's lead sentences and the "From the record" line;
  - whether `other-last` stays in `conversation.json`, given the rerun.
- **What the owner sees:** `gate-3-page.md`:
  - from `--fake`, one marked card per adopted route, in full;
  - the sheet of a patient whose short list holds a marked trial, if any does;
  - the rerun's table: places held by trials not for NSCLC and by marked trials, before and after, with agreement, would-flag and unread places.
- **What it costs to be wrong:**
  - stage E pins the words in docs and the browser test;
  - a mark that reads as "not for you" is a verdict the product rules out;
  - a relevant trial moved down with no reason a person can read is the cost this slice must not hide.
- **Can be no:** words rewritten and asked again. Or `other-last` reverted to `read-first` in `conversation.json`, and the mark kept only as a card line.

Stage C needs no gate: the bar (§7) was set before held-out was labelled, and decides adoption by rule. Stage E ends in documentation.

### Steps

Each step is one commit, through `npm run check && git commit`. No commit carries a Co-Authored-By trailer. No test mocks a module or stubs a global.

**Stage A: labels**

1. **Commit intent, spec and this plan,** with the spec changes in Context.
   - `work/ROADMAP.md`, as §2 proposes:
     - 0005 "Trials for other cancers";
     - 0006 "Reader on hosted models";
     - the deeper check at 0007 and the benchmark at 0008;
     - open question 6 pointing here.

     If the owner answers OQ 2 "no", 0006 isn't added, and the numbers shift.
   - Record the baseline test count and `npm test` time.

2. **The label file and the sampling tool** (§3.2, §3.3).
   - `evals/search/labels.ts`:
     - `OTHER_LABELS` (`evals/cases/search/nsclc-other.json`);
     - `LabelSetName` widened to `places-dev | places-heldout | sample`, accepted only in that file;
     - `readSearchLabels` validates the file's own sets.
   - `scripts/other-sample.ts` and `npm run other:sample`. It writes the skeleton and refuses to overwrite:
     - **places sets:** the distinct short-list trials of the two committed `read-first` results, split by whether any dev patient's list holds them, minus 0001's labels;
     - **`sample`:** 150 of the NSCLC candidates, by `reasonsFor` over treatment-purpose trials, minus 0001's labels and the places sets, ordered by `sha256("0005:" + nctId)`.
   - Boundary test: `other-sample.ts` reaches no model and not `src/search/other.ts`, with a "would catch" case.
   - Tests on a made-up snapshot:
     - the draw is reproducible;
     - no trial is in two sets;
     - 0001's labels are excluded.

3. **Draw the sets.** Run `other:sample` and commit the skeleton. Check the counts against §3.2: about 147 places trials (30-odd dev, about 117 held-out) and 150 sample.

4. **Label `places-dev`,** one trial at a time from `search:show`, by `ANNOTATION.md`, reasons quoting the deciding words.

5. **Label `places-heldout` and `sample`** the same way, before any check code exists. Then a separate agent relabels 20 blind (10 + 10, drawn by `sha256("0005-blind:" + nctId)`), given only `ANNOTATION.md` and `search:show` output. Its labels go in the gate page, not the file.

6. **Places today, and Gate 1.**
   - `evals/search/other.ts` `placesHeld(result, labels)`: per row, the places held by trials labelled not relevant, and by trials with no label. It reads both label files.
   - `scripts/other-eval.ts` with only `--places <file>` for now; `npm run other:eval`.
   - Tests on a made-up result and labels.
   - Write `gate-1-labels.md`. **Stop at Gate 1.**

**Stage B: the check, on dev**

7. **The check** (§4).
   - `data/cancer-types/nsclc-others.json`: `otherCancers`, `openPhrases`, `notCancer`, `routes` (all four for now).
   - `src/search/other.ts`:
     - `loadOthers(typeId)`, validated with `checkTerms`; `null` when no file; checksum with `routes` read as empty;
     - `inclusionSection(text)`;
     - `routesFor(trial, vocabulary, others): OtherRoute[]`;
     - `markFor(...)`: `OtherMark | null`, the first adopted route with its `cancers` and `evidence`.
   - `src/search/types.ts`: `Candidate.other: OtherMark | null`. `searchTrials` takes an optional `others` and attaches marks after the cancer stage. The funnel is unchanged.
   - Callers pass `loadOthers(request.cancerType)`:
     - `scripts/search.ts`, which also prints the mark;
     - `src/questions/trials.ts` `trialsForSearch`;
     - the server.
   - Tests in `tests/search/other.test.ts`, as §10 lists:
     - per route, a made-up record and its near miss;
     - NSCLC names stripped before other cancers are sought;
     - exclusion text never read;
     - no inclusion heading means no `rules`.

     And in `tests/search/search.test.ts`: the same candidates, funnel and reasons with and without the others file.
   - **Proof of no change:**
     - `search:eval -- --check` passes on 0001's result;
     - `questions:eval -- --check` and `-- --check --dev` pass, since `read-first` ignores the mark.

8. **Score the routes on dev** (§4.6).
   - `evals/search/other.ts` `scoreRoutes(labels, trials, vocabulary, others)`: per route, rows of `{nctId, set, relevant, unclear, routes}`; summaries of marked-not-relevant, marked-relevant (with unclear apart) and unmarked-not-relevant.
   - `other:eval -- --dev` writes `evals/results/search/other/dev/NN-<sha>.json`, recording the snapshot, label files, `nsclc.json` and others checksums. `-- --check` reruns the latest.
   - Tune the lists on dev only. Each change is a commit of its own if it changes a dev number, with the result rerun.
   - Write `gate-2-routes.md`. **Stop at Gate 2.**

**Stage C: held-out and the order**

9. **Score held-out once** (§7). Freeze the others file as Gate 2 left it. Run `other:eval` once on `places-heldout` and `sample`, and commit `evals/results/search/other/NN-<sha>.json`. Apply the bar by rule:
   - set `routes` to the routes that pass;
   - record each relevant trial marked, named, in the gate-2 page under "Held-out, scored once".

   If none passes, `routes` is empty, steps 10 and 11 are skipped, and stage D shows no mark.

10. **The order** (§5).
    - `src/shortlist/order.ts`: key `other` in `OrderKey` and `keyOf` (`candidate.other !== null ? 1 : 0`), and order `"other-last"`.
    - `select.ts`: `other-last` uses the shortcut, unchanged.
    - Tests:
      - `other-last`'s keys pinned;
      - a marked trial sorts after an unmarked one with hints;
      - the other orders ignore `other`;
      - the shortcut equals the recount under `other-last` on every fixture case;
      - no order drops a trial.

11. **Rerun the patients once** (§8).
    - `"order": "other-last"` in `data/questions/conversation.json`.
    - Run `questions:eval` once, then `questions:eval -- --reads <the committed held-out reads file>` once.
    - Commit both results. `verdictHits` and `sheetMissing` are zero.
    - `other:eval --places` on 0004's results and the new ones, recorded in `gate-3-page.md` beside 0004's numbers, with the note that held-out patients have now been seen three times.

**Stage D: the page**

12. **The card and the sheet** (§6).
    - `explain.ts`:
      - `TrialView.other: { lead: Words; evidence: Words[] } | null`, lead sentences per route in `ours`, evidence in `registry`;
      - the `TrialCard` shows it first.
    - `sheet.ts`: a marked short-list trial carries its line. Open questions are counted as now.
    - Tests:
      - `tests/shortlist/explain.test.ts` and `sheet.test.ts` on the fixture with a marked trial;
      - `tests/shortlist/verdict.test.ts`: each lead sentence has no verdict hit.
    - `e2e/conversation.spec.ts`: one check that a marked trial's card shows its lead, under `--fake`, on a search whose list holds one.
    - Write `gate-3-page.md`. **Stop at Gate 3.**

**Stage E: written up**

13. **Docs** (§11):
    - `docs/search.md`: the mark, its routes, the dev and held-out results, every relevant trial marked, and the limits;
    - `docs/page.md`: the card line, the rerun, and the Limits entry rewritten;
    - `work/ROADMAP.md`: 0005 **Done**, and open question 6 answered or narrowed;
    - `CLAUDE.md`: the `other:*` commands, the others file, the boundary;
    - README only if its list of parts changes.

    Every number traces to a committed result.

14. **Review passes** from `REVIEW.md`, and their fixes. Then the PR, saying how each gate was answered and whether any was skipped.

## Files that change

**New:**
- `src/search/other.ts`;
- `data/cancer-types/nsclc-others.json`;
- `evals/cases/search/nsclc-other.json`;
- `evals/search/other.ts`;
- `scripts/other-sample.ts`, `scripts/other-eval.ts`;
- `tests/search/other.test.ts`, `tests/evals/other.test.ts` (or beside the existing search eval tests), `tests/scripts/other-sample.test.ts`;
- results under `evals/results/search/other/` and `evals/results/questions/`;
- `work/0005-other-cancers/{plan,gate-1-labels,gate-2-routes,gate-3-page}.md`.

**Changed:**
- `src/search/{search,types,index}.ts`;
- `src/shortlist/{order,explain,sheet}.ts`;
- `src/questions/trials.ts`;
- `src/server/` (passing the others file to the search);
- `src/web/TrialCard.tsx`;
- `scripts/search.ts`;
- `evals/search/labels.ts`;
- `data/questions/conversation.json`;
- `tests/boundary.test.ts`;
- `tests/search/search.test.ts`, `tests/shortlist/*`, `tests/questions/select.test.ts`;
- `e2e/conversation.spec.ts`;
- `package.json` (two scripts);
- `docs/search.md`, `docs/page.md`;
- `work/ROADMAP.md`, `CLAUDE.md`;
- `work/0005-other-cancers/spec.md` (step 1).

**Not touched:**
- `data/cancer-types/nsclc.json`, `reasonsFor`, 0001's labels and result;
- the fact vocabulary and mapping runs;
- the reader and its prompt, `src/models/`, the parser, the screening agent;
- the snapshot.

**No new dependency.**

## Reused, not rebuilt

- **The search's own tools:** `normalizeText`, `containsTerm`, `checkTerms`, `reasonsFor`, `loadSnapshot`, `loadVocabulary`.
- **Labels:** the hash draw and refuse-to-overwrite of `search-sample.ts`; `readSearchLabels`; `search:show` for labelling.
- **Results:** `--check`'s rerun-and-compare pattern from `search-eval.ts`; `nextRunFile`.
- **The order and chooser:** `ORDERS`, `keyOf`, `compareKeys`, `shortlistChangeDownOnly`, and the recount-equals-shortcut test.
- **Words:** `ours`, `registry`, `verdictHits`; `questions:eval`'s `verdictHits` and `sheetMissing` checks.

## Risks

- **Labelling volume.** About 300 new labels, close to 0001's 380. Done in two commits (steps 4 and 5) so dev is finished first. The blind relabel samples held-out, where an error costs most.
- **`rules` is fragile.** Inclusion headings vary, and some records have none. A record with no heading is never marked by `rules` (recall-first), and the bar keeps a route that marks a basket trial out.
- **Tuning leaks into held-out through places overlap.** 23 trials sit on both a dev and a held-out patient's list. They're in `places-dev`, so held-out places counts include trials seen in tuning. Reported as a count in the gate pages, and the cost bar is on `sample`, which has no overlap.
- **Held-out patients, a third look.** Mitigated by choosing routes on labels, not on the patients' agreement, and reporting beside 0003's and 0004's results, never replacing them.
- **The mark changes `Candidate`'s shape.** Anything that serializes candidates (`search --json`, the server's view) gains a field. Committed results don't store candidates, so `--check` is unaffected. The step 7 proof runs every `--check`.
- **Test time.** New tests are on made-up records, never the real snapshot. `npm test` should stay near half a second.
- **No marked trial on any fixture patient's short list under `--fake`.** Then the browser test finds a marked card in "every other trial", which the page also renders, rather than in the short list.

## Verification

- `npm run check` exits 0 at every commit.
- `npm run search:eval -- --check` passes at every step: 0001's result is untouched.
- `npm run questions:eval -- --check` and `-- --check --dev` pass at steps 7 and 10 on 0004's results, and on step 11's after it.
- `npm run other:eval -- --check` and `-- --check --dev` pass on the committed results.
- `npm run test:e2e` passes against `--fake`.
- By hand:
  - `npm run search -- --cancer nsclc --zip 97201 --age 64 --sex male` shows the prostate and lymphoma trials marked, if their routes are adopted, with the funnel unchanged;
  - `npm run app -- --fake`: a marked card reads as Gate 3 approved.

## Records

- **Step 1, baseline:** `npm run check` exits 0; 1,028 tests (1,020 passed, 8 expected to fail), `npm test` about 0.63 s.
  - The spec changes in Context are made. §6.1 also names `TrialView.other`'s shape as step 12 does, `{ lead, evidence }`.
  - `work/ROADMAP.md`: 0005 trials for other cancers, 0006 reader on hosted models (OQ 2, as proposed), the deeper check 0007, the benchmark 0008. 0001's row now sends TREC to 0008, and open question 6 points here.
- **Step 2:**
  - `readSearchLabels(path, sets)` takes the sets a file may hold: `NSCLC_SETS` by default, `OTHER_SETS` for 0005's file. Each file refuses the other's sets.
  - `other:sample`'s draw is `drawSets` in `scripts/other-sample.ts`, tested on made-up trials. It reuses `isTreatment` from `search-sample.ts`. The places sets come from `PLACES_RESULTS`, the two committed `read-first` results.
  - 1,037 tests, `npm test` about 0.63 s.
- **Step 3:** `other:sample` wrote 297 trials: 47 `places-dev`, 100 `places-heldout`, 150 `sample`. The places sets total 147, the 171 short-list trials less the 24 in 0001's labels, as §3.2 says. The plan's split, "30-odd dev, about 117 held-out", was wrong: 117 is held-out before 0001's labels are taken out. A second run refuses to overwrite.
- **Step 4:** the 47 `places-dev` trials are labelled from `search:show --brief`, and the full text where the brief lines didn't decide. 38 are relevant, 1 of them "unclear" (NCT05768139, cohorts unnamed). The 9 not relevant are 4 small cell lung cancer only, 2 blood cancer only (NCT05544019, NCT06724237), and one each limited to prostate (NCT05422911), endometrial and neuroendocrine tumors. No new edge case came up.
- **Step 5:**
  - `places-heldout` (100): 81 relevant, 4 of them "unclear". `sample` (150): 125 relevant, 8 of them "unclear"; and 1 not relevant marked "unclear" (NCT07476287, small cell lung cancer transformed from NSCLC).
  - Labelled from `search:show --brief`, cut to the disease-scope lines, and the full text wherever those didn't decide it.
  - **Two recurring cases**, decided by the convention as it stands, and to go to Gate 1 as possible edge cases:
    - **continuation and extension studies** that take only people already in a parent study (NCT03486873, NCT05203172, NCT07415031): relevant, "unclear", since they don't limit cancer type;
    - **supportive-care trials** that treat a side effect or symptom in anyone with cancer (myocarditis, cardiotoxicity, depression, smoking cessation, perioperative pain): relevant when they take any cancer type or name lung cancer, as the convention's "a symptom being treated" says.
  - **Blind relabel:** 20 trials drawn by `sha256("0005-blind:" + nctId)`, 10 from each set, labelled by a separate agent given only `ANNOTATION.md` and `search:show`. It agreed on relevant or not for all 20. It marked two "unclear" that I didn't: NCT06580002 (cognitive impairment after cancer treatment, lung cancer among the conditions) and NCT06582017 ("lung" named without a subtype). Its labels are kept for the Gate 1 page, not in the label file.
- **Step 6:**
  - `evals/search/other.ts`: `placesHeld` and `summarizePlaces`. `npm run other:eval -- --places <result>` prints them, tested in `tests/evals/search-other.test.ts`.
  - On 0004's results, trials not for NSCLC hold 35 of 162 held-out short-list places in the conversation arm (`shortlist`), for 15 of 17 patients. With reads: 34. The full record's list: 38. Every short-list trial has a label.
  - `gate-1-labels.md` written. **Stopped at Gate 1.**
- **Gate 1, as answered** (owner, 2026-10; `gate-1-labels.md`): the labels stand; continuation studies and supportive-care trials go into `ANNOTATION.md` as edge cases; a second blind pass first. It relabelled 70 held-out trials, every not-relevant label and the relevant ones whose conditions name only other cancers, and agreed on relevant or not for all 70. On its result, NCT06597721 became "unclear" ("Selected Advanced Solid Tumours"). `sample` now has 9 relevant "unclear".
- **Step 7:**
  - **`Candidate.other` is optional,** present only on a marked candidate, rather than `OtherMark | null`. Fixtures and `search --json` are unchanged for unmarked trials.
  - **The others file** has `typeTerms` (NSCLC's own names, stripped first), `notCancerTerms` ("kirsten rat sarcoma"), `notOpenTerms` (RECIST's "in solid tumors"), `ambiguousTerms` ("lung"), `otherCancers` as `{name, terms}`, `openPhrases`, `diagnosisWords` and `routes`. There's no `notCancer` list: a condition the file doesn't name counts as naming no cancer.
  - **The three listing routes share one test** of the conditions, and the route says which kind of listing it is. That's small cell only, then named by a biomarker only, then any other listing.
  - **A listing isn't marked** when the inclusion section names NSCLC, or the title is open to solid tumors ("... in Advanced Solid Malignancies").
  - **`rules` reads every inclusion line for openness,** not only diagnosis lines. A line saying "solid tumor" or "malignancy" opens the trial, RECIST's name aside.
  - **Tuned on dev only,** with a scratch script while writing: 0001's 380 labels and `places-dev`. Step 8 scores it formally.
  - `scripts/facts-try.ts` still searches without the others file. It isn't in the file list, and nothing measured reads it.
  - **Proof of no change:** `search:eval -- --check` matches `01-a3e87584fb11`, `questions:eval -- --check` matches `05-7543ffb2cb2e`, and `-- --check --dev` matches `dev/04-92afa01686ff`. 1,061 tests.
- **Step 8:**
  - `scoreRoutes` and `passesBar` in `evals/search/other.ts`. `other:eval` has `--dev`, held-out (refused once a held-out result exists) and `--check`.
  - Dev result `dev/01-d16e940b9df3`: 17 of 26 not-for-NSCLC trials marked, no relevant trial marked.
  - `gate-2-routes.md` written. **Stopped at Gate 2.**
- **Gate 2, as answered** (owner, 2026-10): as recommended. The file is frozen, all four routes go to held-out, and marks move trials without removing them. NCT07476287 is relabelled relevant "unclear", as 0001 labels transformed SCLC.
- **Step 9:**
  - Held-out `01-d16e940b9df3`: 29 of 43 not-for-NSCLC trials marked. On `sample`, no relevant trial is marked and every route passes the bar, so `routes` is unchanged.
  - On `places-heldout`, `rules` marks one relevant trial, NCT03947385, written up in `gate-2-routes.md` for Gate 3.
- **Step 10:** `other-last` in `ORDERS`, with key `other`, and the shortcut test covering it on a fixture with one marked trial. `ORDER_WORDS` needed a sentence for the new order: "Trials whose records name only other cancers come last. …". It goes to Gate 3 with the card's words. `--check` still matches 0004's results.
- **Step 11:**
  - `"order": "other-last"`. The held-out rerun is `06-8eea38fafad5`, which reruns dev too. With reads it's `with-reads/04-8eea38fafad5`. 0004's `05` and `with-reads/03` stay committed.
  - **22 trials reached a short list for the first time under `other-last`.** They're labelled as a new set, `places-other-last`, so every place is counted: 19 relevant, and 3 not (NCT07165132, NCT07195916, NCT07278479). These labels were written after the check existed. `OTHER_SETS` gains the set.
  - **Places held by trials not for NSCLC, held-out conversation arm (`shortlist`):** 35 → 6, for 15 → 5 patients. With reads: 34 → 6. The full record's short list: 38 → 9.
  - **No marked trial is on any held-out short list.** One relevant trial left a short list because it's marked: NCT03947385, on one patient's.
  - **Agreement falls 3 points and would-flag rises about 5,** conversation arm (`shortlist`): 88% → 85% and 12.9% → 17.6%. `gate-3-page.md` takes this up.
- **Step 12:**
  - `TrialView.other` is `{ lead, evidence }`, built by `otherWords(mark)` in `explain.ts`, and shown first on the card. The sheet's trials carry it, and the page's label "From the record:" is in `copy.ts`.
  - **The listing and rules lead first said "Lung cancer isn't among them."** That's false for the 14 marked trials whose records name small cell lung cancer or lung neuroendocrine tumors. It now says "Non-small cell lung cancer isn't among them."
  - Browser test case 8: a marked card in "every other trial", none on the short list. 7 browser tests pass.
  - `gate-3-page.md` written, its cards from `describeOrder` over a made-up Portland search. **Stopped at Gate 3.**
- **Gate 3, as answered** (owner, 2026-10; `gate-3-page.md`): as recommended. `other-last` and the words stand. The biomarker lead names no gene, and `rules` is unchanged, so NCT03947385 stays marked as the known cost.
