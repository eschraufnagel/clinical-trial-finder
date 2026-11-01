import type { ScreeningCriterion, StudyContext } from "./types.js";

/**
 * What the agent says in its own voice, written by code, never by the model
 * (spec §4.4).
 *
 * The opening and closing are the two moments a model would be most tempted to
 * sum up — "you seem like a great fit", "unfortunately you may not qualify" —
 * and the agent is never allowed to. Fixed text makes that impossible rather
 * than unlikely, and a test checks this text against the grader's verdict
 * pattern.
 *
 * Rewritten in slice 0007 of this repository for its reader: a person with
 * cancer checking a trial they picked, not a participant whose answers a
 * study coordinator reviews. The record is for them and their oncologist,
 * and the oncologist and the trial team decide. Every template is part of
 * `PROMPT_VERSION`, so the rewrite moved it.
 */

export const OPENING_TEMPLATE =
  'These questions are about the trial "{title}". {covered}' +
  "I'll ask about the rest of its rules one at a time. You can skip any question, " +
  'and "I don\'t know" is always fine.';

/** The opening's middle sentence, when the conversation covered some of the trial's rules. */
export const COVERED_TEMPLATE = "Your earlier answers already covered {n} of its rules. ";

export const CLOSING_TEMPLATE =
  "Thank you, that's all my questions. Your record for this trial is ready, for you and " +
  "your oncologist. They and the trial team decide whether it is right for you.";

/**
 * A criterion asked in its own words, with no model (`fixedQuestions`, for the
 * page's `--fake`). Clumsier than a phrased question, and exact.
 */
export const FIXED_QUESTION_TEMPLATE =
  "The trial asks about this: “{text}”. Does this describe you?";

/** `covered` is how many of the trial's rules the conversation's answers covered. */
export function openingMessage(study: StudyContext, covered = 0): string {
  return OPENING_TEMPLATE.replace("{title}", study.briefTitle).replace(
    "{covered}",
    covered > 0 ? COVERED_TEMPLATE.replace("{n}", String(covered)) : "",
  );
}

export function closingMessage(): string {
  return CLOSING_TEMPLATE;
}

export function fixedQuestion(criterion: ScreeningCriterion): string {
  return FIXED_QUESTION_TEMPLATE.replace("{text}", criterion.text);
}
