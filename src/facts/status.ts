import type { FactMapping, FactVocabulary, TrialFacts } from "./types.js";

/**
 * What a person's answers say about a trial (spec 0002 §4, amended after
 * Gate 2). Pure: no model, no file, no clock.
 *
 * **No mapping rules a trial out.** On held-out, a quarter of the model's
 * mappings ruled out an answer the trial accepts (`gate-2-finding.md`). So a
 * mapping whose `rulesOut` holds the person's answer is a hint, "may not
 * fit", shown with the trial's own words for the person and their oncologist.
 * Nothing here removes a trial. An unanswered fact is unknown, and a fact
 * with a hint counts as unknown too: the mapping is not trusted to settle it.
 */

/** A person's answers: fact id to answer id. A missing fact is unknown. */
export type Profile = Readonly<Record<string, string>>;

export interface TrialStatus {
  nctId: string;
  /** Whole-trial mappings whose `rulesOut` holds the profile's answer: "may not fit". */
  hints: FactMapping[];
  /** The same, for mappings scoped to part of the trial. */
  partHints: FactMapping[];
  /** Facts the trial maps that the profile answers, and that no mapping hints against. */
  fits: string[];
  /** Facts the trial maps that the profile doesn't answer, or that a hint covers. */
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
  const hints: FactMapping[] = [];
  const partHints: FactMapping[] = [];
  const mapped = new Set<string>();
  const hinted = new Set<string>();

  for (const mapping of trial.mappings) {
    mapped.add(mapping.factId);
    const answer = profile[mapping.factId];
    if (answer === undefined || !mapping.rulesOut.includes(answer)) continue;
    hinted.add(mapping.factId);
    (mapping.appliesTo === undefined ? hints : partHints).push(mapping);
  }

  const facts = [...mapped].sort();
  return {
    nctId: trial.nctId,
    hints,
    partHints,
    fits: facts.filter((f) => profile[f] !== undefined && !hinted.has(f)),
    unknown: facts.filter((f) => profile[f] === undefined || hinted.has(f)),
  };
}

/**
 * For each fact the person hasn't answered, how many trials map it: how many
 * trials an answer could flag. Every trial counts, since none is dropped.
 * Most first, then by fact id.
 */
export function dependsOn(statuses: readonly TrialStatus[]): { factId: string; trials: number }[] {
  const counts = new Map<string, number>();
  for (const s of statuses) {
    const answered = new Set([...s.hints, ...s.partHints].map((m) => m.factId));
    for (const f of s.unknown) {
      if (!answered.has(f)) counts.set(f, (counts.get(f) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([factId, trials]) => ({ factId, trials }))
    .sort((a, b) => b.trials - a.trials || (a.factId < b.factId ? -1 : 1));
}
