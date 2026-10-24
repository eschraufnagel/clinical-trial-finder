import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { trimSnapshotStudy } from "../../src/trials/snapshot-trim.js";
import { SNAPSHOT_FIELDS } from "../../src/trials/snapshot-types.js";
import { TrialFixtureError } from "../../src/trials/types.js";

/**
 * One real registry record with its contacts replaced by invented values
 * (fixtures/README.md). Re-parsed per test so mutations can't leak.
 */
const sampleText = readFileSync(
  fileURLToPath(new URL("./fixtures/snapshot-study.json", import.meta.url)),
  "utf8",
);

// biome-ignore lint/suspicious/noExplicitAny: untyped registry response, mutated freely
function sample(): Record<string, any> {
  return JSON.parse(sampleText);
}

describe("trimSnapshotStudy", () => {
  it("reads every field from the path the spec names", () => {
    const trial = trimSnapshotStudy(sample());

    expect(trial.nctId).toBe("NCT07148128");
    expect(trial.overallStatus).toBe("RECRUITING");
    expect(trial.phases).toEqual(["PHASE1", "PHASE2"]);
    expect(trial.primaryPurpose).toBe("TREATMENT");
    expect(trial.conditions).toContain("Advanced Solid Tumors");
    expect(trial.keywords).toContain("Non-Small Cell Lung Cancer");
    expect(trial.conditionMesh).toEqual([
      "Pancreatic Neoplasms",
      "Colorectal Neoplasms",
      "Lung Neoplasms",
      "Carcinoma",
      "Carcinoma, Non-Small-Cell Lung",
    ]);
    expect(trial.conditionAncestors.length).toBeGreaterThan(0);
    expect(trial.interventions).toEqual([{ type: "DRUG", name: "WEF-001" }]);
    expect(trial.lastUpdatePostDate).toBe("2026-01-29");
    expect(trial.completionDate).toBe("2028-01");
    expect(trial.eligibility.criteriaText.length).toBeGreaterThan(100);
  });

  it("keeps the fields in declaration order, and nothing else", () => {
    expect(Object.keys(trimSnapshotStudy(sample()))).toEqual([...SNAPSHOT_FIELDS]);
  });

  it("keeps only US sites, and of each only where it is and whether it's recruiting", () => {
    const { sites } = trimSnapshotStudy(sample());

    expect(sites).toEqual([
      {
        facility: "NEXT Oncology Dallas",
        city: "Dallas",
        state: "Texas",
        zip: "75230",
        status: "RECRUITING",
        lat: 32.78306,
        lon: -96.80667,
      },
      expect.objectContaining({ city: "San Antonio", state: "Texas" }),
    ]);
  });

  // Contacts name real coordinators. The fixture's are invented, so any of
  // them showing up in the output means a contact path was read.
  it("drops every contact and official", () => {
    const text = JSON.stringify(trimSnapshotStudy(sample()));

    for (const invented of [
      "Site Contact",
      "555-0100",
      "contact@example.org",
      "Example Institution",
    ]) {
      expect(text).not.toContain(invented);
    }
  });

  it("gives null or empty for absent optional fields, and keeps a site with no coordinates", () => {
    const raw = sample();
    delete raw["derivedSection"];
    delete raw["protocolSection"].designModule.designInfo;
    delete raw["protocolSection"].statusModule.completionDateStruct;
    delete raw["protocolSection"].conditionsModule.keywords;
    delete raw["protocolSection"].contactsLocationsModule.locations[0].geoPoint;

    const trial = trimSnapshotStudy(raw);

    expect(trial.conditionMesh).toEqual([]);
    expect(trial.primaryPurpose).toBeNull();
    expect(trial.completionDate).toBeNull();
    expect(trial.keywords).toEqual([]);
    expect(trial.sites[0]).toMatchObject({ city: "Dallas", lat: null, lon: null });
  });

  it("reports every missing required field at once", () => {
    const raw = sample();
    delete raw["protocolSection"].identificationModule.briefTitle;
    delete raw["protocolSection"].statusModule.lastUpdatePostDateStruct;
    delete raw["protocolSection"].eligibilityModule.eligibilityCriteria;

    const error = (() => {
      try {
        trimSnapshotStudy(raw, "page 1");
      } catch (e) {
        return e;
      }
      return undefined;
    })();

    expect(error).toBeInstanceOf(TrialFixtureError);
    expect((error as TrialFixtureError).message).toContain("page 1");
    expect((error as TrialFixtureError).problems).toHaveLength(3);
  });

  it("refuses something with no protocol section", () => {
    expect(() => trimSnapshotStudy({})).toThrow(/protocolSection/);
  });
});
