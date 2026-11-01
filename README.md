# Clinical Trial Finder

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Node 24 or newer](https://img.shields.io/badge/node-%E2%89%A524-339933.svg)](https://nodejs.org/)

**An AI assistant that helps a person with cancer find clinical trials worth asking their oncologist about.** It asks what they know about their cancer and their treatment so far, searches a saved copy of ClinicalTrials.gov, and gives back a short list. For each trial it says why the trial may fit, what's still unknown and what to ask. It never says a person is eligible. Their oncologist and the trial team decide that.

> **A proof of concept, not for real use, and not finished.** So far it has the research, the search, the reading of trial rules into questions, the choice of which question to ask next, a closer check of the few trials a person picks, and a page that runs on your own computer. It will only ever be tried with made-up patients, and it will never contact anyone.

## The problem

When standard treatment stops working, a trial may be the next option. ClinicalTrials.gov lists them all, but a search for one cancer type returns hundreds of studies, each with pages of eligibility rules written for doctors. Many of those rules turn on facts a patient may not know, such as which genetic changes their tumor has. Most people who could join a trial never hear about one that fits.

## What it does

1. **Ask.** A short conversation in plain language: the cancer, how far it has spread, the treatments so far and how each ended, how active the person is, and how far they can travel. "I don't know" is an expected answer.
2. **Search.** Narrow the saved registry to recruiting trials for that cancer near the person, including trials open to many cancer types.
3. **Ask what matters next.** Choose the question that would rule the most trials in or out, and stop when more questions wouldn't change the list.
4. **Hand over.** A short list, each trial with its reasons, its unknowns and its nearest site, plus a page of questions to take to the oncologist.
5. **Check a few.** The person picks up to three trials. For each, an agent goes through the trial's own rules, asking only what wasn't already answered, and writes a record of what fits, what may not and what to ask.

## Run it

Needs Node 24 or newer.

```
npm install
npm run check
```

The search works from the terminal, on a saved copy of the registry, with no network and no AI model. Non-small cell lung cancer is the only cancer type so far:

```
npm run search -- --cancer nsclc --zip 60611 --miles 50 --age 64 --sex female
```

How it works and how well it does: [docs/search.md](docs/search.md).

An AI model has read every lung cancer candidate's eligibility rules ahead of time. A made-up person's answers then show which trials may not fit them, quoting each trial's own words, and which questions would matter most. No trial is ever dropped because of what the model read:

```
npm run facts:try -- --cancer nsclc --zip 60611 --miles 50 --age 64 --sex female --profile evals/cases/facts/profiles/example.json
```

Why the model only hints: [docs/facts.md](docs/facts.md).

A made-up patient's conversation, one question at a time, ending in a short list and the questions to take to the oncologist:

```
npm run questions:try -- --patient evals/cases/patients/dev/p08.json
```

How the questions are chosen, and how close it gets: [docs/questions.md](docs/questions.md).

### The page

The whole conversation, in a browser, on this computer only. Answer in your own words; the page shows how it read each answer for you to confirm. At the end are the short list and a sheet to print for the oncologist:

```
npm run app -- --fake
```

Then open http://127.0.0.1:5025. From the list, tick up to three trials and check them. `--fake` reads answers from a fixed list, and checks by buttons only, so no AI model is needed. Without it, the page uses the local model, or the hosted model you choose in its Settings with your own key. Use made-up answers. What the page says and why: [docs/page.md](docs/page.md). How the check works and how well it does: [docs/check.md](docs/check.md).

## How it's being built

It's built by one developer working with Claude, in small changes. Each change is written up as an intent, a spec and a plan before any code, then checked automatically and landed as one reviewed change. The record is in [`work/`](work/), starting with the [research](work/0000-product/research.md). The model adapters, the eligibility parser and the per-trial screening agent come from an earlier proof of concept, [Clinical Trial Prescreening Agent](https://github.com/eschraufnagel/trial-prescreening-agent).
