# Gate 1: is this what a reader should see on 2026-11-25?

**Date:** 2026-11
**Decides:** whether the README says the right things, at the right weight, with every number honest; whether `docs/demo.md` runs start to finish as written; and the exact GitHub description and topics. Acceptance is the commit of the README and the demo script (plan, step 5).

## 1. Read the README

`README.md` in the worktree, uncommitted. 106 lines, against the spec's 120 to 160. It came out shorter, and nothing in the spec's nine sections was cut to get there. Read it rendered: VS Code's Markdown preview shows the table but not the Mermaid diagram. To see the diagram as GitHub draws it, push the branch and open the README there.

Things to weigh:
- **The opening** leads with what it does and the measured harness. The "proof of concept" line is now the last section, "Status".
- **"What it never does"** says "between a quarter and a third" of a model's readings would have wrongly ruled a person out. `docs/facts.md` says "about a quarter". The held-out results are 26.1% on Claude Haiku 4.5 (`facts/05`) and 35.0% on the local model (`facts/06`), and the README's range covers both.
- **The headings follow the sibling repository's** ("The problem", "What it does", "How it was built", "Run it"), and so does its Mermaid style. No fact differs between the two READMEs.

## 2. Run the demo

`docs/demo.md`, uncommitted. From a fresh terminal, `npm run app -- --fake`, then follow it, timed. It was walked once on this branch's code (port 5056), and every step reads as the script says:
- all 16 pasted replies were read as the "It reads" column shows, and each was confirmed with **That's right**;
- the list holds 10 trials and "89 more";
- **trials 1, 2, 3 and 6 can be checked** on p08's list: TAPUR (NCT02693535), Sigvotatug Vedotin (NCT04389632), Rina-S (NCT05579366) and Olomorasib (NCT06119581);
- TAPUR's check opens with "Your earlier answers already covered 4 of its rules", and its record shows 0 rules that may not fit and 16 that need records.

## 3. A fault the walk found, not fixed (spec §5)

**On p08's list, the check misses a rule that rules him out, and the record shows that rule as settled.**
- Trial 6, Olomorasib (NCT06119581), is a first-line trial, on the list of a man after three treatments. `docs/questions.md` already names this limit of the order ("first-line trials for someone already treated").
- Checked, its record lists the exclusion "Prior systemic therapy (chemotherapy, immunotherapy, targeted therapy, or biological therapy) for advanced or metastatic NSCLC" under **What your earlier answers covered**. The answer it links is the mutation-pill question ("No mutation pills"), not chemotherapy or immunotherapy, both of which p08 said yes to. It raises no "may not fit".
- **For the demo:** the script checks TAPUR only. If the reader asks about the check's misses, this example is real, and the table's "5 of 16 caught" row is the measured version of it.
- **Follow-up:** a later slice, on how the check links a rule to the conversation's answers when the rule names several kinds of treatment.

## 4. The table beside its files

| Row | Number in the README | Where it is |
| --- | --- | --- |
| Conversation | 85%, 72%, 91% | `evals/results/questions/06-8eea38fafad5.json`, `summaries.heldout`: conversation/shortlist 0.853, intake 0.724, knows-all/shortlist 0.912 |
| Search recall | 76 of 82, 92.7%, 84.9–96.6% | `evals/results/search/01-a3e87584fb11.json`; `docs/search.md` line 59 |
| Other cancers | 35 of 162 to 6; 14 of 43; 1 in 200 | `docs/page.md` (from `questions/06`, by `other:eval --places`); `docs/search.md` lines 130–137; `search/other/01-d16e940b9df3.json` |
| Hosted reader | 527 of 527; 324 of 326; 0 of 201; two "No"s | `evals/results/questions/reads/heldout-claude-haiku-4-5-8cb01749-schema.json`; `docs/questions.md` lines 136–153 |
| Check | 27% (330 of 1,236); 5 of 16; 27 of 34 | `evals/results/check/01-1db863f7b74c.json`; `docs/check.md` lines 98–103 |
| Outside | 1,290 of 1,669, 77.3%; 26 of 29 | `benchmark/search/trec/01-80fcdb226e48.json`, `benchmark/search/trialbench/01-4399149b1b7a.json`; `docs/benchmark.md` lines 55–57 |
| Models | Qwen3.6-35B-A3B MLX 8-bit, temperature 0, seed 20260921; Haiku 4.5 at temperature 0, no seed | `run` in `check/01` and in the Haiku reads file |

The conversation row uses `questions/06` (today's order, `other-last`), not the roadmap's 89% and 79% from 0003. That was accepted in the spec.

## 5. The GitHub description and topics, to set in step 6

**Description:**
> A local proof of concept: an AI assistant that helps a person with cancer find clinical trials to ask their oncologist about, with an eval harness that measures every stage. Made-up patients only; it never says who is eligible.

**Topics:** `clinical-trials`, `oncology`, `llm`, `evals`, `ai-agents`, `typescript`, `local-first`, `clinicaltrials-gov`, `healthcare`

Visibility stays private.

## 6. Checks run

- Link check (plan, Verification): every relative link in `README.md` and `docs/demo.md` resolves; 0 broken.
- Wording scan: no "eligible", "qualify", "match" or "best for" about a person and a trial. The hits are "never says a person is eligible", "eligibility rules", "the eligibility parser" and "published matchers".
- `npm run check`: exits 0.

## 7. Not part of this gate

The history scan (step 1) reports on its own. Its PHI pass is done and found nothing real. Its secrets pass waits on gitleaks or the grep fallback.
