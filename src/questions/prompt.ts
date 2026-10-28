import { hashPrompt } from "../criteria/prompt.js";
import type { Fact } from "../facts/types.js";

/**
 * The reader's prompt (spec 0003 §7.1): one question, its fixed answers and
 * one reply, read onto an answer or "unknown". Versioned by a hash, as the
 * parser's and mapper's prompts are.
 *
 * Written after the patients' replies were committed and before it was run on
 * any of them. Its rules restate `evals/cases/patients/AUTHORING.md` Rule 5
 * in general terms; no reply's wording is copied into it.
 */
export const READER_SYSTEM_PROMPT = `You read one reply from a person with lung cancer to one question about their health, and decide which of the question's fixed answers the reply states.

Rules:
1. Choose an answer only when the reply states it. If the reply doesn't say, answer "unknown".
2. A guess, a hedge ("maybe", "I think", "not sure"), a question back, or a term mentioned without being asserted ("they tested for something like that") is "unknown". So is "I've never been tested for it": not knowing is not "no".
3. Common drug brand names and plain words count when they plainly name the answer. For example, a person who names an immunotherapy drug and says the cancer grew on it has had that kind of drug, and it grew.
4. Read the reply only against this question. Ignore anything it says about other topics.
5. A person who says the question doesn't apply to them ("I'm a man") answers "no" to a question about pregnancy.
6. Never infer an answer from what is usual or likely. Only what the reply says counts.

Return JSON only: {"answer": "<one answer id, or unknown>"}`;

export const READER_PROMPT_VERSION = hashPrompt(READER_SYSTEM_PROMPT);

export function buildReaderPrompt(fact: Fact, reply: string): string {
  return [
    `Question: ${fact.question}`,
    "Answers:",
    ...fact.answers.map((a) => `- ${a.id}: ${a.words}`),
    "- unknown: the reply doesn't say",
    "",
    `Reply: ${JSON.stringify(reply)}`,
  ].join("\n");
}
