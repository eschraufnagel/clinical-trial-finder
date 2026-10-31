# The page: the conversation, the list and the sheet

The search ([search.md](search.md)), the trials' readings ([facts.md](facts.md)) and the questions ([questions.md](questions.md)) were built as commands. This part puts them on a page that runs on this computer.

Built in slice 0004. The record is in [`work/0004-shortlist-handoff/`](../work/0004-shortlist-handoff/), with two gate write-ups:
- [gate-1-order.md](../work/0004-shortlist-handoff/gate-1-order.md), the order;
- [gate-3-words.md](../work/0004-shortlist-handoff/gate-3-words.md), the hosted reading run and the page's words.

Slice 0005 moved trials for other cancers below the short list ([`work/0005-other-cancers/`](../work/0005-other-cancers/); [gate-3-page.md](../work/0005-other-cancers/gate-3-page.md) has the words and the rerun).

```
npm run app                    the page, at http://127.0.0.1:5025, on the model chosen in Settings
npm run app -- --fake          the same, with a scripted reader: no model is called
npm run test:e2e               the browser test, on --fake
```

Use made-up answers. It's a proof of concept.

## What a person does

1. **Says where to look:**
   - ZIP code;
   - how far they could travel (25, 50, 100 or 250 miles, or anywhere);
   - age, and sex as the trials ask it.

   Lung cancer (non-small cell) is the only cancer offered, because the questions and the trials' readings cover it alone.
2. **Answers the questions,** one at a time: the 8 everyone is asked, then up to 8 chosen for them ([questions.md](questions.md)). Each can be answered in their own words, or by tapping one of the question's answers or "I don't know".
3. **Confirms each reading.** A typed answer comes back as "I read that as: Yes, and the cancer grew during or after it." with **That's right** and **Change it**. Nothing typed counts until it's confirmed (0003 Gate 3).
4. **Can stop at any point** with "Show me the list now".
5. **Gets the list:**
   - the 10 trials at the top of the order;
   - every other trial the search kept, below them;
   - their answers, each of which can be changed. A change reorders the list. No more questions follow it.
6. **Prints the sheet** for their oncologist, or saves it as a PDF. Nothing sends it anywhere.

## The confirm step

`src/server/finder.ts`.
- **The model reads the reply onto one of the question's fixed answers,** or onto "I don't know", exactly as measured in 0003. The page shows that reading back. Every reading is confirmed, "I don't know" included.
- **A tapped answer needs no confirm:** the person chose the answer's own words.
- **When a reply can't be read, the question offers its answers instead,** and says why. That covers:
  - a reading the model got wrong in shape;
  - a model that can't be reached;
  - no key saved;
  - a conversation that has reached its cost cap.

  The page works with no model at all.
- **A typed reply that isn't confirmed changes nothing:** no trial moves and no question leaves the sheet.

## The order

**Gate 1 changed it** ([gate-1-order.md](../work/0004-shortlist-handoff/gate-1-order.md)). 0003's order put the trials the model read least at the top: fewest "may not fit" hints first, and a trial with fewer readings has fewer chances of a hint. Three orders were compared on the 3 dev patients, and the owner chose `read-first`:
1. fewest whole-trial hints;
2. then fewest hints about one part of the trial;
3. **then trials with readings before trials with none;**
4. then the nearest site;
5. then the trial id.

**On held-out, scored a second time with this order:**
- short-list places held by trials with no readings fall from 30 to 2;
- agreement with the full record falls from 89% to 88%;
- would-flag rises from 12% to 13%.

Part of that rise is structural: a trial with no readings can't be flagged, so replacing one can only add flags. The numbers are in [questions.md](questions.md).

**Slice 0005 put one key in front: `other-last`.** A trial the search marked as about other cancers only ([search.md](search.md)) comes after every unmarked one, and the rest of the order is `read-first`. On held-out, scored a third time:
- short-list places held by trials not for NSCLC fall from 35 of 162 to 6, for 15 to 5 of 17 patients ([`06-8eea38fafad5.json`](../evals/results/questions/06-8eea38fafad5.json), counted by `npm run other:eval -- --places`);
- no marked trial is on any held-out short list;
- agreement with the full record falls from 88% to 85%, and would-flag rises from 12.9% to 17.6%, in the conversation arm.

The rise is the same blind spot as above. None of the 35 places was flagged by the full record, because no NSCLC fact maps onto a prostate trial's rules. 9 of the 32 trials that replaced them are flagged.

**Also compared, and not chosen:** "most of your answers checked first". It put rule-heavy trials from anywhere in the country first, a median of 287 miles away against 100, and more of them flagged by the full record.

## What the list says

`src/shortlist/explain.ts`. For each trial:
- **Title and interventions,** in the registry's words.
- **Phase,** in a sentence (`src/shortlist/phase.ts`). For example: "Phase 1: the first tests in people, mostly to find a safe dose and learn the side effects. Whether it works is a later question."
- **The nearest site and its distance,** and whether the record looks stale.
- **How much of its rules were read:**
  - "Its rules were read for 7 of the 31 questions here."
  - A trial read for fewer than a third of the questions leads with "Few of this trial's rules could be checked against your answers." (Gate 3).
  - A trial with no readings says so.
- **What the answers checked:** each question the trial's rules ask about that the person answered, with their own words. "Nothing in what was read of its rules conflicts with these answers."
- **May not fit:** the person's answer, then the trial's rule, quoted, with "The reading of rules is automatic, and wrong about a quarter of the time. Ask your oncologist."
- **Still unknown,** grouped by who would know: "You could find out", "Your oncologist would know", "In your records".
- **A link to the full record** on ClinicalTrials.gov. The person opens it; the app makes no request.
- **On a trial the search marked** (slice 0005), first, before the phase: what its record names, then the record's own words. "This trial's record names other cancers: prostate cancer. Non-small cell lung cancer isn't among them. Ask your oncologist whether it takes people with your kind of lung cancer." The sheet keeps that line for a marked trial on the short list.

## The sheet

`src/shortlist/sheet.ts`:
- what the person was asked, their words and the answer they confirmed;
- the open questions, most short-list trials first, with how many ask;
- what to bring (the biomarker report, the pathology report, scan reports, a list of treatments with dates), from the open questions;
- the short list, with each trial's "may not fit" rules in its own words.

**Every unknown reaches the sheet.** For every made-up patient, every fact a short-list trial asks about that the person didn't answer is either a question on the sheet or a "may not fit" on that trial. `questions:eval` records this as `sheetMissing` and refuses to write a result with any: 0 in all 169 rows of [`05-7543ffb2cb2e.json`](../evals/results/questions/05-7543ffb2cb2e.json).

## Never a verdict

No text the page writes says a person is eligible, qualifies, matches or fits, or should or can join, or that a trial is best for them. `src/shortlist/words.ts` lists the patterns. They're held three ways:

| Where | Over | Result |
| --- | --- | --- |
| `questions:eval` (`verdictHits`) | the list and sheet for all 20 made-up patients, in every arm | 0 in all 169 rows |
| `tests/web/copy.test.ts` | every fixed sentence on the page and in the conversation. No word may be written straight into a component | passes |
| the browser test | every screen's visible text | passes |

The trial's own words and the person's own words are kept apart from the page's, and aren't scanned. A trial's title may say "eligible patients", and a person may type "am I eligible?".

**The patterns catch words, not tone,** so Gate 3 had the owner read two made-up patients' whole pages ([gate-3-pages.md](../work/0004-shortlist-handoff/gate-3-pages.md)). It added the "Few of this trial's rules could be checked" line. Everything else stood.

## Settings

`src/server/settings.ts`, `src/server/models.ts`, adapted from the prescreening repository.
- **The local model is the default,** and nothing leaves the computer with it.
- **A hosted model:** a person may choose Anthropic, OpenAI or xAI and save their own key.
  - The key is kept in `local/settings.json`, gitignored, readable only by its owner.
  - It's shown only by its last four characters, and it's never read from `.env`.
  - **Test** reads one made-up reply through the chosen model.
- **While a hosted model is chosen,** the page says beside the text box that what's typed goes to that provider.
- **Each conversation:**
  - keeps the model it started on;
  - has a cost cap, $0.10 by default, from $0.05 to $5;
  - logs what it spent to `local/spend.jsonl`.

  On Claude Haiku 4.5 a conversation is estimated at under a cent.
- **Measured models:** beside each confirm the page says which model read the reply. Settings shows what each model's held-out reading run found, or that it wasn't measured. Only a run of the request the app sends now counts: the current prompt, and for Anthropic the reader's answer schema (slice 0006). Both runs below are on the same 527 replies from 17 made-up patients, with the same prompt (`8cb01749`), at temperature 0 ([questions.md](questions.md#on-a-hosted-model)).

| Model | Replies it could read | Of those stating an answer, read exactly | "Don't know"s turned into an answer |
| --- | ---: | ---: | ---: |
| Qwen3.6-35B-A3B, 8-bit, local | 527 of 527 | 326 of 326 | 1 of 201 |
| Claude Haiku 4.5, schema enforced | 527 of 527 | 324 of 326 | 0 of 201 |
| Claude Sonnet 5, GPT-6 Luna, Grok 4.3 | not measured | | |

**Haiku's request carries the answer's shape** since slice 0006: Anthropic's structured outputs hold it to one of the question's answer ids, or "unknown". In slice 0004, without it, Haiku could read only 237 of 527 replies (45%): it explained around its answers, which ran past the reader's 64-token limit or wrapped the JSON in prose the adapter doesn't accept. With it, every reply is read.

**Two plain "No"s were read as "Yes"** (heart trouble in the last six months; spread to the lining of the brain). The local model, and Haiku without the schema, read both as "No". On the page the person sees the reading and corrects it; confirmed, it would only add a "may not fit" hint, which never removes a trial.

## How the page is held to its rules

- **Network:**
  - the server listens on 127.0.0.1 only (`src/server/start.ts`) and refuses a request addressed to another host;
  - the page fetches only its own paths (`src/web/api.ts`, `src/transport/web/client.ts`);
  - the one call off the computer is to the model provider chosen in Settings, through `createAppAdapter`, named in `src/server/models.ts` alone.
- **Settings writes** need the page's own origin and a JSON body.
- **The conversation** goes through the transport (`MessageTransport`), which gained one thing in this slice: an agent message may offer choices, and a reply may be a choice. A choice the last message didn't offer is refused.
- **`tests/boundary.test.ts`** holds all of this, and that nothing under `src/web/` uses Node.
- **The browser test** runs only with `--fake`.

## Limits

- **The top of the list is still what the model read.** `read-first` removes trials with no readings from the short list. Short-list trials still carry fewer readings than the average (a ratio of 0.92 on held-out). And "nothing conflicts" still sits on trials whose readings missed the rule that matters. Two made-up patients show it:
  - a first-line trial for someone after one line of treatment;
  - a trial for untreated small-cell lung cancer.

  The "few of its rules" line and the read count say so; they don't fix it.
- **Trials for other cancers, partly.** Since slice 0005 a marked trial goes below the short list, but the check marks 29 of 43 held-out trials not for NSCLC. On held-out short lists 6 of 162 places still go to trials limited to other cancers: blood cancers, and breast or ovarian trials listed under "solid tumor". One relevant trial is moved down by mistake (NCT03947385; [search.md](search.md)).
- **No plain-language summary** of what a trial tests: the registry's title and interventions stand in. No contacts either; the record's link stands in.
- **The phase sentences and the page's words were written here** and reviewed by no clinician.
- **Conversations live in the server's memory.** A restart forgets them.
- **The readings behind `--fake` are clean replies by construction** ([questions.md](questions.md)). Real replies will be read worse, and that's what the confirm step is for.
- **One hosted model is measured.** Claude Haiku 4.5, with the answer's schema enforced, read every held-out reply, and read 2 of 326 stated answers wrong, each a "No" read as "Yes". The local model read none wrong. Claude Sonnet 5, GPT-6 Luna and Grok 4.3 aren't measured, and only the Anthropic request carries the schema.
- **One cancer, one snapshot, one mapping run.**
