import { reasonsFor, type Vocabulary } from "../src/search/vocabulary.js";
import type { SnapshotTrial } from "../src/trials/snapshot-types.js";

/**
 * The trials 0002 maps (spec 0002 §3.3): every treatment trial, or trial with
 * no stated purpose, that the search keeps for the cancer type, with age,
 * sex and distance ignored.
 *
 * Trials that name the cancer or mention it in their rules come first, then
 * the ones kept only as open to many cancers, each group by NCT ID. A long run
 * stopped part way has then mapped the trials most likely to matter.
 */
export function candidateIds(trials: readonly SnapshotTrial[], vocabulary: Vocabulary): string[] {
  const named: string[] = [];
  const generic: string[] = [];
  for (const trial of trials) {
    if (trial.primaryPurpose !== null && trial.primaryPurpose !== "TREATMENT") continue;
    const reasons = reasonsFor(trial, vocabulary);
    if (reasons.length === 0) continue;
    (reasons.includes("names") || reasons.includes("rules") ? named : generic).push(trial.nctId);
  }
  return [...named.sort(), ...generic.sort()];
}
