import type { TrialStatus } from "../facts/status.js";
import type { Candidate } from "../search/types.js";

/**
 * The order of the trials a search keeps, and the short list at its top
 * (spec 0003 §2). Pure: no model, no file, no clock.
 *
 * Every candidate stays in the order; nothing is dropped. A trial with "may
 * not fit" hints moves down, never out. The keys never include phase,
 * sponsor, the number of rules a trial has, or anything else that could read
 * as "best for you" (research §5, Ranking). `ORDERS` names each order's
 * keys, and a test pins them, so changing an order is a visible diff.
 */

/**
 * The orders a conversation may use (slice 0004, spec §2.1), each a list of
 * keys taken in turn. Every one keeps whole-trial hints first: a hint is the
 * one thing a person's answers say against a trial.
 *
 * - `hints`: slice 0003's order.
 * - `checked`: among trials with equal hints, the ones whose rules were
 *   compared with more of the person's answers first. It rewards how much of
 *   a trial was checked, not what the trial offers.
 * - `read-first`: among trials with equal hints, trials with mappings before
 *   trials with none, whether the run has no file for them or read no rule
 *   of theirs onto a fact.
 */
export const ORDERS = {
  hints: ["wholeTrialHints", "partHints", "miles", "nctId"],
  checked: ["wholeTrialHints", "partHints", "checked", "miles", "nctId"],
  "read-first": ["wholeTrialHints", "partHints", "unread", "miles", "nctId"],
} as const satisfies Record<string, readonly (keyof OrderKey)[]>;

export type OrderName = keyof typeof ORDERS;
export const ORDER_NAMES = Object.keys(ORDERS) as OrderName[];

/** Slice 0003's keys, still pinned by its test. */
export const ORDER_KEYS = ORDERS.hints;

export interface OrderEntry {
  candidate: Candidate;
  /** `null` when the run has no mappings for the trial: no hints, so it sorts as unhinted. */
  status: TrialStatus | null;
}

export function orderTrials(
  entries: readonly OrderEntry[],
  order: OrderName = "hints",
): OrderEntry[] {
  return [...entries].sort((a, b) => compareEntries(a, b, order));
}

/** The first `size` of an order: the short list. */
export function shortlistOf(order: readonly OrderEntry[], size: number): OrderEntry[] {
  return order.slice(0, size);
}

export function compareEntries(a: OrderEntry, b: OrderEntry, order: OrderName = "hints"): number {
  return compareKeys(keyOf(a), keyOf(b), order);
}

/** What the orders read from an entry, and nothing else. */
export interface OrderKey {
  wholeTrialHints: number;
  partHints: number;
  /** Facts the trial maps that the person answered with no hint: `status.fits`. */
  checked: number;
  /** 1 when the trial has no mappings: the run has none for it, or read no rule of it onto a fact. */
  unread: number;
  /** Whole miles to the nearest recruiting site; no distance sorts last. */
  miles: number;
  nctId: string;
}

export function keyOf(entry: OrderEntry): OrderKey {
  return {
    wholeTrialHints: entry.status?.hints.length ?? 0,
    partHints: entry.status?.partHints.length ?? 0,
    checked: entry.status?.fits.length ?? 0,
    // A status's fits and unknowns are every fact the trial maps, whatever the answers.
    unread:
      entry.status === null || entry.status.fits.length + entry.status.unknown.length === 0 ? 1 : 0,
    miles: entry.candidate.nearestSite?.miles ?? Number.POSITIVE_INFINITY,
    nctId: entry.candidate.nctId,
  };
}

/** One key's comparison: fewer first, except `checked`, more first. */
function compareKey(a: OrderKey, b: OrderKey, key: keyof OrderKey): number {
  if (key === "nctId") return a.nctId < b.nctId ? -1 : a.nctId > b.nctId ? 1 : 0;
  if (key === "checked") return b.checked - a.checked;
  if (key === "miles") return a.miles === b.miles ? 0 : a.miles < b.miles ? -1 : 1;
  return a[key] - b[key];
}

/** An order itself, on its keys in turn. */
export function compareKeys(a: OrderKey, b: OrderKey, order: OrderName = "hints"): number {
  for (const key of ORDERS[order]) {
    const c = compareKey(a, b, key);
    if (c !== 0) return c;
  }
  return 0;
}
