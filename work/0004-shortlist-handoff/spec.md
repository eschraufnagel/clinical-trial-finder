# spec: 0004 shortlist and handoff

**Status:** Draft
**Date:** 2026-10
**Intent:** [intent.md](intent.md). Open questions are cited as OQ n.

This spec says what the page does, what it says, and how each rule is held. Where it copies the prescreening repository (`trial-prescreening-agent`), it names the file; those files were reviewed and merged there, and are adapted here, not redesigned.

---

## 1. What a person can do at the end

```
npm run app                    the page, on the model chosen in Settings, http://127.0.0.1:5025
npm run app -- --fake          the same, with a scripted reader: no model needed
```

1. **Search.** ZIP, distance (25, 50, 100, 250 miles, or anywhere; default 100), age, sex. Cancer type is lung (NSCLC); the form says other types aren't ready yet (OQ 10). An unknown ZIP is refused with a message, before anything runs.
2. **Questions.** The 8 intake questions in the settings' order, then up to 8 chosen follow-ups, one at a time. Each shows the vocabulary's question, a text box, and "Not sure how to say it? Choose an answer" which opens the fixed answers and "I don't know".
3. **Confirm.** After a typed reply: "I read that as: *answer words*." with **That's right** and **Change it**. Change it shows the fixed answers and "I don't know". Only a confirmed answer counts (§4).
4. **"Show me the list now"** is on every question. It stops the questions; the stop is recorded as `person`.
5. **The short list.** About 10 trials, then "N more trials the search kept", each openable (§5).
6. **Your answers.** Every question asked, the person's words, the confirmed answer, and a **Change** button with the fixed answers (OQ 4). A change reorders the list at once. No more questions are chosen.
7. **For your oncologist.** A printable sheet (§6), with a Print button that calls `window.print()`.
8. **Settings.** Model, keys, cap (§8).
9. **Start over** clears the conversation.

## 2. The order (OQ 1)

### 2.1 Candidates

Each is a list of keys, as `ORDER_KEYS` is now. All keep whole-trial hints first: a hint is the one thing a person's answers say against a trial, and it outranks anything else.

| Name | Keys, in turn |
| --- | --- |
| `hints` (0003's) | fewest whole-trial hints, fewest part hints, nearest site, NCT id |
| `checked` | fewest whole-trial hints, fewest part hints, **most facts checked**, nearest site, NCT id |
| `read-first` | fewest whole-trial hints, fewest part hints, **trials with mappings before trials with none**, nearest site, NCT id |

**Facts checked** is `status.fits.length`: facts the trial's mappings ask about that the person answered and no mapping hints against. It changes with the profile. A trial with no mappings has 0.

Every candidate is pure, deterministic, and never reads phase, sponsor, the number of rules, or anything that could read as "best for you". `checked` rewards how much of a trial's rules were compared with the person's answers, not what the trial offers.

### 2.2 Where it lives

- `src/shortlist/order.ts` gains `ORDERS: Record<OrderName, readonly string[]>`, one key list per name, and `orderTrials(entries, name)`. `ORDER_KEYS` stays, as `ORDERS.hints`, so the pinning test still reads it.
- `data/questions/conversation.json` gains an optional `"order"`. Absent means `hints`, so every committed 0003 result reruns under the settings it records (`--check` already rebuilds settings from the result).
- `ConversationSettings` gains `order: OrderName`.

### 2.3 The chooser under `checked`

`shortlistChange` (`src/questions/select.ts`) relies on answers only adding hints, so a trial can only move down. Under `checked` an answer also adds fits, so a trial can move up. The shortcut is kept for orders where answers only move trials down (`hints`, `read-first`: their extra key is fixed per trial). For `checked`, a full recount: apply the answer's deltas to every trial's key, re-sort, and count trials entering the top `shortlistSize`.

A test holds that the full recount equals the shortcut on every fixture under `hints`, so the recount is right where both apply.

### 2.4 Measured on dev

`questions:eval -- --dev --order <name>` writes one result per order, under `evals/results/questions/dev/`. Besides 0003's numbers, each result reports, for the record and conversation (`shortlist` scorer, budget 8) arms:

| Number | What it says | Comparable across orders? |
| --- | --- | --- |
| **Read ratio** | mean mappings per short-list trial ÷ mean mappings per candidate. 1.0 means the short list is read as fully as the average trial; 0003 is about 0.55 | Yes |
| **Unread places** | short-list places held by trials with no mappings (0003's `noMappingPlaces`) | Yes |
| **Would-flag** | share of the short list the full record gives a whole-trial hint | Yes: it's the record's hints, not the order's |
| **Median miles** | of the short list's nearest sites: what the change costs in travel | Yes |
| **Agreement** | share of the record arm's short list the conversation's holds, under the same order | No: each order has its own record arm |
| **Follow-ups, "don't know"s** | the burden | Yes |

Agreement is reported but doesn't decide: an order that reproduces its own record arm well can still put under-read trials first.

### 2.5 Gate 1 decides

The owner sees the table for each order, and for p08, p11 and p17 the three short lists side by side with each trial's mapping count. The choice is written into `conversation.json` as `"order"`. Then held-out is rerun once, as `evals/results/questions/02-*.json`, reported beside `01-*`, with the note that held-out had been scored before.

## 3. The conversation, step by step

`src/questions/conversation.ts` gains a stepwise form. `runConversation` is rebuilt on it, and must reproduce every committed 0003 result before anything else changes (plan, stage A).

```ts
interface ConversationState { ... }                 // opaque outside the module
startConversation(input: StartInput): ConversationState
nextQuestion(state): { factId; phase: "intake" | "follow-up"; score: number | null } | { stop: StopReason }
answer(state, factId, reply: string): Step          // reply: an answer id or UNKNOWN
changeAnswer(state, factId, reply): void            // a fact already asked; no new questions follow
stopNow(state): void                                // StopReason "person"
current(state): ConversationResult                  // the order and short list as they stand
```

- `StopReason` gains `"person"`.
- `answer` refuses a fact that isn't the next question, and a reply that isn't one of the fact's answers or `UNKNOWN`, as `runConversation` does now.
- After `changeAnswer` or `stopNow`, `nextQuestion` returns the stop. The order is recomputed from the profile; the chooser isn't run again.
- Pure: no model, no file, no clock. It stays under the boundary that keeps `src/questions/` (outside the reader) from models, the transport and the factory.

## 4. Reading and confirming (OQ 2, 3)

### 4.1 The flow, per question

```
agent: <question>                                 choices: none (text box), plus "Choose an answer"
person: <free text>                               or a choice: an answer id, or unknown
server: readReply(fact, text, adapter)            only for free text
agent: I read that as: <answer words>.            choices: [That's right] [Change it]
person: That's right   → answer(state, factId, reading)
        Change it      → agent: Which is closest?  choices: each answer's words, I don't know
                         person: a choice        → answer(state, factId, choice)
```

- **Every reading is confirmed,** "I don't know" included ("I read that as: you don't know.").
- **A choice needs no confirm.** The person picked the answer's own words.
- **Nothing enters the profile before the confirm.** The server holds the pending reading and the reply's text; the conversation state doesn't see it.
- **A reading that was rejected** (`Reading.rejected`: an id the fact doesn't have, a truncated output) goes straight to "Which is closest?", saying "I couldn't tell from that."
- **If the model can't be reached** (connection failure, the cap reached, no key), the same: "I couldn't read that just now. Which is closest?" The reply's text is kept. The page works with no model.
- **The person's words are kept** for each answered question, for §5 and §6. A choice records no words.

### 4.2 Through the transport

`ChannelMessage` gains an optional `choices: { id: string; label: string }[]` (agent messages only), and an inbound message is text or `{ choice: id }`. The ledger's rules stay: nothing is accepted while `working`, and a choice must be one of the last agent message's choices, else `409 not-a-choice`. `src/transport/web/routes.ts` accepts `{ text }` or `{ choice }` on the existing messages route. The conversation service doesn't know it's a web page.

### 4.3 The service

`src/server/finder.ts`, a class holding one session per conversation id, in memory (OQ 11):
- the search request and the trials (searched once, with each trial's mappings);
- the `ConversationState`;
- per fact asked: the person's words, the reading, the confirmed answer;
- the pending reading;
- the model key the conversation started on (§8.3).

It drives the transport: delivers each question and confirm, takes each reply, calls `readReply` with the adapter from `src/server/models.ts`, and sets `working` while it reads.

## 5. The short list

### 5.1 The display model

`src/shortlist/explain.ts`, pure: `describeOrder(result, trials, vocabulary, answers) → OrderView`. The page lays it out and adds no words of its own about a trial. Every string is in one of two fields:
- **`ours`:** text this project writes;
- **`registry`:** the trial's words, verbatim (title, interventions, the quoted rule).

The verdict test (§7) scans `ours` only.

### 5.2 One trial

| Part | From | Example of what it says |
| --- | --- | --- |
| Title, NCT id, interventions | snapshot (`registry`) | |
| Phase, in plain words | `src/shortlist/phase.ts` (OQ 9) | "Phase 1: the first tests in people, mostly to find a safe dose and learn side effects." |
| Nearest site | search | "Northwestern Memorial, Chicago, IL: 3 miles" |
| Record flags | search's `flags` | "This record hasn't been updated in over a year. It may not be enrolling." |
| **How much was read** | mappings | "Its rules were read for 9 of the questions here." Or: "This tool couldn't read this trial's rules. Ask about it like any other." |
| **What your answers checked** (OQ 5) | `status.fits` | "Brain metastases: you said *'no, the scans were clear'*. Nothing in what was read of its rules conflicts with that." |
| **May not fit** | `status.hints`, `partHints` | "Your answer: had immunotherapy, and it grew." then the rule, quoted (`registry`), then "The reading of rules is automatic, and wrong about a quarter of the time. Ask your oncologist." Part hints add "for part of this trial: *appliesTo*". |
| **Still unknown** | `status.unknown`, without hinted facts | grouped by `whoKnows`: "You could find out", "Your oncologist would know", "In your records" |
| Link | NCT id | "The full record on ClinicalTrials.gov" (an `<a>`; the app makes no request) |

The short list's heading says what the order is: "Trials near you, with the fewest conflicts with your answers first, then *the order's next key, in words*." It never says "best" or "top matches".

Below it, "N more trials the search kept", in the same order, each with the same card.

### 5.3 Phase words

`PHASE_WORDS: Record<string, string>` for `EARLY_PHASE1`, `PHASE1`, `PHASE1+PHASE2`, `PHASE2`, `PHASE2+PHASE3`, `PHASE3`, `PHASE4`, `NA`. Written in this slice, and `docs/` says no clinician reviewed them. An unlisted combination reads "Phase: *as the registry gives it*."

## 6. The oncologist sheet (OQ 6)

`src/shortlist/sheet.ts`, pure: `oncologistSheet(...) → SheetView`, with the same `ours`/`registry` split.

1. **What this is.** "A list of trials to ask about, from a search of ClinicalTrials.gov and a short set of questions. It doesn't say whether any trial suits this person. Their oncologist and each trial's team decide." With the snapshot month.
2. **Their answers.** Each question asked; their words, or "chose from a list"; the answer they confirmed; "doesn't know".
3. **Questions that would settle the most trials.** `openQuestions` (0003), most trials first, with the count: "Was EGFR tested? 6 of these 10 trials ask."
4. **What to bring.** From the open questions' `whoKnows`: `records` facts give "biomarker report" or "pathology report" by fact (a fixed map in `sheet.ts`), `oncologist` facts give "notes on treatment so far". Each line names the questions it would answer.
5. **The trials.** For each on the short list: NCT id, title, phase, nearest site and miles, its "may not fit" rules in its words with the person's answer, and how much was read.
6. **Facts never asked of this person** (pregnancy for a man) appear nowhere.

**Complete by check:** `questions:eval` records `sheetMissing` per row and exits non-zero on any; `tests/` holds the same on the fixture. For every patient, every fact in a short-list trial's `unknown` is either an open question on the sheet or a hint shown on that trial, unless it's skipped for the person's sex.

## 7. Never a verdict

`src/shortlist/words.ts` holds `VERDICT_PATTERNS`, case-insensitive:

- `eligib`, `qualif`, `ineligib`;
- `you (fit|match)`, `fits you`, `good (fit|match|candidate)`, `strong (fit|match)`, `matches you`;
- `you should`, `you must`, `we recommend`, `recommended for you`, `consider joining`;
- `best (for you|option|match|trial)`, `top match`;
- `you can join`, `you are able to join`, `you'd be accepted`.

Held four ways:
- **`questions:eval`, over all 20 made-up patients:** each row records `verdictHits`, the `ours` strings of `describeOrder` and `oncologistSheet` that match a pattern, for the record and conversation arms. The run exits non-zero on any, and the committed result with `--check` makes the zero traceable. Here and not in `tests/`, because `tests/` doesn't load the real snapshot and stays under a second (plan, Context).
- **`tests/shortlist/verdict.test.ts`:** the same scan on the fixture's views, and every fixed page string in `src/web/copy.ts`. None matches. A second test shows each pattern catches a sentence written to break it.
- **`src/web/` writes no prose outside `copy.ts`:** a test reads the `.tsx` files' JSX text nodes and fails on any word-bearing literal not drawn from `copy.ts` or the views. A blunt rule, so the scan above can't be bypassed by writing words in a component.
- **The browser test** reads every screen's visible text, minus elements marked `data-registry`, against the same patterns.

## 8. Settings (OQ 7, 8)

Copied from the prescreening repository's slice 0017 (`src/server/settings.ts`, `src/server/models.ts`, `src/web/SettingsPage.tsx`, `e2e/settings.spec.ts`), with the screening and trial-read roles replaced by one: the reader.

### 8.1 Stored

`local/settings.json` (or `--settings-dir`), written 0600 in a 0700 directory, through a temporary file and a rename. It holds the choice (`omlx` or a provider and catalog model), the local model's address and name, keys by provider, and the cap. The saved file wins over the environment for the local model, field by field. A hosted key comes only from this file, never `.env` (`CLAUDE.md`). No route returns a key: the view type has no field for one, and shows `keyHint` (last four characters).

### 8.2 Routes

| Route | Does |
| --- | --- |
| `GET /api/settings` | the view: choice, providers, each key's hint, admitted models with prices, the cap, which models the reader was measured on |
| `PUT /api/settings` | change the choice, the local model or the cap |
| `PUT /api/settings/keys/:provider` | save a key |
| `DELETE /api/settings/keys/:provider` | remove it |
| `POST /api/settings/test` | one call to the chosen model, with a $0.01 cap: "It works" or the error, with the key redacted |
| `GET /api/settings/local-models` | what oMLX lists, for the model menu |

Writes require the page's own origin and a JSON body, as the prescreening repository's `ownOrigin` does.

### 8.3 Per conversation

- A conversation gets its own adapter from `createAppAdapter`, with a `BudgetPool` capped at the conversation cap: default **$0.10**, range $0.05 to $5 (OQ 8).
- It keeps the model it started on. Changing Settings affects the next conversation.
- At the cap, the next reply falls back to the fixed answers (§4.1), saying the cap was reached.
- What it spent is appended to `local/spend.jsonl` when it ends or is cleared.

### 8.4 Saying where answers go

While a hosted provider is chosen, beside every text box: "While *Anthropic* is chosen in Settings, what you type here is sent to *Anthropic*. Use made-up answers." With the local model: "Your answers stay on this computer. Use made-up answers."

### 8.5 Measured or not

Beside each confirm: "Read by *model*." plus, if no committed reads result names that model, "This model's readings haven't been measured." The measured list comes from the committed `evals/results/questions/reads/` held-out files, read by `scripts/app.ts` and passed to the server, since `src/` doesn't import `evals/`.

### 8.6 Gate 2: a hosted reading run (OQ 7)

`npm run questions:read -- --set heldout --model anthropic:claude-haiku-4-5` already exists. Dry, it prints the estimate. With the owner's go-ahead, it runs once with `--spend --max-usd 1`, writes `evals/results/questions/reads/heldout-claude-haiku-4-5-8cb01749.json`, and appends to `evals/results/spend.jsonl`. Same prompt, same 527 pairs, same grading as Gate 3 of 0003. Reported in `docs/questions.md` beside the local model, with what the provider doesn't accept (no seed). If the answer is no, every hosted model shows "unmeasured".

## 9. Server and page

### 9.1 Layout

```
src/server/
  start.ts       the one file that listens; LOOPBACK_HOST = "127.0.0.1"   (copied)
  app.ts         configureApp: routes for /api/info, /api/finder, settings, static files
  finder.ts      the conversation service (§4.3)
  models.ts      the one file naming createAppAdapter (§8.3)              (adapted)
  settings.ts    the settings store (§8.1)                                (adapted)
  index.ts
src/web/         React: main.tsx, App.tsx, SearchForm, Conversation, ShortList, TrialCard,
                 Answers, Sheet, SettingsPage, api.ts, copy.ts, styles.css
src/shortlist/   explain.ts, sheet.ts, phase.ts, words.ts (new, pure)
src/questions/   trials.ts (new): the search plus each trial's mappings, moved from
                 scripts/questions-eval.ts so the server needn't import a script
scripts/app.ts   npm run app: loads snapshot, mappings, vocabulary, settings, ZIPs; --fake
e2e/             Playwright specs
```

### 9.2 Routes beyond Settings

| Route | Does |
| --- | --- |
| `GET /api/info` | snapshot month, mapping run, the model in use, fake or not |
| `POST /api/finder` | `{ zip, radiusMiles, age, sex }` → `{ id }`, or 400 naming the field |
| `GET`/`POST /api/conversations/:id/messages`, `POST …/retry` | the transport's routes (§4.2) |
| `GET /api/finder/:id/view` | `{ order: OrderView, sheet: SheetView, answers, stopped }` |
| `PUT /api/finder/:id/answers/:factId` | `{ answer }`: change a confirmed answer (§1.6) |
| `POST /api/finder/:id/stop` | "show me the list now" |
| `DELETE /api/finder/:id` | start over |

The browser's requests are all in `src/web/api.ts` and `src/transport/web/client.ts`, by relative literal.

### 9.3 Loading

The server loads the snapshot, the vocabulary, the conversation settings and every mapping in the run named by `data/facts/<month>/latest` once at start, into memory. A search and its trials are built per conversation.

### 9.4 Fake mode

`--fake` gives the reader a `FakeModelAdapter` whose `respond` looks up the reply's exact text in the committed dev and held-out reads files and returns that reading, else `unknown`. Typing a made-up patient's reply gives the local model's committed reading of it, with no model running. Settings' test answers "scripted". The page says "Scripted reader: no model is called."

### 9.5 Logging

Fastify at `warn`, which logs no bodies. Nothing logs a reply, a reading or a key.

## 10. Tests

**`tests/` (deterministic, `npm test`):**
- **Conversation steps:** the stepwise form equals `runConversation` on the fixtures; `answer` refuses out-of-turn facts; `changeAnswer` and `stopNow` stop the chooser; `"person"` is a stop.
- **0003 unchanged:** `questions:eval -- --check` passes on every committed result, through the existing `tests/scripts/questions-eval-check.test.ts`.
- **Orders:** each order's keys pinned; `checked` puts a trial with more fits first among equals; no order drops a trial; full recount equals the shortcut under `hints`.
- **Display and sheet,** on the fixture: the verdict scan (§7), sheet completeness (§6), every candidate appears exactly once in `OrderView`, nothing skipped for the sex appears. Over all 20 patients, the verdict scan and sheet completeness run in `questions:eval` (§7), not here.
- **Server, in memory** (`app.inject`, `MemoryTransport`, a scripted reader; no `listen`):
  - a typed reply isn't in the profile until confirmed;
  - Change it gives the fixed answers, and a choice is taken without confirm;
  - a rejected reading, a model error and the cap each fall back to the fixed answers;
  - a choice not on the last message is refused;
  - on the fixture, answering every question by choice gives the same short list as `runConversation` (page parity; p08's parity on the real snapshot is browser case 2);
  - changing an answer reorders the view;
  - no response body ever holds a saved key;
  - writes from another origin are refused.
- **Settings:** copied from the prescreening repository's settings tests: file mode, atomic write, key hint, precedence, validation.
- **Boundaries** (§11).

**`e2e/` (`npm run test:e2e`, Playwright, against `npm run app -- --fake`, never `npm test`):**
1. Search form to first question; an unknown ZIP refused.
2. p08's typed replies through all questions, every reading confirmed, one changed by Change it; the short list's NCT ids equal `questions:try`'s for p08 with the committed dev reads.
3. "Show me the list now" after the intake.
4. Change an answer from Your answers; the list reorders.
5. The sheet: open questions present; Print button present; nothing skipped for the sex.
6. The verdict scan over every screen's visible text, outside `data-registry`.
7. Settings: copied case 11 (a key saved, shown by hint, tested, chosen, kept across a reload, removed, never in a response); the "sent to" note beside the text box while a hosted provider is chosen.

## 11. Boundaries

`tests/boundary.test.ts` changes, each visibly:
- **`createAppAdapter`** is named only in `src/server/models.ts` (`APP_MODELS`, as in the prescreening repository). `createAdapter` stays out of `src/` beyond `src/models/`.
- **Relative fetch:** `src/web/api.ts` joins `src/transport/web/client.ts` in `RELATIVE_FETCH_FILES`, and `src/web/main.tsx` is an entry point for the walk.
- **The page** imports no `node:` module and no `process`, and nothing under `src/` imports `src/web/`.
- **Message routes** (`/messages`, `/retry`) stay named only in the transport's two files.
- **Listening:** `src/server/start.ts` only, on `LOOPBACK_HOST`, unchanged.
- **`src/shortlist/`** (now including `explain.ts`, `sheet.ts`, `phase.ts`, `words.ts`) stays under the existing rule: no model, parser, screening agent, plain-language module or transport. The walk already covers every file in the directory.
- **`src/server/finder.ts`** may reach `src/questions/read.ts`, but not the factory; only `models.ts` builds adapters.
- **The browser test's command** passes `--fake` (copied from the prescreening repository's check on `playwright.config.ts`).
- **No test mocks a module or stubs a global**, unchanged: the server tests inject.

`CLAUDE.md`'s boundary paragraph names `src/server/models.ts` and `src/web/api.ts`.

## 12. Docs

- **`docs/page.md`** (new): what the page does and says, the confirm step, the order chosen and why, the words rule and its test, Settings and where answers go, measured models, limits.
- **`docs/questions.md`:** the order decision and held-out's rerun beside 0003's; the hosted reading if Gate 2 ran it.
- **README:** how to run the page, in two lines.
- **ROADMAP:** 0004 done; open question 5 answered as far as it is.
- **`CLAUDE.md`:** `npm run app`, `npm run test:e2e`; where `src/server/`, `src/web/` and `e2e/` live; the widened boundaries.

## 13. Out of scope

- Per-trial screening (0005), and reading more than one fact from one reply.
- A plain-language summary of each trial, which needs a model per trial and a check.
- Contacts from the registry: the snapshot doesn't keep them, and a new snapshot is a new measurement. The record's link stands in.
- Preferences (Phase 1, placebo, travel frequency), and base rates for the chooser.
- Saving conversations across a server restart, and accounts of any kind.
- Any cancer type but NSCLC on the page.
- Accessibility beyond semantic HTML, labelled controls and keyboard use. No audit.
