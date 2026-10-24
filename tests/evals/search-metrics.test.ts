import { describe, expect, it } from "vitest";
import { metricsFor, type ResultRow, wilson } from "../../evals/search/metrics.js";

const row = (
  nctId: string,
  relevant: boolean,
  kept: boolean,
  reasons: ResultRow["reasons"] = kept ? ["names"] : [],
): ResultRow => ({
  nctId,
  set: "heldout",
  relevant,
  kept,
  reasons,
});

describe("wilson", () => {
  it("matches published Wilson intervals", () => {
    // 95% Wilson interval for 8 of 10: 0.4902 to 0.9433.
    expect(wilson(8, 10)).toEqual([0.4902, 0.9433]);
    // All successes still leaves room below 1: 20 of 20 gives 0.8389 to 1.
    expect(wilson(20, 20)).toEqual([0.8389, 1]);
    expect(wilson(0, 0)).toEqual([0, 1]);
  });
});

describe("metricsFor", () => {
  it("counts recall, precision, reasons, misses and extras", () => {
    const m = metricsFor([
      row("NCT00000001", true, true, ["names", "rules"]),
      row("NCT00000002", true, true, ["generic"]),
      row("NCT00000003", true, false),
      row("NCT00000004", false, true, ["rules"]),
      row("NCT00000005", false, false),
    ]);
    expect(m).toMatchObject({
      labelled: 5,
      relevant: 3,
      kept: 3,
      keptRelevant: 2,
      recall: 0.6667,
      precision: 0.6667,
    });
    expect(m.byReason).toEqual([
      { reason: "names", kept: 1, keptRelevant: 1 },
      { reason: "rules", kept: 2, keptRelevant: 1 },
      { reason: "generic", kept: 1, keptRelevant: 1 },
    ]);
    expect(m.misses).toEqual(["NCT00000003"]);
    expect(m.extras).toEqual(["NCT00000004"]);
  });

  it("gives zeros, not NaN, when there's nothing to divide by", () => {
    expect(metricsFor([])).toMatchObject({ recall: 0, precision: 0, recallInterval: [0, 1] });
  });
});
