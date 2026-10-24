import { describe, expect, it } from "vitest";
import { coverageOf } from "../../evals/facts/coverage.js";
import type { FactLabels, LabelPassage } from "../../evals/facts/labels.js";
import { formatCoverage } from "../../scripts/facts-eval.js";

const passage = (overrides: Partial<LabelPassage>): LabelPassage => ({
  quote: "made up",
  start: 0,
  end: 7,
  mappings: [],
  unmapped: null,
  ...overrides,
});

const trial = (nctId: string, set: FactLabels["set"], passages: LabelPassage[]): FactLabels => ({
  nctId,
  set,
  criteriaTextSha: "x",
  vocabularySha256: "y",
  passages,
});

const LABELS = [
  trial("NCT00000001", "dev", [
    passage({ mappings: [{ factId: "ecog", rulesOut: ["ps3_4"], appliesTo: null }] }),
    passage({
      mappings: [
        { factId: "brain_mets", rulesOut: ["active"], appliesTo: "Cohort A" },
        { factId: "leptomeningeal", rulesOut: ["yes"], appliesTo: null },
      ],
    }),
    passage({ unmapped: "vocabulary-gap", note: "steroids: dose threshold" }),
    passage({ unmapped: "organ-function" }),
    passage({ unmapped: "not-a-rule" }),
  ]),
  trial("NCT00000002", "heldout", [
    passage({ mappings: [{ factId: "ecog", rulesOut: ["ps2", "ps3_4"], appliesTo: null }] }),
    passage({ unmapped: "vocabulary-gap", note: "steroids: able to stop" }),
    passage({ unmapped: "trial-specific" }),
    passage({ unmapped: "procedure" }),
  ]),
];

describe("coverageOf", () => {
  it("counts categories, shares, fact use and grouped gaps", () => {
    const c = coverageOf(LABELS);
    expect(c.passages).toBe(9);
    expect(c.rules).toBe(8);
    expect(c.byCategory).toMatchObject({ mapped: 3, "vocabulary-gap": 2, "trial-specific": 1 });
    expect(c.mappedShare).toBe(0.375);
    expect(c.personRules).toBe(6);
    expect(c.mappedShareOfPersonRules).toBe(0.5);
    expect(c.factUse[0]).toEqual({ factId: "ecog", mappings: 2, trials: 2 });
    expect(c.gaps).toEqual([
      {
        gap: "steroids",
        passages: 2,
        trials: 2,
        notes: ["steroids: able to stop", "steroids: dose threshold"],
      },
    ]);
    expect(c.scoped).toBe(1);
  });

  it("keeps to one set when asked", () => {
    expect(coverageOf(LABELS, "heldout").trials).toBe(1);
    expect(coverageOf(LABELS, "dev").passages).toBe(5);
  });

  it("prints shares as percentages", () => {
    expect(formatCoverage(coverageOf(LABELS), "both")).toMatch(
      /mapped share of rules 37\.5%; of rules about the person 50\.0% \(3 of 6\)/,
    );
  });
});
