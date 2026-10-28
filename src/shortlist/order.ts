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
  return compareKeys(keyOf(a), keyOf(b));
}

/** What the order reads from an entry, and nothing else. */
export interface OrderKey {
  wholeTrialHints: number;
  partHints: number;
  /** Whole miles to the nearest recruiting site; no distance sorts last. */
  miles: number;
  nctId: string;
}

export function keyOf(entry: OrderEntry): OrderKey {
  return {
    wholeTrialHints: entry.status?.hints.length ?? 0,
    partHints: entry.status?.partHints.length ?? 0,
    miles: entry.candidate.nearestSite?.miles ?? Number.POSITIVE_INFINITY,
    nctId: entry.candidate.nctId,
  };
}

/** The order itself, on `ORDER_KEYS` in turn. */
export function compareKeys(a: OrderKey, b: OrderKey): number {
  const miles = a.miles === b.miles ? 0 : a.miles < b.miles ? -1 : 1;
  return (
    a.wholeTrialHints - b.wholeTrialHints ||
    a.partHints - b.partHints ||
    miles ||
    (a.nctId < b.nctId ? -1 : a.nctId > b.nctId ? 1 : 0)
  );
}
