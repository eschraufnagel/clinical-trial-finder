# Gate 1: the README's loop

**Date:** 2026-11
**Held?** **Skipped, on the owner's instruction** (2026-11): "Why don't you just proceed with this entire slice. Stop asking me to approve for this slice unless absolutely needed." Claude watched the GIF frame by frame in its place (below) instead. The PR says so.

## What was made

`npm run screenshots` (both tests passed; the three stills came out byte-identical), then `npm run demo -- --mp4`:

| Try | Size | Frame rate | Width | Under 5 MB |
| --- | ---: | ---: | ---: | --- |
| 1 | 7,631,923 bytes (7.28 MB) | 12 fps | 960 px | no |
| 2 | 7,861,465 bytes (7.50 MB) | 10 fps | 960 px | no |
| 3 | 5,810,503 bytes (5.54 MB) | 10 fps | 800 px | no |
| 4 | **4,771,148 bytes (4.55 MB)** | **10 fps** | **720 px** | **yes, kept** |

Length after cutting: **36.2 s**. The local MP4 (`e2e/.out/demo/demo.mp4`, 960 px) is 1,078,028 bytes and isn't committed.

The steps landed on the narrowest width. Recorded at 1280×800, so the GIF is 720×450, shown at about that size in the README.

## The timeline as cut

| Loop | Speed | What's on screen |
| --- | ---: | --- |
| 0.0–11.6 s | 1× | the start form typed (ZIP, 50 miles, age, Male); Q1 `Adenocarcinoma.` and Q2 `Spread to the adrenal gland and the bones.` typed, each reading held, **That's right** |
| 11.6–14.1 s | 2.8× | 7 questions fast-forwarded, captioned "More questions, sped up", then "7 more questions, sped up" |
| 14.1–17.9 s | 1× | Q10, the lining of the brain or spinal cord: `Don't know.` typed, read as "you don't know", confirmed |
| 17.9–20.4 s | 2.4× | 6 questions fast-forwarded, captioned the same way with 6 |
| 20.4–36.2 s | 1× | the list and its note ("The order isn't a ranking of which trial would work for you…"); TAPUR's card opened and scrolled; ticked, **Check these**; the check opens ("Your earlier answers already covered 4 of its rules"); **Yes**, **I don't know**, **I don't know**; **Stop and show the record**; the record's top held 4 s |

No beat was dropped (spec §2).

## What Claude checked, in place of the owner's watch

Seven frames pulled with `ffmpeg -ss <t> -i docs/images/demo.gif -frames:v 1` at 3, 8, 13, 20, 24, 29 and 35 s and read at full size:
- **Readable at 720 px:** questions, typed replies, readings, the list's note, the card's text, the check's opening line and the record's summary column are all legible. The record's notice reads: "This isn't a decision. Your oncologist and the trial team decide whether this trial is right for you."
- **Honest about scripted mode:** the page's own header says "Scripted reader · no model" and its banner says "Scripted reader: no model is called. Typed replies are read from a fixed list." in every frame, as well as the caption under the GIF.
- **The fast-forward caption** shows bottom centre in the page's ink and font, over the conversation's controls.
- **No verdict words:** the capture's `expectNoVerdict` on the list and the record, and its caption check, passed.

Not checked by a person: the pacing as watched in real time, and how it looks on GitHub. A first run with no holds in the fast-forwards played them at 1× in about a second each (step 3 revised).

## The README's words

Alt text: "Made-up patient p08 answers a few questions in his own words and confirms each reading, then his short list appears, a trial's card is opened and checked, and its record says it isn't a decision."

Caption: "*The page in its scripted mode, with made-up answers. Each typed reply gets the local model's recorded reading of it, and the check replays a recorded reading of the trial's rules. Most questions are sped up.*"

## Page faults the recording showed

None new. Under each typed reading, scripted mode says "Read by a scripted reader. This model's readings haven't been measured." That's true of the scripted reader itself, though the readings it replays are the local model's measured ones (`docs/questions.md`). A wording question for a later slice, not a fault, and not changed here.
