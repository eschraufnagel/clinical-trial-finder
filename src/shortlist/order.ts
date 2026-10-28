import type { TrialStatus } from "../facts/status.js";
import type { Candidate } from "../search/types.js";

/**
 * The order of the trials a search keeps, and the short list at its top
 * (spec 0003 §2). Pure: no model, no file, no clock.
 *
 * Every candidate stays in the order; nothing is dropped. A trial with "may
 * not fit" hints moves down, never out. The keys never include phase,
 * sponsor, the number of rules a trial has, or anything else that could read
 * as "best for you" (research §5, Ranking). `ORDER_KEYS` names them, and a
 * test pins it, so changing the order is a visible diff.
 */

export const ORDER_KEYS = ["wholeTrialHints", "partHints", "miles", "nctId"] as const;

export interface OrderEntry {
  candidate: Candidate;
  /** `null` when the run has no mappings for the trial: no hints, so it sorts as unhinted. */
  status: TrialStatus | null;
}

export function orderTrials(entries: readonly OrderEntry[]): OrderEntry[] {
  return [...entries].sort(compareEntries);
}

/** The first `size` of an order: the short list. */
export function shortlistOf(order: readonly OrderEntry[], size: number): OrderEntry[] {
  return order.slice(0, size);
}

export function compareEntries(a: OrderEntry, b: OrderEntry): number {
  return (
    (a.status?.hints.length ?? 0) - (b.status?.hints.length ?? 0) ||
    (a.status?.partHints.length ?? 0) - (b.status?.partHints.length ?? 0) ||
    milesOf(a) - milesOf(b) ||
    (a.candidate.nctId < b.candidate.nctId ? -1 : a.candidate.nctId > b.candidate.nctId ? 1 : 0)
  );
}

/** Whole miles to the nearest recruiting site; no distance sorts last. */
function milesOf(entry: OrderEntry): number {
  return entry.candidate.nearestSite?.miles ?? Number.POSITIVE_INFINITY;
}
