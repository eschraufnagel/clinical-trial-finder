# The finder's design, in Chart v2

The finder's six screens, designed for slice 0011 from [the brief](../brief/brief.md) and accepted by the owner (2026-11). The spec builds to these files.

They were made on a Claude Design canvas in Claude, which stays the place to revise them: https://claude.ai/artifact/K1TiN2z4sBxUWL6hJ72QVu (private to the owner). This folder is the accepted version, copied from it. A change made on the canvas reaches the spec only when it's copied here again and accepted.

## What's here

| File | What |
| --- | --- |
| `chart.css` | Chart v2's tokens and components from the handoff, and the finder's own components below them |
| `Main.dc.html` | 1 · the start form |
| `Questions.dc.html` | 2 · the questions; `step` shows the confirm step or answering |
| `List.dc.html` | 3 · the short list, with trial 2 open in full |
| `Check.dc.html` | 5a · a question in the check |
| `Record.dc.html` | 5b · a record |
| `Settings.dc.html` | 6 · Settings |
| `Sheet.dc.html` | 4 · the sheet for the oncologist, as printed |
| `RecordPrint.dc.html` | 5c · a record, as printed |
| `States.dc.html` | the waiting, empty and failed states |
| `*Dark`, `*Phone`, `*PhoneDark` | the same screens in dark, at 390 px, or both: each draws its screen with a theme |
| `canvas.json` | the canvas's layout, and its two notes: the design decisions, and every new or reworded sentence |

Each `.dc.html` is a Design Component page. Its markup and `chart.css` are the reference. They don't open on their own: they need the canvas's runtime (`support.js`), which belongs to the Design type and isn't copied.

## How these differ from Chart v2's handoff

- **The theme is a class** (`.t-light`, `.t-dark`), so both can sit side by side on one canvas. In the app it follows `prefers-color-scheme`, as Chart v2 says.
- **Phone rules are a container query** on `.screen`, so a 390 px board reflows. In the app they're the handoff's media query at 600 px.
- **Fonts load from Google Fonts on the canvas only.** The app bundles them (intent, Constraints).

## Not real data

- Trial 2's "May not fit" on the short list is illustrative. None of p08's top ten has one, so its rule was made up to show the block.
- The record draws some of its rows; the counts are the real ones.
- Settings' `[estimate]` and `[month]` are placeholders.

## New wording

`canvas.json`'s `decisions` note lists every sentence that isn't in `src/web/copy.ts` today, and every sentence rearranged. Each goes through `copy.ts` and the verdict scan when it's built.
