import { describe, expect, it } from "vitest";
import type { Patient } from "../../evals/questions/patients.js";
import {
  fromReads,
  gradeReads,
  pairsFor,
  type ReadItem,
  type ReadsFile,
} from "../../evals/questions/reads.js";
import { factsFor } from "../../src/facts/vocabulary.js";
import { vocabulary } from "../questions/fixture.js";

function item(kind: ReadItem["kind"], expected: string, answer: string, factId = "ecog"): ReadItem {
  return { patient: "p00", factId, kind, reply: "...", expected, answer };
}

describe("gradeReads", () => {
  // Five known replies: three exact, one lost, one wrong. Four don't-knows: one
  // specific invented, one phrase invented, two read as unknown.
  const items: ReadItem[] = [
    item("says", "ps1", "ps1"),
    item("says", "ps1", "ps1"),
    item("says", "no", "no", "hiv"),
    item("says", "progressed", "unknown", "prior_pd1"),
    item("says", "ps1", "ps2"),
    item("dontKnow", "unknown", "found", "alk"),
    item("dontKnow", "unknown", "unknown", "ros1"),
    item("phrase", "unknown", "no", "hiv"),
    item("phrase", "unknown", "unknown", "ret"),
  ];
  const grade = gradeReads(items);

  it("counts exact, lost and wrong on known replies", () => {
    expect(grade.known.items).toBe(5);
    expect([grade.known.exact.n, grade.known.lost.n, grade.known.wrong.n]).toEqual([3, 1, 1]);
    expect(grade.known.exact.share).toBe(0.6);
    expect(grade.known.exact.interval?.[0]).toBeLessThan(0.6);
  });

  it("counts inventions on don't-know replies, specific and phrase apart", () => {
    expect(grade.dontKnow.invented).toMatchObject({ n: 2, of: 4, share: 0.5 });
    expect(grade.dontKnow.inventedSpecific).toMatchObject({ n: 1, of: 2 });
    expect(grade.dontKnow.inventedPhrase).toMatchObject({ n: 1, of: 2 });
    expect(grade.inventions.map((i) => i.factId)).toEqual(["alk", "hiv"]);
    expect(grade.wrongs.map((i) => i.answer)).toEqual(["ps2"]);
  });
});

describe("pairsFor and fromReads", () => {
  const record: Record<string, string | null> = Object.fromEntries(
    factsFor(vocabulary, "nsclc").map((f) => [f.id, null]),
  );
  record["ecog"] = "ps1";
  record["egfr"] = "none_found";
  const patient: Patient = {
    id: "p00",
    persona: "Made up for a test.",
    search: { cancerType: "nsclc", zip: "60611", radiusMiles: 50, age: 60, sex: "female" },
    record,
    knows: ["ecog"],
    says: { ecog: "Up and about." },
    dontKnow: { egfr: "EGFR maybe?" },
    dontKnowPhrases: ["?", "??"],
  };

  it("gives every fact one pair, with what the reading should be", () => {
    const pairs = pairsFor([patient], vocabulary);
    expect(pairs).toHaveLength(factsFor(vocabulary, "nsclc").length);
    expect(pairs.find((p) => p.factId === "ecog")).toMatchObject({ kind: "says", expected: "ps1" });
    expect(pairs.find((p) => p.factId === "egfr")).toMatchObject({
      kind: "dontKnow",
      expected: "unknown",
      reply: "EGFR maybe?",
    });
    expect(pairs.find((p) => p.factId === "hiv")).toMatchObject({
      kind: "phrase",
      expected: "unknown",
    });
  });

  it("answers from the readings, and refuses a pair it doesn't have", () => {
    const file = { items: [item("dontKnow", "unknown", "found", "egfr")] } as ReadsFile;
    const answer = fromReads(file);
    expect(answer(patient, "egfr")).toBe("found");
    expect(() => answer(patient, "ecog")).toThrow(/no reading for p00 ecog/);
  });
});
