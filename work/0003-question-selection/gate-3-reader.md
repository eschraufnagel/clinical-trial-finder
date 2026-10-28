# Gate 3: is the reader good enough for free text on the page?

**Question:** should 0004's page let a person answer in their own words, read by the model, or offer the fixed answers as buttons? Decided from the reader's held-out result, read once on the frozen prompt.

**The reader** (`src/questions/read.ts`) sees one question, its fixed answers and one reply, and returns an answer id or "unknown". An output it can't use reads as unknown, and is never turned into an answer.

**The run:**
- **Model:** the local `Qwen3.6-35B-A3B-MLX-8bit`, 8-bit, temperature 0, seed 20260921.
- **Prompt:** `8cb01749` (layout 2).
- **Pairs:** every (patient, fact) pair, 31 per patient.
- **Spend:** nothing hosted. The dev and held-out reads took about 100 s and 570 s.

Results are under [`evals/results/questions/reads/`](../../evals/results/questions/reads/).

## Dev, three prompts

| Prompt | Change | Exact (of 54) | Lost | Wrong | Invented (of 39) |
| --- | --- | ---: | ---: | ---: | ---: |
| `26b2af74` | original | 52 | 2 | 0 | 0 |
| `c4cedd44` | adds a line saying the answer is an id copied from the list | 51 | 3 | 0 | 0 |
| `8cb01749` | the original wording; the answer ids are quoted in the list | **54** | 0 | 0 | 0 |

- **Every loss was ECOG.** The model answered `[1]`, a position in the list, where the answer id `ps1` looks like an ECOG score. The reader read each as unknown, as designed.
- **The added instruction made it worse,** as more instructions did to the mapper in 0002. Quoting the ids, a layout change rather than a wording one, fixed it.
- **That was the second and last revision** the plan allows.

## Held-out, read once

| | Count | Share | 95% interval | Proposed bar |
| --- | ---: | ---: | --- | --- |
| **Known replies read exactly** | 326 of 326 | 100% | 98.8% to 100% | at least 85% |
| Lost (read as unknown) | 0 | 0% | 0% to 1.2% | |
| Wrong answer | 0 | 0% | 0% to 1.2% | |
| **Don't-know replies read as an answer (invented)** | 1 of 201 | 0.5% | 0.1% to 2.8% | at most 5% |
| … of the specific ones, many of them hedges | 1 of 48 | 2.1% | 0.4% to 10.9% | |
| … of the general phrases | 0 of 153 | 0% | 0% to 2.5% | |

**The one invention:** p05, asked the cell type, said "Non-small cell, that's all I remember". The reader chose "Another non-small cell type"; her record says adenocarcinoma. Her reply names the family but not the type. The answer's words, "another non-small cell type", read as a match for it. A reply that names a category broader than the answers is where the reader went wrong.

**With the reader in the loop:** the held-out conversations, answered from these readings ([`with-reads/02-867d9528f7e8.json`](../../evals/results/questions/with-reads/02-867d9528f7e8.json)), differ from answering by what the patients know in p05 alone. The invented cell type moved her lists both ways:
- her conversation's agreement rose from 70% to 80%;
- her intake-only list's would-flag rose from 50% to 60%.

An invented fact doesn't reliably hurt. It changes the list for a reason the person never gave, which is the harm the bar is about.

## What these numbers can and can't say

**Both bars are met by a wide margin. But the replies are clean by construction.** Gate 1's blind reading agreed with all 434 hand-written replies: they were written so that a careful reader picks the record's answer. Real replies are vaguer:
- they contradict themselves;
- they answer a different question;
- they mention three facts at once (intent, open questions 7 and 8).

So 100% exact and 0.5% invented are **upper bounds** for real replies, not estimates of them. What the run does show is narrower and still useful:
- brand names and lay words ("Keytruda… it grew anyway", "zapped them last year") are read correctly;
- hedges ("EGFR maybe?", "never been tested") are almost never turned into answers;
- an output the model botches is caught, not invented.

## Recommendation

**Free text, with each reading shown back for the person to confirm or correct.** For example: "I read that as: Yes, and the cancer grew during or after it. [That's right] [Change it]", with the fixed answers and "I don't know" one tap away.
- **What it keeps:** what free text is for. A person says "Keytruda" and needn't know it's a PD-1 inhibitor, which is the third of the research's hard problems (§8).
- **What it adds:** a person catches an invented answer before it moves a trial. That's the one error this run found, and the kind real replies will make more often.
- **What it costs:** one tap per answer, and 0004 has to build the confirm step.

**The other choices:**
- **Free text alone.** It meets both bars on these replies, but nothing here measures real replies, and an invention is silent.
- **Buttons only.** No reading errors at all, and the reader is left measured and unused. The person has to map "Keytruda" onto "an immunotherapy drug" themselves.

**What it costs to be wrong:** 0004's page is designed around this answer. If free text goes in without the confirm step, an invented answer puts a fact in the person's profile that they never gave. It moves trials, and it drops a question from the oncologist sheet that should be there.

## Answer

**Owner, 2026-10: free text, with each reading shown back for the person to confirm or change.** 0004's intent starts from this. The confirm step is part of the page, not optional.
