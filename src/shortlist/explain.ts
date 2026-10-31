import type { Profile } from "../facts/status.js";
import type { Fact, FactMapping, FactVocabulary, WhoKnows } from "../facts/types.js";
import { factsFor } from "../facts/vocabulary.js";
import type { Flag } from "../search/types.js";
import type { OrderEntry, OrderName } from "./order.js";
import { phaseWords } from "./phase.js";
import { ours, registry, said, type Words } from "./words.js";

/**
 * What the short list says (spec 0004 §5): every trial the search kept, in
 * order, with what was read of its rules, what the person's answers checked,
 * what may not fit and what's still unknown. Pure: no model, no file, no
 * clock. The page lays this out and adds no words of its own about a trial.
 *
 * It never says a trial fits. A trial with no hints is one where nothing in
 * the person's answers conflicts with what was read of its rules, and the
 * view says how much that was.
 */

export interface CheckedFact {
  factId: string;
  question: Words;
  answer: Words;
  /** The person's own words, when they typed their answer. */
  said: Words | null;
}

export interface HintView {
  factId: string;
  question: Words;
  answer: Words;
  /** The trial's rule, verbatim. */
  rule: Words;
  /** The part of the trial the rule is for, in the trial's words. */
  part: Words | null;
}

export interface UnknownGroup {
  who: WhoKnows;
  heading: Words;
  facts: { factId: string; question: Words }[];
}

export interface TrialView {
  nctId: string;
  title: Words;
  interventions: Words[];
  phase: Words;
  site: Words;
  flags: Words[];
  /** How much of its rules were read onto the questions here. */
  read: Words;
  /**
   * On a trial read for fewer than `THIN_READ` of the questions, said before
   * "nothing conflicts" so that can't stand alone (0004 Gate 3).
   */
  thin: Words | null;
  checked: CheckedFact[];
  checkedNote: Words;
  hints: HintView[];
  hintNote: Words | null;
  unknown: UnknownGroup[];
  link: { href: string; label: Words };
}

export interface OrderView {
  heading: Words;
  note: Words;
  shortlist: TrialView[];
  rest: TrialView[];
  restHeading: Words;
}

export interface DescribeInput {
  /** Every trial the search kept, in order. */
  order: readonly OrderEntry[];
  orderName: OrderName;
  shortlistSize: number;
  profile: Profile;
  /** The person's words for each fact they answered by typing. */
  said?: Readonly<Record<string, string>>;
  vocabulary: FactVocabulary;
  cancerType: string;
  /** Facts never asked of this person, such as pregnancy for a man. */
  skipped?: readonly string[];
  /** A trial's interventions, from the snapshot, when the caller has them. */
  interventions?: (nctId: string) => readonly string[];
}

export const ORDER_WORDS: Readonly<Record<OrderName, string>> = {
  hints: "Trials with the fewest conflicts with your answers come first, then the nearest.",
  checked:
    "Trials with the fewest conflicts with your answers come first, then those whose rules your answers checked most, then the nearest.",
  "read-first":
    "Trials with the fewest conflicts with your answers come first. Among those, trials whose rules could be read come before trials whose rules couldn't, then the nearest.",
  "other-last":
    "Trials whose records name only other cancers come last. Before them, trials with the fewest conflicts with your answers come first. Among those, trials whose rules could be read come before trials whose rules couldn't, then the nearest.",
};

export const FLAG_WORDS: Readonly<Record<Flag, string>> = {
  "stale-record": "This record hasn't been updated in over a year. It may not be enrolling.",
  "past-completion": "Its planned completion date has passed. It may not be enrolling.",
  "age-limit-unread": "Its age limits couldn't be read. Check them in the full record.",
  "site-distance-unknown": "The distance to some of its sites isn't known.",
};

/**
 * A trial read for fewer than this share of the questions is "thinly read"
 * (0004 Gate 3): about a third. A trial with no mappings has its own line.
 */
export const THIN_READ = 1 / 3;

export const THIN_WORDS = "Few of this trial's rules could be checked against your answers.";

export const WHO_WORDS: Readonly<Record<WhoKnows, string>> = {
  patient: "You could find out",
  oncologist: "Your oncologist would know",
  records: "In your records",
};

const WHO_ORDER: readonly WhoKnows[] = ["patient", "oncologist", "records"];

/** "1 mile away", "12 miles away", "under a mile away", "distance not known". */
export function milesWords(miles: number | null): string {
  if (miles === null) return "distance not known";
  if (miles === 0) return "under a mile away";
  return `${miles} ${miles === 1 ? "mile" : "miles"} away`;
}

export function describeOrder(input: DescribeInput): OrderView {
  const context = contextOf(input);
  const trials = input.order.map((entry) => describeWith(entry, input, context));
  return {
    heading: ours("Your list"),
    note: ours(
      `${ORDER_WORDS[input.orderName]} The order isn't a ranking of which trial would work for you. Nothing here says whether you could take part in any trial; your oncologist and each trial's team decide that.`,
    ),
    shortlist: trials.slice(0, input.shortlistSize),
    rest: trials.slice(input.shortlistSize),
    restHeading: ours(
      `${Math.max(0, trials.length - input.shortlistSize)} more trials the search kept, in the same order`,
    ),
  };
}

export function describeTrial(entry: OrderEntry, input: DescribeInput): TrialView {
  return describeWith(entry, input, contextOf(input));
}

interface Context {
  facts: ReadonlyMap<string, Fact>;
  position: ReadonlyMap<string, number>;
  total: number;
  skipped: ReadonlySet<string>;
}

function contextOf(input: DescribeInput): Context {
  return {
    facts: new Map(input.vocabulary.facts.map((f) => [f.id, f])),
    position: new Map(input.vocabulary.facts.map((f, i) => [f.id, i])),
    total: factsFor(input.vocabulary, input.cancerType).length,
    skipped: new Set(input.skipped ?? []),
  };
}

function describeWith(entry: OrderEntry, input: DescribeInput, context: Context): TrialView {
  const { candidate, status } = entry;
  const { facts, position, total, skipped } = context;
  const question = (factId: string) => ours(facts.get(factId)?.question ?? factId);
  const answerWords = (factId: string, answerId: string) =>
    ours(facts.get(factId)?.answers.find((a) => a.id === answerId)?.words ?? answerId);

  const hintMappings: FactMapping[] = [...(status?.hints ?? []), ...(status?.partHints ?? [])];
  const hinted = new Set(hintMappings.map((m) => m.factId));
  const mapped = status === null ? 0 : status.fits.length + status.unknown.length;

  const unknownFacts = (status?.unknown ?? []).filter(
    (f) => !hinted.has(f) && !skipped.has(f) && input.profile[f] === undefined,
  );
  const unknown: UnknownGroup[] = WHO_ORDER.flatMap((who) => {
    const group = unknownFacts
      .filter((f) => facts.get(f)?.whoKnows === who)
      .sort((a, b) => (position.get(a) ?? 0) - (position.get(b) ?? 0))
      .map((factId) => ({ factId, question: question(factId) }));
    return group.length === 0 ? [] : [{ who, heading: ours(WHO_WORDS[who]), facts: group }];
  });

  const site = candidate.nearestSite;
  const place = [site?.facility, site?.city, site?.state].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  );
  const siteWords =
    site === null
      ? "No recruiting site is listed."
      : `Nearest site: ${place.length === 0 ? "not named" : place.join(", ")}, ${milesWords(site.miles)}.`;

  return {
    nctId: candidate.nctId,
    title: registry(candidate.briefTitle),
    interventions: (input.interventions?.(candidate.nctId) ?? []).map((i) => registry(i)),
    phase: ours(phaseWords(candidate.phases)),
    site: ours(siteWords),
    flags: candidate.flags.map((f) => ours(FLAG_WORDS[f])),
    read: ours(
      status === null
        ? "This tool couldn't read this trial's rules. Ask about it like any other."
        : mapped === 0
          ? "None of this trial's rules could be matched to the questions here. Ask about it like any other."
          : `Its rules were read for ${mapped} of the ${total} questions here.`,
    ),
    thin: mapped > 0 && mapped < THIN_READ * total ? ours(THIN_WORDS) : null,
    checked: (status?.fits ?? []).map((factId) => {
      const words = input.said?.[factId];
      return {
        factId,
        question: question(factId),
        answer: answerWords(factId, input.profile[factId] ?? ""),
        said: words === undefined ? null : said(words),
      };
    }),
    checkedNote: ours(
      (status?.fits.length ?? 0) === 0
        ? "None of your answers so far could be checked against what was read of its rules."
        : "Nothing in what was read of its rules conflicts with these answers.",
    ),
    hints: hintMappings.map((m) => ({
      factId: m.factId,
      question: question(m.factId),
      answer: answerWords(m.factId, input.profile[m.factId] ?? ""),
      rule: registry(m.source.text.replace(/\s+/g, " ").trim()),
      part: m.appliesTo === undefined ? null : registry(m.appliesTo),
    })),
    hintNote:
      hintMappings.length === 0
        ? null
        : ours(
            "May not fit: one of your answers may conflict with this rule. The reading of rules is automatic, and wrong about a quarter of the time. Ask your oncologist.",
          ),
    unknown,
    link: {
      href: `https://clinicaltrials.gov/study/${encodeURIComponent(candidate.nctId)}`,
      label: ours("The full record on ClinicalTrials.gov"),
    },
  };
}
