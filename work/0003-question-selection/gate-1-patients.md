# Gate 1: are these patients good enough to measure against?

**Question:** are the 20 patients and their replies what stages B and C should be measured against? Nothing has run on them: no chooser, no reader, no conversation. Every number later in the slice is computed against these files. Changing them after Gate 2 means redoing the dev choice, and after held-out it's a new measurement.

The convention is [`evals/cases/patients/AUTHORING.md`](../../evals/cases/patients/AUTHORING.md), written before any patient. Its coverage table says which patient covers what.

## How they were written

All 20 were written together, then split by a hash of the id (`npm run questions:split`). The author didn't choose the sets.

**One revision before the split.** The first draft missed Rule 4's knowledge rates: people knew 99% of their own facts against a target of about 90%, 25% of their oncologist's (about 30%) and 29% of their records (about 35%). Rule 4 sets the rates for writing, and nothing had read the patients yet, so the patients were changed, not the targets:
- **Facts the person no longer knows (26):** "never been tested" for HIV or hepatitis; "I don't know how they count" for lines of treatment; "I had chemo, but I don't know the name" for platinum; and the like.
- **Facts the person now knows (11):** oncologist and records facts, mostly the engaged patients' full biomarker panels.

## Coverage

Against AUTHORING.md Rule 2, everything listed is met:
- **Histology:** 13 adenocarcinoma, 5 squamous, 1 large cell, 1 mixed with small cell.
- **Extent:** 1 early, 4 locally advanced, 15 metastatic.
- **Lines:** 3 with advanced disease not yet treated, plus the early-stage patient; 6 after two or more lines.
- **Drivers:** 6 known (EGFR common, EGFR exon 20, ALK, ROS1, MET exon 14, BRAF V600E); 3 the person doesn't know (KRAS G12C, KRAS other, RET); 1 HER2 mutation, which isn't in the driver rule.
- **Brain:** 3 treated and stable, 1 untreated without symptoms, 1 with symptoms.
- **ECOG:** 4 at 2, none at 3–4.
- **Other history:** 5 with another cancer, 3 with pneumonitis (one current), 1 autoimmune.
- **People:** ages 45 to 82, 9 women.
- **Places:** 16 ZIPs.

## Knowledge rates

Of the facts the records hold:

| Who usually knows | Known | Target |
| --- | --- | --- |
| patient | 311 of 340, 91% | about 90% |
| oncologist | 24 of 80, 30% | about 30% |
| records | 45 of 129, 35% | about 35% |

## Searches

Each patient's search, run once, on snapshot 2026-10. "Mapped" is how many of those trials have mappings in the run named in `latest`.

| Patient | Set | ZIP, radius | Candidates | Mapped |
| --- | --- | --- | ---: | ---: |
| p01 | held-out | 60611, 50 mi | 188 | 181 |
| p02 | held-out | 60611, 25 mi | 177 | 170 |
| p03 | held-out | 57501, anywhere | 1,061 | 1,044 |
| p04 | held-out | 77030, 100 mi | 386 | 379 |
| p05 | held-out | 02115, 50 mi | 254 | 248 |
| p06 | held-out | 59801, anywhere | 1,058 | 1,041 |
| p07 | held-out | 38655, 150 mi | 46 | 45 |
| p08 | **dev** | 97201, 50 mi | 99 | 97 |
| p09 | held-out | 85004, 25 mi | 107 | 106 |
| p10 | held-out | 14201, 100 mi | 56 | 54 |
| p11 | **dev** | 41501, anywhere | 1,058 | 1,041 |
| p12 | held-out | 30303, 50 mi | 106 | 104 |
| p13 | held-out | 10032, 25 mi | 376 | 368 |
| p14 | held-out | 68102, 150 mi | 80 | 78 |
| p15 | held-out | 55905, anywhere | 1,058 | 1,041 |
| p16 | held-out | 87501, 100 mi | 27 | 27 |
| p17 | **dev** | 04401, anywhere | 1,061 | 1,044 |
| p18 | held-out | 60611, 100 mi | 205 | 198 |
| p19 | held-out | 57501, 100 mi | **2** | 2 |
| p20 | held-out | 77030, 50 mi | 385 | 378 |

- **p19 keeps 2 trials.** An 80-year-old within 100 miles of Pierre has almost nothing near her. She stays: the plan allows a search with fewer than ten. Her short list is the whole list, so no question can change it, and the chooser should stop at once.
- **Five patients search anywhere,** about 1,060 trials each. They're the slowest to score, and the shortest lists to change, relative to their size.

## The blind reading

A separate agent read every hand-written reply: 380 `says` replies and 54 specific don't-know replies, 434 in all.
- It was given only `AUTHORING.md` and, per reply, the fact's question, its answers and the reply.
- The replies were shuffled, with opaque ids and no patient, record or expected answer.
- It chose an answer id or "unknown" for each.

**It agreed with the record on all 434.** It named 19 items it was unsure of, and read each the way the record does:
- PD-L1 and histology hedges ("high maybe? I really am not sure", "Squa-something maybe?"), read as unknown;
- "large cell carcinoma" read as another non-small cell type, which takes a little medical knowledge;
- "Enhertu" read as an antibody-drug conjugate by brand name;
- "up a good part of the day, but I can't work at all" read as ECOG 2.

**What 434 of 434 means.** The replies say what their records say, so the reader's numbers in stage C will measure the reader, not ambiguity in the patients. It also means **the replies are clean by construction.** They were written to one rule ("someone reading the question and answers would pick it"), and a careful reader picked it every time. Real people are vaguer, contradict themselves, and answer a different question. Stage C's reader number will be an upper bound for real replies, and `docs/questions.md` will say so. The reading was by a Claude model; the reader in stage C is the local Qwen model, so the two don't share a model.

## What needs deciding

1. **Accept the patients as they are?** Recommended: yes. Coverage, rates and the blind reading all hold.
2. **Dev has 3 patients, below the plan's 4.** The hash sent p08, p11 and p17 to dev. The plan says the threshold isn't moved to fix this. The choices:
   - **(a) Accept 3.** Gate 2 chooses a scorer and budget from 3 patients' curves, with per-patient curves shown. Noisy, but the comparison between scorers is per patient, and the choice is between three named options.
   - **(b) Write two more, p21 to p28.** p23 and p28 hash to dev; p21, p22 and p24 to p27 to held-out. Writing all eight, by the same convention, gives 5 dev and 23 held-out. That's about an hour of writing and another blind reading, before anything runs.
   - **(c) Write only p23 and p28.** This gives 5 dev and 17 held-out. It's quicker, but choosing which ids to write by where they hash is choosing the sets, which the hash exists to stop.

   Recommended: **(a)**. The curves are per patient, and held-out is scored once whichever is chosen. (b) is the honest way to get more dev patients if the owner wants them; (c) isn't.
3. **Make some replies harder?** The 434 of 434 says the replies are clean. Contradictions and multi-fact answers are out of scope (spec §11, intent OQ 7 and 8). Recommended: no change now; the limit is stated.

## Answer

**Owner, 2026-10: accept the patients as they are, with 3 on dev** (option a). No patient is added or changed. Gate 2 chooses from the 3 dev patients' curves, shown per patient as well as summed.
