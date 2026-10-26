import { describe, expect, it } from "vitest";
import { gradeTrial, metricsOf } from "../../evals/facts/grade.js";
import type { FactLabels, LabelPassage } from "../../evals/facts/labels.js";
import type { FactMapping, TrialFacts } from "../../src/facts/types.js";

/** Four made-up passages at fixed offsets. */
const passage = (start: number, overrides: Partial<LabelPassage>): LabelPassage => ({
  quote: "x".repeat(10),
  start,
  end: start + 10,
  mappings: [],
  unmapped: null,
  ...overrides,
});

const LABELS: FactLabels = {
  nctId: "NCT00000001",
  set: "heldout",
  criteriaTextSha: "x",
  vocabularySha256: "y",
  passages: [
    passage(0, { mappings: [{ factId: "ecog", rulesOut: ["ps2", "ps3_4"], appliesTo: null }] }),
    passage(20, {
      mappings: [
        { factId: "kras", rulesOut: ["other_mutation", "none_found"], appliesTo: "Cohort B" },
      ],
    }),
    passage(40, {
      mappings: [
        { factId: "brain_mets", rulesOut: ["not_stable_no_symptoms", "symptoms"], appliesTo: null },
      ],
    }),
    passage(60, { note: "exception to 3", unmapped: "not-a-rule" }),
    passage(80, { unmapped: "organ-function" }),
  ],
};

const at = (
  factId: string,
  start: number,
  rulesOut: string[],
  appliesTo?: string,
): FactMapping => ({
  factId,
  rulesOut,
  polarity: "exclusion",
  source: { start, end: start + 5, text: "xxxxx" },
  ...(appliesTo === undefined ? {} : { appliesTo }),
});

const facts = (mappings: FactMapping[]): TrialFacts => ({
  nctId: "NCT00000001",
  mappings,
  rejected: [{ reason: "quote does not appear in the criteria text", quote: "q", raw: {} }],
  run: {
    model: "fake",
    quantization: "none",
    temperature: 0,
    seed: 0,
    adapter: "fake",
    promptVersion: "abc",
    timestamp: "2000-06",
    vocabularySha256: "y",
    normalizeVersion: "2",
    snapshotMonth: "2000-06",
    cancerType: "nsclc",
  },
});

describe("gradeTrial", () => {
  it("grades exact, safe, wrong and unplaced", () => {
    const { mappings } = gradeTrial(
      LABELS,
      facts([
        at("ecog", 2, ["ps2", "ps3_4"]),
        at("brain_mets", 42, ["symptoms"]),
        at("ecog", 3, ["ps1", "ps2"]),
        at("hiv", 82, ["uncontrolled"]),
        at("hiv", 200, ["uncontrolled"]),
      ]),
    );
    expect(mappings.map((m) => m.grade)).toEqual(["exact", "safe", "wrong", "wrong", "unplaced"]);
  });

  it("calls a whole-trial mapping of a scoped rule wrong, and a scoped one exact", () => {
    const { mappings } = gradeTrial(
      LABELS,
      facts([
        at("kras", 21, ["other_mutation", "none_found"]),
        at("kras", 22, ["other_mutation", "none_found"], "Cohort B"),
      ]),
    );
    expect(mappings.map((m) => m.grade)).toEqual(["wrong", "exact"]);
  });

  it("matches the right answers quoted from a neighbouring passage, as displaced", () => {
    const { mappings, labels } = gradeTrial(
      LABELS,
      facts([at("brain_mets", 61, ["not_stable_no_symptoms", "symptoms"])]),
    );
    expect(mappings[0]).toMatchObject({ grade: "exact", displaced: true });
    expect(labels.find((l) => l.factId === "brain_mets")?.found).toBe(true);
  });

  it("finds a labelled mapping only through an exact or safe match", () => {
    const { labels } = gradeTrial(LABELS, facts([at("ecog", 2, ["ps1", "ps2"])]));
    expect(labels.map((l) => [l.factId, l.found])).toEqual([
      ["ecog", false],
      ["kras", false],
      ["brain_mets", false],
    ]);
  });
});

describe("metricsOf", () => {
  it("derives every number from the rows", () => {
    const t = facts([
      at("ecog", 2, ["ps2", "ps3_4"]),
      at("ecog", 3, ["ps1"]),
      at("kras", 21, ["none_found"], "Cohort B"),
    ]);
    const g = gradeTrial(LABELS, t);
    const m = metricsOf(g.mappings, g.labels, t.rejected, 1);
    expect(m).toMatchObject({
      modelMappings: 3,
      exact: 1,
      safe: 1,
      wrong: 1,
      wrongWholeTrial: 1,
      trialsWithWrongWholeTrial: 1,
      labelled: 3,
      found: 2,
      recall: 0.6667,
      exactShare: 0.3333,
      rejected: 1,
    });
    expect(m.rejectedByReason).toEqual([
      { reason: "quote does not appear in the criteria text", count: 1 },
    ]);
  });
});
