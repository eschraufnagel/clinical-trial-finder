# Questions: what to ask next, and when to stop

The search ([search.md](search.md)) narrows 5,740 trials to the ones near a person, for their cancer. The facts ([facts.md](facts.md)) say, for each answer a person could give, which of those trials may not fit them. This part decides which question to ask next, when to stop, and how to order what's left. It also reads a person's reply, in their own words, onto a question's answers.

Built in slice 0003. The record is in [`work/0003-question-selection/`](../work/0003-question-selection/), with its three gate write-ups:
- [gate-1-patients.md](../work/0003-question-selection/gate-1-patients.md)
- [gate-2-finding.md](../work/0003-question-selection/gate-2-finding.md)
- [gate-3-reader.md](../work/0003-question-selection/gate-3-reader.md)

## The finding, in plain words

**A short conversation gets most of the way to what a full medical record would give.** Eight fixed questions, then eight chosen ones, find 89% of the short list the person's full record would produce, on 17 made-up patients scored once. The eight fixed questions alone find 79%. If the person knew everything in their record, the same questions would find 95%. The gap that's left is what people don't know, mostly their biomarker results.

**Choosing questions by their effect on the short list works, a little.** At the end of the eight follow-ups it beats asking the trials' most common topics first (85%) and a fixed order (83%). It's never worse for any patient. It isn't faster at the start: the most-common-topics order leads from the second follow-up to the fifth.

**An AI model reads people's replies well, on replies written to be clear.** It read all 326 replies that stated an answer correctly ("Keytruda, and it grew anyway"). It turned 1 of 201 "I don't know"s into an answer. Those replies were written to be clear, so real ones will do worse. The page will show each reading back for the person to confirm.

**The order has a bias.** Trials with the fewest "may not fit" hints come first. That favors trials whose rules the model read least: on the short lists they carry about half as many readings as the average trial. This is the next slice's first question.

No answer ever removes a trial. Every trial the search keeps stays in the order; a hint only moves it down.

## The order

`src/shortlist/order.ts`, pinned by a test. Trials are sorted by:
1. fewest whole-trial hints;
2. then fewest hints about one part of the trial;
3. then the nearest recruiting site;
4. then the trial id.

The top ten are the short list. Phase, sponsor and anything that could read as "best for you" are never keys.

## The conversation

The settings are in [`data/questions/conversation.json`](../data/questions/conversation.json), as Gate 2 froze them:

- **Intake, always asked first:** cell type, how far it has spread, brain metastases, activity level, platinum chemotherapy, immunotherapy, targeted pills, and the number of treatments since it became advanced.
- **Then up to 8 follow-ups**, each chosen by the `shortlist` scorer:
  - for every question not yet asked, and every answer it could get, the scorer counts how many trials would enter the short list;
  - it averages over the answers and asks the highest.
  - Every answer counts as equally likely, which overrates rare answers such as pregnancy. Base rates would fix that, but they're a clinical judgment.
- **Stopping:** at the budget, when nothing is left to ask, or when no answer to any question could change the short list.
- **"I don't know"** marks a question asked, and moves nothing.
- **Pregnancy is never asked of men.** It's left off their oncologist sheet too.

The questions still unanswered that short-list trials ask about become the start of the oncologist sheet.

No model chooses, stops or orders. All of it is deterministic, and `tests/boundary.test.ts` keeps the chooser, the conversation and the order away from every model module.

## The patients

20 made-up people with lung cancer (`evals/cases/patients/`), written by one convention before anything ran on them ([AUTHORING.md](../evals/cases/patients/AUTHORING.md)). Each has:
- a search;
- an answer for each of the 31 facts, or "not in the record";
- which of those they know themselves;
- how they'd say each one.

**How much they know** was set before writing:
- their own history, about 90% (91% as written);
- their oncologist's facts, about 30% (30%);
- their biomarker results, about 35% (35%).

**The sets** were split by a hash of each id, so the author didn't choose: 3 dev, 17 held out. A separate agent read all 434 hand-written replies blind and agreed with every one.

## How it was measured

Each patient is run several ways (`npm run questions:eval`):

| Arm | Answers |
| --- | --- |
| **record** | everything their record holds. What the mapper says with everything known |
| **intake** | the 8 intake questions only, as far as they know |
| **conversation** | intake, then the chosen follow-ups, as far as they know |
| **knows all** | the same, as if they knew everything their record holds |

- **Agreement** is the share of the record arm's short list that the arm's short list also holds.
- **Would-flag** is the share of the arm's short list that the full record would give a hint.

All of it is deterministic: no model, no randomness. `npm run questions:eval -- --check` reruns the latest result and fails on any difference. The trials' readings are 0002's mapping run (Qwen3.6-35B-A3B, 8-bit, temperature 0, seed 20260921, prompt `5fea50034aea`), on snapshot 2026-10.

| Arm | Scorer | Dev (3), agreement | Held-out (17), agreement | Held-out, would-flag |
| --- | --- | ---: | ---: | ---: |
| intake only | — | 50% | 79% | 20% |
| conversation | fixed order | 50% | 83% | 17% |
| conversation | most-mapped first (`count`) | 77% | 85% | 15% |
| conversation | **`shortlist`** | 90% | **89%** | 12% |
| knows all | `shortlist` | 100% | 95% | 10% |

Budget 8; [held-out result](../evals/results/questions/01-867d9528f7e8.json), which also reruns dev under the frozen settings. Gate 2 chose the scorer and budget from [dev](../evals/results/questions/dev/01-e935d9c2c86e.json) at a budget of 10. Dev's numbers above come from the held-out run, at 8.

**Agreement after k follow-ups, held-out:**

| k | 0 | 2 | 4 | 6 | 8 | 14 | 20 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fixed | 79% | 79% | 82% | 82% | 83% | 85% | 91% |
| count | 79% | 82% | 84% | 85% | 85% | 89% | 92% |
| shortlist | 79% | 79% | 81% | 85% | 89% | 92% | 92% |

**About a third of the chosen questions came back "I don't know"** (44 of 128 on held-out). `shortlist` reaches for biomarkers and leptomeningeal disease, which would move the list most if answered and are the facts people know least. It has no way to tell which questions a person can answer.

## The reader

`src/questions/read.ts`. The model sees one question, its fixed answers and one reply, and returns an answer or "unknown". An answer it can't use (an id the question doesn't have, a cut-off reply, the wrong shape) is read as unknown, never as an answer. `npm run questions:read` reads every patient's reply to every question, 31 each, and `questions:eval -- --reads` runs the conversations from those readings.

Local model `Qwen3.6-35B-A3B-MLX-8bit`, 8-bit, temperature 0, seed 20260921, prompt `8cb01749`.

| | Held-out | 95% interval |
| --- | ---: | --- |
| Replies stating an answer, read exactly | 326 of 326, 100% | 98.8% to 100% |
| "Don't know" replies read as an answer | 1 of 201, 0.5% | 0.1% to 2.8% |

[The held-out reads](../evals/results/questions/reads/heldout-qwen3.6-35b-a3b-mlx-8bit-8cb01749.json); the conversations answered from them are [with-reads/02](../evals/results/questions/with-reads/02-867d9528f7e8.json).

What the run showed:
- **The one invention:** "Non-small cell, that's all I remember" was read as "another non-small cell type". It changed that patient's short list.
- **Two prompt revisions on dev:**
  - every early loss was the activity-level question, answered with a number because its answer ids (`ps1`) look like scores;
  - a sentence of instruction made it worse;
  - quoting the ids fixed it.

## Trying it

```
npm run questions:try -- --patient evals/cases/patients/dev/p08.json
```

It prints each question with the answer or "doesn't know", which trials moved, why it stopped, the short list with each hint in the trial's own words, and the questions left for the oncologist. Two full examples are in [gate-2-transcripts.txt](../work/0003-question-selection/gate-2-transcripts.txt).

## Limits

- **One author.** Claude wrote the patients, their replies, the chooser and the reader's prompt. The patients came first and were split by hash, and held-out was scored once, but no clinician checked any of it.
- **Agreement is with the mapper, not with the truth.** The record arm is what the mapper says when everything is known, and about a quarter of its hints are wrong ([facts.md](facts.md)). Nothing here says which trials actually suit a person; that needs the benchmark in slice 0006.
- **The order favors trials the mapper read little,** including trials no model mapped at all: 30 short-list places across the 17 held-out patients. It also keeps trials whose relevant rules the mapper missed, such as first-line trials for someone already treated.
- **The replies are clean by construction,** so the reader's numbers are best cases. Contradictions, several facts in one reply, and answers to a different question aren't tested.
- **Small samples:** 3 dev patients chose the scorer, and 17 held-out patients tested it.
- **One cancer type, one snapshot, one mapping run.**
