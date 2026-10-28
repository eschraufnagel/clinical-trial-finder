import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  driversFound,
  knowledgeRates,
  loadPatientDir,
  loadPatients,
  type Patient,
  PatientError,
  patientProblems,
  replyFor,
  setFor,
} from "../../evals/questions/patients.js";
import { factsFor, loadFactVocabulary } from "../../src/facts/vocabulary.js";

const vocabulary = loadFactVocabulary();
const ZIPS = new Map([["60611", { lat: 41.89, lon: -87.62 }]]);
const FACT_IDS = factsFor(vocabulary, "nsclc").map((f) => f.id);

/** A made-up patient: everything null but three facts, two of them known. */
function patient(overrides: Partial<Patient> = {}): Patient {
  const record: Record<string, string | null> = Object.fromEntries(FACT_IDS.map((f) => [f, null]));
  record["ecog"] = "ps1";
  record["prior_pd1"] = "progressed";
  record["egfr"] = "none_found";
  return {
    id: "p99",
    persona: "Made up for a test.",
    search: { cancerType: "nsclc", zip: "60611", radiusMiles: 50, age: 64, sex: "female" },
    record,
    knows: ["ecog", "prior_pd1"],
    says: { ecog: "Tired but up and about.", prior_pd1: "Keytruda, and it grew anyway." },
    dontKnow: { egfr: "They might have tested for EGFR? I don't remember." },
    dontKnowPhrases: ["No idea.", "Ask my doctor."],
    ...overrides,
  };
}

function problemsOf(value: unknown): string[] {
  return patientProblems(value, "dir/p99.json", vocabulary, ZIPS);
}

describe("patientProblems", () => {
  it("accepts a well-formed patient", () => {
    expect(problemsOf(patient())).toEqual([]);
  });

  it("rejects each rule, and reports them all together", () => {
    const bad = patient({
      id: "p98",
      persona: "",
      search: { cancerType: "nsclc", zip: "99999", radiusMiles: 0, age: 12, sex: "female" },
      knows: ["ecog", "ecog", "egfr", "alk"],
      says: { ecog: "", stray: "x" },
      dontKnow: { ecog: "?", nope: "?" },
      dontKnowPhrases: ["Only one."],
    });
    const problems = problemsOf(bad).join("\n");
    for (const expected of [
      "id doesn't match the file name",
      "persona is missing",
      "search.zip 99999 isn't in the gazetteer",
      "search.radiusMiles is not a positive number or null",
      "search.age is not a whole number from 18 to 100",
      "knows lists ecog twice",
      "knows lists alk, which the record doesn't hold",
      "says has no reply for ecog",
      "says has a reply for stray, which isn't in knows",
      "dontKnow.ecog is a fact the person knows",
      "dontKnow.nope isn't a fact",
      "dontKnowPhrases is not a list of two or more replies",
    ]) {
      expect(problems).toContain(expected);
    }
  });

  it("rejects a missing fact, an unknown fact and an answer the fact doesn't have", () => {
    const p = patient();
    delete p.record["hiv"];
    p.record["made_up"] = "x";
    p.record["ecog"] = "ps9";
    const problems = problemsOf(p).join("\n");
    expect(problems).toContain("record is missing hiv");
    expect(problems).toContain("record.made_up isn't a fact for nsclc");
    expect(problems).toContain("record.ecog has no answer ps9");
  });

  it("checks the three coherence rules", () => {
    const p = patient();
    p.record["egfr"] = "common_sensitizing";
    p.record["kras"] = "g12c";
    expect(problemsOf(p).join("\n")).toContain("more than one driver: egfr, kras");

    const q = patient();
    q.record["prior_targeted"] = "received";
    expect(problemsOf(q).join("\n")).toContain("prior targeted drug with no driver found");

    const r = patient();
    r.record["extent"] = "early_resectable";
    r.record["lines_advanced"] = "one";
    expect(problemsOf(r).join("\n")).toContain("early and resectable with lines");
    r.record["lines_advanced"] = "zero";
    expect(problemsOf(r)).toEqual([]);
  });

  it("counts drivers only on their mutation answers", () => {
    expect(driversFound({ egfr: "none_found", met: "amplification", alk: "found" })).toEqual([
      "alk",
    ]);
  });
});

describe("loading", () => {
  function dirWith(files: Record<string, unknown>): string {
    const dir = mkdtempSync(join(tmpdir(), "patients-"));
    for (const [name, value] of Object.entries(files)) {
      writeFileSync(join(dir, name), JSON.stringify(value));
    }
    return dir;
  }

  it("names every problem in every file", () => {
    const dir = dirWith({
      "p01.json": patient({ id: "p01", persona: "" }),
      "p02.json": patient({ id: "p03" }),
    });
    expect(() => loadPatientDir(dir, vocabulary, ZIPS)).toThrow(PatientError);
    try {
      loadPatientDir(dir, vocabulary, ZIPS);
    } catch (e) {
      expect((e as Error).message).toContain("p01.json: persona is missing");
      expect((e as Error).message).toContain("p02.json: id doesn't match");
    }
  });

  it("refuses a patient in the set its hash doesn't send it to", () => {
    const root = mkdtempSync(join(tmpdir(), "patients-"));
    const id =
      ["p01", "p02", "p03", "p04", "p05", "p06"].find((i) => setFor(i) === "heldout") ?? "";
    mkdirSync(join(root, "dev"));
    writeFileSync(join(root, "dev", `${id}.json`), JSON.stringify(patient({ id })));
    expect(() => loadPatients("dev", vocabulary, ZIPS, root)).toThrow(
      /its hash sends it to heldout/,
    );
  });
});

describe("setFor", () => {
  it("is fixed by the id and sends about a quarter to dev", () => {
    expect(setFor("p01")).toBe(setFor("p01"));
    const ids = Array.from({ length: 400 }, (_, i) => `p${i}`);
    const dev = ids.filter((i) => setFor(i) === "dev").length;
    expect(dev).toBeGreaterThan(70);
    expect(dev).toBeLessThan(130);
  });
});

describe("replyFor", () => {
  it("gives the reply, then the specific don't-know, then a phrase by fact order", () => {
    const p = patient();
    expect(replyFor(p, "prior_pd1", vocabulary)).toBe("Keytruda, and it grew anyway.");
    expect(replyFor(p, "egfr", vocabulary)).toContain("EGFR?");
    const hiv = FACT_IDS.indexOf("hiv");
    expect(replyFor(p, "hiv", vocabulary)).toBe(p.dontKnowPhrases[hiv % 2]);
    expect(replyFor(p, FACT_IDS[hiv + 1] ?? "", vocabulary)).toBe(p.dontKnowPhrases[(hiv + 1) % 2]);
  });
});

describe("knowledgeRates", () => {
  it("counts non-null record facts and the known ones, by who usually knows", () => {
    const rates = knowledgeRates([patient()], vocabulary);
    expect(rates).toEqual([
      { whoKnows: "patient", held: 2, known: 2 },
      { whoKnows: "oncologist", held: 0, known: 0 },
      { whoKnows: "records", held: 1, known: 0 },
    ]);
  });
});
