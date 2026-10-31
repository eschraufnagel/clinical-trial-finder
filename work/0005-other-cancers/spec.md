# spec: 0005 trials for other cancers

**Status:** Draft
**Date:** 2026-10
**Intent:** [intent.md](intent.md). Open questions are cited as OQ n.

This spec says what the check reads, what it marks, how a mark moves a trial, what the page says about it, and how all of it is measured. Each answer to an open question is a proposal, and says where a gate can overturn it.

---

## 1. What changes for a person

- **The search keeps the same trials.** Same funnel, same counts, same reasons.
- **Some trials carry a mark:** their record is about other cancers only, as far as fixed rules can read it.
- **On the page, a marked trial sorts after every unmarked one,** so it reaches the short list only when the search kept too few unmarked trials to fill it. It's still in "every other trial", below.
- **Its card leads with what its record names** (§6), in the record's words, and says to ask the oncologist.
- **Nothing else changes:** the questions, the chooser, the reader, the confirm step, Settings.

## 2. Where this slice sits (OQ 1, OQ 2)

**(OQ 1)** This is 0005. Step 1 renumbers the roadmap:
- the deeper check becomes 0007;
- the benchmark becomes 0008;
- open question 6 points here.

**(OQ 2)** A new row, **0006 Reader on hosted models**, goes in at the same time:
- what it would do: make the reader's prompt usable on a hosted model, then measure it with one held-out reading run, after an owner's go-ahead;
- its measure: 0004's Haiku run, 45% read.

The row is a proposal for that slice's own intent. Nothing in this slice touches `src/questions/` or the reader. If the owner would rather leave the hosted reader as a known limit, step 1 adds no 0006, and the deeper check becomes 0006.

## 3. Labels (OQ 5)

### 3.1 The question

The same as 0001's, by the same convention (`evals/cases/search/ANNOTATION.md`, unchanged):

> Would this trial consider an adult with NSCLC, at some stage, for at least one arm or cohort?

Written from `npm run search:show` output only, with a reason that quotes the deciding words, and "unclear:" where the convention had to be stretched.

### 3.2 The sets

All in a new file, `evals/cases/search/nsclc-other.json`, in `nsclc.json`'s shape, with `set` widened. 0001's file isn't touched, so its result still checks.

| Set | Trials | Drawn how | Used for |
| --- | --- | --- | --- |
| `places-dev` | 54, minus those already in 0001's labels | every trial on a dev patient's short list in the committed `read-first` results | tuning |
| `places-heldout` | 117, minus those already in 0001's labels | every trial on a held-out patient's short list in those results, and on no dev patient's | measuring places |
| `sample` | 150 | the 1,129 NSCLC candidates, less every trial in 0001's labels or the places sets, ordered by `sha256("0005:" + nctId)` | measuring the cost |

- **The committed `read-first` results:** `evals/results/questions/05-7543ffb2cb2e.json` and `with-reads/03-7543ffb2cb2e.json`, all arms. Together, 171 distinct trials, 24 of them in 0001's labels.
- **A trial already in 0001's labels** keeps that label. It isn't labelled twice.
- **Places are counted from every label,** whichever file or set it's in.
- **Tuning reads:** 0001's labels (its held-out 300 and its dev 80), and `places-dev`.
- **Never read while tuning:** `places-heldout` and `sample`.

### 3.3 How they're made

- **`npm run other:sample`** writes the skeleton: each trial with an empty label, in the order drawn. Like `search:sample`:
  - it refuses to overwrite;
  - it reaches the search's vocabulary (`reasonsFor`), to draw `sample` from the NSCLC candidates, but never the check (`src/search/other.ts`) or a model. What the labels must not know is what the check marks.
- **Labelled by Claude,** one trial at a time from `search:show`, before the check's first line is written.
- **A separate agent relabels 20 blind:** 10 from `places-heldout` and 10 from `sample`, drawn by hash. Disagreements are written into the Gate 1 page with both reasons. A label changes only by a recorded decision there.

## 4. The check (OQ 4)

### 4.1 Where it lives

`src/search/other.ts`, pure. It reads:
- a `SnapshotTrial`;
- the cancer type's vocabulary;
- a new data file, `data/cancer-types/nsclc-others.json` (OQ 7).

It returns a mark or `null`.

- **`searchTrials` attaches it** to each candidate as `Candidate.other: OtherMark | null`. It's computed after the cancer stage, so it never drops a trial.
- **A type with no others file** gets `null` for every trial.
- **`nsclc.json` and `reasonsFor` don't change.** 0001's result still passes `search:eval -- --check`.

### 4.2 The others file

```json
{
  "otherCancers": ["prostate", "breast", "lymphoma", "leukemia", "myeloma", "small cell lung cancer", "..."],
  "openPhrases": ["any solid tumor", "other solid tumors", "any malignancy", "tumor agnostic", "..."],
  "notCancer": ["castrate sensitive", "refractory", "recurrent", "..."]
}
```

- **`otherCancers`:** terms that name a cancer that isn't NSCLC.
  - Matched with `containsTerm` from `normalize.ts`, as the search's terms are.
  - "small cell lung cancer" never matches inside "non small cell lung cancer". The check strips every NSCLC name from a field before looking for other cancers.
- **`openPhrases`:** words in an inclusion section that open a trial beyond its named cancers.
- **`notCancer`:** condition words that name no cancer at all ("Castrate-sensitive", "Neoplasm Metastasis"). A condition made only of these, or of generic terms, doesn't count against a listing.
- **A checksum of the file** goes in every result that uses it. It reads `routes` as empty, as the vocabulary's reads `measured` as false, so adopting or dropping a route doesn't rename the result that measured it.
- **The lists are written from dev labels only,** and frozen at Gate 2.

### 4.3 The routes

`routesFor` returns every route that applies, in this order, and `other:eval` scores each route on its own, whatever is adopted. The others file's `"routes": [...]` lists the adopted ones, so Gate 2 can adopt some and not others (OQ 4, leaning (c)). A candidate's mark takes the first adopted route that applies.

1. **`small-cell`.** The trial's every NSCLC match, in listing and rules alike, is "lung cancer" (or another bare lung term) inside a small cell term. Its listing names small cell lung cancer, and no condition is generic.
2. **`biomarker`.** The trial's only reason is `names`, and only by a biomarker term. Every condition or keyword holding that term also names an other cancer ("ALK-Positive Large B-Cell Lymphoma").
3. **`listing`.** Every condition is one of three things:
   - it names an other cancer;
   - it's made of `notCancer` words alone;
   - it's a whole-condition generic term (`wholeConditions`: "Cancer", "Neoplasms") beside at least one named other cancer.

   On top of that, no condition, keyword or title names NSCLC, and no condition holds a contained generic term ("solid tumors", "metastatic cancer").
4. **`rules`.** The listing names an other cancer and holds a contained generic term, or holds only generic terms. Then the inclusion section (§4.4) must:
   - hold a required-diagnosis passage naming other cancers only;
   - hold no open phrase;
   - name no NSCLC term.

The prostate trial (NCT05422911) has "Metastatic Cancer" as a contained generic term, so it can only be caught by `rules`. That's deliberate. "Metastatic cancer" beside a named cancer is exactly where basket trials list their lead cohort.

### 4.4 Reading the inclusion section

No module under `src/search/` reaches the parser (`tests/boundary.test.ts`), so `other.ts` splits the text itself:
- **The inclusion section** is the text after a heading matching `inclusion criteria` and before one matching `exclusion criteria`, both case-insensitive.
- **No inclusion heading:** `rules` doesn't apply, and no mark.
- **A required-diagnosis passage** is one line or bullet in the inclusion section that holds a diagnosis word ("histologically", "cytologically", "confirmed", "diagnosis of", "documented") and an other-cancer term.

Exclusion text is never read for a mark. A lung term there ("no history of lung cancer") is what put many of these trials in the search, and it says nothing about who's included.

### 4.5 What a mark holds

```ts
interface OtherMark {
  route: "small-cell" | "biomarker" | "listing" | "rules";
  /** The other cancers named, as the others file spells them, deduplicated, in order of first appearance. */
  cancers: string[];
  /** The record's own words that decided it: the conditions, or the inclusion passage, verbatim. */
  evidence: string[];
}
```

### 4.6 Measured on dev, then held-out once

**`npm run other:eval`** scores every route over a label set, and writes `evals/results/search/other/NN-<sha>.json`:
- **`-- --dev`:** 0001's labels and `places-dev`;
- **with no flag:** `places-heldout` and `sample`;
- **`-- --check`:** reruns the latest and fails on any difference;
- **`-- --places <questions result>`:** per row of a committed `questions:eval` result, the short-list places held by trials labelled not relevant, by trials with no label, and by marked trials. The places counts live here, not in `questions:eval`, so 0004's results and their `--check` are untouched.

**Each route's rows:**
- **marked, labelled not relevant:** what it gains;
- **marked, labelled relevant:** what it costs, split by "unclear", each trial named with its label's reason;
- **not marked, labelled not relevant:** what it leaves.

**No model is called,** so model, quantization, temperature and seed don't apply. The result names instead:
- the snapshot's sha256;
- the label file's sha256;
- `nsclc.json`'s checksum and the others file's.

## 5. The order (OQ 3)

### 5.1 A new order

`src/shortlist/order.ts` gains a key and an order:

```ts
"other-last": ["other", "wholeTrialHints", "partHints", "unread", "miles", "nctId"],
```

- **`other`** is 1 when the candidate carries a mark from an adopted route, else 0.
- **It comes first.** A trial with one hint against a lung cancer patient may still take them. A trial whose record names prostate cancer alone almost certainly won't, and the hint is about one rule, where the mark is about the whole trial.
- **The existing orders don't read `other`.** 0003's and 0004's results still pass `--check` under the orders they record.

### 5.2 The chooser

The key doesn't depend on any answer, so `shortlistChangeDownOnly` stays exact under `other-last`. An answer still only moves trials down within their mark. The test holding the shortcut equal to the recount gains `other-last` cases.

### 5.3 Move down, not remove

**(OQ 3)** No trial is removed. Gate 2 may instead choose to remove at the search the trials marked by `small-cell` or `biomarker`, if two things hold:
- held-out shows neither route marking a trial labelled relevant;
- the owner prefers a shorter "every other trial".

That changes the search's candidates. It's then a new `search:eval` result beside 0001's, and `facts:map` has nothing to add, since removing trials leaves every remaining one mapped.

## 6. What the page says (OQ 8, OQ 9)

### 6.1 The card

`TrialView` (`src/shortlist/explain.ts`) gains `other: { lead: Words; evidence: Words[] } | null`. It's built from `ours` and `registry` words (`src/shortlist/words.ts`), and shown first on the card, before the phase:

> This trial's record names other cancers: *prostate cancer*. Lung cancer isn't among them. Ask your oncologist whether it takes people with lung cancer.

Under it, the record's deciding words, quoted as registry words:

> From the record: "Castrate-sensitive Prostate Cancer"

Each route's lead sentence is fixed in `src/shortlist/explain.ts`, beside `FLAG_WORDS`, as every card sentence is:

| Route | Lead |
| --- | --- |
| `small-cell` | This trial's record is about small cell lung cancer, a different kind of lung cancer from non-small cell. |
| `biomarker` | This trial's record names a gene change found in lung cancer, but only in other cancers: *lymphoma*. |
| `listing` and `rules` | as above |

The exact words go to Gate 3.

### 6.2 The sheet

**(OQ 9)** A marked trial on the short list keeps its card's `other` line on the sheet. A marked trial below the short list isn't on the sheet, as no trial below it is now (`src/shortlist/sheet.ts`).

The sheet's open questions are counted as now, over every trial on the short list, marked or not, so 0004's "every unknown on the sheet" test holds unchanged.

### 6.3 The list below

"Every other trial" lists marked trials last, as the order puts them, and adds no new section or words.

### 6.4 Never a verdict

0004's verdict-word test runs over every patient's list and sheet with marks on. The new sentences are held by it. No mark sentence says "not for you", "not eligible", "excluded", "doesn't qualify" or "wrong".

## 7. The bar (OQ 6)

**Set now, before held-out is labelled.** On `sample`, a route is adopted only if it marks:
- **no** trial labelled relevant and not "unclear";
- **at most one** trial labelled relevant "unclear", named in the Gate 2 page.

On `places-heldout` and `sample` together, a route that passes is reported with what it gains, whatever that is. A route that fails isn't adopted, whatever it gains.

**`small-cell`, `biomarker` and `listing` are expected to pass.** `rules` is the one at risk. If no route passes, the slice ships the labels and the measurement, and no change to the order. That's a finding, written up in `docs/search.md`.

## 8. Held-out patients, once more

With the adopted routes, `data/questions/conversation.json` gets `"order": "other-last"`, and `npm run questions:eval` runs once over all 20 patients and every arm.

It's reported beside 0004's `04-7543ffb2cb2e.json`, which stays committed, with `other:eval --places` run on both (§4.6):
- **places held by trials labelled not relevant,** before and after, per arm, from every label (§3.2);
- **places held by marked trials;**
- agreement, would-flag, unread places and read ratio, as 0004 reported them.

The note says held-out patients were scored in 0003, rerun in 0004, and are rerun here. The order was chosen on labels, not on these patients' agreement.

`with-reads` is rerun too, from the committed held-out readings. No model is called, since the readings are committed.

## 9. Gates

| Gate | After | Decides | What it costs to be wrong |
| --- | --- | --- | --- |
| **1. Labels** | every label written, and the blind relabel | whether the labels and the convention's edges hold: each disagreement, and any new edge case added to `ANNOTATION.md` | every number in the slice is measured on them, and held-out can't be relabelled after it's scored |
| **2. Routes** | dev tuning, before held-out is scored | the frozen others file, which routes go to held-out, and move-or-remove (OQ 3) | held-out is scored once; lists tuned further after it are tuned on it |
| **3. The page** | held-out scored, the order chosen by §7, the patients rerun | whether the card's and sheet's words, read as a person would read them, imply a verdict, and whether to adopt `other-last` given the rerun | the words ship on the page, and a trial a person could join that's moved down without a reason they can read is the cost this slice must not hide |

Gate 2's answer can be "no route goes to held-out". Gate 3's can be "don't adopt". Then the slice ends with labels and a finding.

## 10. Tests

All deterministic, under `tests/`, on made-up trial records dated 2000:
- **`other.ts`, per route:**
  - a made-up record that should be marked, and its near miss that shouldn't. A basket trial whose listing names breast cancer beside "Solid Tumors" isn't marked by `listing`. One whose inclusion says "any solid tumor" isn't marked by `rules`.
  - NSCLC names are stripped before other cancers are looked for: "non-small cell lung cancer" is never read as small cell.
  - exclusion text is never read.
  - a record with no inclusion heading gets no `rules` mark.
- **The others file:** validated as the vocabulary is. No term repeated or empty, and `routes` only from the four names.
- **The search:** on made-up records, the same candidates, funnel and reasons with and without the others file. Marks attach, and drop nothing.
- **The order:**
  - `other-last`'s keys are pinned;
  - a marked trial sorts after an unmarked one with hints;
  - the existing orders ignore `other`.
- **The chooser:** the shortcut equals the recount under `other-last`.
- **Words:** the verdict-word test covers the mark sentences, and a marked trial on a short list puts its line on the sheet.
- **Boundaries:**
  - `src/search/other.ts` reaches no model, parser or `src/facts/`, under the rule that already covers `src/search/`;
  - `other:sample` reaches no model and not `src/search/other.ts`.
- **Results:** `other:eval -- --check` and `search:eval -- --check` both pass on the committed results.

The browser test gains one check: a made-up patient whose search keeps a marked trial on the short list sees its line on the card.

## 11. Docs

- **`docs/search.md`:** a section on the mark, with the routes, the result, every relevant trial marked, and the limits.
- **`docs/page.md`:**
  - the card's new line;
  - "Trials for other cancers" in Limits rewritten to say what's left;
  - the held-out rerun.
- **`work/ROADMAP.md`:**
  - the 0005 row, marked **Done** when the slice merges;
  - open question 6 answered, or narrowed to what's left;
  - the renumbering from step 1.
- **README:** one line, if the list of parts it gives changes; no findings.

## 12. Out of scope

- A model reading anything new.
- Changes to the fact vocabulary, the mappings, the reader or its prompt.
- A new snapshot.
- Another cancer type on the page.
- The search's six missed trials from 0001, which need the opposite change.
- Per-trial screening.
