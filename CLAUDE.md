# CLAUDE.md

## What this is

A local proof of concept: an agent that helps a person with cancer find clinical trials worth asking their oncologist about. It asks them questions, searches a local snapshot of ClinicalTrials.gov, and hands back a shortlist with what fits, what's unknown and what to ask. It never says a person is eligible.

The eval harness is the primary artifact. The agent exists to give the harness something to measure. Read `work/0000-product/research.md` before making design decisions. `work/0000-product/intent.md`, once written, takes precedence.

The repository was seeded from `trial-prescreening-agent`, a proof of concept that holds the prescreening conversation for one trial. The modules it carries over keep their comments, and **slice numbers in those comments (0002, 0013, ...) refer to that repository's slices**, not this one's. This repository's own slices start again at 0001.

## Non-negotiable constraints

These come from the product intent. Do not violate them, and flag it if an instruction would require violating one.

- No PHI anywhere. Patient data is synthetic or hand-authored. This applies to fixtures, tests, logs, comments and commit messages.
- No real patient contact path. No SMS, email, telephony or outbound messaging of any kind. The tool never contacts a trial site; a person does.
- No live network calls at runtime, with one opt-in exception. The trial snapshot is fetched by a script a person runs and saved locally, and searches run against it. Scripts a person runs may call three named frontier hosts from `src/models/`, and only with `--spend`. Once the page exists, the running app may call a model off this machine only when a person has chosen Anthropic, OpenAI or xAI in its Settings and saved a key there. The local model is the default.
- No secrets in the repo, including in example config.
- No cloud deployment surface. No hosting config, no infrastructure code.
- The person's oncologist and the trial team decide. The agent produces a shortlist with its evidence and its unknowns, and hands off. An unknown never excludes a trial. No code path tells a person they are eligible for a trial or should join one.
- No rule a model reads removes a trial. A model's mapping of a trial's rules onto the facts is a "may not fit" hint, shown with the trial's words, and a reason to ask a question; nothing a person answers drops a trial (`docs/facts.md`, measured in slice 0002).

## How work is done here

Work happens in slices. Each slice is one change, in its own numbered folder under `work/`, on its own branch, landing as one PR.

```
work/ROADMAP.md                    # what each slice covers, and which open questions it closes
work/0000-product/research.md      # the research this product starts from
work/0000-product/intent.md        # the vision, written once
work/0001-<name>/
  intent.md    what is wanted, why, constraints, open questions
  spec.md      requirements and design
  plan.md      files that change, stages and gates, order of work, risks, proof
```

For each slice:

1. Write `intent.md` (`/sdlc:slice-intent`). Do not start from the product intent alone; each slice gets its own.
2. Write `spec.md` from the accepted intent (`/sdlc:slice-spec`).
3. **Use plan mode** to produce `plan.md` from the accepted spec (`/sdlc:slice-plan`). Read the codebase, do not edit it. Iterate until someone who never saw the conversation could implement from the plan alone.
4. Implement, one stage at a time, stopping at each gate. If implementation diverges from the plan, update `plan.md` in the same commit. An out-of-date plan is a merge blocker.
5. Run the review passes in `REVIEW.md` before opening the PR.

Steps 1 to 3 each end at the owner. Each artifact is written uncommitted, and the owner accepts it, asks for changes, or drops the slice. Acceptance is the commit: `NNNN intent`, `NNNN spec`, `NNNN plan`, each alone. No skill writes the next artifact over one that isn't committed, and a later step that finds an earlier artifact wrong proposes the change rather than making it (`NNNN intent: revised`). `/sdlc:next-slice` works out which of the three is next and runs it. The skills come from the owner's `sdlc` plugin (`sdlc@eschraufnagel`, from `eschraufnagel/agent-plugins`), not this repository; they read the layout, constraints, plan rules and `npm run check` from this file.

### Stages and gates

`plan.md` breaks the slice into numbered steps, one commit each, and groups those steps into **stages** separated by **review gates**.

A stage is a run of steps that can be implemented without stopping. A gate is a decision that the next stage depends on — not a status update, and not a request to skim a diff. Work does not cross a gate unattended.

Writing them:

- Put the stage and gate table at the top of "Order of work," before the steps. The steps stay as they are; the table only says where the pauses fall.
- A gate names what is being decided and what it costs to be wrong. "Review the search" is not a gate. "Confirm the structured search keeps the eligible trials, because a trial dropped here can never be found later" is.
- Justify a gate by what the *next* stage spends — a network run, a snapshot that later slices build on, a toolchain everything inherits. A gate that guards nothing downstream is ceremony.
- Not every stage needs one. A stage that ends in documentation or a test with no decision attached goes straight to the next.
- A gate whose answer is always yes is not doing its job, the same way a review pass that always comes back clean is not.
- Skipping a gate is allowed. Saying so in the PR is not optional.

Some decisions cannot be delegated: anything only a human can judge, anything that spends real resources, anything that later slices build on. Those are the gates. Put them in `plan.md` where they can be argued with, not in the conversation that produced it.

For bug fixes: write the failing test first, commit it, then make it pass. Do not edit the test to make it pass.

## Conventions

- **Language:** TypeScript, strict mode. Node 24 LTS or newer (`engines.node: ">=24"`).
- **Stack:** Vitest for tests, Biome for lint and format, Playwright for the browser test. The page is React, built by Vite into `dist/web/`, and served by a local Fastify server. `tsconfig.web.json` types the page, with the DOM; `tsconfig.json` types everything else, without it.
- **Dependencies:** kept small. Adding one is a plan-level decision, not an implementation detail.
- **Model access** goes through the adapters in `src/models/`, and anything outside it gets one from a factory. `createLocalAdapter` builds oMLX only. `createAdapter` also builds Anthropic, OpenAI and xAI, always inside the budget wrapper, for scripts. `createAppAdapter` is the running app's: oMLX, or the provider chosen in Settings with the key saved there, always inside the budget wrapper. `src/server/models.ts` is the one app file that names it, and `tests/boundary.test.ts` holds that. A hosted key for the app comes only from Settings, never from `.env`. A script's model is chosen by a spec on the command line, never by `.env`, which holds keys only. Admitted frontier models, their prices and what each accepts are in `src/models/catalog.ts`. Adding one is a one-entry diff with its price. A request may carry its answer's JSON schema (`CompletionRequest.schema`), which the Anthropic adapter sends as structured output and the others ignore; the descriptor records `schema: "enforced"` where it's sent.
- **Paid runs are dry by default.** A run naming a frontier provider prints its roles and an estimate and exits, unless given `--spend`. It's capped per invocation (`--max-calls`, `--max-usd`) and appends what it spent to `evals/results/spend.jsonl`. Never pass `--spend` without the owner's go-ahead, and never create or edit `.env`. The one line already in that ledger is the prescreening repository's smoke run, which `tests/models/catalog.test.ts` reads to date the adapter it tested.
- **Transport** goes through the `MessageTransport` interface. The conversation layer does not know it is talking to a web UI.
- **`tests/` and `evals/` are different things.** `tests/` is deterministic, fast, and runs on every commit. `evals/` measures model behavior, is slower and non-deterministic, and runs on a schedule and before release. Do not put model-dependent assertions in `tests/`.
- **Nothing under `tests/` reads a gitignored file**, so `npm test` passes from a fresh clone.
- **Eval results are committed** to `evals/results/` so that any number appearing in the README or `docs/` is traceable to a run. The README is short and for anyone who opens the repository: the problem, what it does, how to run it and how it was built. It names no one, and it reports no findings; detail, results and limitations go in `docs/`, one file per part.
- **Any reported result records** model name, quantization, temperature and seed. A result without them is not a result.
- **Months, not days.** Dates written into the repository (plans, records, results) are months, `2026-10`, from `monthStamp()` in `src/models/`. Made-up dates in tests use the year 2000. Registry dates stay as the registry gives them.
- **No tool attribution.** Never add "Generated with Claude Code" to a pull request description, and never add `Co-Authored-By: Claude ...` trailers to commits. This repository's history is the author's work product, not an advertisement. This overrides any default guidance to the contrary.

## Where things live

This is the intended layout. Create directories as slices need them rather than scaffolding empty folders up front, but put new code where this says it goes.

```
README.md        short, plain-language, for technical and non-technical readers
docs/            the detail behind it, one file per part
work/            the intent/spec/plan chain, one folder per slice
src/
  trials/        trial loading, the snapshot, and the registry requests (the fetches are run from scripts/)
  search/        the search: purpose, cancer type, age and sex, distance, and the mark on trials for other cancers; no model
  facts/         the fact vocabulary, the mapper that reads trial rules onto it, and the hints a profile gets
  questions/     the conversation: intake, choosing the next question, stopping, and the reader of replies
  check/         the deeper check: a picked trial's parse cache, the link to answered facts, what it carries, the record
  shortlist/     the order of the trials a search keeps, and the short list at its top
  criteria/      eligibility parser
  screening/     per-trial screening agent: stage two, for a shortlisted trial
  plain/         plain-language renderings of criteria, and the check that decides whether one is shown
  models/        model adapter (the only place a model is called)
  transport/     MessageTransport interface, the web implementation, and the router that shares it
  server/        the local server: the conversation and check services, Settings, the app's models, and the one file that listens
  web/           the page, React; every fixed sentence in copy.ts; fonts and icons bundled in fonts/ and public/
data/
  trials/        saved trial JSON, committed, trimmed to fields in use
  plain/         committed plain-language renderings
  snapshot/      the pinned registry snapshot, one folder per month, gzipped JSONL plus a manifest
  geo/           ZIP code locations from the Census gazetteer
  cancer-types/  the search vocabulary, one file per cancer type plus generic.json, and <type>-others.json for the mark
  facts/         the fact vocabulary, and mapping runs by snapshot month and run name
  criteria/      parses of picked trials' rules, by snapshot month and run name, for the check's measurement and --fake; trialbench/ for the benchmark's
  benchmark/     TREC's and NIH-TrialBench's files, trimmed from local/benchmark/ by benchmark:import, and sources.json, their manifest
  questions/     the conversation's settings: intake, skips, short-list size, budget, scorer
evals/
  cases/         eval task definitions: labels, vignettes, patients (cases/patients/), the check's pair labels (cases/check/), and the benchmark's pairs, reasons and accounts (cases/benchmark/)
  search/        the search measurement: labels loader, metrics, result checks, and the mark's scoring and places
  facts/         the fact measurement: labels, coverage, grading, result checks
  questions/     the question measurement: made-up patients, arms, metrics, readings, result checks
  check/         the check's measurement: picks, pair labels, the runner, metrics, result checks
  benchmark/     the benchmarks: import, TREC's XML reader, the pairs, the search's scoring, the check's runner and scoring
  graders/       deterministic graders
  participant/   the simulated participants: the vignette one, the made-up patient for the check, and the summary participant for the benchmark
  results/       committed run output
scripts/         scripts run by a person, never imported by the application
tests/           deterministic tests only
e2e/             the browser test, run against npm run app -- --fake
local/           settings, keys, spend ledgers and the benchmark downloads (local/benchmark/); gitignored
```

New parts get their own directories under `src/` when the slice that needs them is planned.

**Inherited, measured elsewhere.** `data/trials/` holds the prescreening repository's twelve pinned NSCLC protocols (`src/trials/corpus.ts`), `data/plain/` their plain renderings, and `evals/cases/` its hand-made labels and vignettes. They're here because the copied modules' tests read them, and because they're a labelled starting set. Every number measured on them was measured in the prescreening repository. None is a result of this one.

Three boundaries matter more than the rest. Nothing outside `src/models/` calls a model. Nothing outside `src/transport/` knows how messages are delivered. Nothing under `src/` makes a network call, outside the named exceptions below. All three are asserted in `tests/boundary.test.ts`. The network rule has these exceptions, each confined to named files:

- `fetch()` to loopback in `src/models/`
- one frontier host per file in `src/models/`: `api.anthropic.com` in `anthropic.ts` and `anthropic-batch.ts`, `api.openai.com` in `openai.ts`, `api.x.ai` in `xai.ts`
- relative-path `fetch()` in `src/transport/web/client.ts` and `src/web/api.ts`
- `fetch()` to `clinicaltrials.gov` in `src/trials/registry.ts`, called by `npm run fetch:trials` and `npm run snapshot:fetch`
- listening on `127.0.0.1` in `src/server/start.ts`

Widening any of them is a visible change to that test. The same test keeps `createAdapter` out of `src/` beyond `src/models/`, keeps concrete adapters out of `scripts/` as well as `src/`, allows the key variables to be named only in `src/models/keys.ts`, keeps `src/` from importing `evals/`, and keeps the labelling tool from reaching the parser or a model. It also keeps the search labelling tools (`search:sample`, `search:show`) from seeing the search beyond `normalize.ts`, and keeps `src/search/` from reaching a model, the parser, the screening agent or `src/facts/`. The facts labelling tools (`facts:sample`, `facts:label-show`) reach `src/facts/` only for the vocabulary and its types; `src/facts/status.ts` and `vocabulary.ts` reach no model; and nothing under `src/facts/` reaches the model factory, because the mapper takes its adapter as an argument. `src/shortlist/` and `src/questions/`, apart from the reader (`read.ts`, `prompt.ts`), reach no model module, the parser, the screening agent, `src/plain/` or `src/transport/`; nothing under `src/questions/` reaches the factory, because the reader takes its adapter; and the patient loader reaches no model. Since slice 0004, the test also:
- keeps `createAppAdapter` in `src/server/models.ts` alone, and `createAdapter` out of the page, the server, the transport, `scripts/app.ts` and `e2e/`;
- keeps `src/web/` free of Node and unimported by the rest of `src/`;
- holds the browser test's server to `--fake`.

Since slice 0005, it also keeps the other-cancer labelling tool (`other:sample`) away from `src/search/other.ts` and any model. It may know the candidates, but not what the check marks.

Since slice 0007, it also:
- keeps `src/check/link.ts`, `carry.ts` and `record.ts` away from every model module and the parser;
- keeps all of `src/check/` away from the factory, the page, the transport and the server: whoever starts a check passes the adapter in;
- keeps `src/screening/` away from `src/check/` and `src/facts/`: the agent receives what the conversation carried as its own type;
- keeps the pair labelling tool (`check:label-show`) away from the parser, the link, the screening agent and any model.

Since slice 0008, it also keeps the benchmark import (`benchmark:import`) away from the network, the registry request and every model. The benchmarks are downloaded by a person into `local/benchmark/` (`docs/benchmark.md`); their URLs are data in the manifest, never fetched, so no host joins the exceptions.

Since slice 0009, it also keeps `benchmark:lines` away from every model module, the parser and the agent's session: it reads a result's transcripts and parses, and re-assembles records with `recordFor`.

Since slice 0010, it also keeps `criteria:compare` away from every model module, the parser, the parse cache and the network: it reads parse files only.

Since slice 0011, it also keeps outside addresses out of `src/web/` (the fonts are bundled), and holds the screenshot config (`playwright.screenshots.config.ts`) to `--fake`, as it does the browser test's.

The conversation and the check share the app's one transport through `routeByConversation` in `src/transport/`, so neither knows how messages are delivered.

A smaller one: plain-language renderings are display only. Nothing under `src/screening/` imports `src/plain/`, and `ScreeningCriterion` is pinned to four fields, so the agent asks and reads from the protocol's words.

Test files share a module cache (`isolate: false` in `vitest.config.ts`), which keeps `npm test` near half a second. That is safe only while no test mocks a module or stubs a global, and a test in `tests/boundary.test.ts` fails if one does.

Keep saved trial JSON trimmed. The full API response per study is large and mostly unused.

## Verifying your work

| Command | Does |
| --- | --- |
| `npm install` | install |
| `npm run check` | typecheck, then lint, then `npm test`, stopping at the first failure and exiting non-zero. Run it before every commit, and commit only if it exits 0 |
| `npm test` | Vitest. Deterministic, no network, runs in under a second |
| `npm run typecheck` | `tsc --noEmit`, then the page's (`tsconfig.web.json`) |
| `npm run lint` | `biome check .` — Biome is linter and formatter; there is no ESLint |
| `npm run format` | `biome format --write .` |
| `npm run fetch:trials` | refetch the twelve pinned protocols, overwriting fixtures. `-- --dry-run` reports registry drift without writing. Run by a person, deliberately |
| `npm run label:criteria -- <NCT ID>` | write a labelling skeleton for a study. Deterministic; reaches neither the parser nor a model |
| `npm run snapshot:fetch` | fetch a new registry snapshot into `data/snapshot/<month>/`; refuses an existing month without `--force`. `-- --dry-run` compares against the committed one. Run by a person, deliberately |
| `npm run geo:fetch` | refetch the Census ZIP gazetteer into `data/geo/` |
| `npm run search -- --cancer nsclc --zip 60611 --age 64 --sex female` | search the snapshot. `--miles N` or `anywhere` (default 100), `--purpose all`, `--json` |
| `npm run search:sample` | draw the held-out and dev sets into a label skeleton; refuses to overwrite |
| `npm run search:show -- <NCT ID>` | print a trial for labelling; `--brief`, `--next N` |
| `npm run search:eval` | score the search against the labels and write a result; `-- --dev` dev only, `-- --check` rerun the latest result and fail on any difference |
| `npm run other:sample` | draw slice 0005's label sets into `evals/cases/search/nsclc-other.json`; refuses to overwrite |
| `npm run other:eval` | score the mark's routes against the labels: `-- --dev` dev only; with no flag held-out, refused once a held-out result exists; `-- --check` rerun the latest; `-- --places <questions result>` short-list places held by trials not for NSCLC |
| `npm run facts:topics` | count how many NSCLC candidates' rules mention each topic. Deterministic |
| `npm run facts:sample` | draw the fact-label sets into skeletons; refuses to overwrite |
| `npm run facts:label-show -- <NCT ID>` | print a trial's passages for fact labelling; `--next`, `--vocabulary` |
| `npm run facts:map -- --set dev\|heldout\|candidates` | map trials' rules onto the facts, on the local model by default; resumable. `--model <spec>` is dry without `--spend`. Loads `.env` |
| `npm run facts:eval` | `-- --coverage` from the labels alone; `-- --run <dir> --set dev\|heldout` grade a run; `-- --check` regrade the latest result |
| `npm run facts:show -- <NCT ID>` | print a trial's mappings, from the run named in `data/facts/<month>/latest` |
| `npm run facts:try -- <search flags> --profile <file>` | search, then a profile's hints and the questions that would flag the most trials |
| `npm run questions:split` | move newly written patients from `evals/cases/patients/staging/` into their sets by hash; refuses once the sets hold patients |
| `npm run questions:try -- --patient <file>` | one made-up patient's conversation, step by step, then the short list and the oncologist's questions; `--scorer`, `--budget`, `--run`, `--reads <file>` |
| `npm run questions:eval` | every patient through every arm, and write a result; `-- --dev`; `-- --reads <file>` answers from a reads file; `-- --check` reruns the latest and fails on any difference |
| `npm run app` | build the page and serve it at http://127.0.0.1:5025, on the model chosen in its Settings (kept in `local/`; a checked trial's parse is cached in `local/parses/`). `-- --fake` reads replies from the committed readings and checks committed parses by taps, no model; `--port`, `--settings-dir` |
| `npm run test:e2e` | the browser test, against `npm run app -- --fake` on port 5035; never part of `npm test` |
| `npm run screenshots` | the README's three images into `docs/images/`, from `npm run app -- --fake` on port 5045; never part of `npm test` or `test:e2e` |
| `npm run questions:read -- --set dev\|heldout` | read every patient's replies on the local model, resumable; `--model <spec>` is dry without `--spend`. Loads `.env` |
| `npm run check:label-show -- <patient> <NCT ID>` | print a patient's file and a picked trial's rules, numbered, for pair labelling; `--next`. Reaches no parser, link or model |
| `npm run check:parse -- --set dev\|heldout` | parse the picked trials' rules into `data/criteria/<month>/<run>/`, on the local model, resumable; `--model <spec>` is dry without `--spend`. Loads `.env` |
| `npm run check:eval` | check every pair on the local model and write a result: `-- --dev` dev only; with no flag held-out, refused once a held-out result exists; `-- --check [--dev]` regrade the latest from its transcripts and fail on any difference. Resumable. Loads `.env` |
| `npm run benchmark:import` | check the downloads in `local/benchmark/` against `data/benchmark/sources.json` and rebuild `data/benchmark/`; `-- --record` writes the manifest, `-- --pairs` draws the check's pairs (refuses to overwrite). No network, no model |
| `npm run benchmark:search -- --trec\|--trialbench` | score the search against a benchmark and write a result, once; `-- --check` reruns the latest and fails on any difference. No model |
| `npm run benchmark:parse -- --set dev\|heldout` | parse the check pairs' trials into `data/criteria/trialbench/<run>/`, on the local model, resumable; `--model <spec>` is dry without `--spend`. Loads `.env` |
| `npm run benchmark:check` | check the NIH-TrialBench pairs on the local model, both arms: `-- --dev` dev only; with no flag held-out, refused once a held-out result exists; `--arm full\|account`; `-- --check [--dev]` regrade the latest from its transcripts, or `-- --check --result <file>` a named one; `-- --parts <file>` prints a result's outside-parts measure. Resumable. Loads `.env` |
| `npm run benchmark:lines -- <result.json>` | every "may not fit" line on a check result, with the parse, the agent's statement and its reading; `--pair <patient>:<NCT ID>`, `--record` re-assembles the record with today's code, `--parses <dir>` with another parse run's passages, parts and lists. No model |
| `npm run criteria:eval` | grade the parser on the five hand-labelled protocols with the inherited runner, writing to `evals/results/criteria/`; on the local model, cached by prompt; `--model <spec>` is dry without `--spend`. Loads `.env` |
| `npm run criteria:compare -- <old> <new>` | two parse runs of the same trials, rule by rule: split, joined, lost, changed, and every list mark; `--old-prompt`/`--new-prompt` pick from one folder; `--lists <dir>` estimates list-like runs from source text. No model |

Run `npm run check` before every commit and before opening a PR, and commit only if it passes: `npm run check && git commit ...`.

When a test fails, fix the code, not the test.

## Things Claude gets wrong

When the same mistake happens twice, the correction goes here. Keep entries short and specific. The first three came over from the prescreening repository.

- **Reading lint by its last line.** `npm run lint 2>&1 | tail -1` prints nothing useful when Biome fails. Read the exit code (`npx biome check . >/dev/null; echo $?`) before committing.
- **Letting a failed check through to a commit.** Commit through `npm run check && git commit ...`, never after a check whose exit code wasn't the gate.
- **Naming a regex helper `escape`.** It shadows a global and fails Biome's `noShadowRestrictedNames`. Call it `escapeRegExp`.
- **Passing flags through an unquoted variable in zsh.** zsh doesn't split `$ARGS`, so `npm run x -- $ARGS` passes one argument, and a script that ignores flags it doesn't know runs the wrong thing: `questions:eval` wrote two results instead of checking. Write the flags out.
