# Gates 2 and 3: a hosted reading run, and the page's words

Asked together, at the end of stage D (plan, step 13). Stage E pins whatever is answered here. The browser test checks the wording, `docs/page.md` describes it, and the hosted run, if any, is committed as a result.

## Gate 2: spend on one hosted reading run?

**Question:** should the reader be measured once on a hosted model, so the page can say that model's readings were measured?

**The run, if yes:**

```
npm run questions:read -- --set heldout --model anthropic:claude-haiku-4-5 --spend --max-calls 600 --max-usd 1
```

- **What it does:** the same 527 held-out (patient, fact) pairs, the same frozen prompt (`8cb01749`) and the same grading as 0003's Gate 3, on Claude Haiku 4.5.
- **Why that model:** it's the one hosted model smoke-tested here (`src/models/catalog.ts`), and the cheapest Anthropic one.
- **What it writes:**
  - `evals/results/questions/reads/heldout-claude-haiku-4-5-8cb01749.json`;
  - a line in `evals/results/spend.jsonl`.
- **The dry run's estimate:** 527 calls, 224,814 input and 6,324 output tokens, **about $0.26**. The run stops at $1.00. It needs `--max-calls 600`, because the default cap of 100 would stop it partway.
- **What it records:** temperature 0. Seed none: the Claude API has no seed parameter, and the result says so. Reasoning is off.
- **Spent on this project so far:** $0.48 over 4 paid runs.

**What the page says either way:**
- **Yes:** beside each confirm while Haiku 4.5 reads, "Read by Anthropic · claude-haiku-4-5." Settings marks it "Its readings were measured." The other two providers and Sonnet stay unmeasured. `docs/questions.md` reports Haiku's exact and invented rates beside the local model's.
- **No:** every hosted model reads "This model's readings haven't been measured." That holds until a later slice measures one.

**What it costs to be wrong:**
- **Yes, when it shouldn't be:** about $0.26.
- **No, when it should be:** the page offers three hosted providers it can say nothing about, and most people who open the repository can't run the local model (product intent, open question 7).

This gate is cheap to answer either way. It's here because it spends money, and the plan says that decision isn't mine.

**Recommendation:** yes, once, as above.

## Gate 3: does the page, read as a person would, imply a verdict?

**Question:** does anything about the short list, a trial's card or the sheet tell a person, in tone, emphasis or order rather than in words, that a trial suits them?

The verdict patterns already hold for words:
- **`questions:eval`:** none of the project's own text, for all 20 made-up patients, matches a pattern (`05-7543ffb2cb2e`, `verdictHits` 0 in all 169 rows).
- **`tests/web/copy.test.ts`:** every fixed sentence on the page is scanned, and no word can be written straight into a component.

This gate is for what a pattern can't see.

**What to read:** [gate-3-pages.md](gate-3-pages.md) has p08's and p17's whole conversation, their short lists, two cards each in full, and their sheets. All of it is from `npm run app -- --fake`. To see it in the browser:

```
npm run app -- --fake
```

**What I noticed reading them,** for you to weigh:

1. **The top of the list reads as reassurance it hasn't earned.**
   - Every short-list card says "Nothing in what was read of its rules conflicts with these answers."
   - p17's list holds a first-line trial (NCT06119581) for someone after one line of treatment, and a trial for *untreated small-cell* lung cancer (NCT06712355). p08's holds a prostate-cancer trial and a B-cell lymphoma trial.
   - Each card does say how much was read: "Its rules were read for 7 of the 31 questions here."
   - **The question:** is "nothing in what was read conflicts" plus "read for 7 of 31" honest enough, or should a card with few readings say more plainly, for example "Most of this trial's rules weren't checked"?
2. **The sheet's voice is mixed.** It speaks about "this person" to the oncologist, but lists the questions as the person was asked them ("Have you had another kind of cancer?").
   - Leaning: leave them as asked, since the person carries the sheet and will read it too.
   - The alternative is a third-person phrasing per fact, which is 31 new sentences nobody has reviewed.
3. **"What it tests"** lists the registry's interventions verbatim, including "(CLOSED TO ENROLLMENT)" on most of TAPUR's arms.
   - Leaning: keep it. It's the registry's own word, and it tells the person something true.
4. **The order's note** says what the order is, and that it "isn't a ranking of which trial would work for you."
   - Leaning: keep. It names the thing the list must not be mistaken for, without the word the patterns forbid.
5. **Phase words** are mine and reviewed by no clinician. "Phase 1: … Whether it works is a later question" is the line most likely to read as discouraging. That's the honest one-liner the research asked for (§7, false hope), but it's a judgment.
6. **The numbered list.** The cards are numbered 1 to 10. A number reads as rank whatever the note says.
   - Leaning: keep the numbers, because "ask about number 3" is how people will use the sheet. The note sits directly above them.

**The choices:**
- the wording as it stands;
- changes to any of the above, made in `src/shortlist/explain.ts`, `sheet.ts` and `src/web/copy.ts`, then the gate asked again.

**What it costs to be wrong:**
- Stage E pins this wording in the browser test and describes it in `docs/page.md`.
- A page that reads as advice is the one thing the product intent rules out (research §7). Of everything in this slice, it's the most expensive thing to discover after merging.

**Recommendation:** item 1 is the one I'd change before pinning. Lead each card that has fewer than about a third of the questions read with a plain line, "Few of this trial's rules could be checked against your answers." Put it before "nothing conflicts", so "nothing conflicts" can't stand alone at the top of a thinly read trial. The cut-off would be a constant in `explain.ts`, pinned by a test. The rest as it stands.

## Answers

(The owner's, at the gates.)
