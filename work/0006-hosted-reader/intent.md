# intent: 0006 reader on hosted models

**Author:** the repository owner
**Status:** Draft
**Date:** 2026-10
**Scope:** One slice. Make the reader usable on a hosted model, so a person who chooses Claude Haiku 4.5 in Settings gets their typed replies read rather than sent back to the buttons, and measure it with one held-out reading run, after the owner's go-ahead. The reader's prompt and the local model's numbers stay as they are, unless dev shows they can't.

---

## In plain words

On the page, a person answers each question in their own words, and a model reads the reply onto one of the question's fixed answers. The person then confirms the reading. Most people who open this repository can't run the local model, so Settings lets them choose a hosted one, such as Claude Haiku 4.5, with their own key.

When Haiku was measured in 0004, it could read fewer than half of the replies. What it read, it read right. The rest it couldn't hand back in the shape the code accepts: it explained itself around the answer, or ran past the short length the reader allows. Every such reply falls back to the buttons, so nothing is read wrong. The person just has to answer again, as a choice, more than half the time. That defeats the point of typing.

The likely cause is a difference in how the request is made, not in the model. The local model and the other two hosted providers are asked for JSON and answer in it. The Anthropic request asks for nothing; the prompt's last line is all that says "JSON only". This slice makes the Anthropic request ask for the answer's exact shape, which the API supports, then measures Haiku again on the same replies.

## Problem

**On Claude Haiku 4.5 the reader could read 237 of 527 held-out replies, 45%** (`docs/questions.md`, "On a hosted model, once"; [the reads](../../evals/results/questions/reads/heldout-claude-haiku-4-5-8cb01749.json)):
- **87 outputs were cut off** at the reader's 64-token limit, and read as unknown.
- **203 calls failed:** the output wasn't JSON the adapter accepts.
- **What it read, it read right:** 217 of 217 replies stating an answer read exactly, and none of 20 "don't know" replies turned into an answer.
- **The local model, on the same pairs and prompt:** 326 of 326 exactly, 1 of 201 invented, none unusable.

**Read against the file, the cut-offs fell mostly on "don't know" replies:** 75 of the 87 were replies whose right reading is unknown, and 12 stated an answer. That fits the explanation in `work/0004-shortlist-handoff/gate-3-words.md` ("Gate 2, as run"): "Haiku explains before or around its answer", and explaining why a reply doesn't say runs longest. The run can't confirm it. Each failure kept only its first line, a bug fixed since (`3def5eb`, `2def7f2`), so the next run's failures will say why.

**Two figures on that gate page don't match the file.** It says "Of the 241 known replies: 12 failed or were cut off, and 229 were read", and "'don't know' replies turned into an answer: 0 of 95". In the file, 229 replies stating an answer reached the reader without the call failing: 217 read exactly and 12 cut off. Another 97 such replies failed, 326 in all. The 95 "don't know" replies include the 75 cut off, which read as unknown by default, not by reading. `docs/questions.md`'s table (217 of 217, 0 of 20) is the right one. 0004's gate page is a record of what was said at the gate and isn't rewritten; 0006 quotes the file.

**The Anthropic adapter is the only one that doesn't ask for JSON.** `src/models/omlx.ts` and `src/models/frontier-chat.ts` (OpenAI, xAI) send `response_format: { type: "json_object" }`. `src/models/anthropic.ts` sends the system prompt and the reply, and nothing about format, though `CompletionRequest.responseFormat` is `"json"`. The Messages API has no schema-less JSON mode, but Haiku 4.5 supports structured outputs (`output_config.format`, a JSON schema), which constrains decoding to the schema. The reader's answer is one id from a short fixed list, so its schema is exact: `{"answer": <one of the fact's ids, or "unknown">}`.

**`src/models/json.ts` stays strict.** It forgives a code fence and nothing else, on purpose: "if one adapter quietly forgave output another rejected, the difference would be measured as a difference between models." Fixing the request is fixing the cause; forgiving prose would hide it.

**What the page shows today.** Settings lists Haiku as measured, with its readable share (45%) from the committed held-out file (`scripts/app.ts`, `measuredModels`). With Haiku chosen, about 55% of typed replies come back as "I couldn't read that just now…" and are asked again as choices.

**Carried in, and where they go:**
- **0004's Gate 2** chose Claude Haiku 4.5 as the one hosted model measured (`work/0004-shortlist-handoff/plan.md`, "Gates 2 and 3, as answered"). 0006 measures the same model on the same 527 pairs, so the two runs compare.
- **0005's OQ 2** made this slice, "after this one and before the deeper check" (`work/0005-other-cancers/intent.md`), and `work/ROADMAP.md`'s row says what it's measured by: "0004's Claude Haiku 4.5 run read 45% of held-out replies; the share read, and read exactly, on the same pairs."
- **`docs/questions.md`** says "Adapting the prompt for hosted models would be a new prompt version, tuned on dev first." This intent proposes the request first and the prompt only if dev needs it (OQ 1).
- **What 0005 left** (step 14's review, Gate 3's answer) is weighed in OQ 6.

## Proposed outcome

At the end of this slice:

1. **A request can carry the shape of its answer,** a JSON schema. The Anthropic adapter sends it as structured output. Callers that don't give one, such as the mapper, the parser and the screening agent, send exactly what they send today.
2. **The reader gives its schema:** an object with one field, `answer`, whose value is one of the fact's answer ids or "unknown". The prompt's words don't change, so the local model reads what it read, and 0003's and 0004's local results stand.
3. **A reading run records whether the schema was enforced,** in the run and in the file's name. 0004's Haiku file stays committed and is never resumed or overwritten by the new run.
4. **One dev run on Haiku,** after the owner's go-ahead, with every failure's reason kept. It decides whether held-out is worth its one look, or whether the prompt needs a revision first.
5. **One held-out run on Haiku,** after a second go-ahead, on the same 527 pairs, reported beside 0004's run and the local model's: the share read, the share read exactly, inventions, cut-offs and failures, each failure's reason counted.
6. **Settings shows the measurement of the request the app now sends,** not 0004's.
7. **Docs and roadmap** say what changed and what was measured.

**Absent on purpose:** no change to the reader's prompt unless Gate 2 calls for it (OQ 1); no change to `json.ts`; no new hosted model in the catalog (OQ 4); no OpenAI or xAI run (OQ 3); no change to the questions, the chooser, the order, the search or the mark; no conversation rerun from the new readings (OQ 5).

## Affected users and systems

**A person using the page with Claude Haiku 4.5 chosen,** whose typed replies are read far more often, each still confirmed before it counts.

**A person using the local model,** for whom nothing changes.

**The owner,** who decides at gates: whether to spend on dev, then whether to spend on held-out, and what the dev run says about the prompt.

**Changed:** `src/models/types.ts` (the request's schema), `src/models/anthropic.ts` (and the batch path, which shares its body), `src/questions/prompt.ts` and `read.ts` (the reader's schema), `scripts/questions-read.ts` (the file's name and run record), `scripts/app.ts` (which file Settings and `--fake` read), their tests, `docs/questions.md`, `docs/page.md` if Settings' words change, `work/ROADMAP.md`. **New:** reads files under `evals/results/questions/reads/`, lines in `evals/results/spend.jsonl`, gate pages under `work/0006-hosted-reader/`. **Not touched:** `src/models/json.ts`, the mapper, the parser, the screening agent, the search, the mark, the patients.

**No new dependency.** Two hosted runs, each dry without `--spend`, each run only with the owner's go-ahead. Expected spend under $0.25 in all.

## Constraints

- **Paid runs are dry by default.** Each prints its estimate and exits without `--spend`, and is capped with `--max-calls` and `--max-usd`. Each needs the owner's go-ahead, at a gate. Nothing creates or edits `.env`.
- **The comparison stays fair.** `json.ts` forgives nothing new. What changes is what the request asks for, recorded on the run, so a reader of the result knows Haiku was constrained to the schema.
- **The local model's numbers stand.** The prompt's text and layout don't change unless Gate 2 says so, so `READER_PROMPT_VERSION` doesn't change, and every committed result still passes `--check`.
- **Held-out is read once.** Anything tuned is tuned on dev. The held-out patients' replies have been read by two models already; this is a third reading, and said so.
- **An unknown never becomes an answer.** A reading the schema allows but the fact doesn't have still reads as unknown; `readReply`'s checks stay.
- **Model results record model, temperature, seed and the request's shape.** Haiku has no seed, which the run already says.
- **No PHI, months only, no tool attribution,** as every slice.

## Open questions

1. **Request first, or prompt?** The cause looks like the request, so the fix proposed is structured output, with the prompt untouched. If the dev run still fails a lot, a prompt revision follows, tuned on dev, which changes `READER_PROMPT_VERSION` and needs the local model reread on dev and held-out to keep its numbers. Leaning: request first; a prompt revision only if Gate 2 calls for it, and then within the same dev go-ahead's cap.
2. **What's the bar for spending held-out's one look?** Leaning: on dev, at least 90% of replies read, no reply stating an answer read wrong, and no "don't know" reply turned into an answer; every failure's reason shown at Gate 2. Below it, the gate chooses a prompt revision or stopping with the dev finding.
3. **OpenAI and xAI too?** They already ask for a JSON object, and neither has been smoke-tested (`src/models/catalog.ts`, `smokeTested: null`). Leaning: no. Their adapters ignore the schema in this slice, and the run says so. Sending it to them is a later change, measured when one of them is.
4. **Haiku 4.5, or a newer model?** Claude Haiku 5.5 is out, and cheaper, and isn't in the catalog. Leaning: Haiku 4.5, as 0004's Gate 2 chose and the roadmap's measure needs, so the two runs compare on the same model. Adding Haiku 5.5 is a one-entry catalog diff for a later slice, with its own smoke run.
5. **Rerun the conversations from Haiku's readings?** 0004 did it for the local model only (`with-reads/`). Leaning: no. The roadmap's measure is reading, the conversation run would be a fourth look at held-out patients for a number nobody asked for, and Settings shows reading figures.
6. **Does anything 0005 left belong here?** Leaning: none of it, as the roadmap keeps 0006 to the reader.
   - **`inclusionSection` ends at any line mentioning "exclusion criteria"** (`src/search/other.ts`; 0005 plan, step 14, pass 2). Fixing it changes the frozen check after its held-out run, so it needs a new held-out result. It belongs to the next change to the check.
   - **14 of 43 held-out trials not for NSCLC are still unmarked** (`docs/search.md`). A fixed check can't read them, as ROADMAP open question 6 says. They're for the deeper check (0007), which reads a shortlisted trial's rules, or for 0008's run on TREC's other cancer topics.
   - **NCT03947385,** the one relevant trial marked. Gate 3 kept it marked as the slice's known cost and ruled out changing `rules` after held-out (`gate-3-page.md`, Answer).
   - None touches the reader, and each would spend a held-out look of its own. If the owner wants them, they make a small check-revision slice, after 0007.
7. **`--fake`'s reader reads every file on the current prompt,** Haiku's included (`scripts/app.ts`, `scriptedReader`). The local model's readings win only because their file sorts later. Leaning: fix it here, since this slice adds reads files, so `--fake` reads the local model's files only, as its comment says.
