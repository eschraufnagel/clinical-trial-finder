import type { ParsedCriteria } from "../criteria/types.js";
import type { TrialFacts } from "../facts/types.js";
import type { ModelAdapter } from "../models/types.js";
import { fromParse } from "../screening/from-parse.js";
import { ScreeningSession } from "../screening/session.js";
import type {
  Carried,
  ScreeningCriterion,
  ScreeningResult,
  StudyContext,
} from "../screening/types.js";
import { type ConversationAnswer, carriedFor } from "./carry.js";
import { type LinkedFact, linkCriteria } from "./link.js";
import { recordFor, type TrialRecord } from "./record.js";

/**
 * One trial's check, from its parse (spec 0007 §2, §3): the agent's criteria,
 * the link to the facts the conversation asked, what that carries, and a
 * session that starts from it. The parse comes from the caller, from the
 * cache or a committed run (`parse-cache.ts`), so this builds no adapter and
 * calls no model before the session's first question.
 */

export interface CheckInput {
  study: StudyContext;
  /** The verbatim text the parse's spans and the mappings' spans point into. */
  criteriaText: string;
  parsed: ParsedCriteria;
  /** The trial's fact mappings, or undefined when the mapping run has none. */
  facts: TrialFacts | undefined;
  /** The conversation's answers, by fact id. */
  answers: ReadonlyMap<string, ConversationAnswer>;
  adapter: ModelAdapter;
  fixedQuestions?: boolean;
}

export interface Check {
  session: ScreeningSession;
  criteria: ScreeningCriterion[];
  links: Map<string, LinkedFact[]>;
  carried: Carried;
  /** Each criterion's passage, verbatim, for the record. */
  wording: Map<string, string>;
}

export function startCheck(input: CheckInput): Check {
  const { criteria, ids } = fromParse(input.parsed);
  const links = linkCriteria(input.study.nctId, input.criteriaText, ids, input.facts);
  const carried = carriedFor(links, input.answers);
  const wording = new Map([...ids].map(([c, id]) => [id, c.source.text]));
  const session = ScreeningSession.create(input.study, criteria, input.adapter, {
    carried,
    ...(input.fixedQuestions === true ? { fixedQuestions: true } : {}),
  });
  return { session, criteria, links, carried, wording };
}

/** The record of a finished (or stopped) check. */
export function recordOf(check: Check, result: ScreeningResult): TrialRecord {
  return recordFor({
    study: result.study,
    criteria: check.criteria,
    findings: result.findings,
    wording: check.wording,
  });
}
