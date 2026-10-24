# intent: 0002 fact vocabulary

**Author:** the repository owner
**Status:** Draft
**Date:** 2026-10
**Scope:** One slice. A small shared vocabulary of patient facts, each NSCLC candidate trial's eligibility rules mapped onto it offline by a model, and a measurement of how much of the rules it covers and how often a mapping would wrongly rule a trial out. No conversation, no question choice, no page.

---

## In plain words

The search hands back too many trials: 188 within 50 miles of downtown Chicago for one made-up person. To get from 188 to a short list, the assistant has to ask questions, and it can only ask a few. That works only if one answer settles many trials at once. "Has your cancer spread to your brain?" should update every trial that cares about brain metastases, not one trial's checklist.

This slice builds that. It writes down 25 to 40 facts about a person that trials keep asking about, and has a model read each trial's rules and record which facts the trial cares about and which answers would rule it out. Then it checks the model's work. **The error that matters most is a wrong "rules it out"**: a trial dropped because the model misread a rule is a trial the person never hears about.

## Problem

Each candidate trial's eligibility text is a median of about 3,300 characters written for clinicians. The 1,129 trials the search keeps for NSCLC hold 5.1 million characters of it. Nothing downstream can use that text directly:

- **Question choice (0003) needs a shared vocabulary.** It picks the question whose answer changes the most trials. That's only computable if trials state their rules in the same terms. "ECOG 0–1", "performance status ≤ 1" and "Karnofsky ≥ 70" must all become one fact.
- **The inherited parser doesn't produce one.** It turns one trial's rules into that trial's own list of criteria, typed as patient, clinical, definitional or protocol. That suits the per-trial screening agent, stage two (0005). It gives no way to say two trials ask the same thing. And the prescreening repository measured it mis-typing more than half of patient-answerable criteria as clinical (research §8).
- **Nobody knows if a small vocabulary is enough.** The whole product bets that 25–40 facts cover the rules that knock trials off a list (product intent, open question 1). If the share they cover is small, the conversation can't narrow anything and the design has to change. That's the question this slice answers.

The mapping must also be trustworthy in one direction above all. A missed mapping costs a question later: the trial stays, with that rule left for stage two. A wrong mapping that rules out an answer the trial actually accepts drops the trial silently, which is the search's worst error made again one stage later.

## Proposed outcome

At the end of this slice:

1. **A fact vocabulary, as data.** 25–40 facts, each with an id, a plain-language question, a small closed set of answers, and who can usually answer it: the person, their oncologist, or their records. Examples: brain metastases (none, treated and stable, active), ECOG as an activity level, EGFR status (common mutation, exon 20 insertion, other, none found, not tested), prior PD-1 or PD-L1 inhibitor, lines of systemic therapy for advanced disease. "Unknown" is always an answer. Most facts are shared across cancers; the NSCLC biomarkers are in the NSCLC entry.
2. **A mapping per trial.** For each criterion that maps onto a fact: the fact, the answers that would rule the trial out, and a verbatim quote from the trial located in its text, as the inherited parser locates quotes. A criterion that doesn't map is not recorded here; it stays in the trial's text for stage two. A criterion that applies to only one arm or cohort never rules the whole trial out.
3. **An offline run over the candidates.** The NSCLC candidate trials, mapped by a model and committed under the 0001 snapshot's month, with the model's name, quantization, temperature, seed and prompt version on every file. The local model by default. It's a long run, measured by a dry run before it starts.
4. **A deterministic status function.** Given a person's answers, unknowns included, each trial gets a status per fact: fits, rules it out, or unknown. **An unknown never rules a trial out.** Pure, no model, pinned by tests on made-up profiles.
5. **A measurement.** A sample of candidate trials, labelled by hand with the mappings a careful reader would make, written before the prompt is run on them. A small dev set tunes the prompt; a held-out set is scored once. It reports:
   - **wrong rule-outs**: answers the model rules out that the trial accepts, the safety number;
   - **coverage**: the share of each trial's labelled criteria that the vocabulary can express at all, which answers whether 25–40 facts are enough;
   - **mapping recall**: the share of labelled mappings the model finds.
6. **A command to see it.** For example, `npm run facts:show -- NCT05053555` prints a trial's mapped facts with their quotes. A made-up profile run against the Chicago search shows how many of the 188 each answer would rule out, how many stay unknown, and how many fit.

**Absent on purpose:** no conversation, no choosing which question to ask (0003), no shortlist or ranking, no page, no change to the inherited parser or the screening agent.

## Affected users and systems

**The owner,** who decides the gates: the vocabulary and labels before any model run, whether the dev result justifies the long run, and whether the held-out result is good enough to build 0003 on.

**Slices 0003–0005,** which consume the mappings. 0003 chooses questions from them. 0004 shows a trial's fits and unknowns from them. 0005 starts the screening agent with what they settled, so nothing is asked twice.

**The local model,** through `src/models/`, for a run of many hours. A hosted model only if the owner chooses it after a dry run's estimate, with `--spend`.

**Not touched:** the snapshot and search from 0001 (read only), the inherited parser and screening agent, the transport, any network host.

## Constraints

- **An unknown never excludes,** in the status function and in every test of it.
- **A wrong rule-out is the error to minimize.** When the model is unsure whether a rule maps, it leaves it unmapped. A missed mapping costs a question; a wrong one costs a trial.
- **Quotes, not paraphrase.** Every mapping carries a verbatim quote located in the trial's text, so a reader can check it against the protocol's words. A mapping whose quote can't be found is rejected and counted, as the inherited parser does.
- **Labels before prompts.** The held-out labels are written before the mapping prompt is run on those trials. Prompt changes are made on the dev set only, and the held-out set is scored once (twice at most, as in 0001).
- **Results record model, quantization, temperature and seed.** A mapping run without them isn't a result.
- **No PHI.** Profiles in tests and examples are made up. Trial text is public protocol text.
- **Local by default, and the cost is stated.** Any hosted run is dry without `--spend`, capped, logged to the spend ledger, and needs the owner's go-ahead.
- **Model calls only through `src/models/`.** The new mapping module gets an adapter from the factory, like the parser. `tests/boundary.test.ts` gains whatever keeps the status function and the search free of any model.
- **Tests stay fast and deterministic.** The status function and validators are tested on small fixtures. Model behaviour is measured under `evals/`, never asserted in `tests/`.

## Open questions

1. **Which trials are mapped?** All 1,129 the search keeps for NSCLC, or the 689 that name lung cancer or mention it in their rules? The other 440 are "open to many" trials, the basket trials the product most wants to find. Leaving them unmapped keeps them, but every fact stays unknown for them. At the prescreening repository's 30 seconds to 4 minutes a trial, all 1,129 is roughly one to three days of machine time. Leaning all, timed by a dry run on the dev set first.
2. **One model call per trial, straight from the text, or the inherited parser first and then a mapping call?** Parsing first reuses tested code and its quote locating, but doubles the run and carries over its typing errors. Leaning one call that reads the text and returns only the criteria that map, reusing the parser's quote locator and normalization.
3. **Which 25–40 facts?** Drawn from the research's intake table, plus the rules that most often appear in NSCLC trials. Proposed: chosen by counting how often candidate rules mention each topic in a deterministic keyword pass, then written by hand. The labelling can then say how often a rule *should* map but the vocabulary has no fact for it.
4. **How big a labelled sample?** About 30 rules a trial makes labelling slow. Leaning 30 held-out trials and 10 dev trials, drawn by hash from the 1,129, which gives roughly 900 held-out rules.
5. **What counts as a correct mapping?** Proposed: same fact and the same ruled-out answers. A mapping that rules out a subset of the labelled answers is safe but incomplete, and is counted as such. One that rules out any answer the label doesn't is a wrong rule-out.
6. **Local or hosted for the long run?** The local model is the default and costs nothing but time. If the dry run shows several days, or the dev-set quality is poor locally, a hosted model with batch pricing is an option, at an estimated few dollars for 1,129 trials. That's the owner's call, at a gate, with the estimate in front of them.
7. **Rules with conditions** ("no brain metastases unless treated and stable for 4 weeks", "prior PD-1 allowed in Part B only"). Proposed: a condition the fact's answers can express maps ("treated and stable" is an answer). One they can't stays unmapped, and an arm-scoped rule never rules the trial out.
