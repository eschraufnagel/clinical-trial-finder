# Gate 2: spend held-out's one look?

**Question:** run held-out once on Claude Haiku 4.5 with the reader's schema enforced, revise first, or stop (plan, Gate 2; spec §5.2, §5.3). **The dev run fails the bar frozen at Gate 1, on one reading.** So "run held-out" now means overturning the bar, here, where it can be argued with.

## On dev

[`dev-claude-haiku-4-5-8cb01749-schema.json`](../../evals/results/questions/reads/dev-claude-haiku-4-5-8cb01749-schema.json).
- **The run:** 93 calls in 79 s, **$0.052** (spend ledger). No retries, no refusals, no bad requests.
- **Recorded as:** temperature 0; no seed (the Claude API has none); reasoning off; prompt `8cb01749`; schema enforced.

| | Haiku, schema, dev | Bar |
| --- | ---: | --- |
| Read at all | **93 of 93** | at least 84: **passes** |
| Replies stating an answer, read exactly | 53 of 54, 98.1% (90.2% to 99.7%) | |
| … read as a different answer | **1 of 54** | none: **fails** |
| "Don't know" replies read as an answer | **0 of 39** (0.0% to 9.0%) | none: **passes** |
| Cut off | 0 | |
| Failed | 0 | |

**The one wrong reading:**
- **Patient p11, the number of treatments since the cancer became advanced:** "One, the radiation with chemo and then the Imfinzi."
- **Read as "two".** The record says "one". The local model read "one".
- The reply states the number first. Haiku appears to have counted the treatments it names instead of reading the number the person gave. That's the inference the prompt's rule 6 forbids ("Never infer an answer from what is usual or likely"), and the schema leaves the model no room to explain itself.

**What the request fixed.** 0004's held-out run, without the schema, for what the cause looked like then:

| | Haiku, 0004, held-out | Haiku, schema, dev |
| --- | ---: | ---: |
| Read at all | 237 of 527, 45% | 93 of 93, 100% |
| Cut off at 64 tokens | 87 | 0 |
| Failed: output wasn't JSON the adapter accepts | 203 | 0 |
| Stated answers read as a different answer, of those read | 0 of 217 | 1 of 54 |

The cut-offs and the failures are gone. They were the request, as the intent supposed.

**Cost per call is higher than estimated.** 47,266 input tokens for 93 calls, about 508 each, against about 204 each in 0004's run. Structured outputs adds about 300 tokens a call. Held-out at that rate is about **$0.30**, under its $0.50 cap.

## What to weigh

- **The bar was frozen to stop exactly this kind of argument after the numbers.** By its rule, dev says don't look at held-out.
- **But the bar has two jobs, and the numbers split them.**
  - It was meant to keep held-out's one look from being spent on a request that still fails. This one reads 93 of 93.
  - It was also meant to catch the schema making readings worse. One wrong in 54 is a signal, not a measure: the interval runs from 0.3% to 9.8%. 0004's Haiku read 0 of 217 wrong, and the local model 0 of 326.
- **Stopping doesn't stop the schema reaching people.** Stage A's code is already what the app sends Haiku. Stopping leaves it unmeasured, with Settings saying so. Only reverting stage A takes it back, and that brings back the 55% that fall to the buttons.
- **On the page, a wrong reading is caught before it counts.** The person confirms every reading. A wrong one costs them a correction, not a wrong answer. A failed reading costs them answering again as a choice.
- **A prompt revision is tuning on one reply.** A rule like "a number the person states is the answer" would be written for p11. It would change `READER_PROMPT_VERSION`, and the local model would have to reread dev and held-out to keep its numbers. 93 dev replies can't show whether it helps elsewhere.

## The choices

1. **Overturn criterion 2 and run held-out once,** with the command below. Held-out measures the wrong-reading rate on 326 stated answers, with an interval, reported beside 0004's and the local model's whatever it shows. The PR and the docs say the bar was overturned at this gate, and why.
2. **Stop,** by the frozen rule. The slice ships stage A and this dev finding. Haiku stays "unmeasured" in Settings, and the docs say it read 93 of 93 on dev, with one stated answer read wrong.
3. **Revise the prompt first** (the contingency in the plan): a new prompt version tuned on dev, the local model reread on both sets, then this gate again.

```
npm run questions:read -- --set heldout --model anthropic:claude-haiku-4-5 --spend --max-calls 600 --max-usd 0.50
```

The dry run, printed at step 4: 527 calls, about $0.26 expected, at most $0.48 under the cap. From dev's tokens, expect about $0.30.

## Recommendation

**Choice 1: overturn criterion 2, and run held-out once.**
- The request the bar was guarding against, one that still fails, isn't what dev shows. Every reply was read.
- The one error is exactly the thing held-out is large enough to measure, and the app sends this request either way. Measuring it is better than leaving it unmeasured on the strength of one reply.
- If held-out shows wrong readings well above the local model's, the PR says so, and keeping or reverting the schema request is your call at PR review.

Choice 2 is the answer the frozen rule gives. Choose it if a bar overturned after the numbers costs more than an unmeasured Haiku.

## Answer

(The owner's, at the gate.)
