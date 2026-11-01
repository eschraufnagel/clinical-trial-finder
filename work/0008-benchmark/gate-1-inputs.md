# Gate 1: freeze the inputs, and spend local-model time on the check?

Slice 0008, after step 6. Nothing has been scored, parsed or checked. Every file named here is committed on `0008-benchmark`. The plan's Gate 1 section says what's decided and what it costs to be wrong; this page is what the owner reads to decide.

## What's decided

1. **The nine TREC notes** (below): add 2021's 13, 20 or 56, or drop one.
2. **The twenty vocabularies and every profile's type:** correct a word or a mapping now. After step 7 a change makes the result tuned.
3. **The accounts:** whether `KNOWING.md` hides the right things. **A decision is needed here before the check:** the second derivation found two gaps in the convention and five slips by its first writer ([`accounts-diff.md`](../../evals/cases/benchmark/accounts-diff.md)). Recommended: fix the convention (expand regimen acronyms; keep a stated absence such as "it isn't in my brain") and reapply it to all 35 accounts, then Gate 1 again on the accounts only.
4. **The named rules** in `reasons.json`, below beside each comment.
5. **Go on to the check, or stop after the search.** Stage C spends about an hour parsing 12 trials and roughly 3 to 7 hours checking 28 dev arms.

## 1. The nine TREC notes

| Note | Opening of the note | Type | Age | Sex |
| --- | --- | --- | --- | --- |
| 2021-1 | Patient is a 45-year-old man with a history of anaplastic astrocytoma of the spine complicated by severe lower… | `glioma` | 45 | male |
| 2021-4 | This is a 44 year old female with PMH of PCOS, Obesity, HTN who presented with symptoms of cholecystitis and w… | `lymphoma` | 44 | female |
| 2021-11 | A 75 yo M w/ metastatic papillary thyroid cancer s/p XRT 19 sessions who presented with 2 days of worsening dy… | `thyroid` | 75 | male |
| 2021-15 | 70 year-old woman with a history of CAD recently noted abdominal mass who presents with fevers/rigors and band… | `pancreatic` | 70 | female |
| 2021-17 | 64yo woman with multiple myeloma, s/p allogeneic transplant with recurrent disease and with systemic amyloidos… | `myeloma` | 64 | female |
| 2021-25 | The patient is a 42 year-old postmenopausal woman who had a screening sonogram which revealed an abnormality i… | `breast` | 42 | female |
| 2021-31 | The patient is a 37-year-old woman who came to the clinic for a routine Pap smear. The test revealed stage 1B … | `cervical` | 37 | female |
| 2021-61 | The patient is a 45-year-old postmenopausal woman with cytologically confirmed breast cancer. A core biopsy re… | `breast` | 45 | female |
| 2022-11 | A 63-year-old man comes to the clinic for recent unintentional weight loss. The patient also has epigastric di… | `gastroesophageal` | 63 | male |

Not counted: 2021-13 (a lymphoma treated in 2003, admitted for urosepsis), 2021-20 and 2021-56 (a pituitary adenoma with acromegaly).

## 2. The vignette-to-type mapping

| Type | NCI vignettes |
| --- | --- |
| `anal` | nci-09 |
| `bladder` | nci-14, nci-16, nci-17, nci-18, nci-22, nci-23 |
| `breast` | nci-04, nci-05, nci-06 |
| `cervical` | nci-01, nci-02, nci-07, nci-12 |
| `cutaneous-squamous` | nci-39 |
| `endometrial` | nci-03, nci-37 |
| `gastroesophageal` | nci-10 |
| `germ-cell` | nci-24 |
| `head-and-neck` | nci-08, nci-36 |
| `kidney` | nci-15 |
| `lymphoma` | nci-25, nci-26, nci-27, nci-28, nci-29, nci-30, nci-31, nci-32, nci-33 |
| `melanoma` | nci-41 |
| `merkel-cell` | nci-40 |
| `nsclc` | nci-11, nci-38 |
| `penile` | nci-13 |
| `prostate` | nci-34, nci-35 |
| `urethral` | nci-19, nci-20, nci-21 |

**The four mappings to check first:** urachal adenocarcinoma (nci-14, 23) to `bladder`; small-cell, large-cell neuroendocrine and squamous cancers of the bladder (nci-16, 17, 18, 22) to `bladder`; SMARCB1-deficient renal medullary carcinoma (nci-15) to `kidney`; nci-19, with a remote prostate cancer and a current urethral clear cell adenocarcinoma, to `urethral`.

**Profiles that say what was used:** nci-05 states no sex (triple-negative breast cancer, read as female); nci-34 and nci-35 state no age (65 used).

## 3. The twenty vocabularies

Each is `measured: false`, written before any judged trial or label was read. `nsclc.json` is the model for their shape. Names match whole words in conditions, keywords, titles and eligibility text; MeSH headings match exactly; biomarkers match in conditions and keywords.

| Type | Names | MeSH headings | Biomarkers |
| --- | --- | --- | --- |
| `anal` | anal cancer, anal canal cancer, anal carcinoma, anal squamous cell, anal neoplasm, anal neoplasms, cancer of the anus, carcinoma of the anus, anus neoplasms, anal canal | Anus Neoplasms | — |
| `bladder` | bladder cancer, bladder carcinoma, bladder neoplasm, bladder neoplasms, bladder tumor, bladder tumors, urinary bladder, urothelial carcinoma, urothelial cancer, transitional cell carcinoma, carcinoma of the bladder, urachal, urothelial | Urinary Bladder Neoplasms; Carcinoma, Transitional Cell; Urologic Neoplasms | fgfr3, nectin 4 |
| `breast` | breast cancer, breast cancers, breast carcinoma, breast neoplasm, breast neoplasms, breast tumor, breast tumors, breast adenocarcinoma, carcinoma of the breast, cancer of the breast, mammary carcinoma, invasive ductal carcinoma, ductal carcinoma, lobular carcinoma, triple negative breast, tnbc | Breast Neoplasms; Carcinoma, Ductal, Breast; Triple Negative Breast Neoplasms; Breast Neoplasms, Male; Inflammatory Breast Neoplasms | estrogen receptor positive, er positive, hormone receptor positive, hr positive, triple negative |
| `cervical` | cervical cancer, cervical cancers, cervical carcinoma, cervix cancer, cancer of the cervix, carcinoma of the cervix, uterine cervical neoplasms, cervical neoplasm, cervical neoplasms, cervical squamous cell, cervical adenocarcinoma | Uterine Cervical Neoplasms | — |
| `cutaneous-squamous` | cutaneous squamous cell, cutaneous squamous cell carcinoma, cscc, skin squamous cell carcinoma, squamous cell carcinoma of the skin, squamous cell skin cancer, non melanoma skin cancer, nonmelanoma skin cancer, keratinocyte carcinoma, skin cancer | Skin Neoplasms | — |
| `endometrial` | endometrial cancer, endometrial carcinoma, endometrial neoplasm, endometrial neoplasms, endometrial adenocarcinoma, uterine cancer, uterine carcinoma, uterine serous carcinoma, cancer of the endometrium, carcinoma of the endometrium, carcinoma of endometrium, uterine corpus | Endometrial Neoplasms; Uterine Neoplasms; Carcinoma, Endometrioid | — |
| `gastroesophageal` | gastric cancer, gastric cancers, gastric carcinoma, gastric adenocarcinoma, stomach cancer, stomach neoplasms, stomach neoplasm, gastroesophageal junction, gastro esophageal junction, gej, esophagogastric junction, esophageal adenocarcinoma, esophageal cancer, oesophageal cancer, esophageal neoplasms, gastroesophageal cancer, gastroesophageal adenocarcinoma | Stomach Neoplasms; Esophageal Neoplasms | claudin 18 2, cldn18 2 |
| `germ-cell` | germ cell tumor, germ cell tumors, germ cell tumour, germ cell tumours, germ cell neoplasm, germ cell cancer, testicular cancer, testicular neoplasms, testicular germ cell, seminoma, nonseminoma, non seminomatous, choriocarcinoma, yolk sac tumor, embryonal carcinoma, teratoma | Neoplasms, Germ Cell and Embryonal; Testicular Neoplasms; Seminoma; Germinoma | — |
| `glioma` | glioma, gliomas, astrocytoma, astrocytomas, anaplastic astrocytoma, glioblastoma, glioblastoma multiforme, gbm, oligodendroglioma, high grade glioma, low grade glioma, brain tumor, brain tumors, brain tumour, brain cancer, spinal cord tumor, spinal cord tumors, central nervous system tumor, cns tumor, primary brain | Glioma; Astrocytoma; Glioblastoma; Oligodendroglioma; Brain Neoplasms; Spinal Cord Neoplasms; Central Nervous System Neoplasms | mgmt, h3 k27m |
| `head-and-neck` | head and neck cancer, head and neck cancers, head and neck squamous cell, head and neck carcinoma, head and neck neoplasms, hnscc, scchn, oropharyngeal cancer, oropharyngeal carcinoma, oropharynx, laryngeal cancer, laryngeal carcinoma, larynx cancer, hypopharyngeal, oral cavity cancer, oral cancer, tonsil cancer, tonsillar, tongue cancer, pharyngeal cancer, nasopharyngeal carcinoma | Head and Neck Neoplasms; Squamous Cell Carcinoma of Head and Neck; Oropharyngeal Neoplasms; Laryngeal Neoplasms; Hypopharyngeal Neoplasms; Mouth Neoplasms; Tonsillar Neoplasms; Tongue Neoplasms; Pharyngeal Neoplasms; Nasopharyngeal Neoplasms | — |
| `kidney` | kidney cancer, kidney neoplasms, kidney neoplasm, renal cancer, renal carcinoma, renal cell carcinoma, renal cell cancer, rcc, renal medullary carcinoma, renal neoplasm, clear cell renal, papillary renal | Kidney Neoplasms; Carcinoma, Renal Cell | vhl |
| `lymphoma` | lymphoma, lymphomas, non hodgkin, non hodgkin lymphoma, nhl, hodgkin lymphoma, hodgkin disease, b cell lymphoma, t cell lymphoma, dlbcl, diffuse large b cell, burkitt, burkitt lymphoma, peripheral t cell, ptcl, angioimmunoblastic, anaplastic large cell, follicular lymphoma, mantle cell lymphoma, marginal zone lymphoma, mycosis fungoides, enteropathy associated, hepatosplenic | Lymphoma; Lymphoma, Non-Hodgkin; Hodgkin Disease; Lymphoma, B-Cell; Lymphoma, T-Cell; Lymphoma, T-Cell, Peripheral; Lymphoma, Large B-Cell, Diffuse; Burkitt Lymphoma; Lymphoma, Follicular; Lymphoma, Mantle-Cell; Lymphoma, Large-Cell, Anaplastic; Immunoblastic Lymphadenopathy; Enteropathy-Associated T-Cell Lymphoma | cd30 |
| `melanoma` | melanoma, melanomas, malignant melanoma, cutaneous melanoma, metastatic melanoma | Melanoma | — |
| `merkel-cell` | merkel cell, merkel cell carcinoma, mcc, neuroendocrine carcinoma of the skin | Carcinoma, Merkel Cell | — |
| `myeloma` | multiple myeloma, myeloma, plasma cell myeloma, plasma cell neoplasm, plasma cell neoplasms, plasmacytoma, plasma cell dyscrasia | Multiple Myeloma; Neoplasms, Plasma Cell; Plasmacytoma | bcma |
| `pancreatic` | pancreatic cancer, pancreatic cancers, pancreatic adenocarcinoma, pancreatic ductal adenocarcinoma, pdac, pancreatic carcinoma, pancreatic neoplasm, pancreatic neoplasms, cancer of the pancreas, carcinoma of the pancreas, pancreas cancer | Pancreatic Neoplasms; Carcinoma, Pancreatic Ductal | — |
| `penile` | penile cancer, penile carcinoma, penile squamous cell, penile neoplasms, penile neoplasm, cancer of the penis, carcinoma of the penis | Penile Neoplasms | — |
| `prostate` | prostate cancer, prostate cancers, prostate carcinoma, prostate adenocarcinoma, prostatic cancer, prostatic carcinoma, prostatic adenocarcinoma, prostatic neoplasms, prostate neoplasm, prostate neoplasms, crpc, mcrpc, castration resistant, castrate resistant, biochemical recurrence | Prostatic Neoplasms; Prostatic Neoplasms, Castration-Resistant | psma |
| `thyroid` | thyroid cancer, thyroid cancers, thyroid carcinoma, thyroid neoplasm, thyroid neoplasms, papillary thyroid, follicular thyroid, anaplastic thyroid, medullary thyroid, differentiated thyroid, cancer of the thyroid | Thyroid Neoplasms; Thyroid Cancer, Papillary; Thyroid Carcinoma, Anaplastic | — |
| `urethral` | urethral cancer, urethral carcinoma, urethral neoplasm, urethral neoplasms, urethral adenocarcinoma, cancer of the urethra, carcinoma of the urethra, upper tract urothelial, urothelial carcinoma, urothelial cancer | Urethral Neoplasms; Urologic Neoplasms | — |

**Choices to argue with:** broad MeSH headings are included where a trial so tagged could take the patient (recall first, as `nsclc.json` names "lung cancer"): `Brain Neoplasms` for glioma, `Skin Neoplasms` for cutaneous squamous, `Uterine Neoplasms` for endometrial, `Urologic Neoplasms` for bladder and urethral. `cutaneous-squamous` names "skin cancer". `gastroesophageal` names esophageal cancer. Shared biomarkers (HER2, BRAF, KRAS, PD-L1, HPV) are left out.

## 4. The accounts

35 accounts, one per vignette in the pairs, in [`evals/cases/benchmark/accounts/`](../../evals/cases/benchmark/accounts/), by [`KNOWING.md`](../../evals/cases/benchmark/KNOWING.md). Two rules were added to the convention while writing them, before the second derivation: an ECOG score is said in a person's words, and a lab trend a patient is told in words ("my PSA keeps rising") is kept without its numbers.

The second derivation of 8, its differences and the three options are in [`accounts-diff.md`](../../evals/cases/benchmark/accounts-diff.md). In short: the same cancer, treatments, endings, surgery, radiation, conditions and activity on all 8; the differences are regimen acronyms (the convention contradicts itself), absence of spread (the convention is silent), three places the first writer broke a drop rule, and two where it omitted a site of spread.

## 5. The named rules

35 ineligible pairs: 18 name a rule, quoted from the trial's text; 12 say the trial is for another disease or purpose; 5 give no rule that's in the text.

| Pair | Clinician's comment | Kind | Quote or note |
| --- | --- | --- | --- |
| nci-01 × NCT01900132 | This is a study for patients with neuromuscular disorders. TrialGPT noted the patient has chemotherapy-induced neuropathy, which is not a neuromuscular disorder. Further, this patient is presumedly searching for a cancer treatment trial, which this is not. | disease | — |
| nci-01 × NCT03331380 | This is a study to test a new kind of MRI. TrialGPT flagged cancer as a "non cardiac disease" which while technically true is not what the study elibility criteria means. Further, the patient is searching for a cancer treatment trial, which this is not. | disease | — |
| nci-02 × NCT03331380 | This is a study to test a new kind of MRI. TrialGPT flagged cancer as a "non cardiac disease" which while technically true is not what the study elibility criteria means. Further, the patient is searching for a cancer treatment trial, which this is not. | disease | — |
| nci-03 × NCT00924027 | The trial description is vague that "Patient may benefit from brachytherapy." This patient has presumedly stage IV disease due to ascites, and a patient at that stage would not be considered likely to benefit from brachytherapy. Therefore patient would not be offered this treatment in the real world and would instead be more appropriate for treatment with a systemic agent. | rule | "Pathologically confirmed malignancy for which high-dose rate brachytherapy is appropriate as a component of their therapeutic regimen." |
| nci-04 × NCT04222413 | Patient does have standard therapy options available | rule | "have no standard therapy option available (Phase IB2)" |
| nci-04 × NCT04449549 | Tumor does not meet RARECARE definition | rule | "Patients must have histologically confirmed rare solid tumors that have progressed on standard therapy known to prolong survival or for which no standard treatment options exist." |
| nci-04 × NCT04847050 | Patient completed pembrolizumab and is no longer on this | rule | "Histologically or cytologically confirmed solid tumor receiving a standard of care programmed cell death protein 1 (PD1)/Programmed death-ligand 1 (PDL1) inhibitor for treatment of their solid tumor" |
| nci-07 × NCT00102544 | This is a trial for patients already enrolled on an NIH tiral and getting a procedure. This does not match patient's goal to find a cancer treatment trial. | disease | — |
| nci-08 × NCT03331380 | This is a trial for patietns already enrolled on an NIH tiral and getting a procedure. This does not match patient's goal to find a cancer treatment trial. | disease | — |
| nci-09 × NCT00102544 | This is a trial for patietns already enrolled on an NIH trial and getting a procedure. This does not match patient's goal to find a cancer treatment trial. | disease | — |
| nci-10 × NCT03331380 | This trial is to test a new MRI in healthy volunteers or patients with cardiac disease, but the vignette patient is looking for a cancer treatment trial | disease | — |
| nci-11 × NCT03331380 | This trial is to test a new MRI in healthy volunteers or patients with cardiac disease, but the vignette patient is looking for a cancer treatment trial | disease | — |
| nci-12 × NCT00102544 | This is a study for patients already enrolled on another NIH protocol scheduled for a procedure. It is not a treatment trial for cancer patients which this patient is looking for. | disease | — |
| nci-12 × NCT03331380 | This trial is to test a new MRI in healthy volunteers or patients with cardiac disease, but the vignette patient is looking for a cancer treatment trial | disease | — |
| nci-14 × NCT01900132 | exclusion criteria of preexisting peripheral neuropathy; in addition patient has peripheral neuropathy secondary to prior chemotherapy (not a primary neuromuscular disorder) | rule | "History of stroke, muscle disorders, peripheral neuropathy or spine surgery" *The quoted rule is in the healthy volunteers' exclusions; the comment also says the trial is for primary neuromuscular disorders.* |
| nci-15 × NCT05715281 | Would exclude as patient is eligible for other phase II trials - "Patients must not be eligible for a higher priority study that would be feasible for them to enroll in, such as a disease specific study of phase 2 or higher or a randomized study" | rule | "Patients must not be eligible for a higher priority study that would be feasible for them to enroll in" |
| nci-16 × NCT04501094 | this patient does not have urothelial cancer (ineligible) | rule | "Patients with histologically confirmed diagnosis of urothelial carcinoma of the urinary tract" |
| nci-19 × NCT04449549 | (none) | none | *No comment.* |
| nci-21 × NCT01900132 | patient likely has neuropathy from chemotherapy and not a primary neuro motor disorder | disease | — |
| nci-29 × NCT05327023 | No prior allo | none | *The comment names a prior allogeneic transplant. No rule in the trial's text requires one: the trial is of donor lymphocytes after a transplant it gives.* |
| nci-30 × NCT05327023 | requires prior allo HSCT | none | *The comment names a prior allogeneic transplant. No rule in the trial's text requires one: the trial is of donor lymphocytes after a transplant it gives.* |
| nci-31 × NCT02337985 | Pt does not have HIV. | rule | "HIV seropositive at or before the time of lymphoma diagnosis" |
| nci-31 × NCT05327023 | Pt never received allogenic transplant | none | *The comment names a prior allogeneic transplant. No rule in the trial's text requires one: the trial is of donor lymphocytes after a transplant it gives.* |
| nci-32 × NCT02211755 | Pt does not have a solid tumor, have a hematological malignancies. | rule | "Histologically confirmed solid tumors that have progressed on standard therapy known to prolong survival or for which no standard treatment options exist" |
| nci-32 × NCT03223610 | This trial for is the correct disease, but pt is treatment naive, not relapsed/refractory. | rule | "Relapsed and/or refractory DLBCL and subtypes" |
| nci-32 × NCT03816345 | Pt has curable cancer, regardless of stage. | rule | "histologically confirmed malignancy that is radiologically evaluable and metastatic or unresectable" *The comment says the cancer is curable; the nearest rule is the trial's requirement of metastatic or unresectable disease.* |
| nci-32 × NCT04959175 | (none) | none | *No comment.* |
| nci-34 × NCT00720785 | IC#1 defines specific cancer types, not a generic basket trial | rule | "Diagnosed with histologically confirmed metastatic solid tumor" *The comment names inclusion criterion 1, which lists specific cancers (prostate adenocarcinoma among them) that are metastatic and unresectable.* |
| nci-34 × NCT01553188 | IC#1 requires "continued to progress ...despite adequate androgen-deprivation therapy"; from this note PSA increased after eligard was stopped | rule | "despite adequate androgen-deprivation therapy" |
| nci-34 × NCT01867333 | current T levels are high (TriaGPT thinks they're missing) | rule | "Castrate testosterone level" |
| nci-35 × NCT00102544 | pt hasn't had an MRI | rule | "Patients are eligible if they have undergone a prostate MRI" |
| nci-35 × NCT03253744 | no local recurrence confirmation | rule | "Patients must have histologically confirmed locally recurrent adenocarcinoma of the prostate after prior radiation" |
| nci-35 × NCT03388632 | must have measurable or evaluable disease; this is by RECIST, PSA does not count, though it is not clarified in the Inclusion criteria | rule | "Subjects must have evaluable, or measurable disease" |
| nci-37 × NCT00924027 | "for which high-dose rate brachytherapy is appropriate as a component of their therapeutic regimen" => Hard for TrialGPT to know if brachy is (not) appropriate here, but should be've been picked up in either missing info or Rationale as a question | rule | "Pathologically confirmed malignancy for which high-dose rate brachytherapy is appropriate as a component of their therapeutic regimen." |
| nci-38 × NCT03816345 | Odd situation - TrialGPT is not wrong, but to be eligible you need to have an autoimmune condition that would normally be a contraindication for immunotherapy | disease | *The trial is for people with cancer and an autoimmune disorder, as its title says; no single inclusion line states it.* |

**To check first:** the three NCT05327023 pairs, whose comments name a prior allogeneic transplant that no rule in the text requires (read as `none`), and nci-38 × NCT03816345, read as `disease` (a trial for people with cancer and an autoimmune disorder).

## 6. The pairs

| | Recommended | Eligible, not recommended | Ineligible | All |
| --- | --- | --- | --- | --- |
| Dev | 6 | 3 | 5 | 14 |
| Held-out | 21 | 5 | 30 | 56 |

70 pairs over 42 trials and 35 vignettes. Dev vignettes: nci-01, nci-06, nci-12, nci-13, nci-17, nci-25, nci-37, nci-41.

## Recommendation

- Approve the notes, the mapping, the vocabularies and the named rules, or correct them here.
- **Choose option 2 for the accounts:** fix the two gaps in `KNOWING.md`, reapply to all 35, and bring the accounts alone back to the gate.
- Then go on to stages B and C.

## Answer

**First answer (2026-10): fix the convention and reapply it to all 35 accounts** (option 2 in `accounts-diff.md`). `KNOWING.md` expands every regimen acronym, keeps a stated absence, and drops measured values; the first writer's breaks and omissions are corrected wherever the same patterns occur. The accounts alone come back to this gate. The notes, the mapping, the vocabularies, the named rules and the go-ahead for the check aren't answered yet.

## The accounts again, after the first answer

**`KNOWING.md` now:**
- **drop 6:** every regimen acronym becomes its drugs' names, because a trial's rules name drugs. Worked example 2 follows it ("rituximab, cyclophosphamide, doxorubicin, vincristine and prednisone", not "R-CHOP");
- **keep 8 (new):** what the summary says isn't there, such as no spread to the brain, nothing in the blood, a clear bone scan, symptoms denied, no allergies. Negative marker tests stay dropped;
- **drop 8 (new):** measured values of any kind, vital signs included;
- **Form:** a finding isn't turned into its consequence, isn't given as a reason, and a word isn't explained beyond what the summary says.

**Reapplied to all 35. 21 accounts changed; the other 14 had nothing these rules touch:**

| Account | Change |
| --- | --- |
| nci-01 | Keep 8: the symptoms the summary says she denies |
| nci-04 | Drop 6: "ddAC+T", which the account had left as "chemo", now doxorubicin and cyclophosphamide, then paclitaxel |
| nci-05 | Drop 6: "the KEYNOTE 522 regimen", which the account had as "chemo with immunotherapy", now pembrolizumab with carboplatin and paclitaxel, then doxorubicin and cyclophosphamide |
| nci-07, nci-12 | Form: the pathology reason for chemoradiation removed |
| nci-09, 10, 19, 21, 23 | Drop 6: FOLFOX named as its drugs |
| nci-13 | Drop 6: TIP as paclitaxel, ifosfamide and cisplatin |
| nci-14 | Drop 6: FOLFIRINOX as its drugs. Form: "nerve damage", without the hands and feet the summary doesn't name |
| nci-20 | Drop 6: CAPOX as capecitabine and oxaliplatin |
| nci-21 | Form: "my kidneys were failing" removed. Drop 3: "mucinous" removed. "Peripheral neuropathy" without the hands and feet |
| nci-25 | Drop 6: CHOP and ICE. Keep 8: not in the brain or blood |
| nci-26 | Drop 6: BV-CHP as brentuximab vedotin with cyclophosphamide, doxorubicin and prednisone. Keep 8: not in the blood. "B symptoms" named as the summary does |
| nci-28, nci-29 | Drop 6: CHOP (and ICE). Keep 8: not in the brain or blood |
| nci-30 | Drop 6: ICE. Keep 8: not in the brain, no leukemia |
| nci-35 | Keep 2: the uncertain pelvic nodes added. Form: "a hemangioma", not "a harmless blood vessel growth" |
| nci-37 | Keep 2: the nodes near the liver and the possible pelvic site added. Drop 8: "a high fever", not "103" |
| nci-41 | Keep 8: no allergies |

**Two expansions needed knowledge beyond an abbreviation,** which `KNOWING.md` says shouldn't happen: nci-04's "ddAC+T" and nci-05's "KEYNOTE 522 regimen", a trial's name for a standard regimen. Both are written out with the regimen's usual drugs. The owner can choose to leave them as the summary gives them instead.

`accounts-second/` is unchanged: it's the record of what an independent reading of the first convention gave.

**What's asked now:** approve the accounts as they stand. The rest of Gate 1 (the notes, the mapping, the vocabularies, the named rules, the go-ahead for the check) is still open.

**Second answer (2026-10): the accounts are approved as they stand,** the two flagged expansions (nci-04, nci-05) included. They're frozen from here: no account changes after any check runs. Still open: the notes, the mapping, the vocabularies, the named rules and the go-ahead for the check.
