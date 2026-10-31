# plan: 0006 reader on hosted models

**Intent:** [intent.md](intent.md). **Spec:** [spec.md](spec.md). Spec sections are cited as §n.

## Context

On Claude Haiku 4.5 the reader could read 237 of 527 held-out replies, 45% (0004 Gate 2). 87 outputs were cut off at 64 tokens, 75 of them on "don't know" replies, and 203 calls failed because the output wasn't JSON `parseModelJson` accepts. What it read, it read right. The rest fall back to the buttons, so a person with Haiku chosen re-answers more than half the questions as choices.

The likely cause is the request: oMLX, OpenAI and xAI ask for a JSON object; the Anthropic adapter asks for nothing. Haiku 4.5 supports structured outputs (`output_config.format`, a JSON schema). This slice lets a request carry its answer's schema, has the Anthropic adapter send it, has the reader give one, and measures Haiku again on the same pairs: once on dev, and once on held-out, each after the owner's go-ahead. The prompt's words don't change, so the local model's readings and every committed result stand. `json.ts` stays strict.

What exists to build on:
- **`src/models/types.ts`** `CompletionRequest`, `ModelDescriptor` (with `thinking`, `unset`, `seedGuarantee` as precedents for recording what defines a run).
- **`src/models/catalog.ts`** `CatalogEntry`, `descriptorFor` (every hosted adapter's descriptor, batch included).
- **`src/models/anthropic.ts`** `anthropicBody`, shared by `anthropic-batch.ts`; `readAnthropicMessage`.
- **`src/models/budget.ts`** passes the request through unchanged and copies the inner descriptor.
- **`src/questions/prompt.ts`** `READER_SYSTEM_PROMPT`, `buildReaderPrompt`, `READER_LAYOUT`, `READER_PROMPT_VERSION` (`8cb01749dcc3`); **`src/questions/read.ts`** `readReply` and its rejections.
- **`scripts/questions-read.ts`** `readsPath`, `readAll` (resumes a file, keeps failure reasons since `2def7f2`), `formatGrade`, the dry-by-default path through `planPaidRun` and `logSpend` (`scripts/lib/model-flags.ts`, defaults `--max-calls 100`, `--max-usd 1`).
- **`evals/questions/reads.ts`** `pairsFor`, `gradeReads`, `wilson` intervals.
- **`scripts/app.ts`** `measuredModels` (reads every `heldout-*` file, keyed by model, no prompt filter) and `scriptedReader` (reads every file ending `-8cb01749.json`, Haiku's included).
- **Tests:** `tests/models/anthropic.test.ts` (body pinned with `toEqual`), `anthropic-batch.test.ts`, `chat-providers.test.ts`, `omlx.test.ts`, `catalog.test.ts`, `tests/questions/read.test.ts`, `tests/scripts/questions-read.test.ts`, `tests/scripts/app.test.ts` (reads the committed reads files).
- **Committed:** `evals/results/questions/reads/heldout-claude-haiku-4-5-8cb01749.json` (0004), `heldout-qwen3.6-35b-a3b-mlx-8bit-8cb01749.json`, `dev-qwen…-8cb01749.json`; `evals/results/spend.jsonl`.

## Order of work

### Stages and gates

| Stage | Steps | Ends at | What you can see at the end |
| --- | --- | --- | --- |
| **A. The request and the reader** | 1–4 | **Gate 1** | the schema in the Anthropic body, the reader's schema, the new file naming, both dry estimates; every `--check` unchanged |
| **B. Dev, on Haiku** | 5–6 | **Gate 2** | the dev grade against the bar, every failure and rejection with its reason, the held-out estimate |
| **C. Held-out, on Haiku** | 7 | — | the held-out grade beside 0004's run and the local model's; Settings' measurement |
| **D. Written up** | 8–9 | PR | docs, roadmap, review passes |

**Gate 1: spend on dev, and freeze the bar?** (§5.1, §5.2, OQ 2)
- **What's decided:**
  - whether `questions:read --set dev --model anthropic:claude-haiku-4-5 --spend --max-calls 150 --max-usd 0.10` runs once;
  - the bar for spending held-out (§5.2), frozen here, before any schema-constrained output is seen.
- **What the owner sees:** `work/0006-hosted-reader/gate-1-spend.md`: the dry estimates for dev and held-out; the Anthropic body with and without a schema, from the test; the reader's schema for one fact; the bar.
- **What it costs to be wrong:**
  - money, a few cents, and not mine to spend;
  - a bar chosen after seeing dev would be tuned to pass it, and the held-out look it buys is the only one.
- **Can be no:** no dev run. Stage A's code still lands; Haiku reads "unmeasured" in Settings until someone measures it, and the PR says so.

**Gate 2: spend held-out's one look?** (§5.2, §5.3, OQ 1)
- **What's decided:** one of
  - **run held-out:** `questions:read --set heldout --model anthropic:claude-haiku-4-5 --spend --max-calls 600 --max-usd 0.50`, once;
  - **revise first:** a prompt revision tuned on dev, or a higher `maxOutputTokens`, within Gate 1's cap (the contingency below), then Gate 2 again;
  - **stop:** the slice ships stage A and the dev finding, and Haiku stays unmeasured.
- **What the owner sees:** `gate-2-dev.md`:
  - the dev grade against the bar: read at all, exact, wrong, invented, cut off, failed;
  - each failure and rejection with its reason and the reply;
  - 0004's held-out failure counts beside them, for what the cause looked like then;
  - the held-out dry estimate.
- **What it costs to be wrong:**
  - held-out is read once, and anything changed after it is tuned on it;
  - running held-out on a request that still fails spends the look on a known failure; a revision the dev result didn't need changes `READER_PROMPT_VERSION` and costs a local reread of both sets.
- **Can be no:** "revise" or "stop", above.

Stage C needs no gate: the bar decided whether to look, and the result is reported whatever it is. If held-out reads worse than dev suggested, that's a finding for the PR and the docs; reverting the schema request is the owner's call at PR review. Stage D ends in documentation.

**Contingency, only if Gate 2 says "revise":** a stage B′ between B and C.
- Each prompt revision is one commit: `READER_SYSTEM_PROMPT` or `READER_LAYOUT` changes, so `READER_PROMPT_VERSION` changes, and the plan's Records say why.
- Each is run on dev on Haiku under Gate 1's cap (a new file per version, as today), and on dev on the local model (no spend).
- Before Gate 2 is asked again, the local model rereads held-out under the adopted version (`questions:read --set heldout`, no spend, the owner's local model running), reported beside its `8cb01749` numbers.
- A higher `maxOutputTokens` alone changes neither the prompt version nor the local model's numbers.
- This plan is updated in the same commit as the first B′ step, with its steps written out.

### Steps

Each step is one commit, through `npm run check && git commit`. No commit carries a Co-Authored-By trailer. No test mocks a module or stubs a global.

**Stage A: the request and the reader**

1. **Commit intent, spec and this plan.** Record the baseline in Records: `npm run check` exit 0, test count, `npm test` time; and that `search:eval -- --check`, `questions:eval -- --check` and `-- --check --dev`, `other:eval -- --check` and `-- --check --dev`, and `facts:eval -- --check` pass on `main`.

2. **A request can carry a schema** (§2).
   - `src/models/types.ts`: `JsonSchema` (a plain object type: `type`, `properties`, `required`, `enum`, `items`, `additionalProperties`), `CompletionRequest.schema?: JsonSchema`, `ModelDescriptor.schema?: "enforced"`, each with a comment in the file's style.
   - `src/models/catalog.ts`: `CatalogEntry.schema: "enforced" | null`, `"enforced"` on both Anthropic entries, `null` on OpenAI and xAI; `descriptorFor` adds `schema: "enforced"` when set.
   - `src/models/anthropic.ts` `anthropicBody`: adds `output_config: { format: { type: "json_schema", schema } }` only when `request.schema` is present. Check the field names against the live structured-outputs docs while writing; the fixture's response is a normal text message.
   - `src/models/index.ts`: export `JsonSchema`.
   - Tests:
     - `anthropic.test.ts`: the existing body test is unchanged (no schema, byte for byte); a new case with a schema has `output_config.format`; the descriptor says `schema: "enforced"`.
     - `anthropic-batch.test.ts`: a batched request with a schema carries it in `params`.
     - `chat-providers.test.ts`, `omlx.test.ts`: a request with a schema produces the same body as without one.
     - `catalog.test.ts`: every Anthropic entry enforces, no other does.
   - **Proof of no change:** every `--check` in step 1 passes.

3. **The reader gives its schema** (§3).
   - `src/questions/prompt.ts`: `readerSchema(fact): JsonSchema`, `answer` an enum of the fact's ids and `"unknown"`, `required: ["answer"]`, `additionalProperties: false`. The comment says it isn't part of the prompt's hash, and why: an adapter that ignores it sees exactly the old request.
   - `src/questions/read.ts`: `readReply` passes `schema: readerSchema(fact)`. Its checks stay; the module comment gains a line on the schema.
   - Tests, `tests/questions/read.test.ts`:
     - the request carries the fact's schema (the fake adapter records requests);
     - `readerSchema` lists the fact's ids and `"unknown"`, nothing else;
     - an id the fact lacks still reads as unknown with its reason;
     - `READER_PROMPT_VERSION` is still `8cb01749dcc3`, pinned so a later edit to the prompt is a visible test change.
   - Settings' Test (`testConnection`) goes through `readReply`, so it sends the schema with no change; `tests/server/models.test.ts` runs as it is.

4. **Runs record the schema, and the page reads the matching file** (§4, §6, OQ 7).
   - `scripts/questions-read.ts`:
     - `readsPath(set, descriptor, dir)` (or a `schema` argument): `-schema` after the prompt hash when the descriptor enforces it. `main` passes `adapter.descriptor`.
     - The run record already spreads the descriptor, so it carries `schema: "enforced"` with no other change.
     - `formatGrade` gains a first line, "Read at all: n of N" counting failures in N, and `readAll`'s caller prints failures and rejections counted by reason.
   - `scripts/app.ts`:
     - `measuredModels`: only `heldout-*` files whose `run.promptVersion` is the current `READER_PROMPT_VERSION`, and whose `run.schema` matches what the catalog says that model's adapter sends (`catalogEntry(run.adapter, run.model)?.schema ?? null`; oMLX files have none and match `null`). Two files left for one model is an error, not a silent pick.
     - `scriptedReader`: only files whose `run.adapter` is `omlx`, as its comment already says.
   - Tests:
     - `questions-read.test.ts`: `readsPath` adds `-schema` only for an enforcing descriptor; a run with the schema never opens 0004's file name.
     - `app.test.ts`: on the committed files, the local model's measurement is unchanged and Claude Haiku 4.5 has none (0004's file was a request without the schema). Two new cases on a temporary directory of made-up reads files: the matching file is chosen when one model has two; `scriptedReader` ignores a hosted file whose readings differ.
   - `npm run test:e2e` passes (`--fake` reads the same local readings as before).
   - Print both dry runs (no `--spend`) and write `gate-1-spend.md`. **Stop at Gate 1.**

**Stage B: dev, on Haiku**

5. **The dev run,** with the owner's go-ahead: the command in Gate 1, exactly as approved. Commit `evals/results/questions/reads/dev-claude-haiku-4-5-8cb01749-schema.json` and the spend line. If the first call is refused as a bad request (field names), fix step 2's body in its own commit, record it, and run again under the same go-ahead; a 400 costs nothing.

6. **`gate-2-dev.md`,** from the file and the printed grade, as Gate 2 lists, and the held-out dry estimate. **Stop at Gate 2.**

**Stage C: held-out, on Haiku**

7. **The held-out run,** if Gate 2 says so: the command in Gate 2, once. If it stops part-way it resumes into the same file. Commit `heldout-claude-haiku-4-5-8cb01749-schema.json` and the spend line. `app.test.ts`'s Haiku expectation becomes the new file's measurement. 0004's file stays committed and unread by the page.

**Stage D: written up**

8. **Docs** (§10).
   - `docs/questions.md`: "On a hosted model" gains the schema request, the dev and held-out runs, and the table in §5.4 with intervals and spend; `json.ts` unchanged; the two figures on 0004's gate page that don't match the file, corrected by quoting the file. Limits: one hosted model measured, on clean replies.
   - `docs/page.md`: Settings' "measured" means the request the app sends now.
   - `work/ROADMAP.md`: 0006 **Done**, with its measure.
   - `CLAUDE.md`: one clause in "Model access": a request may carry a schema, which the Anthropic adapter enforces and the others ignore.
   - The README doesn't change.

9. **Review passes** (`REVIEW.md`), recorded in Records.

## Files that change

**New:**
- `evals/results/questions/reads/dev-claude-haiku-4-5-8cb01749-schema.json`, `heldout-claude-haiku-4-5-8cb01749-schema.json` (if the gates say so);
- `work/0006-hosted-reader/{plan,gate-1-spend,gate-2-dev}.md`.

**Changed:**
- `src/models/{types,catalog,anthropic,index}.ts`;
- `src/questions/{prompt,read}.ts`;
- `scripts/questions-read.ts`, `scripts/app.ts`;
- `tests/models/{anthropic,anthropic-batch,chat-providers,omlx,catalog}.test.ts`, `tests/questions/read.test.ts`, `tests/scripts/{questions-read,app}.test.ts`;
- `evals/results/spend.jsonl` (appended by the runs);
- `docs/questions.md`, `docs/page.md`, `work/ROADMAP.md`, `CLAUDE.md`.

**Not touched:**
- `src/models/json.ts`, `omlx.ts`, `frontier-chat.ts`, `openai.ts`, `xai.ts`;
- the prompt's text and layout (unless the contingency runs);
- the mapper, the parser, the screening agent, the search, the mark, the patients, every committed result;
- `.env`.

**No new dependency.**

## Reused, not rebuilt

- **Recording what defines a run:** `ModelDescriptor`'s optional fields and `descriptorFor`, so the schema flag reaches every result and the budget wrapper with no new plumbing.
- **One body for direct and batch:** `anthropicBody`.
- **Paid runs:** `planPaidRun`, `logSpend`, the budget wrapper's call and dollar caps; `readAll`'s resume and failure reasons.
- **Grading:** `gradeReads` and `wilson`; `formatGrade` extended, not replaced.
- **The page's measurement:** `measuredModels` and `Measurement`, narrowed to the right file.

## Risks

- **The body is wrong.** Structured outputs is newer than the adapter's fixtures. A wrong field is a 400 on the first dev call, not retried and not billed; step 5 fixes it in its own commit.
- **A forced enum could raise inventions.** With "unknown" in the enum the model can still decline, but it can no longer explain. The bar counts every invention on dev, and held-out reports them with intervals.
- **Hidden tokens.** Structured outputs adds input the estimate doesn't count. The caps (`$0.10`, `$0.50`) are several times the expected spend.
- **Committed-file tests move twice.** `app.test.ts` reads committed reads files: Haiku goes unmeasured at step 4 and measured at step 7. Each change is in the commit that causes it.
- **Haiku unmeasured between steps 4 and 7.** True to what the app sends; if Gate 2 stops, the docs say why.
- **Held-out patients' replies, a third reading.** Read once on Haiku with the schema, after the bar was frozen; reported beside the two earlier readings, never replacing them.
- **The API version.** The adapter pins `2023-06-01`, which accepts both structured outputs and `temperature: 0`. `2026-10-21` rejects `temperature`, so moving the version is a separate change; noted, not done here.
- **Dev is small.** 93 replies. The bar decides whether to look, not what the result is.

## Verification

- `npm run check` exits 0 at every commit.
- Every `--check` in step 1 passes at steps 2, 3, 4 and 7.
- `npm run test:e2e` passes at step 4 and after step 7.
- The dry runs at step 4 print an estimate and exit without calling anything.
- By hand, optional and the owner's to spend: with Haiku chosen and a key saved, Settings' Test reads "yes" for its made-up reply, about a cent.

## Records

- **Step 1, baseline** (on `main` at `07539db`):
  - `npm run check` exits 0; 1,070 tests (1,062 passed, 8 expected to fail); `npm test` about 0.7 s.
  - `search:eval -- --check`, `questions:eval -- --check` and `-- --check --dev`, and `facts:eval -- --check` pass.
  - **`other:eval -- --check` and `-- --check --dev` fail on `main`**, both with "labelsSha256 differs" and nothing else. 0005's step 11 added the `places-other-last` set to `evals/cases/search/nsclc-other.json` after step 9 wrote the results, so the label file's checksum moved. 0005's Records say these checks passed. It isn't this slice's to fix: it's 0005's result, and this slice touches neither the labels nor the check. At each step below, "unchanged" for these two means the same single difference, and nothing else.
- **Step 2:**
  - Checked against the live structured-outputs page: `output_config: { format: { type: "json_schema", schema } }`, no beta header, Haiku 4.5 supported, examples on `anthropic-version: 2023-06-01`, and `additionalProperties: false` required on every object.
  - `JsonSchema` and `CompletionRequest.schema` in `types.ts`; `ModelDescriptor.schema` and `CatalogEntry.schema`, put on the descriptor by `descriptorFor`, so the batch adapter and the budget wrapper carry it with no other change.
  - The descriptor pin in `anthropic.test.ts` ("keeps the key out of the descriptor") gains `schema: "enforced"`: the record grows by a field, nothing is loosened.
  - A schema changes a batched request's `custom_id`, so a ledgered result for one request is never collected for the other; tested.
  - 1,076 tests (1,068 passed, 8 expected to fail). Every `--check` as at step 1.
- **Step 3:**
  - `readerSchema(fact)` in `prompt.ts`, passed by `readReply` on every reading. `READER_PROMPT_VERSION` stays `8cb01749dcc3`, now pinned by a test.
  - Settings' Test (`testConnection`) reads through `readReply`, so it carries the schema with no change of its own; `tests/server/models.test.ts` passes as it was.
  - 1,080 tests (1,072 passed, 8 expected to fail). Every `--check` as at step 1.
- **Step 4:**
  - `readsPath(set, run, dir)` takes the descriptor's `model` and `schema`; a run that enforced the schema is `…-8cb01749-schema.json`. The run record carries `schema: "enforced"` through the descriptor, with no other change.
  - `formatGrade` leads with "Read at all: n of N", counting failed pairs in N. `formatUnusable` prints each rejection reason with its count, then each failed pair with its reason. Both are printed at the end of a run.
  - `scripts/app.ts`: `measuredModels` and `scriptedReader` share `readsOnCurrentPrompt`, which filters on the run record's `promptVersion` rather than the file's name.
    - `measuredModels` keeps a held-out run only when its schema flag matches the catalog's for that model; two such runs for one model throw.
    - `scriptedReader` reads only files whose run's adapter is `omlx`.
  - **Claude Haiku 4.5 is unmeasured in Settings from this commit** until a held-out run with the schema is committed: `app.test.ts` says so on the committed files.
  - 1,084 tests (1,076 passed, 8 expected to fail). `npm run test:e2e`: 7 passed. Every `--check` as at step 1.
  - **The dry runs**, nothing sent:
    - dev: 93 calls, about $0.045 expected; at most $0.10 under `--max-calls 150 --max-usd 0.10`.
    - held-out: 527 calls, about $0.26 expected; at most $0.48 under `--max-calls 600 --max-usd 0.50`.
    - The estimate counts about twice the input tokens 0004's run used (224,814 against 107,294 on the same 527 pairs), as the estimates are written to.
  - `gate-1-spend.md` written. **Stopped at Gate 1.**
- **Gate 1, as answered** (owner, 2026-10; `gate-1-spend.md`): as recommended. One dev run under `--max-calls 150 --max-usd 0.10`, and the bar frozen as written in §5.2.
- **Step 5:**
  - The dev run, as approved at Gate 1: `dev-claude-haiku-4-5-8cb01749-schema.json`, 93 calls in 79 s, **$0.052**, no retries and no 400. The run record says `schema: "enforced"`.
  - **Read at all: 93 of 93.** Replies stating an answer: 53 of 54 exact, 1 wrong. "Don't know" replies: 0 of 39 invented. No failures, no rejections.
  - **The one wrong reading:** p11 `lines_advanced`, "One, the radiation with chemo and then the Imfinzi.", read as "two" where the reply says "one". The local model read it as "one".
  - **Input per call is about 2.5 times 0004's:** 47,266 input tokens for 93 calls, about 508 each, against about 204 each in 0004's held-out run. Structured outputs adds about 300 tokens a call that the estimate doesn't count. Held-out at that rate is about $0.30, under its $0.50 cap.
  - **Against the frozen bar, criterion 2 fails:** one reply stating an answer was read as a different answer. Criteria 1 and 3 pass.
- **Step 6:** `gate-2-dev.md` written. It says the dev run fails the frozen bar on criterion 2, and recommends overturning that criterion and running held-out once; stopping is the frozen rule's answer. **Stopped at Gate 2.**
