import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadVocabulary, reasonsFor, VocabularyError } from "../../src/search/vocabulary.js";
import { rules, trial } from "./trial-fixture.js";

function vocabularyDir(
  type: unknown,
  generic: unknown = { containedTerms: ["solid tumor"], wholeConditions: ["cancer"] },
): string {
  const dir = mkdtempSync(join(tmpdir(), "vocabulary-"));
  writeFileSync(join(dir, "test.json"), JSON.stringify(type));
  writeFileSync(join(dir, "generic.json"), JSON.stringify(generic));
  return dir;
}

const TYPE = {
  id: "test",
  label: "made-up lung cancer",
  measured: false,
  names: ["non small cell lung", "nsclc"],
  meshHeadings: ["Carcinoma, Non-Small-Cell Lung"],
  biomarkerNames: ["egfr"],
};

describe("loadVocabulary", () => {
  it("loads the committed NSCLC vocabulary", () => {
    const vocabulary = loadVocabulary("nsclc");
    expect(vocabulary.type.id).toBe("nsclc");
    expect(vocabulary.type.names.length).toBeGreaterThan(0);
    expect(vocabulary.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses a bad id, a missing type, and a file with problems, naming each", () => {
    expect(() => loadVocabulary("../x")).toThrow(VocabularyError);
    expect(() => loadVocabulary("absent", vocabularyDir(TYPE))).toThrow(/No cancer type "absent"/);
    const message = (() => {
      try {
        loadVocabulary(
          "test",
          vocabularyDir({ ...TYPE, id: "other", names: ["nsclc", "NSCLC", " - "], measured: "no" }),
        );
      } catch (e) {
        return (e as Error).message;
      }
      return "";
    })();
    expect(message).toMatch(/id is "other"/);
    expect(message).toMatch(/measured is not true or false/);
    expect(message).toMatch(/names repeats "NSCLC"/);
    expect(message).toMatch(/names has a term with no words/);
  });

  it("changes its checksum when either file changes", () => {
    const a = loadVocabulary("test", vocabularyDir(TYPE)).sha256;
    const b = loadVocabulary("test", vocabularyDir({ ...TYPE, names: ["nsclc"] })).sha256;
    const c = loadVocabulary(
      "test",
      vocabularyDir(TYPE, { containedTerms: ["solid tumors"], wholeConditions: [] }),
    ).sha256;
    expect(new Set([a, b, c]).size).toBe(3);
  });
});

describe("reasonsFor", () => {
  const vocabulary = loadVocabulary("test", vocabularyDir(TYPE));
  const reasons = (overrides: Parameters<typeof trial>[1]) =>
    reasonsFor(trial("NCT00000001", overrides), vocabulary);

  it("finds the type named in conditions, keywords or titles, however punctuated", () => {
    expect(reasons({ conditions: ["Non-Small-Cell Lung Cancer"] })).toEqual(["names"]);
    expect(reasons({ keywords: ["NSCLC"] })).toEqual(["names"]);
    expect(reasons({ briefTitle: "A Study in Advanced NSCLC" })).toEqual(["names"]);
    expect(reasons({ officialTitle: "A Study in Non Small Cell Lung Cancer" })).toEqual(["names"]);
  });

  it("finds it by MeSH heading, exactly, and by a biomarker named as a condition", () => {
    expect(reasons({ conditionMesh: ["Carcinoma, Non-Small-Cell Lung"] })).toEqual(["names"]);
    expect(reasons({ conditionMesh: ["Carcinoma, Small Cell"] })).toEqual([]);
    expect(reasons({ conditions: ["EGFR Mutation"] })).toEqual(["names"]);
    expect(reasons({ briefTitle: "An EGFR study" })).toEqual([]);
  });

  it("finds it mentioned in the rules, including in an exclusion", () => {
    expect(reasons(rules("Cohort B: NSCLC after one prior line."))).toEqual(["rules"]);
    expect(reasons(rules("No history of non-small cell lung cancer."))).toEqual(["rules"]);
  });

  it("finds trials open to many cancers, by a contained term or a whole condition", () => {
    expect(reasons({ conditions: ["Advanced Solid Tumor"] })).toEqual(["generic"]);
    expect(reasons({ conditions: ["Cancer"] })).toEqual(["generic"]);
    expect(reasons({ conditions: ["Breast Cancer"] })).toEqual([]);
  });

  it("gives several reasons in a fixed order, and none for a trial outside the type", () => {
    expect(reasons({ conditions: ["Solid Tumor", "NSCLC"], ...rules("NSCLC cohort") })).toEqual([
      "names",
      "rules",
      "generic",
    ]);
    expect(reasons({})).toEqual([]);
    expect(reasons({ conditions: ["Small Cell Lung Cancer"] })).toEqual([]);
  });
});
