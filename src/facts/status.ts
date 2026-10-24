import type { FactMapping, FactVocabulary, TrialFacts } from "./types.js";

/**
 * Where a person stands with each trial, given what they've answered (spec
 * 0002 §4). Pure: no model, no file, no clock.
 *
 * **An unanswered fact is unknown, and an unknown never rules a trial out.**
 * Only a whole-trial mapping whose `rulesOut` holds the person's own answer
 * does. A mapping scoped to part of a trial (`appliesTo`) never rules out the
 * whole trial; it's reported as ruling out part of it.
 */

/** A person's answers: fact id to answer id. A missing fact is unknown. */
export type Profile = Readonly<Record<string, string>>;

export interface TrialStatus {
  nctId: string;
  status: "ruled-out" | "open";
  /** Whole-trial mappings whose `rulesOut` holds the profile's answer. */
  ruledOutBy: FactMapping[];
  /** The same, for mappings scoped to part of the trial. Never makes the trial ruled out. */
  partlyRuledOutBy: FactMapping[];
  /** Facts the trial maps that the profile answers, and that none of its mappings rule out. */
  fits: string[];
  /** Facts the trial maps that the profile doesn't answer. */
  unknown: string[];
}

export class ProfileError extends Error {
  constructor(problems: readonly string[]) {
    super(`Invalid profile:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "ProfileError";
  }
}

/** Throws `ProfileError` naming every fact or answer the vocabulary doesn't have. */
export function validateProfile(profile: Profile, vocabulary: FactVocabulary): void {
  const facts = new Map(vocabulary.facts.map((f) => [f.id, f]));
  const problems: string[] = [];
  for (const [factId, answer] of Object.entries(profile)) {
    const fact = facts.get(factId);
    if (fact === undefined) problems.push(`${factId} isn't a fact`);
    else if (!fact.answers.some((a) => a.id === answer))
      problems.push(`${factId} has no answer ${answer}`);
  }
  if (problems.length > 0) throw new ProfileError(problems);
}

export function statusFor(
  trial: TrialFacts,
  profile: Profile,
  vocabulary: FactVocabulary,
): TrialStatus {
  validateProfile(profile, vocabulary);
  const ruledOutBy: FactMapping[] = [];
  const partlyRuledOutBy: FactMapping[] = [];
  const mapped = new Set<string>();
  const failed = new Set<string>();

  for (const mapping of trial.mappings) {
    mapped.add(mapping.factId);
    const answer = profile[mapping.factId];
    if (answer === undefined || !mapping.rulesOut.includes(answer)) continue;
    if (mapping.appliesTo === undefined) {
      ruledOutBy.push(mapping);
      failed.add(mapping.factId);
    } else {
      partlyRuledOutBy.push(mapping);
    }
  }

  const facts = [...mapped].sort();
  return {
    nctId: trial.nctId,
    status: ruledOutBy.length > 0 ? "ruled-out" : "open",
    ruledOutBy,
    partlyRuledOutBy,
    fits: facts.filter((f) => profile[f] !== undefined && !failed.has(f)),
    unknown: facts.filter((f) => profile[f] === undefined),
  };
}

/**
 * For each fact, how many open trials list it as unknown: how many trials an
 * answer to it could settle. Most first, then by fact id.
 */
export function dependsOn(statuses: readonly TrialStatus[]): { factId: string; trials: number }[] {
  const counts = new Map<string, number>();
  for (const s of statuses) {
    if (s.status !== "open") continue;
    for (const f of s.unknown) counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  return [...counts]
    .map(([factId, trials]) => ({ factId, trials }))
    .sort((a, b) => b.trials - a.trials || (a.factId < b.factId ? -1 : 1));
}
