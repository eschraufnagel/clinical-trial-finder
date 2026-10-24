# spec: 0002 fact vocabulary

**Intent:** [intent.md](intent.md)
**Status:** Draft
**Date:** 2026-10

The intent's open questions are answered here as proposals. Each is marked **(OQ n)** where it's answered. Where the plan must decide something, or a gate can overturn a proposal, it says so.

---

## 1. What a person can try at the end

```
npm run facts:show -- NCT05053555
npm run facts:try -- --zip 60611 --miles 50 --age 64 --sex female --profile evals/cases/facts/profiles/example.json
```

- **`facts:show`** prints a trial's mapped facts. Each comes with the answers it rules out, its quote and, if the rule is scoped to part of the trial, that scope.
- **`facts:try`** runs the 0001 search, then applies a made-up profile's answers, and prints:
  - how many candidates the answers rule out, how many they fit, and how many stay open;
  - for each fact the profile leaves unknown, how many still-open trials depend on it.

  That last list is a preview of what 0003 will choose questions from.

Neither command calls a model. Both read committed mappings.

---

## 2. The fact vocabulary

### 2.1 Shape

One file, `data/facts/vocabulary.json`:

```json
{
  "version": 1,
  "facts": [
    {
      "id": "brain_mets",
      "question": "Has the cancer spread to the brain?",
      "answers": [
        { "id": "none", "words": "No" },
        { "id": "treated_stable", "words": "Yes, treated and stable" },
        { "id": "active", "words": "Yes, untreated or growing" }
      ],
      "whoKnows": "patient",
      "cancerTypes": "all"
    }
  ]
}
```

- `id` is snake_case and unique. Answer ids are unique within a fact.
- `answers` has 2 to 6 entries. **"Unknown" is never listed.** It is the absence of an answer, and it is always allowed.
- `whoKnows` is `"patient"`, `"oncologist"` or `"records"`: who can usually answer. It's for 0003 and 0004's wording, and it changes no status.
- `cancerTypes` is `"all"` or a list of cancer type ids from `data/cancer-types/`. The NSCLC biomarkers are `["nsclc"]`.
- The loader (`src/facts/vocabulary.ts`) validates every rule above and reports all problems at once. It returns the facts and a `sha256` of the file's bytes, which every mapping and result names.

### 2.2 Which facts (OQ 3)

- **Written by hand, from three sources:**
  - the research's intake table (§5.1);
  - a deterministic count of how often candidate trials' eligibility text mentions each of a fixed list of topics (`npm run facts:topics`, §7);
  - the rules that knock trials out in the 0001 labels' worked cases.
- **Written before any labelling or prompt run,** and committed in its own step. It changes only at a gate.
- **The first draft**, to be finalised in the plan's vocabulary step:
  - **Disease:** NSCLC histology (adenocarcinoma, squamous, other non-small cell, mixed with small cell); extent (early and resectable, locally advanced and not resectable, metastatic or recurrent); brain metastases (none, treated and stable, active); leptomeningeal disease (no, yes); measurable disease (yes, no).
  - **Activity:** ECOG (0, 1, 2, 3 or 4), asked in plain words.
  - **Biomarkers** (NSCLC):
    - EGFR (common sensitizing mutation, exon 20 insertion, other mutation, none found);
    - ALK, ROS1, RET and NTRK fusions (each: found, none found);
    - KRAS (G12C, other mutation, none found);
    - HER2 (mutation, overexpression or amplification, none found);
    - MET (exon 14 skipping, amplification, none found);
    - BRAF V600E (found, none found);
    - PD-L1 (50% or more, 1–49%, under 1%).
  - **Treatment so far:**
    - PD-1 or PD-L1 inhibitor (never, progressed on it, stopped for another reason);
    - platinum chemotherapy (never, received);
    - targeted therapy for their driver (never, received);
    - docetaxel (never, received);
    - lines of systemic therapy for advanced disease (0, 1, 2, 3 or more);
    - chest radiation within the last 6 months (no, yes).
  - **Other health:**
    - another cancer (none; active or treated within 2 years; treated 2–5 years ago; more than 5 years ago);
    - active autoimmune disease needing treatment (no, yes);
    - interstitial lung disease or pneumonitis (never, past, current);
    - HIV (no, controlled, not controlled); active hepatitis B or C (no, yes);
    - heart attack, stroke or unstable heart disease in the last 6 months (no, yes);
    - organ transplant (no, yes);
    - pregnant or breastfeeding (no, yes).

  That is 31 facts.
- **Left out on purpose:** lab thresholds (blood counts, kidney and liver function), consent, contraception, willingness, and washout periods measured in days. They rarely split trials at this stage, a person can't usually answer them, and they stay with the trial's text for the stage-two screening agent (0005). The labels record each such rule as unmapped, by category (§5.2), so the measurement shows what this costs.

"Not tested" for a biomarker is treated as unknown, not as an answer. A trial that requires a mutation doesn't rule out someone who hasn't been tested: they could be.

---

## 3. Mappings

### 3.1 Shape

`src/facts/types.ts`:

```ts
interface FactMapping {
  factId: string;
  /** Answers that make the person ineligible under this rule. Non-empty, and never every answer. */
  rulesOut: string[];
  polarity: "inclusion" | "exclusion";
  /** Verbatim from the trial's text, located as the parser locates quotes. */
  source: SourceSpan;
  /** Verbatim scope ("Cohort B", "Phase 1b part") when the rule applies to part of the trial. */
  appliesTo?: string;
  loose?: true;
}

interface TrialFacts {
  nctId: string;
  mappings: FactMapping[];
  rejected: RejectedMapping[];   // { reason, quote, raw }, as the parser's RejectedCriterion
  run: ModelRunMetadata & { vocabularySha256: string; normalizeVersion: string; snapshotMonth: string };
}
```

- An inclusion rule "EGFR exon 19 deletion or L858R" maps to `egfr`, ruling out `exon20_insertion`, `other_mutation` and `none_found`.
- An exclusion rule "prior PD-1 or PD-L1 inhibitor" maps to `prior_pd1`, ruling out `progressed` and `stopped_other`.

### 3.2 The call (OQ 2)

- **One model call per trial, straight from the text.** `mapTrialFacts(trial, vocabulary, adapter)` in `src/facts/map.ts`, with the adapter passed in, as `parseCriteria` takes one.
- **Input:** the trial's eligibility text, normalized by the inherited `normalize` (`src/criteria/normalize.ts`), plus the facts for the trial's cancer type and `"all"`, listed with their answer ids.
- **Output:** JSON `{ mappings: [{ factId, rulesOut, polarity, quote, appliesTo? }] }`. Only rules that map are returned.
- **The prompt says** (`src/facts/prompt.ts`, versioned by the hash of the system prompt, as the parser's is):
  - map a rule only when it clearly states a requirement on one fact;
  - when unsure, leave it out: a missed rule costs a question, a wrong one costs a trial;
  - `rulesOut` holds exactly the answers the rule excludes, and no answer whose fit is uncertain;
  - copy the quote exactly;
  - give `appliesTo` whenever the rule is scoped to an arm, cohort or part.
- **Validation** (`src/facts/validate.ts`) rejects a mapping, with a reason, when:
  - its fact is unknown, or doesn't apply to the trial's cancer type;
  - an answer id isn't the fact's;
  - `rulesOut` is empty, or holds every answer;
  - the quote can't be located (`locateQuote`, searched from 0 each time, since mappings needn't come in text order).

  Rejected mappings are kept in `rejected`. The envelope fails as a whole, raising `FactMappingError`, only when the response is truncated or unreadable.
- **Output limit:** `maxOutputTokens` is 8,192, and truncation is a hard failure, as in the parser.
- **One fact, several rules:** a trial may have several mappings for the same fact, for example an inclusion and an exclusion. They are kept separately.

### 3.3 Which trials (OQ 1)

- **Proposed: all 1,129 candidates.** The candidates are the treatment (or no-purpose) trials that `reasonsFor` keeps with the measured NSCLC vocabulary, ignoring age, sex and distance.
- `candidateIds(snapshot, vocabulary)` in `scripts/facts-map.ts` computes them deterministically, and the run's manifest records the sha256 of the sorted list.
- **The 689 that name lung cancer or mention it in their rules are mapped first**, then the 440 "open to many". If the run is cut short, the measured order holds.

### 3.4 The run (OQ 6)

```
npm run facts:map -- --set dev                         the 10 dev trials, local model
npm run facts:map -- --set heldout                     the 30 held-out trials
npm run facts:map -- --set candidates                  all 1,129
npm run facts:map -- --set candidates --model anthropic:claude-haiku-4-5 [--batch] --spend
```

- **Local by default.** A frontier `--model` is dry without `--spend`: it prints the roles, an estimate and a ceiling, then exits. Paid runs are capped by `--max-calls` and `--max-usd`, and append to `evals/results/spend.jsonl`. This command-line handling is the prescreening repository's `scripts/lib/model-flags.ts` (`readModelFlags`, `planPaidRun`, `logSpend`), copied here with its tests rather than rewritten.
- **Output:**
  - Each trial's `TrialFacts` is written the moment it returns, to `data/facts/<snapshot month>/<run name>/<NCT ID>.json`.
  - `<run name>` is `<model>-<prompt version 8 hex>-<vocabulary sha 8 hex>`.
  - A rerun skips trials already written, so a stopped run resumes.
  - A trial that fails is recorded in the run's `failures.json` with the error, and the run continues.
- **Manifest:** `--set candidates` writes `manifest.json` when it finishes: run metadata, candidate-list sha256, counts of mapped, failed and rejected, and total time. A run that stops early leaves no manifest. `facts:try` refuses a run directory without one.
- **Timing:** every run prints seconds per trial and per thousand characters. The dev run's figures give the estimate for the candidates run, which the plan puts in front of a gate.
- **Committed or not** is the plan's decision. The candidates run is about 1,129 files of a few KB each.

---

## 4. Status

`src/facts/status.ts`, pure, imports nothing from `src/models/`:

```ts
type Profile = Partial<Record<string /* factId */, string /* answer id */>>;

interface TrialStatus {
  nctId: string;
  status: "ruled-out" | "open";
  ruledOutBy: FactMapping[];       // whole-trial mappings whose rulesOut holds the profile's answer
  partlyRuledOutBy: FactMapping[]; // the same, for mappings with appliesTo; never makes the trial ruled-out
  fits: string[];                  // facts with an answer, mapped, and ruled out by none of the trial's mappings
  unknown: string[];               // facts the trial maps that the profile doesn't answer
}

function statusFor(trial: TrialFacts, profile: Profile, vocabulary: FactVocabulary): TrialStatus;
```

- **An unanswered fact is unknown, and an unknown never rules a trial out.** Tests assert this for every fact in the vocabulary.
- **A trial is ruled out only by a whole-trial mapping** whose `rulesOut` contains the profile's answer.
- **A trial with no mappings is open**, with nothing fitting and nothing unknown.
- **A profile is validated against the vocabulary first.** An unknown fact or answer is an error, never silently ignored.
- `dependsOn(statuses)` counts, for each fact, the open trials that list it as unknown. `facts:try` prints this.

---

## 5. Labels (OQ 4, OQ 5)

### 5.1 The sample

- **Drawn from the 1,129 candidates**, ordered by `sha256("0002:" + nctId)`: the first 10 are the dev set, the next 30 the held-out set.
- `npm run facts:sample` writes the skeletons and refuses to overwrite.
- **The skeletons are committed before any label is written, and the labels before the mapping prompt runs on those trials.**

### 5.2 Shape and convention

`evals/cases/facts/<NCT ID>.json`, one per trial:

```json
{
  "nctId": "NCT…",
  "set": "dev",
  "criteriaTextSha": "…",
  "vocabularySha256": "…",
  "passages": [
    { "quote": "…", "start": 0, "end": 0,
      "mappings": [{ "factId": "brain_mets", "rulesOut": ["active"], "appliesTo": null }],
      "unmapped": null },
    { "quote": "…", "start": 0, "end": 0,
      "mappings": [],
      "unmapped": "organ-function" }
  ]
}
```

- **Passages come from the inherited skeleton splitter** in `scripts/label-criteria.ts`, factored out so both tools use it.
- **Each passage gets either mappings or an `unmapped` category:**
  - `organ-function`: labs and organ thresholds;
  - `procedure`: consent, contraception, compliance, washouts;
  - `vocabulary-gap`: a fact about the person that would split trials, but which the vocabulary lacks. A note names it;
  - `trial-specific`: a fact unlikely to recur across trials;
  - `not-a-rule`: a heading or a definition.
- **The convention is in `evals/cases/facts/ANNOTATION.md`, written before labelling.** It covers:
  - what "clearly maps" means;
  - how `rulesOut` is chosen, including the "not tested is unknown" rule;
  - arm-scoped rules;
  - worked cases for brain metastases with conditions, "prior immunotherapy allowed if…", and biomarker cohorts (OQ 7).
- **`npm run facts:label-show -- <NCT ID>`** prints the trial's text, the vocabulary and the skeleton.

  It and `facts:sample` reach no file under `src/facts/` except `vocabulary.ts` and `types.ts`, and nothing under `src/models/`. `tests/boundary.test.ts` asserts this, in the style of the existing labelling-tool block.

---

## 6. Measurement

`evals/facts/grade.ts` and `scripts/facts-eval.ts` (`npm run facts:eval -- --run <dir> [--set dev|heldout]`).

### 6.1 Matching

- A model mapping **matches** a labelled mapping when the fact is the same and the model's quote overlaps the labelled passage's span by at least one character.
- **Each match is graded:**
  - **exact:** the same `rulesOut`;
  - **safe:** the model's `rulesOut` is a strict subset of the label's;
  - **wrong:** the model rules out an answer the label doesn't.
- **An unmatched model mapping is wrong** if its quote overlaps a passage labelled as ruling out none of those answers, and **unplaced** if it overlaps no labelled passage. Unplaced mappings are reported, for reading.
- **A model mapping without `appliesTo` that matches a labelled mapping with one is wrong.** It would rule out the whole trial for a rule about one arm.

### 6.2 Numbers

Reported per set, each with a Wilson 95% interval where it's a proportion:

| Number | What it is |
| --- | --- |
| **Wrong rule-outs** | Wrong mappings ÷ model mappings. Plus the count of trials with at least one wrong whole-trial mapping: trials a profile could wrongly drop. The safety number |
| **Mapping recall** | Labelled mappings matched exact or safe ÷ labelled mappings |
| **Exact share** | Exact ÷ matched |
| **Coverage** | Labelled passages with a mapping ÷ labelled passages that are rules (not `not-a-rule`). From the labels alone, with no model involved: what the vocabulary can express |
| **Vocabulary gaps** | Passages labelled `vocabulary-gap`, with their notes, grouped. What a bigger vocabulary would add |
| **Rejected** | Model mappings rejected by validation, by reason |

- **Results** are written to `evals/results/facts/NN-<run name>.json` with every row and the run metadata: model, quantization, temperature, seed, prompt version and vocabulary sha.
- **Checks:** `tests/evals/facts-result.test.ts` re-derives every committed result's numbers from its rows, as 0001's search-result test does. `facts:eval -- --check` regrades the latest result from the committed mappings.

### 6.3 Bars (proposed; Gate 3 decides)

- **Held-out wrong rule-outs:** at most 3% of model mappings, and at most 2 of 30 trials with a wrong whole-trial mapping.
- **Mapping recall:** at least 0.6.
- **Coverage:** reported, with no bar. If labelled coverage of patient-level rules is low, that is the finding that matters for open question 1, and the vocabulary gaps say what to add.
- **Tuning:** the prompt is tuned on the dev set only. The held-out set is scored once, or twice if the first misses a bar after one more dev round, as in 0001.

---

## 7. Commands added

| Command | Does |
| --- | --- |
| `npm run facts:topics` | counts how many candidates' eligibility text mentions each of a fixed topic list. Deterministic; an input to writing the vocabulary |
| `npm run facts:sample` | writes the dev and held-out label skeletons |
| `npm run facts:label-show -- <NCT ID>` | prints a trial for labelling |
| `npm run facts:map -- --set dev\|heldout\|candidates [--model <spec>] [--spend]` | maps trials; local by default; resumable |
| `npm run facts:eval -- --run <dir> [--set …] [--check]` | grades a run against the labels |
| `npm run facts:show -- <NCT ID> [--run <dir>]` | prints a trial's mappings |
| `npm run facts:try -- <search flags> --profile <file>` | search, then a profile's statuses and the facts open trials depend on |

---

## 8. Boundaries

`tests/boundary.test.ts` gains:

- `src/facts/status.ts` and `src/facts/vocabulary.ts` reach nothing under `src/models/`;
- `src/search/` reaches nothing under `src/facts/` (the search stays independent of the mapping);
- the facts labelling tools reach only `vocabulary.ts` and `types.ts` under `src/facts/`, and no model;
- `src/facts/map.ts` takes its adapter as an argument and names no factory, so no file under `src/facts/` imports `src/models/factory.ts`.

No network rule changes. The only model calls are made by `facts:map`, through `src/models/`.

---

## 9. Tests

All deterministic, on made-up trials and a fake adapter (`src/models/fake.ts`):

- **`tests/facts/vocabulary.test.ts`:** the committed vocabulary loads. Each validation rule rejects, and all problems are reported together.
- **`tests/facts/map.test.ts`:** the fake adapter returns a fixed envelope, and the test checks:
  - located quotes;
  - each rejection reason;
  - out-of-order quotes located;
  - truncation raises `FactMappingError`;
  - run metadata recorded.
- **`tests/facts/status.test.ts`:**
  - an unknown never rules out, for every fact in the committed vocabulary;
  - arm-scoped mappings never rule out the trial;
  - several mappings on one fact;
  - profile validation;
  - `dependsOn` counts.
- **`tests/evals/facts-grade.test.ts`:**
  - exact, safe, wrong and unplaced on small tables;
  - the `appliesTo` rule;
  - interval values.
- **`tests/evals/facts-labels.test.ts`:** the label loader's rejections. Every committed label names an existing fact and answers, and its quote matches its span.
- **`tests/scripts/model-flags.test.ts`:** copied with the module.
- **Committed runs:** if committed, every mapping file names the run's metadata, and every quote matches the snapshot's text at its span. Checked on a sample of files, so `npm test` stays fast, and in full by `facts:eval -- --check`.

---

## 10. Out of scope

- choosing questions (0003);
- the page, the shortlist and ranking (0004);
- the screening agent hand-off (0005);
- any cancer type but NSCLC;
- changing the inherited parser;
- mapping lab thresholds.
