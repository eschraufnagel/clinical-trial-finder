# intent: 0007 deeper check

**Author:** the repository owner
**Status:** Draft
**Date:** 2026-10
**Scope:** One slice. The person picks two or three trials from their list, and the screening agent this repository inherited works through each one's own remaining rules, starting from what the conversation already settled. Each trial gets a record for the person and their oncologist. Measured on the local model, on the made-up patients, with no hosted spend.

---

## In plain words

After the questions, a person has a list of trials and a sheet for their oncologist. The list says, for each trial, how much of its rules were read, and which of the person's answers may not fit. It can't say more: the questions cover 31 facts, and most of a trial's rules are its own, such as "no other cancer in the last three years" or "no prior docetaxel".

This slice adds the step the product promised in its fourth part. The person ticks two or three trials and asks for a closer look. For each one, the tool reads the trial's rules and works through them one question at a time. **It doesn't ask again anything the person already answered:** a rule the conversation already covered arrives with their answer beside it. It asks only what's left. A rule only their records can settle, like a lab value, goes on the record as something to bring.

At the end, each trial has a record: what their answers covered, what they told it now, what may not fit and why, in the trial's words and theirs, and what needs their records or their oncologist. They can print it or save it. It goes nowhere. **It never says they qualify.** A rule that may not fit is a question for the oncologist, and nothing removes the trial from their list.

## Problem

**The list stops at what 31 facts can say.**
- Of a trial's rules about the person, 43% can be expressed in the vocabulary (`docs/facts.md`, 298 of 688 labelled passages). The rest stay in the trial's text, "for the stage-two screening agent" (`src/facts/types.ts`, `FactMapping`).
- The facts the model did map are hints. About a quarter on held-out would have ruled out a person the trial would take, so none removes a trial (`docs/facts.md`; `CLAUDE.md`, "No rule a model reads removes a trial").

**So clearly wrong trials reach the top.** `docs/page.md`'s Limits name two made-up patients' short lists:
- a first-line trial for someone after one line of treatment;
- a trial for untreated small-cell lung cancer.

"Nothing conflicts" sits on trials whose readings missed the rule that matters. 0005's mark moved most trials for other cancers down, but 14 of 43 held-out ones are still unmarked. Some still hold short-list places: blood cancers, and breast or ovarian trials listed under "solid tumor" (`docs/search.md`; `docs/page.md`, Limits). 0006's intent sent those 14 here: "They're for the deeper check (0007), which reads a shortlisted trial's rules" (`work/0006-hosted-reader/intent.md`, OQ 6).

**The agent that reads one trial's rules exists, but it was built for a different hand-off.**
- **What it does.** `src/screening/` runs a prescreening conversation for one trial. Code chooses each criterion, a model phrases the question and reads the reply. A reading stands only if its quote is in what the person said. A `clinical` criterion is never settled on the person's word, and lab values aren't asked. It never decides eligibility: `ScreeningResult` has no field for a verdict.
- **What it was built for.** It came from the prescreening repository, where a coordinator read the result. Its fixed words say "A study coordinator will review everything you tell me" (`src/screening/templates.ts`).
- **Where it falls short here.** It asks every raisable criterion from the start, so a person who answered eight to sixteen questions would be asked the same things again. Nothing feeds it what the conversation settled.
- **How its criteria are made.** It takes them from hand labels or from the inherited parser (`src/screening/from-parse.ts`). No snapshot trial has been parsed in this repository.

**What the roadmap measures it by** (`work/ROADMAP.md`, 0007): "Questions saved by not repeating any; clearly-ruled-out trials caught; end to end on vignettes." The product intent says the same: "how many questions it saved by not repeating any, and how many shortlisted trials it correctly flags as clearly ruled out" (`work/0000-product/intent.md`, "What it measures").

**Nothing labelled covers it yet.**
- The 42 fact-labelled trials (`evals/cases/facts/`) and the shortlisted trials overlap in 4 places.
- The 15 inherited vignettes (`evals/cases/vignettes/`) are for 5 trials from the prescreening repository, written against its labels.
- The 20 made-up patients (`evals/cases/patients/`) know their 31 facts and nothing about any one trial.
- Counted from the committed held-out result (`evals/results/questions/06-8eea38fafad5.json`), each patient's top three trials on the conversation's short list make 60 patient-trial pairs: 9 on dev, over 8 trials, and 51 on held-out, over 35. 39 trials in all.

**Carried in, and where they go:**
- **The product intent's part 4** sets the two rules: "Nothing is asked twice" and "The person chooses how far to go … two or three by default". It also says "The result is written for the person and their oncologist rather than a coordinator" (`work/0000-product/intent.md`). They're this slice's outcome.
- **Research §5.3** names the reuse point: criteria that don't map "are asked only once the trial reaches the shortlist, by the existing per-trial prescreening agent." Research §9 measured it "end-to-end on vignettes".
- **0003's Gate 3: nothing typed counts until it's confirmed** (`docs/page.md`, "The confirm step"). The agent's readings are typed replies too (OQ 5).
- **0006's Haiku finding** (`gate-2-dev.md`, Answer; `plan.md`, Records, steps 7 to 9). With the reader's schema, Claude Haiku 4.5 read 527 of 527 held-out replies, but read two plain "No"s as "Yes"; the local model read both right. Weighed in OQ 8.
- **`other:eval -- --check` and `-- --check --dev` fail on `main`** with "labelsSha256 differs". 0005's step 11 added labels after the results were written (0006 `plan.md`, Records, step 1). A separate task covers it. This slice touches neither the labels nor the check, so the baseline records the same single difference, as 0006's did.

## Proposed outcome

At the end of this slice:

1. **A picked trial's rules become the agent's criteria.** The inherited parser reads the trial's eligibility text on the model chosen in Settings, and the result is cached on this computer. For the measurement, the 39 picked trials are parsed once on the local model, and the parses are committed (OQ 1).
2. **What the conversation settled reaches the agent.** A parsed criterion is linked to a fact when its text overlaps the text of one of the trial's fact mappings (0002's run), and that link is made in code, with no model. A criterion linked to a fact the person answered isn't asked. It starts closed, with the person's answer and their words; "I don't know" counts as an answer here. The agent asks only what's left (OQ 2, OQ 3).
3. **The agent speaks to the person, not a coordinator.**
   - Its fixed opening and closing say the oncologist and the trial team decide.
   - Its prompts and the way it reads replies don't change, except for what the carry-in needs (OQ 6).
4. **A record per trial,** for the person and their oncologist. Sections:
   - **what their answers already covered;**
   - **what they told the check;**
   - **what may not fit, and why,** in the trial's words beside theirs;
   - **what needs their records or their oncologist;**
   - **which rules are about the trial itself.**

   No verdict words, every unknown listed, nothing removed from the list (OQ 4).
5. **On the page,** the person ticks up to three trials and checks them one after another. Each question takes free text or a tap. A typed reply's reading is shown back and confirmed before it counts, as in the conversation. Each record prints. `--fake` runs the check with no model (OQ 5, OQ 7).
6. **A measurement, end to end, on the made-up patients:**
   - each patient's conversation (0003's arm, as frozen);
   - their top three trials;
   - the check on each, with a simulated participant who answers from the patient's file and nothing else.

   It reports:
   - **questions saved:** criteria the conversation covered, which the agent didn't ask;
   - **repeats left:** questions the agent still asked about a fact the conversation already answered;
   - **clearly-ruled-out trials caught**, against labels written before any run, and **false alarms** on the rest;
   - **never a verdict**, every unknown on the record, nothing removed.

   Dev first, then held-out once, on the local model (OQ 3, OQ 9).
7. **Docs, roadmap and README** say what changed and what was measured.

**Absent on purpose:**
- no hosted run (OQ 8);
- no schema for the agent's calls (OQ 8);
- no change to the search, the mark, the facts, the questions, the chooser or the order (OQ 4);
- the 15 inherited vignettes aren't rerun (OQ 10);
- nothing from 0005's or 0006's leftovers is fixed (OQ 11).

## Affected users and systems

**A person using the page,** who can now take two or three trials further, answering each trial's remaining rules, and leave with a record per trial.

**Their oncologist,** who receives the records beside the sheet. Each record says what the person's own words settled, and what still needs the chart.

**The owner,** who decides at gates whether held-out is worth its one look, and whether the record's words are right to show a person.

**Changed:**
- `src/screening/`: the carry-in, the starting state, the templates, the record's display model;
- `src/server/`: a check service beside `finder.ts`, its routes;
- `src/web/`: picking, the check, the record; every fixed sentence in `copy.ts`;
- `scripts/app.ts`: `--fake` for the check;
- `tests/boundary.test.ts`: the check's boundaries;
- their tests, the browser test;
- `docs/`, `work/ROADMAP.md`, README, and `CLAUDE.md`'s commands and boundaries.

**New:**
- the link between criteria and facts;
- the check's measurement under `evals/`;
- the pair labels under `evals/cases/`;
- committed parses of the picked trials;
- results under `evals/results/`;
- scripts to parse, label and run;
- gate pages under `work/0007-deeper-check/`.

**Not touched:**
- `src/search/`, `src/facts/` (read only), `src/questions/`, `src/shortlist/order.ts`;
- the mapping run, the patients, 0005's labels.

**No new dependency.** No hosted spend: every model run in the measurement is on the local model, which costs machine time only. In the app, a hosted model chosen in Settings runs the check unmeasured, and the page says so.

## Constraints

- **No verdict.**
  - Nothing in the record, the agent's turns or the page says a person is eligible, qualifies, or should join.
  - A rule that may not fit is shown with the trial's words and the person's, as something to ask.
  - Nothing a person answers removes a trial or moves it on the list.
- **An unknown never excludes.** "I don't know", a declined question and a rule left unasked are listed on the record as unknown.
- **Nothing typed counts until it's confirmed.** 0003's Gate 3 holds for the check.
- **No rule a model reads removes a trial.** The parser's types and the link's fact are model readings. They decide what's asked and how a rule is shown, never whether a trial stays.
- **Held-out is read once.** Labels are written before any parse or agent run on their pairs. Anything tuned is tuned on dev.
- **Model results record model, quantization, temperature, seed and prompt versions,** the parser's and the agent's.
- **Local model by default, and no spend without a gate.** Any hosted run would be dry without `--spend` and run only with the owner's go-ahead. None is proposed. Nothing creates or edits `.env`.
- **No PHI, months only, no tool attribution,** as every slice.

## Open questions

1. **Where do a picked trial's criteria come from?**
   - **Options:** parse on demand, when the person picks it; parse all 1,129 NSCLC candidates overnight, like 0002's mapping run; or build criteria from the fact mappings' passages.
   - **Against the mappings:** they hold only the rules that map, and the agent's job is the rest.
   - **Against parsing all candidates:** about eight hours of machine time, and a large committed artifact, for trials nobody picked.
   - **Leaning:** parse on demand in the app, on the model chosen in Settings, cached under `local/`. For the measurement, parse the 39 picked trials once on the local model and commit them, so every later run reads the same criteria. The parser's known weakness, patient rules typed as clinical, is inherited and said so: those rules end as "needs your records", never as settled.
2. **How does the agent know what the conversation settled?**
   - **Options:** link each parsed criterion to a fact in code, by overlapping text with the trial's fact mappings; or give the agent's read call the conversation's questions and answers, and let the model settle criteria from them.
   - **For the link:** no model, testable, and the number of questions saved is exact.
   - **Against it:** it inherits the mapper's misses, 73% recall on held-out (`docs/facts.md`). A rule about an answered fact that the mapper missed is asked again. That's what "repeats left" measures.
   - **Against the read call:** a model call per earlier answer for every trial, before the first question, and the person's words read a second time, unconfirmed.
   - **Leaning:** the link. A linked criterion starts closed with the fact's confirmed answer and the person's words. It never starts as "holds" or "does not hold": whether the answer meets the rule is the mapper's reading, so the record shows it as a hint, as the list does.
3. **What counts as a repeat, and how is it measured without new passage labels?**
   - **The participant reports which facts it used.** It answers from the patient's file and records which of the patient's facts each reply drew on, as the inherited simulator already does (`usedFacts`).
   - **A repeat:** a question whose reply drew on a fact the conversation already asked.
   - **Questions saved:** the criteria the link closed. The agent asks every open raisable criterion at least once and never stops early, so each one closed is one question not asked. That's counted from the parse and the link, with no run.
   - **Leaning:** both, as above, with the participant's fact use checked for fidelity on dev at Gate 1. Labelling every passage of 39 trials, as 0002 did for 40, would cost more than the slice and measure the link against the mapper's convention.
4. **What does "clearly ruled out" mean, and what does the check do with it?**
   - **The label, per pair:** a rule in the trial's text that the patient's record plainly fails, by `VIGNETTES.md`'s reading test (restates, plainly negates, compares numbers).
   - **What it covers:** another cancer, small-cell disease, untreated-only trials for a treated person, and a drug the record says they've had where the rule forbids it.
   - **Written:** quoted, before any parse or run, for all 60 pairs.
   - **Caught:** the pair's record shows the labelled rule as may-not-fit, from the carry-in or from the check.
   - **A false alarm:** a may-not-fit on a pair labelled not clearly ruled out.
   - **Leaning:** as above. Nothing moves the trial on the list, because the list is the facts' order, and a record is a reason to ask. 0005's unmarked trials for other cancers are counted here if they're picked.
5. **Are the check's readings confirmed?**
   - **Why it's different here:** one reply can settle several criteria, and 0006 showed a model reading "No" as "Yes".
   - **Leaning:** yes, as 0003's Gate 3 decided for the conversation. The page shows what the reply was read as, for each rule it touched, with "That's right" and "Change it".
   - **Every question also offers Yes, No and I don't know.** A tap is recorded with its own words as the quote, needs no confirm, and keeps the check usable when no model can read the reply.
6. **Does the agent's prompt change?** Leaning: no, beyond what the carry-in needs.
   - **Kept:** `PROMPT_VERSION`, and the inherited prompts read unchanged.
   - **Changed:** the fixed opening and closing (`templates.ts`), which aren't part of the prompt, to say the oncologist and the trial team decide.
   - **If the carry-in needs a prompt change,** such as listing the closed criteria as already answered so the read call doesn't reread them, it's a new prompt version, tuned on dev, and said so at Gate 1.
7. **The page now, or the command first?**
   - The roadmap's row has the person picking, so the page belongs here, as in the product intent's part 4.
   - **Leaning:** both, in one slice. The page check reuses 0004's transport, confirm step and printing.
   - **`--fake`:** questions are the criterion's own words in a fixed sentence, and answers are taps only. No model is called, and the browser test runs on it.
   - If the plan shows the page doubling the slice, the gate can split it into its own slice.
8. **Does 0006's Haiku finding change anything here?**
   - **The finding:** with the schema, Haiku read two plain "No"s as "Yes".
   - **Answers carried into the check:** confirmed answers, so a misreading the person corrected never reaches the agent.
   - **The agent's own calls on Haiku:** none passes a schema. They ask for JSON the way 0004's reader did, which failed on Haiku more than half the time.
   - **Leaning:** no hosted run and no schema for the agent's calls in 0007. On a hosted model the check is unmeasured, and says so, as Settings does. A reading it can't use falls back to the taps, as in OQ 5.
   - Giving `ask` and `read` a schema, and measuring the agent on a hosted model, is a later slice's, priced at its own gate.
9. **How are the dev and held-out runs bounded, and what's the bar?**
   - **The runs:** dev is 9 pairs and held-out 51, all on the local model.
   - **The time:** the parse is about a minute a trial. Each check is about two calls per question for the agent and one for the participant. Several hours of machine time for held-out.
   - **Leaning:** Gate 1 reads dev and decides whether held-out is worth its one look. The bar, frozen in the plan before dev runs:
     - no verdict words;
     - no unknown missing from a record;
     - no trial removed;
     - the participant faithful to the file on every dev reply checked;
     - questions saved above zero on every dev pair with a linked fact.

     The two rates, ruled-out caught and false alarms, are reported, not barred, because 9 pairs can't measure them.
10. **Rerun the 15 inherited vignettes?**
    - They measure the agent alone, against the prescreening repository's labels, on trials that aren't in this repository's measured set.
    - **Leaning:** no. With nothing carried in, the agent's path is the inherited one, and a test pins that its starting state is unchanged. 0008's benchmark is where the agent is compared.
11. **Does anything 0005 or 0006 left belong here?** Leaning: no, except as measured.
    - **0005's 14 unmarked trials for other cancers** are counted by OQ 4 when they're picked. The check doesn't mark them on the list.
    - **0005's check-revision items** (`inclusionSection`, NCT03947385) each need a new held-out result of their own. They stay with a check-revision slice.
    - **The failing `other:eval --check`** is a separate task, recorded at the baseline.
    - **0006's two misread "No"s** are weighed in OQ 8.
