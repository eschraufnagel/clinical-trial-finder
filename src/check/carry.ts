import type { Carried, CarriedFact } from "../screening/types.js";
import type { LinkedFact } from "./link.js";

/**
 * What the conversation settled, by the criteria it covers (spec 0007 §3.2,
 * §3.3). No model.
 *
 * A criterion is carried only when every fact linked to it was asked. "I
 * don't know" counts as asked, since asking it again would be asking twice.
 * A criterion with any linked fact unasked isn't carried: part of it is still
 * open, and the agent asks it whole.
 */

/** One fact the conversation asked: the confirmed answer, and the person's words. */
export interface ConversationAnswer {
  /** An answer id, or `"unknown"`. */
  answer: string;
  /** What they typed, or the tapped answer's own words. */
  words: string;
  /** The conversation's question, in the vocabulary's words. */
  question: string;
}

export function carriedFor(
  links: ReadonlyMap<string, readonly LinkedFact[]>,
  answers: ReadonlyMap<string, ConversationAnswer>,
): Carried {
  const carried: Record<string, CarriedFact[]> = {};
  for (const [criterionId, linked] of links) {
    if (linked.length === 0 || !linked.every((l) => answers.has(l.factId))) continue;
    const byFact = new Map<string, CarriedFact>();
    for (const l of linked) {
      const a = answers.get(l.factId);
      if (a === undefined) continue;
      const mayNotFit = l.rulesOut.includes(a.answer);
      const prior = byFact.get(l.factId);
      // Two mappings of one fact on one criterion: either one's hint stands.
      byFact.set(l.factId, {
        factId: l.factId,
        answer: a.answer,
        words: a.words,
        question: a.question,
        mayNotFit: mayNotFit || (prior?.mayNotFit ?? false),
      });
    }
    carried[criterionId] = [...byFact.values()];
  }
  return carried;
}
