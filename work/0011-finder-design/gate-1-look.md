# Gate 1: is this the look the finder ships?

**Slice 0011, 2026-11.** Stage A is done: every screen rebuilt in Chart v2, light and dark, desktop and phone, with print. Stage B photographs it for the README and writes it up in `docs/page.md`, so a look that changes after this gate means both are redone.

**In plain words:** the page now looks like the canvas you accepted, and like the prescreening app. It shares that app's fonts, colours, buttons, header and Record mark, copied from it unchanged. Nothing it says about a trial, and nothing about which trials it keeps or their order, has changed. `npm run check` and all 10 browser cases pass.

## What to look at

Run the page with no model:

```
npm run app -- --fake
```

Open http://127.0.0.1:5025 and play made-up patient p08 (`evals/cases/patients/dev/p08.json`): ZIP 97201, 50 miles, age 69, male. Type his replies from the file, or tap answers. Then:

1. **The start form.** Distance and sex are boxes to tap; "What happens next" sits beside the form.
2. **The questions.** The current question in its card with "Question N", earlier turns set back, a typed reply coming back as a large "I read that as: …" with **That's right** and **Change it**.
3. **The list.** Cards closed, with "How much was read" (and "May not fit", or a note about the record, when a card has one) still showing; **Open** a card; tick three; the fourth is refused; the rail on the right with your picks and **Check these**. Under "more trials the search kept", the trials for other cancers say so first.
4. **The sheet** (**For your oncologist**), then print preview (⌘P).
5. **The check.** Check the first trial by tapping answers, then **Stop and show the records**. The trials are tabs; a record has its summary column of five counts, then its sections. Print preview: every record, "To ask your oncologist" first, no questions.
6. **Settings.**

**In each theme:** switch the system to dark (System Settings, Appearance) and look again; the page follows it, with no toggle.

**At phone width:** the browser's device view at 390 px, or a narrow window. The header stacks, cards go to one column, and the rail becomes a bar at the bottom with **Check these**.

**Beside the canvas:** [Trial Finder — Chart v2 screens](https://claude.ai/artifact/K1TiN2z4sBxUWL6hJ72QVu), or `design/` here.

## Where the build differs from the canvas

**The four the spec named (§2):**
1. The check's question isn't split into a quoted rule and "Does this describe you?". The model words each question.
2. No search line ("Lung cancer · 97201 · 50 miles") above the questions.
3. Lab values stay one line per rule, set compactly in mono.
4. Dark mode and the phone layout follow the system and the window, as Chart v2 says, not the canvas's switches.

**Found while building:**
5. **The shared foundation is the prescreening app's.** Its fonts, licences, icons, manifest and the first 426 lines of its stylesheet are copied unchanged (your word at step 2), so its conventions hold here: buttons are primary unless marked secondary or quiet, and the model chip is its `.pill`.
6. **The card's head** shows the phase as a tag and the nearest-site sentence, which includes the distance. There's no separate distance field.
7. **The record's summary column** has no Print and Back buttons: the check page already has them, and two of each would confuse the browser test.
8. **The confirm step leaves the reply box showing** under it, as it did before; the canvas hid it.
9. **Below 1100 px** a record's summary moves above its sections, as the prescreening app's review does.
10. **The sheet's question counts** stay sentences ("7 of these 10 trials ask about this.").

## New sentences

All in `src/web/copy.ts`, all scanned for verdict words:
- `brand`: "Trial Finder"
- `chip`: "Scripted reader · no model", "Local model · …", "<provider> · …"
- `search.next`: "What happens next", "A few questions, one at a time.", "A short list of trials to ask your oncologist about.", "A sheet to print for your visit."
- `conversation.question`: "Question N"
- `list.checkFailed`: "The check couldn't start. Nothing on your list changed. Try again."
- `record.summary` and `record.about`: "This record", and one line under each of the five sections
- `sheet.columns`: "Question", "Said", "Answer"

## The browser test

**Selector changes:**
- `search()` checks the distance radio by its label instead of choosing from a dropdown.
- Case 10 finds the failure line by `role="alert"`.

**Flow change:** `openAllCards` opens every card before the list's three verdict scans, so they still read every word.

**New:**
- case 10: a check that can't start says so, and the ticks stay;
- case 11: dark mode's background, the fonts loading, and the rail becoming a bar at 390 px.

## The states

Each state on the canvas's states board, and how it's drawn:

| State | Drawn by | Seen on `--fake` |
| --- | --- | --- |
| Start · searching | the start button, "Searching the trials…" | briefly |
| Start · a ZIP the app doesn't know | `.error-line` under the form | type 99999 |
| Questions · reading a reply | "Reading your answer…" | briefly |
| Questions · a reply that couldn't be read | `.error-line` with **Try again** | no |
| Questions · on a hosted model | the composer's note, the confirm's "Read by …" | no |
| Questions · the end | **See your list** | yes |
| List · stopped early | `.error-line` "The questions aren't finished…" | **Show me the list now** |
| List · a trial for other cancers | the card's first block, "About the record" | under the more trials |
| List · a fourth tick refused | the box disabled, "Three is the most…" in the rail | yes |
| List · Check these starting and failing | "Starting…"; the failure line | the first; the second in case 10 |
| Check · reading a trial's rules | the agent's "Reading the rules of …" | yes |
| Check · a typed reply to confirm | the confirm, as in the questions | no: `--fake` taps only |
| Check · a trial not reached | a card, "Not checked: …" | stop early |
| Check · rules that couldn't be read | the record's notice, its lead | no |
| Check · gone after a restart | `.error-line` and **Back to your list** | restart the server |
| Record · a list rule, a part of the trial | the rule's evidence line | no: no parse in use has either |
| Check · on a hosted model | "On this model, the check hasn't been measured." | no |
| Settings · a test that failed | `.error-line` | no |

## What I recommend

**Go on to stage B.** The page matches the canvas closely. The ten differences are small, and each follows from something the canvas couldn't know. A "revise" names the changes; I make them, the checks run again, and this gate comes again.

## Answer

**Go to stage B** (2026-11), with no revisions.
