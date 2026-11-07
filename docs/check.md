# The check: a picked trial's own rules

The conversation ([questions.md](questions.md)) orders the trials by 31 facts. Most of a trial's rules about a person aren't among them, and a hint can't remove a trial, so clearly wrong trials can still reach the top. This part goes deeper on the few a person picks. They tick up to three trials on their list. For each one, the screening agent works through the trial's own rules, skipping what the conversation already settled. Each trial ends in a record for the person and their oncologist.

Built in slice 0007. The record is in [`work/0007-deeper-check/`](../work/0007-deeper-check/), with its gate write-up, [gate-1-dev.md](../work/0007-deeper-check/gate-1-dev.md), and dev's records as text, [gate-1-records.txt](../work/0007-deeper-check/gate-1-records.txt).

Slice 0009 changed how the agent reads conditional and pregnancy rules, and how the record counts rules for one part of a trial ([below](#what-slice-0009-changed)). Its record is in [`work/0009-check-false-alarms/`](../work/0009-check-false-alarms/), with the line-by-line diagnosis, [diagnosis.md](../work/0009-check-false-alarms/diagnosis.md), and the dev rerun, [gate-2-dev.md](../work/0009-check-false-alarms/gate-2-dev.md). The numbers below are 0007's, measured before that change.

Slice 0010 tried to stop "or" lists raising false alarms, by having the parser mark a list's items. Two wordings of the parser's prompt each marked the target lists right and changed other trials' parses for the worse, so the prompt was put back and no check was run ([below](#what-slice-0010-tried)). Its record is in [`work/0010-or-lists/`](../work/0010-or-lists/), with both tries read mark by mark in [gate-1-parser.md](../work/0010-or-lists/gate-1-parser.md).

```
npm run check:label-show -- p08 NCT05579366     a patient and a trial's rules, for labelling
npm run check:parse -- --set dev|heldout        parse the picked trials' rules, on the local model
npm run check:eval -- --dev                     check the dev pairs, and write a result
npm run check:eval -- --check [--dev]           regrade the latest result from its transcripts
npm run benchmark:lines -- <result.json>        every "may not fit" line on a check result, with the parse, statement and reading behind it
npm run benchmark:lines -- <result.json> --pair nci-13:NCT02465060 --record   one pair's record, assembled again with today's record
npm run benchmark:lines -- <result.json> --record --parses <dir>               the same, with another parse run's passages, parts and lists
npm run criteria:eval                           grade the parser on the five hand-labelled protocols, on the local model
npm run criteria:compare -- <old> <new>         two parse runs of the same trials, rule by rule; --lists <dir> estimates lists
```

## The finding, in plain words

**It never repeats a question the conversation settled, and that saves about a quarter of them.** On both sets, 27% of the rules the agent could have asked were already covered by an earlier answer (330 of 1,236 on held-out).

**It catches some clearly wrong trials, and only ones the person could know about.** On held-out, 16 of the 50 pairs were labelled clearly ruled out before anything ran. The check put a "may not fit" on the rule that rules each one out in 5 of them (14% to 56%). All 5 were among the 9 where the person knows the facts that decide it (27% to 81%). Of the 7 the person couldn't know, 4 end up under "ask your oncologist", which is where they belong. On dev it caught none of 4.

**It flags too much.** On held-out, 27 of the 34 trials not clearly ruled out still got at least one "may not fit" (63% to 90%). Most of those flags rest on how the inherited parser split a trial's rules, and on whether a rule applies to one part of the trial ([below](#false-alarms)).

**No verdict, no unknown dropped, no list changed.** In all 59 pairs, no agent message or record says a person fits, qualifies or is ruled out. Every rule left unknown is on its record. No one's list moved.

All numbers are from one local model, Qwen3.6-35B-A3B in 8-bit, at temperature 0, seed 20260921, reasoning off. That model plays the agent, the simulated patient and the fidelity check, as in the prescreening repository's runs.

## How it works

`src/check/`, and the inherited agent in `src/screening/`.

1. **Parse.** The inherited parser (`src/criteria/`) reads the trial's eligibility text into criteria. Each one carries a quote located in the text. On the page a parse is cached in `local/parses/`. The measurement's parses are committed in `data/criteria/<month>/<run>/`.
2. **Link** (`link.ts`). A criterion is linked to a fact when the mapper's quote for that fact ([facts.md](facts.md)) overlaps the criterion's quote by at least half of the shorter one (`LINK_THRESHOLD`, 0.5). Both quotes are checked against the same text.
3. **Carry** (`carry.ts`). A criterion is carried only when the conversation asked every fact linked to it. "I don't know" counts as asked. It's marked "may not fit" when the mapping says the person's answer rules them out.
4. **Ask** (`src/screening/session.ts`). A carried criterion starts closed and is never asked. The agent asks the rest one at a time, as it did in the prescreening repository:
   - code chooses which rule comes next;
   - the model words the question and reads the reply;
   - a reading needs a quote found in what the person said.

   Three things are new:
   - **Fixed opening and closing.** The opening says how many rules the earlier answers covered. The closing says the record is for the person and their oncologist.
   - **No verdict words in a question.** A worded question containing one ("to check your eligibility") is replaced with the rule in its own words. This happened once on dev.
   - **Stop.** A check can end partway, and its rules not yet asked are recorded as not asked.

   Since slice 0009, the reading prompt (`READ_SYSTEM_PROMPT`) also says:
   - **an exclusion is restated by its meaning,** even when its text reads as what the person must be;
   - **a rule that applies only if something is true keeps its "if"** in the agent's restatement, and a permission ("may have had…") stays one;
   - **"does-not-apply" covers an unmet "if",** as well as a group the person isn't in. Against "The person is not pregnant", a man's "I'm not pregnant" reads "holds".
5. **Record** (`record.ts`). Every criterion lands in exactly one section:

| Section | What's in it |
| --- | --- |
| What your earlier answers covered | carried rules, each with the question the conversation asked and what the person said |
| What you told the check | rules answered here, each with the person's words, and "May not fit" or "Nothing here conflicts with what you said" |
| Needs your records or your oncologist | rules the person didn't know or skipped, rules only the chart can settle, lab values |
| About the trial, not you (folded) | rules about the trial's own procedures |
| To ask your oncologist | every "may not fit", every rule needing records, every earlier "I don't know" |

   - **A rule for one part of the trial** (the parse's `appliesTo`) shows that part, and reads "May not fit one part of the trial". Since slice 0009 the counts sentence sets those apart: "1 rule may not fit what you said. 2 more are for one part of the trial, which you may not be in." They come last on "To ask your oncologist", each with "Which part of the trial would I be in, and is this rule for it?"
   - **A trial whose rules can't be parsed** gets a shorter record. It shows the rules the mapper read, with the earlier answers beside them, and says it wasn't checked.
   - **A list the trial accepts any one of** (since slice 0010): when the parse marks rules with a shared `anyOf` label, the record reads them as one rule. Each item shows "One of a list: the trial asks for any one of these." The list "may not fit" only when every item does, and then counts once. No parse in use carries marks today (below), so no record shows one.
   - **There is no field for a verdict.** "May not fit" is the only word for a conflict, as on the list.

**What changed at Gate 1.** Dev's first run failed the bar on one worded question with "eligibility" in it. Four revisions followed, none of which changed a prompt:
- the verdict-word question became the fixed one;
- each earlier answer shows the question it answered, because a wrong link otherwise closes a rule silently;
- an earlier "I don't know" goes on the list to ask;
- a rule for one part of the trial says so.

Dev was run again, and the owner then chose to spend held-out's one look.

## How it was measured

- **The pairs:** the top three trials on each of the 20 made-up patients' lists (the conversation's arm, `06-8eea38fafad5.json`). That gives 9 dev pairs and 50 held-out.
- **The labels** (`evals/cases/check/pairs.json`, [LABELLING.md](../evals/cases/check/LABELLING.md)) were written from the patient's file and the trial's text alone, before any trial was parsed.
  - A pair is **clearly ruled out** when a rule's plain words exclude the patient's record. The rule must need no medical knowledge beyond common drug names, and must not be about labs, the chart, or one part of the trial when another part fits.
  - 20 of 59 pairs are. Most of them (10) are a biomarker the record says was tested and not found.
- **The simulated patient** (`evals/participant/patient.ts`) answers from the patient's file: what they know in their own words, "I don't know" for the rest. It never sees the agent's state. A second model call checks each reply against the file, and findings from a flagged reply aren't scored.
- **The measures** (`evals/check/metrics.ts`):
  - **saved:** carried rules out of all the rules the agent could ask;
  - **caught:** a labelled rule's quote overlaps a criterion whose record line says "may not fit", by the link's rule. Its route is "carried" or "asked";
  - **knowable:** the patient knows every fact the label turns on;
  - **missed,** with why: no conflict on the record, or left unknown or for the records;
  - **false alarm:** a pair not clearly ruled out with any "may not fit";
  - **guards:** verdict words, unknowns missing from the record, and the list's order before and after.
- **Repeats:** an asked question whose reply drew on a fact the conversation had asked, by the simulated patient's own report.
- **Results** are in `evals/results/check/`: [dev `02-1db863f7b74c.json`](../evals/results/check/dev/02-1db863f7b74c.json) and [held-out `01-1db863f7b74c.json`](../evals/results/check/01-1db863f7b74c.json), with every transcript under `runs/`. `--check` regrades each from its transcripts with no model. Held-out was run once, and refuses a second run.

| Measure | Dev (9 pairs) | Held-out (50 pairs) |
| --- | --- | --- |
| Questions saved | 46 of 169 (27%) | 330 of 1,236 (27%) |
| Asked; counted as repeats | 110; 68 | 973; 495 |
| Clearly ruled out, caught | 0 of 4 (0–49%) | 5 of 16 (14–56%): 1 carried, 4 asked |
| …of those the person could know | 0 of 3 (0–56%) | 5 of 9 (27–81%) |
| Missed: no conflict; unknown or records | 3; 1 | 6; 5 |
| False alarms | 3 of 5 (23–88%) | 27 of 34 (63–90%) |
| Verdict words; unknowns missing; orders moved | 0; 0; 0 | 0; 0; 0 |
| Fidelity flags; findings excluded | 25; 46 | 263; 236 |

Intervals are Wilson 95%. Held-out took 7.8 hours on one machine. Trials with 50 to 75 parsed rules took up to 52 minutes each.

### False alarms

On dev, the 17 false-alarm lines were read one by one. They came from four patterns:
1. **A list of cancers parsed as one requirement per cancer type.** "No, I don't have breast cancer" then reads as a requirement not met.
2. **A permission parsed as a requirement.** "Patients with treated brain metastases may participate…" then flags someone without brain metastases.
3. **A rule for one part of the trial.** It now says so, and since slice 0009 the record counts it apart and asks which part the person would be in. This measure still counts it.
4. **"Not about me" read as "no".** "No, I'm a guy" to a contraception rule.

Patterns 1, 2 and 4 come from the inherited parser and reader.

On held-out, read only for counts, so nothing was tuned on it, there are 102 false-alarm lines over 27 pairs:
- **45 are rules for one part of the trial.** On 2 pairs, every flag is one of those.
- **75 are under "Needs your records".** That's a rule only the chart can settle, where what the person said would conflict.
- **None come from an earlier answer.**

### What slice 0009 changed

Slice 0009 read every "may not fit" line on NIH-TrialBench's dev pairs ([benchmark.md](benchmark.md#the-check-own-labels-and-clinicians)) and placed each one: in the parse, the agent's restatement, its reading, or the code. None came from the code. Pregnancy and conditional rules came from the restatement dropping a rule's "if", and from the reading getting the pregnancy example the wrong way round. So the slice changed the reading prompt and the record's counts, not the parser.

Dev was rerun from the full summary only, on the same model and settings ([`dev/02-17a5dbee2eb0.json`](../evals/results/benchmark/check/dev/02-17a5dbee2eb0.json)):
- **Of the six full-summary lines from pregnancy and conditional rules, four are gone and were read right.** Two are still there: a permission ("may have received") restated as a requirement, and a contraception rule the parser joined to who it's for.
- **The false-alarm rate didn't move.** Leaving out rules for one part of a trial, 5 of 9 eligible pairs were flagged before and 5 of 9 after, the same five. Each pair that lost a line kept another: an "or" list, the trial's own "solid tumors", or one of two new lines where an "I don't know" in 0008 became an answer this time. Counting every line, as 0008 did, 8 of 9 became 7 of 9.
- **The widened "does-not-apply" didn't overreach.** It was read 7 times, each on a rule for a group or a step of the trial the person isn't in.

Held-out stayed unread: the owner kept it for a fix that can move the rate.

### What slice 0010 tried

"Or" lists are the largest cause of false alarms left in one place. A trial open to "squamous cell, adenocarcinoma, or renal medullary carcinoma" was parsed as three requirements, so a person with one of them "may not fit" the other two. On 0009's dev rerun, four counted lines came from this, on two eligible pairs.

Slice 0010 kept the split and added a mark: the parser gives every item of one list the same `anyOf` label, code drops a mark it can't trust (a list of one, mixed polarity or parts, an exclusion list), and the record reads a marked list as one rule. The code is in, tested, and inert: the parser's prompt doesn't ask for marks.

The prompt that did ask was tried twice, on the five hand-labelled protocols and NIH-TrialBench dev's 12 trials, on the local model ([gate-1-parser.md](../work/0010-or-lists/gate-1-parser.md)):
- **Both tries marked the two target lists right.** Re-read with 0009's stored answers, all four lines lose their "may not fit".
- **Both also changed how other trials were split, and marked the wrong things.**
  - The first try turned one trial's exceptions to an exclusion ("…with exception of: eczema, vitiligo…") into rules a person must meet. Nearly everyone would "may not fit" them.
  - The second fixed that, but marked "all of the following criteria are met" and a block of ten required lab values as "any one of these". That would hide real conflicts.
- **Against the hand labels, the parser split closer to them** (strict recall 77.8% before, 84.9% and 82.1% in the two tries), but type accuracy fell to 86.5% on the second.

**The owner stopped at the first gate,** before any check: a third wording tuned on the same 12 trials would be fitting the prompt to dev. Both tries' parses and grades are committed (`data/criteria/trialbench/…-08edc407-n2/` and `…-d62e4ce7-n2/`, `evals/results/criteria/`).

**What it points to.** The trial's own words tell the two kinds of list apart. Every right list followed "one of the following", an item ending "or", or a list of kinds ("histologies"). Every wrong one followed "all of the following", "as defined below" or "except for the following". Marks made in code from those words would need no model and no change to the parser.

### Repeats

The repeat count is high and overstated. It counts a reply that drew on an asked fact, whether or not the question repeated one. "Have you been told you have separate tumor nodules?" got "They told me it's in my chest", which counts. Some repeats are real: questions the conversation asked but the mapper didn't tie to the rule.

## On the page

See [page.md](page.md#the-check). `npm run app -- --fake` checks only trials with a committed parse. It asks each rule in its own words and takes taps only.

## Limits

- **The inherited parser isn't measured on these trials.** It was measured on 12 pinned protocols in the prescreening repository. A rule it drops can't be caught, and the false-alarm patterns above are its structure. Fixing them is a parser change.
- **Against clinicians' labels it flags almost everything.** On NIH-TrialBench's dev pairs, from slice 0008, it flagged 8 of 9 trials clinicians called eligible from the full clinical summary, and 4 of 9 from a patient's account. Its catches on ineligible pairs came from parts of the trial the person isn't in. Slice 0009's prompt fixed most of the pregnancy and conditional lines, and the rate stayed at 5 of 9 outside parts ([above](#what-slice-0009-changed)). Held-out is still unread ([benchmark.md](benchmark.md)).
- **What still causes false alarms:**
  - **"or" lists** the parser splits into one requirement per alternative. Slice 0010's record can read them as one rule, but nothing marks them yet;
  - **conditions the parser drops or joins,** which no prompt can bring back;
  - **the restatement,** which still turns some permissions into requirements, and on one dev pair turned an inclusion upside down;
  - **no judgment of purpose:** the check reads rules, so a trial for another purpose is flagged only on its parts, if at all.
- **Slice 0009's change was measured from the full summary only.** The account arm wasn't rerun, and 0007's own held-out numbers above were measured before it.
- **The link inherits the mapper's misses,** about a quarter of the rules it should map. A missed link becomes a question asked again. A wrong link closes a rule with an answer to a different question. The record shows that question beside the rule, so the person and their oncologist can see it, but nothing flags it. Two of dev's misses happened this way.
- **One author** wrote the patients, the labels and the spec. The labels were written before any parse, from text alone.
- **The simulated patient is a model.** It invents negatives it was told to say "I don't know" to; most of held-out's 263 flags are those. It missed one known fact on dev, a drug its file says it took. Repeats rest on its own report of what it drew on.
- **59 pairs.** The intervals are wide.
- **The 14 unmarked trials for other cancers** from slice 0005 aren't among the picks, so whether the check would catch them isn't measured.
- **On a hosted model the check is unmeasured,** and no schema is sent for the agent's calls. A reply the model can't return as JSON falls back to the taps. The page says the check is unmeasured there.
- **The record's words were written here** and reviewed by no clinician.
