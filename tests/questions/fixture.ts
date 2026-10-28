import type { FactMapping, TrialFacts } from "../../src/facts/types.js";
import { loadFactVocabulary } from "../../src/facts/vocabulary.js";
import type { TrialInput } from "../../src/questions/select.js";
import type { ConversationSettings } from "../../src/questions/settings.js";
import type { Candidate } from "../../src/search/types.js";

/**
 * Made-up trials for the chooser's tests, built so the three scorers choose
 * differently. Short list of 3; trials NCT01 to NCT08 sit 1 to 8 miles away.
 *
 * - hiv: NCT01 and NCT03, ruling out controlled and uncontrolled. Two trials,
 *   both in the short list: `shortlist` asks it first.
 * - pregnant_or_breastfeeding: NCT02 and NCT04 to NCT06, ruling out yes.
 *   The most trials: `count` asks it first.
 * - ecog: NCT01, ruling out ps2 and ps3_4. First in the vocabulary: `fixed`
 *   asks it first.
 * - NCT07 maps nothing; NCT08 isn't in the run.
 */

export const vocabulary = loadFactVocabulary();

export const SETTINGS: ConversationSettings = {
  version: 1,
  intake: ["brain_mets"],
  skip: [{ factId: "pregnant_or_breastfeeding", sex: "male" }],
  shortlistSize: 3,
  budget: 10,
  scorer: "shortlist",
  sha256: "0".repeat(64),
};

export function candidate(nctId: string, miles: number | null): Candidate {
  return {
    nctId,
    briefTitle: `Trial ${nctId}`,
    phases: ["PHASE2"],
    reasons: ["names"],
    nearestSite: { facility: null, city: null, state: null, miles },
    flags: [],
  };
}

export function mapping(factId: string, rulesOut: string[], appliesTo?: string): FactMapping {
  return {
    factId,
    rulesOut,
    polarity: "exclusion",
    source: { start: 0, end: 4, text: `rule on ${factId}` },
    ...(appliesTo === undefined ? {} : { appliesTo }),
  };
}

export function trialFacts(nctId: string, mappings: FactMapping[]): TrialFacts {
  return {
    nctId,
    mappings,
    rejected: [],
    run: {
      adapter: "fake",
      model: "fake",
      quantization: "none",
      temperature: 0,
      seed: null,
      promptVersion: "0",
      timestamp: "2000-01",
      vocabularySha256: vocabulary.sha256,
      normalizeVersion: "0",
      snapshotMonth: "2000-01",
      cancerType: "nsclc",
    },
  };
}

export function trials(): TrialInput[] {
  const m: Record<string, FactMapping[]> = {
    NCT01: [mapping("hiv", ["controlled", "uncontrolled"]), mapping("ecog", ["ps2", "ps3_4"])],
    NCT02: [mapping("pregnant_or_breastfeeding", ["yes"])],
    NCT03: [mapping("hiv", ["controlled", "uncontrolled"])],
    NCT04: [mapping("pregnant_or_breastfeeding", ["yes"])],
    NCT05: [mapping("pregnant_or_breastfeeding", ["yes"])],
    NCT06: [mapping("pregnant_or_breastfeeding", ["yes"])],
    NCT07: [],
  };
  return [1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
    const id = `NCT0${i}`;
    const ms = m[id];
    return { candidate: candidate(id, i), facts: ms === undefined ? null : trialFacts(id, ms) };
  });
}
