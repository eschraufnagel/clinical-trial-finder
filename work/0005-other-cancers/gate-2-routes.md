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

(The owner's.)
