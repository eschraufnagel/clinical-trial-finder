# intent: trial-finder-agent

**Author:** the repository owner
**Status:** Draft
**Date:** 2026-10
**Scope:** Product-level. Every later `work/NNNN-*/intent.md` describes one change to what this defines. The evidence behind it is in [research.md](research.md), cited below by section (§).

---

## In plain words

**Who it's for.** Someone with cancer whose treatment has stopped working, who's been told "a trial might be an option" and doesn't know where to start.

**What they face today.** They search ClinicalTrials.gov for their cancer and get hundreds of results. Each one has pages of rules written for doctors, many about things they don't know, like which genetic changes their tumor has. Most give up, or never find the trial that would have fit.

**What this does instead.**

1. **It keeps a copy of every cancer trial open at a US site,** about 5,700, saved on the computer.
2. **It asks a few plain questions:** what kind of cancer, where it has spread, what treatments they've had and how each ended, how active they are day to day, and how far they can travel.
3. **It narrows the 5,700 to the few hundred that could plausibly fit:** their cancer (and trials open to many cancers), near them, still open, their age.
4. **It asks a few more questions,** each chosen because the answer rules many of those trials in or out at once. "I don't know" is fine. It never drops a trial because of something they don't know.
5. **It hands them a short list,** perhaps five to ten trials. For each: what it's testing, why it might fit them, what's still unknown, and the nearest place it's running. Plus one page to take to their oncologist: what to bring, and which questions would settle the most trials.
6. **If they want, it goes deeper on the two or three they pick.** It checks each trial's own remaining rules, such as "no other cancer in the last three years", without asking again anything they've already answered. They get a record per trial of what their answers settled and what still needs their records, to bring to their oncologist or the trial team.

**How it helps.** It turns hundreds of unreadable search results into a short conversation and a short list they can take to their doctor. It never tells them they qualify or that they should join. Their oncologist and the trial team decide that. It just makes sure the conversation with the oncologist happens, with the right trials and the right questions on the table.

**What this project proves.** It runs only with made-up patients. The question it measures is: when the patient only knows part of their own history, how many of the right trials does a conversation still find, and how many questions does it take?

---

## Problem

A person whose cancer has stopped responding to standard treatment is often told a clinical trial might be an option, and little more. ClinicalTrials.gov lists every trial, but it isn't usable by the person who needs it most:

- **Too much, in the wrong words.** 5,740 interventional cancer trials are recruiting at a US site (§2). A search for one cancer type returns hundreds, and each trial's eligibility rules run to a median of about 2,800 characters written for clinicians.
- **The search misses the trials that matter most.** About one in seven of those trials lists only a generic condition such as "advanced solid tumor" (§2). These are often the biomarker-driven, early-phase trials open to someone out of standard options, and a search by cancer type doesn't find them.
- **The rules turn on facts people don't know.** A third of trials name a biomarker. Studies find that many patients don't remember being tested, or can't recall the result (§1). The questions that decide the most trials are often the ones a patient can't answer yet.

Most people never get as far as being ineligible. In a pooled analysis of 8,883 patients, 55.6% had no trial available at the place they were treated, and 8.1% enrolled (§1). A trial existing, and nobody connecting it to the person, is the largest barrier, and the one a person can act on without waiting for their doctor.

Published systems match trials well when they start from a full clinical record (§4: TrialGPT, TrialGPT 2.0, TrialMatchAI). **What hasn't been measured is how close a conversation gets when it starts from a person who knows only part of their own history, and how many questions that takes.** That's the question this project exists to answer.

## Proposed outcome

A local, runnable proof of concept with five parts:

1. **A local trial snapshot and search.** Recruiting US cancer trials, fetched by a script and saved locally. A deterministic search narrows them by condition (including basket trials), status, age and distance, with no model.
2. **A conversation that asks what matters.** A short fixed intake in plain language. Then follow-up questions chosen by how many still-open trials each answer would settle. "I don't know" is an expected answer and never rules a trial out.
3. **A handoff, never a verdict.** A shortlist where each trial carries why it may fit, what's still unknown and who could answer it, what might rule it out, and its nearest recruiting site. Plus a page of questions and records to take to the oncologist.
4. **A deeper check on the trials the person picks.** The per-trial screening agent this repository inherited works through a chosen trial's own remaining rules. Two rules govern the hand-off. **Nothing is asked twice:** a rule the conversation already settled arrives settled, with the person's words behind it, and the agent asks only what's left. **The person chooses how far to go:** they pick which trials to check, two or three by default, so someone who is unwell isn't walked through ten checklists. The result is written for the person and their oncologist rather than a coordinator. For each trial it shows what their answers settled, what needs their records and what to ask. They can print it or save it. The tool sends it nowhere.
5. **An eval harness** that measures all of it against synthetic patients with known eligible trials.

The eval harness is the primary artifact. The agent exists to give it something to measure.

**What it measures.** The same synthetic patient is run three ways: their full record given to a matcher (the upper bound), a short form with no follow-up, and the conversation, with a simulated patient who knows only what their profile says they know. The finding is the gap between the three. Recall of eligible trials comes first, because for this person the costly error is a trial they never hear about. Beside it: excluded trials in the top of the list (the cost of false hope), questions asked (the burden), and whether every unknown became something to ask the oncologist. For the deeper check: how many questions it saved by not repeating any, and how many shortlisted trials it correctly flags as clearly ruled out.

Done looks like:

- a conversation, run locally on made-up patients, that ends in a shortlist with reasons, unknowns and a sheet for the oncologist;
- a committed eval run reporting the three-way comparison on the measured set, including where it fails;
- a short README and `docs/` saying what was measured and what wasn't;
- a `work/` history that shows each slice going from intent to merge.

## Affected users and systems

**Primary user: a person with cancer looking for a trial**, or someone helping them. Simulated in this project. They answer in plain words, often don't know the answers to clinical questions, and get back a shortlist they can act on with their care team.

**Secondary: their oncologist**, who receives the handoff sheet. Not involved in this project. The sheet is written for them to read in a visit, and the oncologist and the trial team make every decision.

**Systems touched:**

- ClinicalTrials.gov API v2, read-only, from a script a person runs to build and refresh the snapshot. Not called while a search runs.
- A model, through the adapters in `src/models/`: the local model by default, or Anthropic, OpenAI or xAI if a person chooses one in the page's Settings and saves their own key there. Scripts reach hosted models only with `--spend`.
- A local web page for the conversation, the shortlist and Settings, in a later slice.

**Deliberately not touched:** no EHR or record upload, no trial site systems, no contact with any site, no SMS or email, no cloud deployment, no patient-facing production surface of any kind.

## Constraints

Binding. `CLAUDE.md` restates them as rules for the code.

- **Local only.** Runs on one machine. Nothing hosted, nothing to operate.
- **Synthetic data only.** No PHI in the repository or any runtime path. Patients are hand-authored.
- **No contact.** The tool never contacts a trial site, a doctor or anyone else. The person does.
- **No runtime network, with one opt-in exception.** Searches run against the local snapshot, which a script refreshes, deliberately. The one call the running app makes off this machine is to the model provider a person chose in Settings (below).
- **Model choice in Settings, as in the prescreening repository.** The local model is the default, and nothing leaves the machine with it. A person may instead choose Anthropic, OpenAI or xAI and save their own key in Settings, which tests it with one call. The key is kept in a gitignored folder on this machine and sent only to its own provider, never read from `.env`. While a hosted model is chosen, everything typed in a conversation and the trials' rules go to that provider. The page says so wherever someone types, so made-up answers only. Each conversation and each trial read has a dollar cap, adjustable in Settings. A result made on a hosted model is marked unmeasured unless an eval measured that model.
- **No verdict.** No code path tells a person they are eligible or should join a trial. Unknowns never exclude. The output presents registry information and what's known and unknown. It recommends no treatment, never ranks by expected benefit, and always routes the person back to their oncologist (§7: this keeps it on the information side of the FDA's line between registry search and treatment advice).
- **Honest about phase and staleness.** Most trials such a person sees are Phase 1 or 2, and the output says what that means. Records that look stale are marked, never promised as open.
- **Oncology, US trials, measured on one cancer.** Any cancer type can be searched. The measurement is NSCLC, where the inherited labelled set and the prescreening repository's experience are. About 470 recruiting US NSCLC trials, few enough to parse overnight on the local model (§5).
- **Frozen measured snapshot.** The snapshot the evals measure against is pinned and committed, trimmed. A refreshed snapshot is a new measurement.
- **Cost ceiling.** The local model is the default. In the app, a hosted model is used only when a person chooses it in Settings, and is capped per conversation. In the scripts, hosted runs are dry without `--spend` and capped per invocation, and each one needs the owner's go-ahead.
- **Proportionate.** It's a proof of concept. Each added measurement or run is justified in a line, in the plan that adds it.
- **Built in slices.** One intent, spec, plan, branch and PR per slice.

**Out of scope:** real patients, uploading medical records, the NCI Clinical Trials Search API (a possible later slice, §3), trials outside the US, contacting sites, ranking by chance of benefit, treatment advice, IRB review, HIPAA or FTC compliance work, production deployment.

## Open questions

1. **Can criteria map onto a small shared fact vocabulary?** The whole design depends on one answer settling many trials (§5.3). Is 25–40 facts enough to cover the criteria that knock trials off a list, and what share map? This is the first thing after the search to measure, and the parser's known weakness, mis-typing patient-answerable criteria, is where it may fail (§8).
2. **Does the structured search keep the trials that matter?** A trial dropped at the search stage can never be found. Search-stage recall is measurable with no model, which is why it comes first (§9).
3. **Where does ground truth come from?** The options are Claude-authored vignettes with knowledge profiles, which need an independent reader; NIH-TrialBench, whose license, oncology share and trial pool need checking; and TREC 2021/2022, for retrieval recall only (§6). One answer, or a combination.
4. **How are basket and biomarker trials handled** when the patient doesn't know their biomarkers? Kept open with the test named on the oncologist sheet, or something more (§8)?
5. **How is a shortlist ordered without implying "best for you"?** The research proposes facts fitted, then fewest unknowns, then distance, pinned by a test (§5). Is that enough, or does it need the patient's preferences (Phase 1, travel, placebo)?
6. **How many questions is too many?** A budget to set and then measure against, not a guess.
7. **Settled: the page offers hosted models in Settings,** as the prescreening repository's does, because most people who open the repository can't run the local model. What stays open is the measurement. The evals run on the local model, so a hosted run starts out unmeasured. Whether to measure one hosted model as well, and which, is a cost decision for the slice that adds Settings.
