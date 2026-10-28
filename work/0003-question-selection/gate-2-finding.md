# Gate 2: which scorer and budget go to held-out?

**Question:** which scorer, budget, intake and short-list size are frozen into `data/questions/conversation.json` before held-out is scored once? Decided from the 3 dev patients (p08, p11, p17), as accepted at Gate 1. Held-out hasn't been run.

The run: [`evals/results/questions/dev/01-e935d9c2c86e.json`](../../evals/results/questions/dev/01-e935d9c2c86e.json). Settings as committed at step 6 (intake of 8, scorer `shortlist`, budget 10, short list 10), the mapping run `qwen3.6-35b-a3b-mlx-8bit-5fea5003-854382b2`, snapshot 2026-10. No model, so no temperature or seed: every number is deterministic, and `npm run questions:eval -- --check --dev` reruns it row for row. Two full transcripts are in [gate-2-transcripts.txt](gate-2-transcripts.txt).

**What the numbers mean:**
- **Agreement:** the share of the full record's short list that this arm's short list also holds.
- **Would-flag:** the share of this arm's short list that the full record would give a whole-trial hint.

Both measure how close the conversation comes to what the mapper says with the record known. Neither is a measure of which trials truly fit, and the last section says why that matters.

## The arms, at the budget of 10

Means over the 3 dev patients.

| Arm | Scorer | Agreement | Would-flag | Follow-ups | "Don't know" | Stops |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| record | — | 100% | 0% | 0 | 0 | — |
| intake only | — | 50% | 50% | 0 | 0 | — |
| conversation | fixed | 50% | 50% | 10 | 28 | budget 3 |
| conversation | count | 90% | 10% | 10 | 8 | budget 3 |
| conversation | **shortlist** | **90%** | **10%** | 9.3 | 15 | stable 1, budget 2 |
| knows all | fixed | 60% | 40% | 10 | 8 | budget 3 |
| knows all | count | 90% | 10% | 10 | 0 | budget 3 |
| knows all | **shortlist** | **100%** | **0%** | 10 | 3 | budget 3 |
| from the start | fixed | 47% | 53% | 18 | 34 | budget 3 |
| from the start | count | 87% | 13% | 18 | 8 | budget 3 |
| from the start | shortlist | 90% | 10% | 18 | 15 | budget 3 |

## The curves

Agreement after k follow-ups, with the budget lifted to 20. Means first, then each patient.

| k | 0 | 2 | 4 | 6 | 8 | 10 | 20 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| conversation, fixed | 50% | 50% | 50% | 50% | 50% | 50% | 90% |
| conversation, count | 50% | 50% | 50% | 77% | 77% | 90% | 90% |
| conversation, shortlist | 50% | 67% | **87%** | 87% | **90%** | 90% | 90% |
| knows all, count | 50% | 50% | 50% | 77% | 77% | 90% | 100% |
| knows all, shortlist | 50% | 67% | 87% | 93% | **100%** | 100% | 100% |

Follow-ups each patient's conversation took to reach its final agreement:

| Patient | Trials | fixed | count | shortlist | Final, conversation | Final, knows all |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| p08 | 99 | 20 | 8 | **4** | 90% | 100% |
| p11 | 1,058 | 20 | 6 | **3** (90%), 8 (100%) | 100% | 100% |
| p17 | 1,061 | 20 | 6 | **1** | 80% | 100% |

## What the dev runs show

- **`shortlist` gets there first, on every dev patient.** It reaches the plateau in 1 to 4 questions where `count` takes 6 to 8. Both end at the same plateau. `fixed` doesn't move the list until after question 15. The difference is in the order of questions, not where they end.
- **The gap left is the patient's knowledge, not the chooser.** Knowing everything, `shortlist` reaches the record's list exactly (100%) by question 8. With what the patients actually know, it stops at 90%. The rest is p08's leptomeningeal status and p17's biomarkers, which they don't know.
- **The intake alone gets half.** Asking the 8 intake questions and nothing else, a short form, agrees 50% with the record and leaves half its list flagged.
- **The fixed intake costs nothing.** Choosing from the first question takes 18 questions to reach the 90% that the intake plus 8 follow-ups reaches. The intake is the 8 facts the chooser would ask early anyway.
- **"Don't know" is common, and the chooser asks a lot of it.** `shortlist` asked 15 questions over 3 patients that came back unknown, `count` 8. `shortlist` reaches for biomarkers and leptomeningeal disease, which move the list most if answered and are the facts people least often know. It has no way to tell which questions a person can answer.
- **Pregnancy is asked of a 63-year-old woman** (p17, follow-up 6), as the intent expected: the uniform average gives "yes" equal weight. It cost one question.
- **Pushed down:** across the arms, 3 to 9 of the 10 trials a distance-only list would show end below the short list, because of hints. Each push rests on a model's reading that is wrong about a quarter of the time (0002).

## The finding that matters more than the scorer

**The order rewards trials whose rules the mapper read little.** It puts trials with the fewest hints first, and a trial with fewer mappings has fewer chances of a hint. On dev, the record arm's short-list trials carry about half the mappings of the average candidate:

| Patient | Mappings per candidate | Mappings per short-list trial |
| --- | ---: | ---: |
| p08 | 9.3 | 4.6 |
| p11 | 8.6 | 5.0 |
| p17 | 8.6 | 5.4 |

What that looks like (p17, in the transcripts):
- an abatacept trial for immunotherapy myocarditis;
- KRAS G12C trials, for a person whose tumour has RET, which she doesn't know;
- first-line trials, for a person after one line.

None carries a hint, because the mapper recorded nothing that her answers rule out. On top of that, 1 or 2 short-list places per dev patient hold a trial with no mappings at all.

This follows from the spec's order (§2), which excludes "the number of facts mapped" as a key so as not to reward a trial for having fewer rules. But "fewest hints first" rewards exactly that, indirectly. It doesn't change which scorer is better: all three are measured against the same order. It does change what agreement is worth. A conversation that reproduces the record's short list reproduces a list biased towards under-read trials.

## Recommendation

1. **Scorer `shortlist`.** It reaches the same plateau as `count` in half the questions or fewer, on all three dev patients. With 3 patients this is a direction, not a measurement; held-out will say whether it holds.
2. **Budget 8.** Agreement stops rising by question 8, in the means and for every dev patient, and knows-all reaches 100% by then. Ten would ask two more questions that change nothing on dev.
3. **Keep the fixed intake**, as is, and **keep `shortlistSize` 10.**
4. **Keep the order for held-out, and make it 0004's first question.** Changing the order now would rest on 3 patients' transcripts, and nothing in this slice measures which order is better: it would need labels of which trials suit a person, which is 0006's ground truth. Held-out then measures the scorers on the order the spec pinned, and the bias is reported beside the result, with the numbers above.

   The alternative is to add a key now, before held-out, such as "most facts fitted first" (the research's original order, §5). That would change the record arm too, so every number above would move.

**What it costs to be wrong:**
- **Scorer and budget:** held-out is scored once with them, and 0004 builds on them.
- **The order:** if it goes to held-out unchanged and 0004 then changes it, held-out's agreement numbers describe an order the page doesn't use. They'd still compare the scorers fairly.

## Answer

**Owner, 2026-10: as recommended.**
- **Frozen in `data/questions/conversation.json`:** scorer `shortlist`, budget 8, the fixed intake of 8, a short list of 10.
- **The order is kept as the spec pinned it** for held-out, and goes to 0004 as its first question.

Held-out is then scored once (below).

## Held-out, scored once

17 patients, with the frozen settings: scorer `shortlist`, budget 8, intake of 8, short list of 10. The run is [`evals/results/questions/01-867d9528f7e8.json`](../../evals/results/questions/01-867d9528f7e8.json), which holds dev too, rerun under the same settings. It is deterministic, and `npm run questions:eval -- --check` reruns it row for row.

| Arm | Scorer | Agreement | Would-flag | Follow-ups | "Don't know" |
| --- | --- | ---: | ---: | ---: | ---: |
| record | — | 100% | 6% | 0 | 0 |
| intake only | — | 79% | 20% | 0 | 0 |
| conversation | fixed | 83% | 17% | 8 | 97 |
| conversation | count | 85% | 15% | 8 | 49 |
| conversation | **shortlist** | **89%** | **12%** | 7.5 | 44 |
| knows all | count | 90% | 14% | 8 | 4 |
| knows all | **shortlist** | **95%** | **10%** | 7.5 | 4 |

The record arm's 6% is p19. Her search keeps 2 trials and the record flags both, so her whole list is flagged.

**Agreement after k follow-ups**, conversation arms:

| k | 0 | 2 | 4 | 6 | 8 | 10 | 14 | 20 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fixed | 79% | 79% | 82% | 82% | 83% | 85% | 85% | 91% |
| count | 79% | **82%** | **84%** | 85% | 85% | 85% | 89% | 92% |
| shortlist | 79% | 79% | 81% | 85% | **89%** | **90%** | **92%** | 92% |

**Per patient, at 8 follow-ups:** `shortlist` is never worse than either other scorer. It's better than `count` for 4 patients and level for 13, and better than `fixed` for 7 and level for 10.

### What held-out says

- **`shortlist` ends higher, but it isn't faster early.** Dev's "1 to 4 questions where `count` takes 6 to 8" didn't hold:
  - on held-out, `count` leads at 2 to 5 follow-ups;
  - the two are level at 6;
  - `shortlist` leads from 7 on;
  - at the frozen budget of 8, `shortlist` has 89% against 85%.

  The honest summary is that `shortlist` is better by the budget, and no better before it.
- **The intake does more on held-out than on dev:** 79% against dev's 50%. Many held-out patients' short lists are settled by the intake alone (p01, p18, p19 at 100%). The follow-ups add 10 points on held-out and 40 on dev.
- **Knowing everything is worth about 6 points** (95% against 89%), and the chooser comes close to the record when the patient knows. For 7 patients knows-all still doesn't reach 100% by question 8, so budget 8 is short for a patient who could answer everything.
- **About a third of `shortlist`'s questions come back "don't know"** (44 of 128). `fixed` wastes more (97); `count` about the same (49).
- **The order's bias is unchanged by this:** short-list trials carry fewer mappings than the average candidate, and 0 to 5 short-list places per patient hold a trial with no mappings at all (30 over the 17). This is 0004's first question.
