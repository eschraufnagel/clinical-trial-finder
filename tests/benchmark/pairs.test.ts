import { describe, expect, it } from "vitest";
import {
  drawPairs,
  ELIGIBLE_DRAW,
  inputProblems,
  readPairs,
  readReasons,
  splitOf,
} from "../../evals/benchmark/pairs.js";
import { type Label, loadTrialBench } from "../../evals/benchmark/trialbench.js";

const label = (patient: string, nctId: string, l: Label["label"]): Label => ({
  patient,
  nctId,
  label: l,
  comment: "",
});

describe("drawPairs", () => {
  const labels = [
    ...Array.from({ length: 40 }, (_, i) =>
      label(`nci-${i}`, `NCT${String(i).padStart(8, "0")}`, "recommended"),
    ),
    ...Array.from({ length: 10 }, (_, i) =>
      label(`nci-${i}`, `NCT1${String(i).padStart(7, "0")}`, "eligible_but_not_recommended"),
    ),
    label("nci-1", "NCT20000001", "ineligible"),
    label("nci-2", "NCT20000002", "ineligible"),
  ];

  it("keeps every ineligible pair and draws the eligible ones per label", () => {
    const pairs = drawPairs(labels);
    expect(pairs.filter((p) => p.label === "ineligible")).toHaveLength(2);
    expect(pairs.filter((p) => p.label === "recommended")).toHaveLength(ELIGIBLE_DRAW.recommended);
    expect(pairs.filter((p) => p.label === "eligible_but_not_recommended")).toHaveLength(
      ELIGIBLE_DRAW.eligible_but_not_recommended,
    );
  });

  it("is stable whatever the labels' order, and splits by vignette", () => {
    expect(drawPairs([...labels].reverse())).toEqual(drawPairs(labels));
    for (const p of drawPairs(labels)) expect(p.set).toBe(splitOf(p.patient));
    expect(splitOf("nci-06")).toBe("dev");
    expect(splitOf("nci-02")).toBe("heldout");
  });

  it("the committed pairs are the draw of the committed labels", () => {
    const pairs = readPairs();
    expect(pairs).toEqual(drawPairs(loadTrialBench().labels));
    expect(pairs).toHaveLength(70);
    expect(pairs.filter((p) => p.set === "dev")).toHaveLength(14);
    expect(pairs.filter((p) => p.set === "dev" && p.label === "ineligible")).toHaveLength(5);
  });
});

describe("the check's inputs", () => {
  const criteria = new Map(loadTrialBench().trials.map((t) => [t.nctId, t.criteriaText]));

  it("every ineligible pair has one reason, every quote is in its trial, every vignette an account", () => {
    expect(inputProblems(readPairs(), readReasons(), criteria)).toEqual([]);
  });

  it("would catch each", () => {
    const pairs = [
      { patient: "nci-01", nctId: "NCT01", label: "ineligible" as const, set: "dev" as const },
      { patient: "nci-02", nctId: "NCT02", label: "ineligible" as const, set: "dev" as const },
    ];
    const text = new Map([["NCT01", "Must have a rule."]]);
    expect(
      inputProblems(
        pairs,
        [
          { patient: "nci-01", nctId: "NCT01", kind: "rule", quote: "not in the text" },
          { patient: "nci-09", nctId: "NCT09", kind: "disease", quote: "x" },
        ],
        text,
        (p) => p === "nci-01",
      ),
    ).toEqual([
      "nci-01 × NCT01's quote isn't in its trial's criteria.",
      "nci-09 × NCT09 has a reason but isn't an ineligible pair.",
      'nci-09 × NCT09 is "disease" but has a quote.',
      "nci-02 × NCT02 has no reason.",
      "nci-02 has no account.",
    ]);
  });
});
