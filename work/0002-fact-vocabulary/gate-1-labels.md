# Gate 1: the labels and the vocabulary

**Question:** is the vocabulary worth spending model time on? Do the labels follow `evals/cases/facts/ANNOTATION.md`? Answered with no model involved.

## The blind relabel

A separate agent labelled 5 of the 40 trials: the first five by `sha256("gate1:" + nctId)`, two dev and three held-out, 280 passages. It worked from `ANNOTATION.md`, the vocabulary and an unlabelled view of each trial, and it didn't see these labels. Its answers are in [gate-1-relabel.txt](gate-1-relabel.txt), in the notation the labels were written in.

| | Before fixes | After fixes |
| --- | ---: | ---: |
| Passages labelled identically | 247 of 280 (88.2%) | 252 of 280 (90.0%) |
| Passages either labeller mapped | 53 | 53 |
| Mapped by both, with identical mappings | 44 of 46 | 49 of 49 |
| Mapped by one labeller only | 7 | 4 |

### What the comparison found, and what changed

**A notation error in these labels, now fixed.** In the notation used to write the labels, "a; b @scope" attached the scope to `b` only. Four passages, in NCT07436728 and NCT06792552, had cohort-only rules (histology, EGFR, extent, measurable disease) recorded as whole-trial rules. That is the error the measurement treats as worst. All four now carry their scope on every mapping. One other use of the form (NCT06710379 #4) was meant to scope only its second mapping, and is right.

**Missed worked cases, now fixed.** The relabel applied worked cases 6 and 8 where these labels hadn't. "Confirmed NSCLC" maps to `histology`, ruling out `mixed_small_cell`; "squamous and non-squamous NSCLC" does the same. A search of all 40 trials found three more passages with the same miss (NCT05502523 #1, NCT05570825 #2, NCT06865339 #1). Together with the relabel's, seven passages changed. The relabel also mapped a passage in NCT07436728 that the splitter had joined to a heading (#8, dose-expansion extent) and a heading that states the rule (#84, HIV and hepatitis).

**Two convention points, now written into `ANNOTATION.md`:**
- **Rules inside another cancer type's cohort** are `not-a-rule`, note "search". The relabel mapped one, the gastric cohort's prior platinum rule, and labelled others `trial-specific` or `vocabulary-gap`. These labels had them as `not-a-rule`.
- **A heading that states the rule** gets the rule's mappings.

**Left as labelled, with the disagreement recorded:**
- **NCT07436728 #10, platinum required "for participants with no known activating mutations".** Labelled `prior_platinum` ruling out `never`, scoped, because #11 requires platinum for people with a mutation too. The relabel called it `trial-specific` as conditional. Both readings avoid a wrong rule-out.
- **NCT05696782 #3, "unresectable or medically inoperable".** Labelled `extent` ruling out `early_resectable`. The relabel called it `trial-specific`, since someone medically unable to have surgery might still answer "early, can be removed with surgery". It's a fair doubt about the answer's wording, and it belongs in the decision below.
- **NCT07436728 #46, "history of known autoimmune disease, except vitiligo, hypothyroidism on replacement…".** Labelled `vocabulary-gap`. The relabel mapped it to `autoimmune_active` ruling out `yes`. Elsewhere in these labels a rule with no exceptions list was mapped. The question is what `autoimmune_active` means, which is part of the decision below.
- **24 passages where both left the rule unmapped but chose different categories:** procedure, not-a-rule, trial-specific or organ-function. These change the coverage denominators a little and no mapping.

## Coverage, after the fixes

From `npm run facts:eval -- --coverage`:

| | All 40 | Held-out 30 |
| --- | ---: | ---: |
| Passages | 1,515 | 933 |
| Rules (not headings or permissions) | 1,131 | 736 |
| Mapped | 280 (24.8% of rules) | 186 (25.3%) |
| Rules about the person: mapped, gaps and trial-specific | 688 | 450 |
| **Mapped share of rules about the person** | **40.7%** | **41.3%** |
| Vocabulary gaps | 70 | 46 |
| Mappings scoped to part of a trial | 39 | |

**Facts most used** (trials of 40): ECOG 35, extent 30, pregnancy 21, measurable disease 21, brain metastases 20, hepatitis 19, HIV 18, other cancer 17. **Never used:** BRAF, NTRK, MET, prior targeted therapy, prior antibody-drug conjugate.

**Most frequent gaps** (trials): steroids with a dose threshold or "able to stop" (10); brain metastases with conditions, mostly "symptomatic only" (7); other cancer with a different window or "active only" (6); prior ADC by payload or drug (5); pneumonitis that needed steroids (5); autoimmune with a different window (5); prior targeted therapy by target (5).

## The decision

Gate 1 decides whether to change the vocabulary before any model maps anything. Every fact changed now costs relabelling only the passages that use it; after stage B it also costs re-tuning and rerunning. Four candidate changes, each from the gap counts:

1. **`steroids_daily` → "more than 10 mg prednisone a day, or unable to stop".** It covers the 10 gap trials, and the 2 trials mapped today still map.
2. **`prior_adc` → "prior ADC with a topoisomerase I payload (such as T-DXd, Dato-DXd, sacituzumab)".** Unused as written. Rewritten, it would cover 4–5 trials.
3. **`brain_mets` gains a fourth answer, "untreated but no symptoms",** so "symptomatic only" rules can map. It covers 5–7 trials.
4. **`autoimmune_active` reworded** to "needed medicine that calms the immune system, such as steroids or immunosuppressants, in the last 2 years". That excludes thyroid replacement and skin-only treatment, matching the trials' standard exceptions. It settles the #46 disagreement.

Leaving them is also a defensible answer. The finding would then be that 31 facts express about 40% of rules about the person, and that the gaps, not the fact count, are what's missing.

## Answer (owner, 2026-10): make all four changes

The four changes, as made:

1. **`steroids_daily` became `steroids`:** none / 10 mg prednisone a day or less / more than that. "More than 10 mg" and "except up to 10 mg" rules rule out `high_dose`. Steroids with no dose allowed rule out both doses. The gate proposal folded "unable to stop" into the fact, but those rules don't say anything about dose, so they stay gaps, as do other thresholds (2 mg dexamethasone, 15 mg prednisone).
2. **`prior_adc`:** never / topoisomerase I payload / another kind. A single named drug (T-DXd only) or a target (TROP2) stays a gap.
3. **`brain_mets`:** none / treated and stable / untreated or growing, no symptoms / causing symptoms. The old `active` answer split into the two unstable answers. Rules about "active", "untreated" or "unstable" brain metastases rule out both. "Symptomatic" rules rule out `symptoms` only.
4. **`autoimmune_active`** now means immune-suppressing treatment in the last 2 years, with thyroid hormone, insulin and skin creams named as not counting. NCT07436728 #46 now maps, as the relabel had it.

`ANNOTATION.md` gained a section on the four facts. 37 passages were relabelled in one commit, and every label file now names the new vocabulary's checksum.

| | Before | After |
| --- | ---: | ---: |
| Mapped share of rules about the person, all 40 | 40.7% | **43.3%** (298 of 688) |
| The same, held-out 30 | 41.3% | **43.8%** (197 of 450) |
| Vocabulary gaps | 70 | 52 |
| Trials using `brain_mets`, `steroids`, `autoimmune_active` and `prior_adc` | 20, 2, 6, 0 | 24, 8, 7, 5 |

The largest gaps left are other-cancer windows (6 trials), pneumonitis that needed steroids (5), prior targeted therapy by target (5), and autoimmune, prior PD-1, steroid and transplant variants (4 each).
