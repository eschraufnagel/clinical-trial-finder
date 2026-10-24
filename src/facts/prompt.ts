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
1. Map a rule only when it clearly constrains one listed fact. Lab values, organ function, washout periods, consent, contraception, willingness, investigator judgment, life expectancy and "any significant medical condition" are never mapped. When in doubt, leave the rule out: a rule left out costs a question later, but a wrong mapping drops a trial the patient could have joined.
2. "rulesOut" lists exactly the answers the rule clearly makes ineligible. Read each answer's words. An answer that the rule might accept for some patients is not ruled out. Never list every answer.
3. A sentence that says who is allowed ("are eligible if", "may participate", "are permitted", "is allowed") rules nothing out. Do not map it.
4. A qualifier limits the rule to answers that have it. "Uncontrolled HIV" rules out only the uncontrolled answer. "Symptomatic brain metastases" rules out only the answer about symptoms, not untreated metastases without symptoms. "Active autoimmune disease" or "currently requiring treatment" does not match an answer defined by the last 2 years.
5. If the rule adds a condition that no answer states (a different time window, "that required steroids", "on immunosuppressants", a specific drug or test level such as "HER2 IHC 1+"), rule out only the answers that clearly fail it, and if none does, do not map. Example: "no other cancer within 3 years" rules out "within_2_years" only, because "two_to_5_years" may be 4 years ago.
6. There is no "not tested" or "unknown" answer. A rule requiring a biomarker rules out "none_found" only, never a patient who hasn't been tested.
7. "Advanced", "metastatic or locally advanced" and "without curative options" rule out "early_resectable" only.
8. If a rule applies only to part of the trial (an arm, cohort, part or phase), set "appliesTo" to that scope in the trial's own words. Otherwise leave it null. A cohort or part limited to cancer types other than lung cancer (for example a gastric, breast or urothelial cohort) is skipped entirely: map nothing from it.
9. "quote" is copied exactly from the criteria text, one rule's words, short enough to point at that rule. Do not paraphrase or join separate lines.
10. Rules that only state age, sex or which cancer types the trial takes are not mapped, except what they say about lung cancer histology or how far the cancer has spread.
11. One passage may give several mappings, one per fact.

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
