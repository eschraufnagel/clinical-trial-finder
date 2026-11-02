import { LINK_THRESHOLD, overlap } from "../../src/check/link.js";
import { countedLines, linesOf } from "./check-metrics.js";
import type { BenchmarkTranscript } from "./check-run.js";
import type { PairReason } from "./pairs.js";
import { type Rate, rate } from "./search-score.js";

/**
 * Slice 0009's measure beside 0008's frozen one (spec 0009 §5.2). Pure, so a
 * committed result regrades from its transcripts.
 *
 * - **Flagged outside parts:** the record holds a counted "may not fit" line
 *   on a rule for the whole trial. A clinician's "eligible" means eligible for
 *   some part, so a line on one part the person isn't in is set apart here,
 *   as the record now sets it apart. 0008's frozen measure still counts it.
 * - **Named rule on the record:** where the clinician's comment names a rule,
 *   whether that rule reached the record as "may not fit", under "Needs your
 *   records or your oncologist", or on "To ask your oncologist". A count
 *   beside `rule-caught`, never a catch.
 *
 * "Counted" is the frozen scoring's: a line resting on a flagged reply doesn't
 * count.
 */

export interface PartsRow {
  patient: string;
  nctId: string;
  arm: string;
  label: string;
  parse: "parsed" | "failed";
  flaggedOutsideParts: boolean;
  /** For a `rule` pair: whether the named rule is on the record. Null otherwise. */
  namedOnRecord: boolean | null;
}

export function scorePartsPair(
  t: BenchmarkTranscript,
  reason: PairReason | undefined,
  criteriaText: string,
): PartsRow {
  const { counted } = countedLines(t);
  let namedOnRecord: boolean | null = null;
  if (t.label === "ineligible" && reason?.kind === "rule") {
    const quote = reason.quote ?? "";
    const start = criteriaText.indexOf(quote);
    const span = { start, end: start + quote.length, text: quote };
    const asked = new Set(t.record.toAsk.items.map((i) => JSON.stringify(i.rule)));
    namedOnRecord = linesOf(t.record).some(({ section, line }) => {
      const source = t.sources[line.criterionId];
      const onRecord =
        line.mayNotFit || section === "records" || asked.has(JSON.stringify(line.rule));
      return (
        onRecord && source !== undefined && start >= 0 && overlap(source, span) >= LINK_THRESHOLD
      );
    });
  }
  return {
    patient: t.patient,
    nctId: t.nctId,
    arm: t.arm,
    label: t.label,
    parse: t.parse,
    flaggedOutsideParts: counted.some((l) => l.line.part === null),
    namedOnRecord,
  };
}

export interface PartsSummary {
  arm: string;
  /** Of ineligible pairs with a parse. */
  caught: Rate;
  /** Of eligible pairs with a parse. */
  falseAlarms: Rate;
  falseAlarmsByLabel: Record<string, Rate>;
  /** Of `rule` pairs: the named rule on the record. */
  namedOnRecord: Rate;
}

export function summarizeParts(arm: string, rows: readonly PartsRow[]): PartsSummary {
  const parsed = rows.filter((r) => r.parse === "parsed");
  const ineligible = parsed.filter((r) => r.label === "ineligible");
  const eligible = parsed.filter((r) => r.label !== "ineligible");
  const rule = parsed.filter((r) => r.namedOnRecord !== null);
  return {
    arm,
    caught: rate(ineligible.filter((r) => r.flaggedOutsideParts).length, ineligible.length),
    falseAlarms: rate(eligible.filter((r) => r.flaggedOutsideParts).length, eligible.length),
    falseAlarmsByLabel: Object.fromEntries(
      ["recommended", "eligible_but_not_recommended"].map((label) => {
        const of = eligible.filter((r) => r.label === label);
        return [label, rate(of.filter((r) => r.flaggedOutsideParts).length, of.length)];
      }),
    ),
    namedOnRecord: rate(rule.filter((r) => r.namedOnRecord === true).length, rule.length),
  };
}
