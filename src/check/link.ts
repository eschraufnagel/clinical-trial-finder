import type { Criterion, CriterionPolarity, SourceSpan } from "../criteria/types.js";
import type { TrialFacts } from "../facts/types.js";

/**
 * Which of a trial's parsed criteria the conversation's facts cover (spec
 * 0007 §3.1). No model: a criterion is linked to a fact when its source span
 * overlaps the source span of one of the trial's fact mappings, both being
 * offsets into the same `criteriaText`.
 *
 * The link is a model reading at one remove. The mapper (slice 0002) decided
 * which passage asks about which fact, and was wrong about a quarter of the
 * time on held-out. So a link decides only what the check asks and how a rule
 * is shown on the record; it never decides whether a trial stays. A rule
 * about an answered fact that the mapper missed isn't linked, and is asked
 * again, which the measurement counts as a repeat.
 */

/**
 * Shared characters ÷ the shorter span's length, at or above which two spans
 * are the same rule. Half, so a criterion split out of a longer mapped
 * passage links, and a neighbour that merely touches it doesn't. Set before
 * dev, and frozen at Gate 1.
 */
export const LINK_THRESHOLD = 0.5;

/** A fact mapping that covers a criterion. */
export interface LinkedFact {
  factId: string;
  /** Answers the mapping says the rule excludes: a "may not fit" hint, never a removal. */
  rulesOut: string[];
  polarity: CriterionPolarity;
  appliesTo?: string;
  /** The mapping's passage, in the trial's words. */
  source: SourceSpan;
}

/** How much of the shorter of two spans the two share, from 0 to 1. */
export function overlap(a: SourceSpan, b: SourceSpan): number {
  const shared = Math.min(a.end, b.end) - Math.max(a.start, b.start);
  const shorter = Math.min(a.end - a.start, b.end - b.start);
  return shared <= 0 || shorter <= 0 ? 0 : shared / shorter;
}

/**
 * Criterion id to the facts that cover it. Every criterion in `ids` gets an
 * entry, empty when nothing covers it. With no mappings for the trial
 * (`facts` undefined, as for the 18 trials the mapping run failed on) every
 * entry is empty.
 *
 * Throws when a span doesn't come from `criteriaText`: spans from two
 * different texts can overlap by accident, and a link made that way would
 * be silently wrong.
 */
export function linkCriteria(
  nctId: string,
  criteriaText: string,
  ids: ReadonlyMap<Criterion, string>,
  facts: TrialFacts | undefined,
  threshold = LINK_THRESHOLD,
): Map<string, LinkedFact[]> {
  const mappings = facts?.mappings ?? [];
  const problems = [
    ...[...ids.keys()].map((c) => c.source),
    ...mappings.map((m) => m.source),
  ].filter((s) => criteriaText.slice(s.start, s.end) !== s.text);
  if (problems.length > 0) {
    throw new Error(
      `Cannot link ${nctId}: ${problems.length} span(s) don't match its criteria text, ` +
        `first at ${problems[0]?.start}-${problems[0]?.end}`,
    );
  }

  const links = new Map<string, LinkedFact[]>();
  for (const [criterion, id] of ids) {
    links.set(
      id,
      mappings
        .filter((m) => overlap(criterion.source, m.source) >= threshold)
        .map((m) => ({
          factId: m.factId,
          rulesOut: [...m.rulesOut],
          polarity: m.polarity,
          ...(m.appliesTo === undefined ? {} : { appliesTo: m.appliesTo }),
          source: m.source,
        })),
    );
  }
  return links;
}
