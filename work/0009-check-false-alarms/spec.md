# spec: 0009 check false alarms

**Status:** Draft
**Date:** 2026-11
**Intent:** [intent.md](intent.md), committed as `0009 intent`.

The deeper check stops saying "may not fit" on rules that don't apply to the person, and sets apart its lines about parts of a trial. The fix is in the screening agent's reading prompt and in the record, with no parser change and no schema change. It's measured once on 0008's unread held-out, from the full summary only, after a dev rerun.

---

## 1. What exists at the end

- **Where each dev false-alarm line came from,** for causes 3 and 4, in `work/0009-check-false-alarms/diagnosis.md`. Read from 0008's committed transcripts, with no model run. §2 has what was found while writing this spec.
- **A revised reading prompt** in `src/screening/prompts.ts`, with a new `PROMPT_VERSION` (§3).
- **A record that sets apart lines on one part of a trial** (`src/check/record.ts`, and the page's `Record.tsx`), with the frozen "may not fit" count unchanged (§4).
- **A second measure** beside 0008's frozen one in `evals/benchmark/check-metrics.ts`, and a named-rule reading (§5).
- **A dev result,** 0008's 14 dev pairs from the full summary, on the local model (§6).
- **A held-out result,** 0008's 56 held-out pairs from the full summary, run once (§6).
- **The write-up** in `docs/check.md`, `docs/benchmark.md`, the roadmap row and the README (§8).

## 2. Where the causes sit (OQ 1)

**Proposal:** a no-model first step writes `diagnosis.md`, listing every false-alarm line on dev in causes 3 and 4 with:
- the parse's criterion text and polarity;
- the agent's restated statement;
- its reading;
- how `record.ts` turned that reading into "may not fit".

The fix in §3 is chosen from it. Reading part of the transcripts while writing this spec already places most of the lines:

| Pair, line | The parse's text (polarity) | The agent's statement and reading | Where it goes wrong |
| --- | --- | --- | --- |
| nci-13 account, P3 | "The participant is not pregnant or breast feeding" (inclusion) | the same; "I'm a 75-year-old man…" read **does-not-hold** | **the reading.** The prompt's one example, "a man who says he isn't pregnant gives 'does-not-hold'", is about the exclusion statement "is pregnant". The model applied it to an inclusion worded the other way |
| nci-12 × NCT04708470 full, P28 | "The participant is not pregnant and is not nursing" (**exclusion**) | the same; "I am not pregnant or nursing" read **holds** | **the parse,** which gave an exclusion the wording of its requirement. **And the agent,** which the prompt tells to restate an exclusion as "the condition that would exclude the person", but which copied the text |
| nci-06 full, P28 | "Breastfeeding should be discontinued while … on this trial" (inclusion) | the same; "No, I am not breastfeeding" read **does-not-hold** | **the reading.** An instruction for people who are breastfeeding was read as a statement about everyone |
| nci-37 both, P5 | "The participant is of childbearing or child-fathering potential **and** is willing to use … birth control" (inclusion) | the same; "I am 65 … not of childbearing potential" read **does-not-hold** | **the parse.** The source says "Participants of childbearing … potential must be willing…", a condition. The parse made it a conjunction, and the agent read it literally, correctly |
| nci-13 account, P2 | "The participant has a negative serum pregnancy test within 2 weeks…" (inclusion, clinical) | the same; "I certainly haven't had a pregnancy test" read **does-not-hold**, reported under records | **the parse.** It dropped the source's "Patients of childbearing potential" |
| nci-13 full, P8 | "**If** the participant is currently receiving therapy, the clinician has assessed…" (inclusion, clinical) | "The clinician has assessed that the current therapy is no longer benefitting…"; "not currently receiving any cancer therapy" read **does-not-hold** | **the agent's statement,** which dropped the "if" the parse kept |
| nci-13 full, P20 | "**If** the participant has brain metastases …, they have completed treatment…" (inclusion, clinical) | "The participant has brain metastases or primary brain tumors"; "no mention of brain involvement" read **does-not-hold** | **the agent's statement,** which kept the condition and dropped the requirement |

**So:**
- **Cause 4, conditional rules, is mostly the agent's.** The parse kept the "if" on P8 and P20, and the agent's statement lost it.
- **Cause 3, pregnancy rules, is in three places:** the reading (P3, P28 in nci-06), the agent not restating an exclusion (P28 in nci-12), and the parse losing a condition (P5, P2).
- **The code is not at fault.** `apply.ts` and `record.ts` do what a reading tells them to: an inclusion that doesn't hold, or an exclusion that does, "may not fit".

The plan's first step finishes the table for every line in causes 3 and 4, on both arms. If it finds a line that the agent's prompt can't reach and §3 hasn't named, it's listed as remaining, not fixed.

## 3. The reading prompt

`READ_SYSTEM_PROMPT` in `src/screening/prompts.ts`, which holds the "statement" and "reading" rules. `PROMPT_VERSION` hashes it, so the change is a new version. Three additions, each with an invented example, none drawn from a benchmark trial or the twelve pinned protocols, following the file's header on why examples come from outside the corpus:

1. **A rule with a condition keeps it.** When a criterion applies only if something is true ("if currently receiving therapy…", "patients with brain metastases must…", "participants of childbearing potential must…", "breastfeeding should be discontinued"), the statement keeps both halves: "If the person X, then Y." A reply establishing that X isn't true gives **"does-not-apply"**: the rule is about people who are X.
   - This widens "does-not-apply" from groups of people to conditions in a rule's "if" or "who" clause. It doesn't change the existing line that "pregnant" names a condition, not a group, when pregnancy is itself what the rule is about.
   - A criterion the parse already joined into a conjunction ("is of childbearing potential and is willing to…") is read the same way when its first half names who the rule is for. This reaches P5 without a parser change. P2, whose condition the parse dropped entirely, isn't reached.
2. **An exclusion is restated by meaning, not by wording.** If an exclusion criterion's text reads as a requirement ("The participant is not pregnant and is not nursing"), the statement is still what would exclude the person ("The person is pregnant or nursing").
3. **The pregnancy example covers both ways round.** Beside the existing example: against an inclusion "The person is not pregnant", a man saying he isn't pregnant gives "holds".

**What "does-not-apply" does downstream is unchanged.** `applyPatient` sets the criterion `unresolved`, reason `does-not-apply`. `record.ts` places it under "Needs your records or your oncologist" with "not about you" (`WHY.notAboutYou`), never as "may not fit", never as fitting. Nothing about it is dropped. A clinical criterion stays `chart-review`. Its reported value is "does-not-apply", which isn't a conflict.

**Never:** a prompt line that tells the model a reading is good or bad for the person, or that adds "fits" or "eligible" wording. The verdict-word guard and `verdictHits` stay as they are.

**What's left alone (OQ 2, OQ 5):**
- **The parser.** No change to `src/criteria/prompt.ts`, so the dev parses stand and 0007's parses and page caches are untouched. P2-type lines, a condition the parse dropped, and parses that give an exclusion the wrong polarity in ways the agent can't see, are named as remaining.
- **"Or" lists, cause 1.** §2 shows they're the parse's split: each alternative arrives as its own criterion, and the agent sees one at a time. Fixing them means the parser keeping a list together, or the agent reading siblings together. The first is a parser change that the parser's own history warns about (`src/criteria/prompt.ts` header: one wording "made the model bundle every 'or' list"). The second needs a field the agent doesn't have. **Out of this slice, named as the next work.** Held-out's lines are counted by cause where the plan's step can tell (§5.3), so the size of what's left is visible.

## 4. Lines on one part of a trial (OQ 3)

**The record:**
- A "may not fit" line whose criterion has a part (`appliesTo`) still reads "May not fit one part of the trial", and still has `mayNotFit: true`. 0008's frozen measure reads `mayNotFit`, so it's unchanged.
- **The counts line** (`countsLine` in `src/check/record.ts`) changes. Today: "N rules may not fit what you said. M rules need your records or your oncologist." With part lines, the first sentence counts only lines without a part, and a sentence follows it: "K more are for one part of the trial, which you may not be in." The wording stays in `record.ts` beside the existing strings, and is checked for verdict words like every other fixed sentence. `counts.mayNotFit` keeps counting every "may not fit" line, so nothing reading it changes.
- **"To ask your oncologist"** lists part lines last, under a fixed lead-in: "Which part of the trial would you be in? These rules are for one part:". No new section, no new `Place`.
- **The page** (`src/web/Record.tsx`) renders the counts line and the lead-in. The browser test's expectations change only if a page it checks has a part line; the plan checks.

**Why not drop them, or count them as nothing:** a rule for one part can be the only part the person would join. Whether a person is in a part is often a question for the oncologist. The record says so rather than deciding.

**The measure:** §5.

## 5. What's measured

### 5.1 Frozen, from 0008, unchanged

`scoreBenchmarkPair` and `summarizeArm` as they are: flagged, caught, false alarms by label, lines by where they sit, the named-rule class (`rule-caught`, `rule-other`, `rule-missed`, `disease`, `none`), questions asked, verdict hits, unknowns missing, flags and findings excluded. This is the number that compares with dev's 8 of 9.

### 5.2 New, frozen at Gate 1, before dev runs

In `evals/benchmark/check-metrics.ts`, beside the frozen scoring, in the same result file:
- **Flagged outside parts:** a pair with at least one counted "may not fit" line whose `part` is null. Caught and false alarms recomputed on it, by label. 0008's gate page gave this as "a reading"; here it's a measure.
- **Named rule on the record:** for each `rule` pair, whether the named rule's quote overlaps, by the link's rule (`LINK_THRESHOLD`), a line that is "may not fit", under "Needs your records or your oncologist", or on "To ask your oncologist". 0008 proposed this beside `rule-caught` (`gate-2-dev.md`, Caught, and the named rule). Reported as a count, never as caught.

Both are computed from the record in each transcript, so `--check` regrades them with no model. 0008's dev result is regraded with them too, as the before figure. It's a new reading of an old result, so the old file isn't rewritten: the before figures go in the gate page and the write-up, computed by the same function.

### 5.3 Shown, not measured

- **For each dev line in §2's table, and every line `diagnosis.md` adds:** whether the rerun still flags it. Pair by pair, in the gate page. The conversation's path can change between runs, so a line can disappear because its question wasn't asked; the page says which.
- **Held-out's remaining false-alarm lines, by cause,** classed by hand after the run: "or" list, part, pregnancy, conditional, records, other. A reading for the write-up, labelled as one, never a frozen measure.
- **Reported by reason** (OQ 7): every held-out figure split by `rule`, `disease` and `none`, as 0008's scoring already does. The check reads rules, not purpose.

## 6. The runs (OQ 4, OQ 5, OQ 6)

| | Pairs | Trials parsed | Arm | Estimate |
| --- | --- | --- | --- | --- |
| **Dev rerun** | 0008's 14 | none: dev's 12 parses stand | full summary | about 7 hours, at 0008's 29.6 minutes a check |
| **Held-out, once** | 0008's 56 | 30, at the parser's defaults | full summary | about 1 hour parsing, then about 28 hours |

- **Model:** the local model, as 0008 ran it: Qwen3.6-35B-A3B-MLX-8bit, temperature 0, seed 20260921, reasoning off, the summary participant unchanged. Results record all of them.
- **`npm run benchmark:check -- --dev --arm full`** and **`npm run benchmark:check -- --arm full`.** The run hash already covers the agent's prompt version, so the new prompt starts new run folders. 0008's dev result and transcripts are untouched, and its `--check --dev` still regrades.
- **Held-out's guard.** 0008's script refuses held-out once a held-out result exists. None exists, since 0008 didn't run it. This slice's held-out is that one look.
- **`CHECK_REVISION`** goes from 2 to 3, because the record changes (§4). That also starts new run folders for `check:eval`. 0007's committed results regrade from their stored records and are untouched.
- **No account arm** (OQ 6). `docs/benchmark.md` says it wasn't rerun, and why.
- **No hosted run.** One would be a new gate: dry first, no `--spend` without the owner's word.

## 7. Gates

Two, each a spend of local time:

- **Gate 1: freeze the fix and spend about 7 hours on dev?** The owner sees `diagnosis.md`, the prompt's diff, the record's new wording on two dev records rendered from their stored findings, and §5.2's measures computed on 0008's dev result. Wrong here costs a dev run on a fix that misses the causes.
- **Gate 2: spend held-out's one look?** The owner sees the dev result in both measures, §5.3's line-by-line table, the bar below, and the held-out estimate. Wrong here costs held-out itself: anything changed afterwards is tuned on it.

**The bar for Gate 2, frozen at Gate 1:** 0008's four items, from the full summary:
1. no `verdictHits`;
2. every unresolved, chart-review or not-asked criterion on its record;
3. every fidelity flag read and explained, and no finding scored from a flagged turn;
4. every dev pair finished, or listed with why.

Caught and false alarms are shown, not barred: 14 pairs can't measure a rate. "Revise on dev" may change the reading prompt again before held-out. Each revision is a new dev run and Gate 2 again.

## 8. Docs and the rest

- **`docs/check.md`:** the prompt's three rules, the record's part lines, held-out's numbers in both measures, and what's still wrong: "or" lists, conditions the parser drops, and the check not judging purpose.
- **`docs/benchmark.md`:** the check section gains held-out, from the full summary, beside 0008's dev, with the account arm marked not rerun.
- **`work/ROADMAP.md`:** a 0009 row. Only that row is committed with the slice; the owner's uncommitted Future scope section isn't folded in without their word.
- **README:** no change, unless a sentence there describes the check's false alarms.
- **`CLAUDE.md`:** no new command. `benchmark:check`'s line already names `--arm`.

## 9. Boundaries

- **No boundary widens.** `ScreeningCriterion` keeps four fields. Nothing under `src/screening/` reaches `src/check/`, `src/facts/` or `src/plain/`. No new network host, no new dependency.
- **Prompts stay in `src/screening/prompts.ts`.** The models are reached only through the existing adapter.
- **`tests/boundary.test.ts` is unchanged.**

## 10. Tests

Deterministic only, in `tests/`:
- `record.ts`: a part line keeps `mayNotFit: true`; the counts line names part lines apart; "To ask your oncologist" lists them last under the lead-in; a "does-not-apply" finding on a clinical criterion isn't "may not fit". No verdict words in the new sentences.
- `check-metrics.ts`: flagged outside parts, on a record whose only "may not fit" line has a part, and on one with a line without; the named-rule reading on each section it can land in.
- The prompt: a test that `PROMPT_VERSION` changed and that the three examples share no five-word run with the twelve pinned protocols or the benchmark trials' text, as the parser prompt's overlap rule asks.
- Nothing asserts what the model reads. That's the eval's job.

## 11. Out of scope

- "Or" lists (cause 1), and any parser change.
- The account arm, and any change to the summary participant or `KNOWING.md`.
- Judging a trial's purpose.
- 0007's own pairs: re-running them would be a second look at a spent held-out.
- The page beyond the record's counts line and lead-in.
- More cancer types.

## Concerns for the owner

1. **The fix is the agent's prompt, not the parser's.** That keeps the parses, the page's caches and 0007's results untouched, and the inherited parser, which nothing here can re-measure, as it was. The cost is that two kinds of line stay: conditions the parse dropped (P2) and some polarity errors the agent can't see. **Deciding:** prompt only, or also a parser prompt change that keeps a rule's "who" clause. A parser change would mean reparsing dev's 12 trials (about 20 minutes) and having no measure of the parser's own accuracy afterwards.
2. **"Does-not-apply" gets wider.** Today it covers only groups of people. This spec extends it to a rule's "if" or "who" clause. That puts more rules under "Needs your records" with "not about you", instead of under "What you told the check". Nothing is dropped and nothing reads as fitting, but a person sees fewer rules answered. **Deciding:** whether "not about you" is the right place for them, or whether they belong under "What you told the check" with "Nothing here conflicts with what you said". The second would need a code change in `apply.ts` as well as the prompt.
3. **"Or" lists stay.** They're the largest cause on trials the clinicians recommended (nci-41's only line, nci-17's basket list), so held-out's false-alarm rate may still be high from them alone. **Deciding:** accept that, with held-out's remaining lines counted by cause so the write-up can say how much is left; or widen the slice to a parser change, against the intent's "narrow, or stop".
4. **Two gates, about 36 hours of local time in all.** That's more than "small" may suggest: 7 for dev, about 29 for held-out with parsing. **Deciding:** keep the dev rerun, or skip it and run held-out straight after Gate 1, at the risk of spending held-out on a prompt that has never run.
5. **The record's counts line changes on the page.** It's one sentence and one lead-in, both fixed strings. **Deciding:** whether that page change belongs in this slice, or the record should stay as it is with only the measure changed.
