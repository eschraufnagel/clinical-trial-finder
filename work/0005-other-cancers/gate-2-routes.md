# Gate 2: which routes go to held-out, and move or remove?

**Question:** freeze `data/cancer-types/nsclc-others.json` as it stands, send which routes to the one held-out scoring (step 9), and decide move-or-remove (OQ 3). Plan, Gate 2.

## On dev

[`evals/results/search/other/dev/01-d16e940b9df3.json`](../../evals/results/search/other/dev/01-d16e940b9df3.json); `npm run other:eval -- --check --dev` reruns it. No model; it names the snapshot, label, vocabulary and others-file checksums.

Dev is 0001's labels and `places-dev`: 197 labelled candidates, 26 of them not for NSCLC.

| Route | Not-for-NSCLC trials marked (gains) | Relevant marked (costs) | Relevant "unclear" marked |
| --- | ---: | ---: | ---: |
| `small-cell` | 8 | 0 | 0 |
| `biomarker` | 2 (NCT05544019, NCT06724237) | 0 | 0 |
| `listing` | 3 (NCT06108232, NCT06271252, NCT06943755) | 0 | 0 |
| `rules` | 5 (NCT05394103, NCT06108232, NCT07408258, NCT05422911, NCT07044336) | 0 | 0 |
| **any** | **17 of 26** | **0** | **0** |

**Left unmarked (9):** they list their cancers inside a "solid tumors" line, or exclude NSCLC in words ("excluding NSCLC"). The check deliberately doesn't read either: NCT04452305, NCT04923542, NCT05652686, NCT06253130, NCT04890613, NCT06311214, NCT06330064, NCT06389123, NCT06760819.

**Across all 1,129 NSCLC candidates:** 118 marked (first route: small-cell 46, listing 29, rules 28, biomarker 15).

## Before held-out: what to weigh

- **The lists were tuned on dev while the check was written** (plan Records, step 7). A dev cost of 0 is the least it can show. Held-out decides.
- **`rules` is the route at risk.** 10 of its pool marks are trials whose title says "Advanced Solid Tumors". Two dev gains are like that (NCT05394103, NCT07408258), so blocking open titles for `rules` too would cost those. Leaning: send it as is, and let the bar decide.
- **A label inconsistency to settle now:** transformed small cell lung cancer is relevant "unclear" in 0001's labels (NCT07153055), but not relevant "unclear" in 0005's (NCT07476287, `sample`). No route marks either, because their inclusion sections name NSCLC. The bar is unaffected either way. Leaning: make NCT07476287 relevant "unclear", to match 0001.

## Recommendation

- Freeze the others file as committed.
- Send all four routes to held-out.
- Move down; remove nothing.

## Answer

**Owner, 2026-10: as recommended.**
- The others file is frozen as committed in `56fa740`.
- All four routes go to held-out.
- Marked trials move down, and none is removed.
- NCT07476287 is relabelled relevant "unclear", to match 0001's label for transformed small cell lung cancer. That was the leaning above, made before held-out is scored.

## Held-out, scored once

[`evals/results/search/other/01-d16e940b9df3.json`](../../evals/results/search/other/01-d16e940b9df3.json), with the others file frozen at Gate 2 (`othersSha256` `d16e940b…`). `npm run other:eval -- --check` reruns it. A second held-out run is refused.

250 labelled candidates, 43 of them not for NSCLC.

| Route | `sample`: gains | `sample`: costs, and "unclear" | Bar (spec §7) | `places-heldout`: gains | `places-heldout`: costs |
| --- | ---: | --- | --- | ---: | --- |
| `small-cell` | 6 | 0, 0 | passes | 5 | 0 |
| `biomarker` | 0 | 0, 0 | passes | 2 | 0 |
| `listing` | 5 | 0, 0 | passes | 3 | 0 |
| `rules` | 5 | 0, 0 | passes | 4 | **1: NCT03947385** |
| **any** | **15 of 24** | 0 | | **14 of 19** | 1 |

**Every route passes the bar, so by its rule all four stay adopted.** `routes` in the others file is unchanged.

**What the bar didn't catch.** The bar is on `sample`, by design: `places-heldout` overlaps with what the order will show. On `places-heldout`, `rules` marks one trial labelled relevant:
- **NCT03947385,** IDE196 in solid tumors with GNAQ/11 mutations or PRKC fusions. Its conditions name uveal melanoma, cutaneous melanoma and colorectal cancer beside "Other Solid Tumors". Its inclusion lines name only melanoma.
- **Labels:** I labelled it relevant through the "Other Solid Tumors" group. The second blind labeller labelled it relevant "unclear".
- **Why it's marked:** `rules` can't see the other-solid-tumors cohort, which appears only in a condition, not in an inclusion line.
- **What it means:** the trial is on held-out patients' short lists, so `other-last` would move it down for them.

It goes to Gate 3 with the rerun. One way to close it is for `rules` to leave alone any trial whose conditions say "other solid tumors". That would be a change made after seeing held-out, and would have to be reported as such.

**Left unmarked:** 14 of 43, among them:
- blood cancers whose titles or conditions read generically;
- breast and gynecologic trials listed under "solid tumor";
- NCT07407933, small cell lung cancer, whose title says "Advanced Solid Tumors".
