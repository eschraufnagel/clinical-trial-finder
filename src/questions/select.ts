import type { Profile } from "../facts/status.js";
import type { Fact, FactVocabulary, TrialFacts } from "../facts/types.js";
import { factsFor } from "../facts/vocabulary.js";
import type { Candidate } from "../search/types.js";
import { compareKeys, keyOf, type OrderEntry } from "../shortlist/order.js";
import type { ScorerName, SkipRule } from "./settings.js";

/**
 * Choosing the next question, and when to stop (spec 0003 §4). Pure: no
 * model, no file, no clock.
 *
 * An answer flags, it never settles: a fact's answer adds "may not fit"
 * hints to trials, and so can only move trials down the order. That's what
 * makes `shortlistChange` cheap and exact: only short-list trials that gain a
 * hint can leave, and the trials that take their places are the next ones
 * below that gain none.
 */

/** What comes back when the person doesn't know, or hedges. It never moves a trial. */
export const UNKNOWN = "unknown";

export interface TrialInput {
  candidate: Candidate;
  /** `null` when the run has no mappings for the trial. */
  facts: TrialFacts | null;
}

export type StopReason = "budget" | "nothing-left" | "stable";

interface HintDelta {
  whole: number;
  part: number;
}

/** Built once per conversation: what each answer would add to each trial. */
export interface TrialIndex {
  /** The cancer type's facts, in vocabulary order. */
  facts: readonly Fact[];
  /** How many trials map each fact. */
  mappedBy: ReadonlyMap<string, number>;
  /** nctId → fact → answer → the hints that answer would add. */
  deltas: ReadonlyMap<string, ReadonlyMap<string, ReadonlyMap<string, HintDelta>>>;
}

export function indexTrials(
  trials: readonly TrialInput[],
  vocabulary: FactVocabulary,
  cancerType: string,
): TrialIndex {
  const facts = factsFor(vocabulary, cancerType);
  const mappedBy = new Map<string, number>();
  const deltas = new Map<string, Map<string, Map<string, HintDelta>>>();
  for (const { candidate, facts: trial } of trials) {
    if (trial === null) continue;
    const byFact = new Map<string, Map<string, HintDelta>>();
    for (const mapping of trial.mappings) {
      let byAnswer = byFact.get(mapping.factId);
      if (byAnswer === undefined) {
        byAnswer = new Map();
        byFact.set(mapping.factId, byAnswer);
      }
      for (const answer of mapping.rulesOut) {
        const delta = byAnswer.get(answer) ?? { whole: 0, part: 0 };
        if (mapping.appliesTo === undefined) delta.whole++;
        else delta.part++;
        byAnswer.set(answer, delta);
      }
    }
    for (const factId of byFact.keys()) mappedBy.set(factId, (mappedBy.get(factId) ?? 0) + 1);
    deltas.set(candidate.nctId, byFact);
  }
  return { facts, mappedBy, deltas };
}

export interface Situation {
  index: TrialIndex;
  /** The current order of every trial, under `profile`. */
  order: readonly OrderEntry[];
  profile: Profile;
  /** Facts asked so far, answered or not. Never asked again. */
  asked: ReadonlySet<string>;
  /** Facts the chooser never picks: the intake, in the usual arms. */
  excluded: ReadonlySet<string>;
  skip: readonly SkipRule[];
  sex: "female" | "male";
  shortlistSize: number;
  followUps: number;
  budget: number;
}

/** Facts the chooser may pick: not asked, not excluded, not skipped, and mapped by some trial. */
export function askable(s: Situation): Fact[] {
  return s.index.facts.filter(
    (f) =>
      !s.asked.has(f.id) &&
      !s.excluded.has(f.id) &&
      !s.skip.some((r) => r.factId === f.id && r.sex === s.sex) &&
      (s.index.mappedBy.get(f.id) ?? 0) > 0,
  );
}

/**
 * How many trials would enter the short list if the person gave `answerId`
 * for `factId`, everything else held fixed. Leaving and entering are equal
 * in number.
 */
export function shortlistChange(s: Situation, factId: string, answerId: string): number {
  const size = Math.min(s.shortlistSize, s.order.length);
  const delta = (e: OrderEntry): HintDelta | undefined =>
    s.index.deltas.get(e.candidate.nctId)?.get(factId)?.get(answerId);

  const top = s.order.slice(0, size);
  const moved = top.filter((e) => delta(e) !== undefined);
  if (moved.length === 0) return 0;

  // The unaffected trials below the short list, in order, as many as could replace the moved ones.
  const below: OrderEntry[] = [];
  for (let i = size; i < s.order.length && below.length < moved.length; i++) {
    const e = s.order[i];
    if (e !== undefined && delta(e) === undefined) below.push(e);
  }

  const shifted = moved.map((e) => {
    const key = keyOf(e);
    const d = delta(e) ?? { whole: 0, part: 0 };
    return {
      ...key,
      wholeTrialHints: key.wholeTrialHints + d.whole,
      partHints: key.partHints + d.part,
    };
  });
  const pool = [
    ...top.filter((e) => delta(e) === undefined).map(keyOf),
    ...below.map(keyOf),
    ...shifted,
  ].sort(compareKeys);
  const kept = new Set(pool.slice(0, size));
  return shifted.filter((k) => !kept.has(k)).length;
}

export interface Scored {
  factId: string;
  /** The scorer's own number: vocabulary position for `fixed`, trials mapped for `count`, the mean change for `shortlist`. */
  score: number;
}

/** The askable facts in the order a scorer would ask them. */
export function rank(s: Situation, scorer: ScorerName): Scored[] {
  const facts = askable(s);
  const position = new Map(s.index.facts.map((f, i) => [f.id, i]));
  const byPosition = (a: Scored, b: Scored) =>
    (position.get(a.factId) ?? 0) - (position.get(b.factId) ?? 0);
  const count = (factId: string) => s.index.mappedBy.get(factId) ?? 0;

  if (scorer === "fixed") {
    return facts.map((f) => ({ factId: f.id, score: position.get(f.id) ?? 0 }));
  }
  if (scorer === "count") {
    return facts
      .map((f) => ({ factId: f.id, score: count(f.id) }))
      .sort((a, b) => b.score - a.score || byPosition(a, b));
  }
  return facts
    .map((f) => ({
      factId: f.id,
      score:
        f.answers.reduce((sum, a) => sum + shortlistChange(s, f.id, a.id), 0) / f.answers.length,
    }))
    .sort((a, b) => b.score - a.score || count(b.factId) - count(a.factId) || byPosition(a, b));
}

/** The next question, or why to stop: the budget, nothing left, or (`shortlist` only) nothing that could move. */
export function nextQuestion(s: Situation, scorer: ScorerName): Scored | { stop: StopReason } {
  if (s.followUps >= s.budget) return { stop: "budget" };
  const ranked = rank(s, scorer);
  const first = ranked[0];
  if (first === undefined) return { stop: "nothing-left" };
  if (scorer === "shortlist" && first.score === 0) return { stop: "stable" };
  return first;
}
