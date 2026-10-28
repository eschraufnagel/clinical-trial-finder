import { describe, expect, it } from "vitest";
import { armsFor } from "../../evals/questions/arms.js";
import { agreement, summarize, wouldFlag } from "../../evals/questions/metrics.js";
import type { Patient } from "../../evals/questions/patients.js";
import { factsFor } from "../../src/facts/vocabulary.js";
import { SETTINGS, trials, vocabulary } from "../questions/fixture.js";

/**
 * Two made-up patients on the chooser's fixture (tests/questions/fixture.ts),
 * every number below worked out by hand from it. Short list of 3.
 */
function patient(
  id: string,
  sex: "female" | "male",
  record: Record<string, string>,
  knows: string[],
): Patient {
  const full: Record<string, string | null> = Object.fromEntries(
    factsFor(vocabulary, "nsclc").map((f) => [f.id, null]),
  );
  Object.assign(full, record);
  return {
    id,
    persona: "Made up for a test.",
    search: { cancerType: "nsclc", zip: "60611", radiusMiles: 50, age: 60, sex },
    record: full,
    knows,
    says: Object.fromEntries(knows.map((k) => [k, "..."])),
    dontKnowPhrases: ["?", "??"],
  };
}

// A doesn't know her HIV result, which the record says flags NCT01 and NCT03.
const A = patient(
  "pa",
  "female",
  { brain_mets: "none", hiv: "uncontrolled", ecog: "ps0", pregnant_or_breastfeeding: "no" },
  ["brain_mets", "ecog", "pregnant_or_breastfeeding"],
);
// B knows his ECOG, which flags NCT01; pregnancy is never asked of him.
const B = patient("pb", "male", { ecog: "ps2" }, ["ecog"]);

const rowsA = armsFor(A, "dev", trials(), vocabulary, SETTINGS, { fromStart: true });
const rowsB = armsFor(B, "dev", trials(), vocabulary, SETTINGS);
const find = (rows: typeof rowsA, arm: string, scorer: string | null = null) => {
  const row = rows.find((r) => r.arm === arm && r.scorer === scorer);
  if (row === undefined) throw new Error(`no ${arm} ${scorer}`);
  return row;
};

describe("agreement and would-flag", () => {
  it("are shares of the record's short list, and of this one", () => {
    expect(agreement(["a", "b", "c"], ["b", "c", "d"])).toBeCloseTo(2 / 3);
    expect(agreement(["a"], [])).toBeNull();
    expect(wouldFlag(["a", "b"], new Set(["b"]))).toBe(0.5);
    expect(wouldFlag([], new Set())).toBeNull();
  });
});

describe("armsFor, patient A", () => {
  it("the record flags NCT01 and NCT03 and lists the next three", () => {
    const record = find(rowsA, "record");
    expect(record.shortlist).toEqual(["NCT02", "NCT04", "NCT05"]);
    expect(record.agreement).toBe(1);
    expect(record.wouldFlag).toBe(0);
    expect(record.recordFlagged).toEqual(["NCT01", "NCT03"]);
  });

  it("the intake alone leaves the two flagged trials at the top", () => {
    const intake = find(rowsA, "intake");
    expect(intake.asked).toEqual([{ factId: "brain_mets", reply: "none" }]);
    expect(intake.shortlist).toEqual(["NCT01", "NCT02", "NCT03"]);
    expect(intake.agreement).toBeCloseTo(1 / 3);
    expect(intake.wouldFlag).toBeCloseTo(2 / 3);
    expect(intake.openQuestions).toBe(3);
  });

  it("the conversation asks hiv first, which she doesn't know, and can't recover it", () => {
    const row = find(rowsA, "conversation", "shortlist");
    expect(row.asked.slice(1)).toEqual([
      { factId: "hiv", reply: "unknown" },
      { factId: "pregnant_or_breastfeeding", reply: "no" },
      { factId: "ecog", reply: "ps0" },
    ]);
    expect(row.followUps).toBe(3);
    expect(row.dontKnows).toBe(1);
    expect(row.stop).toBe("nothing-left");
    expect(row.agreement).toBeCloseTo(1 / 3);
    expect(row.openQuestions).toBe(1);
    expect(row.curve?.map((p) => p.agreement)).toEqual(Array(21).fill(1 / 3));
  });

  it("knowing everything, it finds the record's short list in two questions", () => {
    const row = find(rowsA, "knows-all", "shortlist");
    expect(row.asked.slice(1).map((a) => a.factId)).toEqual(["hiv", "pregnant_or_breastfeeding"]);
    expect(row.stop).toBe("stable");
    expect(row.agreement).toBe(1);
    expect(row.wouldFlag).toBe(0);
    expect(row.pushedDown).toBe(2);
    expect(row.pushedDownHints).toBe(2);
  });

  it("from the start runs only when asked for", () => {
    expect(rowsA.filter((r) => r.arm === "from-start")).toHaveLength(3);
    expect(rowsB.filter((r) => r.arm === "from-start")).toHaveLength(0);
  });
});

describe("armsFor, patient B", () => {
  it("moves NCT01 down once he answers ECOG", () => {
    expect(find(rowsB, "record").shortlist).toEqual(["NCT02", "NCT03", "NCT04"]);
    const intake = find(rowsB, "intake");
    expect(intake.asked).toEqual([{ factId: "brain_mets", reply: "unknown" }]);
    expect(intake.agreement).toBeCloseTo(2 / 3);
    const row = find(rowsB, "conversation", "shortlist");
    expect(row.asked.slice(1)).toEqual([
      { factId: "hiv", reply: "unknown" },
      { factId: "ecog", reply: "ps2" },
    ]);
    expect(row.agreement).toBe(1);
    expect(row.pushedDown).toBe(1);
    expect(row.pushedDownHints).toBe(1);
  });
});

describe("summarize", () => {
  it("averages over patients, per arm and scorer", () => {
    const summary = summarize([...rowsA, ...rowsB]).find(
      (s) => s.arm === "conversation" && s.scorer === "shortlist",
    );
    expect(summary?.patients).toBe(2);
    expect(summary?.agreement).toBeCloseTo((1 / 3 + 1) / 2);
    expect(summary?.followUps).toBe(2.5);
    expect(summary?.dontKnows).toBe(2);
    expect(summary?.stops).toEqual({ "nothing-left": 2 });
  });
});
