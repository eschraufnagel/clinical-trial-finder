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
export const SYSTEM_PROMPT = `You read the eligibility criteria of one cancer clinical trial and map them onto a fixed list of facts about a patient.

Each fact has a short id and a closed set of answer ids. For every eligibility rule that clearly states a requirement on one fact, return a mapping: the fact, the answers that would make the patient ineligible under that rule, and the rule's exact words.

Rules for mapping:
1. Map a rule only when it clearly constrains one listed fact. Lab values, organ function, washout periods, consent, contraception, willingness, investigator judgment and life expectancy are never mapped. When in doubt, leave the rule out: a rule left out costs a question later, but a wrong mapping drops a trial the patient could have joined.
2. "rulesOut" lists exactly the answers the rule clearly makes ineligible. Never list an answer whose fit is uncertain. Never list every answer. Inclusion rules rule out the answers they don't allow; exclusion rules rule out the answers they exclude.
3. There is no "not tested" or "unknown" answer. A rule requiring a biomarker rules out "none_found" only, never a patient who hasn't been tested.
4. When a threshold falls inside an answer (a 3-year window against answers of 2 years and 2 to 5 years), rule out only answers wholly on the wrong side.
5. Exceptions the answers can express are honoured: "no brain metastases unless treated and stable" does not rule out "treated_stable".
6. If a rule applies only to part of the trial (an arm, cohort, part, phase or a cancer type's cohort), set "appliesTo" to that scope in the trial's own words. Otherwise leave it null. A rule that only applies to a cohort for another cancer type is not mapped at all.
7. "quote" is copied exactly from the criteria text, one rule's words, short enough to point at that rule. Do not paraphrase or join separate lines.
8. Rules that only state age, sex or which cancer types the trial takes are not mapped, except what they say about histology or how far the cancer has spread.
9. One passage may give several mappings, one per fact.

Return JSON only, in this shape:
{"mappings": [{"factId": "...", "rulesOut": ["..."], "polarity": "inclusion" | "exclusion", "quote": "...", "appliesTo": null}]}
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
