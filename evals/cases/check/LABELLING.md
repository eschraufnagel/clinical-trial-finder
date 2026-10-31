# Pair labels: is this trial clearly ruled out for this patient?

How slice 0007's labels are written (spec 0007 §7.1). A pair is one made-up patient (`evals/cases/patients/`) and one of the first three trials on their conversation's short list. The label says whether the patient's record plainly fails one of the trial's rules. The check is scored against these labels: a pair labelled clearly ruled out is "caught" when its record shows that rule as "may not fit", and a pair labelled not clearly ruled out with any "may not fit" on its record is a false alarm.

**These are writing conventions, not clinical judgments,** as `VIGNETTES.md` says of vignettes. Checking a label should mean reading two things side by side: the rule, and the patient's record. If deciding would take medical knowledge, the label is "not clearly ruled out".

## Who writes them, and why that limits the claim

The labels are written by the same party that wrote the patients, the spec and the check. Writing them first, from the trial's text and the patient's file alone, before any trial is parsed or checked, stops them being fitted to what the check finds. It doesn't stop shared blind spots. Gate 1 shows the owner every label beside dev's results, and labels may be corrected there, before held-out runs, and never after.

## The order

1. `npm run check:label-show -- --next` prints the next unlabelled pair: the patient's file, with what they know marked, and the trial's eligibility text, numbered by line.
2. Read the whole text against the record. Write the label in `evals/cases/check/pairs.json`.
3. Nothing else is read: no parse, no mapping, no check result. `check:label-show` can't reach them (`tests/boundary.test.ts`).

## Rule 1: "clearly" means one of three forms

A rule clearly rules a patient out only when reading it next to their record is enough, in one of the forms `VIGNETTES.md` allows:

- **Restates.** The rule names something the record says, and excludes it. *"Prior treatment with a PD-1 or PD-L1 inhibitor"* (an exclusion) against `prior_pd1: progressed`, which the record states as Keytruda.
- **Plainly negates.** The rule requires something the record says isn't so. *"Histologically confirmed small cell lung cancer"* against `histology: adenocarcinoma`.
- **Compares a number with a number.** *"No more than one prior line of therapy for metastatic disease"* against `lines_advanced: two`. *"Age 18 to 75"* against age 81.

The record's facts and the search's own fields count: cancer type (every patient has NSCLC), age, sex. Nothing else about the patient exists. A rule about something the record doesn't hold can't clearly rule them out.

## Rule 2: what is never "clearly"

- **Anything needing medical knowledge beyond common drug names.** Whether a regimen counts as "platinum-based", whether a drug is "an ADC with a topoisomerase payload" when the record names only the class: if the record's own answer id says it, it's readable; if it takes knowing what a drug is, it isn't.
- **Undefined qualifiers.** *"Clinically significant"*, *"active"*, *"uncontrolled"*, *"adequate"*, unless the record's answer uses the same word.
- **Labs and the chart.** Organ function, blood counts, measurable disease by RECIST, anything only a test result settles. `measurable_disease` in the record is the person's answer; a rule needing RECIST measurement isn't plainly failed by it.
- **One cohort, when another fits.** A rule that applies to one part of the trial (*"Cohort A: EGFR-mutant"*) rules the patient out only if every part they could enter rules them out. If any cohort's rules the record doesn't plainly fail, the pair is not clearly ruled out.
- **"Or" that the record leaves open.** *"Progressed on or after, or been intolerant of, platinum chemotherapy"* is not plainly failed by `prior_platinum: never` if another route into the trial is open in the text.
- **The trial's cancer named as part of a list.** A trial for "solid tumors, including breast, ovarian…" is not clearly closed to NSCLC unless the text limits it to the listed cancers, or excludes lung cancer in words.

When in doubt, the label is `false`. A false "clearly ruled out" counts as a miss against the check; a false "not ruled out" counts its correct flag as a false alarm. Both are reported, and the second is the smaller harm to the claim.

## Rule 3: one rule is enough

A pair is clearly ruled out by its first rule, in text order, that meets Rule 1. Record that one: its quote, verbatim from the text and long enough to find (a whole bullet, or the sentence), the record facts that fail it (empty when it's cancer type, age or sex), and one sentence saying why, in the record's own terms.

```json
{
  "patient": "p08",
  "nctId": "NCT00000000",
  "set": "dev",
  "clearlyRuledOut": true,
  "rule": {
    "quote": "Patients must not have received prior immunotherapy",
    "facts": ["prior_pd1"],
    "why": "The record says they progressed on a PD-1 inhibitor."
  }
}
```

A pair not clearly ruled out has `"clearlyRuledOut": false` and no `rule`.

## Worked examples

Made up, to show the forms. No trial or patient here is real.

- **Another cancer.** *"Histologically confirmed metastatic castration-resistant prostate cancer."* Every patient has NSCLC: clearly ruled out, `facts: []`, "The record is non-small cell lung cancer; the trial requires prostate cancer."
- **Small-cell.** *"Patients with extensive-stage small cell lung cancer."* Against `histology: squamous`: clearly ruled out, `facts: ["histology"]`.
- **Untreated only.** *"No prior systemic therapy for advanced or metastatic NSCLC."* Against `lines_advanced: one`: clearly ruled out, `facts: ["lines_advanced"]`. Against `lines_advanced: zero`: not.
- **A forbidden prior drug.** *"Prior treatment with osimertinib is not allowed."* Against a record that says `prior_targeted: progressed` with the person saying "Tagrisso": the record's answer id says a targeted drug, and the person's own words name it. That's restating with a common drug name: clearly ruled out, `facts: ["prior_targeted"]`. Against `prior_targeted: progressed` with no drug named: not, since which targeted drug isn't in the record.
- **Not clearly.** *"Adequate organ function"*, *"No clinically significant cardiovascular disease"* against `cardiac_recent: yes`, *"Measurable disease per RECIST 1.1"* against `measurable_disease: no`: none is clearly ruled out (Rule 2).
