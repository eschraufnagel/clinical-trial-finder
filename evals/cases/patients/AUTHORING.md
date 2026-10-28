# Patient guide

How a made-up patient is written for slice 0003's measurement (spec 0003 §5). A patient is a person with NSCLC: where they live, an answer for every fact in their record, which of those they know themselves, and how they'd say each one. Every number 0003 reports is computed against these files, so the rules are written down first, before any patient and before any chooser or reader runs on one.

**These are writing conventions, not clinical judgments,** as `evals/cases/VIGNETTES.md` says of vignettes. A record is coherent by the simple rules below, which `evals/questions/patients.ts` checks. Nothing here claims a record is medically typical, and no clinician has read one.

## Who writes them, and why that limits the claim

The patients are drafted by the same party that wrote the spec, the chooser and the reader's prompt. Writing them first, and splitting them by a hash of their id rather than by choice, stops the chooser and the prompt being tuned to the held-out set. It doesn't stop shared blind spots: a drafter who never imagines a certain reply will neither test for it nor handle it. Gate 1 has a separate agent read every reply blind, which catches replies that don't say what the record says, and not much else.

## The file

One file per person, `evals/cases/patients/<set>/<id>.json`, with ids `p01` to `p20`. The shape is spec 0003 §5.1. In short:

- `search`: cancer type, ZIP, radius (`null` is anywhere), age, sex.
- `record`: every NSCLC fact, each an answer id or `null`. `null` means the record doesn't hold it either: a biomarker never tested, a scan never done.
- `knows`: the non-null facts the person can answer themselves.
- `says`: for each fact in `knows`, their reply in their own words.
- `dontKnow`: for some facts outside `knows`, a specific reply, often a hedge.
- `dontKnowPhrases`: two or more general ways of not knowing, used for every other fact outside `knows`.

## Rule 1: a record is coherent by rules a reader can check

The loader rejects a record that breaks any of these:

- **At most one driver found** among EGFR (any mutation), ALK, ROS1, RET, NTRK, BRAF V600E, MET exon 14 skipping and KRAS (any mutation).
- **A prior targeted drug only with a driver found.**
- **Early, resectable disease has no lines for advanced disease** (`lines_advanced` is `zero`).

Nothing else is checked, and nothing else should need medical knowledge to write. Where a combination would take a clinician to judge, leave the fact `null` in the record rather than guess.

## Rule 2: spread across the twenty

Across the twenty, at least:

- adenocarcinoma, squamous, and one other NSCLC histology;
- one early and resectable, three or more locally advanced, the rest metastatic or recurrent;
- one not yet treated for advanced disease, and two after two or more lines;
- three with a known driver, and one with a driver the person doesn't know about;
- one with brain metastases treated and stable, one with them untreated;
- one at ECOG 2, and none at 3–4 (a person that unwell is rarely searching);
- one with another cancer in their history, one with past pneumonitis, one with an autoimmune disease;
- ages from the 40s to the 80s, and both sexes, with at least one woman of an age where pregnancy is asked about.

The coverage table at the end says which patient covers what.

## Rule 3: places

At least six ZIPs, urban and rural, including 0001's Chicago (60611) and Pierre, SD (57501). Radii from 25 miles to anywhere. Every ZIP must be in `data/geo/`.

## Rule 4: what the person knows, set before writing

Of the non-null facts in a record, by the fact's `whoKnows` in `data/facts/vocabulary.json`:

| Who usually knows | Known by the person |
| --- | --- |
| `patient` | about 90% |
| `oncologist` | about 30% |
| `records` (biomarkers, PD-L1) | about 35% |

The last follows the recall studies in research §1: many patients don't remember being tested, or the result. The rates are targets for the twenty together, not for each patient: some people know their biomarkers well, and some know little beyond their treatments. The loader prints the actual rates, and Gate 1 sees them beside these.

A `null` record fact is never in `knows`: a person can't know what was never found out.

## Rule 5: replies

- **Plain words, as a person would type them.** Drug brand names where a person would use them ("Keytruda", "Tagrisso"), not drug classes. The occasional misspelling or run-on sentence.
- **No answer ids, no fact ids,** and no wording copied from the fact's answers. "It grew while I was on it" is fine; "Yes, and the cancer grew during or after it" is not.
- **A `says` reply states the record's answer** so that someone reading the fact's question and answers, and nothing else, would pick it. If it takes medical knowledge beyond common drug names to connect the two, rewrite it.
- **Don't-know replies vary.** At least a quarter of the twenty's `dontKnow` replies are hedges that name a term without asserting it: "They might have said something about EGFR, I really don't remember." These must read as unknown.
- **One fact per reply.** A reply answers the fact asked. It may mention something else in passing, but never in a way that changes the answer to the fact asked.

## Rule 6: no real person

Every patient is made up. No name, no date of birth, no employer, no doctor or hospital named. A persona is a manner ("short answers, doesn't like medical words"), not an identity.

## Coverage

Filled in once the twenty are written.

| Patient | Histology | Extent | Lines | Driver (known?) | Brain | ECOG | Other | Place |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
