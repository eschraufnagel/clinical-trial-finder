# plan: 0007 deeper check

**Intent:** [intent.md](intent.md). **Spec:** [spec.md](spec.md). Spec sections are cited as §n.

## Context

After the conversation, a person has a short list ordered by 31 facts' hints. Most of a trial's rules about the person (57% of labelled ones) aren't in the vocabulary. The hints the model did map can't remove a trial. So clearly wrong trials reach the top: a first-line trial for someone already treated, an untreated small-cell trial, and some of the 14 held-out trials for other cancers that 0005's mark misses.

The product's part 4 is the fix.
- **The person ticks two or three trials.**
- **The inherited screening agent works through each one's own rules.** It never re-asks what the conversation settled.
- **Each trial gets a record** for the person and their oncologist.

The roadmap measures it by questions saved, clearly-ruled-out trials caught, and end to end on vignettes. This slice:
- builds the link from parsed criteria to answered facts, the agent's carried starting state, and the record;
- measures them end to end on the 20 made-up patients' top three trials, on the local model: dev, then held-out once after Gate 1;
- puts the check on the page.

No hosted spend.

**What exists to build on:**
- **`src/screening/`**, the inherited agent:
  - `ScreeningSession` (`create`, `fromState`, `start`, `receive`, `#advance`, `#readable`, `#result`);
  - `agenda.ts`: `initialProgress`, `nextCriterion`, `raisability`, `MAX_ASKS`, `LAB_VALUE_PATTERN`;
  - `apply.ts`: `applyReadings`, `finalize` (passes closed statuses through, and drops any field it doesn't know);
  - `calls.ts`: `ask`, `read`, `objectFrom`;
  - `templates.ts`: the coordinator wording;
  - `from-parse.ts`: `fromParse` (P1…Pn ids, criterion map);
  - `types.ts`: `ScreeningCriterion`, pinned to four fields; `FindingStatus`; `Handoff`.
- **`src/criteria/`:**
  - `parseCriteria(trial, adapter)` needs only `nctId`, `briefTitle`, `conditions`, `phases` and `eligibility` from `Trial`. A `SnapshotTrial` has all five.
  - `Criterion.source` is a `SourceSpan` into the verbatim `criteriaText`.
  - Also `locateQuote`, `NORMALIZE_VERSION`, `PROMPT_VERSION`.
- **`evals/runner.ts`:** the parse cache, keyed by model, prompt and seed, with its "why parses are cached" comment.
- **`src/facts/`:**
  - `readTrialFacts(dir, nctId)` and `runDirFor(month, run)`;
  - `FactMapping.source`, a `SourceSpan` in the same text;
  - `rulesOut`, `appliesTo`.
- **`src/questions/`:** `runConversation`, `trialsForSearch`, `loadConversationSettings`, `UNKNOWN`. Also `scripts/questions-eval.ts`'s `loadContext`, and `evals/questions/` `armsFor` and `loadPatients`.
- **`evals/participant/`:**
  - `simulate.ts`, the vignette participant: blind to agent state, returns `usedFacts`, with one retry;
  - `prompt.ts`: `SIMULATOR_VERSION` via `hashPrompt`;
  - `fidelity.ts`: `deterministicFlags`, `modelFidelityCheck`, `UNCITED_LENGTH`, `NOT_KNOWING`.
- **`evals/graders/screening.ts`** has `VERDICT_PATTERN`, which `src/` can't import. **`src/shortlist/words.ts`** has `VERDICT_PATTERNS` and `verdictHits`, which `src/` can.
- **`src/server/finder.ts`:**
  - `FinderService` over a `MessageTransport`;
  - `Session.said`, the person's typed words, and `AnswerView`;
  - its confirm/fallback flow, and `ReaderSource.forConversation`/`release` for per-conversation adapters and caps.
- **`src/server/app.ts`:** `registerFinderRoutes`; the transport's `onMessage` takes **one** handler.
- **`scripts/app.ts`:** `--fake`, `scriptedReader`.
- **`scripts/lib/model-flags.ts`:** `readModelFlags`, `planPaidRun`, `logSpend`.
- **`evals/run-file.ts`:** `nextRunFile`.
- **`src/shortlist/sheet.ts`, `src/web/Sheet.tsx`:** print styling.
- **`tests/boundary.test.ts`:** its graph-walking describe blocks, one per rule.
- **Committed:**
  - `evals/results/questions/06-8eea38fafad5.json`: the conversation arm's short lists, `other-last`;
  - `data/facts/2026-10/latest`, which names the `qwen3.6-35b-a3b-mlx-8bit-5fea5003-854382b2` run;
  - the 20 patients.

## Order of work

### Stages and gates

| Stage | Steps | Ends at | What you can see at the end |
| --- | --- | --- | --- |
| **A. The carry-in and the record** | 1–6 | — | the link, the carried starting state, the agent's new words, the record, a check runnable from code; all deterministic, on the fake adapter |
| **B. The measurement, and dev** | 7–12 | **Gate 1** | labels for all 60 pairs, written before any parse; the patient participant; dev's 8 trials parsed and 9 pairs checked on the local model; the dev result against the bar; dev's records |
| **C. Held-out** | 13–14 | — | held-out's 35 trials parsed and 51 pairs checked once; the result beside dev's |
| **D. The page** | 15–18 | — | ticks, the check and the record on the page; `--fake`; the browser test |
| **E. Written up** | 19–20 | PR | docs, roadmap, README, CLAUDE.md, review passes |

**Gate 1: spend held-out's one look, and approve the record's words?** (§3.1, §5, §7.5, OQ 7, OQ 9)
- **What's decided:**
  - **Run held-out or not.** Stage C, once: parse held-out's 35 trials, then `check:eval` with no flag. The alternatives are a revision on dev, or stopping with the dev finding.
  - **The link's threshold,** frozen here. It stays 0.5 unless dev argues otherwise, with the pairs that argue it shown.
  - **The record's words**, read on dev's 9 records: the section titles, "may not fit", "nothing here conflicts with what you said", and the opening and closing.
  - **The labels,** for all 60 pairs, with the 9 dev pairs' outcomes beside theirs. Labels can be corrected here, before any held-out run, and never after.
  - **Whether the page stays in this slice** (OQ 7).
- **The bar, frozen now, before dev runs.** Dev must show:
  1. no `verdictHits` in any agent turn or record string;
  2. every `unresolved`, `chart-review` and carried-unknown criterion on its record;
  3. each patient's order identical before and after their checks;
  4. every fidelity flag on dev's replies read and explained in the gate page, and no finding scored from an unfaithful turn;
  5. questions saved > 0 on every dev pair with at least one linked fact.

  Ruled-out caught, missed and false alarms are reported, not barred.
- **What the owner sees:** `work/0007-deeper-check/gate-1-dev.md`:
  - the dev result: every measure in §7.4, per pair;
  - each fidelity flag with its reply;
  - each caught, missed and false-alarm pair with the rule and the person's words;
  - each repeat with the question and the fact it repeats;
  - dev's 9 records, rendered as text;
  - the label counts for both sets;
  - how long dev took, and the estimated time for held-out.
- **What it costs to be wrong:**
  - Held-out is read once. A threshold, a template or a prompt changed after it is tuned on it.
  - Labels changed after held-out runs make the result worthless.
  - The record's words are what a person reads. A word that sounds like a verdict, or hides a conflict, is the product's one hard rule broken.
  - Stage C spends 4–5 hours of the owner's machine. Stage D builds the page on the record's words.
- **Can be no:**
  - **"revise on dev":** a threshold, template or, as a last resort, a read-prompt change that moves `PROMPT_VERSION`; then Gate 1 again;
  - **"stop":** the slice ships stages A and B and the dev finding, and stage D if the page stays.

Stages C, D and E need no gate.
- **Stage C:** the bar decided whether to look, and held-out is reported whatever it shows.
- **Stage D:** builds on words Gate 1 approved, and spends nothing.
- **Stage E:** documentation.

**No hosted run is in this plan.** Every model run is on the local model (Qwen3.6-35B-A3B-MLX-8bit, temperature 0, seed 20260921), which the owner's machine must be serving. If the owner asks for a hosted run, it's a new gate: dry first with `--model <spec>` and no `--spend`, recorded here before it runs. Nothing creates or edits `.env`.

### Steps

Each step is one commit, through `npm run check && git commit`. No commit carries a Co-Authored-By trailer. No test mocks a module or stubs a global. Dates are months.

**Stage A: the carry-in and the record**

1. **Commit intent, spec and this plan.** Record the baseline in Records:
   - `npm run check` exits 0, with the test count and `npm test`'s time;
   - `npm run test:e2e` passes;
   - `search:eval -- --check`, `questions:eval -- --check` and `-- --check --dev`, and `facts:eval -- --check` pass;
   - `other:eval -- --check` and `-- --check --dev` fail with only "labelsSha256 differs", as 0006 recorded. That's a separate task, and "unchanged" for them means that one difference.

2. **The link** (§3.1).
   - **`src/check/link.ts`:** `linkCriteria(nctId, criteriaText, ids: Map<Criterion, string>, facts: TrialFacts | undefined, threshold = LINK_THRESHOLD): Map<string, LinkedFact[]>`. `ids` is `fromParse`'s map, so the criteria come with it; `criteriaText` is what the spans are checked against.
     - `LinkedFact` is `{ factId, rulesOut, polarity, appliesTo?, source }`.
     - Overlap is the shared characters of the two spans ÷ the shorter span's length, at or above `LINK_THRESHOLD` (0.5).
     - It asserts both spans come from the same text by checking `criteriaText.slice(start, end) === text` for each. A mismatch is a thrown error naming the trial.
     - Its comment says the link is a model reading at one remove (the mapper's), so it decides only what's asked and how a rule is shown.
   - `src/check/index.ts` exports it.
   - **Tests, `tests/check/link.test.ts`:**
     - at, under and over the threshold;
     - two facts on one criterion;
     - a criterion with none;
     - no mappings at all (`undefined`);
     - a span from another text throws.

3. **The carried starting state** (§3.2, §3.3).
   - **`src/screening/types.ts`:**
     - `FindingStatus` gains `"from-conversation"`, and `FindingReason` gains `"answered-earlier"`.
     - `CarriedFact` is `{ factId, answer, words, mayNotFit }`. `answer` is an answer id or `"unknown"`, and `words` is the person's.
     - `Carried` is `Record<string, CarriedFact[]>`: criterion id to the facts that cover it.
     - `Progress` and `Finding` gain `earlier?: CarriedFact[]`.
     - `Handoff` gains `fromConversation: string[]`.
     - Each comment says why a carried criterion is never `holds` or `does-not-hold`.
   - **`src/screening/agenda.ts`:** `initialProgress(criteria, carried = {})`.
     - A raisable criterion whose `carried` entry is non-empty starts `from-conversation` / `answered-earlier` with `earlier`.
     - A non-raisable one keeps its reason and gains `earlier`.
     - Nothing else changes.
   - **`src/screening/apply.ts`:** `finalize` carries `earlier` through.
   - **`src/screening/session.ts`:**
     - `create(study, criteria, adapter, options?: { carried?: Carried })`; step 4 adds `fixedQuestions`, with its template, for step 16's `--fake`;
     - `#result`'s handoff includes `fromConversation`;
     - `#readable` is unchanged: closed criteria are in neither `open` nor `answered`, so the read prompt's shape is unchanged.
   - **Who decides "every linked fact was asked":** `src/check/carry.ts`, step 5. `screening/` only receives the decided `Carried`, so it imports neither `src/check/` nor `src/facts/` (§8).
   - **Tests:**
     - `tests/screening/agenda.test.ts`: `initialProgress(c)` deep-equals `initialProgress(c, {})` on every inherited fixture, and carried criteria close as above.
     - `tests/screening/session.test.ts`, fake adapter: a carried criterion is never asked; `ask` is never called with its id; a reading for it is counted `already-settled`; the result's findings carry `earlier`.
     - `tests/screening/prompts.test.ts`: `PROMPT_VERSION` pinned at `2c46ada9a1d5`, so step 4's change to it is a visible test change.

4. **The agent's words, and confirmed readings without a model** (§4, §6.1).
   - **`src/screening/templates.ts`:**
     - `openingMessage(study, covered: number)`: names the trial, says "{n} of its rules were covered by your earlier answers" (or none), and says any question can be skipped;
     - `closingMessage()`: says the record is for them and their oncologist, who decide with the trial team;
     - `fixedQuestion(criterion)` for `fixedQuestions` mode: `The trial asks about this: “{text}”. Does this describe you?`
     - No "coordinator". Its comment keeps the "never sum up" reasoning.
     - `PROMPT_VERSION` hashes every template (it's "everything the agent says or is told"), so `COVERED_TEMPLATE` and `FIXED_QUESTION_TEMPLATE` join the hash and the version moves from `2c46ada9a1d5` to `8fda2872b52a`. The prompts' text doesn't change. Spec §3.3 and §4 said the version wouldn't move; they didn't know the templates were hashed.
   - **`fixedQuestions`** joins `SessionOptions`, and is kept in `ScreeningState` (optional, so version 1 states still resume), so a resumed session asks the same way.
   - **`ScreeningSession.apply(text, readings: Reading[], calls = 0)`:**
     - pushes the participant turn;
     - runs `applyReadings` (so the quote-location rule holds);
     - advances.
     
     `receive` becomes `read` then `apply`'s shared body, so the measurement's path is unchanged.
   - **`ScreeningSession.preview(text)`:** runs the read call only, returning the readings and the calls made, without changing state. It's for the page's confirm step.
   - **`tapReading(criterionId, choice)`**, in `src/screening/taps.ts`: a tap's word becomes a `Reading` whose quote is the tap's own words. Yes is `holds`, No is `does-not-hold`, "I don't know" is `unknown`. `applyReadings` already turns a `clinical` criterion's value into `reported`.
   - **Tests:**
     - templates pass `verdictHits` and contain no "coordinator";
     - `apply` makes no model call besides the next `ask`, and none in `fixedQuestions` mode;
     - `preview` leaves `state()` unchanged;
     - a tap's quote locates;
     - `receive` on the inherited session fixtures gives the same transcript and findings as before, apart from the template text.

5. **The record, and a check from code** (§3.4, §5).
   - **`src/check/carry.ts`:** `carriedFor(links, answers: ReadonlyMap<factId, { answer, words }>, criteria): Carried`.
     - A criterion is carried only when every linked fact is in `answers`.
     - `mayNotFit` is true when `rulesOut` includes the answer.
   - **`src/check/record.ts`:** `recordFor({ study, criteria, result, carried, links }): TrialRecord`. A display model holding:
     - `title`;
     - `notADecision`;
     - `counts`;
     - `sections`: `earlier`, `told`, `records`, `aboutTrial`, each with lines of `{ ruleWords, polarity, said?, mayNotFit, why? }`;
     - `toAsk`.

     The sections follow §5's table, and every criterion lands in exactly one. Its fixed sentences are named constants in the file. `recordWithoutParse(...)` builds §3.4's record from the mappings and answers alone.
   - **`src/check/parse-cache.ts`:** `parseWithCache(trial, adapter, dir)`. It's keyed as `evals/runner.ts` keys its cache (model, parser prompt, normalize version, seed, text checksum), and writes the parse when it returns.
   - **`src/check/run.ts`:** `startCheck({ study, criteriaText, parsed, facts, answers, adapter, fixedQuestions? })` runs `fromParse`, the link and `carriedFor`, and returns a session, the criteria, links, carried facts and each criterion's verbatim wording; `recordOf(check, result)` builds the record. It takes the parse rather than making it, so the caller chooses the cache (`parseWithCache`) or a committed run (`findParse`), and nothing here calls a model before the first question. The adapter is passed in, never built (§8).
   - **Tests, `tests/check/`:**
     - `carry.test.ts`: partial coverage isn't carried, and the `mayNotFit` cases.
     - `record.test.ts`:
       - a fixture with every status and reason;
       - exactly-one-section;
       - may-not-fit by polarity × status and by `rulesOut`;
       - no key named like a verdict, by walking the object;
       - `verdictHits` over every string is empty.
     - `parse-cache.test.ts`: a temp dir, a second call reads the cache, a different model key misses.
     - `run.test.ts`: end to end on the fake adapter with a made-up trial and mappings.

6. **Boundaries** (§8), in `tests/boundary.test.ts`, each a describe block in the file's style with a "would catch" case:
   - `src/check/link.ts`, `carry.ts` and `record.ts` reach no model module, the parser or the factory;
   - nothing under `src/check/` reaches `createAdapter`, `createAppAdapter`, `src/web/`, `src/transport/` or `src/server/`;
   - `src/screening/` reaches neither `src/check/`, `src/facts/` nor `src/plain/`.

**Stage B: the measurement, and dev**

7. **The labels' convention, the label viewer, and the picks** (§2.2, §7.1).
   - **`evals/cases/check/LABELLING.md`:**
     - what "clearly ruled out" means, with `VIGNETTES.md`'s three forms;
     - what's excluded: anything needing medical knowledge beyond common drug names, rules about labs or the chart, and rules for one cohort when another cohort fits;
     - one worked example each: another cancer, small-cell, a treatment-naive trial, a forbidden prior drug;
     - the order: labels before parse.
   - **`evals/check/pairs.ts`:**
     - `picksFor(set)` recomputes each patient's conversation-arm short list with `runConversation`, as `armsFor` does, and takes the first three;
     - `loadPairLabels()` checks each quote with `locateQuote` against the snapshot's `criteriaText`, and that the pair set matches the picks.
   - **`scripts/check-label-show.ts`** (`npm run check:label-show -- <patient> <NCT ID>`, `--next`): prints the patient's file and the trial's eligibility text, numbered by line. It reaches no parser, link or model, held by a boundary block like "the labelling tool cannot see the parser".
   - **Tests:**
     - picks equal the committed result's top three (`06-8eea38fafad5.json`): 9 dev pairs over 8 trials, 51 held-out pairs over 35;
     - the loader rejects a quote that doesn't locate, a missing pair, an extra pair.

8. **The labels, all 60 pairs** (§7.1). `evals/cases/check/pairs.json`, written from `check:label-show` alone, before any parse. Records note the count clearly ruled out per set, and the time taken. Nothing else in the commit.

9. **The patient participant** (§7.2).
   - **`evals/participant/patient.ts`:** `simulatePatient(patient, vocabulary, transcript, memory, adapter)`. It has the same retry, the same `ParticipantReply` shape, and `usedFacts` as fact ids, filtered to `patient.knows`.
   - **`evals/participant/prompt.ts`:** `PATIENT_PARTICIPANT_SYSTEM_PROMPT` and `PATIENT_SIMULATOR_VERSION` (`hashPrompt`).
     - It gets the persona, each known fact's question and `says` reply, the `dontKnow` replies, and the don't-know phrases.
     - "Answer only from these; for anything else, say you don't know, in your own way."
     - "Never describe your health beyond what's listed."
   - **`fidelity.ts`** gains `patientFlags(patient, reply)`: used facts outside `knows`, and an uncited reply over `UNCITED_LENGTH` that isn't `NOT_KNOWING`. `modelFidelityCheck` gets a patient variant on the same prompt shape.
   - **Tests:**
     - a type test that `simulatePatient`'s parameters include no `ScreeningState`, `Progress` or `Carried`, mirroring the vignette one;
     - deterministic flags on made-up replies;
     - the prompt carries no fact the patient doesn't know.

10. **Parsing for the measurement** (§2.2).
    - **`scripts/check-parse.ts`** (`npm run check:parse -- --set dev|heldout`):
      - resumable;
      - writes `data/criteria/<month>/<run>/<NCT>.json` through `parseWithCache`'s file format, and `data/criteria/<month>/latest`;
      - local model by default; `--model <spec>` goes through `planPaidRun` and is dry without `--spend`;
      - loads `.env` via the npm script's `--env-file-if-exists`, as `facts:map` does.
    - The run name is `<model>-<parser prompt 8>-<normalize 8>`.
    - `parseCriteria`'s widened trial type (`ParseableTrial`) landed at step 5, where `parse-cache.ts` first needed it.
    - `package.json` gains `check:parse`, `check:label-show` and `check:eval`, with no dependency.
    - **Tests:** the run name; a dry run with `--model anthropic:…` prints and exits; resume skips written trials.

11. **The evaluation** (§7.3, §7.4).
    - **`evals/check/run.ts`:** `checkPair(pair, ctx, adapters)`, for one pair:
      1. the conversation;
      2. answers carried: a known fact gives the record value and its `says`; an unknown one gives `UNKNOWN` and its `dontKnow` reply, or the first don't-know phrase;
      3. `startCheck` with the committed parse;
      4. the session and `simulatePatient`, turn by turn, until done;
      5. fidelity flags;
      6. the record.

      It returns a transcript file: turns, `usedFacts` per reply, findings, links, carried, record, calls and run metadata.
    - **`evals/check/metrics.ts`:** `scorePair(transcript, label, conversationAsked)`. Every measure in §7.4:
      - saved = carried raisable criteria;
      - a repeat = an agent question whose next participant reply's `usedFacts` meets the conversation's asked facts;
      - caught = the labelled quote's span overlaps a criterion, by the link's rule, whose record line is may-not-fit, with the route;
      - missed, with its reason;
      - false alarm;
      - the verdict, unknown-on-record and nothing-removed checks;
      - fidelity.

      Findings from an unfaithful turn are excluded and counted. `summarize(rows)` adds Wilson intervals.
    - **`evals/check/result.ts`:** the result shape, recording:
      - parser, agent and participant model, quantization, temperature and seed;
      - `PROMPT_VERSION`s: parser, agent, participant;
      - the mapping run;
      - the snapshot month;
      - `pairs.json`'s and the patients' sha256;
      - `LINK_THRESHOLD`;
      - the parse run.
    - **`scripts/check-eval.ts`** (`npm run check:eval`):
      - `-- --dev` writes `evals/results/check/dev/NN-<hash>.json` and transcripts under `evals/results/check/runs/<result name>/`;
      - with no flag it runs held-out, refused once a held-out result exists;
      - `-- --check [--dev]` regrades the latest result from its committed transcripts, with no model, and fails on any difference.
      
      It's resumable per pair, writing each transcript when the pair finishes. Local model only; `--model` goes through `planPaidRun`, as step 10.
    - **Tests, on hand-made transcripts:** each measure, including a repeat, a carried catch, an asked catch, a miss of each kind, a false alarm, an excluded unfaithful finding; `--check` regrade; held-out refusal; the result records every field above.

12. **Dev, on the local model.**
    - `npm run check:parse -- --set dev` (8 trials), then `npm run check:eval -- --dev` (9 pairs), in the background.
    - Commit the parses, the result, the transcripts.
    - Records: time per parse, per pair, calls, failures.
    - Write `gate-1-dev.md` as Gate 1 lists. **Stop at Gate 1.**

**Stage C: held-out**

13. **Held-out parses**, if Gate 1 says so: `npm run check:parse -- --set heldout` (35 trials, of which any dev trial is reused from the cache). Commit. Nothing reads them before step 14.

14. **The held-out run, once:** `npm run check:eval`. If it stops partway, it resumes. Commit the result and transcripts. Records give every §7.4 measure with intervals, beside dev's. `--check` passes on both.

**Stage D: the page** (if Gate 1 keeps it)

15. **The check service** (§6.1).
    - **`src/server/check.ts`:** `CheckService`, in `FinderService`'s style. It's built with a transport, the `ReaderSource`, the snapshot lookup, the mapping lookup, the finder (for answers and `said`), and the cache dir (`local/parses/`).
    - **Per check:**
      - up to three NCT ids;
      - one `ScreeningSession` at a time;
      - `pending` readings awaiting confirm;
      - a per-trial adapter from `reader.forConversation`, under the conversation cap;
      - `release` after each call.
    - **Choices:** `yes`, `no`, `unknown`, `stop`; `confirm` and `change` while readings wait.
    - **Taps:** `tapReading`, then `apply`.
    - **Text:** `preview` → "I read that as: …" per criterion touched → `confirm` calls `apply` with those readings, and `change` offers taps.
    - **A failed read, an unreachable model, or the cap** → taps, with the reason, in `finder.ts`'s words where they fit.
    - **A failed parse** → `recordWithoutParse` and the next trial.
    - **The transport:** `onMessage` takes one handler, so step 15 adds a dispatcher in `src/transport/` (`routeByConversation`). Each service claims its own conversation ids, and app.ts registers both through it. The rule "nothing outside `src/transport/` knows how messages are delivered" holds.
    - **Routes in `src/server/app.ts`:**
      - `POST /api/check`, body `{ finderId, nctIds }`;
      - `GET /api/check/:id/view`, the records and progress;
      - `POST /api/check/:id/stop`;
      - `DELETE /api/check/:id`.
    - **Tests, `tests/server/check.test.ts`, memory transport and fake adapter:**
      - taps;
      - typed → confirm;
      - typed → change;
      - model failure → taps;
      - stop;
      - a fourth trial refused;
      - parse failure → mappings-only record;
      - cap in the parse;
      - the finder's order unchanged after a check.

16. **`--fake` for the check** (§6.3). `scripts/app.ts`:
    - the check reads parses from `data/criteria/<month>/latest` only;
    - sessions use `fixedQuestions: true`;
    - typed text is answered with the copy line and its taps.

    `tests/scripts/app.test.ts`: a trial without a committed parse offers no check.

17. **The page** (§6.2).
    - **`src/web/`:**
      - `ShortList.tsx` and `TrialCard.tsx`: ticks, a three-limit line, **Check these**;
      - `Check.tsx`: reuses `Conversation.tsx`'s message and choice rendering, plus "Reading this trial's rules…" and the hosted-model line;
      - `Record.tsx`: printable, after `Sheet.tsx`;
      - `App.tsx`: the view;
      - `api.ts`: the routes;
      - `copy.ts`: every fixed sentence;
      - `logic.ts`, `styles.css`.
    - Settings' cap line says the cap applies per trial checked.
    - **Tests:** `logic.ts` units for the tick limit, and copy passes `verdictHits`.

18. **The browser test**, `e2e/check.spec.ts`, on `--fake`:
    - search as p08 (97201, 50 miles, 69, male);
    - answer the intake by taps from p08's record;
    - tick the top three, which step 7 shows have committed parses;
    - check the first by taps, then print its record;
    - assert no verdict words, every unknown listed, the list's order unchanged;
    - assert the other e2e specs still pass.

**Stage E: written up**

19. **Docs** (§10).
    - `docs/check.md` (new), with the Limits from §10.
    - `docs/page.md`: picking, the check, the record, `--fake`, the per-trial cap.
    - README's list of parts gains the check, with no findings.
    - `work/ROADMAP.md`: 0007 **Done** with its measure.
    - **`CLAUDE.md`:**
      - the three commands;
      - `src/check/` and `data/criteria/` in the layout;
      - the new boundaries;
      - the parse-cache exception, if any.

20. **Review passes** (`REVIEW.md`), recorded in Records.

## Files that change

**New:**
- `src/check/{index,link,carry,record,parse-cache,run}.ts`;
- `src/server/check.ts`; `src/transport/route.ts` (the dispatcher);
- `src/web/{Check,Record}.tsx`;
- `evals/cases/check/{LABELLING.md,pairs.json}`;
- `evals/check/{pairs,run,metrics,result}.ts`;
- `evals/participant/patient.ts`;
- `scripts/{check-label-show,check-parse,check-eval}.ts`;
- `data/criteria/2026-10/<run>/*.json` and `latest`;
- `evals/results/check/{dev/,runs/}…` and the held-out result;
- `tests/check/{link,carry,record,parse-cache,run}.test.ts`;
- `tests/server/check.test.ts`;
- `tests/scripts/{check-eval,check-parse}.test.ts`;
- `tests/participant/patient.test.ts`, or beside the existing participant tests;
- `e2e/check.spec.ts`;
- `docs/check.md`;
- `work/0007-deeper-check/{plan,gate-1-dev}.md`.

**Changed:**
- `src/screening/{types,agenda,apply,session,templates,index}.ts`;
- `src/criteria/parse.ts` (the parameter's type only);
- `src/server/app.ts`; `src/transport/index.ts`;
- `src/web/{ShortList,TrialCard,App,api,copy,logic,SettingsPage}.tsx|ts`, `styles.css`;
- `evals/participant/{prompt,fidelity}.ts`;
- `scripts/app.ts`; `package.json` (scripts only);
- `tests/boundary.test.ts`;
- `tests/screening/{agenda,session,prompts}.test.ts`;
- `tests/scripts/app.test.ts`;
- `docs/page.md`, `README.md`, `work/ROADMAP.md`, `CLAUDE.md`.

**Not touched:**
- `src/search/`, `src/questions/`, `src/shortlist/{order,sheet}.ts`;
- `src/facts/`, read only;
- `src/plain/`, `src/models/`;
- the screening prompts' text. `PROMPT_VERSION` moves anyway, at step 4, because it hashes the fixed templates too; no committed result in this repository records the agent's version;
- the mapping run, the patients, 0005's labels;
- every committed result;
- `.env`.

**No new dependency.**

## Reused, not rebuilt

- **The agent whole:** code-chosen criteria, the quote-location rule, `clinical` never settled, `MAX_ASKS`, `finalize`, the read call. Carry-in is a starting state, not a new agent.
- **The parser and its cache discipline:** `parseCriteria`, `fromParse`, `evals/runner.ts`'s keying.
- **The mapping run:** `readTrialFacts`, with spans in the same text as the parse's.
- **The conversation and picks:** `runConversation`, `trialsForSearch`, `loadContext`, `armsFor`.
- **The participant:** `simulate.ts`'s retry and blindness; `fidelity.ts`'s two checks.
- **Never a verdict:** `verdictHits` from `src/shortlist/words.ts`.
- **The page:** `FinderService`'s confirm and fallback flow, `ReaderSource`'s per-conversation adapters and caps, `Conversation.tsx`'s rendering, `Sheet.tsx`'s print styles.
- **Scripts:** `planPaidRun`, `nextRunFile`, the `--check` regrade pattern of `facts:eval` and `other:eval`.

## Risks

- **The parser on snapshot trials is unmeasured here.** Patient rules typed clinical end as "needs your records", and the record says so. A rule the parse drops can't be caught, and "missed: not parsed" counts it.
- **The link inherits the mapper's misses** (73% recall). Those become repeats, which is what "repeats left" is for. A wrong link closes a rule with a fact that doesn't answer it. The record shows the rule's words beside the person's answer, and Gate 1 reads dev's links.
- **The participant is a model.** It may invent history or skip a known fact. Fidelity flags exclude findings, and Gate 1 reads every flag. The repeat measure rests on its `usedFacts`, so it's a model's self-report, and the docs say so.
- **The labels have one author,** who also wrote the patients and the spec. They're written before any parse, from text alone, and Gate 1 can correct them before held-out.
- **Sixty pairs.** Ruled-out rates come with wide intervals, and the docs give them.
- **Time.** A trial's parse can run past the oMLX timeout on long criteria (`evals/runner.ts`'s note). A failure is recorded and the run continues; the result names what's missing.
- **The page doubles the slice.** Gate 1 can move stage D to its own slice. Stages A–C stand alone.
- **One transport handler.** The dispatcher is a change to `src/transport/`. It's tested on the memory transport, and the existing e2e specs must still pass.
- **Hosted models in the app** run the agent unmeasured, with no schema, so 0004's failure mode, JSON wrapped in prose, can return on Haiku. Taps cover it, and the page says the check is unmeasured.

## Verification

- `npm run check` exits 0 at every commit.
- Every `--check` from step 1 is unchanged at every step; `check:eval -- --check --dev` passes from step 12, and `-- --check` from step 14.
- `npm run test:e2e` passes at steps 1, 16, 17 and 18.
- **By hand at step 18:** `npm run app -- --fake`; search as p08; tick three; check one by taps; print the record.
- **By hand, optional, the owner's machine:** `npm run app` on the local model, check one trial with typed replies, and confirm each reading.

## Records

- **Step 1, baseline** (on `main` at `470c09e`):
  - `npm run check` exits 0; 1,084 tests (1,076 passed, 8 expected to fail); `npm test` about 0.8 s.
  - `npm run test:e2e`: 7 passed.
  - `search:eval -- --check`, `questions:eval -- --check` and `-- --check --dev`, and `facts:eval -- --check` pass.
  - `other:eval -- --check` and `-- --check --dev` fail with "labelsSha256 differs" and nothing else, as 0006 recorded. A separate task; at each step below, "unchanged" for these two means that single difference.
- **Step 2:** `linkCriteria` takes `nctId` and `criteriaText` as well, to check every span against the text; the plan's signature is updated. 7 tests.
- **Step 3:**
  - `initialProgress(criteria, carried)`, `finalize` keeping `earlier`, `SessionOptions.carried`, `Handoff.fromConversation`.
  - The inherited session test's handoff expectation gains `fromConversation: []`: the record grows by a field, nothing is loosened.
  - `PROMPT_VERSION` pinned at `2c46ada9a1d5`; `fixedQuestions` moved to step 4, beside its template.
- **Step 4:**
  - **Divergence:** `PROMPT_VERSION` hashes the opening and closing templates, so the rewrite moves it, to `8fda2872b52a`. The prompts' text is unchanged. The pin in `prompts.test.ts` changes in this commit, visibly. No result in this repository records the agent's version, so nothing committed is affected.
  - The inherited template test, which asserted "coordinator will review", now asserts the new reader: the oncologist and the trial team decide, and no "coordinator". The session test's opening assertion follows it.
  - `receive` is `preview` then `apply`, so the measurement's path is the same calls in the same order.
- **Step 5:**
  - `carriedFor`, `recordFor`, `recordWithoutParse`, `parseWithCache`, `findParse`, `startCheck`, `recordOf`.
  - **Divergences:**
    - `startCheck` takes the parse instead of making it: the page parses through `parseWithCache`, and the measurement and `--fake` read a committed run through `findParse`.
    - `parseCriteria` and `buildUserPrompt` take `ParseableTrial`, a `Pick` of `Trial`, here rather than at step 10. Type only: the parser's `PROMPT_VERSION` is unchanged and its tests pass as they were.
    - The record's text follows `src/shortlist/words.ts` (`ours`, `registry`, `said`), so `oursIn` finds every string the project writes, and a rule is shown in the trial's verbatim words.
