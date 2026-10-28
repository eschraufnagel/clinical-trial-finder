# spec: 0003 question selection

**Intent:** [intent.md](intent.md)
**Status:** Draft
**Date:** 2026-10

The intent's open questions are answered here as proposals. Each is marked **(OQ n)** where it's answered. Where a gate can overturn a proposal, it says so.

Words used below:
- **candidates:** the trials the 0001 search keeps for a patient.
- **status:** `statusFor` from `src/facts/status.ts`, unchanged: per trial, the whole-trial hints, the hints about one part, the facts it maps that the answers cover, and the ones they don't.
- **profile:** fact id to answer id, as `Profile` in `src/facts/status.ts`. A missing fact is unknown.
- **the run:** the mapping run named in `data/facts/2026-10/latest`, prompt `5fea50034aea`, 1,111 of 1,129 candidates mapped.

---

## 1. What a person can try at the end

```
npm run questions:try -- --patient evals/cases/patients/dev/p03.json
npm run questions:eval -- --dev
```

- **`questions:try`** runs the patient's search, then the conversation: the intake, then one chosen question at a time, answered from what the patient knows. For each question it prints the question, the answer or "doesn't know", and which trials entered or left the short list. It ends with the stop reason, the short list with each trial's hints in the trial's words, and the unanswered questions the short list's trials depend on, most first: the start of the oncologist sheet. `--scorer`, `--budget` and `--reads <result>` change how it runs (§4, §7).
- **`questions:eval`** runs every patient in a set through every arm (§6) and writes a result.

Neither calls a model. `questions:read` (§7) is the only command that does.

---

## 2. The order (OQ 9)

`orderTrials(candidates, statuses)` in `src/shortlist/order.ts`. Pure. Sorts by, in turn:

1. fewest whole-trial hints;
2. fewest hints about one part of the trial;
3. nearest recruiting site, in whole miles, with no distance last;
4. NCT id.

The **short list** is the first `shortlistSize` (§3) of that order. Every candidate stays in the order; nothing is dropped.

- Phase, sponsor, start date, the number of facts mapped and the number of unknowns are not keys. Nothing that could read as "best for you", or reward a trial for having fewer rules the mapper read.
- A test pins the keys and their order, so a later change to them is a visible diff, as the research asks (§5, Ranking).
- **Trials with no mappings** (OQ 9): the 18 the run failed on, and the 31 whose rules mapped nothing, can't get a hint, so they sort with the unhinted trials by distance. That follows "an unknown never excludes". The measurement reports how many short-list places they take (§6.2).
- **Moving a trial down isn't removing it, but it is where a model's reading changes what a person sees first.** A quarter of held-out mappings were wrong (docs/facts.md), so roughly a quarter of the trials pushed below the short list by a hint were pushed by a wrong one. The measurement counts the pushes (§6.2), and `questions:try` prints every hint with its quote.

---

## 3. The conversation's settings (OQ 2, 3, 4)

`data/questions/conversation.json`, loaded and validated by `src/questions/settings.ts`. Its own file, because changing `data/facts/vocabulary.json` changes its hash and orphans the run.

```json
{
  "version": 1,
  "intake": ["histology", "extent", "brain_mets", "ecog", "prior_platinum", "prior_pd1", "prior_targeted", "lines_advanced"],
  "skip": [{ "factId": "pregnant_or_breastfeeding", "sex": "male" }],
  "shortlistSize": 10,
  "budget": 10,
  "scorer": "shortlist"
}
```

- **`intake`** (OQ 2, 3): always asked first, in this order. The research's fixed core (§5.1) less the biomarkers, which are left to the chooser. Every fact must be in the vocabulary and apply to the patient's cancer type.
- **`skip`**: a fact never asked when the search's `sex` matches. Not asked is not answered: the fact stays unknown. The one rule proposed is pregnancy for men. Age-based skips would be clinical judgments, and none is proposed.
- **`shortlistSize`** (OQ 4): ten, the top of the product's "five to ten".
- **`budget`** (OQ 4): the most follow-up questions after the intake. Ten is a placeholder. Gate 2 sets it from the dev curve (§6.3).
- **`scorer`**: which chooser (§4.1). Gate 2 sets it.

Validation reports every problem together, as `loadFactVocabulary` does, and the settings file's hash is recorded on every result.

---

## 4. Choosing the next question

`src/questions/select.ts`. Pure: no model, no file, no clock.

**Askable facts:** for the patient's cancer type (`factsFor`), not in the intake, not already asked, not skipped (§3), and mapped by at least one candidate. A fact answered "I don't know" counts as asked and is never asked again.

### 4.1 Scorers (OQ 1)

Each returns the askable facts in the order it would ask them. Ties always break by vocabulary order.

- **`fixed`**: vocabulary order. What a paper form does; the baseline.
- **`count`**: most candidates that map the fact, the count `dependsOn` prints today.
- **`shortlist`** (proposed): for each askable fact, for each of its answers, how many trials would enter the short list if the person gave that answer, holding everything else fixed. The score is the average over the fact's answers. Then `count`, then vocabulary order.
  - Entering and leaving are equal in number, so this is the size of the change the person would see.
  - The average treats every answer as equally likely. That overrates rare answers, pregnancy most of all, but any weighting would be a base rate, which is a clinical judgment (intent, OQ 1). Gate 2 sees how much it costs.
  - A fact whose every answer leaves the short list unchanged scores 0. It is still askable under `fixed` and `count`, but `shortlist` stops before it (§4.2).

`nextQuestion(state, candidates, run, vocabulary, settings)` returns the first fact of the chosen scorer's order, or a stop reason.

### 4.2 Stopping

In this order:
1. **`budget`**: the follow-ups asked equal the budget.
2. **`nothing-left`**: no askable fact.
3. **`stable`** (`shortlist` only): no answer to any askable fact would change the short list. `fixed` and `count` don't stop here, so they are compared with `shortlist` at equal numbers of questions (§6.3).

### 4.3 The state

`src/questions/conversation.ts`:
- `ConversationState`: the profile, the facts asked in order with what came back (an answer id, or `unknown`), and the stop reason once there is one.
- `runConversation(request, answer, …)` asks the intake, then chooses until a stop, calling `answer(factId)` for each question. `answer` returns an answer id or `unknown`. Synchronous and pure apart from the callback, so a patient's knowledge (§6) or a cached reading (§7) can stand behind it.
- Each step records the short list before and after, so `questions:try` and the curve (§6.2) read from the same record.

---

## 5. Patients (OQ 5, 7)

### 5.1 Shape

One file per made-up person, in `evals/cases/patients/<set>/<id>.json`:

```json
{
  "id": "p03",
  "persona": "71, retired bus driver, short answers, doesn't like medical words.",
  "search": { "cancerType": "nsclc", "zip": "60611", "radiusMiles": 50, "age": 71, "sex": "male" },
  "record": { "histology": "squamous", "egfr": null, "...": "..." },
  "knows": ["histology", "extent", "..."],
  "says": { "prior_pd1": "I was on Keytruda for about a year, then the scans showed it growing." },
  "dontKnow": { "egfr": "They did some test on the biopsy, but nobody told me what it found." },
  "dontKnowPhrases": ["No idea, you'd have to ask my doctor.", "I'm not sure."]
}
```

- **`search`:** a `SearchRequest` (`src/search/types.ts`) less `purposes`, which takes the search command's default. `radiusMiles: null` is anywhere.
- **`record`:** every fact for NSCLC, each an answer id or `null`. `null` means the record doesn't hold it either, such as a biomarker never tested. The full-record arm uses every non-null value.
- **`knows`:** the non-null facts the person can answer themselves. Anything else gets "I don't know".
- **`says`:** for every fact in `knows`, the person's reply in their own words. Read by the reader (§7) and expected to read as `record[fact]`.
- **`dontKnow`:** optional, per fact not in `knows`: a specific reply, often a hedge ("I think it was EGFR? Or maybe that was my sister"). Expected to read as unknown.
- **`dontKnowPhrases`:** two or more general replies, used in turn for a fact not in `knows` without its own `dontKnow` entry, by fact order so the choice is fixed.

`evals/questions/patients.ts` loads and validates them: every NSCLC fact present in `record`, answers valid, `knows` a subset of the non-null facts, `says` exactly for `knows`, `dontKnow` only for facts outside it, the ZIP in the gazetteer, the id matching the file name. All problems reported together.

### 5.2 The convention (OQ 5)

`evals/cases/patients/AUTHORING.md`, written before any patient. Its rules:

- **Writing conventions, not clinical judgments,** as `VIGNETTES.md` says of vignettes. A record is coherent by simple rules a reader can check: at most one driver mutation found among EGFR, ALK, ROS1, RET, NTRK, BRAF V600E, MET exon 14 and KRAS; `lines_advanced` is "zero" for early and resectable disease; a prior targeted drug only with a driver found; prior treatments no more than the lines allow.
- **Spread:** histologies, extents, brain metastases, activity levels and treatment histories across the 20, including someone not yet treated, someone after two lines, one early-stage person, one with ECOG 2, and at least three with a known driver. A table in the file says which patient covers what.
- **Places:** at least six ZIPs, urban and rural, including 0001's Chicago (60611) and Pierre, SD (57501), with radii from 25 miles to anywhere.
- **Knowledge rates, set before writing** (OQ 5): of the non-null facts, "patient" facts known about 90% of the time, "oncologist" facts about 30%, "records" facts (biomarkers and PD-L1) about 35%, after the recall studies in research §1. The loader prints the actual rates; Gate 1 sees them.
- **Replies:** plain words, drug brand names where a person would use them, the occasional misspelling, no answer ids, no fact ids. At least a quarter of the don't-know replies are hedges that name a term without asserting it.
- **No real person.** Made up, every one.

### 5.3 Sets

20 patients. Written and committed together, then assigned by a hash of the id: about 5 to `dev`, the rest to `heldout`. The author doesn't choose which. Dev chooses the scorer, budget and reader prompt; held-out is scored once.

---

## 6. Measurement

`evals/questions/`. Deterministic: no model, no randomness. `--check` reruns the latest result and fails on any difference, as `search:eval` does.

### 6.1 Arms

For each patient, from their search and the run:

| Arm | Profile |
| --- | --- |
| **record** | every non-null record fact. The upper bound: what the mapper says with everything known |
| **intake** | the intake facts the patient knows. The short form |
| **conversation** | intake, then the chosen scorer to a stop, answered from what the patient knows |
| **conversation, knows all** | the same, if the patient knew every non-null record fact. Separates the chooser from the patient's knowledge |
| **from the start** (OQ 2) | no intake: the scorer chooses every question, with the intake's budget added to the follow-ups. Dev only |

The conversation arms run for each of the three scorers.

### 6.2 Numbers

Per patient and summed over the set:

- **questions:** follow-ups asked, and how many came back "I don't know". The stop reason.
- **agreement:** the share of the record arm's short list the arm's short list also holds. If the search keeps fewer than ten, out of those.
- **would-flag:** the share of the arm's short list that carries a whole-trial hint under the record profile. Trials a person would see at the top that their full record would have flagged: the cost of false hope.
- **the curve:** agreement and would-flag after each follow-up, 0 to 20, for each scorer, with the budget lifted. This is how scorers and the budget are compared.
- **pushed down:** trials in the short list with no answers (pure distance order) that end below it, and how many hints moved them.
- **no-mapping places:** short-list places held by trials the run has no mappings for.
- **open questions:** unanswered facts that short-list trials map, the oncologist sheet's length.

Every result records: the patients' set and file hashes, the settings hash, the run name, prompt and vocabulary hash, the snapshot month, and, when reads are used (§7), the reads result.

### 6.3 Gate 2 decides

No bar is set in advance for agreement: there is nothing to set it from. Gate 2 sees the dev curves and chooses. The proposal stands only if:
- `shortlist` reaches the agreement of `fixed` and `count` in fewer questions, or more agreement in the same number; and
- the gap between "conversation" and "conversation, knows all" is the patient's knowledge, not the chooser: knows-all should be at or near the record arm.

If `shortlist` doesn't beat `count`, `count` is simpler and is the finding. Then the scorer and budget are written into `conversation.json` and held-out is scored once.

---

## 7. The reader (OQ 6, 8)

### 7.1 The call

`readReply(fact, reply, adapter, options)` in `src/questions/read.ts`, with its prompt in `src/questions/prompt.ts`, versioned by `hashPrompt` as the parser's and mapper's prompts are.

- **In:** one fact (question and answers, with their words) and one reply. Nothing else: not the patient, not the trials, not other replies (OQ 8).
- **Out:** `{ answer: <answer id> | "unknown" }` as JSON.
- **Validation:** an id not among the fact's answers, a truncated reply, or unreadable JSON is read as `unknown` and recorded as rejected, with the reason. **An unreadable reading never becomes an answer.**
- The prompt says: an answer only when the reply states it; a hedge, a guess or a term mentioned without being asserted is `unknown`; brand names and lay words count when they plainly name the answer.
- Temperature 0, the local model's seed, `maxOutputTokens` small. The adapter is an argument; the reader never reaches the factory.

### 7.2 Reads

`questions:read -- --set dev|heldout` reads every (patient, NSCLC fact) pair once: the `says` reply for a known fact, the `dontKnow` reply or a phrase for the rest. About 31 replies a patient, so about 150 on dev and 460 on held-out. Short calls on the local model, minutes. `--model <spec>` names a hosted model and is dry without `--spend`, through `scripts/lib/model-flags.ts`. None is planned.

The reads, with the run metadata, go to `evals/results/questions/reads/NN-<prompt>.json`. Because every pair is read once, the conversation with the reader in the loop needs no further calls: `--reads <file>` makes `answer(factId)` return the cached reading.

### 7.3 Numbers

On known facts:
- **exact:** read as the record's answer;
- **lost:** read as unknown;
- **wrong:** read as another answer.

On don't-know replies:
- **invented:** read as any answer. The number that matters most: it puts a fact in the profile the person never gave.

Then the conversation arms rerun with `--reads`, for agreement and would-flag beside the deterministic patient's.

Proposed bars for Gate 3, on held-out: invented at most 5%, exact at least 85%. Below them, 0004 offers buttons, not free text. Each number reports its 95% interval (`wilson`, `evals/search/metrics.ts`) and the model, quantization, temperature and seed.

---

## 8. Commands added

| Command | Does |
| --- | --- |
| `npm run questions:try -- --patient <file>` | a patient's conversation, step by step; `--scorer`, `--budget`, `--reads <file>`, `--run <dir>` |
| `npm run questions:eval` | every arm for held-out and write a result; `-- --dev`; `-- --reads <file>`; `-- --check` reruns the latest and fails on any difference |
| `npm run questions:read -- --set dev\|heldout` | read every reply on the local model and write a reads result; `--model <spec>` is dry without `--spend`. Loads `.env` |

## 9. Boundaries

Added to `tests/boundary.test.ts`:
- `src/shortlist/` and `src/questions/`, except `read.ts` and `prompt.ts`, reach no module in `src/models/`, the parser, the screening agent, `src/plain/` or `src/transport/`.
- Nothing under `src/questions/` reaches the model factory: the reader takes its adapter.
- `src/search/`'s existing rule is unchanged; `src/shortlist/` and `src/questions/` may import `src/facts/` and `src/search/` types.
- The patient loader (`evals/questions/patients.ts`) reaches neither the reader nor a model.

The run's loader moves from `scripts/facts-show.ts` to `src/facts/run.ts`, so `evals/` and `scripts/` share it without `evals/` importing `scripts/`.

## 10. Tests

All under `tests/`, deterministic, on small made-up fixtures:
- **order:** each key in turn, ties, no distance last, nothing dropped, and a pin on the key list.
- **settings:** the committed file loads; each rule rejects; every problem reported.
- **select:** each scorer's order on a fixture where they differ; "I don't know" is never re-asked and moves nothing; skips; each stop reason; `shortlist` stops `stable` when nothing could move.
- **conversation:** the intake first, in order; a callback returning `unknown` leaves the short list unchanged; the record of steps.
- **reader:** with `FakeModelAdapter`: an invalid id, truncation and bad JSON all read as unknown and are recorded; the prompt carries only the fact and reply.
- **patients:** the committed patients load; each rule rejects; the set assignment is the hash's.
- **metrics:** agreement, would-flag, the curve and the counts on a two-patient fixture with hand-worked numbers.
- **result:** `--check` passes on the committed latest and fails on a changed number.
- **no verdict:** no string `questions:try` or the result can print contains "eligible", "qualif", "you fit" or "should join".
- **boundaries:** §9.

## 11. Out of scope

- The page, Settings, and what the page offers for answers (0004).
- Ordering by the person's preferences: phase, travel, placebo (product intent, OQ 5).
- Reading several facts from one reply (OQ 8), and a model-played patient (OQ 7).
- Any change to the vocabulary, the mappings, the search or the snapshot.
- The thinking-channel failures in the local adapter (docs/facts.md, Limits).
- A clinician's check of the patients or the replies.
