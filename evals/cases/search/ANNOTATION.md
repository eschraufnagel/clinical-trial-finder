# Labelling convention: is this trial for someone with NSCLC?

The labels in `nsclc.json` measure one thing: whether the search keeps the trials a person with non-small cell lung cancer (NSCLC) could be considered for. Each label answers one question about one trial, from what the registry says, and gives a reason.

They're written by Claude, not a clinician, and no second labeller has checked them. The convention is set out here so it can be argued with.

## The question

**Would this trial consider an adult with NSCLC, at some stage, for at least one arm or cohort?**

`relevant: true` if yes, `relevant: false` if no.

## What counts

- **A trial for NSCLC**, or for lung cancer without saying which kind, or for a subtype of NSCLC (adenocarcinoma of the lung, squamous NSCLC, EGFR-mutant NSCLC): relevant.
- **A trial open to many cancers** ("advanced solid tumors", "any malignancy", "metastatic cancer"): relevant, unless its rules exclude lung cancer or NSCLC, or limit it to a list of cancers that leaves NSCLC out.
- **A trial with an NSCLC cohort, arm or "other tumor types" group that includes NSCLC**, even if its title and conditions name something else: relevant. Example: a HER2 trial listed under breast and gastric cancer that also enrolls HER2-positive NSCLC.
- **A trial defined by a feature many cancers share**, such as a mutation, brain metastases, leptomeningeal disease, spinal metastases, or a symptom being treated: relevant when NSCLC is among the cancers it names or allows, or when it allows any solid tumor. Not relevant when it names other cancers only.
- **A trial for thoracic cancers in general**: relevant, unless it limits itself to cancers other than NSCLC (mesothelioma only, thymoma only, small cell only).

## What doesn't count

- **Limited to other cancers**, including when lung cancer is mentioned only in an exclusion ("no history of non-small cell lung cancer").
- **Small cell lung cancer only**, or large-cell neuroendocrine carcinoma only: not relevant. They're lung cancers, but not NSCLC.
- **Blood cancers only** (leukemia, lymphoma, myeloma): not relevant.
- **Limited to children**, with no adult arm: not relevant.
- **Doesn't treat or study the cancer itself and doesn't enroll by cancer type** (for example, healthy volunteers): not relevant.

## What doesn't affect the label

Stage, biomarkers, prior treatment, brain metastases, performance status and lab values. A neoadjuvant trial for stage II NSCLC is relevant even though the product's persona has advanced disease. Those are later slices' business, and holding the search to them here would charge it for facts it can't read.

The trial's purpose doesn't affect it either: the sample is drawn from treatment trials already.

## Edge cases settled at Gate 2

An independent labeller relabelled 20 trials blind and raised these. Each was already decided this way in the labels, and is written down here so it's applied the same way next time.

- **A list the record doesn't give** ("the top cancer types", "selected solid tumors" with the selection unnamed): relevant, marked unclear, unless the record excludes lung cancer. NSCLC is the most common form of lung cancer, so an unnamed list of common or selected cancers can't be assumed to leave it out.
- **Neuroendocrine lung tumors** (large-cell neuroendocrine carcinoma, carcinoid, other lung NETs) don't make a trial relevant, even as a cohort inside a basket trial. This follows the rule that "large-cell neuroendocrine carcinoma only" isn't NSCLC. Older classifications grouped LCNEC with NSCLC; this convention doesn't.
- **A "preferred" or "of primary interest" list doesn't limit enrollment.** A trial open to any solid tumor stays relevant whatever its preferred list says. Only a required list that leaves NSCLC out makes it not relevant.
- **MeSH terms can be wrong.** Decide from the title, conditions and rules. A MeSH heading that nothing else in the record supports doesn't change a label.

## Edge cases settled at slice 0005's Gate 1

Each came up several times in slice 0005's labels and was decided the same way each time ([`work/0005-other-cancers/gate-1-labels.md`](../../../work/0005-other-cancers/gate-1-labels.md)).

- **A continuation or extension study** that takes only people already in a parent study, and doesn't limit cancer type: relevant, marked unclear. Someone with NSCLC in the parent study can join it; nobody new can.
- **A supportive-care trial** that treats a side effect or symptom in people with cancer (immunotherapy myocarditis, cardiotoxicity, depression, cognitive problems, nausea, smoking cessation, pain after surgery): relevant when it takes any cancer type or names lung cancer, under "a symptom being treated" above. Not relevant when it's limited to other cancers, for example pain after abdominal surgery only.

## How a label is written

- From `npm run search:show` output only: the registry's title, conditions, keywords, MeSH terms, interventions and eligibility text. Never from search output.
- **The reason** is a sentence or so. It quotes the deciding words where there are any, for example: *"'Patients with histologically confirmed advanced solid tumors' and no lung exclusion."* or *"Conditions and rules are limited to prostate cancer."*
- **When it's genuinely unclear**, decide by the question as worded, say "unclear:" at the start of the reason, and say what tipped it. Unclear labels are counted and reported.
- **A label isn't changed after the search has scored it**, except by a recorded decision in `work/0001-trial-snapshot/plan.md`. For slice 0005's labels (`nsclc-other.json`), the record is in `work/0005-other-cancers/`.
