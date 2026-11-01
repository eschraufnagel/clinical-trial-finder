# The check: a picked trial's own rules

The conversation ([questions.md](questions.md)) orders the trials by 31 facts. Most of a trial's rules about a person aren't among them, and a hint can't remove a trial, so clearly wrong trials can still reach the top. This part goes deeper on the few a person picks. They tick up to three trials on their list. For each one, the screening agent works through the trial's own rules, skipping what the conversation already settled. Each trial ends in a record for the person and their oncologist.

Built in slice 0007. The record is in [`work/0007-deeper-check/`](../work/0007-deeper-check/), with its gate write-up, [gate-1-dev.md](../work/0007-deeper-check/gate-1-dev.md), and dev's records as text, [gate-1-records.txt](../work/0007-deeper-check/gate-1-records.txt).

```
npm run check:label-show -- p08 NCT05579366     a patient and a trial's rules, for labelling
npm run check:parse -- --set dev|heldout        parse the picked trials' rules, on the local model
npm run check:eval -- --dev                     check the dev pairs, and write a result
npm run check:eval -- --check [--dev]           regrade the latest result from its transcripts
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
5. **Record** (`record.ts`). Every criterion lands in exactly one section:

| Section | What's in it |
| --- | --- |
| What your earlier answers covered | carried rules, each with the question the conversation asked and what the person said |
| What you told the check | rules answered here, each with the person's words, and "May not fit" or "Nothing here conflicts with what you said" |
| Needs your records or your oncologist | rules the person didn't know or skipped, rules only the chart can settle, lab values |
| About the trial, not you (folded) | rules about the trial's own procedures |
| To ask your oncologist | every "may not fit", every rule needing records, every earlier "I don't know" |

   - **A rule for one part of the trial** (the parse's `appliesTo`) shows that part, and reads "May not fit one part of the trial".
   - **A trial whose rules can't be parsed** gets a shorter record. It shows the rules the mapper read, with the earlier answers beside them, and says it wasn't checked.
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
3. **A rule for one part of the trial.** It now says so, and still counts.
4. **"Not about me" read as "no".** "No, I'm a guy" to a contraception rule.

Patterns 1, 2 and 4 come from the inherited parser and reader.

On held-out, read only for counts, so nothing was tuned on it, there are 102 false-alarm lines over 27 pairs:
- **45 are rules for one part of the trial.** On 2 pairs, every flag is one of those.
- **75 are under "Needs your records".** That's a rule only the chart can settle, where what the person said would conflict.
- **None come from an earlier answer.**

### Repeats

The repeat count is high and overstated. It counts a reply that drew on an asked fact, whether or not the question repeated one. "Have you been told you have separate tumor nodules?" got "They told me it's in my chest", which counts. Some repeats are real: questions the conversation asked but the mapper didn't tie to the rule.

## On the page

See [page.md](page.md#the-check). `npm run app -- --fake` checks only trials with a committed parse. It asks each rule in its own words and takes taps only.

## Limits

- **The inherited parser isn't measured on these trials.** It was measured on 12 pinned protocols in the prescreening repository. A rule it drops can't be caught, and the false-alarm patterns above are its structure. Fixing them is a parser change.
- **Against clinicians' labels it flags almost everything.** On NIH-TrialBench's dev pairs, from slice 0008, it flagged 8 of 9 trials clinicians called eligible from the full clinical summary, and 4 of 9 from a patient's account. Its catches on ineligible pairs came from parts of the trial the person isn't in. The false alarms have the same causes as above, plus pregnancy rules read the wrong way round and conditional rules read as requirements. Held-out was left unread, for after those are fixed ([benchmark.md](benchmark.md)).
- **The link inherits the mapper's misses,** about a quarter of the rules it should map. A missed link becomes a question asked again. A wrong link closes a rule with an answer to a different question. The record shows that question beside the rule, so the person and their oncologist can see it, but nothing flags it. Two of dev's misses happened this way.
- **One author** wrote the patients, the labels and the spec. The labels were written before any parse, from text alone.
- **The simulated patient is a model.** It invents negatives it was told to say "I don't know" to; most of held-out's 263 flags are those. It missed one known fact on dev, a drug its file says it took. Repeats rest on its own report of what it drew on.
- **59 pairs.** The intervals are wide.
- **The 14 unmarked trials for other cancers** from slice 0005 aren't among the picks, so whether the check would catch them isn't measured.
- **On a hosted model the check is unmeasured,** and no schema is sent for the agent's calls. A reply the model can't return as JSON falls back to the taps. The page says the check is unmeasured there.
- **The record's words were written here** and reviewed by no clinician.
