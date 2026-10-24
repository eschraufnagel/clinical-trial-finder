# Fact labels: the convention

How a trial's eligibility text is labelled against the fact vocabulary (`data/facts/vocabulary.json`), for slice 0002's measurement. Written before any trial was labelled. A rule a reader can disagree with is worth more than judgment calls that felt right at the time.

These are **reading conventions, not clinical judgments.** The labeller doesn't decide whether a rule is sensible, only what it says in the vocabulary's terms.

## Who wrote the labels, and why that limits the claim

The labels, the vocabulary and the mapping prompt have one author, Claude. Agreement between the model's mappings and these labels is partly agreement between a prompt and its author. Labels are written before any prompt runs on these trials, and a separate agent relabels a sample blind at Gate 1. No clinician has checked them.

## The unit: a passage

`npm run facts:sample` splits each trial's text into passages, using the same naive splitter as the inherited criterion labels (`splitPassages` in `scripts/label-criteria.ts`). Each passage gets **either** one or more mappings, **or** one `unmapped` category. Never both, and never neither.

- A passage holding two rules that map to two facts ("No active brain metastases or leptomeningeal disease") gets two mappings.
- A passage holding a rule that maps and one that doesn't ("No active hepatitis B or C, and adequate liver function") gets the mapping, plus a `note` naming what was left out.
- A badly split passage is left as split. The labeller labels what is there. If a rule is cut in half, each half is labelled for what it says, and a `note` says so.

## Rule 1: map only what clearly states a requirement on one fact

A rule maps when a reader who knows only the vocabulary would agree that **some answer to that fact, on its own, makes the person ineligible.**

- "ECOG performance status 0 or 1" maps to `ecog`.
- "Adequate organ function" doesn't map: no fact covers it.
- "Patients must have received prior systemic therapy" maps to `lines_advanced`, ruling out `zero`, **only** if the passage makes clear the therapy was for advanced disease. Otherwise it's `trial-specific`.
- **When in doubt, don't map.** A rule left unmapped costs a question later, in stage two. A wrong mapping costs a trial.

## Rule 2: `rulesOut` is exactly what the rule excludes

List every answer the rule clearly makes ineligible, and no answer whose fit is uncertain.

- **Inclusion** "EGFR exon 19 deletion or L858R mutation": `egfr`, ruling out `exon20_insertion`, `other_mutation` and `none_found`.
- **Exclusion** "Prior treatment with a PD-1 or PD-L1 inhibitor": `prior_pd1`, ruling out `progressed` and `stopped_other`.
- **Inclusion** "Disease progression on or after a PD-1 or PD-L1 inhibitor": `prior_pd1`, ruling out `never` and `stopped_other`. A person who stopped for side effects hasn't progressed on it.
- **Not tested is unknown.** No biomarker fact has a "not tested" answer, so a rule never rules it out. "Must have a known EGFR mutation" rules out `none_found` and nothing about someone untested: they could be tested.
- **No rule rules out every answer.** If it seems to, the rule isn't about this fact.
- **Thresholds that fall inside an answer** rule out only the answers wholly on the wrong side:
  - "No other malignancy within 3 years" rules out `within_2_years`. `two_to_5_years` straddles the threshold, so it isn't ruled out, and the note says so.
  - "No other malignancy within 5 years" rules out `within_2_years` and `two_to_5_years`.
  - "At least one but no more than two prior lines" rules out `zero` and `three_plus`, if the lines are for advanced disease.
- **Exceptions that the answers can express are honoured.** "No brain metastases unless treated and stable for at least 4 weeks" rules out `active` only. `treated_stable` fits.
- **Exceptions the answers can't express leave the rule's core.** "No prior immunotherapy within 6 months": no answer says when. The rule doesn't clearly exclude any answer of `prior_pd1`, so it's `trial-specific` with a note.

## Rule 3: rules for part of a trial carry `appliesTo`

When a rule is scoped to an arm, cohort, part or phase, `appliesTo` holds the scope as the trial words it ("Cohort B", "Part 2 (dose expansion)"). Otherwise it's `null`.

- "Cohort A: EGFR-mutant NSCLC; Cohort B: KRAS G12C NSCLC" gives two mappings. `egfr` ruling out `none_found`, `appliesTo` "Cohort A"; and `kras` ruling out `other_mutation` and `none_found`, `appliesTo` "Cohort B".
- A heading the splitter dropped still scopes the passages under it. The labeller reads the full text to see it.
- A rule scoped to part of the trial never rules out the whole trial. Getting `appliesTo` wrong is the worst error the mapper can make.

## Rule 4: what an unmapped passage is

| Category | When | Example |
| --- | --- | --- |
| `organ-function` | A lab value or organ-function threshold | "ANC ≥ 1.5 × 10⁹/L", "adequate hepatic function" |
| `procedure` | Consent, contraception, compliance, washout periods, tissue samples, willingness | "Must provide archival tumor tissue", "No anticancer therapy within 21 days" |
| `vocabulary-gap` | A fact about the person that would plausibly split many trials, but the vocabulary lacks it. A `note` is required and names the missing fact in a few words, the same words each time for the same gap | "Prior osimertinib specifically" → note "prior third-generation EGFR TKI" |
| `trial-specific` | A fact about the person unlikely to recur across trials, or a requirement too entangled to map | "No prior treatment with an anti-TIGIT antibody" |
| `not-a-rule` | A heading, a definition, a sentence fragment, a note to the investigator | "Inclusion Criteria", "Note: stable is defined as…" |

`vocabulary-gap` versus `trial-specific`: the test is whether a question about it would be worth asking across many trials. Prior EGFR TKI generation would be; prior anti-TIGIT antibody wouldn't.

## Worked cases

1. **"Patients with brain metastases are eligible if treated and clinically stable, off steroids for ≥ 14 days."** → `brain_mets` ruling out `active`. The steroid part sits inside the exception, so the note records "steroid condition not mapped". `steroids_daily` isn't mapped from this sentence: it governs only people with brain metastases.
2. **"Prior immunotherapy is allowed if the last dose was more than 6 months before enrollment."** → `trial-specific`, note "time window not in vocabulary". No answer of `prior_pd1` is clearly excluded.
3. **Biomarker cohort:** "Cohort 2: NSCLC with MET exon 14 skipping" → `met` ruling out `amplification` and `none_found`, `appliesTo` "Cohort 2".
4. **"No history of another malignancy within 3 years, except adequately treated basal cell carcinoma."** → `other_cancer` ruling out `within_2_years`, note "3-year window; skin cancer exception not mapped". The exception would only move a person out of `within_2_years`, and someone in that group whose other cancer was a basal cell carcinoma is wrongly ruled out. Recorded as a known cost in the note.
5. **"Creatinine clearance ≥ 50 mL/min."** → `organ-function`.
6. **"Histologically or cytologically confirmed NSCLC."** → `histology` ruling out `mixed_small_cell`. A tumour with a small-cell component isn't NSCLC as trials use the term. Other histologies fit.
7. **"Stage IV or recurrent NSCLC not amenable to curative therapy."** → `extent` ruling out `early_resectable` and `locally_advanced`.
8. **"Squamous or non-squamous NSCLC."** → as case 6: `histology` ruling out `mixed_small_cell`, and nothing else. "Non-squamous NSCLC" alone rules out `squamous` and `mixed_small_cell`.
