# plan: 0004 shortlist and handoff

**Intent:** [intent.md](intent.md). **Spec:** [spec.md](spec.md). Spec sections are cited as §n.

## Context

0003 left the conversation behind a terminal command, run with every answer known in advance. 0004 puts it on a local page: a search form, one question at a time in free text, each reading confirmed (0003 Gate 3), a short list with what's known and unknown, an oncologist sheet, and Settings for the local model or a hosted one. Before the page is built on it, the order is reconsidered, because "fewest hints first" puts the trials the mapper read least at the top (0003 Gate 2).

What exists to build on:
- `src/questions/conversation.ts` `runConversation` (one call, synchronous `answer` callback), `openQuestions`; `src/questions/select.ts` `nextQuestion`, `rank`, `shortlistChange` (shortcut that relies on answers only moving trials down); `src/questions/read.ts` `readReply`; `src/shortlist/order.ts` `ORDER_KEYS`, `orderTrials`.
- `scripts/questions-eval.ts` `loadContext`, `trialsFor`, `settingsForCheck`, and `--check`, which reruns committed results row for row.
- `src/models/factory.ts` `createAppAdapter`, `src/models/keys.ts` `keyHint`, `withSavedKeys`, `src/models/budget.ts` `BudgetPool`, `src/models/fake.ts` `FakeModelAdapter` (with `respond`).
- `src/transport/` ledger, rules, memory and web transports, routes and client, all text-only.
- The prescreening repository (`../trial-prescreening-agent`) has the page stack this slice copies: `src/server/{start,app,settings,models}.ts`, `src/web/SettingsPage.tsx`, `vite.config.ts`, `tsconfig.web.json`, `playwright.config.ts`, `e2e/settings.spec.ts`, `tests/server/settings.test.ts`, and its boundary tests for `createAppAdapter` and `--fake`.

### One change to the spec, made in step 1

`tests/` must stay under a second, and no current test loads the real snapshot. So the checks spec §7 and §10 put "over all 20 patients" move into `questions:eval`: each row records `verdictHits` and `sheetMissing`, the run fails if either is non-zero, and the committed result plus `--check` makes them traceable. `tests/` runs the same checks on the small fixture in `tests/questions/fixture.ts`. The p08/p17 page-parity check moves from `tests/` to the browser test (case 2) and a fixture parity test. Step 1 edits spec §6, §7 and §10 to say this.

## Order of work

### Stages and gates

| Stage | Steps | Ends at | What you can see at the end |
| --- | --- | --- | --- |
| **A. Groundwork** | 1–3 | — | the conversation as steps; 0003's results rerun unchanged on it |
| **B. The order** | 4–5 | **Gate 1** | three orders on dev, side by side, with read ratio, unread places, would-flag, miles |
| **B′. Held-out** | 6 | — | held-out rerun once with the chosen order, beside 0003's |
| **C. Words and sheet** | 7–8 | — | the short list and sheet as text, checked for verdicts and completeness over all 20 patients |
| **D. Server, Settings, page** | 9–13 | **Gate 2**, **Gate 3** | `npm run app` and `npm run app -- --fake` |
| **E. Pinned and written up** | 14–17 | PR | browser test, hosted reading (if Gate 2 says so), docs, review passes |

**Gate 1: which order does the page use?** (§2.5, OQ 1)
- **What's decided:** `hints`, `checked` or `read-first`, written into `conversation.json` as `"order"`.
- **What the owner sees:** `work/0004-shortlist-handoff/gate-1-order.md`. For each order on dev: read ratio, unread places, would-flag, median miles, agreement, follow-ups and "don't know"s. For p08, p11 and p17, the three short lists side by side with each trial's mapping count and miles.
- **What it costs to be wrong:**
  - held-out is rerun once with this choice, and can't be rerun again cleanly;
  - every number in `docs/page.md` and the browser test's expected list follow from it;
  - an order that keeps under-read trials on top tells a person "nothing against these" where nothing was read.
- **Can be no to all three:** if none moves the read ratio meaningfully, keep `hints`, and the page's "how much was read" line on every card (§5.2) carries the explanation. That's written up as the finding.

**Gate 2: spend on a hosted reading run?** (§8.6, OQ 7)
- **What's decided:** whether `questions:read --set heldout --model anthropic:claude-haiku-4-5 --spend --max-usd 1` runs once.
- **What the owner sees:** the dry run's estimate (expected well under $1), and what the page will say either way.
- **What it costs:** real money, however little, and it's not mine to spend. If no, all hosted models read "unmeasured" on the page. This gate is cheap to answer; it exists because it spends.

**Gate 3: does the page, read as a person would, imply a verdict?** (§5, §6, §7)
- **What's decided:** the wording of the short list, the cards and the sheet, and whether the order's heading reads as "best first".
- **What the owner sees:** `gate-3-words.md`: the full text of p08's and p17's short list, two cards each in full, and their sheets, from `--fake`; plus `npm run app -- --fake` to try it. The verdict patterns catch words; this gate is for what words can't: tone, emphasis, the top of the list reading as a recommendation.
- **What it costs to be wrong:** stage E pins the wording in the browser test and describes it in `docs/`. A page that reads as advice is the one thing the product intent rules out (§7 of the research).
- **Can be no:** wording is rewritten in `copy.ts`, `explain.ts`, `sheet.ts`, and the gate is answered again.

Stages A, B′ and C need no gate: A is proven by `--check`; B′ applies a choice already made; C ends in tests.

### Steps

Each step is one commit, through `npm run check && git commit`. No commit carries a Co-Authored-By trailer. No test mocks a module or stubs a global; adapters and transports are injected.

**Stage A: groundwork**

1. **Commit intent, spec and this plan** as `work/0004-shortlist-handoff/{intent,spec,plan}.md`, with spec §7 and §10 amended as in Context. Record the baseline test count and `npm test` time.

2. **The conversation, as steps** (§3). In `src/questions/conversation.ts`: `startConversation`, `nextQuestion` (wrapping `select.ts`'s), `answer`, `changeAnswer`, `stopNow`, `current`. `StopReason` gains `"person"` in `select.ts`. `runConversation` becomes a loop over the steps, with the same signature and output.
   - Tests in `tests/questions/conversation.test.ts`: the steps equal `runConversation` on the fixture for each scorer; out-of-turn facts and unknown answers refused; `changeAnswer` and `stopNow` stop the chooser and reorder.
   - **Proof of no change:** `npm run questions:eval -- --check` and `-- --check --dev` pass on every committed 0003 result. Recorded in the commit message.

3. **Trials for a search, under `src/`.** Move `trialsFor`'s body to `src/questions/trials.ts` (`trialsForSearch(request, snapshot, zips, runDir)`), and `loadAllTrialFacts(runDir)` that reads the run once into a map. `scripts/questions-eval.ts` and `questions-try.ts` call it. No behaviour change; `--check` again.

**Stage B: the order**

4. **Three orders** (§2.1–2.3).
   - `src/shortlist/order.ts`: `ORDERS` (`hints`, `checked`, `read-first`), `OrderName`, `orderTrials(entries, name = "hints")`, `keyOf` extended with `checked` (fits count) and `read` (0 or 1). `ORDER_KEYS` = `ORDERS.hints`.
   - `src/questions/settings.ts`: optional `"order"`, validated, default `hints`; `ConversationSettings.order`.
   - `src/questions/select.ts`: `shortlistChange` keeps its shortcut for `hints` and `read-first`; `checked` uses a full recount (apply the answer's hint and fit deltas, re-sort, count entries). `TrialIndex` records, per trial, fact → answers it maps, so fits deltas are known.
   - `orderFor` and `runConversation` pass `settings.order` through.
   - Tests in `tests/shortlist/order.test.ts` and `tests/questions/select.test.ts`: each order's keys pinned; `checked` puts more fits first among equal hints; `read-first` puts mapped before unmapped; full recount equals the shortcut under `hints` on every fixture case; no order drops a trial.
   - `--check` still passes (no committed settings name an order).

5. **Measure the orders on dev** (§2.4).
   - `evals/questions/metrics.ts`: rows gain `mappingsOnShortlist`, `mappingsPerCandidate`, `medianMiles`; summaries gain read ratio and median miles. Older results lack the fields; `--check` compares what a result records.
   - `scripts/questions-eval.ts`: `--order <name>` overrides the settings for a dev run, recorded in the result.
   - Run `questions:eval -- --dev --order hints|checked|read-first`; commit the three results under `evals/results/questions/dev/`.
   - Write `gate-1-order.md`: the table, the side-by-side lists, a recommendation and what it costs to be wrong. **Stop at Gate 1.**

**Stage B′: held-out**

6. **Freeze and rerun held-out once.** Write the chosen `"order"` into `data/questions/conversation.json`. Run `questions:eval` (held-out and dev) once → `evals/results/questions/02-*.json`, and `questions:eval -- --reads <the held-out reads file>` once → `with-reads/03-*.json`. Record the Gate 1 answer and the numbers beside 0003's in `gate-1-order.md`. If the answer was `hints`, the settings file is unchanged and this step only records that.

**Stage C: words and sheet**

7. **What the short list says** (§5, §7).
   - `src/shortlist/phase.ts` (`PHASE_WORDS`), `src/shortlist/words.ts` (`VERDICT_PATTERNS`, `verdictHits(strings)`), `src/shortlist/explain.ts` (`describeOrder → OrderView`, every string in `ours` or `registry`).
   - `evals/questions/` rows gain `verdictHits` (over the record and conversation arms' views); `questions:eval` exits non-zero on any.
   - Tests: `tests/shortlist/explain.test.ts` on the fixture (fits, hints with trial words, unknowns by who knows, unread trials, flags, every candidate once); `tests/shortlist/verdict.test.ts` (no hit in fixture views; each pattern catches a sentence written to break it; registry text is not scanned).

8. **The oncologist sheet** (§6). `src/shortlist/sheet.ts` (`oncologistSheet → SheetView`, the what-to-bring map). Rows gain `sheetMissing` (unknown facts of short-list trials neither asked on the sheet nor shown as a hint); `questions:eval` exits non-zero on any. Tests on the fixture, including a man never seeing pregnancy. Rerun `questions:eval` and commit the result with `verdictHits` and `sheetMissing` all zero, as `03-*.json` (or `02` if step 6 wrote none).

**Stage D: server, Settings, page**

9. **Toolchain and an empty page.** Add, at the prescreening repository's versions: `react`, `react-dom` (dependencies); `vite`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`, `@playwright/test` (dev). Copy and adapt `vite.config.ts`, `tsconfig.web.json` (and `typecheck` runs both), `playwright.config.ts` (port 5035, `--fake`, `e2e/.out/`), Biome includes for `.tsx`, `.gitignore` for `dist/` and `e2e/.out/`. `src/server/start.ts` (copied), `src/server/app.ts` with `/api/info` and static files, `src/web/main.tsx` and `App.tsx` with a heading. `scripts/app.ts` and `npm run app` (`vite build`, then serve on 5025). Boundary tests: `src/web/` imports no `node:` module or `process`; `src/web/main.tsx` an entry; `src/web/api.ts` in `RELATIVE_FETCH_FILES`; the e2e command must pass `--fake` (copied).

10. **Choices on the transport, and the finder service** (§4, §9.2).
    - `src/transport/types.ts`, `ledger.ts`, `rules.ts`, `web/routes.ts`, `web/client.ts`: optional `choices` on agent messages; inbound `{ choice }`; `409 not-a-choice`. Tests in `tests/transport/`.
    - `src/server/finder.ts` (`FinderService`), routes in `app.ts` (`/api/finder`, `/view`, `/answers/:factId`, `/stop`, `DELETE`), with `ownOrigin` on writes. Adapter supplied by an injected `ReaderSource` (a scripted one in tests; `models.ts` in step 11).
    - `tests/server/finder.test.ts` with `app.inject` and the fixture: confirm required; Change it; choice without confirm; rejected reading, adapter error and cap each fall back to choices; wrong choice refused; stop now; change answer reorders; fixture parity with `runConversation` answered by choice.

11. **Settings** (§8). Adapt `src/server/settings.ts` and `src/server/models.ts` from the prescreening repository, with one role, the reader, and the conversation cap ($0.10 default). Routes in `app.ts`. `createAppAdapter` named only in `src/server/models.ts` (`APP_MODELS` in `tests/boundary.test.ts`). `tests/server/settings.test.ts` and `models.test.ts` adapted from the prescreening repository's; plus: no response body holds a key; a conversation keeps its model; spend appended to `local/spend.jsonl` (a temp dir in tests).

12. **The page** (§1, §5, §6, §8.4–8.5). `src/web/`: `SearchForm`, `Conversation` (text box, choices, confirm, "show me the list now", the where-answers-go note), `ShortList` and `TrialCard` (registry text in `data-registry` elements), `Answers` (change), `Sheet` (print CSS, Print button), `SettingsPage` (adapted), `api.ts`, `copy.ts`, `styles.css`. `tests/web/copy.test.ts`: `copy.ts` has no verdict hit, and no `.tsx` file has a word-bearing JSX text literal outside `copy.ts`.

13. **`npm run app -- --fake`** (§9.4). `scripts/app.ts` builds the fake reader from the committed reads files (exact reply text → reading, else `unknown`) and passes the measured-models list from `evals/results/questions/reads/`. Write `gate-3-words.md` from a `--fake` run of p08 and p17. **Stop at Gate 2 and Gate 3,** asked together.

**Stage E: pinned and written up**

14. **Browser test** (§10, e2e 1–7) in `e2e/*.spec.ts`, `npm run test:e2e`. Case 2's expected list comes from `runConversation` with the committed dev reads, computed in the spec file.

15. **The hosted reading run,** if Gate 2 said yes: one `--spend` run, its result and spend line committed, the page's measured list updated by the file's presence. If no, this step is skipped and the PR says so.

16. **Docs** (§12): `docs/page.md`, `docs/questions.md`, README, ROADMAP, `CLAUDE.md` (commands, layout, boundaries). Every number traceable to a committed result.

17. **Review passes** from `REVIEW.md`, and their fixes. Then the PR, stating which gates were answered how.

## Files that change

**New:** `src/server/{start,app,finder,models,settings,index}.ts`; `src/web/*` (`main.tsx`, `App.tsx`, components, `api.ts`, `copy.ts`, `styles.css`, `index.html`); `src/shortlist/{explain,sheet,phase,words}.ts`; `src/questions/trials.ts`; `scripts/app.ts`; `e2e/*.spec.ts`; `vite.config.ts`, `tsconfig.web.json`, `playwright.config.ts`; `tests/server/*`, `tests/web/copy.test.ts`, `tests/shortlist/{explain,sheet,verdict}.test.ts`; `docs/page.md`; `work/0004-shortlist-handoff/{plan,gate-1-order,gate-3-words}.md`; results under `evals/results/questions/`.

**Changed:** `src/questions/{conversation,select,settings,index}.ts`; `src/shortlist/order.ts`; `src/transport/{types,ledger,rules}.ts`, `src/transport/web/{routes,client}.ts`; `scripts/questions-{eval,try}.ts`; `evals/questions/{metrics,arms,result}.ts`; `data/questions/conversation.json` (if Gate 1 changes the order); `tests/boundary.test.ts`; `tests/questions/*`, `tests/shortlist/order.test.ts`, `tests/transport/*`; `package.json`, `package-lock.json`, `biome.jsonc`, `.gitignore`; `docs/questions.md`, README, `work/ROADMAP.md`, `CLAUDE.md`, `work/0004-shortlist-handoff/spec.md` (step 1).

**Not touched:** the parser, the screening agent, the mapper, `src/plain/`, the vocabulary, the mapping runs, the snapshot.

## Reused, not rebuilt

- `runConversation`, `openQuestions`, `nextQuestion`, `readReply`, `statusFor`, `searchTrials`, `loadSnapshot`, `loadZipPoints`, `runDirFor`, `readTrialFacts`.
- `createAppAdapter`, `BudgetPool`, `keyHint`, `withSavedKeys`, `withLocalSettings`, `redact`, `appendSpend`, `FakeModelAdapter`.
- `ChannelLedger`, `MemoryTransport`, `WebTransport`, `checkInbound`.
- From the prescreening repository, adapted: server start, settings store and routes, `ownOrigin`, Settings page, Vite and Playwright configs, settings tests, the `--fake` and `createAppAdapter` boundary checks.

## Risks

- **The `checked` recount slows the chooser.** About 23 facts × 3–4 answers × a sort of up to ~1,000 trials per follow-up: milliseconds, but `questions:eval`'s curves run 20 follow-ups × 5 arms × 20 patients. If a run passes a few minutes, cache the sort per answer.
- **The order changes what held-out means.** A second held-out run is a second look. Mitigated by choosing on dev only, and reporting both runs, never replacing 0003's.
- **Test time.** New fixture tests and `app.inject` server tests add to a ~0.5 s suite. The real snapshot stays out of `tests/` (Context). If the suite passes a second, the server tests share one app instance per file.
- **The transport change touches inherited code** the screening agent's tests rely on. `choices` and `{ choice }` are optional, so text-only paths are unchanged; the existing transport tests must pass untouched.
- **Playwright needs a browser download** (`npx playwright install chromium`), a network fetch a person runs once. Documented, never run by a script.
- **Words the scan misses.** The patterns catch phrases, not tone. That's Gate 3's job, and why it's a gate.
- **Copying from the prescreening repository brings its screening roles and coordinator assumptions.** Each copied file is cut to the reader role; the review pass checks no screening or coordinator wording survives.

## Verification

- `npm run check` exits 0 at every commit.
- `npm run questions:eval -- --check` and `-- --check --dev` pass at steps 2, 3 and 4 against 0003's committed results, and against every new result after.
- `questions:eval` reports `verdictHits` and `sheetMissing` zero for every row of the committed result.
- `npm run test:e2e` passes against `--fake`, with no model running.
- By hand: `npm run app` with oMLX running, one made-up conversation typed through, a reading changed, the sheet printed to PDF; then Settings with a hosted provider chosen and no key saved, which falls back to the fixed answers with the reason shown.

## Records

- **Step 1, baseline:** `npm run check` exits 0; 907 tests (899 passed, 8 expected to fail), `npm test` 0.57 s.

- **Step 2:** the step that returns the next question is `nextStep`, not `nextQuestion`, which `select.ts` already exports. `current` returns `ConversationSoFar`, whose `stop` is `null` until the conversation stops. `--check` matched 03-867d9528f7e8, dev/01-e935d9c2c86e and with-reads/02-867d9528f7e8 row for row. 914 tests.
- **Step 3:** `trialsForSearch(request, snapshot, zips, facts)` takes a lookup for a trial's mappings rather than a run directory: the measurement reads each file as before, and the server will pass the map from `loadAllTrialFacts`. `--check` matched 03 and dev/01 again.

(Filled in as gates are answered and the plan diverges.)
