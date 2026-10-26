import { describe, expect, it } from "vitest";
import { describeMapping, formatTrialFacts } from "../../scripts/facts-show.js";
import { formatTry } from "../../scripts/facts-try.js";
import { statusFor } from "../../src/facts/status.js";
import type { FactMapping, TrialFacts } from "../../src/facts/types.js";
import { loadFactVocabulary } from "../../src/facts/vocabulary.js";

const vocabulary = loadFactVocabulary();

const mapping = (
  factId: string,
  rulesOut: string[],
  text: string,
  appliesTo?: string,
): FactMapping => ({
  factId,
  rulesOut,
  polarity: "exclusion",
  source: { start: 0, end: text.length, text },
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
    promptVersion: "abc",
    timestamp: "2000-06",
    vocabularySha256: vocabulary.sha256,
    normalizeVersion: "2",
    snapshotMonth: "2000-06",
    cancerType: "nsclc",
  },
});

describe("facts:show", () => {
  it("says what a mapping may not fit, in the answers' words, with its scope and quote", () => {
    expect(describeMapping(mapping("ecog", ["ps3_4"], "ECOG 0-2"), vocabulary)).toBe(
      "Which is closest to how you are day to day? May not fit: In bed or a chair half the day or more",
    );
    expect(
      describeMapping(mapping("kras", ["none_found"], "KRAS", "Cohort B"), vocabulary),
    ).toMatch(/\[Cohort B only\]$/);
    const text = formatTrialFacts(
      trial("NCT00000001", [mapping("ecog", ["ps3_4"], "ECOG  0-2")]),
      vocabulary,
      "Made-up trial",
    );
    expect(text).toMatch(
      /^NCT00000001 {2}Made-up trial\nMapped by fake, prompt abc: 1 mappings, 0 rejected/,
    );
    expect(text).toMatch(/ {4}"ECOG 0-2"/);
  });
});

describe("facts:try", () => {
  it("counts hints, never drops a trial, and names the questions that would flag the most", () => {
    const profile = { ecog: "ps3_4" };
    const statuses = [
      trial("NCT00000001", [
        mapping("ecog", ["ps3_4"], "ECOG 0-2"),
        mapping("egfr", ["none_found"], "EGFR+"),
      ]),
      trial("NCT00000002", [mapping("egfr", ["none_found"], "EGFR mutation")]),
    ].map((t) => statusFor(t, profile, vocabulary));
    const text = formatTry(
      { searched: 3, unmapped: ["NCT00000003"], statuses },
      vocabulary,
      new Map([["NCT00000001", "Made-up trial"]]),
    );
    expect(text).toMatch(/^Of 3 trials, 2 are mapped \(1 not mapped\)\./);
    expect(text).toMatch(
      /1 have a hint the trial may not fit these answers, 0 only for part of the trial, 1 none\. None is dropped/,
    );
    expect(text).toMatch(/ {2}NCT00000001 {2}Made-up trial\n {4}- Which is closest/);
    expect(text).toMatch(/\n {5}2 {2}Did testing find an EGFR mutation\?/);
  });
});
