# The accounts, derived twice

Spec 0008 §7.3. For 8 vignettes, drawn by `sha256("0008-second:" + patient)`, a separate agent wrote its own account (`accounts-second/`) from `KNOWING.md` and the summaries alone. It didn't see `accounts/`, the pairs or the trials. This page compares the two by content, not wording, read side by side by hand. **Nothing has been reconciled:** both versions stand as written, and Gate 1 decides what changes.

The 8: nci-12, nci-14, nci-16, nci-21, nci-25, nci-31, nci-35, nci-37.

## Where they agree

On every vignette, both versions keep the same cancer, the same treatments in the same order with the same endings, the same surgery and radiation, the same other conditions, and the same day-to-day wording for the ECOG score. Both drop every biomarker, lab value, staging code, exact date and dose. nci-31 is the same in substance. Neither added a fact the summary doesn't give, apart from what's listed below.

## Where they differ

| Vignette | First (`accounts/`) | Second (`accounts-second/`) | Kind |
| --- | --- | --- | --- |
| nci-12 | "cervical cancer, an adenocarcinoma" | "cervical cancer" | The summary contradicts itself (adenocarcinoma, then a squamous recurrence). The first took the opening line; the second dropped the subtype. |
| nci-12 | chemoradiation "because it had grown into the tissue beside my uterus" | no reason given | The first kept a pathology finding (parametrial invasion) as the reason. Rule 3 drops it. **First is wrong.** |
| nci-14, nci-21 | "FOLFIRINOX", "FOLFOX" | the drugs by name: fluorouracil, leucovorin, irinotecan, oxaliplatin | **The convention contradicts itself.** Drop 6 says regimen acronyms become drug names; worked example 2 keeps "called R-CHOP". The first followed the example, the second the rule. |
| nci-25 | "CHOP", "ICE" | cyclophosphamide, doxorubicin, vincristine and prednisone; ifosfamide, carboplatin and etoposide | Same as above. |
| nci-21 | "my kidneys were failing" | stents blocked, nothing about the kidneys | The first turned a creatinine above 15 into kidney failure. Drop 2 removes lab values. **First is wrong.** |
| nci-21 | "a mucinous adenocarcinoma" | "an adenocarcinoma" | Histology beyond the subtype (drop 3). **First is wrong**, narrowly. |
| nci-25 | nothing about where it isn't | "It isn't in my brain or my blood" | **The convention is silent** on findings of absence (no CNS involvement, no leukemic phase). |
| nci-35 | omits the "equivocal" small pelvic nodes | "some small lymph nodes in my pelvis they weren't sure about" | Keep 2 keeps where it has spread. **First omitted a site**, though an uncertain one. |
| nci-35 | "a harmless blood vessel growth" | "a hemangioma" | The first explained the word; the second kept it. The first adds an interpretation the summary doesn't make. |
| nci-37 | omits the portocaval nodes and the possible pelvic site | "lymph nodes near my liver, and maybe something in my pelvis" | **First omitted sites** of spread. |
| nci-37 | "last night up to 103" | "a high fever" | A temperature: the convention says nothing about vital signs. |
| nci-37 | "endometrial cancer" | "uterine cancer" | Wording only. |
| nci-16 | "mixed with another kind of bladder cancer" | "with some urothelial cancer mixed in" | Wording; the second kept the histology's name, which a patient would likely be told. |

## What it says about the convention

- **Two systematic differences come from the convention, not the writers.** Regimen acronyms are contradicted by the worked example, and absence of spread isn't covered. Both matter to the check: a rule such as "no prior oxaliplatin" can't be answered from "FOLFOX", and "no CNS involvement" is a common rule.
- **The first writer, who also wrote the convention, broke it three times** (a pathology reason, a lab value read as kidney failure, a histology word) **and omitted spread sites twice.** The second writer followed the rules more literally.
- **Neither writer invented a treatment, a site or a condition.**

## For Gate 1

The plan says the accounts are applied once, before any check, and not reconciled silently. The choices:
1. **Keep both as written.** The first set goes into the check; this page records how far a second reading differs.
2. **Fix the convention and reapply it to all 35:** drop 6 wins over the example (expand every regimen acronym), and a line on absence ("it isn't in my brain" is kept when the summary says so). Then correct the first writer's three breaks and two omissions, here and wherever the same patterns occur in the other 27.
3. **Use the second writer** for these 8 and the first for the other 27.

The recommendation is option 2, before any model time is spent.
