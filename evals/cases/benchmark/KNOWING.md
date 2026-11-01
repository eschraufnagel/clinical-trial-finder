# What a patient would know

How an **account** is written from an NIH-TrialBench vignette, for the deeper check's "from what they'd know" arm (spec 0008 §7.3). The vignette is a clinician's summary. The account is the same person telling their own story, keeping what patients usually know and dropping what they usually don't. Research §1 and 0003's made-up patients are where these lines come from: many people don't remember being tested for a biomarker, or can't recall the result.

**These are writing rules, not clinical judgments.** Following them shouldn't need medical knowledge beyond turning a drug's abbreviation into its name.

## An account keeps

1. **The cancer,** in the words a patient would use: "cervical cancer", "a T-cell lymphoma", "cancer of the bladder lining". Where the summary names a subtype a patient would have been told (triple-negative breast cancer, small cell, squamous), keep it.
2. **Where it has spread,** by body part: "my liver and my lungs", "lymph nodes in my neck and pelvis".
3. **Each treatment,** by the name a patient would hear (a brand or generic name, or "chemo", "immunotherapy", "a stem cell transplant") and roughly when ("two years ago", "last spring"). Keep **how each ended**: it stopped working, it was stopped for side effects, it was finished as planned. A summary's "progressed on X" becomes "X stopped working".
4. **Surgery and radiation,** what and roughly when: "they took out part of my bladder", "radiation to my pelvis last year".
5. **Other conditions a person would know they have:** diabetes, high blood pressure, a heart problem, HIV, hepatitis, an allergy or reaction to a drug ("I had a bad reaction to carboplatin").
6. **How they are day to day:** working, walking, tired, playing tennis, in bed half the day. Symptoms they'd notice. An ECOG or Karnofsky score is said in the words a person would use for it, and only that: ECOG 0 "I can do everything I did before", 1 "I can do light work, but heavy things tire me", 2 "I look after myself but can't work, and I'm up more than half the day", 3 "I'm in bed or a chair more than half the day".
7. **Their age, and pregnancy or menopause** where the summary says.

## An account drops

1. **Biomarker, genomic and receptor results,** and whether a test was done: PD-L1, CPS, HER2, ER and PR, MSI, TMB, EGFR, KRAS, PIK3CA, CCR4, CD30, p16 or HPV status, BRCA, any panel or ctDNA test by name. A receptor status that names the subtype a patient is told ("triple-negative") is kept as the subtype only.
2. **Lab values:** blood counts, liver and kidney numbers, PSA values, tumor markers. "My blood work was fine" is kept only if the summary says the labs are normal. A trend a patient is told in words, such as a PSA that keeps rising, is kept without its numbers.
3. **Scan and pathology detail:** sizes, SUVs, margins, node counts, grades, Gleason scores, Ki-67, histology beyond the subtype.
4. **Staging codes:** TNM, stage numbers and letters, IPI. "It had spread when they found it" is kept where the summary says so.
5. **Exact dates.** A date becomes roughly how long ago, counted from the latest date in the summary: "about a year ago", "a few months ago".
6. **Doses, cycle counts and regimen acronyms.** "Six cycles of carbo/taxol/pembro" becomes "chemo with carboplatin and paclitaxel, and pembrolizumab".
7. **Clinicians' interpretations** a patient wasn't told in so many words: "likely cervical origin" becomes "they think it started in my cervix" only if the summary suggests the patient was told; otherwise the account just says "cervical cancer".

## Form

- First person, plain words, one to three short paragraphs.
- From the summary alone. Nothing is added that the summary doesn't say, and nothing is guessed: if the summary doesn't say how a treatment ended, neither does the account.
- The first line names the source: `Account of nci-NN, from its patient_summary in data/benchmark/trialbench/vignettes.json, by KNOWING.md.`

## Two worked examples, on made-up text

**Summary (made up):** "58F with stage IIIB (T3N2) squamous cell carcinoma of the cervix, HPV16+, PD-L1 CPS 15, dx 3/2021. Chemoradiation with weekly cisplatin x5 completed 6/2021. Recurrence in para-aortic LNs 2/2023 on PET (SUV 9). Carboplatin/paclitaxel/pembrolizumab x6 then pembro maintenance; progression 11/2023 with new liver mets. ECOG 1. HTN on lisinopril. Cr 0.9."

**Account:** "I'm 58. I was diagnosed with cervical cancer, a squamous kind, about three years ago, and had chemo with cisplatin and radiation at the same time. It came back about two years later in lymph nodes in my belly. I had chemo with carboplatin and paclitaxel with pembrolizumab, then stayed on pembrolizumab, and it stopped working a few months later when the cancer spread to my liver. I'm still up and about most of the day but get tired. I take a pill for high blood pressure."

Dropped: stage and TNM, HPV and PD-L1, the PET and its SUV, the dose and cycle counts, exact dates, creatinine. Kept: the subtype, each treatment, how it ended, where it spread, activity, the other condition.

**Summary (made up):** "71M, DLBCL, GCB subtype, stage IV, IPI 3, dx 1/2024. R-CHOP x6, CR on EOT PET 7/2024. Relapse 2/2025 (biopsy-proven, CD20+). Not a transplant candidate. Neuropathy grade 1 from vincristine. Lives alone, independent."

**Account:** "I'm 71. I have a lymphoma, a diffuse large B-cell lymphoma, found about a year and a half ago. I had chemo with rituximab, called R-CHOP, and it went away, but it came back about a year after I was diagnosed. I was told I'm not a candidate for a transplant. I have some numbness from the chemo. I live on my own and look after myself."

Dropped: the GCB subtype, stage and IPI, the PET, CD20. Kept: the lymphoma's name as a patient would be told it, the treatment and how it ended, the transplant answer they were given, the side effect, independence.
