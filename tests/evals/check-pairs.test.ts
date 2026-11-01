import { describe, expect, it } from "vitest";
import {
  labelProblems,
  type PairLabels,
  type PairPick,
  picksProblems,
} from "../../evals/check/pairs.js";

/**
 * The picks and labels are checked against what they must match: the
 * committed result's short lists, and the trials' own text. Made-up rows
 * here; the scripts run the same checks on the real ones (a test never loads
 * the full snapshot).
 */

const picks: PairPick[] = [
  { patient: "p01", set: "heldout", nctId: "NCT00000001", rank: 1 },
  { patient: "p01", set: "heldout", nctId: "NCT00000002", rank: 2 },
];

describe("picksProblems", () => {
  const row = (shortlist: string[], arm = "conversation", scorer: string | null = "shortlist") => ({
    patient: "p01",
    arm,
    scorer,
    shortlist,
  });

  it("accepts the committed conversation arm's first picks, and only that arm's", () => {
    expect(
      picksProblems(picks, {
        rows: [row(["NCT00000009"], "record", null), row(["NCT00000001", "NCT00000002"])],
      }),
    ).toEqual([]);
    const three: PairPick[] = [
      ...picks,
      { patient: "p01", set: "heldout", nctId: "NCT00000003", rank: 3 },
    ];
    expect(
      picksProblems(three, {
        rows: [row(["NCT00000001", "NCT00000002", "NCT00000003", "NCT00000004"])],
      }),
    ).toEqual([]);
  });

  it("names a patient whose picks differ, or who isn't there", () => {
    expect(picksProblems(picks, { rows: [row(["NCT00000002", "NCT00000001"])] })).toEqual([
      "p01: picks NCT00000001, NCT00000002, the committed result has NCT00000002, NCT00000001",
    ]);
    expect(picksProblems(picks, { rows: [] })).toEqual(["p01: not in the committed result"]);
  });
});

describe("labelProblems", () => {
  const text = (nctId: string) =>
    nctId === "NCT00000001"
      ? "Histologically confirmed small cell lung cancer."
      : "Age 18 or older.";
  const labels = (pairs: PairLabels["pairs"]): PairLabels => ({ version: 1, pairs });
  const ruledOut = {
    patient: "p01",
    nctId: "NCT00000001",
    set: "heldout" as const,
    clearlyRuledOut: true,
    rule: {
      quote: "small cell lung cancer",
      facts: ["histology"],
      why: "Their record says adenocarcinoma.",
    },
  };
  const notRuledOut = {
    patient: "p01",
    nctId: "NCT00000002",
    set: "heldout" as const,
    clearlyRuledOut: false,
  };

  it("accepts a complete, verbatim label set", () => {
    expect(labelProblems(labels([ruledOut, notRuledOut]), picks, text)).toEqual([]);
  });

  it("names a missing pair, an extra one and a doubled one", () => {
    const extra = { ...notRuledOut, nctId: "NCT00000003" };
    expect(labelProblems(labels([ruledOut, extra, extra]), picks, text)).toEqual([
      "p01 NCT00000002: no label",
      "p01 NCT00000003: labelled, but not a pick",
      "p01 NCT00000003: labelled twice",
    ]);
  });

  it("refuses a quote that isn't verbatim, a ruled-out pair with no rule, and a reason left empty", () => {
    expect(
      labelProblems(
        labels([{ ...ruledOut, rule: { ...ruledOut.rule, quote: "small-cell" } }, notRuledOut]),
        picks,
        text,
      ),
    ).toEqual(["p01 NCT00000001: the quote isn't in its text"]);
    const { rule: _rule, ...bare } = ruledOut;
    expect(labelProblems(labels([bare, notRuledOut]), picks, text)).toEqual([
      "p01 NCT00000001: clearly ruled out, with no rule",
    ]);
    expect(
      labelProblems(
        labels([{ ...ruledOut, rule: { ...ruledOut.rule, why: " " } }, notRuledOut]),
        picks,
        text,
      ),
    ).toEqual(["p01 NCT00000001: no reason given"]);
  });

  it("refuses a rule on a pair that isn't ruled out", () => {
    expect(
      labelProblems(labels([ruledOut, { ...notRuledOut, rule: ruledOut.rule }]), picks, text),
    ).toEqual(["p01 NCT00000002: a rule on a pair not ruled out"]);
  });
});
