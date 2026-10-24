import { createHash } from "node:crypto";
import type { SnapshotTrial } from "../trials/snapshot-types.js";
import type { Fact } from "./types.js";

/**
 * The mapping prompt (spec 0002 §3.2). Versioned by a hash of the system
 * prompt, as the parser's is: a result compared across runs means nothing if
 * the prompt changed underneath it. The vocabulary goes in the user prompt
 * and is named on every result by its own checksum.
 *
 * Written by the same author as the labels, before the prompt was run on any
 * labelled trial. Its rules restate `evals/cases/facts/ANNOTATION.md` in
 * general terms. No label's wording is copied into it.
 */
export const SYSTEM_PROMPT = `You read the eligibility criteria of one cancer clinical trial and map them onto a fixed list of facts about a patient with non-small cell lung cancer.

Each fact has an id and a closed set of answers, each with its own words. For each eligibility rule that plainly states a requirement about one listed fact, return one mapping with a verdict for EVERY answer of that fact:
- "excluded": a patient giving this answer is clearly not eligible under this rule, whatever else is true of them;
- "allowed": a patient giving this answer meets this rule;
- "unclear": it depends on something the answer's words don't say (a different time window, a dose, a test level, whether it needed steroids, a specific drug, whether it is symptomatic, a judgment).
Only "excluded" answers count. When in doubt, say "unclear". A wrong "excluded" drops a trial the patient could have joined; an "unclear" only costs a question later.

Do not map at all:
- lab values, organ function, washout periods ("within 2 weeks of"), consent, contraception, willingness, investigator judgment, life expectancy, "any significant medical condition";
- vague prior-therapy rules ("standard therapy", "one or more prior lines of anticancer therapy") that don't name a drug class from the list or say the lines were for advanced disease;
- sentences that only say who is allowed ("are eligible if", "may participate", "are permitted");
- rules that only say which cancer types or ages the trial takes, and anything inside a cohort or part limited to cancer types other than lung cancer.

There is no "not tested" answer: a patient who hasn't been tested is never excluded by a biomarker rule, so only "none_found" can be excluded by a rule requiring a mutation.

If a rule applies only to part of the trial (an arm, cohort, part or phase, including a scope in parentheses such as "(Phase 2)"), set "appliesTo" to that scope in the trial's words; otherwise null.

"quote" is copied exactly from the criteria text: the rule's own words, short, never paraphrased or joined across lines.

Return JSON only:
{"mappings": [{"factId": "...", "verdicts": {"<answer id>": "excluded" | "allowed" | "unclear", ...}, "polarity": "inclusion" | "exclusion", "quote": "...", "appliesTo": null}]}
Return {"mappings": []} if nothing maps.`;

export const PROMPT_VERSION = createHash("sha256").update(SYSTEM_PROMPT).digest("hex").slice(0, 12);

export function buildUserPrompt(
  trial: SnapshotTrial,
  normalizedText: string,
  facts: readonly Fact[],
): string {
  const factLines = facts.map(
    (f) =>
      `- ${f.id}: ${f.question}\n${f.answers.map((a) => `    ${a.id}: ${a.words}`).join("\n")}`,
  );
  return [
    `Trial ${trial.nctId}: ${trial.briefTitle}`,
    `Conditions: ${trial.conditions.join("; ")}`,
    "",
    "Facts:",
    ...factLines,
    "",
    "Eligibility criteria:",
    normalizedText,
  ].join("\n");
}
