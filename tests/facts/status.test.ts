import { describe, expect, it } from "vitest";
import { dependsOn, ProfileError, statusFor } from "../../src/facts/status.js";
import type { FactMapping, TrialFacts } from "../../src/facts/types.js";
import { loadFactVocabulary } from "../../src/facts/vocabulary.js";

const vocabulary = loadFactVocabulary();

const mapping = (factId: string, rulesOut: string[], appliesTo?: string): FactMapping => ({
  factId,
  rulesOut,
  polarity: "exclusion",
  source: { start: 0, end: 4, text: "made" },
  ...(appliesTo === undefined ? {} : { appliesTo }),
});

const trial = (nctId: string, mappings: FactMapping[]): TrialFacts => ({
  nctId,
  mappings,
  rejected: [],
  run: {
    model: "fake",
    quantization: "none",
    temperature: 0,
    seed: 0,
    adapter: "fake",
    promptVersion: "x",
    timestamp: "2000-06",
    vocabularySha256: vocabulary.sha256,
    normalizeVersion: "2",
    snapshotMonth: "2000-06",
    cancerType: "nsclc",
  },
});

describe("statusFor", () => {
  it("never removes a trial: every answer of every fact, ruled out by a mapping, is only a hint", () => {
    for (const fact of vocabulary.facts) {
      for (const answer of fact.answers) {
        const t = trial("NCT00000001", [mapping(fact.id, [answer.id])]);
        const s = statusFor(t, { [fact.id]: answer.id }, vocabulary);
        expect(Object.keys(s).sort(), `${fact.id}=${answer.id}`).toEqual([
          "fits",
          "hints",
          "nctId",
          "partHints",
          "unknown",
        ]);
        expect(s.hints.map((m) => m.factId)).toEqual([fact.id]);
        expect(s.fits).toEqual([]);
        expect(s.unknown).toEqual([fact.id]);
      }
    }
  });

  it("calls an unanswered fact unknown, and an answer no mapping hints against a fit", () => {
    const t = trial("NCT00000001", [
      mapping("ecog", ["ps2", "ps3_4"]),
      mapping("hiv", ["uncontrolled"]),
    ]);
    expect(statusFor(t, { ecog: "ps1" }, vocabulary)).toMatchObject({
      hints: [],
      fits: ["ecog"],
      unknown: ["hiv"],
    });
  });

  it("puts a mapping scoped to part of the trial in partHints", () => {
    const t = trial("NCT00000001", [mapping("kras", ["none_found"], "Cohort B")]);
    const s = statusFor(t, { kras: "none_found" }, vocabulary);
    expect(s.hints).toEqual([]);
    expect(s.partHints).toHaveLength(1);
  });

  it("gives one hint per mapping that names the answer", () => {
    const t = trial("NCT00000001", [
      mapping("other_cancer", ["within_2_years"]),
      mapping("other_cancer", ["within_2_years", "two_to_5_years"]),
    ]);
    expect(statusFor(t, { other_cancer: "two_to_5_years" }, vocabulary).hints).toHaveLength(1);
    expect(statusFor(t, { other_cancer: "within_2_years" }, vocabulary).hints).toHaveLength(2);
  });

  it("refuses a profile naming a fact or answer the vocabulary lacks", () => {
    const t = trial("NCT00000001", []);
    expect(() => statusFor(t, { mood: "good", ecog: "ps9" }, vocabulary)).toThrow(ProfileError);
    expect(() => statusFor(t, { mood: "good", ecog: "ps9" }, vocabulary)).toThrow(
      /mood isn't a fact[\s\S]*ecog has no answer ps9/,
    );
  });
});

describe("dependsOn", () => {
  it("counts every trial per unanswered fact, and not facts the person answered", () => {
    const profile = { ecog: "ps3_4" };
    const statuses = [
      trial("NCT00000001", [mapping("egfr", ["none_found"]), mapping("brain_mets", ["symptoms"])]),
      trial("NCT00000002", [mapping("egfr", ["none_found"])]),
      trial("NCT00000003", [mapping("egfr", ["none_found"]), mapping("ecog", ["ps3_4"])]),
    ].map((t) => statusFor(t, profile, vocabulary));
    expect(dependsOn(statuses)).toEqual([
      { factId: "egfr", trials: 3 },
      { factId: "brain_mets", trials: 1 },
    ]);
  });
});
