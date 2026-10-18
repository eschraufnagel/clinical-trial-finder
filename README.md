# Clinical Trial Finder

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Node 24 or newer](https://img.shields.io/badge/node-%E2%89%A524-339933.svg)](https://nodejs.org/)

**An AI assistant that helps a person with cancer find clinical trials worth asking their oncologist about.** It asks what they know about their cancer and their treatment so far, searches a saved copy of ClinicalTrials.gov, and gives back a short list. For each trial it says why the trial may fit, what's still unknown and what to ask. It never says a person is eligible. Their oncologist and the trial team decide that.

> **A proof of concept, not for real use, and not built yet.** This repository holds the research and the starting code. It will only ever be tried with made-up patients, and it will never contact anyone.

## The problem

When standard treatment stops working, a trial may be the next option. ClinicalTrials.gov lists them all, but a search for one cancer type returns hundreds of studies, each with pages of eligibility rules written for doctors. Many of those rules turn on facts a patient may not know, such as which genetic changes their tumor has. Most people who could join a trial never hear about one that fits.

## What it will do

1. **Ask.** A short conversation in plain language: the cancer, how far it has spread, the treatments so far and how each ended, how active the person is, and how far they can travel. "I don't know" is an expected answer.
2. **Search.** Narrow the saved registry to recruiting trials for that cancer near the person, including trials open to many cancer types.
3. **Ask what matters next.** Choose the question that would rule the most trials in or out, and stop when more questions wouldn't change the list.
4. **Hand over.** A short list, each trial with its reasons, its unknowns and its nearest site, plus a page of questions to take to the oncologist.

## Run it

Needs Node 24 or newer. There's nothing to run yet beyond the tests:

```
npm install
npm run check
```

## How it's being built

It's built by one developer working with Claude, in small changes. Each change is written up as an intent, a spec and a plan before any code, then checked automatically and landed as one reviewed change. The record is in [`work/`](work/), starting with the [research](work/0000-product/research.md). The model adapters, the eligibility parser and the per-trial screening agent come from an earlier proof of concept, [Clinical Trial Prescreening Agent](https://github.com/eschraufnagel/trial-prescreening-agent).
