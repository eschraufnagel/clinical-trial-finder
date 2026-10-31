# Gate 3: do the page's words imply a verdict? Keep `other-last`?

**What's decided:**
- the mark's lead sentences, the "From the record:" line, and the order's new note;
- whether `"order": "other-last"` stays in `data/questions/conversation.json`, given the rerun below.

## What the page now says

**How it was made.** Every sentence below is built by `describeOrder` (`src/shortlist/explain.ts`), the function the page and the sheet call. It ran over a made-up search: lung cancer, ZIP 97201 (Portland), 100 miles, 64, male, no answers yet. The search keeps 104 trials and marks 17. None is on the short list: all 17 are below it, in "every other trial". The browser test (case 8) checks a marked card under `npm run app -- --fake`.

**The order's note,** at the top of the list:

> Trials whose records name only other cancers come last. Before them, trials with the fewest conflicts with your answers come first. Among those, trials whose rules could be read come before trials whose rules couldn't, then the nearest. The order isn't a ranking of which trial would work for you. Nothing here says whether you could take part in any trial; your oncologist and each trial's team decide that.

**One marked card per route,** each shown first on its card, before the phase. The record's words are marked as the trial's own, as titles are.

`rules`, NCT05422911, *Abiraterone, Enzalutamide, or Apalutamide in Castrate-sensitive Prostate Cancer.*
> This trial's record names other cancers: prostate cancer. Non-small cell lung cancer isn't among them. Ask your oncologist whether it takes people with your kind of lung cancer.
> From the record: *Histologically or cytologically confirmed adenocarcinoma of the prostate without morphologic evidence of small-cell features …*

`biomarker`, NCT05544019, *Study of SGR-1505 in Mature B-Cell Neoplasms*
> This trial's record names a gene change found in lung cancer, but only in other cancers: lymphoma, leukemia. Ask your oncologist whether it takes people with your kind of lung cancer.
> From the record: *Mature B-Cell Neoplasm; Non Hodgkin Lymphoma; DLBCL; … ALK-Positive Large B-Cell Lymphoma; …* (26 conditions)

`small-cell`, NCT05703971, *Quaratusugene Ozeplasmid (Reqorsa) and Atezolizumab Maintenance Therapy in ES-SCLC Patients*
> This trial's record is about small cell lung cancer, a different kind of lung cancer from non-small cell. Ask your oncologist whether it takes people with your kind of lung cancer.
> From the record: *Small Cell Lung Cancer Extensive Stage*

`listing`, NCT06943755, *Zanzalintinib Versus Everolimus in Participants With Locally Advanced or Metastatic Neuroendocrine Tumors*
> This trial's record names other cancers: pancreatic cancer, neuroendocrine tumor. Non-small cell lung cancer isn't among them. Ask your oncologist whether it takes people with your kind of lung cancer.
> From the record: *Pancreatic Neuroendocrine Tumor (pNET); Extra-Pancreatic Neuroendocrine Tumor (epNET)*

**On the sheet,** a marked trial that reaches the short list keeps its lead sentence under its title. No held-out patient's short list has one now.

**Changed while writing this page:** the lead first said "Lung cancer isn't among them." That's false for 14 marked trials whose records name small cell lung cancer or lung neuroendocrine tumors (NCT04665739's conditions say "Lung Neuroendocrine Tumor"). It now says "Non-small cell lung cancer isn't among them."

**Held by tests:**
- the verdict-word scan covers every route's lead (`tests/shortlist/verdict.test.ts`);
- `questions:eval`'s rows record `verdictHits` 0 over every patient.

**What words can't catch:**
- **The `biomarker` lead names no gene.** The evidence is the conditions, so a person sees "ALK-Positive Large B-Cell Lymphoma" in a long list. One alternative: "… names ALK, a gene change found in some lung cancers, but only in other cancers".
- **The cancers named are the file's groups,** not the record's words: "pancreatic cancer" for a pancreatic neuroendocrine tumor. The record's own words follow on the next line.
- **"Ask your oncologist whether it takes people with your kind of lung cancer"** is the same on every card. It routes the person back without saying no.

## The rerun

`npm run questions:eval`, once, under `other-last`: [`06-8eea38fafad5.json`](../../evals/results/questions/06-8eea38fafad5.json) (held-out and dev). With the reader's held-out readings: [`with-reads/04-8eea38fafad5.json`](../../evals/results/questions/with-reads/04-8eea38fafad5.json). 0004's [`05-7543ffb2cb2e.json`](../../evals/results/questions/05-7543ffb2cb2e.json) stays committed, and `--check` still matches it under `read-first`.

**Held-out patients have now been scored three times:** in 0003, in 0004 and here. The order was chosen on labels, not on these patients' agreement.

**Places held by trials not for NSCLC** (`npm run other:eval -- --places`). The 22 trials that first reached a short list here are labelled as `places-other-last` (plan Records, step 11), so no place is unlabelled.

| Held-out (17) | `read-first` (0004) | `other-last` | Patients with any |
| --- | ---: | ---: | --- |
| conversation, `shortlist` | 35 of 162 | **6** | 15 → **5** |
| the same, with reads | 34 | 6 | 14 → 5 |
| record | 38 | 9 | 14 → 6 |
| intake only | 36 | 6 | 15 → 5 |
| dev (3), conversation | 6 of 30 | 0 | 3 → 0 |

**The 6 left** are 5 trials the check doesn't mark, all limited to other cancers:
- NCT06150157 (2 places), myeloproliferative neoplasms;
- NCT05053867, blood cancers;
- NCT05386108, NCT07174336 and NCT06253130, breast, or breast, ovarian and prostate, listed under "solid tumor".

**No marked trial is on any held-out short list.**

**Agreement and would-flag,** held-out:

| Arm | Agreement | Would-flag | Unread places | Read ratio |
| --- | --- | --- | --- | --- |
| record | 100% → 100% | 5.9% → 8.2% | 5 → 6 | 0.85 → 0.89 |
| intake only | 75% → 72% | 24% → 28% | 2 → 2 | 0.98 → 1.03 |
| conversation, `fixed` | 79% → 76% | 21% → 24% | 2 → 2 | 0.95 → 1.00 |
| conversation, `count` | 84% → 81% | 17% → 22% | 2 → 2 | 0.94 → 0.99 |
| conversation, **`shortlist`** | **88% → 85%** | **12.9% → 17.6%** | 2 → 2 | 0.92 → 0.96 |
| knows all, `shortlist` | 92% → 91% | 11% → 14% | 2 → 2 | 0.89 → 0.93 |

**Why would-flag rises.** It's the same blind spot 0004's Gate 1 found:
- **Before:** none of the 35 places held by trials not for NSCLC was flagged by the full record. No NSCLC fact maps onto a prostate trial's rules, so would-flag counted them as safe.
- **After:** 32 places went to trials new to those lists, and the full record flags 9 of them. Those are NSCLC trials whose rules were read.

The prostate trial was never safer than the NSCLC trial that replaced it, only unmeasured. Agreement falls for the same reason. The record's short list and the conversation's now share fewer of the fully read NSCLC trials, where a hint can separate them. Before, they shared marked trials that nothing could separate. That's an account, not a proof. It's consistent with every number above.

**The one cost on held-out.** `rules` marks NCT03947385, a trial labelled relevant (`gate-2-routes.md`, "Held-out, scored once"). It was on one held-out patient's short list under `read-first`, and is below it now.

## Recommendation

- **Keep `other-last`.** One short-list place in five went to a trial a person with NSCLC can't join. Now it's one in 27, for 5 patients instead of 15. One relevant trial moved down, NCT03947385, and its card says why in the record's words.
- **Keep the lead sentences,** with "Non-small cell lung cancer isn't among them" as now.
- **Your call:**
  - whether the `biomarker` lead should name the gene;
  - whether NCT03947385's cost should be closed after the fact, by `rules` leaving trials whose conditions say "other solid tumors". If yes, it's reported as a change made after seeing held-out.

## What it costs to be wrong

- **The words ship on the page,** and the browser test and `docs/page.md` pin them (stage E).
- **A mark that reads as "this isn't for you"** is the verdict the product rules out. Each lead says what the record names and sends the person to their oncologist.
- **A relevant trial moved down is real.** NCT03947385 is one, and the held-out sample suggests about one in 200 relevant trials. It isn't removed, and its card gives the record's words.

## Answer

(The owner's.)
