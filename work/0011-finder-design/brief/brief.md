# Design brief: Trial Finder, in Chart v2

For Claude Design. Slice 0011 (`work/0011-finder-design/intent.md`). Paste this brief in, and attach Chart v2's handoff and the `current/` captures listed at the end.

---

## What to design

**Trial Finder** is the sister product to **Trial Prescreening**, and both use the **Chart v2** design you already made. Prescreening is for a coordinator screening one trial. The finder is for **a person with cancer whose treatment has stopped working.** It asks them a few plain questions and searches a saved copy of ClinicalTrials.gov. Then it gives them a short list of trials to ask their oncologist about, and a sheet to print for that visit. If they want, it checks two or three trials they pick, rule by rule, and writes a record for each.

It's a proof of concept that runs on one computer, with made-up answers only. It's meant to show what's possible, so **the person's experience comes first.** Almost every screen is in Chart v2's **patient register**: Atkinson Hyperlegible, larger sizes, one spacing step up. The coordinator register (Plex Sans, denser) is for Settings, and for small data such as NCT IDs and counts.

Please design six screens, each in **light and dark**, at **desktop (1280)** and **phone (390)**:

| # | Screen | New, or adapted from Chart v2 |
| --- | --- | --- |
| 1 | Start form | new |
| 2 | The questions | adapted from the screening chat |
| 3 | The short list, with one trial card shown in full | new |
| 4 | The sheet for the oncologist, on screen and printed | new |
| 5 | The check: its questions, and then its record | the questions adapted from the screening chat; the record new |
| 6 | Settings | adapted, coordinator register |

Plus the states listed under each screen.

## Rules that can't bend

These come from the product. Where a design idea runs into one, the rule wins.

1. **Findings are words in neutral ink.** No green or red, no ticks or crosses. No colour, icon or weight changes with whether a rule may not fit. `--accent` is only for actions, links, focus and the active nav item. This applies to "May not fit", "Few of this trial's rules could be checked", a trial marked as being about other cancers, and errors too. Today the page shows these in amber and red, and that is what's being removed. Tell them apart by words, position and structure.
2. **Never "eligible", "qualified", "match", a score, a ranking, stars or a "best".** The list's order isn't a ranking, and the page says so in a note that stays.
3. **An unknown never removes a trial.** "I don't know" is always offered as an answer, and it must look as easy to choose as Yes or No.
4. **The person's words, the trial's words and the page's words are kept apart.** The trial's rules are quoted exactly, and the person's replies are shown as they typed them. Design a clear, quiet treatment for each: a quote for the trial's words, the "you" style for the person's.
5. **Keep the wording.** Use the copy below and in `current/*.txt`. If a design needs a sentence that doesn't exist, mark it as new so it can be checked.
6. **WCAG AA in light and dark.** Use Chart v2's tokens. Tap targets are at least 44 px, primary controls 48 px.
7. **Offline.** Bundled fonts only: Plex Sans, Plex Mono, Atkinson Hyperlegible.
8. **Print.** The sheet and the records print on plain paper in black, without the questions or the navigation.

## The frame (every screen)

- **Header,** as in Chart v2: the Record mark, then "**Trial Finder**".
  - Nav: **Start** · **Your list** · **For your oncologist** · **Your check** · **Settings**.
  - "Your list" and "For your oncologist" appear once a search has started. "Your check" appears once a check has started.
  - The model chip on the right, e.g. "Local model · Qwen3.6-35B-A3B-MLX-8bit".
- **Standing notice,** always visible and quiet: "This is a proof of concept, run on this computer. Use made-up answers."
- **Demo mode notice** (only when running with no model): "Scripted reader: no model is called. Typed replies are read from a fixed list."

## 1. Start form

Heading **"Where to look"**. Intro: "Lung cancer (non-small cell) only, for now. Other cancers aren't ready: the questions and trial readings cover lung cancer alone."

| Field | Control |
| --- | --- |
| ZIP code | text input |
| How far you could travel | 25 / 50 / 100 / 250 miles / Anywhere in the US |
| Age | number |
| Sex, as the trials ask it | Female / Male |

Primary button: **Start the questions**. While searching: "Searching the trials…".

This is the first thing a frightened person sees. It should feel calm and short, not like an intake form.

**States:** empty; filled; searching; an error under the form, e.g. a ZIP the app doesn't know.

## 2. The questions

The screening chat's pattern, without the coordinator's testing panel.

- **Intro,** above the first question: "A few questions everyone is asked come first, then some chosen for you. Answer in your own words, or choose an answer. "I don't know" is always fine: it never takes a trial off your list."
- **The current question,** large, in the question card. For example: "Have you had chemotherapy with carboplatin or cisplatin?" There are 8 questions everyone is asked, then up to 8 chosen for the person. There's no fixed total to show, so don't show "Question 4 of 16". "Question 4" alone is fine.
- **Answer in their own words:** the textarea labelled "Your answer, in your own words", with **Send**. Below it: "Your answers stay on this computer. Use made-up answers." (Or, on a hosted model: "While Anthropic is chosen in Settings, what you type here is sent to Anthropic. Use made-up answers.")
- **Or tap an answer:** "Not sure how to say it? Choose an answer" opens the question's fixed answers as buttons, always including **I don't know**. Example answers: "Yes, and the cancer grew during or after it" · "Yes" · "No" · "I don't know".
- **The confirm step,** which is the heart of this screen. A typed reply comes back as "I read that as: Yes, and the cancer grew during or after it." with **That's right** and **Change it**. Nothing typed counts until it's confirmed. Beside it, small: "Read by Qwen3.6-35B-A3B." On an unmeasured hosted model, add: "This model's readings haven't been measured."
- **Earlier turns:** the question, the person's words, and the confirmed reading.
- **Always available:** **Show me the list now** and **Start over**. At the end: **See your list**.

**States:** the first question; mid-conversation (`current/03`); a reading waiting for confirm (`current/02`); "Reading your answer…"; a reply that couldn't be read, so the answer buttons are offered with the reason ("Something went wrong. Try again." / **Try again**); and the end (`current/04`).

## 3. The short list

This is the most important new screen. It's long: 10 trials, then every other trial the search kept.

- **Heading** "Your list". If the person stopped early: "The questions aren't finished. This is the list so far."
- **The order note (it stays):** "Trials whose records name only other cancers come last. Before them, trials with the fewest conflicts with your answers come first. Among those, trials whose rules could be read come before trials whose rules couldn't, then the nearest. The order isn't a ranking of which trial would work for you. Nothing here says whether you could take part in any trial; your oncologist and each trial's team decide that."
- **10 trial cards,** numbered 1 to 10. A number is a position, not a rank, so it should read that way.
- **"89 more trials the search kept, in the same order"** with **Show them** / **Hide them**. These are the same cards, folded.
- **Ticking:** each card has a checkbox, **Check this trial**. Up to three. The note says: "Tick up to three trials to go through their own rules, one question at a time. Each gets a record for you and your oncologist." A fourth tick shows: "Three is the most one check takes." Then the **Check these** button ("Starting…" while it starts). Ticking changes nothing on the list.
- **Your answers,** at the bottom: each question, the person's words, the answer, and **Change** (then **Save** / **Cancel**). Note: "Changing an answer reorders the list. No more questions are asked." An unanswered question reads "Not known yet". A tapped one says "Chose from a list".

**One trial card, in full** (real example from `current/05`, trial 2):

- **Title** (registry words): "A Study of Sigvotatug Vedotin in Advanced Solid Tumors"
- **NCT04389632** · "The full record on ClinicalTrials.gov" (a link)
- **What it tests:** "sigvotatug vedotin, pembrolizumab, cisplatin, carboplatin"
- **Phase,** as a sentence: "Phase 1: the first tests in people, mostly to find a safe dose and learn the side effects. Whether it works is a later question."
- **Where:** "Nearest site: Providence Cancer Institute Franz Clinic, Portland, Oregon, 1 mile away."
- **How much was read:** "Its rules were read for 7 of the 31 questions here." When fewer than a third were read, a leading line: "Few of this trial's rules could be checked against your answers."
- **What your answers checked:** "Nothing in what was read of its rules conflicts with these answers." Then each question with the answer and "You said: …" in the person's words. For example: "Has the cancer spread to the brain? No. You said: No brain mets."
- **May not fit** (not on every card, so design it as a state; p08's top ten have none, so this example's rule is illustrative, not a real trial's words): "Your answer: Yes, I had a heart attack in April." then "The trial's rule: "No myocardial infarction within 6 months prior to enrollment"", then "The reading of rules is automatic, and wrong about a quarter of the time. Ask your oncologist." A rule for one part of the trial adds "For part of the trial: …".
- **Still unknown,** grouped by who would know: "You could find out" / "Your oncologist would know" / "In your records". For example: "Your oncologist would know: Has the cancer spread to the lining of the brain or spinal cord?"
- **About the record** (when it applies), e.g. the record looks stale.
- **A trial marked as about other cancers** (a state, below the short list): before the phase, "This trial's record names other cancers: prostate cancer. Non-small cell lung cancer isn't among them. Ask your oncologist whether it takes people with your kind of lung cancer."
- **Check this trial** (checkbox).

A card has a lot in it. Please work out what's visible at a glance and what opens (**Open** / **Close** exist today), so that ten cards can be scanned. But "May not fit" and "Few of this trial's rules could be checked" must never be hidden behind a click.

**States:** the full list; a card with "may not fit"; a card for a trial with few rules read; a marked trial; the folded "more trials"; three ticked with the fourth refused; **Check these** failing. That last one says nothing today and needs a sentence, so mark it new.

## 4. The sheet for the oncologist

The page the person takes to a visit. Plain, printable, one or two pages. It's read by a doctor in a few minutes, so Plex is fine here, but it is the person's document.

- **Print or save as PDF** (screen only).
- **Heading** "For your oncologist", then: "A list of trials to ask about, from a search of ClinicalTrials.gov as it stood in 2026-10 and a short set of questions. It doesn't say whether any trial suits this person. Their oncologist and each trial's team decide that."
- **Questions that would settle the most of these trials:** each with a count. For example: "Has the cancer spread to the lining of the brain or spinal cord? 7 of these 10 trials ask about this."
- **What to bring:** each item with the questions it answers. For example: "The biomarker (genetic test) report on your tumor: Did testing find an EGFR mutation? Did testing find a KRAS mutation?"
- **What they were asked, and answered:** question · "Said: …" (their words) · "Answer: …". 16 rows in the example.
- **The trials:** the 10, each with NCT ID, title, phase sentence, nearest site, how much was read, and any "may not fit" in the trial's words.

Full content: `current/07-sheet.txt`. Show it on screen and as the printed page.

## 5. The check: questions, then the record

**Questions.** The same pattern as screen 2, one trial at a time.
- "Checking the trials you picked", and while a trial's rules are read: "Reading the rules of "TAPUR: …"…".
- **Opening:** "These questions are about the trial "…". Your earlier answers already covered 4 of its rules. I'll ask about the rest of its rules one at a time. You can skip any question, and "I don't know" is always fine."
- **Each question** quotes the trial: "The trial asks about this: "The patient must be able to swallow and tolerate oral medication and must have no known malabsorption syndrome". Does this describe you?" The answers are **Yes** · **No** · **I don't know**, plus **Stop and show the records**. Typed replies get the same confirm step as screen 2.
- **Closing:** "Thank you, that's all my questions. Your record for this trial is ready, for you and your oncologist. They and the trial team decide whether it is right for you."

**The record**, one per trial, printable (`current/09-record.txt`; the questions aren't printed). It keeps its **five sections**, written for the person. Take Chart v2 review's visual pattern: the counts as the only summary, sections as groups, rules in protocol order, and the finding in neutral ink, identical for every outcome. Don't use prescreening's four coordinator groups.

- **Header:** NCT ID and title.
- **First line, always:** "This isn't a decision. Your oncologist and the trial team decide whether this trial is right for you."
- **Counts:** "2 rules may not fit what you said. 14 rules need your records or your oncologist." Rules for one part of the trial are set apart: "… 2 more are for one part of the trial, which you may not be in."
- **What your earlier answers covered:** each rule ("The trial requires" / "The trial excludes", then the rule quoted), with "Asked earlier: How far has the cancer spread? You said: Spread to the adrenal gland and the bones." and, where the person didn't know, "You didn't know."
- **What you told the check:** the rule, "You said: Yes", and "Nothing here conflicts with what you said." or "May not fit".
- **Needs your records or your oncologist:** lab values and chart-only rules. For example, "May not fit. Only your records can settle this, whatever you said." Long numbered lab lists, such as "1. Absolute neutrophil count ≥ 1500 µl", need a compact treatment.
- **About the trial, not you** (folded, "Show these rules"): rules about the trial's own procedures.
- **To ask your oncologist:** each item a question ("Does this rule keep this trial from being an option for me?" / "Do my records settle this rule?" / "Which part of the trial would I be in, and is this rule for it?") with the rule under it.
- **A list rule** (state): "One of a list: the trial asks for any one of these."

A record can run to 40 rules. On desktop, decide whether the summary sits beside the record (as in the Chart v2 review) or above it, and how it prints.

**States:** a trial being read; a check question; a typed reading waiting for confirm; a full record; a record for a trial "Not checked: the check stopped before this trial."; a shorter record for a trial whose rules couldn't be read; "This check is no longer here. Checks are kept only while the page runs."; and on a hosted model, "On this model, the check hasn't been measured."

## 6. Settings

The coordinator register, close to prescreening's Settings (`current/10`).
- Heading and intro: "Which model reads your answers. The local model runs on this computer and nothing leaves it. A hosted model sends what you type to its provider, with your own key."
- One block per provider: the local model (address, model, optional key), then Anthropic, OpenAI and xAI.
- Each block has key status ("Key saved (…a1b2)." / "No key saved."), **Save key**, **Remove key**, **Test**, the test result ("It works: … read "…" correctly."), **Use this model** / **In use**, price lines, and a measurement sentence or "Its readings haven't been measured."
- The cost cap field, with **Save**.

**States:** local in use; a hosted model in use with a key; a failed test (an error, not red).

## The made-up patient behind the examples

**p08**, from the project's made-up patients. 69, male, ZIP 97201 (Portland), up to 50 miles. Adenocarcinoma, spread to the adrenal gland and bones, no brain metastases. After chemo with Keytruda, docetaxel and Enhertu. A heart attack four months ago. His replies are short and matter-of-fact ("No brain mets.", "Keytruda with chemo first. It stopped working, cancer grew."). Every word in `current/*.txt` is from his run on the demo mode, and the trials are real registry records.

## Attach

- **Chart v2's handoff:** `design_handoff_chart_v2/` (README, `tokens.css`, `components.css`, `icons/`, `reference/`). The PNGs in its `uploads/` folder are prescreening's old purple and coral look. **Don't use them.**
- **Today's finder,** `work/0011-finder-design/brief/current/`, from `npm run app -- --fake` for p08 at 1280 wide. These show the content and the order of things, not the look.
  - `01-start` · `02-question-confirm` · `03-question-next` · `04-conversation-end`
  - `05-list` · `07-sheet`
  - `08-check-question` · `09-record` (every section opened)
  - `10-settings`
  - Each as `.png`, with the screen's full text in `.txt`.

## What to send back

A second handoff in the shape of Chart v2's:
- a README with each screen's layout, type, spacing and states;
- any additions to `tokens.css` and `components.css` (and their contrast ratios, light and dark);
- reference HTML for the six screens in both themes, desktop and phone, plus the printed sheet and record.

It will be committed under `work/0011-finder-design/design/` and built from.
