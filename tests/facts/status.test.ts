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
  it("never rules a trial out on an unknown, for any fact in the vocabulary", () => {
    for (const fact of vocabulary.facts) {
      const allButOne = fact.answers.slice(1).map((a) => a.id);
      const t = trial("NCT00000001", [mapping(fact.id, allButOne)]);
      const s = statusFor(t, {}, vocabulary);
      expect(s.status, fact.id).toBe("open");
      expect(s.unknown).toEqual([fact.id]);
    }
  });

  it("rules a trial out only on an answer a whole-trial mapping rules out", () => {
    const t = trial("NCT00000001", [
      mapping("ecog", ["ps2", "ps3_4"]),
      mapping("hiv", ["uncontrolled"]),
    ]);
    const out = statusFor(t, { ecog: "ps2", hiv: "no" }, vocabulary);
    expect(out.status).toBe("ruled-out");
    expect(out.ruledOutBy.map((m) => m.factId)).toEqual(["ecog"]);
    expect(out.fits).toEqual(["hiv"]);
    const open = statusFor(t, { ecog: "ps1" }, vocabulary);
    expect(open).toMatchObject({ status: "open", fits: ["ecog"], unknown: ["hiv"] });
  });

  it("only partly rules out a trial on a mapping scoped to part of it", () => {
    const t = trial("NCT00000001", [mapping("kras", ["none_found"], "Cohort B")]);
    const s = statusFor(t, { kras: "none_found" }, vocabulary);
    expect(s.status).toBe("open");
    expect(s.partlyRuledOutBy).toHaveLength(1);
    expect(s.fits).toEqual(["kras"]);
  });

  it("checks every mapping of a fact, and doesn't call a fact that ruled out a fit", () => {
    const t = trial("NCT00000001", [
      mapping("other_cancer", ["within_2_years"]),
      mapping("other_cancer", ["within_2_years", "two_to_5_years"]),
    ]);
    const s = statusFor(t, { other_cancer: "two_to_5_years" }, vocabulary);
    expect(s.status).toBe("ruled-out");
    expect(s.ruledOutBy).toHaveLength(1);
    expect(s.fits).toEqual([]);
  });

  it("leaves a trial with no mappings open, with nothing fitting or unknown", () => {
    expect(statusFor(trial("NCT00000001", []), { ecog: "ps0" }, vocabulary)).toMatchObject({
      status: "open",
      fits: [],
      unknown: [],
    });
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
  it("counts open trials per unknown fact, most first", () => {
    const profile = { ecog: "ps3_4" };
    const statuses = [
      trial("NCT00000001", [mapping("egfr", ["none_found"]), mapping("brain_mets", ["symptoms"])]),
      trial("NCT00000002", [mapping("egfr", ["none_found"])]),
      trial("NCT00000003", [mapping("egfr", ["none_found"]), mapping("ecog", ["ps3_4"])]),
    ].map((t) => statusFor(t, profile, vocabulary));
    expect(dependsOn(statuses)).toEqual([
      { factId: "egfr", trials: 2 },
      { factId: "brain_mets", trials: 1 },
    ]);
  });
});
