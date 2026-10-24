import type { Reason } from "../../src/search/vocabulary.js";
import type { LabelSetName } from "./labels.js";

/**
 * How the search's cancer-type stage did against the labels (spec 0001
 * §6.3). Every number is derived from the rows, so a committed result can be
 * re-derived and checked.
 */

export interface ResultRow {
  nctId: string;
  set: LabelSetName;
  relevant: boolean;
  kept: boolean;
  reasons: Reason[];
}

export interface Metrics {
  labelled: number;
  relevant: number;
  kept: number;
  keptRelevant: number;
  /** keptRelevant / relevant. */
  recall: number;
  /** Wilson 95% interval for recall. */
  recallInterval: [number, number];
  /** keptRelevant / kept. */
  precision: number;
  byReason: { reason: Reason; kept: number; keptRelevant: number }[];
  /** Relevant and dropped: the errors that matter most. */
  misses: string[];
  /** Kept and not relevant: what precision costs. Amended in plan (step 12): not in spec §6.3. */
  extras: string[];
}

const REASONS: readonly Reason[] = ["names", "rules", "generic"];

export function metricsFor(rows: readonly ResultRow[]): Metrics {
  const relevant = rows.filter((r) => r.relevant);
  const kept = rows.filter((r) => r.kept);
  const keptRelevant = kept.filter((r) => r.relevant);
  return {
    labelled: rows.length,
    relevant: relevant.length,
    kept: kept.length,
    keptRelevant: keptRelevant.length,
    recall: ratio(keptRelevant.length, relevant.length),
    recallInterval: wilson(keptRelevant.length, relevant.length),
    precision: ratio(keptRelevant.length, kept.length),
    byReason: REASONS.map((reason) => {
      const withReason = kept.filter((r) => r.reasons.includes(reason));
      return {
        reason,
        kept: withReason.length,
        keptRelevant: withReason.filter((r) => r.relevant).length,
      };
    }),
    misses: relevant.filter((r) => !r.kept).map((r) => r.nctId),
    extras: kept.filter((r) => !r.relevant).map((r) => r.nctId),
  };
}

/** Wilson score interval at 95%, rounded to four places. [0, 1] when there's nothing to measure. */
export function wilson(successes: number, n: number): [number, number] {
  if (n === 0) return [0, 1];
  const z = 1.959964;
  const p = successes / n;
  const denominator = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denominator;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denominator;
  return [round(Math.max(0, centre - half)), round(Math.min(1, centre + half))];
}

function ratio(a: number, b: number): number {
  return b === 0 ? 0 : round(a / b);
}

function round(x: number): number {
  return Math.round(x * 10_000) / 10_000;
}
