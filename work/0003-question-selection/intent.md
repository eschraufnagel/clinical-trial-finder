# intent: 0003 question selection

**Author:** the repository owner
**Status:** Draft
**Date:** 2026-10
**Scope:** One slice. A deterministic choice of the next question and of when to stop, an order for the trials the answers leave, made-up patients who know only part of their own history, and a measurement of how many questions it takes and how close the result gets to what a full record would give. Then a model that reads a person's reply in their own words onto a fact's answers, measured on its own. No page.

---

## In plain words

The search keeps 188 trials within 50 miles of downtown Chicago for one made-up person. Slice 0002 read every trial's rules ahead of time, so an answer to one question, such as "has the cancer spread to the brain?", can flag every trial whose rules that answer may not fit. Flag, not drop: the model's reading is wrong about a quarter of the time, so a flagged trial stays on the list, with the rule in the trial's words, for the person's oncologist to read.

This slice decides **which question to ask next, and when to stop asking.** A person can answer only a few questions, and some they won't know. The best next question is the one whose answer would change the short list at the top the most. Counting trials isn't enough: "are you pregnant or breastfeeding?" touches 73 of the 188 trials, and for a 64-year-old woman it almost never changes anything.

Then it measures the result on made-up patients. Each has a full record and a note of what they actually know. The same patient is run three ways: everything in their record known, a short fixed form, and the conversation. The finding is how many questions the conversation takes and how close its short list comes to the full record's.

Last, it adds the part a model does: reading "I was on Keytruda and the scans showed it growing" as the answer "had immunotherapy, and the cancer grew", and recognizing "I don't know" when the person says it in other words.

## Problem

0002 left three things undecided that the conversation needs:

- **Nothing orders the trials.** A trial with three "may not fit" hints and one with none are equally on the list. A short list needs an order, and the order needs a stated rule that never ranks by benefit (research §5, Ranking) and that a test pins.
- **Nothing chooses a question.** `facts:try` prints, for each unanswered fact, how many trials map it. That is a preview, not a choice. It ranks pregnancy fourth for a 64-year-old, and it doesn't know whether an answer would change which trials are at the top, which is the only change the person sees.
- **Nothing says when to stop.** The product intent leaves the question budget open (open question 6): a number to set, then measure against.

And the measurement 0003 exists for doesn't exist yet. The product's finding is the gap between a full record, a short form and a conversation with a person who knows only part of their history (product intent, "What it measures"). That needs made-up patients with a full record and a knowledge profile, and a way to compare the three. The inherited vignettes are one-trial screening conversations and don't fit.

Last, the answers. A person says "Keytruda", not "PD-1 inhibitor". 0002's facts have fixed answers. Something has to read a reply in a person's words onto those answers, or onto "I don't know", and that reading can be wrong in two ways that matter differently:

- reading "I don't know" or a hedge as an answer invents a fact, which can put a wrong hint on a trial or take a right one off;
- reading a real answer as "I don't know" loses it, which costs a question to the oncologist.

## Proposed outcome

At the end of this slice:

1. **An order for the trials,** deterministic and pinned by a test. Proposed: fewest whole-trial hints first, then fewest hints about one part of the trial, then nearest site, then trial id. Never by phase, sponsor or anything that reads as "best for you". The top ten are the short list. Every other trial stays listed below it.
2. **A fixed intake.** About eight facts always asked first, because nearly every person can answer them and many trials depend on them: cell type, how far it has spread, brain metastases, activity level, and prior treatments. Kept as data, not code.
3. **A deterministic next-question choice.** Given the answers so far, the trials and their mappings: the unasked fact whose answers would move the most trials into or out of the short list. "I don't know" marks a fact as asked, so it isn't asked again, and never moves a trial. No model chooses.
4. **A stopping rule.** Stop when no answer to any unasked fact could change the short list, or when a question budget is reached. The budget is set from the measurement, not guessed.
5. **Made-up patients.** About 20 people with NSCLC, written by hand before any selection runs: where they live, age and sex, an answer for every fact in their record, which of those they know themselves, and how they'd say each one. Some are on dev, to set the budget and choose between scorers; the rest are held out and scored once.
6. **A measurement,** deterministic, run with no model: for each patient, the short list from the full record, from the intake alone and from the conversation, and from the conversation with a patient who knows everything. It reports the questions asked, how much of the full record's short list the conversation finds, and how many of its trials the full record would have flagged. Two simple choosers are measured beside the proposed one: a fixed order, and "most trials mapped". If the proposed chooser doesn't beat them, that's the finding.
7. **A reader.** A model call that reads one reply onto one fact's answers, or onto "I don't know", through `src/models/` on the local model. Measured on the patients' hand-written replies: how often it picks the right answer, how often it turns "I don't know" into an answer, and how often it loses an answer. Then the conversation is rerun with the reader in the loop, to see what reading costs the short list.
8. **A command to see it.** For example `npm run questions:try -- --patient <file>` prints each question, the answer, and how the short list changed, and ends with the short list and the questions left for the oncologist.

**Absent on purpose:** no page and no Settings (0004), no per-trial screening (0005), no change to the fact vocabulary or the mappings, and no model choosing a question, ordering trials or removing one.

## Affected users and systems

**The owner,** who decides the gates: whether the patients are written well enough to measure against, which chooser and budget to freeze before held-out, and whether the reader is good enough to put in front of the page.

**Slice 0004,** which builds the page on this slice's order, intake, chooser and reader, and shows the unanswered questions as the oncologist sheet. **Slice 0005,** which starts the screening agent from what the conversation settled.

**The local model,** through `src/models/`, for the reader only: a few hundred short calls, minutes. A hosted model only on the owner's go-ahead with `--spend`, and none is planned.

**Read only:** the snapshot and search (0001), the fact vocabulary and the mapping run (0002). **Not touched:** the parser, the screening agent, the transport, any network host.

## Constraints

- **No answer removes a trial.** The order moves flagged trials down; every trial the search keeps stays listed. Moving a trial below the short list on a hint is not removing it, but it is the one place a model's reading changes what a person sees first, so the measurement reports how often it happens.
- **An unknown never moves a trial.** "I don't know", a hedge, and a fact never asked all leave a trial where it was.
- **No model chooses or orders.** Choosing the question, stopping and ordering are pure functions, pinned by tests. The model reads replies, and nothing else.
- **No verdict.** Nothing the slice prints says a person fits, qualifies or should join a trial. A trial with no hints is "no hint from your answers", not "fits".
- **Patients before choosers, replies before the reader's prompt.** The patients and their replies are written and committed before any chooser or reader runs on them. Choices are made on dev, and held-out is scored once.
- **Results record model, quantization, temperature and seed** for the reader, and the chooser, budget, mapping run and snapshot for every run.
- **No PHI.** Every patient is made up, and their replies are written by hand. No real person's history.
- **Model calls only through `src/models/`.** The reader takes its adapter as an argument, as the mapper does. `tests/boundary.test.ts` gains whatever keeps the chooser, the order and the stopping rule free of any model.
- **No change to `data/facts/vocabulary.json`.** The mapping run is named by its hash; changing it would orphan 8 hours of mappings. Anything the conversation needs beyond it, such as the intake list, lives in its own file.
- **Tests stay fast and deterministic.** The chooser, order and measurement are deterministic and tested on small fixtures. The reader's behavior is measured under `evals/`, never asserted in `tests/`.

## Open questions

1. **What does the chooser maximize?** Answers flag rather than settle, so "would change the status of the most trials" needs a definition. Proposed: for each unasked fact, the average over its answers of how many trials would enter or leave the short list, so a fact matters by its effect on what the person sees first. The average treats every answer as equally likely, which overrates rare answers like pregnancy. Base rates would fix that but are a clinical judgment nobody here can make. Leaning: measure the average against the two simple choosers on dev, and let the gate choose.
2. **Fixed intake, or choose from the first question?** A fixed intake is how the research and the product describe it, and it gives the short form something to be. Choosing from the start might take fewer questions. Leaning fixed, with "choose from the start" as one more arm on dev, so the cost of the fixed intake is a number.
3. **Should biomarkers be in the intake?** The research puts "was your tumor tested?" in the fixed core because it's the most common unknown. But for many people it changes nothing near them. Leaning: leave the ten biomarker facts to the chooser, and report how often it asks them.
4. **How big is the short list, and the budget?** The product says five to ten trials. Leaning ten. Budget: the curve of agreement against questions asked, up to 20 follow-ups on dev, with a budget chosen at the gate.
5. **How is a patient's knowledge decided?** Written by hand per patient, from stated rates set before writing: most "patient" facts known; "oncologist" facts often not; biomarkers known by about a third, following the recall studies in research §1. The rates are in the convention, so a reader can see what the patients were built to test.
6. **Free text or buttons?** Every fact has a few fixed answers, so a page could show them as buttons with "I don't know", and need no reader. But people say drug names, not drug classes, and prior-therapy logic is the third of the research's hard problems (§8). Leaning: build and measure the reader here, and let 0004 decide what the page offers with the reader's error rate in hand.
7. **Hand-written replies, or a model playing the patient?** The inherited simulated participant is a model playing a screening vignette, with its own fidelity checks. A model playing these patients adds a second error source to the reader's number. Leaning: hand-written replies, one per fact a patient knows, and several ways of saying "I don't know" and of hedging. A model-played patient waits for the slice that needs free conversation.
8. **One fact per reply?** A person asked about treatments may answer three facts at once. Leaning: one question, one fact, one reading. A reply that mentions other facts is read only for the one asked. Reading many facts from one reply is a later change, recorded as a limit.
9. **Trials with no mappings.** The 18 trials the local model failed to map, and trials whose rules map nothing, can never get a hint, so the order always keeps them near the top. That follows "an unknown never excludes", but it means the short list favors trials the mapper couldn't read. Leaning: keep it, and report how many short-list places they take.
