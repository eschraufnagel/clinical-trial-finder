# spec: 0007 deeper check

**Status:** Draft
**Date:** 2026-10
**Intent:** [intent.md](intent.md). Open questions are cited as OQ n.

This spec says:
- where a picked trial's criteria come from;
- how what the conversation settled reaches the screening agent;
- what the agent says;
- what the record holds;
- how the page runs the check;
- how it's measured, and where the gate falls.

Each answer to an open question is a proposal, and says where a gate can overturn it.

---

## 1. What a person can do at the end

1. **On the list, tick up to three trials,** from the short list or below it, and press **Check these**. Nothing is ticked to start with. A fourth tick is refused, with a line saying why (product intent, part 4).
2. **Each trial is checked in turn.** The page says "Reading this trial's rules…" while the parse runs, then asks one question at a time. Each question offers **Yes**, **No** and **I don't know**, and takes free text. A typed reply's reading is shown back and confirmed before it counts.
3. **A rule their earlier answers covered isn't asked.** The check's opening says how many of the trial's rules their answers already covered.
4. **They can stop a trial's check at any point** with "Stop and show the record". What's left is listed as not asked.
5. **Each trial gets a record** (§5). The records print with the sheet, or on their own. Nothing sends them anywhere.
6. **The list doesn't change.** No trial moves or leaves because of the check.

## 2. A trial's criteria (OQ 1)

### 2.1 In the app

- **When a trial is picked,** the server parses its eligibility text from the snapshot with the inherited parser (`src/criteria/`). It uses the model chosen in Settings, inside the budget wrapper, as `src/server/models.ts` builds it. `fromParse` turns the parse into the agent's criteria, unchanged.
- **The parse is cached on this computer,** under `local/parses/`, keyed by trial, model, parser prompt version and normalize version, the way `evals/runner.ts` keys its cache. A second check of the same trial on the same model reads the cache.
- **A parse that fails,** whether the model is unreachable, the output is unreadable, or the cap is reached, ends that trial's check with a record saying its rules couldn't be read. The record lists what the conversation covered from the mappings alone (§3.4). Nothing is removed.
- **`--fake` reads committed parses only** (§2.2). A trial without one says so and offers no check.

### 2.2 For the measurement

- **The picked trials:** each patient's top three on the conversation arm's short list, at 0003's frozen settings and 0005's order (`other-last`). They're recomputed by the questions code and checked against the committed held-out result (`06-8eea38fafad5.json`). 9 dev pairs over 8 trials, 51 held-out pairs over 35, 39 trials in all.
- **Parsed once on the local model** (Qwen3.6-35B-A3B, 8-bit, temperature 0, seed 20260921). Committed under `data/criteria/2026-10/<run>/`, one file per trial, with a `latest` file naming the run, as `data/facts/` does.
- **Each file records** the parser's prompt version, the normalize version, the model, the snapshot month and the text's checksum.
- **Every later run reads these parses,** so every number in the result rests on the same criteria.
- **The script:** `npm run check:parse -- --set dev|heldout`. It's resumable. `--model <spec>` is dry without `--spend`, as every model script is. None is proposed.

### 2.3 Inherited, and said so

The parser was measured in the prescreening repository, not here. Its known weakness is that over half of patient-answerable criteria reached the agent typed `clinical` (research §8). Such a rule is asked, and what the person says is recorded as `reported`, pending the chart. It never ends settled. The record shows it under "needs your records". `docs/check.md` says so.

## 3. What the conversation settled (OQ 2)

### 3.1 The link

`src/check/link.ts` has no model.
- **A parsed criterion is linked to a fact** when its source span overlaps the source span of one of the trial's fact mappings, from the mapping run named in `data/facts/<month>/latest`.
- **Overlap** is at least half of the shorter span's characters. Both spans are offsets into the same `criteriaText`.
- **The link records** each linked fact, the mapping's `rulesOut`, and its `appliesTo` if it has one.
- **The threshold is set on dev and frozen at Gate 1.** Dev pairs only; the threshold isn't moved after held-out is run.

### 3.2 What's carried

From the conversation, for each fact asked:
- **The confirmed answer,** an answer id or "unknown";
- **The person's words:** what they typed, or the tapped answer's words.

On the page this is the finder session's answers, as changed on the list. In the measurement it's the patient's record value for a fact asked and known, with its `says` reply as the words; for a fact asked and not known, "unknown" with the don't-know reply.

### 3.3 The starting state

- **`ScreeningCriterion` keeps its four fields** (`CLAUDE.md`, "pinned to four fields"). What's carried goes into the starting progress, not the criterion.
- **`ScreeningSession.create` takes an optional `carried` argument:** criterion id to the facts that cover it, each with its answer, words and whether the mapping's `rulesOut` holds that answer.
- **A raisable criterion is closed before the first question** when every fact linked to it was asked, "unknown" included. It's closed with:
  - a new status, `from-conversation`;
  - reason `answered-earlier`;
  - an `earlier` field holding what was carried.
- **A criterion with some linked facts unasked stays open,** and is asked.
- **A criterion that isn't raisable** (protocol, definitional, a lab value) keeps its `not-raised` reason. Its linked facts are shown beside it on the record.
- **With nothing carried, the starting state is exactly today's.** A test pins that against `initialProgress`.
- **A closed criterion never becomes `holds` or `does-not-hold`.** Whether the person's answer meets the rule is the mapper's reading, and on the record it's a hint (§5).
- **Readings for closed criteria are ignored, and counted** (`already-settled`), as for any closed criterion. The read call's `open` and `answered` lists don't change shape. `PROMPT_VERSION` doesn't change (OQ 6).

### 3.4 With no parse

If the parse fails, the record still shows the mappings' rules with the person's answers beside them, from the link's inputs alone.

## 4. What the agent says (OQ 6)

- **`src/screening/templates.ts`.** The opening and closing are rewritten for this product.
  - **The opening** names the trial, says how many of its rules the person's earlier answers covered, and says any question can be skipped.
  - **The closing** says the record is for them and their oncologist, and that the oncologist and the trial team decide.
  - Neither mentions a coordinator, and both pass `verdictHits` (`src/shortlist/words.ts`).
- **The prompts don't change.** `PROMPT_VERSION` stays as it is, pinned by its existing test.
- **If dev shows the read call rereading closed criteria often enough to matter,** a prompt revision goes to Gate 1 as a choice, not into the code first.

## 5. The record (OQ 4)

`src/check/record.ts` is pure: a display model from a `ScreeningResult`, the criteria's polarity and the carried facts. Every criterion appears in exactly one section.

| Section | From | Each line shows |
| --- | --- | --- |
| **What your earlier answers covered** | `from-conversation` | the rule in the trial's words; their answer, in their words; **may not fit** when the mapping's `rulesOut` holds the answer; "you didn't know" for unknown |
| **What you told the check** | `holds`, `does-not-hold` | the rule; their words; **may not fit** when an exclusion holds or an inclusion doesn't |
| **Needs your records or your oncologist** | `chart-review`, `unresolved`, `not-raised` for a lab value | the rule; what they said, if anything; why it's here (a lab value, something only the chart settles, didn't know, skipped, not asked) |
| **About the trial, not you** | `not-raised` for protocol or definitional | the rule, folded away by default |

**Above the sections:**
- the trial's title;
- a line: "This isn't a decision. Your oncologist and the trial team decide whether this trial is right for you.";
- the count of rules that may not fit, and of rules that need records.

**Below them: "To ask your oncologist".** Each may-not-fit rule and each records rule, as a question, in the trial's words.

- **"May not fit" is the only word for a conflict,** as on the list. No line says "fits", "eligible", "qualifies" or "ruled out". A rule with no conflict reads "nothing here conflicts with what you said".
- **The record carries no field for a verdict,** as `ScreeningResult` doesn't, and every string it produces passes `verdictHits`. A test holds both.
- **A record never changes the list.** It isn't read by the order, the sheet or the chooser.

**The words are Gate 1's to approve,** read on dev's records, with every fixed sentence in `src/web/copy.ts` or `src/check/record.ts`.

## 6. The page (OQ 5, OQ 7)

### 6.1 The check service

`src/server/check.ts` is a session per check, over the `MessageTransport`, beside `finder.ts` and in its style. It holds the picked trials, one `ScreeningSession` at a time, and the carried facts from the finder session it came from.
- **On each question** it delivers the agent's text, with choices **Yes**, **No**, **I don't know** and **Stop and show the record**.
- **A tap is applied without a model.** It becomes a reading on the asked criterion, with the tap's words as the message and as the quote, so the evidence rule holds as it is:
  - Yes is `holds`, No is `does-not-hold`, I don't know is `unknown`;
  - for a `clinical` criterion, the same values become `reported`.
- **Typed text is read by the agent's read call** (OQ 5). The page shows each criterion the reply touched with its reading, "I read that as: …", then **That's right** and **Change it**.
  - **That's right** applies the readings.
  - **Change it** discards all of them and offers the taps for the asked criterion.
  - Until confirmed, nothing changes.
- **When a reading can't be used, or no model can be reached,** the question offers its taps and says why, as `finder.ts` does.
- **Each check runs under the conversation's cost cap** in Settings, the parse included. The cap is per trial checked, not per page: three trials can spend three caps. Settings' words say so.

`ScreeningSession` gains one method to apply a confirmed set of readings, with no model call, so confirming doesn't go back through the model. `receive` keeps its behaviour for the measurement.

### 6.2 Routes and views

- **Routes:**
  - start a check from a finder session and up to three NCT ids;
  - the check's messages through the existing transport routes;
  - its records.
- **Views:**
  - ticks and **Check these** on `ShortList`;
  - a `Check` view reusing `Conversation`'s message and choice parts;
  - a `Record` view that prints, after `Sheet`'s style.
- **Every fixed sentence is in `copy.ts`.** Where answers go on a hosted model is said where the person types, as in the conversation.

### 6.3 `--fake` (OQ 7)

- **Questions** are a fixed sentence around the criterion's own words, such as "The trial asks about this: “…”. Does this describe you?". No ask call.
- **Answers are taps only.** Typed text gets a line saying it can't be read in this mode.
- **Parses** come from the committed files (§2.2).
- **The browser test** searches as dev patient p08, answers the conversation, ticks three trials with committed parses, checks one by taps, and prints its record. It finds:
  - no verdict words;
  - every unknown on the record;
  - the list unchanged.

### 6.4 On a hosted model (OQ 8)

- **The check is unmeasured.** It says so where Settings and the conversation say it, from the same flag.
- **No schema is sent** for `ask` or `read`. A reading Haiku can't return as JSON falls back to the taps.
- Measuring the agent on a hosted model, and giving its calls a schema, is a later slice's.

## 7. The measurement (OQ 3, OQ 4, OQ 9)

### 7.1 Labels, first

`evals/cases/check/pairs.json` has one entry per pair, with the convention in `evals/cases/check/LABELLING.md`.
- **What each entry holds:** patient, NCT id, set, and `clearlyRuledOut`. When it's true, it also holds the rule's quote, verbatim from `criteriaText`, the record facts that fail it, and one sentence on why.
- **"Clearly":** `VIGNETTES.md`'s reading test. The rule restates, plainly negates, or compares a number with the patient's record. Anything needing medical knowledge beyond common drug names is not clearly ruled out.
- **Written for all 60 pairs before any parse or check runs on them,** from the trial's text and the patient's file. `npm run check:label-show -- <patient> <NCT ID>` prints both, and reaches neither the parser, the link nor a model. A boundary test holds that.
- **The file's checksum** is recorded in every result.

### 7.2 The participant

`evals/participant/` gains a patient mode: the local model answering as one patient's file.
- **What it's given:** the persona; for each fact they know, the fact's question and their `says` reply; their `dontKnow` replies; their don't-know phrases.
- **What it's told:** answer the question asked only from these. Anything they're not given, they don't know.
- **What it returns:** the fact ids each reply drew on (`usedFacts`), as the vignette mode does.
- **It's blind to the agent:** it gets the transcript's text, never the agent's state. The existing type test is extended to the patient mode.
- **Fidelity is checked two ways:**
  - deterministically: every used fact is in `knows`, and an uncited reply over `UNCITED_LENGTH` is flagged;
  - by the existing local-model read, as a flag for Gate 1, never a score.

  A finding resting on an unfaithful turn is excluded from scoring and counted, as `fidelity.ts` already does.

### 7.3 The run

`npm run check:eval -- --dev`, then held-out once with no flag, refused once a held-out result exists, as `other:eval` is. For each pair:
1. the conversation, as in `questions:eval`'s conversation arm;
2. the carried facts;
3. the committed parse;
4. the link;
5. the session;
6. the participant, until the agent closes;
7. the record.

Transcripts are committed under `evals/results/check/runs/<result>/`, so `-- --check` regrades the latest result from them, with no model, and fails on any difference.

### 7.4 What's reported

Per set, with Wilson intervals where a rate is given:

| Measure | Definition |
| --- | --- |
| **Questions saved** | Raisable criteria closed by the link: each would otherwise have been asked at least once. Total, per pair, and as a share of raisable criteria |
| **Repeats left** | Agent questions whose participant reply drew on a fact the conversation asked |
| **Questions asked** | Agent questions, follow-ups included |
| **Ruled out, caught** | Of pairs labelled clearly ruled out, those whose record shows the labelled rule as may-not-fit. The rule's quote must overlap a criterion's span under §3.1's threshold. Each pair is shown, with which route caught it: carried or asked |
| **Ruled out, missed** | The rest, each with why: not parsed as a criterion, typed protocol, asked and unknown, or answered without conflict |
| **False alarms** | Of pairs labelled not clearly ruled out, those whose record shows any may-not-fit. Each one is listed |
| **Never a verdict** | `verdictHits` on every agent turn and every record string |
| **Every unknown on the record** | Every criterion that's `unresolved`, `chart-review` or a carried "unknown" appears in "needs your records" or "earlier answers" |
| **Nothing removed** | Each patient's order is the same before and after their checks |
| **Fidelity** | Flags, deterministic and model, and findings excluded |

**Every result records:**
- the parser's and the agent's model, quantization, temperature, seed and prompt version;
- the participant's prompt version;
- the mapping run;
- the snapshot month;
- the labels' and patients' checksums;
- the link's threshold.

### 7.5 Gate 1: spend held-out's one look? (OQ 9)

The bar is frozen in the plan before dev runs. Dev must show:
1. no verdict words in any turn or record;
2. no unknown missing from a record;
3. no trial removed or moved;
4. no fidelity flag left unexplained on the dev replies;
5. questions saved above zero on every dev pair with at least one linked fact.

Ruled-out caught and false alarms are shown, not barred: 9 pairs can't measure a rate.

**Gate 1 also decides:**
- the link's threshold, if dev argues for another;
- the record's words, read on dev's records;
- whether the page stays in this slice (OQ 7).

Below the bar, the gate chooses a revision on dev or stopping with the dev finding.

### 7.6 Held-out

Run once, on the local model, after Gate 1. Reported whatever it shows. No hosted run is proposed. If the owner asks for one, it's a new gate, dry first.

## 8. Boundaries

`tests/boundary.test.ts` gains:
- **`src/check/link.ts` and `record.ts`** reach no model module, the parser or the factory.
- **Nothing under `src/check/`** reaches the factory. It takes its adapter as an argument.
- **`src/check/` may import** `src/screening/`, `src/criteria/`, `src/facts/` types and `src/shortlist/words.ts`, and nothing from `src/web/`, `src/transport/` or `src/server/`.
- **`src/screening/` still doesn't import `src/plain/`,** and doesn't import `src/check/` or `src/facts/`: the carry-in arrives as its own type.
- **`check:label-show`** reaches no parser, link or model.
- **`src/server/check.ts`** gets its adapter through `src/server/models.ts`, so `createAppAdapter` stays named in one file.
- **The network rule doesn't widen.**

## 9. Tests

All deterministic, with the fake adapter:
- **link:**
  - overlap at, under and over the threshold;
  - several facts on one criterion;
  - none;
  - spans from the same text only.
- **starting state:**
  - nothing carried equals `initialProgress`;
  - a fully covered criterion is closed `from-conversation`;
  - a partly covered one stays open;
  - a non-raisable one keeps its reason;
  - a carried "unknown" closes;
  - readings for closed criteria are counted as ignored.
- **session:**
  - the agent never asks a closed criterion;
  - applying confirmed readings needs no model call;
  - a tap is a reading whose quote locates.
- **record:**
  - every criterion is in exactly one section;
  - may-not-fit by polarity and by `rulesOut`;
  - no verdict field;
  - `verdictHits` is empty over every string, on fixtures that include every status and reason.
- **templates:** no coordinator, no verdict words.
- **check service:**
  - taps;
  - typed → confirm;
  - typed → change;
  - model failure → taps;
  - stop;
  - three-trial limit;
  - cap reached in the parse.
- **measurement:**
  - picks match the committed result;
  - scoring of each measure on hand-made transcripts;
  - `--check` regrades;
  - held-out refused once a result exists.
- **participant:** the patient mode's type test (blind to the agent's state); deterministic fidelity on made-up replies.
- **boundaries,** §8.
- **browser test,** §6.3.

## 10. Docs and roadmap

- **`docs/check.md`, new:**
  - what the check does;
  - the link;
  - the record;
  - the measurement and its results;
  - Limits: the inherited parser, unmeasured here; the mapper's misses becoming repeats; one author for labels and patients; the participant is a model; unmeasured on hosted models.
- **`docs/page.md`:** picking, the check, the record, `--fake`.
- **README:** the list of parts gains the check, with no findings.
- **`work/ROADMAP.md`:** 0007 **Done** with its measure.
- **`CLAUDE.md`:** the new commands, `src/check/`, the boundaries.

## 11. Out of scope

- a hosted run, and a schema for the agent's calls (OQ 8);
- rerunning the inherited vignettes (OQ 10);
- any change to the search, the mark, the facts, the questions, the chooser or the order;
- fixing `other:eval --check` (a separate task);
- 0005's check-revision items (OQ 11);
- plain-language renderings of a picked trial's criteria: `src/plain/` covers the twelve inherited protocols only, and the record shows the trial's words.
