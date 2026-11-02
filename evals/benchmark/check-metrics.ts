import { LINK_THRESHOLD, overlap } from "../../src/check/link.js";
import type { RecordLine, TrialRecord } from "../../src/check/record.js";
import { unknownsMissingOf, verdictHitsOf } from "../check/metrics.js";
import type { BenchmarkTranscript } from "./check-run.js";
import type { PairReason } from "./pairs.js";
import { type Rate, rate } from "./search-score.js";

/**
 * The deeper check scored against clinicians' labels (spec 0008 §7.5, §7.7).
 * Pure, so a committed result regrades from its transcripts.
 *
 * - **Flagged:** the record holds at least one "may not fit" line, on the
 *   whole trial or one part of it. It's the record the person would carry.
 * - **Caught:** a flagged ineligible pair. **A false alarm:** a flagged
 *   eligible pair, "eligible but not recommended" included.
 * - **Caught for the named rule:** where the clinician's comment names a rule,
 *   a "may not fit" line whose criterion overlaps the rule's quote under the
 *   link's threshold.
 *
 * A line resting on a participant reply flagged as unfaithful doesn't count
 * toward flagged, and is listed: the simulator's invention isn't the check's
 * finding, as in slice 0007.
 */

export type Named = "rule-caught" | "rule-other" | "rule-missed" | "disease" | "none";
export type LineKind = "part" | "records" | "asked" | "earlier" | "about-the-trial";

export interface BenchmarkRow {
  patient: string;
  nctId: string;
  set: string;
  label: string;
  arm: string;
  parse: "parsed" | "failed";
  flagged: boolean;
  /** Criterion ids of the counted "may not fit" lines, each with where it sits. */
  mayNotFit: { criterionId: string; kind: LineKind }[];
  /** For an ineligible pair: what the comment named, and whether the check caught it. Null otherwise. */
  named: Named | null;
  asked: number;
  verdictHits: string[];
  unknownsMissing: string[];
  flags: number;
  excluded: string[];
  error: string | null;
}

const SECTIONS = ["earlier", "told", "records", "aboutTrial"] as const;

export function linesOf(record: TrialRecord): CountedLine[] {
  return SECTIONS.flatMap((section) => record[section].lines.map((line) => ({ section, line })));
}

function kindOf(section: (typeof SECTIONS)[number], line: RecordLine): LineKind {
  if (line.part !== null) return "part";
  if (section === "records") return "records";
  if (section === "told") return "asked";
  if (section === "earlier") return "earlier";
  return "about-the-trial";
}

export interface CountedLine {
  section: (typeof SECTIONS)[number];
  line: RecordLine;
}

/**
 * The record's "may not fit" lines that count, and the criteria set aside
 * because a finding on them rests on a reply flagged as unfaithful. Shared by
 * the frozen scoring and slice 0009's parts measure, so both count the same
 * lines.
 */
export function countedLines(t: BenchmarkTranscript): {
  counted: CountedLine[];
  excluded: string[];
} {
  const unfaithful = new Set(t.replies.filter((r) => r.flags.length > 0).map((r) => r.turn));
  const excluded = t.findings
    .filter((f) => f.evidence.some((e) => unfaithful.has(e.turn)))
    .map((f) => f.criterionId);
  const counted = linesOf(t.record).filter(
    (l) => l.line.mayNotFit && !excluded.includes(l.line.criterionId),
  );
  return { counted, excluded };
}

export function scoreBenchmarkPair(
  t: BenchmarkTranscript,
  reason: PairReason | undefined,
  criteriaText: string,
): BenchmarkRow {
  const { counted, excluded } = countedLines(t);
  const flagged = counted.length > 0;

  let named: Named | null = null;
  if (t.label === "ineligible") {
    if (reason === undefined || reason.kind === "none") named = "none";
    else if (reason.kind === "disease") named = "disease";
    else {
      const quote = reason.quote ?? "";
      const start = criteriaText.indexOf(quote);
      const span = { start, end: start + quote.length, text: quote };
      const onRule = counted.some((l) => {
        const source = t.sources[l.line.criterionId];
        return source !== undefined && start >= 0 && overlap(source, span) >= LINK_THRESHOLD;
      });
      named = onRule ? "rule-caught" : flagged ? "rule-other" : "rule-missed";
    }
  }

  return {
    patient: t.patient,
    nctId: t.nctId,
    set: t.set,
    label: t.label,
    arm: t.arm,
    parse: t.parse,
    flagged,
    mayNotFit: counted.map((l) => ({
      criterionId: l.line.criterionId,
      kind: kindOf(l.section, l.line),
    })),
    named,
    asked: t.transcript.filter((x) => x.kind === "question").length,
    verdictHits: verdictHitsOf(t),
    unknownsMissing: unknownsMissingOf(t),
    flags: t.replies.reduce((n, r) => n + r.flags.length, 0),
    excluded,
    error: t.error ?? null,
  };
}

export interface ArmSummary {
  arm: string;
  pairs: number;
  parseFailed: string[];
  /** Of ineligible pairs with a parse. */
  caught: Rate;
  /** Of ineligible pairs with a parse, by what the comment named. */
  byNamed: Record<Named, number>;
  /** Of eligible pairs with a parse. */
  falseAlarms: Rate;
  falseAlarmsByLabel: Record<string, Rate>;
  /** "May not fit" lines on false-alarm pairs, by where they sit. */
  falseAlarmLines: Record<LineKind, number>;
  asked: number;
  askedPerPair: number;
  verdictHits: number;
  unknownsMissing: number;
  flags: number;
  excluded: number;
  errors: string[];
}

const key = (r: { patient: string; nctId: string }) => `${r.patient} ${r.nctId}`;

export function summarizeArm(arm: string, rows: readonly BenchmarkRow[]): ArmSummary {
  const parsed = rows.filter((r) => r.parse === "parsed");
  const ineligible = parsed.filter((r) => r.label === "ineligible");
  const eligible = parsed.filter((r) => r.label !== "ineligible");
  const byNamed: Record<Named, number> = {
    "rule-caught": 0,
    "rule-other": 0,
    "rule-missed": 0,
    disease: 0,
    none: 0,
  };
  for (const r of ineligible) if (r.named !== null) byNamed[r.named] += 1;
  const falseAlarmLines: Record<LineKind, number> = {
    part: 0,
    records: 0,
    asked: 0,
    earlier: 0,
    "about-the-trial": 0,
  };
  for (const r of eligible.filter((x) => x.flagged)) {
    for (const l of r.mayNotFit) falseAlarmLines[l.kind] += 1;
  }
  const asked = parsed.reduce((n, r) => n + r.asked, 0);
  return {
    arm,
    pairs: rows.length,
    parseFailed: rows.filter((r) => r.parse === "failed").map(key),
    caught: rate(ineligible.filter((r) => r.flagged).length, ineligible.length),
    byNamed,
    falseAlarms: rate(eligible.filter((r) => r.flagged).length, eligible.length),
    falseAlarmsByLabel: Object.fromEntries(
      ["recommended", "eligible_but_not_recommended"].map((label) => {
        const of = eligible.filter((r) => r.label === label);
        return [label, rate(of.filter((r) => r.flagged).length, of.length)];
      }),
    ),
    falseAlarmLines,
    asked,
    askedPerPair: parsed.length === 0 ? 0 : Math.round((asked / parsed.length) * 10) / 10,
    verdictHits: rows.reduce((n, r) => n + r.verdictHits.length, 0),
    unknownsMissing: rows.reduce((n, r) => n + r.unknownsMissing.length, 0),
    flags: rows.reduce((n, r) => n + r.flags, 0),
    excluded: rows.reduce((n, r) => n + r.excluded.length, 0),
    errors: rows.filter((r) => r.error !== null).map(key),
  };
}

export interface ArmsCompared {
  /** Pairs with a parse in both arms. */
  pairs: number;
  caught: { both: string[]; fullOnly: string[]; accountOnly: string[] };
  falseAlarms: { both: string[]; fullOnly: string[]; accountOnly: string[] };
}

export function compareArms(rows: readonly BenchmarkRow[]): ArmsCompared {
  const full = new Map(rows.filter((r) => r.arm === "full").map((r) => [key(r), r]));
  const account = new Map(rows.filter((r) => r.arm === "account").map((r) => [key(r), r]));
  const both = [...full.keys()].filter(
    (k) => account.has(k) && full.get(k)?.parse === "parsed" && account.get(k)?.parse === "parsed",
  );
  const split = (ineligible: boolean) => {
    const of = both.filter((k) => (full.get(k)?.label === "ineligible") === ineligible);
    const f = (k: string) => full.get(k)?.flagged === true;
    const a = (k: string) => account.get(k)?.flagged === true;
    return {
      both: of.filter((k) => f(k) && a(k)),
      fullOnly: of.filter((k) => f(k) && !a(k)),
      accountOnly: of.filter((k) => !f(k) && a(k)),
    };
  };
  return { pairs: both.length, caught: split(true), falseAlarms: split(false) };
}
