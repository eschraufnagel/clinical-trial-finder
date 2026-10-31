# spec: 0006 reader on hosted models

**Status:** Draft
**Date:** 2026-10
**Intent:** [intent.md](intent.md). Open questions are cited as OQ n.

This spec says what the request carries, what the reader asks for, how a run records it, which file the page reads, and how the two hosted runs are gated and reported. Each answer to an open question is a proposal, and says where a gate can overturn it.

---

## 1. What changes for a person

- **With Claude Haiku 4.5 chosen,** a typed reply is read far more often, if the runs bear this out. Each reading is still confirmed before it counts, and a reply that can't be read still falls back to the buttons.
- **Settings shows Haiku's new measurement,** from the new held-out run, and the readable share it shows is the one the app's request now gets.
- **With the local model chosen, nothing changes.** Same prompt, same request, same readings.
- **No words on the page change,** unless the measurement line needs to (§7).

## 2. The request carries a schema

### 2.1 `CompletionRequest`

`src/models/types.ts` gains one optional field:

```ts
/**
 * The exact shape of the JSON answer, when the caller knows it. An adapter
 * whose provider can enforce a schema sends it; others ignore it. Either way
 * the answer is still parsed by `parseModelJson` and checked by the caller.
 */
schema?: JsonSchema;
```

- **`JsonSchema`** is a plain JSON-schema object type in `src/models/types.ts`, no library: `type`, `properties`, `required`, `enum`, `additionalProperties`, and nothing the reader doesn't use.
- **Callers that don't give one send exactly today's request.** The mapper, the parser, the screening agent and Settings' smoke paths don't change. A test pins the Anthropic body without a schema byte for byte against today's.
- **`responseFormat: "json"` stays.** A schema narrows JSON; it doesn't add a mode.

### 2.2 The Anthropic adapter

`anthropicBody` adds, only when the request has a schema:

```json
"output_config": { "format": { "type": "json_schema", "schema": <the schema> } }
```

- **The batch path** shares `anthropicBody`, so it carries the schema too, unchanged in shape.
- **The API version stays `2023-06-01`.** Structured outputs work on it. (The `2026-10-21` version rejects `temperature`; this adapter sends `temperature: 0` for Haiku 4.5, so moving the version is its own change, not this slice's.)
- **Recorded responses for tests** come from the provider's documentation of structured outputs, as the adapter's other tests do. The exact field names are checked against the live docs when step 2 is written, and the dev run (§5) is their first live test.
- **A refusal or a cut-off** is handled as today: `refusal` throws, `max_tokens` returns `finishReason: "length"`.

### 2.3 The descriptor says the schema is enforced

`ModelDescriptor` gains `schema?: "enforced"`, present on an adapter that sends a request's schema to its provider: Anthropic, in this slice. Absent means a schema is ignored.
- It's part of what defines an experiment, like `thinking`: Haiku constrained to a schema and Haiku asked in words are different systems, and a result must say which.
- **The catalog** gains the same fact per entry (`schema: "enforced" | null`), so the server can tell, before building an adapter, which measurement matches what the app would send (§6).

### 2.4 Other adapters (OQ 3)

**(OQ 3)** oMLX, OpenAI and xAI ignore the schema in this slice and keep `response_format: { type: "json_object" }`.
- oMLX unchanged keeps the local model's readings, and so every committed local result, valid.
- OpenAI and xAI aren't smoke-tested, and no run here measures them. Sending the schema to them, as `response_format: { type: "json_schema", … }`, is a later change, measured when one of them is.
- A test holds each of the three bodies unchanged when a schema is given.

## 3. The reader asks for its answer's shape

### 3.1 The schema

`src/questions/prompt.ts` gains `readerSchema(fact)`:

```json
{
  "type": "object",
  "properties": { "answer": { "type": "string", "enum": ["<each answer id>", "unknown"] } },
  "required": ["answer"],
  "additionalProperties": false
}
```

- Built from the fact, so each of the 31 facts has its own enum. The provider compiles each schema once and caches it.
- `readReply` passes it on every call.

### 3.2 What doesn't change

- **The prompt's text and layout.** `READER_SYSTEM_PROMPT`, `buildReaderPrompt` and `READER_LAYOUT` stay, so `READER_PROMPT_VERSION` stays `8cb01749`. The prompt still ends "Return JSON only: …", which is right for models that don't enforce a schema.
- **`readReply`'s checks.** A truncated output, an answer that isn't a string, or an id the fact doesn't have still reads as unknown with the reason. The schema makes the last two unlikely, not impossible to code around.
- **`maxOutputTokens: 64`.** A schema-constrained answer is about ten tokens. If the dev run shows cut-offs anyway, Gate 2 can raise it, which is a run-time setting and doesn't change the prompt's version.
- **`json.ts`.** It forgives nothing new (intent, Constraints).

### 3.3 If the request isn't enough (OQ 1)

**(OQ 1)** The prompt is revised only if Gate 2 calls for it. Then:
- each revision is a new `READER_PROMPT_VERSION`, tuned on dev only, within the dev go-ahead's cap;
- the local model is reread on dev and then held-out under the new version (no spend), and both reported beside its `8cb01749` numbers;
- the app uses the new version for every model, so the page has one reader.

That would add a stage and a held-out reading by the local model. The plan carries it as a contingency, not a step.

## 4. A reading run records the request's shape

`scripts/questions-read.ts`:
- **The file's name** gains `-schema` when the adapter enforces the schema: `heldout-claude-haiku-4-5-8cb01749-schema.json`. A file without it is a run without one. 0004's `heldout-claude-haiku-4-5-8cb01749.json` is never opened by the new run, so it's neither resumed nor overwritten.
- **The run record** carries `schema: "enforced"` from the descriptor.
- **Every failure keeps its reason** (already, since `2def7f2`). The grade printed at the end, and the gate pages, count failures and rejections by reason.
- **A new summary line:** replies read at all, of all pairs, which is the roadmap's "share read", beside the existing exact, lost, wrong and invented rates.

## 5. The runs, and their gates

Both on `anthropic:claude-haiku-4-5`, temperature 0, no seed (the Claude API has none), reasoning off, prompt `8cb01749`, schema enforced. Each is printed dry first, and run with `--spend` only after the owner's go-ahead.

### 5.1 Dev (Gate 1)

```
npm run questions:read -- --set dev --model anthropic:claude-haiku-4-5 --spend --max-calls 150 --max-usd 0.10
```

- 3 dev patients × 31 facts = 93 pairs. Expected about $0.03, from 0004's held-out spend per call ($0.15 for 527).
- A run that fails part-way resumes; the cap covers retries, which the budget counts as calls.

### 5.2 The bar for held-out (OQ 2)

**(OQ 2)** Held-out's one look is spent only if, on dev:
- at least 90% of the 93 replies are read at all (not failed, not cut off);
- no reply stating an answer is read as a different answer;
- no "don't know" reply is read as an answer.

Gate 2 sees every failure and rejection with its reason. Below the bar, the gate chooses: a prompt revision on dev (§3.3), a raised `maxOutputTokens`, or stopping with the dev finding. The gate can also overturn the bar itself, in the gate page where it can be argued with, before held-out is run.

The bar is set against 93 replies, so it's coarse: 90% of 93 is 84. It decides whether to look, not what the result is.

### 5.3 Held-out (Gate 2)

```
npm run questions:read -- --set heldout --model anthropic:claude-haiku-4-5 --spend --max-calls 600 --max-usd 0.50
```

- 527 pairs, the same as 0004's run and the local model's. Expected about $0.15 to $0.20; structured outputs may add input tokens per call, which the cap absorbs.
- Run once. If it stops part-way (budget or provider), it resumes into the same file; nothing is rerun from scratch, and nothing is tuned after it.

### 5.4 What's reported

In `docs/questions.md`, beside 0004's Haiku run and the local model, on the same 527 pairs:

| | Local | Haiku, 0004 | Haiku, schema |
| --- | ---: | ---: | ---: |
| Replies read at all | | 237 of 527 | |
| Replies stating an answer, read exactly, of all 326 | 326 | 217 | |
| … of those read | | 217 of 217 | |
| "Don't know" replies read as an answer, of those read | 1 of 201 | 0 of 20 | |
| Cut off | 0 | 87 | |
| Failed, by reason | 0 | 203 | |

With Wilson intervals, as `gradeReads` gives, and the run's spend.

## 6. Which file the page reads

`scripts/app.ts`:
- **`measuredModels`** picks, per model, the held-out file on the current `READER_PROMPT_VERSION` whose schema flag matches what the catalog says that model's adapter sends. For Haiku after this slice, that's the `-schema` file. With two files for one model today, the map keeps whichever was read last; the fix makes the choice explicit, and a test holds it with two files for one model.
- **Before the held-out run** there is no `-schema` file, so Haiku reads "unmeasured" between stage A and the run. That's true: the request the app sends hasn't been measured. If Gate 2 says no to held-out, Haiku stays unmeasured, and the docs say why.
- **(OQ 7) `scriptedReader`** for `--fake` reads the local model's files only, by the run record's adapter (`omlx`), not every file on the current prompt. Today Haiku's readings are loaded and then overwritten by the local model's because `heldout-q…` sorts after `heldout-c…`. A test holds it with a hosted file present.

## 7. Settings' words

The measurement line (`src/web/copy.ts`, `SettingsPage.tsx`) already shows readable, exact and invented shares. No change is proposed. If the held-out run reads nearly everything, the line reads as it does for the local model. If the "unmeasured" interval (§6) needs a word, it uses the existing `unmeasured` sentence.

## 8. What isn't done (OQ 4, OQ 5, OQ 6)

- **(OQ 4)** No new catalog entry. Haiku 4.5, as 0004's Gate 2 chose.
- **(OQ 5)** No conversation rerun from Haiku's readings. `questions:eval -- --reads <file>` would run it with no spend, for anyone who wants it later.
- **(OQ 6)** None of 0005's leftovers: the `inclusionSection` nit, the 14 unmarked held-out trials, NCT03947385. Each changes the frozen check or needs a model to read rules, and each would spend a held-out look of its own. The roadmap's open question 6 keeps them; this slice adds nothing to it.

## 9. Tests

All deterministic, no network, no model:
- the Anthropic body with a schema has `output_config.format`, and without one is byte for byte today's;
- the batch body carries the schema the same way;
- oMLX, OpenAI and xAI bodies are unchanged when a schema is given;
- `readerSchema` for a fact lists its ids and "unknown", and nothing else;
- `readReply` passes the schema; its rejections are unchanged (a fake adapter returning an id the fact lacks still reads unknown);
- `readsPath` adds `-schema` only for an enforcing descriptor; a run never opens a file with the other flag;
- `measuredModels` picks the matching file when one model has two;
- `scriptedReader` ignores a hosted model's file;
- the descriptor and catalog say `schema: "enforced"` for Anthropic only.

Every `--check` passes unchanged: `search:eval`, `questions:eval` (held-out and `--dev`), `other:eval`, and `facts:eval`.

## 10. Docs and roadmap

- **`docs/questions.md`:** "On a hosted model" gains the new run, the table in §5.4, what the schema is, and that `json.ts` didn't change. Limits gain: one hosted model measured; the replies are clean by construction, as for the local model.
- **`docs/page.md`:** a line in Settings on what "measured" means for a hosted model (the request the app sends), if it doesn't already say so.
- **`work/ROADMAP.md`:** 0006 **Done**, with its measure filled in.
- **`CLAUDE.md`:** the schema field in "Model access" if the plan finds it needs a line; nothing else.
- **The README** doesn't change: it reports no findings.
