# plan: 0013 ready to show

**Status:** Draft
**Date:** 2026-11
**Intent:** [intent.md](intent.md), committed as `0013 intent`. **Spec:** [spec.md](spec.md), committed as `0013 spec`.

## Context

The finder works and is measured, but the repository tells it badly: the README opens with an apology, is mostly commands, and reports nothing that was found. The owner is showing it to an engineering leader at a clinical-research company on 2026-11-25. This slice rewrites the README (guardrails together, a six-row results table, a Mermaid diagram), adds a demo script that follows made-up patient p08 through `npm run app -- --fake`, sets the GitHub description and topics, scans the history for PHI and secrets, and updates the README convention in `CLAUDE.md`. No file under `src/`, `scripts/`, `tests/`, `e2e/`, `evals/` or `data/` changes, and no model runs.

## Order of work

### Stages and gates

| Stage | Steps | Ends at | What you can see at the end |
| --- | --- | --- | --- |
| **A. Scan and write** | 1–4 | **Gate 1** | `history-scan.md` (committed, and reported on its own); `docs/demo.md` and the new `README.md`, written and **left uncommitted**; `gate-1-read.md` with the description and topics to set |
| **B. Land** | 5–8 | PR | the README and demo committed; the GitHub description and topics set; `CLAUDE.md` and the roadmap; review passes |

**Before step 1: gitleaks.** The owner installs it (`brew install gitleaks`) or says to use the grep pass instead (spec §7). Steps 2–4 don't depend on it, so if the answer hasn't come, step 1 waits and stage A goes on with step 2.

**No model run, no spend.** The demo is walked and written on `--fake`. The only network use is `gh`, run by hand: reading the sibling README (step 3) and setting the description and topics (step 6).

**Gate 1: is this what a reader should see on 2026-11-25?** (spec §12)
- **What's decided:** whether the README says the right things, at the right weight, with each number honest; and whether the demo script runs start to finish as written on the owner's machine. Also the exact description and topics.
- **What the owner sees:** `work/0013-demo-ready/gate-1-read.md`, which lists: the README to read, rendered (VS Code preview, or GitHub after a push of the branch if the owner wants the Mermaid checked there); `docs/demo.md` to run, start to finish, timed; the six table rows beside their result files; the description and topics, word for word; anything the demo walk found wrong on the page (not fixed, spec §5); and which of p08's trials can be checked.
- **What it costs to be wrong:** stage B commits these as the repository's front page and sets the GitHub text that anyone with access sees. A README that oversells, or a demo that stalls in front of the reader, is a first impression that can't be redone.
- **Can be no:** "revise", with the changes named; steps 2–3 are amended, the link check (Verification) is rerun, and Gate 1 comes again. Acceptance is the commit of steps 2 and 3, the same way intent, spec and plan are accepted.

**The history scan reports when step 1 is done,** not at Gate 1. A real finding stops step 1's commit and goes to the owner first (spec §7); it decides whether the repository can go public, which is a different question from Gate 1's.

**Stage B needs no gate.** It commits and records what Gate 1 accepted.

### Steps

**Rules for every step:**
- Commit through `npm run check && git commit ...`, one step per commit, message `0013 step N: <what>`. No tool attribution.
- Months, not days, in every file written. No PHI: p08 is made up.
- If a step can't be done as written, `plan.md` is updated in the same commit.
- Nothing under `src/`, `scripts/`, `tests/`, `e2e/`, `evals/`, `data/`, `docs/images/`, or the other `docs/*.md` changes. If the walk shows something wrong on the page, it goes in `gate-1-read.md` and the PR's follow-ups.

**Step 1. The history scan** (spec §7). Commit: `0013 step 1: history scanned`.
- **Secrets, with gitleaks:** `gitleaks git --log-opts="--all" --redact --report-format json --report-path <scratch>/gitleaks.json .` from the repository root; record `gitleaks version`, the commit count (`git rev-list --all --count`) and the first and last commit.
- **Secrets, the fallback** (only if the owner declines gitleaks): `git log -p --all` searched with `grep -nE` for `sk-ant-|sk-proj-|sk-[A-Za-z0-9]{20}|xai-[A-Za-z0-9]{20}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30}|-----BEGIN [A-Z ]*PRIVATE KEY` and for assignments (`=`) to the key variable names listed in `src/models/keys.ts`. Recorded as the weaker pass.
- **PHI:** over every blob in the history (`git rev-list --all --objects`, then `git cat-file` on each blob, skipping `.gz` and images), search with `grep -nEi` for: dates near "DOB"/"date of birth"/"born"; `MRN`/"medical record"; US phone numbers (`\(?\d{3}\)?[-. ]\d{3}-\d{4}`); email addresses other than `noreply@`; street addresses (`\d+ [A-Z][a-z]+ (St|Ave|Rd|Blvd|Dr|Lane|Way)\b`); SSN shape (`\d{3}-\d{2}-\d{4}`). Registry data (`data/snapshot/`, `data/trials/`) holds sites' public contact details; hits there are counted by kind and judged as registry content, not read one by one.
- **Judged by reading:** every hit outside registry data is read and marked made-up, registry, public (e.g. a citation) or **real**. A **real** hit stops here: nothing is committed, and the owner hears first.
- **Write `work/0013-demo-ready/history-scan.md`:** date (month), commands, tool version, commit range and count, hits per pass and per kind, each judged hit by file and commit with its judgment, and no secret value copied in. Then tell the owner the result in a line.

**Step 2. The demo script** (spec §5). Written, **not committed until Gate 1**; committed after as `0013 step 2: demo script`.
- Start `finder-fake` (`.claude/launch.json` in the main checkout; port 5055) or `npm run app -- --fake --port 5055` from this worktree. The README and the script say port 5025, the default.
- Walk p08 (`evals/cases/patients/dev/p08.json`): ZIP 97201, age 69, 50 miles, male. For each question, paste p08's `says` line for the question's fact verbatim (the matching works as `replyTo` does in `e2e/lib/patients.ts`) and confirm with "That's right". Record each question's wording, the reply, and the reading the page shows. Where p08 doesn't know (not in `knows`), record what the page offers and use "I don't know". Where a reply isn't read, use the button and say so.
- On the list: record the ten trials, which have a **Check this trial** box (the checkable ones), and one card's contents worth pointing at. Open "For your oncologist". Tick one checkable trial (two if the demo stays under five minutes), **Check these**, answer two or three, **Stop and show the record**. Record the record's sections.
- Write `docs/demo.md` in spec §5's nine parts: each screen with what to click, what to paste, what to say (the talking point), and the measured number behind it (from the README's table). Mark what to skip for a three-minute version. Section 9 states fake mode's limits.
- If none of p08's ten can be checked, check the nearest one that can and say so in the script and in `gate-1-read.md`.

**Step 3. The README** (spec §2, §3, §4, §8). Written, **not committed until Gate 1**; committed after as `0013 step 3: README for a first reader`.
- **First, the sibling:** `gh api repos/eschraufnagel/trial-prescreening-agent/readme --jq .content | base64 -d`, read only. Note its headings and its wording of the problem and the guardrails; follow the same terms where the products overlap (spec §2.1). Differences of fact go in `gate-1-read.md`.
- Write the nine sections in spec §2's order. The table is spec §3's six rows, with links relative to the README (`evals/results/questions/06-8eea38fafad5.json`, etc.) and the model line beneath. Every number is copied from the result file or doc it cites; re-read each against its source while writing.
- The diagram is Mermaid (`flowchart LR` or `TD`), default theme, at most about 12 nodes: snapshot → search → fact hints → questions (+ reader) → short list and sheet → deeper check → record; model use marked on nodes; a `src/models/` node with local (default) and Anthropic / OpenAI / xAI (by Settings); each stage's node clickable or captioned to its doc. If the eval harness doesn't fit, a second small diagram (spec §4).
- Keep the three screenshots and their alt text. Aim for 120–160 lines. If it runs past 160 because of the doc links, stop and raise `docs/README.md` at the gate (spec §8).
- Wording scan: `grep -nEi 'eligib|qualif|match|best for' README.md docs/demo.md`; each hit must say the finder doesn't decide it.

**Step 4. The gate page.** Commit: `0013 step 4: Gate 1 page`.
- `work/0013-demo-ready/gate-1-read.md` with what Gate 1 lists above, the description and topics word for word (spec §6), the link check's output, the README's line count, and the page faults found in step 2 if any.
- Stop at Gate 1.

**Step 5. Commit what Gate 1 accepted.** The README and the demo script, as steps 2 and 3, each its own commit, with any changes the gate asked for.

**Step 6. The GitHub page** (spec §6). No commit.
- `gh repo edit eschraufnagel/clinical-trial-finder --description "<accepted text>"` and `--add-topic` for each accepted topic. Visibility untouched.
- Check with `gh repo view --json description,repositoryTopics`; record the result under Records.

**Step 7. `CLAUDE.md` and the roadmap** (spec §9). Commit: `0013 step 7: README convention, roadmap row`.
- `CLAUDE.md`: replace the README sentence under Conventions ("The README is short … one file per part.") with spec §9's wording; add `docs/demo.md` under "Where things live" beside `docs/`.
- `work/ROADMAP.md`: "0001 to 0011 are done" stays accurate for `main`; add a 0013 row, "**Done.** The README for a first reader, with six measured results and a diagram; a demo script on `--fake`; the history scanned", measured by "the owner's read and demo run at Gate 1", model "No". (0012's row is added by 0012's own branch; whichever lands second resolves the conflict.)

**Step 8. Review passes and the PR.** Commit: `0013 step 8: review passes` (Records filled).
- Run `REVIEW.md`'s passes on the branch's diff against `main`, record findings in Records, fix Importants.
- Push the branch and open the PR only on the owner's go-ahead; the PR description says Gate 1 was held, lists page faults as follow-ups, and carries no tool attribution.

## Files that change

| File | Step | Change |
| --- | --- | --- |
| `work/0013-demo-ready/history-scan.md` | 1 | new |
| `docs/demo.md` | 2 (committed in 5) | new |
| `README.md` | 3 (committed in 5) | rewritten |
| `work/0013-demo-ready/gate-1-read.md` | 4 | new |
| `CLAUDE.md` | 7 | README convention; `docs/demo.md` in the layout |
| `work/ROADMAP.md` | 7 | 0013 row |
| `work/0013-demo-ready/plan.md` | 8 | Records |
| GitHub description, topics | 6 | set, no file |

## Reused, not rebuilt

- `npm run app -- --fake` and `scriptedReader` (`scripts/app.ts`) for the demo; no demo-only mode.
- p08 and its replies (`evals/cases/patients/dev/p08.json`), the same person `e2e/screenshots/readme.shots.ts` photographs, so `docs/images/` stays as it is.
- Every number from its committed result in `evals/results/` and its doc; nothing recomputed.
- `npm run check` as every commit's gate.

## Risks

- **A number copied wrong.** Each is re-read against its file in step 3 and listed beside its file at Gate 1.
- **p08's typed replies don't all read in fake mode,** if a reading was recorded under a different question wording. The buttons cover it, and the script says which.
- **None of p08's trials is checkable.** Step 2 checks the nearest one that is and says so.
- **The Mermaid renders badly on GitHub,** in dark mode or at width. Default theme and few nodes; the owner can push the branch and look before Gate 1 is answered.
- **The demo shows a page fault** in front of the reader. Faults are listed at Gate 1 so the owner can route around them; fixing them is out of scope.
- **`docs/questions.md` still opens with 0003's 89%** while the README says 85% (spec, Concern 1). The README's link goes to `questions/06`, which `docs/page.md` explains. Left as the spec says; a follow-up if the owner wants the doc's opening line updated.
- **0012 and 0013 both touch the roadmap.** A one-line merge conflict, resolved by whichever lands second.

## Verification

- `npm run check` exits 0 before every commit.
- **Link check** (before Gate 1 and after any revision): every relative link in `README.md` and `docs/demo.md` resolves to a file, by
  `node -e 'const fs=require("fs"),p=require("path");let bad=0;for(const f of ["README.md","docs/demo.md"]){const t=fs.readFileSync(f,"utf8");for(const m of t.matchAll(/\]\(([^)#\s]+)/g)){const u=m[1];if(/^[a-z]+:/.test(u))continue;if(!fs.existsSync(p.join(p.dirname(f),u))){bad++;console.log(f,u)}}}process.exit(bad?1:0)'`.
- **Numbers:** each row of the table checked against its result file in step 3, and listed with its file on the gate page.
- **The demo:** walked once by Claude while writing it (step 2), then run by the owner start to finish at Gate 1.
- **The wording scan** in step 3.
- **GitHub:** `gh repo view --json description,repositoryTopics` after step 6.
- **The boundary test** is untouched by construction; `git diff --stat main` at step 8 shows no file under `src/`, `scripts/`, `tests/`, `e2e/`, `evals/`, `data/`.

## Departures from the spec

None. One reading made explicit: spec §12's "before the README and the demo are committed" means steps 2 and 3 are written but committed only after Gate 1 (step 5), the same way this repository commits an accepted artifact.

## Records

Filled during implementation: the history scan's result, Gate 1's answer, the description and topics as set, review-pass findings.
