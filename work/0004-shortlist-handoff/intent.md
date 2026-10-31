# intent: 0004 shortlist and handoff

**Author:** the repository owner
**Status:** Draft
**Date:** 2026-10
**Scope:** One slice. The first page: a person enters a search, answers the conversation's questions in their own words, confirms each reading, and gets a short list with what's known and unknown about each trial and a sheet to take to their oncologist. Settings choose the local model or a hosted one with a saved key. Before the page is built on it, the order of the trials is reconsidered and measured. No per-trial screening.

---

## In plain words

Slice 0003 built everything behind a conversation, and showed it only in a terminal. This slice puts it on a page that runs on this machine.

A person opens the page and says where they live, their age and sex, and that it's lung cancer. They're asked eight questions everyone gets, then up to eight more chosen for them. They answer in their own words ("Keytruda, and it grew anyway"). The page shows how it read each answer ("I read that as: yes, and the cancer grew during or after it") and they confirm it, or pick the right answer, or say they don't know. Nothing they didn't confirm is used.

Then they get a short list of about ten trials. For each one: what it tests and its phase, in plain words, the nearest site and how far, what their answers already checked against its rules, what's still unknown and who would know it, and anything in its rules that may not fit them, quoted in the trial's own words. Every other trial the search kept is still there below. Last, a sheet for their oncologist: their answers, the trials, and the questions that would settle the most of them. They print it or save it. The page sends it nowhere.

Nothing on the page says they qualify or should join a trial. Their oncologist and the trial team decide.

Before any of that is built, one thing 0003 found gets fixed or explained: the order puts trials the model read least at the top.

## Problem

**There's no page.** 0003's conversation runs as one function call with every answer supplied up front, from a made-up patient. A person needs it one question at a time, with a pause for each reply. Nothing yet shows a short list to anyone who doesn't read terminal output, and the oncologist sheet is a list of fact ids.

**Free text needs a confirm step** (0003 Gate 3). The reader got every clear reply right on held-out, and turned 1 of 201 "I don't know"s into an answer. Real replies will be vaguer. An invented answer puts a fact in someone's profile they never gave. It moves trials, and it hides a question from the oncologist sheet. The page shows each reading back, and only a confirmed one counts.

**The order favors trials the mapper read little** (0003 Gate 2). Trials with the fewest "may not fit" hints come first, and a trial with fewer readings has fewer chances of a hint. On the short lists, trials carry about half the readings of the average candidate, and 30 short-list places across 17 held-out patients went to trials with no readings at all. A person shown the list would read the top as "nothing against these", when for many it's "nothing read". Product open question 5 asks how to order a list without implying "best for you". This is the part of it 0003 left.

**Nobody can choose a model.** The product intent settles that the page offers Anthropic, OpenAI and xAI in Settings, with a saved key, because most people who open the repository can't run the local model. The reader was measured on the local model only. Whether to measure a hosted one is a cost decision for this slice (product open question 7).

## Proposed outcome

At the end of this slice:

1. **A decision on the order, measured.** Two or three candidate orders, compared on dev on numbers that don't depend on which order is in use: how many readings the short-list trials carry against the average, how many short-list places go to trials with no readings, how much of the short list the full record would flag, and how far away the trials are. The owner chooses at a gate. Held-out is then rerun once with the chosen order and reported beside 0003's result, not in place of it.
2. **The conversation, one step at a time.** The same intake, chooser and stopping rule as 0003, exposed as steps a page can drive: the next question, an answer, a change of answer, the result so far. 0003's committed results rerun unchanged on it before anything else changes.
3. **A local page,** served on this machine only:
   - a short search form: cancer type (lung only, said plainly), ZIP, distance, age, sex;
   - the conversation: each question in plain words, a free-text answer, the reading shown back to confirm or change, the fixed answers and "I don't know" one tap away;
   - "show me the list now" at any point, for someone who's tired;
   - the short list, with the rest of the trials below it;
   - the oncologist sheet, printable.
4. **A confirm step that can't be skipped.** No reading enters the answers until the person confirms it. If the model can't be reached, the question falls back to the fixed answers, so the page works with no model at all.
5. **Words that never give a verdict,** held by a test. Every piece of text the page writes is built in one place and checked against a list of verdict words ("eligible", "qualify", "you should join", "best for you" and so on), over all 20 made-up patients. The trial's own quoted words are kept apart, so a trial's title can say "eligible patients" without failing it.
6. **An oncologist sheet that misses no unknown.** Every fact a short-list trial asks about that the person didn't answer is either on the sheet as a question or shown as a "may not fit" on that trial. A test holds this for every patient.
7. **Settings,** copied from the prescreening repository's: the local model by default, or Anthropic, OpenAI or xAI with a saved key, kept in `local/`, tested with one call, shown only by its last four characters. A dollar cap per conversation. While a hosted model is chosen, the page says beside every text box that answers go to that provider. A reading made on a model nobody measured says so.
8. **A browser test,** with a scripted reader so no model is called: a made-up patient's typed replies go through the page, every reading is confirmed, and the short list that comes out matches what `questions:try` gives for the same answers.

**Absent on purpose:** no per-trial screening (0005), no plain-language summary of what a trial tests (that needs a model per trial and a check), no change to the fact vocabulary or the mappings, no new snapshot, no saved history across server restarts, and no preferences such as "no Phase 1" or "no placebo".

## Affected users and systems

**The owner,** who decides the gates: the order, whether to spend on measuring a hosted reader, and whether the page, read as a person would read it, implies a verdict.

**Someone who opens the repository,** who can now run `npm run app` and try the conversation with made-up answers, on the local model or a hosted one.

**Slice 0005,** which starts the per-trial screening from what this page's conversation settled.

**New:** `src/server/` (the local server), `src/web/` (the page), `e2e/` (the browser test), and new files in `src/shortlist/` for what the short list and the sheet say. **Changed:** `src/questions/conversation.ts` (steps), `src/shortlist/order.ts` and `src/questions/select.ts` if the order changes, `src/transport/` if the page's buttons need it, `tests/boundary.test.ts`. **Read only:** the snapshot, the search, the vocabulary and the mapping run. **Not touched:** the parser, the screening agent, the mapper.

**Dependencies,** a plan-level decision: React, React DOM and Vite for the page, as `CLAUDE.md` expects of the first slice with one, and Playwright for the browser test. The same versions the prescreening repository runs.

**A hosted model** only if a gate says so, for one held-out reading run of a few dollars at most, with `--spend`.

## Constraints

- **No answer removes a trial,** on the page as in 0003. Every trial the search keeps is reachable. A hint moves a trial down; nothing hides it.
- **An unconfirmed reading changes nothing.** It isn't an answer, it doesn't move a trial, and it doesn't take a question off the sheet.
- **No verdict.** No text the page writes says a person is eligible, qualifies, matches, fits, or should join or consider a trial, or that one trial is better for them than another. A trial with no hints is "nothing in your answers conflicts with what was read of its rules", with how much was read.
- **No model chooses, orders or stops.** The order stays a pure function pinned by a test, whatever the gate chooses. The model reads replies, and nothing else.
- **Local only.** The server listens on `127.0.0.1` only (`src/server/start.ts`, as `CLAUDE.md` already names it). The page fetches only from its own origin. A link to a trial's record on ClinicalTrials.gov opens in the person's browser when they click it; the app makes no request.
- **The one call off this machine** is to the model provider a person chose in Settings, with the key they saved there. A hosted key never comes from `.env`. `createAppAdapter` is named in one server file, and `tests/boundary.test.ts` says which.
- **No contact.** The sheet is printed or saved by the person. Nothing is emailed, sent or shared.
- **No PHI, no logged answers.** Use made-up answers, and the page says so. The server's log never holds a reply. Conversations live in the server's memory and go when it stops.
- **Held-out is looked at once more, and said so.** The order is chosen on the 3 dev patients. Held-out is rerun once with the choice, and its numbers are reported beside 0003's, with a note that held-out had already been seen.
- **0003's results stay true.** The step-by-step conversation reproduces every committed 0003 result, row for row, before the order changes. A new order is a new result, and the old ones still pass `--check` under the settings they record.
- **Results record their model.** A hosted reading run records model, temperature and seed, or what the provider doesn't accept, as every run does.
- **Tests stay fast and deterministic.** The page's rules (confirm, fallback, the words, the sheet) are tested under `tests/` against the server in memory, with a scripted reader. The browser test is its own command, never part of `npm test`.

## Open questions

1. **The order.** What replaces or adjusts "fewest hints first"?
   - **(a) Keep it,** and show on each trial how much of its rules were read, so "no hints" can't pass for "checked".
   - **(b) Add "most of your answers checked" after the hints:** among trials with no hints, the ones whose rules ask about more of what the person answered come first. This is the research's "facts fitted" (§5, Ranking), kept behind the hints. Answers can then move a trial up as well as down, so the chooser's shortcut for counting short-list changes has to be replaced by a full recount.
   - **(c) Put unread trials after read ones:** the smallest change. It deals with the 30 unread places but not with the half-read trials.

   Leaning (b), with (a)'s "how much was read" shown on every trial whichever wins. Measured on dev, chosen at a gate, then held-out once.
2. **How does the page's conversation reach the server?** The transport carries text. A confirm step needs buttons. Leaning: messages gain an optional list of choices, and a reply can be a choice instead of text, so the conversation stays behind `MessageTransport` and the transport's rules (one message at a time, nothing while the agent is working) still hold.
3. **Is every reading confirmed, "I don't know" too?** Leaning yes: "I read that as: you don't know" is one tap, and a reading of unknown that's wrong loses a real answer.
4. **Can a person change an answer later?** Someone who finds their biomarker report halfway through should be able to say so. Leaning: yes, from the list of their answers, by choosing from the fixed answers. Changing one reorders the list. It doesn't restart the questions.
5. **What does "why it may fit" say?** The product intent wants each trial's reasons in the person's own words. Leaning: "What your answers checked" lists the facts its rules ask about that the person answered, with no hint, each with their own words. Worded as what was checked, never as a fit. The exact words go to the wording gate.
6. **What goes on the sheet?** Leaning: the person's answers in their own words and the readings they confirmed; the short list with each trial's "may not fit" rules in the trial's words; the open questions, most trials first; and what to bring, from who knows each open fact (a biomarker report, the pathology report, treatment dates).
7. **Measure a hosted reader?** The page will offer three hosted providers, and the reader is measured on the local model only. One held-out reading run on Claude Haiku 4.5, the one hosted model smoke-tested here, is about 530 short calls, well under a dollar. Leaning: run it once, with the owner's go-ahead, so the page can say one hosted reading was measured. The other two stay "unmeasured".
8. **What's the cap per conversation?** A conversation is at most 16 readings, plus any re-reads. Leaning $0.10 by default, adjustable in Settings, as the prescreening repository's caps are.
9. **Plain words for phase.** The research asks for "an honest one-liner on what that phase means". Leaning: a short committed table of phase to sentence, written here and said to be unreviewed by a clinician.
10. **Which cancer types does the page offer?** The search covers any type; the facts and mappings cover lung (NSCLC) only. Leaning: lung only, and the page says the others aren't ready.
11. **Should conversations be kept?** Leaning no: in the server's memory only, so a reload continues one and a restart forgets it. The sheet is what a person keeps.
