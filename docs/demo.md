# A five-minute demo

One made-up person through the whole page, in scripted mode: no AI model, no network, the same every time. Each screen has what to do and what to say about it. Each number links to the measurement behind it, listed in the [README](../README.md#what-was-measured).

The person is **p08** ([`evals/cases/patients/dev/p08.json`](../evals/cases/patients/dev/p08.json)), the same person the README's screenshots show. He's 69 and lives in Portland, Oregon. His lung adenocarcinoma has spread to his adrenal gland and bones, and it kept growing through three treatments: chemotherapy with Keytruda, then docetaxel, then Enhertu. He keeps a list on his phone, and he knows some of his test results but not all. He's made up, like every patient in this repository.

For a three-minute version, skip the parts marked *(skip for three)*.

## 1. Before

```bash
npm install
```

```bash
npm run app -- --fake
```

Open http://127.0.0.1:5025. The header says **Scripted reader · no model**.

> **Say:** In scripted mode nothing calls a model. Each reply is read the way the local model actually read it in a committed run, so what you see is the model's real reading, replayed. Without `--fake`, the page uses a model on this computer, or a hosted one a person picks in Settings with their own key.

## 2. The start form

Enter **ZIP 97201**, **age 69**, **50 miles**, **Male**, then **Start the questions**.

> **Say:** Lung cancer only, for now. The search runs on a saved copy of ClinicalTrials.gov, about 5,700 recruiting US cancer trials, with no network. Answers stay on this computer. The page asks for made-up answers.

## 3. The questions

Paste each reply exactly as written, press **Send**, then **That's right** when the page shows how it read the reply. In scripted mode only these exact words are understood. Anything else reads as "I don't know".

| # | The page asks | Paste | It reads |
| ---: | --- | --- | --- |
| 1 | What type of lung cancer cell did the biopsy show? | `Adenocarcinoma.` | Adenocarcinoma |
| 2 | How far has the cancer spread? | `Spread to the adrenal gland and the bones.` | It has spread further, or come back |
| 3 | Has the cancer spread to the brain? | `No brain mets.` | No |
| 4 | Which is closest to how you are day to day? | `Up and about, can't do the heavy stuff.` | Up and about, but can't do heavy work |
| 5 | Have you had chemotherapy with carboplatin or cisplatin? | `Carboplatin, yes.` | Yes |
| 6 | Have you had an immunotherapy drug such as pembrolizumab, nivolumab or durvalumab? | `Keytruda with chemo first. It stopped working, cancer grew.` | Yes, and the cancer grew during or after it |
| 7 | Have you had a pill aimed at your tumor's mutation, such as osimertinib or alectinib? | `No mutation pills.` | No |
| 8 | How many treatments have you had since the cancer became advanced? | `Three. Chemo and Keytruda, then docetaxel, then Enhertu.` | Three or more |
| 9 | Is there a tumor that scans can measure? | `Yes, they measure the adrenal tumor every time.` | Yes |
| 10 | Has the cancer spread to the lining of the brain or spinal cord? | `Don't know.` | you don't know |
| 11 | Have you had lung inflammation (pneumonitis) or scarring (interstitial lung disease)? | `No lung inflammation.` | No |
| 12 | In the last 6 months, have you had a heart attack, a stroke, or heart failure that needed hospital care? | `Yes, I had a heart attack in April. Four months ago.` | Yes |
| 13 | Have you had another kind of cancer? | `No.` | No |
| 14 | Have you had an organ or bone marrow transplant? | `No.` | No |
| 15 | Do you have HIV? | `No.` | No |
| 16 | In the last 2 years, have you needed medicine that calms the immune system … for an autoimmune disease like lupus or Crohn's? … | `Not sure. I take a lot of pills since the heart attack.` | you don't know |

Then **See your list**.

> **Say, at questions 1–8:** eight questions everyone is asked. Then up to eight more, each chosen by how much its answer would change this person's list. On 17 held-out made-up patients, this conversation kept 85% of the short list their full medical record would give, against 72% for the eight fixed questions alone.
>
> **Say, at the confirm step:** nothing typed counts until the person confirms how it was read. The reader is measured: on a hosted model it read 527 of 527 held-out replies, 324 of 326 stated answers right, and turned none of 201 "don't know"s into an answer.
>
> **Say, at question 10:** "I don't know" is an expected answer. It never takes a trial off the list. It becomes a question for the oncologist instead.

*(skip for three)* Pause at question 12. The heart attack is a fact that trials ask about, and he knows it. Question 16 is one he doesn't know, and says so in his own words.

## 4. The list

Ten trials, then "89 more trials the search kept". Open the first card, **TAPUR** (NCT02693535).

> **Say:** read the paragraph at the top. The order isn't a ranking, and nothing here says whether he could take part. His oncologist and the trial team decide that.
>
> **Say, on the open card:** the nearest site and how far away it is. What the trial tests, and what its phase means, in plain words. Which of his answers its rules were checked against, with his own words beside each. What's still unknown, grouped by who would know: his oncologist, or his records. "Few of this trial's rules could be checked" says how much was read, so a card with nothing against it isn't taken as a clean bill.
>
> **Say:** most of these are early-phase trials open to many cancers ("advanced solid tumors"). A search by cancer type alone misses those. The search kept 76 of 82 relevant trials on a held-out labelled sample, and trials for other cancers only are moved below the list, not hidden.

## 5. The oncologist sheet *(skip for three)*

**For your oncologist** in the header.

> **Say:** a page to print and take to the visit. Up top, the questions that would settle the most of these trials: whether the cancer has reached the lining of the brain and spine is asked by 7 of the 10. What to bring: scan reports and the biomarker report. Every question asked, what he said in his words, and how it was read. Every unknown ends up here. The page goes nowhere else: no email, no sending, no contact with any trial site.

**Back** to the list.

## 6. The check

Tick **TAPUR** (the box under its card), then **Check these**. Only trials with a **Check this trial** box can be checked in scripted mode. On p08's list those are trials 1, 2, 3 and 6.

The check opens with: "Your earlier answers already covered 4 of its rules."

Answer:
1. "The participant is 12 years of age or older" → **Yes**.
2. "The participant has acceptable organ function as defined below" → **I don't know**.
3. "Results must be available from a genomic test …" → **I don't know**.

Then **Stop and show the record**.

> **Say:** a model has read this trial's own rules into one rule per line. The screening agent starts from what the conversation already settled and asks only what's left, one rule at a time, in the trial's own words. Across 50 held-out pairs, not asking again saved 27% of the questions.
>
> **Say, plainly:** it isn't good at ruling trials out yet. On those pairs it caught 5 of 16 trials that clearly didn't fit, and it said "may not fit" wrongly on 27 of 34 others. That's why the record is written as questions for the oncologist, never as a decision.

## 7. The record

> **Say:** the summary column counts what was settled: by his earlier answers, by the check, what needs his records or his oncologist, and what's about the trial rather than him. The record states "This isn't a decision." Each rule is shown in the trial's words, with what he said about it. "To ask your oncologist" lists every rule that needs his records. **Print or save as PDF** prints the record. It's sent nowhere.

## 8. Closing

> **Say:** the eval harness is the main thing this project built. Every stage has a measurement, committed with its model, quantization, temperature and seed, so any number in the README traces to a file in `evals/results/`. The repository was built in slices, each with an intent, a spec and a plan accepted before any code. Those are in `work/`, with the gates where a person decided. Where a measurement fell short, the shortfall is what's reported.

## 9. What scripted mode can't do

- Typed text other than the replies above reads as "I don't know". The **Choose an answer** buttons always work.
- Only trials whose rules have a committed reading can be checked. Others have no **Check this trial** box.
- Settings can be opened, and its choices are saved, but nothing is called.
- Changing an answer on the list reorders it, and no more questions are asked.

Live mode needs the local model (oMLX), or a hosted model chosen in Settings with your own key. What the page says and why: [page.md](page.md). How the check works: [check.md](check.md).
