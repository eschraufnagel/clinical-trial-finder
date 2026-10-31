# Gate 1: which order does the page use?

**Question:** which of the three candidate orders (spec §2.1) goes into `data/questions/conversation.json` as `"order"`, before held-out is rerun once and the page is built on it. Decided from the 3 dev patients (p08, p11, p17).

**The runs**, one per order, all under the frozen settings (scorer `shortlist`, budget 8, intake of 8, short list of 10), the mapping run `qwen3.6-35b-a3b-mlx-8bit-5fea5003-854382b2`, snapshot 2026-10. No model, so no temperature or seed: each is deterministic, and `npm run questions:eval -- --check --dev` reruns the latest.

| Order | Result |
| --- | --- |
| `hints` (0003's) | [`dev/02-867d9528f7e8.json`](../../evals/results/questions/dev/02-867d9528f7e8.json) |
| `checked` | [`dev/03-2a7b65215742.json`](../../evals/results/questions/dev/03-2a7b65215742.json) |
| `read-first` | [`dev/04-92afa01686ff.json`](../../evals/results/questions/dev/04-92afa01686ff.json) |

A result under another order than the settings file's carries a checksum of the file plus the order, so its name says which settings ran.

**The orders,** each with whole-trial hints first, then part hints:
- **`hints`:** then the nearest site.
- **`checked`:** then the most facts checked, meaning facts the trial's rules ask about that the person answered with no hint. Then the nearest site.
- **`read-first`:** then trials with mappings before trials with none. Then the nearest site.

## The numbers

Means over the 3 dev patients. The conversation arm is the `shortlist` scorer.

| Order | Arm | Read ratio | Unread places | Would-flag | Median miles | Agreement | "Don't know"s |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `hints` | record | 0.57 | 5 | 0% | 100 | 100% | — |
| | conversation | 0.57 | 5 | 10% | 100 | 90% | 14 |
| | knows all | 0.57 | 5 | 0% | 100 | 100% | 3 |
| `checked` | record | 1.23 | 0 | 0% | 230 | 100% | — |
| | conversation | 1.51 | 0 | **17%** | **287** | **50%** | 9 |
| | knows all | 1.52 | 0 | 20% | 289 | 53% | 1 |
| `read-first` | record | 0.66 | **0** | 0% | 100 | 100% | — |
| | conversation | 0.69 | **0** | 10% | 100 | 90% | 13 |
| | knows all | 0.66 | 0 | 3% | 100 | 97% | 3 |

**What the columns mean:**
- **Read ratio:** mappings per short-list trial ÷ mappings per trial the search kept. 1.0 means the short list was read as fully as the average trial; below 1, the short list favors trials read less.
- **Unread places:** short-list places, summed over the 3 patients, held by trials with no mappings at all.
- **Would-flag:** share of the short list that the full record gives a whole-trial hint. It's the record's hints, so it compares across orders.
- **Median miles:** the mean over patients of the short list's median distance.
- **Agreement:** with the record arm *under the same order*, so it doesn't compare across orders. It says how stable the order is as answers come in.

Per patient, conversation arm:

| Patient | Trials | `hints` mappings / miles | `checked` mappings / miles | `read-first` mappings / miles |
| --- | ---: | --- | --- | --- |
| p08 | 99 | 4.4 / 1 | 11.0 / 1 | 6.5 / 1 |
| p11 | 1,058 | 5.0 / 112 | 13.4 / 266 | 5.5 / 112 |
| p17 | 1,061 | 5.6 / 188 | 15.3 / 595 | 6.3 / 188 |

Mappings per candidate: p08 9.3, p11 8.6, p17 8.6.

## The short lists, side by side

The conversation arm's ten, with each trial's mappings and nearest site. Titles cut to fit.

**p08** (Portland, 50 miles):

| `hints` | `checked` | `read-first` |
| --- | --- | --- |
| NCT02693535 · 5 · 1 mi · TAPUR | NCT06130553 · 12 · 1 mi · AZD3470 | NCT02693535 · 5 · 1 mi · TAPUR |
| NCT04317534 · **unread** · 1 mi · adjuvant pembrolizumab | NCT06293898 · 23 · 1 mi · BL-M07D1, HER2 | NCT04389632 · 7 · 1 mi · sigvotatug vedotin |
| NCT04389632 · 7 · 1 mi · sigvotatug vedotin | NCT06357533 · 14 · 9 mi · first-line Dato-DXd | NCT05422911 · 2 · 1 mi · prostate |
| NCT05176483 · **unread** · 1 mi · zanzalintinib | NCT06253871 · 7 · 1 mi · IAM1363, HER2 | NCT05544019 · 4 · 1 mi · B-cell neoplasms |
| NCT05422911 · 2 · 1 mi · prostate | NCT06719362 · 12 · 1 mi | NCT05579366 · 8 · 1 mi · Rina-S |
| NCT05544019 · 4 · 1 mi · B-cell neoplasms | NCT07356453 · 8 · 1 mi · FORX-428 | NCT05768139 · 4 · 1 mi · STX-478 |
| NCT05579366 · 8 · 1 mi · Rina-S | NCT07229313 · 8 · ? mi · KIVU-107 | NCT05919264 · 4 · 1 mi · FOG-001 |
| NCT05768139 · 4 · 1 mi · STX-478 | NCT06218914 · 9 · 1 mi · TCRT, KRAS | NCT06119581 · 10 · 1 mi · first-line olomorasib |
| NCT05919264 · 4 · 1 mi · FOG-001 | NCT06242470 · 8 · 1 mi · MGC026 | NCT06130553 · 12 · 1 mi · AZD3470 |
| NCT06119581 · 10 · 1 mi · first-line olomorasib | NCT06320405 · 9 · 1 mi · axatilimab | NCT06218914 · 9 · 1 mi · TCRT, KRAS |

**p11** (anywhere in the US): `hints` and `read-first` share eight trials. `read-first` drops the abatacept myocarditis trial (0 mappings) and an unread one, for two read trials at 117 and 120 miles. `checked`'s ten run from 172 to 911 miles, carry 10 to 26 mappings each, and include a desmoid-tumor trial (NCT05879146, 911 miles).

**p17** (anywhere): `read-first` is `hints` less the abatacept trial (0 mappings, 108 miles), plus a BNT327 trial at 200 miles. `checked`'s ten run from 320 to 1,127 miles. Its first is a nivolumab combination 1,127 miles away, and it includes a head-and-neck trial.

## What the runs show

- **`checked` overcorrects, and it costs distance.**
  - The read ratio goes from 0.57 to 1.5: the short list now favors the most heavily read trials, which also means trials with the most rules.
  - Because "most facts checked" comes before distance, the most-read trial anywhere in a nationwide search wins. Median miles rise from 100 to 287, and p17's first trial is 1,127 miles away. Distance is the real filter for most people (research §7, equity), and this order buries it.
  - Would-flag gets worse, from 10% to 17%. More rules read means more rules the full record trips.
  - The list doesn't settle: agreement with its own record arm is 50%, and 53% even knowing everything. Every answer adds checks to some trials and not others, so the top keeps changing as the person answers.
- **`read-first` does what it's for, and costs nothing measured here.**
  - Unread places go from 5 to 0, in every arm, on all three patients.
  - Would-flag (10%), median miles (100), agreement (90%) and the curve are the same as `hints`. Knows-all's agreement with its own record falls from 100% to 97%, and its would-flag rises from 0% to 3%: one trial on one patient's list.
  - It doesn't fix the half-read trials. The read ratio rises only from 0.57 to 0.69. Short-list trials still carry fewer mappings than the average, because a trial with fewer mappings still has fewer chances of a hint.
- **The bug the run found, fixed before this table.** As first written, `read-first` counted only trials missing from the mapping run as unread. A trial the run read and mapped no rule from, such as the abatacept myocarditis trial in p11's and p17's lists, still sorted as read. The spec says "trials with mappings before trials with none", so the code was wrong, not the spec. The fix and its test are in step 5's commit, and the result above is the fixed one.

## Something the lists show that no order fixes

p08 has lung cancer, and p08's short list under every order but `checked` holds a castrate-sensitive **prostate** cancer trial (NCT05422911) and a **B-cell lymphoma** trial (NCT05544019). Both carry no hint, because the vocabulary's cell-type question has only lung answers, and neither trial's rules map onto it.
- The prostate trial is kept by the search because its conditions list "Metastatic Cancer".
- The lymphoma trial is kept by the search's "rules" reason.

0001 chose recall over precision deliberately: a trial the search drops can never be found. But on the page, these will sit at the top of a person's list with "nothing in your answers conflicts" beside them. That's a search problem (0001), not an order problem. It isn't in this slice's scope, and it's worth a slice of its own: measuring how many short-list places go to trials for another cancer, and whether a cancer-type check after the search can remove them without losing basket trials.

## Recommendation

1. **`read-first`.** It removes every unread trial from the short lists at no measured cost to distance, would-flag or agreement.
2. **Not `checked`.** It trades the bias for a worse one: far-away, rule-heavy trials, more of them flagged by the record, on a list that won't settle.
3. **Keep the "how much was read" line on every card** (spec §5.2), because `read-first` leaves the half-read bias (0.69). A trial with 2 mappings and no hints should say "its rules were read for 2 of the questions here", so "no conflict" can't pass for "checked".
4. **Record the other-cancer trials as a follow-up** for its own slice, and say so in `docs/page.md`'s limits.

**What it costs to be wrong:**
- Held-out is rerun once with this order (step 6), beside 0003's result. It can't be rerun cleanly again.
- The page, the browser test's expected list and `docs/page.md` are built on it.
- With 3 dev patients, this is a direction. `read-first`'s effect is structural, though: it moves only trials with no mappings, and only among trials with equal hints. (Held-out, below, showed a small cost this sentence didn't expect.)

**The alternative** is `hints` unchanged, with the per-card line alone carrying the explanation. That leaves 30 held-out short-list places for trials no rule was read from.

## Answer

**Owner, 2026-10: `read-first`.** Written into `data/questions/conversation.json` as `"order": "read-first"`. Held-out is then rerun once (below).

## Held-out, rerun once

17 patients, under the frozen settings with `read-first`. The run is [`04-7543ffb2cb2e.json`](../../evals/results/questions/04-7543ffb2cb2e.json), which reruns dev too. The conversation answered from the reader's held-out readings is [`with-reads/03-7543ffb2cb2e.json`](../../evals/results/questions/with-reads/03-7543ffb2cb2e.json). Held-out had been scored before, in 0003, under `hints`. That result, [`03-867d9528f7e8.json`](../../evals/results/questions/03-867d9528f7e8.json), stays as it is, and this is a second look, not a replacement.

| Arm | Scorer | Agreement, `hints` → `read-first` | Would-flag | Unread places | Read ratio |
| --- | --- | --- | --- | --- | --- |
| record | — | 100% → 100% | 5.9% → 5.9% | 33 → 5 | 0.71 → 0.85 |
| intake only | — | 79% → 75% | 20% → 24% | 26 → 2 | → 0.98 |
| conversation | fixed | 83% → 79% | 17% → 21% | 27 → 2 | → 0.95 |
| conversation | count | 85% → 84% | 15% → 17% | 29 → 2 | → 0.94 |
| conversation | **shortlist** | **89% → 88%** | **12% → 13%** | **30 → 2** | **0.78 → 0.92** |
| knows all | shortlist | 95% → 92% | 10% → 11% | 33 → 2 | → 0.89 |

The read ratio under `hints` is computed from 0003's committed short lists and the mapping run, since that result predates the field. The other `hints` ratios aren't computed.

**Agreement after k follow-ups,** conversation, `shortlist`:

| k | 0 | 2 | 4 | 6 | 8 | 10 | 14 | 20 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `hints` | 79% | 79% | 81% | 85% | 89% | 90% | 92% | 92% |
| `read-first` | 75% | 75% | 80% | 85% | 88% | 88% | 90% | 90% |

### What held-out says

- **It does what dev said on unread trials:** 30 short-list places to 2. The 2 left, and the record arm's 5, are p07 (46 candidates) and p12 (106). Their searches hold too few read trials free of hints to fill ten places.
- **The read ratio rises more than on dev,** from 0.78 to 0.92. Held-out's short lists had more unread trials to replace.
- **It costs a little, which dev didn't show.** Agreement falls about 2 points and would-flag rises about 1, in the conversation arm. The recommendation above said `read-first` "can't do on held-out what it didn't do here". That was wrong: three patients' agreement fell 10 points each (p09, p12, p18).
- **Part of the would-flag rise is structural.** A trial with no mappings can never be flagged by the record, so would-flag counts it as safe. Replacing it with a read trial can only keep would-flag level or raise it. p12's and p18's rises are each one read trial, flagged by the full record, in a place an unread trial held under `hints`. Under `hints` that place went to a trial nobody had read; it wasn't safer, only unmeasured.
- **The scorer comparison holds.** `shortlist` still ends highest at 8 follow-ups (88% against `count`'s 84% and `fixed`'s 79%).
