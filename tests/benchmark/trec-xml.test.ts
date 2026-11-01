import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readTrecTrial, TrecXmlError } from "../../evals/benchmark/trec-xml.js";

/**
 * Three judged trials copied whole from TREC's 2021-04-27 registry copy
 * (public registry records). One has a two-phase label and MeSH terms, one
 * has no condition_browse, and one has entities in its criteria and MeSH terms
 * for its intervention that mustn't count as condition MeSH.
 */
const fixture = (id: string) =>
  readFileSync(new URL(`./fixtures/${id}.xml`, import.meta.url), "utf8");

describe("readTrecTrial", () => {
  it("reads every field the search needs, spelled as the snapshot spells them", () => {
    const trial = readTrecTrial(fixture("NCT00032383"));
    expect(trial).toMatchObject({
      nctId: "NCT00032383",
      briefTitle:
        "Complementary/Alternative Medicine for Abnormality in the Vestibular (Balance) System",
      officialTitle: "Complementary/Alternative Medicine for Vestibulopathy",
      overallStatus: "COMPLETED",
      phases: ["PHASE1", "PHASE2"],
      primaryPurpose: "TREATMENT",
      conditions: ["Vestibular Neuronitis", "Vestibulopathy"],
      keywords: ["Rehabilitation", "Tai Chi"],
      conditionMesh: ["Vestibular Neuronitis"],
      conditionAncestors: [],
      interventions: [{ type: "BEHAVIORAL", name: "Tai Chi" }],
      leadSponsor: "National Center for Complementary and Integrative Health (NCCIH)",
      lastUpdatePostDate: "2007-01-22",
      completionDate: "2003-04",
      sites: [],
    });
    expect(trial.eligibility).toMatchObject({
      sex: "ALL",
      minimumAge: "18 Years",
      maximumAge: null,
      healthyVolunteers: false,
      stdAges: [],
    });
    expect(trial.eligibility.criteriaText).toContain("Main inclusion criteria:\r\n");
    expect(trial.eligibility.criteriaText).toContain(
      "-  vestibulopathy and locomotor unsteadiness",
    );
  });

  it("reads a trial with no condition MeSH, no age limits, healthy volunteers and an unknown status", () => {
    const trial = readTrecTrial(fixture("NCT00065078"));
    expect(trial).toMatchObject({
      overallStatus: "UNKNOWN",
      phases: ["NA"],
      primaryPurpose: "PREVENTION",
      conditions: ["Pregnancy"],
      keywords: ["Home-visits", "Community nurse", "Unintended pregnancy"],
      conditionMesh: [],
      completionDate: "2005-07",
      lastUpdatePostDate: "2005-09-13",
    });
    expect(trial.eligibility).toMatchObject({
      sex: "FEMALE",
      minimumAge: null,
      maximumAge: null,
      healthyVolunteers: true,
    });
  });

  it("decodes entities, and reads MeSH and sponsor only where they belong", () => {
    const trial = readTrecTrial(fixture("NCT00038233"));
    expect(trial.eligibility.criteriaText).toContain(
      "(corrected calcium >11.5 mg%), anemia (Hgb <8.5 gm/dl)",
    );
    expect(trial.eligibility.criteriaText).not.toMatch(/&(gt|lt|#xD);/);
    expect(trial.conditionMesh).toEqual(["Multiple Myeloma", "Neoplasms, Plasma Cell"]);
    expect(trial.leadSponsor).toBe("M.D. Anderson Cancer Center");
    expect(trial.phases).toEqual(["PHASE3"]);
    expect(trial.interventions).toEqual([{ type: "DRUG", name: "Thalidomide" }]);
  });

  it("refuses a trial with no NCT ID or no title, and keeps a missing criteria block as empty text", () => {
    expect(() => readTrecTrial("<clinical_study></clinical_study>")).toThrow(TrecXmlError);
    expect(() =>
      readTrecTrial(
        "<clinical_study><id_info><nct_id>NCT00000001</nct_id></id_info></clinical_study>",
      ),
    ).toThrow(/NCT00000001 has no brief_title/);
    const bare = readTrecTrial(
      "<clinical_study><id_info><nct_id>NCT00000001</nct_id></id_info>" +
        "<brief_title>A &amp; B</brief_title><phase>Early Phase 1</phase></clinical_study>",
    );
    expect(bare.briefTitle).toBe("A & B");
    expect(bare.phases).toEqual(["EARLY_PHASE1"]);
    expect(bare.primaryPurpose).toBeNull();
    expect(bare.eligibility.criteriaText).toBe("");
  });

  it("refuses an element that's never closed", () => {
    expect(() =>
      readTrecTrial(
        "<clinical_study><id_info><nct_id>NCT00000001</nct_id></id_info><brief_title>x",
      ),
    ).toThrow(/never closed/);
  });
});
