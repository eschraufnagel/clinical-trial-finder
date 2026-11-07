import type { FactMapping } from "../facts/types.js";
import type { Finding, ScreeningCriterion, StudyContext } from "../screening/types.js";
import { ours, registry, said, type Words } from "../shortlist/words.js";
import type { ConversationAnswer } from "./carry.js";

/**
 * A trial's record, for the person and their oncologist (spec 0007 §5). Pure:
 * no model, no file. The page lays it out and prints it, and adds no words of
 * its own about the trial.
 *
 * Every criterion lands in exactly one section. "May not fit" is the only
 * word for a conflict, as on the list, and nothing here says a person fits,
 * qualifies or is ruled out. There is no field for a verdict, so none can be
 * shown. A record never changes the list: the order, the sheet and the
 * chooser don't read it.
 *
 * Text follows `src/shortlist/words.ts`: `ours` is scanned for verdict words,
 * a rule is the trial's own words (`registry`), and what the person said is
 * theirs (`said`).
 */

export const NOT_A_DECISION =
  "This isn't a decision. Your oncologist and the trial team decide whether this trial is right for you.";
export const HEADING_EARLIER = "What your earlier answers covered";
export const HEADING_TOLD = "What you told the check";
export const HEADING_RECORDS = "Needs your records or your oncologist";
export const HEADING_ABOUT_TRIAL = "About the trial, not you";
export const HEADING_TO_ASK = "To ask your oncologist";
export const MAY_NOT_FIT = "May not fit";
/** For a rule the parse says applies to one part of the trial (`appliesTo`): the rest may still fit. */
export const MAY_NOT_FIT_PART = "May not fit one part of the trial";
export const NOTHING_CONFLICTS = "Nothing here conflicts with what you said.";
export const REQUIRED = "The trial requires";
export const EXCLUDED = "The trial excludes";
export const ASK_MAY_NOT_FIT = "Does this rule keep this trial from being an option for me?";
export const ASK_RECORDS = "Do my records settle this rule?";
/** For a "may not fit" on one part of the trial (slice 0009): which part comes first. */
export const ASK_PART = "Which part of the trial would I be in, and is this rule for it?";
export const NO_PARSE =
  "This trial's rules couldn't be read just now, so it wasn't checked. These are the rules your earlier answers covered.";

/** Why a rule needs records or the oncologist, by the finding's reason. */
export const WHY = {
  didntKnow: "You didn't know.",
  labValue: "A lab value: your records will have it.",
  chart: "Only your records can settle this, whatever you said.",
  skipped: "You skipped it.",
  notAsked: "Not asked.",
  unclear: "Your answer didn't settle it.",
  contradicted: "Your answers disagreed.",
  notAboutYou: "You said this isn't about you.",
} as const;

/**
 * The record's counts. A "may not fit" on one part of the trial is counted on
 * its own (slice 0009): the person may not be in that part, and the first
 * sentence then counts only the rest. With none, the line is as before.
 */
export function countsLine(mayNotFit: number, records: number, onePart = 0): string {
  const rules = (n: number) => (n === 1 ? "1 rule" : `${n} rules`);
  const more = mayNotFit - onePart === 0 ? "" : " more";
  const part =
    onePart === 0
      ? ""
      : `${onePart}${more} ${onePart === 1 ? "is" : "are"} for one part of the trial, which you may not be in. `;
  return (
    `${rules(mayNotFit - onePart)} may not fit what you said. ${part}` +
    `${rules(records)} need${records === 1 ? "s" : ""} your records or your oncologist.`
  );
}

/** An earlier answer carried onto a rule: the conversation's question, and the person's answer to it. */
export interface EarlierAnswer {
  asked: Words;
  said: Words;
}

export interface RecordLine {
  criterionId: string;
  /** Whether the rule is something the trial requires or excludes. */
  kind: Words;
  rule: Words;
  /**
   * The conversation's answers that covered this rule, each beside the
   * question it answered. The question is shown because the link is a
   * model's reading: when it ties a rule to the wrong question, the person
   * and their oncologist can see it.
   */
  earlier: EarlierAnswer[];
  /** What the person said to the check about this rule. */
  said: Words[];
  /** The part of the trial the rule is for, in the trial's words, or null for the whole trial. */
  part: Words | null;
  /** `MAY_NOT_FIT`, `MAY_NOT_FIT_PART`, `NOTHING_CONFLICTS`, or nothing. */
  flag: Words | null;
  mayNotFit: boolean;
  why: Words | null;
}

export interface RecordSection {
  heading: Words;
  lines: RecordLine[];
  /** Shown folded until opened: the rules about the trial itself. */
  folded: boolean;
}

export interface TrialRecord {
  nctId: string;
  title: Words;
  notADecision: Words;
  /** `mayNotFit` counts every "may not fit" line; `onePart` those on one part of the trial. */
  counts: { mayNotFit: number; onePart: number; records: number; line: Words };
  /** Absent when the check ran; present when the trial's rules couldn't be read. */
  lead: Words | null;
  earlier: RecordSection;
  told: RecordSection;
  records: RecordSection;
  aboutTrial: RecordSection;
  toAsk: { heading: Words; items: { rule: Words; question: Words }[] };
}

export interface RecordInput {
  study: StudyContext;
  criteria: readonly ScreeningCriterion[];
  findings: readonly Finding[];
  /** Each criterion's passage, verbatim from the trial's text. Falls back to the criterion's text. */
  wording?: ReadonlyMap<string, string>;
  /** The part of the trial a criterion is for, from the parse's `appliesTo`, when it names one. */
  parts?: ReadonlyMap<string, string>;
}

type Place = "earlier" | "told" | "records" | "aboutTrial";

export function recordFor(input: RecordInput): TrialRecord {
  const criteria = new Map(input.criteria.map((c) => [c.id, c]));
  const placed: Record<Place, RecordLine[]> = {
    earlier: [],
    told: [],
    records: [],
    aboutTrial: [],
  };

  for (const f of input.findings) {
    const c = criteria.get(f.criterionId);
    if (c === undefined) throw new Error(`No criterion ${f.criterionId} for its finding`);
    const { place, line } = lineFor(c, f, input.wording?.get(c.id) ?? c.text);
    placed[place].push(withPart(line, input.parts?.get(c.id)));
  }
  return assemble(input.study, placed, null);
}

/**
 * The record of a trial whose rules couldn't be parsed (spec 0007 §3.4): the
 * rules the fact mappings read, with the person's answers beside the ones
 * the conversation asked. Nothing else is known about the trial, and the
 * lead says so.
 */
export function recordWithoutParse(
  study: StudyContext,
  mappings: readonly FactMapping[],
  answers: ReadonlyMap<string, ConversationAnswer>,
): TrialRecord {
  const placed: Record<Place, RecordLine[]> = {
    earlier: [],
    told: [],
    records: [],
    aboutTrial: [],
  };
  mappings.forEach((m, i) => {
    const a = answers.get(m.factId);
    const base = {
      criterionId: `M${i + 1}`,
      kind: ours(m.polarity === "inclusion" ? REQUIRED : EXCLUDED),
      rule: registry(m.source.text),
      part: null,
    };
    if (a === undefined) {
      placed.records.push({
        ...base,
        earlier: [],
        said: [],
        flag: null,
        mayNotFit: false,
        why: ours(WHY.notAsked),
      });
      return;
    }
    const mayNotFit = m.rulesOut.includes(a.answer);
    placed.earlier.push(
      withPart(
        {
          ...base,
          earlier: [{ asked: ours(a.question), said: said(a.words) }],
          said: [],
          flag: mayNotFit ? ours(MAY_NOT_FIT) : null,
          mayNotFit,
          why: a.answer === "unknown" ? ours(WHY.didntKnow) : null,
        },
        m.appliesTo,
      ),
    );
  });
  return assemble(study, placed, ours(NO_PARSE));
}

function lineFor(
  c: ScreeningCriterion,
  f: Finding,
  wording: string,
): { place: Place; line: RecordLine } {
  const carried = f.earlier ?? [];
  const earlier = carried.map((e) => ({ asked: ours(e.question), said: said(e.words) }));
  const earlierHint = carried.some((e) => e.mayNotFit);
  const quotes = f.evidence.map((e) => said(e.quote));
  const base = {
    criterionId: c.id,
    kind: ours(c.polarity === "inclusion" ? REQUIRED : EXCLUDED),
    rule: registry(wording),
    earlier,
    part: null,
  };
  // The statement is true of them and the trial excludes it, or false and the trial requires it.
  const conflicts = (value: string | undefined) =>
    (c.polarity === "exclusion" && value === "holds") ||
    (c.polarity === "inclusion" && value === "does-not-hold");

  switch (f.status) {
    case "from-conversation": {
      const didntKnow = carried.some((e) => e.answer === "unknown");
      return {
        place: "earlier",
        line: {
          ...base,
          said: [],
          flag: earlierHint ? ours(MAY_NOT_FIT) : null,
          mayNotFit: earlierHint,
          why: didntKnow ? ours(WHY.didntKnow) : null,
        },
      };
    }
    case "holds":
    case "does-not-hold": {
      const mayNotFit = conflicts(f.status);
      return {
        place: "told",
        line: {
          ...base,
          said: quotes,
          flag: ours(mayNotFit ? MAY_NOT_FIT : NOTHING_CONFLICTS),
          mayNotFit,
          why: null,
        },
      };
    }
    case "chart-review":
    case "unresolved": {
      const mayNotFit = (f.status === "chart-review" && conflicts(f.reported)) || earlierHint;
      return {
        place: "records",
        line: {
          ...base,
          said: quotes,
          flag: mayNotFit ? ours(MAY_NOT_FIT) : null,
          mayNotFit,
          why: ours(whyFor(f)),
        },
      };
    }
    case "not-raised": {
      const lab = f.reason === "lab-value";
      return {
        place: lab ? "records" : "aboutTrial",
        line: {
          ...base,
          said: [],
          flag: earlierHint ? ours(MAY_NOT_FIT) : null,
          mayNotFit: earlierHint,
          why: lab ? ours(WHY.labValue) : null,
        },
      };
    }
  }
}

/**
 * A rule for one part of the trial says so. Its "may not fit" reads "may not
 * fit one part of the trial", and it still counts as a "may not fit": the
 * wording changes, the measure doesn't.
 */
function withPart(line: RecordLine, part: string | undefined): RecordLine {
  if (part === undefined) return line;
  return {
    ...line,
    part: registry(part),
    flag: line.mayNotFit ? ours(MAY_NOT_FIT_PART) : line.flag,
  };
}

function whyFor(f: Finding): string {
  if (f.status === "chart-review" && (f.reason === "answered" || f.reason === "partial")) {
    return WHY.chart;
  }
  switch (f.reason) {
    case "unknown":
      return WHY.didntKnow;
    case "declined":
      return WHY.skipped;
    case "no-answer":
      return WHY.notAsked;
    case "contradicted":
      return WHY.contradicted;
    case "does-not-apply":
      return WHY.notAboutYou;
    case "lab-value":
      return WHY.labValue;
    default:
      return f.status === "chart-review" ? WHY.chart : WHY.unclear;
  }
}

function assemble(
  study: StudyContext,
  placed: Record<Place, RecordLine[]>,
  lead: Words | null,
): TrialRecord {
  const all = [...placed.earlier, ...placed.told, ...placed.records, ...placed.aboutTrial];
  const mayNotFit = all.filter((l) => l.mayNotFit).length;
  const onePart = all.filter((l) => l.mayNotFit && l.part !== null).length;
  // A rule the conversation's "I don't know" covered is as open as one the
  // check left unresolved: it goes to the oncologist too, and counts.
  const didntKnow = placed.earlier.filter((l) => !l.mayNotFit && isWhy(l, WHY.didntKnow));
  const records = placed.records.length + didntKnow.length;
  const section = (heading: string, lines: RecordLine[], folded = false): RecordSection => ({
    heading: ours(heading),
    lines,
    folded,
  });
  return {
    nctId: study.nctId,
    title: registry(study.briefTitle),
    notADecision: ours(NOT_A_DECISION),
    counts: { mayNotFit, onePart, records, line: ours(countsLine(mayNotFit, records, onePart)) },
    lead,
    earlier: section(HEADING_EARLIER, placed.earlier),
    told: section(HEADING_TOLD, placed.told),
    records: section(HEADING_RECORDS, placed.records),
    aboutTrial: section(HEADING_ABOUT_TRIAL, placed.aboutTrial, true),
    toAsk: {
      heading: ours(HEADING_TO_ASK),
      items: [
        ...all
          .filter((l) => l.mayNotFit && l.part === null)
          .map((l) => ({ rule: l.rule, question: ours(ASK_MAY_NOT_FIT) })),
        ...[...placed.records.filter((l) => !l.mayNotFit), ...didntKnow].map((l) => ({
          rule: l.rule,
          question: ours(ASK_RECORDS),
        })),
        // Last, because whether the person would be in that part comes first (slice 0009).
        ...all
          .filter((l) => l.mayNotFit && l.part !== null)
          .map((l) => ({ rule: l.rule, question: ours(ASK_PART) })),
      ],
    },
  };
}

function isWhy(line: RecordLine, why: string): boolean {
  return line.why !== null && "ours" in line.why && line.why.ours === why;
}
