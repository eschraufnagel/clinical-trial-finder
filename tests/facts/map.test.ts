import { describe, expect, it } from "vitest";
import { mapTrialFacts } from "../../src/facts/map.js";
import { PROMPT_VERSION, SYSTEM_PROMPT } from "../../src/facts/prompt.js";
import { FactMappingError } from "../../src/facts/types.js";
import { loadFactVocabulary } from "../../src/facts/vocabulary.js";
import { FakeModelAdapter } from "../../src/models/fake.js";
import { rules, trial } from "../search/trial-fixture.js";

const vocabulary = loadFactVocabulary();
const TEXT =
  "Inclusion Criteria:\n\n* ECOG performance status 0 or 1\n* Cohort B: KRAS G12C mutation\n\nExclusion Criteria:\n\n* Active brain metastases\n* ANC < 1500/uL";
const TRIAL = trial("NCT00000001", { ...rules(TEXT), conditions: ["Non-Small Cell Lung Cancer"] });
const OPTIONS = { snapshotMonth: "2000-06" };

const mapping = (overrides: Record<string, unknown>) => ({
  factId: "ecog",
  rulesOut: ["ps2", "ps3_4"],
  polarity: "inclusion",
  quote: "ECOG performance status 0 or 1",
  appliesTo: null,
  ...overrides,
});

async function run(mappings: unknown[]) {
  const adapter = new FakeModelAdapter([{ kind: "json", content: { mappings } }]);
  return { result: await mapTrialFacts(TRIAL, vocabulary, adapter, OPTIONS), adapter };
}

describe("mapTrialFacts", () => {
  it("locates quotes in any order, in the original text's coordinates", async () => {
    const { result } = await run([
      mapping({
        factId: "brain_mets",
        rulesOut: ["not_stable_no_symptoms", "symptoms"],
        polarity: "exclusion",
        quote: "Active brain metastases",
      }),
      mapping({}),
      mapping({
        factId: "kras",
        rulesOut: ["other_mutation", "none_found"],
        quote: "KRAS G12C mutation",
        appliesTo: "Cohort B",
      }),
    ]);
    expect(result.rejected).toEqual([]);
    expect(result.mappings.map((m) => m.factId)).toEqual(["brain_mets", "ecog", "kras"]);
    for (const m of result.mappings) {
      expect(TEXT.slice(m.source.start, m.source.end)).toBe(m.source.text);
    }
    expect(result.mappings[2]?.appliesTo).toBe("Cohort B");
    expect(result.mappings[1]?.appliesTo).toBeUndefined();
  });

  it("rejects each kind of bad mapping with a reason, keeping the rest", async () => {
    const { result } = await run([
      mapping({}),
      mapping({ factId: "mood" }),
      mapping({ rulesOut: [] }),
      mapping({ rulesOut: ["ps9"] }),
      mapping({ rulesOut: ["ps0", "ps1", "ps2", "ps3_4"] }),
      mapping({ polarity: "maybe" }),
      mapping({ quote: "ECOG 0-2 required" }),
      mapping({}),
      "not an object",
    ]);
    expect(result.mappings).toHaveLength(1);
    expect(result.rejected.map((r) => r.reason)).toEqual([
      "mood isn't a fact for this trial's cancer type",
      "rulesOut is empty",
      "ecog has no answer ps9",
      "rules out every answer of ecog",
      "polarity is not inclusion or exclusion",
      "not an object",
      "quote does not appear in the criteria text",
      "repeats a mapping already made",
    ]);
  });

  it("accepts a trial where nothing maps", async () => {
    const { result } = await run([]);
    expect(result.mappings).toEqual([]);
  });

  it("refuses truncated or unreadable output as a whole", async () => {
    const truncated = new FakeModelAdapter([
      { kind: "json", content: { mappings: [] }, finishReason: "length" },
    ]);
    await expect(mapTrialFacts(TRIAL, vocabulary, truncated, OPTIONS)).rejects.toThrow(
      FactMappingError,
    );
    const noList = new FakeModelAdapter([{ kind: "json", content: { facts: [] } }]);
    await expect(mapTrialFacts(TRIAL, vocabulary, noList, OPTIONS)).rejects.toThrow(
      /no "mappings" list/,
    );
  });

  it("records the run and sends the vocabulary and the text", async () => {
    const { result, adapter } = await run([]);
    expect(result.run).toMatchObject({
      model: "fake",
      promptVersion: PROMPT_VERSION,
      vocabularySha256: vocabulary.sha256,
      snapshotMonth: "2000-06",
      cancerType: "nsclc",
    });
    expect(result.run.timestamp).toMatch(/^\d{4}-\d{2}$/);
    const request = adapter.requests[0];
    expect(request?.system).toBe(SYSTEM_PROMPT);
    expect(request?.user).toMatch(/- brain_mets: Has the cancer spread to the brain\?/);
    expect(request?.user).toMatch(/Cohort B: KRAS G12C mutation/);
  });
});
