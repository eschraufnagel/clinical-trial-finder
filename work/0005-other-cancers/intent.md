# intent: 0005 trials for other cancers

**Author:** the repository owner
**Status:** Draft
**Date:** 2026-10
**Scope:** One slice. Find the trials the search keeps for a lung cancer patient that are for other cancers only, count how many short-list places they take, and stop them from taking those places without losing a trial a lung cancer patient could join. Deterministic: no model. No per-trial screening, which moves to the next slice.

---

## In plain words

A person with lung cancer gets a short list of about ten trials. Some of them are for prostate cancer, or lymphoma. Nothing they could have answered would have moved those trials down, because the questions are about lung cancer, and the trials got onto the list because their registry records say something broad, like "metastatic cancer", or name a gene change that lung cancer also has.

Those trials waste places on a short list that's meant to be short, and they make the whole list look careless. Worse, for someone who isn't a doctor, a prostate cancer trial on their list may look like a trial for them.

This slice counts how often it happens, then adds a check after the search that notices a trial whose record is about other cancers only. Such a trial moves below the short list, with a line on its card saying which cancers its record names. It isn't removed. A trial open to many cancers, which is often the trial that matters most to someone out of standard options, must not be caught by the check, and the measurement is built to show whether it is.

## Problem

**Trials for other cancers reach lung cancer patients' short lists** (ROADMAP open question 6, added in 0004). `docs/page.md`, Limits: "Nothing in a lung cancer person's answers flags them, so they can reach the short list. That's a search problem (0001), and the next slice to take up." 0004's Gate 3 page for a made-up Portland patient had a castrate-sensitive prostate cancer trial (NCT05422911) third and a B-cell lymphoma trial (NCT05544019) fourth.

**The search was built to keep them.** 0001 put recall first: "A trial wrongly kept costs the next stage a little work; a trial wrongly dropped can never be found again" (`docs/search.md`). On its 300 held-out labels, 11 of the 87 trials kept weren't for NSCLC: four small cell lung cancer trials, matched by "lung cancer", and seven whose conditions match a generic term while their eligibility text lists other cancers only. That was accepted in 0001 because the next stage would sort them. It doesn't: the fact vocabulary has no fact a prostate trial's rules map onto for a lung cancer patient, so no hint moves it down.

**There are three ways in, not two.** Read while writing this intent, against the committed result (`evals/results/questions/05-7543ffb2cb2e.json`) and the search's own `reasonsFor`:
- **a generic term beside another cancer:** the prostate trial's conditions are "Metastatic Cancer; Neoplasm, Prostate; …", and "metastatic cancer" makes it "open to many";
- **a lung biomarker named in another cancer's condition:** NCT05544019 and NCT06724237 are lymphoma trials kept because a condition says "ALK-Positive Large B-Cell Lymphoma" or "ALK-Negative", and "alk" is on the NSCLC biomarker list;
- **"lung cancer" matching small cell lung cancer,** as 0001 found.

**How many places they take isn't known.** On the 17 held-out patients' short lists (conversation arm, `shortlist` scorer, `read-first`), 57 of 162 places go to trials kept by a generic term alone, and 11 to trials kept by a name alone. Many of those are real basket trials that a lung cancer patient could join: TAPUR is on every patient's list, and should be. Which ones aren't for NSCLC needs labels nobody has written yet. Of the 127 distinct trials on those lists across all 20 patients, 19 were in 0001's random 300.

**Conditions alone can't tell them apart.** In 0001's held-out labels, "Advanced Solid Tumor" alone is a trial for NSCLC in some records and not in others, where the eligibility text limits it to listed cancers. "Clear Cell Renal Cell Carcinoma; Solid Tumors" is open to NSCLC. A check that reads conditions alone would catch basket trials; one that reads eligibility text must do it without a model, since nothing under `src/search/` reaches a model and no rule a model reads removes or demotes a trial (`CLAUDE.md`).

**The reader's prompt on hosted models** is the other thing 0004 left. On Claude Haiku 4.5 it could read 45% of held-out replies, every one of them right; 87 outputs were cut off at 64 tokens, and 203 weren't JSON the adapter accepts (`work/0004-shortlist-handoff/gate-3-words.md`, "Gate 2, as run"). Nothing is read wrong, because the rest fall back to the buttons. It's a separate change, to a different part, and it spends money to measure. Open question 2 asks where it goes.

## Proposed outcome

At the end of this slice:

1. **Labels for the question 0001 asked, on the trials that matter here.** Every trial on a short list in 0004's committed results, and a fresh random sample of the NSCLC candidates, labelled by 0001's convention (`evals/cases/search/ANNOTATION.md`) before any check is written. Then the size of the problem is known: short-list places held by trials not for NSCLC, per patient, on the committed results.
2. **A deterministic check after the search** that marks a trial whose record is about other cancers only, with the words that decided it: the conditions or eligibility passages that name the other cancers. Tuned on dev labels, measured once on held-out labels, and adopted at a gate.
3. **The marked trials move below the short list, and stay.** A mark is a key in the order, like a hint: a marked trial sorts after every unmarked one, and every trial the search keeps is still on the page. Its card says, in the record's own words, which cancers the record names, and to ask the oncologist whether it takes lung cancer.
4. **The other two ways in, caught by the same mark,** not by changing the search: a trial whose only NSCLC name is a biomarker inside another cancer's condition ("ALK-Positive Large B-Cell Lymphoma"), or "lung cancer" inside "small cell lung cancer", is marked too. The search's reasons don't change, so it keeps the same 1,129 NSCLC candidates, 0001's recall of 76 of 82 stands, and every candidate still has its mappings.
5. **Held-out patients rerun once** with the check, reported beside 0004's result: short-list places held by trials not for NSCLC, before and after, and agreement with the full record's short list.
6. **The page shows the mark,** on the card and the sheet, in words that make no verdict, held by 0004's verdict-word test.

**Absent on purpose:** no model reads anything new; no change to the fact vocabulary, the mappings, the questions or the reader; no new snapshot; no other cancer type offered on the page; no per-trial screening (renumbered 0007, open question 2); no change to the reader's prompt (open question 2).

## Affected users and systems

**A person using the page,** whose short list holds fewer trials for other cancers, and who can still see every trial the search kept.

**The owner,** who decides at gates: whether the labels and their convention hold, which check is adopted, and whether the card's words imply anything.

**The deeper check,** which will start from short lists with fewer trials it would have had to rule out by cancer type.

**New:** a check in `src/search/` and the words it uses, as data under `data/cancer-types/`; labels under `evals/cases/search/`; a measurement in `evals/search/`. **Changed:** `src/search/` (the mark on each candidate), `src/shortlist/order.ts` (a new order with a key for the mark), the card and sheet in `src/shortlist/` and `src/web/`, `docs/search.md` and `docs/page.md`, and `work/ROADMAP.md`. **Read only:** the snapshot, the mapping run, the patients. **Not touched:** the mapper, the reader, the parser, the screening agent, `src/models/`.

**No new dependency.** No model run, local or hosted, and no spend.

## Constraints

- **Deterministic.** The check reads the record's words with fixed rules and lists, no model. `src/search/` reaches no model, and `tests/boundary.test.ts` already says so.
- **A mark moves a trial down; it doesn't remove it.** Every trial the search keeps stays on the page, as in 0003 and 0004. Open question 3 asks whether a narrow subset should be removed at the search instead.
- **No relevant trial is marked without being counted.** The cost of the check is relevant trials it marks, reported on held-out with each one named. A bar is set before held-out is scored.
- **Labels come first.** Every label is written, from `search:show` output only, before the check's first line is written. The held-out labels aren't read while tuning. A separate agent relabels a sample blind, as in 0001.
- **The search keeps what it kept.** `reasonsFor` and `nsclc.json` don't change, so 0001's result still passes `search:eval -- --check`, and the mapping run still covers every candidate. 0003's and 0004's results still pass `--check` under the orders they record.
- **Held-out patients are looked at again, and said so.** They were scored in 0003 and rerun in 0004. One more rerun, reported beside both, with a note that they've been seen.
- **No verdict.** The card says what the record names, never that a trial is "not for you" or that the person "doesn't qualify". The words go through `src/web/copy.ts` and the verdict-word test.
- **Months, no PHI, no tool attribution,** as every slice.

## Open questions

1. **Does this slice go before the deeper check?** The roadmap's table has 0005 as the deeper check. Its open question 6 and `docs/page.md` both say trials for other cancers are "the next slice to plan" and "the next slice to take up". Leaning yes: this is 0005, and the deeper check and benchmark move down in step 1 (to 0007 and 0008 if open question 2 adds a slice, else 0006 and 0007). A deeper check started from short lists holding prostate trials would spend its questions ruling them out.
2. **Where does the hosted reader's prompt go?** It isn't this slice's problem, and fixing it means a hosted run to measure. Leaning: its own small slice, after this one and before the deeper check, added to the roadmap in step 1 as 0006, so the deeper check becomes 0007. The alternative is to leave it as a known limit until a hosted model matters more.
3. **Move down, or remove?** Removing at the search is allowed by the constraints, since the cancer type is something the person said, not an unknown. But 0001's rule is that a trial dropped there can never be found, and a check reading text without a model will be wrong sometimes. Leaning: move down and mark, for every marked trial. Remove nothing. The gate can choose to remove the narrowest class, small cell only or blood cancers only, if held-out shows the check never marks a relevant trial in it. That would change the search's candidates, and so 0001's recall, and would be reported as a new search result.
4. **What does the check read?**
   - **(a) The listing:** conditions and titles name other cancers, and nothing in them names NSCLC or a generic term that stands alone.
   - **(b) The listing, then the inclusion rules:** when a generic term sits beside named cancers, read the eligibility text's inclusion section for a required diagnosis that names other cancers only, and no open phrase ("any solid tumor", "other tumor types").
   - **(c) Both, each its own mark,** so the gate can adopt one and not the other.

   Leaning (c): (a) alone catches the prostate trial only if "Metastatic Cancer" is read as part of a list, and (b) is where the basket trials are at risk. Each measured on dev, adopted at the gate on its own numbers.
5. **Which labels, and how many?**
   - **Places:** every trial on a short list in the committed `read-first` results (`05-7543ffb2cb2e.json` and `with-reads/03-7543ffb2cb2e.json`), all arms, all 20 patients: 171 trials, 24 of them already in 0001's labels, so 147 new. 23 are on both a dev and a held-out patient's list.
   - **Cost:** 150 trials drawn at random from the 1,129 NSCLC candidates, excluding 0001's labels, by `sha256("0005:" + nctId)`, held out.
   - **Dev:** 0001's 300 labels (already seen in 0001, and never tuned on) and the dev patients' short-list trials.

   Leaning: as above. 150 gives an interval of about ±5 points on the share of relevant trials marked, and the bar is about the count, not the share.
6. **What's the bar?** Leaning: on the 150 held-out candidates, no trial labelled relevant and not "unclear" is marked; at most one marked trial is labelled relevant "unclear", each named. A check that misses it isn't adopted, whatever it gains.
7. **Where do the other-cancer words live?** A list of terms naming cancers that aren't NSCLC (prostate, breast, lymphoma, small cell lung cancer, …) and a list of open phrases. Leaning: a new file beside the type's, `data/cancer-types/nsclc-others.json`, so `nsclc.json` and 0001's vocabulary checksum are untouched, and a result names the new file's checksum.
8. **What does the card say?** Leaning: "This trial's record names other cancers: prostate cancer. Lung cancer isn't among them. Ask your oncologist whether it takes people with lung cancer." with the record's words quoted. The exact words go to the gate that reads the page, as in 0004.
9. **Does the mark go on the oncologist sheet?** Leaning: only for a marked trial that still reaches the short list, which happens when a search keeps too few unmarked trials to fill it (p07 and p12 already fall short of read trials). Below the short list, the sheet doesn't list trials now, so nothing changes there.
