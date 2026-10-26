# Facts: reading trial rules into questions

The search ([search.md](search.md)) narrows 5,740 trials to the ones near a person, for their cancer. That still leaves too many: 188 within 50 miles of downtown Chicago for one made-up person. The second part reads each trial's eligibility rules ahead of time, so a short conversation can tell the person which trials may not fit them and which questions are worth asking.

Built in slice 0002. The record is in [`work/0002-fact-vocabulary/`](../work/0002-fact-vocabulary/), with its two gate write-ups: [gate-1-labels.md](../work/0002-fact-vocabulary/gate-1-labels.md) and [gate-2-finding.md](../work/0002-fact-vocabulary/gate-2-finding.md).

## The finding, in plain words

An AI model can find most of the rules in a trial that matter to a patient: about 73% of them, against hand-checked labels. It can't yet be trusted to apply them. On trials it hadn't been tuned on, about a quarter of the rules it read would have ruled out a person the trial would actually take. That was true for a cheap hosted model and a free local one, and for every prompt tried.

**So no rule the model reads ever removes a trial.** When a person's answer is one a trial's rule may exclude, the tool shows a hint ("this trial may not fit you"), with the rule in the trial's own words, for the person to take to their oncologist. The model's reading also decides which questions are worth asking. The person's answers flag; the oncologist and the trial team decide.

## The questions

31 facts about a person ([`data/facts/vocabulary.json`](../data/facts/vocabulary.json)), each a plain question with a few fixed answers, for example:

- "Has the cancer spread to the brain?": no; treated and stable; untreated or growing but no symptoms; causing symptoms.
- "Which is closest to how you are day to day?": four activity levels (ECOG).
- "Did testing find an EGFR mutation?": common, exon 20, other, or tested and none found.

"I don't know" is always an answer, and a biomarker never tested counts as unknown, never as "none".

They were chosen from the research's intake questions and from a count of how often the 1,129 lung cancer candidates mention each topic (`npm run facts:topics`). Four were changed at Gate 1, after the labels showed where they didn't fit: steroids by dose, prior antibody-drug conjugate by payload, brain metastases split by symptoms, and autoimmune disease reworded.

**How much they can express.** 40 trials were labelled by hand, rule by rule (1,515 passages). Of the rules about the person, rather than labs or procedures, **43%** can be expressed in these facts (298 of 688; 44% of the 30 held-out trials).
- The rest are mostly specific to one trial.
- 52 are "the same fact, but a different window or condition", such as "another cancer within 3 years" against answers of 2 and 5 years. These are the rules a fixed list of answers handles worst, and where the model went wrong most.

## How the model was measured

- **The labels:** 10 dev trials, to tune on, and 30 held-out trials, scored once. Both were drawn at random from the 1,129 and labelled before any prompt ran. A separate agent relabelled 5 blind and agreed on 90% of passages, and on every mapping both made.
- **What counts as wrong:** a mapping that rules out an answer the trial accepts, including a rule for one cohort read as a rule for the whole trial.
- **What counts as found (recall):** a rule the labels map that the model mapped too, safely.

| Run | Model | Set | Mappings | Wrong | Recall |
| --- | --- | --- | ---: | ---: | ---: |
| [01](../evals/results/facts/01-5fea50034aea.json) | Qwen3.6-35B-A3B, 8-bit, local | dev | 107 | 29.9% | 62.4% |
| [02](../evals/results/facts/02-5ecc777c8cf0.json) | the same, prompt revision 1 | dev | 108 | 37.0% | 57.8% |
| [03](../evals/results/facts/03-9fc7daa0b186.json) | the same, prompt revision 2 | dev | 124 | 42.7% | 60.6% |
| [04](../evals/results/facts/04-5fea50034aea.json) | Claude Haiku 4.5 | dev | 79 | 24.1% | 55.6% |
| [05](../evals/results/facts/05-5fea50034aea.json) | Claude Haiku 4.5 | **held-out** | 230 | **26.1%** | **72.7%** |
| [06](../evals/results/facts/06-5fea50034aea.json) | Qwen3.6-35B-A3B, 8-bit, local | **held-out** | 254 | **35.0%** | **71.8%** |

All runs used temperature 0. The local model's seed is 20260921; the Claude API takes no seed. Runs 01, 04, 05 and 06 use the same prompt, `5fea50034aea`. Each result names its run, labels and vocabulary, and `npm run facts:eval -- --check` regrades the latest one.

What the runs showed:
- **More instructions made the local model worse.** The prompt revisions spelled out the errors' rules more concretely, and each raised the error rate.
- **The two models find rules about equally well.** Haiku makes fewer wrong readings.
- **A list of "safe" facts didn't survive.** Nine facts with no errors on dev went 0 of 34 there, where the list was chosen, and 19 of 95 on held-out.
- **The errors are in the conditions.** "Symptomatic brain metastases" read as excluding all untreated ones; "pneumonitis that required steroids" read as any past pneumonitis. Missed scopes ("ECOG 0-1 in part 1a") and permissions read as rules ("patients with treated brain metastases are eligible if…") account for most of the rest.

## What's in the repository

- **Every candidate read by the local model:** 1,111 of the 1,129 lung cancer candidates, mapped with prompt `5fea50034aea` (`data/facts/2026-10/`, named in `latest`, 9,625 mappings, 6.3 MB). It took about 8 hours on one Mac, at no cost. All 9,625 quotes were checked against the trial text.
- **18 trials failed.** In 17 the local server returned the answer in the model's thinking channel instead of its reply. They have no mappings, which means no hints, and they aren't dropped.
- **A partial Haiku run** of 67 trials, stopped on cost by the owner.

All hosted spending for the slice was about $0.48, in [`evals/results/spend.jsonl`](../evals/results/spend.jsonl). One line there is an estimate, marked as such: an interrupted run didn't write its own.

## Trying it

```
npm run facts:show -- NCT02984761
npm run facts:try -- --cancer nsclc --zip 60611 --miles 50 --age 64 --sex female --profile evals/cases/facts/profiles/example.json
```

For a made-up person with stage IV adenocarcinoma, ECOG 1, after platinum and immunotherapy, the Chicago search keeps 188 trials. 59 get a hint for the whole trial, 12 a hint about one cohort, and 110 none. All 188 stay. The questions that would flag the most trials are measurable disease (120 trials), another cancer (78) and pneumonitis (75).

## Limits

- **One author.** Claude wrote the vocabulary, the labels, the convention and the prompt. The labels came first and the held-out set was scored once, but no clinician checked any of it. The 90% blind-relabel agreement is between two models working from the same written convention.
- **Small samples.** 30 held-out trials; the 95% intervals are about ±6 points.
- **One cancer type, one snapshot, one prompt** carried through all of it.
- **The local model's thinking-channel replies** are an adapter issue left for a later slice.
